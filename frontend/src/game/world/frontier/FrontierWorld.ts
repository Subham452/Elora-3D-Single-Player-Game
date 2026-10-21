import * as THREE from "three";
import {
  type Collider,
  type GameWorldActions,
  type InteractableDef,
} from "@/game/interactions/interactions";
import { terrainHeight, WATER_LEVEL, fbm } from "@/game/world/voxel/terrainNoise";
import { VoxelChunk, CHUNK } from "@/game/world/voxel/VoxelChunk";

/**
 * Elora Frontier Valley — the Phase 1.5 playable region.
 * Hand-placed village + procedural chunked terrain + props. Everything walks
 * through the same terrainHeight() source of truth.
 */

// ————————————————————————— materials (shared) —————————————————————————
const M = {
  wood: new THREE.MeshStandardMaterial({ color: 0x8a5f3c, roughness: 0.85 }),
  woodDark: new THREE.MeshStandardMaterial({ color: 0x5e4227, roughness: 0.9 }),
  plank: new THREE.MeshStandardMaterial({ color: 0x9a6b3f, roughness: 0.8 }),
  stone: new THREE.MeshStandardMaterial({ color: 0x86898f, roughness: 1 }),
  wall: new THREE.MeshStandardMaterial({ color: 0xe4d5b5, roughness: 0.9 }),
  wall2: new THREE.MeshStandardMaterial({ color: 0xd9c3a3, roughness: 0.9 }),
  roof: new THREE.MeshStandardMaterial({ color: 0x9a4f38, roughness: 0.85 }),
  roof2: new THREE.MeshStandardMaterial({ color: 0x6d4d8f, roughness: 0.85 }),
  path: new THREE.MeshStandardMaterial({ color: 0xb59a76, roughness: 1 }),
  trunk: new THREE.MeshStandardMaterial({ color: 0x74573a, roughness: 1 }),
  leaf: new THREE.MeshStandardMaterial({ color: 0x3f8a48, roughness: 1 }),
  leafAlt: new THREE.MeshStandardMaterial({ color: 0x5a9e50, roughness: 1 }),
  rock: new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 1 }),
  flowerHead: new THREE.MeshStandardMaterial({ color: 0xe46d7d, roughness: 1 }),
  flowerHead2: new THREE.MeshStandardMaterial({ color: 0xf2d46d, roughness: 1 }),
  crop: new THREE.MeshStandardMaterial({ color: 0x7fae42, roughness: 1 }),
  lamp: new THREE.MeshStandardMaterial({ color: 0x2f3542, roughness: 0.6, metalness: 0.3 }),
  bulb: new THREE.MeshStandardMaterial({
    color: 0xfff3d0,
    emissive: 0xffe2a8,
    emissiveIntensity: 0,
  }),
  pickupSeed: new THREE.MeshStandardMaterial({
    emissive: 0xffd54f,
    emissiveIntensity: 2.2,
    color: 0x372b10,
  }),
  pickupBloom: new THREE.MeshStandardMaterial({
    emissive: 0xff8ab0,
    emissiveIntensity: 2.2,
    color: 0x2d0e18,
  }),
  pickupStone: new THREE.MeshStandardMaterial({
    emissive: 0x8ec9ff,
    emissiveIntensity: 2,
    color: 0x101a26,
  }),
  water: new THREE.MeshStandardMaterial({
    color: 0x2e6f9e,
    transparent: true,
    opacity: 0.78,
    roughness: 0.08,
    metalness: 0.12,
  }),
};

function box(
  w: number,
  h: number,
  d: number,
  mat: THREE.Material,
  x: number,
  y: number,
  z: number,
): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y + h / 2, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export interface FrontierWorld {
  root: THREE.Group;
  water: THREE.Mesh;
  colliders: Collider[];
  interactables: InteractableDef[];
  /** Shared material so the engine can animate bulb emissive at night. */
  lampMat: THREE.MeshStandardMaterial;
  update: (dt: number, t: number, inside?: boolean) => void;
}

export interface FrontierOpts {
  actions: GameWorldActions;
  /** pickup types: "seed" | "bloom" | "stoneShard" */
  onPickup: (kind: PickKind) => void;
  isPicked: (id: string) => boolean;
}

