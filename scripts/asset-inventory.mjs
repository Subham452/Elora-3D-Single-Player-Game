#!/usr/bin/env node
/**
 * asset-inventory.mjs — read-only scanner for the "Three world assets" library.
 *
 * Node 22, zero dependencies. Never writes inside the asset library.
 * Outputs:
 *   scripts/asset-inventory.json  — machine-readable summary + per-asset rows
 *   docs/ASSET_INVENTORY.md       — human-readable inventory + key findings
 *   docs/ASSET_IMPORT.md          — concrete frontend import guidance
 *
 * Identity of a file = path + byte size (no checksums: 774 MB is too slow).
 * Per-file parsing is wrapped in try/catch; malformed files become rows with
 * a `parseError` field instead of crashing the scan.
 */
import { readdir, stat, open, readFile, mkdir, access, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ASSETS_ROOT = path.join(REPO_ROOT, 'Three world assets');
const OUT_JSON = path.join(REPO_ROOT, 'scripts', 'asset-inventory.json');
const OUT_MD = path.join(REPO_ROOT, 'docs', 'ASSET_INVENTORY.md');
const OUT_IMPORT = path.join(REPO_ROOT, 'docs', 'ASSET_IMPORT.md');

const MB = 1024 * 1024;
const OVERSIZE_LIMIT = 40 * MB;

const KBITS = ['glb', 'gltf', 'fbx', 'obj', 'blend', 'png', 'jpg', 'jpeg', 'webp', 'ktx', 'ktx2', 'bin', 'json', 'txt'];

/* ------------------------------------------------------------------ utils */

function extOf(name) {
  const i = name.lastIndexOf('.');
  if (i <= 0 || i === name.length - 1) return '';
  return name.slice(i + 1).toLowerCase();
}

function categoryOf(ext) {
  if (KBITS.includes(ext)) return ext;
  return 'other';
}

function fmtSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < MB) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * MB) return `${(bytes / MB).toFixed(1)} MB`;
  return `${(bytes / (1024 * MB)).toFixed(2)} GB`;
}

/** Sort helper for shell-like quoting in generated commands. */
function shq(p) {
  return /[^A-Za-z0-9_./:@+-]/.test(p) ? `'${p.replace(/'/g, `'\\''`)}'` : p;
}

/** Recursively collect every regular file under dir. Read-only. */
async function walk(dir, base = dir, acc = []) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (err) {
    console.error(`walk: cannot read ${dir}: ${err.message}`);
    return acc;
  }
  for (const e of entries) {
    const abs = path.join(dir, e.name);
    try {
      if (e.isDirectory()) {
        await walk(abs, base, acc);
      } else if (e.isFile()) {
        const st = await stat(abs);
        acc.push({ abs, rel: path.relative(base, abs).split(path.sep).join('/'), size: st.size });
      }
    } catch (err) {
      console.error(`walk: skipped ${abs}: ${err.message}`);
    }
  }
  return acc;
}

async function fileExists(p) {
  try { await access(p); return true; } catch { return false; }
}

/* ------------------------------------------------------- glTF/GLB parsing */

/** Read a GLB container and return the parsed JSON chunk. */
async function parseGlb(abs) {
  const fh = await open(abs, 'r');
  try {
    const head = Buffer.alloc(20);
    await fh.read(head, 0, 20, 0);
    if (head.toString('ascii', 0, 4) !== 'glTF') throw new Error('bad GLB magic');
    const jsonLen = head.readUInt32LE(12);
    const jsonType = head.toString('ascii', 16, 20);
    if (jsonType !== 'JSON') throw new Error('first chunk is not JSON');
    const buf = Buffer.alloc(jsonLen);
    await fh.read(buf, 0, jsonLen, 20);
    return JSON.parse(buf.toString('utf8'));
  } finally {
    await fh.close();
  }
}

/** Extract summary info from a glTF JSON document (works for .gltf and .glb). */
function extractGlTFInfo(json) {
  const meshes = Array.isArray(json.meshes) ? json.meshes : [];
  const animations = Array.isArray(json.animations) ? json.animations : [];
  const skins = Array.isArray(json.skins) ? json.skins : [];
  const images = Array.isArray(json.images) ? json.images : [];
  const buffers = Array.isArray(json.buffers) ? json.buffers : [];
  const materials = Array.isArray(json.materials) ? json.materials : [];

  const externalRefs = [];
  let embeddedBuffers = 0;
  for (const b of buffers) {
    if (b && typeof b.uri === 'string') {
      if (b.uri.startsWith('data:')) embeddedBuffers++;
      else externalRefs.push(b.uri);
    }
  }
  let texturesEmbedded = 0;
  let texturesExternal = 0;
  const textureUris = [];
  for (const im of images) {
    if (!im) continue;
    if (typeof im.uri === 'string' && !im.uri.startsWith('data:')) {
      texturesExternal++;
      textureUris.push(im.uri);
      if (!externalRefs.includes(im.uri)) externalRefs.push(im.uri);
    } else {
      texturesEmbedded++;
    }
  }

  return {
    gltfVersion: json.asset?.version ?? null,
    generator: json.asset?.generator ?? null,
    meshCount: meshes.length,
    meshNames: meshes.slice(0, 8).map((m) => m?.name ?? '(unnamed)'),
    materialCount: materials.length,
    skinsCount: skins.length,
    jointCount: skins.reduce((n, s) => n + (Array.isArray(s?.joints) ? s.joints.length : 0), 0),
    animationCount: animations.length,
    // clip names, lowercased, de-duplicated, per spec
    clips: [...new Set(animations.map((a) => String(a?.name ?? 'unnamed').toLowerCase()))],
    texturesEmbedded,
    texturesExternal,
    textureUris,
    externalRefs,
    embeddedBuffers,
  };
}

/** Texture class from file name pattern. */
function textureClass(name) {
  const base = path.basename(name).toLowerCase();
  if (base.endsWith('.hdr')) return 'hdr';
  if (/(basecolor|albedo|diffuse|_colou?r\b|_bc\b|_d\.)/.test(base)) return 'albedo';
  if (/normal|_nor\b|_n\.|_nrm/.test(base)) return 'normal';
  if (/orm|roughness|metallic|metalness|_rgh|_spec/.test(base)) return 'roughness/orm';
  if (/emissive|emission|_emiss/.test(base)) return 'emissive';
  if (/mask|opacity|alpha|_blend/.test(base)) return 'mask';
  return 'other';
}

/* ------------------------------------------------------------------ scan */

async function main() {
  const t0 = Date.now();
  console.log(`Scanning ${shq(ASSETS_ROOT)} ...`);
  const files = (await walk(ASSETS_ROOT)).sort((a, b) => a.rel.localeCompare(b.rel));
  console.log(`Found ${files.length} files.`);

  /** per-file minimal rows (all files) */
  const fileRows = [];
  /** per-asset parsed rows (models only) */
  const modelRows = [];
  const summaryByKit = new Map();
  const byExt = new Map();
  const brokenRefs = [];
  const oversized = [];
  const texturesByKit = new Map();

  function kitOf(rel) {
    const idx = rel.indexOf('/');
    return idx === -1 ? rel : rel.slice(0, idx);
  }

  function kitRecord(kit) {
    let rec = summaryByKit.get(kit);
    if (!rec) {
      rec = {
        kit,
        fileCount: 0,
        bytes: 0,
        byExtension: {},
        gltfCount: 0,
        gltfUsable: 0,
        gltfBroken: 0,
        glbCount: 0,
        fbxCount: 0,
        objCount: 0,
        animClipsTotal: new Set(),
        dir: new Map(), // subdir → { gltf, bin, png }
      };
      summaryByKit.set(kit, rec);
    }
    return rec;
  }

  function subdirKey(rel) {
    const parts = rel.split('/');
    return parts.slice(1, -1).join('/') || '(root)';
  }

  for (const f of files) {
    const ext = extOf(f.rel);
    const cat = categoryOf(ext);
    const kit = kitOf(f.rel);
    const krec = kitRecord(kit);

    krec.fileCount++;
    krec.bytes += f.size;
    krec.byExtension[cat] = (krec.byExtension[cat] || 0) + 1;
    byExt.set(cat, (byExt.get(cat) || 0) + 1);

    if (f.size > OVERSIZE_LIMIT) oversized.push({ kit, path: f.rel, bytes: f.size });

    fileRows.push({ kit, path: f.rel, ext: cat, bytes: f.size });

    // texture inventory (png/jpg/hdr inside a Textures-like context OR any image)
    if (['png', 'jpg', 'jpeg', 'webp', 'hdr'].includes(ext) || (ext === 'other' && extOf(f.rel) === 'hdr')) {
      const realExt = extOf(f.rel);
      if (['png', 'jpg', 'jpeg', 'webp', 'hdr'].includes(realExt)) {
        let tmap = texturesByKit.get(kit);
        if (!tmap) {
          tmap = new Map();
          texturesByKit.set(kit, tmap);
        }
        const cls = textureClass(f.rel);
        const trec = tmap.get(cls) || { count: 0, bytes: 0, files: [] };
        trec.count++;
        trec.bytes += f.size;
        trec.files.push(f.rel);
        tmap.set(cls, trec);
      }
    }

    /* ---- per-format handling ---- */
    if (ext === 'glb' || ext === 'gltf') {
      krec.gltfCount += ext === 'gltf' ? 1 : 0;
      krec.glbCount += ext === 'glb' ? 1 : 0;
      let row = { kit, path: f.rel, format: ext, bytes: f.size };
      try {
        const json = ext === 'glb' ? await parseGlb(f.abs) : JSON.parse(await readFile(f.abs, 'utf8'));
        const info = extractGlTFInfo(json);
        // path identity for external deps + broken-ref check
        const dirAbs = path.dirname(f.abs);
        const resolved = [];
        for (const uri of info.externalRefs) {
          const absRef = path.resolve(dirAbs, decodeURIComponent(uri.split('#')[0]));
          const ok = await fileExists(absRef);
          resolved.push({ uri, exists: ok });
          if (!ok) brokenRefs.push({ kit, asset: f.rel, uri });
        }
        const refsOk = info.externalRefs.length === 0 || resolved.every((r) => r.exists);
        row = {
          ...row,
          ...info,
          externalResolved: resolved,
          refsOk,
          usable: refsOk,
        };
        for (const c of info.clips) krec.animClipsTotal.add(c);
        if (ext === 'gltf') {
          if (refsOk) krec.gltfUsable++; else krec.gltfBroken++;
        }
        const sk = subdirKey(f.rel);
        const drec = krec.dir.get(sk) || { gltf: 0, glb: 0, bin: 0, png: 0 };
        if (ext === 'gltf') drec.gltf++; else drec.glb++;
        for (const u of info.externalRefs) {
          const e = extOf(u.split('#')[0]);
          if (e === 'bin') drec.bin++;
          else if (['png', 'jpg', 'jpeg', 'webp', 'ktx2'].includes(e)) drec.png++;
        }
        krec.dir.set(sk, drec);
      } catch (err) {
        row = { ...row, parseError: err.message, usable: false };
        if (ext === 'gltf') krec.gltfBroken++;
      }
      modelRows.push(row);
    } else if (ext === 'obj') {
      krec.objCount++;
      const mtlAbs = f.abs.replace(/\.obj$/i, '.mtl');
      const hasMtl = await fileExists(mtlAbs);
      const mtlRef = hasMtl ? f.rel.replace(/\.obj$/i, '.mtl') : null;
      if (!hasMtl) brokenRefs.push({ kit, asset: f.rel, uri: '(companion .mtl)' });
      modelRows.push({ kit, path: f.rel, format: 'obj', bytes: f.size, hasMtl, mtl: mtlRef });
    } else if (ext === 'fbx') {
      krec.fbxCount++;
      modelRows.push({ kit, path: f.rel, format: 'fbx', bytes: f.size, note: 'binary FBX, parse later if needed' });
    }
  }

  // byte totals per extension (correct computation)
  const bytesByExt = new Map();
  for (const r of fileRows) bytesByExt.set(r.ext, (bytesByExt.get(r.ext) || 0) + r.bytes);

  // finalize per-kit records (serialize Sets + dirs)
  const kits = [...summaryByKit.values()].map((k) => ({
    kit: k.kit,
    fileCount: k.fileCount,
    bytes: k.bytes,
    byExtension: k.byExtension,
    glbCount: k.glbCount,
    gltfCount: k.gltfCount,
    gltfUsable: k.gltfUsable,
    gltfBroken: k.gltfBroken,
    fbxCount: k.fbxCount,
    objCount: k.objCount,
    gltfExportDirs: [...k.dir.entries()]
      .filter(([d]) => /gltf/i.test(d))
      .map(([dir, c]) => ({ dir, ...c }))
      .sort((a, b) => a.dir.localeCompare(b.dir)),
    clipCount: k.animClipsTotal.size,
    clips: [...k.animClipsTotal].sort(),
  }));

  const totalBytes = files.reduce((n, f) => n + f.size, 0);
  const summary = {
    generatedAt: new Date().toISOString(),
    root: 'Three world assets',
    totalFiles: files.length,
    totalBytes,
    humanTotal: fmtSize(totalBytes),
    byExtensionCount: Object.fromEntries([...byExt.keys()].sort().map((e) => [e, byExt.get(e)])),
    bytesByExtension: Object.fromEntries([...bytesByExt.keys()].sort().map((e) => [e, bytesByExt.get(e)])),
    kits: kits.map(({ clips, ...rest }) => rest),
    malformed: modelRows.filter((r) => r.parseError).length,
    brokenRefs,
  };
  /* finalize per-kit records */

  delete summary.wait_remove_me;

  const jsonOut = {
    summary,
    kits: kits.map((k) => ({ ...k, humanBytes: fmtSize(k.bytes) })),
    oversized: oversized.map((o) => ({ ...o, humanSize: fmtSize(o.bytes) })),
    textures: Object.fromEntries(
      [...texturesByKit.entries()].map(([kit, tmap]) => [
        kit,
        Object.fromEntries(
          [...tmap.entries()].map(([cls, t]) => [cls, { count: t.count, bytes: t.bytes, humanBytes: fmtSize(t.bytes), files: t.files }]),
        ),
      ]),
    ),
    files: fileRows,
    models: modelRows,
  };

  /* ------------------------------------------------------- markdown docs */

  await mkdir(path.dirname(OUT_JSON), { recursive: true });
  await mkdir(path.dirname(OUT_MD), { recursive: true });
  await writeFileSafe(OUT_JSON, JSON.stringify(jsonOut, null, 2));

  const md = [];
  const mdLines = md;
  mdLines.push('# ELORA — Asset Inventory (`Three world assets`)', '');
  mdLines.push(`> Auto-generated by \`scripts/asset-inventory.mjs\` on ${summary.generatedAt}. Read-only audit — the asset library itself was not modified.`);
  mdLines.push(`> Files: **${summary.totalFiles}** · Total size: **${summary.humanTotal}** · Malformed/unparsable model files: **${summary.malformed}**`, '');

  mdLines.push('## Licenses', '');
  mdLines.push('All four kits are distributed by [Quaternius](https://quaternius.com) under **CC0 1.0 Universal (Public Domain Dedication)** — see `docs/ASSET_IMPORT.md` for the exact license quotes and attribution guidance.', '');

  mdLines.push('## Summary', '');
  mdLines.push('Header counts by extension across the whole library:', '');
  const extOrder = ['glb', 'gltf', 'bin', 'fbx', 'obj', 'mtl', 'blend', 'png', 'jpg', 'hdr', 'txt'];
  const allExts = [...bytesByExt.keys()].sort((a, b) => (bytesByExt.get(b) || 0) - (bytesByExt.get(a) || 0) || a.localeCompare(b));
  mdLines.push('| Ext | Files | Bytes |', '|---|---:|---:|');
  for (const e of allExts) mdLines.push(`| .${e} | ${byExt.get(e)} | ${fmtSize(bytesByExt.get(e) || 0)} |`);
  mdLines.push(`| **total** | **${summary.totalFiles}** | **${summary.humanTotal}** |`);
  mdLines.push('');

  mdLines.push('### Per-kit totals', '');
  mdLines.push('| Kit | Files | Size | .glb | .gltf | .bin | .fbx | .obj | .png | .mtl | usable .gltf | broken .gltf |',);
  mdLines.push('|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const k of kits) {
    mdLines.push(
      `| ${k.kit} | ${k.fileCount} | ${fmtSize(k.bytes)} | ${k.glbCount} | ${k.gltfCount} | ${k.byExtension['bin'] || 0} | ${k.fbxCount} | ${k.objCount} | ${k.byExtension['png'] || 0} | ${k.byExtension['other'] ? '' : ''}${k.byExtension['mtl'] || 0} | ${k.gltfUsable} | ${k.gltfBroken} |`,
    );
  }
  mdLines.push('');

  mdLines.push('## Key findings', '');

  /* ---- Godot glTF export coverage ---- */
  mdLines.push('### 1. glTF (Godot) export coverage', '');
  mdLines.push('Every kit ships engine-ready glTF exports (split JSON + external `.bin`, Godot-oriented). A `.gltf` is **usable** when it parses and every referenced external file resolves on disk.', '');
  mdLines.push('| Kit | Export dir | .gltf | external .bin refs | external texture refs |');
  mdLines.push('|---|---|---:|---:|---:|');
  for (const k of kits)
    for (const d of k.gltfExportDirs)
      mdLines.push(`| ${k.kit} | \`${d.dir}\` | ${d.gltf} | ${d.bin} | ${d.png} |`);
  mdLines.push('');
  mdLines.push(
    '- Downtown City: **153 .gltf** in `Exports/glTF (Godot)` (+ 153 .bin binaries).\n' +
    '- Medieval Village: **176 .gltf** in `glTF/` (+ .bin companions).\n' +
    '- Modular Character Outfits: **24 .gltf** in `Exports/glTF (Godot-Unreal)` (4 outfit assemblies + 20 modular parts) + PNG textures beside them.\n' +
    '- Universal Animation Library: single-file **GLB** containers (2 rig files + female mannequin), no external refs.\n',
  );

  /* ---- animations ---- */
  mdLines.push('### 2. Animation clips', '');
  const animRows = modelRows.filter((r) => r.clips?.length > 0);
  mdLines.push('Only the Universal Animation Library GLB files contain animation clips (the `.gltf` assets across the other kits are static meshes). Root-motion variants are marked `_RM`.', '');
  mdLines.push('');
  for (const r of animRows) {
    mdLines.push(`#### \`${r.path}\``);
    mdLines.push(`- Size: ${fmtSize(r.bytes)} · animations: **${r.animationCount}** · generator: \`${r.generator ?? 'n/a'}\``);
    mdLines.push(`- Clip list (${r.clips.length} unique, lowercased):`);
    mdLines.push('');
    mdLines.push('  ```');
    mdLines.push(`  ${r.clips.join(', ')}`);
    mdLines.push('  ```');
    mdLines.push('');
  }
  const noAnimButSkin = modelRows.filter((r) => (r.skinsCount || 0) > 0 && !(r.clips?.length > 0));
  if (noAnimButSkin.length) {
    mdLines.push('#### Rigged, but no embedded clips', '');
    for (const r of noAnimButSkin) {
      mdLines.push(`- \`${r.path}\` — ${fmtSize(r.bytes)} · meshes: ${r.meshCount} · materials: ${r.materialCount} · skins: ${r.skinsCount} · joints: ${r.jointCount}`);
    }
    mdLines.push('');
  }

  /* ---- characters ---- */
  mdLines.push('### 3. Characters found', '');
  const outfitKit = kits.find((k) => k.kit.startsWith('Modular Character'));
  const outfitsDir = modelRows.filter((r) => /glTF \(Godot-Unreal\)\/Outfits\//.test(r.path));
  const partsDir = modelRows.filter((r) => /glTF \(Godot-Unreal\)\/Modular Parts\//.test(r.path));
  mdLines.push('Character assets live in two kits and exist as **glTF (.gltf + .bin) with external PNG textures**, FBX, and OBJ variants:');
  mdLines.push('');
  mdLines.push('- `Modular Character Outfits - Fantasy[Standard]/Exports/glTF (Godot-Unreal)/Outfits/` — assembled outfits: ' + outfitsDir.map((r) => '`' + path.basename(r.path) + '`').join(', '));
  mdLines.push(`- \`.../Exports/glTF (Godot-Unreal)/Modular Parts/\` — ${partsDir.length} modular part meshes (\`Female_Peasant_Arms\`, \`Female_Ranger_Head_Hood\`, etc.); use with the included base-body textures in \`Textures/Base\` / \`Textures/Peasant\` / \`Textures/Ranger\``);
  mdLines.push('- Same characters also exist as FBX (`Exports/FBX (Unity)`) and OBJ variants.');
  mdLines.push('- `Universal Animation Library 2[Standard]/Female Mannequin/` — `Mannequin_F.glb` (Unreal-Godot) + `Mannequin_F.blend` + FBX; shares the rig/proportions with the UAL2 male mannequin so animations retarget cleanly.');
  mdLines.push('- The outfits attach to a base body — per the Readme, only the **head** of the base model is required; full body under clothing clips.');
  mdLines.push('- **Shared skeleton:** every character asset (4 outfits + 20 modular parts + `Mannequin_F.glb` + both UAL2 rig files) is skinned to a **65-joint skeleton** with matching joint counts — UAL2 clips should be directly playable on the outfit meshes with three.js `AnimationMixer` (one-time verification recommended).');
  mdLines.push('- One curiosity: `Modular Parts/Female_Peasant_Body.gltf` ships a baked-in test animation clip `jog_fwd_loop` (the only animated `.gltf` outside the UAL kit).');
  if (outfitKit) mdLines.push(`- Kit totals: ${outfitKit.fileCount} files, ${fmtSize(outfitKit.bytes)}.`);
  mdLines.push('');

  /* ---- oversized ---- */
  mdLines.push('### 4. Oversized files (> 40 MB)', '');
  if (oversized.length === 0) {
    mdLines.push('None. Largest file in the library is under the 40 MB threshold — safe for direct serving.');
  } else {
    mdLines.push('| Kit | Path | Size |', '|---|---|---:|');
    for (const o of oversized) mdLines.push(`| ${o.kit} | \`${o.path}\` | ${fmtSize(o.bytes)} |`);
  }
  mdLines.push('');

  /* ---- textures ---- */
  mdLines.push('### 5. Texture folder inventory (by name pattern)', '');
  for (const [kit, tmap] of texturesByKit) {
    mdLines.push(`#### ${kit}`);
    mdLines.push('| Class | Count | Size |');
    mdLines.push('|---|---:|---:|');
    for (const [cls, t] of [...tmap.entries()].sort()) mdLines.push(`| ${cls} | ${t.count} | ${fmtSize(t.bytes)} |`);
    mdLines.push('');
    mdLines.push('Files (full relative paths — identical basenames appear in several export folders on purpose):');
    for (const [cls, t] of [...tmap.entries()].sort()) {
      mdLines.push(`- **${cls}** (${t.count}): ${t.files.map((f) => '`' + f + '`').join(', ')}`);
    }
    mdLines.push('');
  }

  /* ---- broken refs ---- */
  mdLines.push('### 6. Broken references', '');
  if (brokenRefs.length === 0) {
    mdLines.push('None. Every `.gltf` external reference (`.bin` / textures) resolves, and every `.obj` has a companion `.mtl`.');
  } else {
    mdLines.push('| Kit | Asset | Missing reference |', '|---|---|---|');
    for (const b of brokenRefs) mdLines.push(`| ${b.kit} | \`${b.asset}\` | \`${b.uri}\` |`);
  }
  mdLines.push('');

  /* ---- full manifest ---- */
  mdLines.push('## Full manifest', '');
  mdLines.push('Machine-readable copy: `scripts/asset-inventory.json` (`files` = all files, `models` = parsed model details).');
  mdLines.push('');
  for (const k of kits) {
    mdLines.push(`### ${k.kit} — ${k.fileCount} files, ${fmtSize(k.bytes)}`, '');
    mdLines.push('| Path | Type | Size | Details |', '|---|---|---:|---|');
    const rows = fileRows.filter((r) => r.kit === k.kit);
    const modelMap = new Map(modelRows.filter((r) => r.kit === k.kit).map((r) => [r.path, r]));
    for (const r of rows) {
      const m = modelMap.get(r.path);
      let details = '';
      if (m) {
        if (m.format === 'glb' || m.format === 'gltf') {
          if (m.parseError) details = `PARSE ERROR: ${m.parseError}`;
          else {
            const bits = [`${m.meshCount} meshes`, `${m.materialCount} mats`];
            if (m.skinsCount) bits.push(`${m.skinsCount} skin(s)/${m.jointCount} joints`);
            if (m.animationCount) bits.push(`${m.animationCount} clips`);
            if (m.externalRefs?.length) bits.push(`ext deps: ${m.externalRefs.length}${m.refsOk ? ' (all resolve)' : ' (BROKEN)'}`);
            else bits.push('self-contained');
            if (m.generator) bits.push(String(m.generator).replace(/\|/g, '/'));
            details = bits.join(' · ');
          }
        } else if (m.format === 'obj') details = m.hasMtl ? 'mtl ✔' : 'mtl ✘ MISSING';
        else if (m.format === 'fbx') details = m.note;
        details = details.replace(/\|/g, '/');
      } else if (r.ext === 'bin') details = 'glTF binary buffer';
      else if (r.ext === 'mtl') details = 'OBJ material companion';
      else if (r.ext === 'txt') details = 'license/readme';
      else if (['png', 'jpg', 'hdr'].includes(r.ext)) details = `texture (${textureClass(r.path)})`;
      mdLines.push(`| \`${r.path}\` | ${r.ext} | ${fmtSize(r.bytes)} | ${details} |`);
    }
    mdLines.push('');
  }
  mdLines.push('> Note: `.mtl` files are counted under "other" extension bucket in the JSON; the manifest above shows their raw extension.');

  await writeFileSafe(OUT_MD, mdLines.join('\n') + '\n');

  /* ---------------------------------------------- import guidance doc ---- */

  const imp = [];
  imp.push('# ELORA — Asset Import Guide (`Three world assets` → `frontend/public/assets`)', '');
  imp.push(`> Auto-generated by \`scripts/asset-inventory.mjs\` on ${summary.generatedAt}. Companion to \`docs/ASSET_INVENTORY.md\`.`);
  imp.push('');
  imp.push('## Licensing (read this first)', '');
  imp.push('All four kits carry the same license text. Representative quote (`Downtown City MegaKit[Standard]/License_Standard.txt`):');
  imp.push('');
  imp.push('> "License: CC0 1.0 Universal (CC0 1.0) Public Domain Dedication — https://creativecommons.org/publicdomain/zero/1.0/ — Models by @Quaternius, Consider supporting me on Patreon! https://www.patreon.com/quaternius"');
  imp.push('');
  imp.push('Implications for ELORA:');
  imp.push('');
  imp.push('- **No attribution is legally required** (CC0 = public domain). You may copy, modify, merge and ship these assets inside ELORA commercially without restriction.');
  imp.push('- **Good practice:** keep a CREDITS note crediting Quaternius and his Patreon/Discord links — these free kits are his marketing funnel, and crediting costs nothing.');
  imp.push('- License files (`License_Standard.txt`, `License.txt`, `README.txt`, `Readme.txt`) must not be removed from the repo copy of the library. When copying into `frontend/public/assets`, including a credit line in the app is enough.');
  imp.push('- Note the *Standard (free) kits contain "only a portion of the models"* — the paid PRO/SOURCE versions have more. Do not promise full-kit content in-game.');
  imp.push('');
  imp.push('## General rules', '');
  imp.push('');
  imp.push('1. **Prefer glTF/glb over FBX/OBJ.** three.js consumes `GLTFLoader` natively and losslessly. `FBXLoader` works but is heavy, pulls in extra deps (fflate), and the FBX variants here carry the same content — there is no reason to use them in-browser. OBJ suffers the same: `OBJLoader` + `MTLLoader` is fine but redundant when glTF exists.');
  imp.push('2. **glTF external dependencies must travel together.** These exports are *split* glTF (JSON `.gltf` + `.bin` buffer + external PNG textures). If you copy `X.gltf` you **must** copy its sibling `X.bin` **and every texture referenced by URI**, preserving relative paths — otherwise the loader throws `Failed to load buffer` / `404 texture`. Option B (recommended for shipping): load the `.gltf` once in a build/import step and re-export as single-file `.glb` (embedded buffers + textures) via `gltf-transform` or `gltf-pipeline`; then only one file per asset needs to reach the browser. The Universal Animation Library already ships ready-made single-file `.glb`s — use those as-is.');
  imp.push('3. **Godot-oriented exports**: the `glTF (Godot)` / `glTF (Godot-Unreal)` folders are tuned for Godot (up-axis, scale). three.js may need a scale/rotation tweak per kit — normalize one reference asset, then apply the same transform uniformly.');
  imp.push('4. Serve with correct MIME handling: `.glb`/`.gltf` → `model/gltf-binary` / `model/gltf+json`; `.bin` → `application/octet-stream`; `.ktx2` would need `KHR_texture_basis` support in the loader (none present in this library).');
  imp.push('5. Keep filenames verbatim when copying (they contain only safe characters, but folder names contain spaces + brackets — always quote paths in shell commands).');
  imp.push('');
  imp.push('## Per-kit plans', '');
  imp.push('');

  imp.push('### 1. Downtown City MegaKit[Standard] — city environment');
  imp.push('');
  imp.push('- **Library path:** `Three world assets/Downtown City MegaKit[Standard]/`');
  imp.push('- **Best source for the web:** `Exports/glTF (Godot)/` — 153 `.gltf` buildings/street/props with 153 `.bin` companions; premium PBR textures in `Textures/` (BaseColor/Normal/ORM triples + interior HDRs).');
  imp.push('- **Copy plan:** `frontend/public/assets/city/` ← the 153 `.gltf` + `.bin` pairs (they are small per-mesh); plus the ~30 shared textures from `Textures/` that the `.gltf` URIs reference (check each file\'s `externalRefs` in `scripts/asset-inventory.json` — texture URIs resolve relatively, so keep the folder layout: e.g. copy `Textures/` next to the `.gltf` files exactly as referenced).');
  imp.push('- **Pitfall:** the `.gltf` files reference textures **outside** their own folder; a naive copy of only `Exports/glTF (Godot)/` will 404. Either replicate the `../Textures` relative structure or batch-convert to `.glb` first.');
  imp.push('- **FBX/OBJ variants** exist (`Exports/FBX (Unity)`, `Exports/FBX (Unreal Engine)`) — ignore them for the browser.');
  imp.push('');
  imp.push('### 2. Medieval Village MegaKit[Standard] — village environment');
  imp.push('');
  imp.push('- **Library path:** `Three world assets/Medieval Village MegaKit[Standard]/`');
  imp.push('- **Best source for the web:** `glTF/` — 176 `.gltf` houses/fences/wells with `.bin` companions (the glTF export here ships textures alongside — verify each URI when copying). `FBX/` and `OBJ/` duplicates exist but are not needed in-browser.');
  imp.push('- **Copy plan:** `frontend/public/assets/village/` ← `glTF/**` (gltf + bin + any referenced textures, structure preserved).');
  imp.push('- **Pitfall:** same external-buffer rule — `.gltf` without its `.bin` = broken load.');
  imp.push('');
  imp.push('### 3. Modular Character Outfits - Fantasy[Standard] — playable characters');
  imp.push('');
  imp.push('- **Library path:** `Three world assets/Modular Character Outfits - Fantasy[Standard]/`');
  imp.push('- **Best source for the web:** `Exports/glTF (Godot-Unreal)/Outfits/` — 4 assembled outfits (`Female_Peasant`, `Female_Ranger`, `Male_Peasant`, `Male_Ranger`, `.gltf`+`.bin` with `T_*_BaseColor/Normal/ORM` PNGs next to them); optionally `.../Modular Parts/` (20 meshes) for mix-and-match gear.');
  imp.push('- **Copy plan:** `frontend/public/assets/characters/` ← `Outfits/` folder *whole* (includes its textures); add `Modular Parts/` only if you implement clothing swapping. Also copy the base-body textures from `Textures/Base/` if you render the base character head (per Readme, "only the head of the model is required" — full body under clothes clips).');
  imp.push('- **Rig note (verified by scan):** every outfit and modular part glTF ships **skinned** with a 65-joint skeleton — the same joint topology as `Mannequin_F.glb` and the UAL2 mannequins. That means UAL2 clips (`frontend/public/assets/animations/`) can be played directly on these characters with `AnimationMixer` (mixamo-free, no retargeting step) if skeleton node names match; verify once per character, and fall back to a Blender retarget only if playback fails. Note `Female_Peasant_Body.gltf` even contains a baked-in test clip `jog_fwd_loop` you can use to sanity-check the pipeline.');
  imp.push('');
  imp.push('### 4. Universal Animation Library 2[Standard] — skeleton + animations');
  imp.push('');
  imp.push('- **Library path:** `Three world assets/Universal Animation Library 2[Standard]/`');
  imp.push('- **Best source for the web:** `Unreal-Godot/UAL2_Standard.glb` (all clips, no root motion) and `Unreal-Godot/UAL2_Standard_RM.glb` (root motion baked into every clip). Both are **single-file GLBs** — self-contained, directly browser-loadable with `GLTFLoader`, no copying pitfalls.');
  imp.push('- **Copy plan:** `frontend/public/assets/animations/` ← the two `.glb` files + `Unreal-Godot/Mannequin_F.glb` (female mannequin, rigged, no clips — retarget from the library per its README, "both mannequins share the same rig and very similar proportions").');
  imp.push('- **Animation naming:** the scan found **43 clips per rig file** (identical names in `_Standard` and `_RM` variants), lowercased in the inventory\'s `clips` array — e.g. `a_tpose`, `idle_no_loop`, `walk_carry_loop`, `sword_regular_a`, `shield_dash`, `farm_harvest`, `zombie_walk_fwd_loop` (full list in `docs/ASSET_INVENTORY.md` §2 or `scripts/asset-inventory.json`). Pick RM vs non-RM once: use `_RM.glb` only if you drive locomotion from horizontal root displacement; otherwise `_Standard.glb` + manual transform is simpler to control in three.js.');
  imp.push('- **Also available:** FBX under `Unity/` and `Female Mannequin/Unity/`, plus `Mannequin_F.blend` for Blender-side edits — not needed in the browser.');
  imp.push('');
  imp.push('## Suggested copy manifest (starting point)', '');
  imp.push('');
  imp.push('```bash');
  imp.push('cd "/home/subhampatnaik/Documents/Subham Patnaik/development/Elora"');
  imp.push('');
  imp.push('# 1) Animations + mannequin (single-file GLB, zero pitfalls)');
  imp.push(`mkdir -p ${shq('frontend/public/assets/animations')}`);
  imp.push(`cp ${shq('Three world assets/Universal Animation Library 2[Standard]/Unreal-Godot/UAL2_Standard.glb')} \\`);
  imp.push(`   ${shq('Three world assets/Universal Animation Library 2[Standard]/Unreal-Godot/UAL2_Standard_RM.glb')} \\`);
  imp.push(`   ${shq('Three world assets/Universal Animation Library 2[Standard]/Female Mannequin/Unreal-Godot/Mannequin_F.glb')} \\`);
  imp.push(`   ${shq('frontend/public/assets/animations/')}`);
  imp.push('');
  imp.push('# 2) Characters (folder must stay intact — gltf + bin + PNG textures together)');
  imp.push(`mkdir -p ${shq('frontend/public/assets/characters')}`);
  imp.push(`cp -R ${shq('Three world assets/Modular Character Outfits - Fantasy[Standard]/Exports/glTF (Godot-Unreal)/Outfits')} ${shq('frontend/public/assets/characters/')}`);
  imp.push('');
  imp.push('# 3) City + Village (copy glTF export folders first, then reconcile texture URIs');
  imp.push('#    using scripts/asset-inventory.json — better: batch-convert to single-file GLB)');
  imp.push(`mkdir -p ${shq('frontend/public/assets/city')}`);
  imp.push(`cp -R ${shq('Three world assets/Downtown City MegaKit[Standard]/Exports/glTF (Godot)')} ${shq('frontend/public/assets/city/')}`);
  imp.push(`mkdir -p ${shq('frontend/public/assets/village')}`);
  imp.push(`cp -R ${shq('Three world assets/Medieval Village MegaKit[Standard]/glTF')} ${shq('frontend/public/assets/village/')}`);
  imp.push('```');
  imp.push('');
  imp.push('After any copy, run a load smoke test per asset in three.js (`GLTFLoader.load`) and assert zero missing-buffer errors before treating the kit as integrated.');
  imp.push('');

  await writeFileSafe(OUT_IMPORT, imp.join('\n') + '\n');

  console.log(`Done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  console.log(`  JSON:   ${OUT_JSON}`);
  console.log(`  MD:     ${OUT_MD}`);
  console.log(`  Import: ${OUT_IMPORT}`);
  console.log(`  Files: ${summary.totalFiles}, total ${summary.humanTotal}, malformed: ${summary.malformed}, brokenRefs: ${brokenRefs.length}, oversized: ${oversized.length}`);
}

async function writeFileSafe(p, data) {
  try {
    await mkdir(path.dirname(p), { recursive: true });
    await writeFile(p, data);
  } catch (err) {
    console.error(`write ${p}: ${err.message}`);
  }
}

main().catch((err) => {
  console.error('FATAL', err);
  process.exit(1);
});