export type PickKind = "seed" | "bloom" | "stoneShard";

export class FrontierWorldBuilder {
  readonly colliders: Collider[] = [];
  readonly interactables: InteractableDef[] = [];
  readonly root = new THREE.Group();
  readonly water: THREE.Mesh;
  private doors: { mesh: THREE.Object3D; open: boolean; t: number }[] = [];
  private lampLights: THREE.PointLight[] = [];
  private chunks = new Map<string, VoxelChunk>();

  constructor(private opts: FrontierOpts) {
    this.water = new THREE.Mesh(new THREE.PlaneGeometry(320, 320), M.water);
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.set(0, WATER_LEVEL + 0.42, 0);
    this.water.receiveShadow = false;
  }

  /** Chunked terrain streaming (simple ring). Returns disposed chunk count. */
  buildTerrain(renderRadiusChunks: number): void {
    const pcx = 0;
    const pcz = 1; // spawn chunk (village center ≈ (-15, 24) → chunk (0..))
    for (let dx = -renderRadiusChunks; dx <= renderRadiusChunks; dx++) {
      for (let dz = -renderRadiusChunks; dz <= renderRadiusChunks; dz++) {
        if (dx * dx + dz * dz > renderRadiusChunks * renderRadiusChunks + 1) continue;
        const cx = pcx + dx;
        const cz = pcz + dz;
        const key = `${cx}_${cz}`;
        if (this.chunks.has(key)) continue;
        const chunk = new VoxelChunk(cx, cz);
        this.chunks.set(key, chunk);
        for (const m of chunk.meshes) this.root.add(m);
      }
    }
  }

  /** Called with the player's chunk — trims far chunks, adds new ring chunks. */
  updateChunks(pWorldX: number, pWorldZ: number, radiusChunks: number): void {
    const pcx = Math.floor(pWorldX / CHUNK);
    const pcz = Math.floor(pWorldZ / CHUNK);
    const need = new Set<string>();
    for (let dx = -radiusChunks; dx <= radiusChunks; dx++) {
      for (let dz = -radiusChunks; dz <= radiusChunks; dz++) {
        if (dx * dx + dz * dz > radiusChunks * radiusChunks + 1) continue;
        const cx = pcx + dx;
        const cz = pcz + dz;
        const key = `${cx}_${cz}`;
        need.add(key);
        if (!this.chunks.has(key)) {
          const chunk = new VoxelChunk(cx, cz);
          this.chunks.set(key, chunk);
          for (const m of chunk.meshes) this.root.add(m);
        }
      }
    }
    for (const [key, chunk] of [...this.chunks]) {
      if (!need.has(key)) {
        const [cx, cz] = key.split("_").map(Number);
        if ((cx - pcx) * (cx - pcx) + (cz - pcz) * (cz - pcz) > radiusChunks * radiusChunks + 2) {
          for (const m of chunk.meshes) this.root.remove(m);
          chunk.dispose();
          this.chunks.delete(key);
        }
      }
    }
  }

  // —————————————————————————————————————— helper spots

  /** Highest nearby walkable hill — used for the "overlook" discovery POI. */
  static findOverlook(): { x: number; z: number; h: number } {
    let best = { x: -62, z: -34, h: terrainHeight(-62, -34) };
    for (let x = -90; x <= -20; x += 6) {
      for (let z = -80; z <= -10; z += 6) {
        const h = terrainHeight(x, z);
        if (h > best.h && h < WATER_LEVEL + 30) best = { x, z, h };
      }
    }
    return best;
  }

  buildAll(): FrontierWorld {
    this.buildVillage();
    this.buildBridge();
    this.buildDock();
    this.buildVegetation();
    this.buildPickups();
    this.root.add(this.water);
    this.root.visible = true;
    // The terrain ring renders around spawn.
    this.updateChunks(-16, 24, 9);
    return {
      root: this.root,
      water: this.water,
      colliders: this.colliders,
      interactables: this.interactables,
      lampMat: M.bulb,
      update: (dt, t) => this.tick(dt, t),
    };
  }

  private tick(_dt: number, t: number): void {
    // Water shimmer (cheap shader-free bobbing)
    this.water.position.y = WATER_LEVEL + 0.42 + Math.sin(t * 0.7) * 0.05;
    // Door swing easing
    for (const d of this.doors) {
      const target = d.open ? Math.PI * 0.55 : 0;
      d.t += (target - d.t) * Math.min(1, _dt * 6);
      d.mesh.rotation.y = d.t;
    }
    void t;
  }

  // —————————————————————————————————————— village

  private buildVillage(): void {
    const groundTop = (x: number, z: number) => Math.ceil(terrainHeight(x, z));

    // dirt path strip through the village to the bridge
    const path = new THREE.Mesh(new THREE.PlaneGeometry(70, 3.4), M.path);
    path.rotation.x = -Math.PI / 2;
    path.position.set(0, 0, 24);
    path.position.y = groundTop(0, 24) + 0.012;
    path.receiveShadow = true;
    this.root.add(path);

    // — House A (locked facade) at (-25, 16) 10×7 —
    this.addHouseShell({
      cx: -21,
      cz: 15.4,
      w: 9,
      d: 6.6,
      wallMat: M.wall,
      roofColor: M.roof,
      door: "none",
      twoStory: false,
    });

    // — House B (enterable home) at (-21, 33) —
    this.addHouseShell({
      cx: -21,
      cz: 33,
      w: 10,
      d: 7,
      wallMat: M.wall2,
      roofColor: M.roof2,
      door: { side: "south", at: -21 },
      twoStory: false,
      interior: true,
    });

    // — interior furniture of House B (local, inside the house) —
    const floorY = groundTop(-21, 33);
    this.interiorFurniture(-21, 33, floorY);

    // — Well —
    const wellX = -15.5;
    const wellZ = 24.5;
    const wellBase = groundTop(wellX, wellZ);
    const well = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.2, 1.1, 14), M.stone);
    well.position.set(wellX, wellBase + 0.55, wellZ);
    well.castShadow = true;
    this.root.add(well);
    const wellRoof = box(2.4, 0.3, 2.4, M.roof, wellX, wellBase + 2.4, wellZ);
    this.root.add(wellRoof);
    for (const s of [-1, 1]) {
      this.root.add(
        box(0.16, 1.9, 0.16, M.woodDark, wellX + s * 1.0, wellBase + 0.4, wellZ),
      );
    }
    this.colliders.push({ kind: "circle", cx: wellX, cz: wellZ, r: 1.5 });

    // — street lamps along the path —
    for (const lx of [-26, -19, -11, -4]) {
      this.addLamp(lx, 21.8);
      this.addLamp(lx + 3.4, 26.2);
    }
    this.addLamp(-21, 29.6);
    this.addLamp(12, 22.6);

    // — benches on the village square —
    for (const bz of [27.4, 21.2]) {
      this.addBench(bz === 27.4 ? -16 : -10, bz, Math.PI * 0.5);
    }

    // — crop field: fenced rows —
    const cropX0 = -27;
    const cropZ0 = 10.4;
    this.addFenceRect(cropX0, cropZ0, 9, 7);
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 6; c++) {
        const cxp = cropX0 + 1.6 + c * 1.35;
        const czp = cropZ0 + 1.5 + r * 1.7;
        const fy = groundTop(cxp, czp);
        const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.8, 5), M.crop);
        stalk.position.set(cxp, fy + 0.4, czp);
        stalk.castShadow = true;
        this.root.add(stalk);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), M.flowerHead2);
        head.position.set(cxp, fy + 0.86, czp);
        head.castShadow = true;
        this.root.add(head);
      }
    }
  }

  private addHouseShell(opt: {
    cx: number;
    cz: number;
    w: number;
    d: number;
    wallMat: THREE.Material;
    roofColor: THREE.Material;
    door: { side: "south" | "east"; at: number } | "none";
    twoStory?: boolean;
    interior?: boolean;
    lamps?: boolean;
  }): void {
    const { cx, cz, w, d } = opt;
    const baseY = Math.ceil(terrainHeight(cx, cz));
    const wallH = 3.1;
    const wallT = 0.6;
    const doorW = 1.7;
    const doorH = 2.5;

    // Walls (4) with an optional door gap (south wall).
    const hw = w / 2;
    const hd = d / 2;
    // North
    this.root.add(box(w, wallH, wallT, opt.wallMat, cx, baseY, cz - hd + wallT / 2));
    this.colliders.push({
      kind: "box",
      minx: cx - hw - wallT / 2,
      maxx: cx + hw + wallT / 2,
      minz: cz - hd - wallT / 2,
      maxz: cz - hd + wallT / 2 + 0.02,
    });
    // East/West
    for (const s of [-1, 1]) {
      this.root.add(box(wallT, wallH, d - 0.2, opt.wallMat, cx + s * (hw - wallT / 2), baseY, cz));
      this.colliders.push({
        kind: "box",
        minx: cx + s * (hw - wallT) - wallT / 2,
        maxx: cx + s * (hw - wallT) + wallT / 2 + s * 0.5 * wallT,
        minz: cz - hd,
        maxz: cz + hd,
      });
    }
    // South, possibly with a door gap.
    if (opt.door === "none") {
      this.root.add(box(w, wallH, wallT, opt.wallMat, cx, baseY, cz + hd - wallT / 2));
      this.colliders.push({
        kind: "box",
        minx: cx - hw,
        maxx: cx + hw,
        minz: cz + hd - wallT,
        maxz: cz + hd,
      });
    } else {
      const doorX = opt.door.at;
      const gap = doorW / 2 + 0.12;
      this.root.add(box(hw - gap - wallT / 2, wallH, wallT, opt.wallMat, cx - (hw + gap) / 2 + 0.06, baseY, cz + hd - wallT / 2));
      this.root.add(box(hw - gap - wallT / 2, wallH, wallT, opt.wallMat, cx + (hw + gap) / 2 - 0.06, baseY, cz + hd - wallT / 2));
      // Gap lintel
      this.root.add(box(doorW, wallH - doorH, wallT, opt.wallMat, doorX, baseY + doorH, cz + hd - wallT / 2));
      this.colliders.push({
        kind: "box",
        minx: cx - hw,
        maxx: doorX - gap + 0.06,
        minz: cz + hd - wallT,
        maxz: cz + hd,
      });
      this.colliders.push({
        kind: "box",
        minx: doorX + gap - 0.06,
        maxx: cx + hw,
        minz: cz + hd - wallT,
        maxz: cz + hd,
      });
      // The door itself top-hung with a leather strap; opens by interaction.
      const doorPivot = new THREE.Group();
      doorPivot.position.set(doorX - doorW / 2, baseY, cz + hd - wallT / 2);
      const panel = box(doorW - 0.06, doorH - 0.08, 0.14, M.woodDark, doorW / 2, 0, 0);
      panel.position.set(doorW / 2 + 0.03, doorH / 2 + 0.04, 0);
      const handle = new THREE.Mesh(
        new THREE.SphereGeometry(0.06, 8, 8),
        M.lamp,
      );
      handle.position.set(doorW - 0.2, doorH / 2, 0.1);
      panel.add(handle);
      doorPivot.add(panel);
      this.root.add(doorPivot);
      const doorState = { mesh: doorPivot, open: false, t: 0 };
      this.doors.push(doorState);
      // Colliders: the closed door blocks the gap; open removes blocking.
      const doorCollider: Collider = {
        kind: "box",
        minx: doorX - doorW / 2,
        maxx: doorX + doorW / 2,
        minz: cz + hd - wallT / 2 - 0.1,
        maxz: cz + hd - wallT / 2 + 0.28,
      };
      this.colliders.push(doorCollider);
      const doorDef: InteractableDef = {
        id: `door-${cx}`,
        x: doorX,
        y: 0,
        z: cz + hd + 0.7,
        radius: 2.0,
        prompt: "E — Open the door",
        priority: 1,
        action: () => {
          doorState.open = !doorState.open;
          doorDef.prompt = doorState.open ? "E — Close the door" : "E — Open the door";
          // When open, disable the built-in blocking box by collapsing it.
          const c = doorCollider as Extract<Collider, { kind: "box" }>;
          if (doorState.open) {
            c.minx = doorX + 0.05;
            c.maxx = doorX + 0.06;
            c.minz = cz + hd + 0.6;
            c.maxz = cz + hd + 0.62;
          } else {
            c.minx = doorX - doorW / 2;
            c.maxx = doorX + doorW / 2;
            c.minz = cz + hd - wallT / 2 - 0.1;
            c.maxz = cz + hd - wallT / 2 + 0.28;
          }
        },
      };
      this.interactables.push(doorDef);
      // Window emissive (front facade)
      const win = box(1.0, 0.9, 0.08, M.bulb, doorX + 2.4, baseY + 1.4, cz + hd - 0.2);
      win.material = M.bulb;
      this.root.add(win);

      if (opt.interior) {
        // cozy window on north too
        this.root.add(box(1.2, 1.0, 0.08, M.bulb, cx + 1.6, baseY + 1.6, cz - hd + 0.2));
      }
    }

    // Roof (prism via two slabs) — always above the doorway.
    const roofLift = wallH;
    for (const s of [-1, 1]) {
      const slab = new THREE.Mesh(new THREE.BoxGeometry(w + 0.8, 0.24, d * 0.75), opt.roofColor);
      slab.position.set(cx, baseY + roofLift + s * 0.9 + 0.45, cz);
      slab.rotation.x = s * Math.PI * 0.102;
      slab.castShadow = true;
      this.root.add(slab);
    }
    // Roof gable ends (triangle-ish, cheap)
    for (const s of [-1, 1]) {
      const gable = box(w + 0.8, 1.1, 0.2, opt.wallMat, cx, baseY + roofLift, cz + s * hd);
      gable.scale.set(1, 1, 1);
      void gable;
      this.root.add(gable);
    }

    if (opt.interior) {
      // Interior gets its own ceiling light (always-warm interior feel).
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), M.bulb);
      lamp.position.set(cx, baseY + 2.7, cz);
      this.root.add(lamp);
      const pl = new THREE.PointLight(0xffd9a8, 0, 9);
      pl.position.set(cx, baseY + 2.5, cz);
      pl.intensity = 30;
      this.lampLights.push(pl);
      this.root.add(pl);
    }
  }

  private interiorFurniture(cx: number, cz: number, base: number): void {
    // table + 2 chairs + bed; sits inside House B.
    this.root.add(box(2.0, 0.08, 1.3, M.plank, cx - 2.6, base + 1.02, cz - 1));
    for (const s of [-1, 1]) {
      this.root.add(box(0.09, 1.0, 0.09, M.woodDark, cx - 2.6 + s * 0.85, base, cz - 1));
    }
    // chairs (two, facing table, both interactable)
    for (const s of [-1, 1]) {
      const chairX = cx - 2.6;
      const chairZ = cz - 1 + s * 1.35;
      const seat = box(0.75, 0.09, 0.75, M.plank, chairX, base + 0.55, chairZ);
      seat.rotation.y = Math.PI / 2;
      this.root.add(seat);
      const back = box(0.75, 0.75, 0.09, M.plank, chairX, base + 0.62, chairZ + s * 0.36);
      this.root.add(back);
      for (const leg of [-0.29, 0.29]) {
        this.root.add(
          box(0.08, 0.55, 0.08, M.woodDark, chairX + leg, base, chairZ),
        );
      }
      this.colliders.push({
        kind: "box",
        minx: chairX - 0.42,
        maxx: chairX + 0.42,
        minz: chairZ - 0.4,
        maxz: chairZ + 0.4,
      });
      this.interactables.push({
        id: `chair-${chairZ}`,
        x: chairX,
        y: 0,
        z: chairZ,
        radius: 1.5,
        prompt: "E — Sit down",
        priority: 3,
        action: () => this.opts.actions.sitAt(chairX, base + 0.62, chairZ, s > 0 ? Math.PI / 2 : -Math.PI / 2),
      });
    }
    // bed against east wall
    const bedZ = cz + 2.2;
    this.root.add(box(1.2, 0.5, 2.2, M.wall2, cx + 3.0, base, bedZ));
    this.root.add(box(1.15, 0.18, 1.6, M.flowerHead, cx + 3.0, base + 0.5, bedZ - 0.24));
    this.colliders.push({
      kind: "box",
      minx: cx + 2.3,
      maxx: cx + 3.7,
      minz: bedZ - 1.35,
      maxz: bedZ + 1.35,
    });
    this.interactables.push({
      id: "bed",
      x: cx + 3.0,
      y: 0,
      z: bedZ,
      radius: 1.6,
      prompt: "E — Rest on the bed (you won't sleep in Phase 1 — it's just a nap)",
      priority: 2,
      action: () => this.opts.actions.sitAt(cx + 2.6, base + 0.55, bedZ, Math.PI),
    });
  }

  private addLamp(x: number, z: number): void {
    const baseY = Math.ceil(terrainHeight(x, z));
    this.root.add(box(0.16, 4.2, 0.16, M.lamp, x, baseY, z));
    this.root.add(box(0.6, 0.09, 0.09, M.lamp, x + 0.24, baseY + 4.1, z));
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), M.bulb);
    bulb.position.set(x + 0.5, baseY + 4.0, z);
    bulb.castShadow = false;
    this.root.add(bulb);
    this.colliders.push({ kind: "circle", cx: x, cz: z, r: 0.25 });
    const pl = new THREE.PointLight(0xffd9a8, 0, 10);
    pl.position.set(x + 0.5, baseY + 3.9, z);
    this.lampLights.push(pl);
    this.root.add(pl);
  }

  private addBench(x: number, z: number, yaw: number): void {
    const baseY = Math.ceil(terrainHeight(x, z));
    const g = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.09, 0.6), M.plank);
    seat.position.y = 0.48;
    const back = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.55, 0.08), M.plank);
    back.position.set(0, 0.78, -0.3);
    g.add(seat, back);
    for (const s of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.48, 0.5), M.woodDark);
      leg.position.set(s * 0.85, 0.24, 0);
      g.add(leg);
    }
    g.position.set(x, baseY, z);
    g.rotation.y = yaw;
    g.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    this.root.add(g);
    this.colliders.push({
      kind: "box",
      minx: x - 1.05,
      maxx: x + 1.05,
      minz: z - 0.42,
      maxz: z + 0.42,
    });
    this.interactables.push({
      id: `bench-v-${x}`,
      x,
      y: 0,
      z,
      radius: 1.6,
      priority: 3,
      prompt: "E — Sit on the bench",
      action: () => this.opts.actions.sitAt(x, 0.42, z, yaw),
    });
  }

  private addFenceRect(x0: number, z0: number, w: number, d: number): void {
    const baseY = Math.ceil(terrainHeight(x0 + w / 2, z0 + d / 2));
    const posts: [number, number][] = [];
    for (let i = 0; i <= w; i += 2.2) posts.push([x0 + i, z0]);
    for (let i = 0; i <= w; i += 2.2) posts.push([x0 + i, z0 + d]);
    for (let i = 2.2; i < d; i += 2.2) {
      posts.push([x0, z0 + i]);
      posts.push([x0 + w, z0 + i]);
    }
    for (const [px, pz] of posts) {
      const py = Math.ceil(terrainHeight(px, pz));
      this.root.add(box(0.14, 1.15, 0.14, M.wood, px, py, pz));
    }
    // rails (thin strips along each side)
    const railStrip = (px: number, pz: number, sx: number, sz: number) => {
      this.root.add(box(sx, 0.09, sz, M.wood, px, baseY + 0.9, pz));
      this.root.add(box(sx, 0.09, sz, M.wood, px, baseY + 0.5, pz));
    };
    railStrip(x0 + w / 2, z0, w, 0.07);
    railStrip(x0 + w / 2, z0 + d, w, 0.07);
    railStrip(x0, z0 + d / 2, 0.07, d);
    railStrip(x0 + w, z0 + d / 2, 0.07, d);
    this.colliders.push(
      { kind: "box", minx: x0 - 0.15, maxx: x0 + w + 0.15, minz: z0 - 0.15, maxz: z0 + 0.15 },
      { kind: "box", minx: x0 - 0.15, maxx: x0 + w + 0.15, minz: z0 + d - 0.15, maxz: z0 + d + 0.15 },
      { kind: "box", minx: x0 - 0.15, maxx: x0 + 0.15, minz: z0, maxz: z0 + d },
      { kind: "box", minx: x0 + w - 0.15, maxx: x0 + w + 0.15, minz: z0, maxz: z0 + d },
    );
  }

  // —————————————————————————————————————— bridge + dock

  private buildBridge(): void {
    // Deck planks across the river (terrain already raises the deck height).
    const z = 24;
    const deckY = Math.ceil(terrainHeight(0, z));
    for (let x = -3; x <= 30; x += 1.0) {
      const plank = box(1, 0.16, 3.6, M.plank, x, deckY - 0.28, z);
      plank.castShadow = true;
      plank.receiveShadow = true;
      this.root.add(plank);
    }
    // Rails on both sides
    for (const s of [-1, 1]) {
      const rz = z + s * 2.3;
      for (let x = -3; x <= 30.5; x += 6.5) {
        this.root.add(box(0.18, 1.05, 0.18, M.wood, x, deckY - 0.3, rz));
      }
      this.root.add(box(34, 0.12, 0.12, M.wood, 13.75, deckY + 0.7, rz));
      this.root.add(box(34, 0.12, 0.12, M.wood, 13.75, deckY + 0.28, rz));
      this.colliders.push({
        kind: "box",
        minx: -3,
        maxx: 30.5,
        minz: rz - 0.14,
        maxz: rz + 0.14,
      });
    }
  }

  private buildDock(): void {
    // Dock deck over lake edge toward (62, 48) water.
    const deckZ = 39.7;
    const deckY = Math.ceil(terrainHeight(54, deckZ));
    for (let x = 48; x <= 60; x += 1.0) {
      const plank = box(1, 0.14, 3, M.plank, x, deckY - 0.24, deckZ);
      this.root.add(plank);
    }
    // pilings
    for (const px of [49.5, 52.5, 55.5, 58.5]) {
      for (const s of [-1, 1]) {
        const pil = box(0.2, 3.4, 0.2, M.woodDark, px, deckY - 3.4, deckZ + s * 1.3);
        this.root.add(pil);
      }
    }
    // A little rowboat at the end (decorative, moored)
    const boat = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.35, 2.4, 10, 1, true), M.plank);
    boat.position.set(62.5, WATER_LEVEL + 0.4, deckZ);
    boat.rotation.z = Math.PI / 2;
    boat.rotation.y = 0.35;
    boat.castShadow = true;
    this.root.add(boat);
    this.interactables.push({
      id: "dock",
      x: 59,
      y: 0,
      z: deckZ,
      radius: 1.8,
      prompt: "E — Row a boat (arrives in a later phase — enjoy the view)",
      priority: 3,
      enabled: () => false,
      action: () => {},
    });
  }

  // —————————————————————————————————————— vegetation / rocks / flowers

  private buildVegetation(): void {
    const treeMatrices: THREE.Matrix4[] = [];
    const rockMatrices: THREE.Matrix4[] = [];
    const flowerA: THREE.Matrix4[] = [];
    const flowerB: THREE.Matrix4[] = [];
    const quat = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const pos = new THREE.Vector3();

    const rand = (i: number) => fbm(i * 12.9898, i * 78.233, 2, 777);
    let idx = 0;
    const V = { minx: -30, maxx: 34, minz: 4, maxz: 44 };
    for (let i = 0; i < 900; i++) {
      const x = -96 + rand(idx++) * 240;
      const z = -110 + rand(idx++) * 260;
      const h = terrainHeight(x, z);
      if (h < WATER_LEVEL + 0.7) continue;
      // keep the village + path + bridge + dock clear
      if (x > V.minx && x < V.maxx && z > V.minz && z < V.maxz) continue;
      const kind = Math.floor(rand(idx++) * 100);
      if (kind < 34) {
        pos.set(x, Math.ceil(h) - 0.3, z);
        const s = 0.85 + rand(idx++) * 0.55;
        scale.setScalar(s);
        quat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand(idx++) * 6.28);
        treeMatrices.push(new THREE.Matrix4().compose(pos, quat, scale));
      } else if (kind < 46) {
        pos.set(x, Math.ceil(h) - 0.3, z);
        scale.setScalar(0.7 + rand(idx++) * 0.7);
        quat.setFromAxisAngle(new THREE.Vector3(0.2, 1, 0.1), rand(idx++));
        rockMatrices.push(new THREE.Matrix4().compose(pos, quat, scale));
      } else {
        pos.set(x, Math.ceil(h), z);
        scale.setScalar(1);
        const list = rand(idx++) > 0.5 ? flowerA : flowerB;
        if (list.length < 320) {
          const flatQ = new THREE.Quaternion().setFromEuler(
            new THREE.Euler(-Math.PI / 2, rand(idx) * 6.28, 0),
          );
          list.push(new THREE.Matrix4().compose(pos, flatQ, scale));
        }
      }
    }

    // trees — one instanced pair per type
    const trunkGeo = new THREE.CylinderGeometry(0.22, 0.3, 2.6, 7);
    trunkGeo.translate(0, 1.3, 0);
    const crownGeo = new THREE.IcosahedronGeometry(1.7, 1);
    crownGeo.scale(1, 1.25, 1);
    crownGeo.translate(0, 3.6, 0);
    const trunkIM = new THREE.InstancedMesh(trunkGeo, M.trunk, treeMatrices.length);
    const crownIM = new THREE.InstancedMesh(crownGeo, Math.random() > 0.5 ? M.leaf : M.leafAlt, treeMatrices.length);
    treeMatrices.forEach((m, i) => {
      trunkIM.setMatrixAt(i, m);
      crownIM.setMatrixAt(i, m);
    });
    trunkIM.castShadow = true;
    crownIM.castShadow = true;
    trunkIM.receiveShadow = true;
    crownIM.receiveShadow = true;
    this.root.add(trunkIM, crownIM);
    for (const m of treeMatrices) {
      const p = new THREE.Vector3().setFromMatrixPosition(m);
      this.colliders.push({ kind: "circle", cx: p.x, cz: p.z, r: 0.55 });
    }

    // rocks
    if (rockMatrices.length) {
      const rockGeo = new THREE.IcosahedronGeometry(0.8, 0);
      const rockIM = new THREE.InstancedMesh(rockGeo, M.rock, rockMatrices.length);
      rockMatrices.forEach((m, i) => rockIM.setMatrixAt(i, m));
      rockIM.castShadow = true;
      rockIM.receiveShadow = true;
      this.root.add(rockIM);
      for (const m of rockMatrices) {
        const p = new THREE.Vector3().setFromMatrixPosition(m);
        this.colliders.push({ kind: "circle", cx: p.x, cz: p.z, r: 0.75 });
      }
    }

    // flowers — tiny crosses, many instances, one draw call each color
    const flowerGeo = new THREE.PlaneGeometry(0.36, 0.36);
    for (const [arr, mat] of [
      [flowerA, M.flowerHead],
      [flowerB, M.flowerHead2],
    ] as const) {
      if (!arr.length) continue;
      const im = new THREE.InstancedMesh(flowerGeo, mat, arr.length);
      arr.forEach((m, i) => im.setMatrixAt(i, m));
      this.root.add(im);
    }
  }

  // —————————————————————————————————————— pickups

  private buildPickups(): void {
    const spots: { x: number; z: number; kind: PickKind }[] = [
      { x: -11, z: 19, kind: "seed" },
      { x: 4, z: 21, kind: "seed" },
      { x: 30, z: 31, kind: "seed" },
      { x: 47, z: 37.8, kind: "bloom" },
      { x: 59, z: 34, kind: "bloom" },
      { x: -33, z: 35, kind: "bloom" },
      { x: -48, z: 12, kind: "stoneShard" },
      { x: 18, z: 44, kind: "stoneShard" },
      { x: -24, z: 48, kind: "stoneShard" },
    ];
    for (const [i, s] of spots.entries()) {
      const id = `pickup-${i}`;
      const y = Math.ceil(terrainHeight(s.x, s.z)) + 0.55;
      const mat = s.kind === "seed" ? M.pickupSeed : s.kind === "bloom" ? M.pickupBloom : M.pickupStone;
      const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.24, 0), mat);
      m.position.set(s.x, y, s.z);
      m.castShadow = true;
      this.root.add(m);
      if (this.opts.isPicked(id)) continue;
      this.interactables.push({
        id,
        x: s.x,
        y: 0,
        z: s.z,
        radius: 1.7,
        priority: 1,
        prompt:
          s.kind === "seed"
            ? "E — Pick up Golden Seed"
            : s.kind === "bloom"
              ? "E — Pick up Valley Bloom"
              : "E — Pick up Stone Shard",
        action: () => {
          m.visible = false;
          this.opts.onPickup(s.kind);
        },
      });
    }
  }
}
