# ELORA — Asset Pipeline

## Rules

- Every asset has a **stable ID** used in code/DB (`asset.<name>`), a source,
  a license note, and an owner in the docs table below.
- No runtime hotlinks to third-party CDNs that may change. Assets are vendored
  into `frontend/public/assets/…` and referenced by stable relative URLs.
- **Placeholders are marked**: any procedural stand-in is documented here.

## Directory layout (frontend/public/assets)

```
assets/
  models/   GLB/GLTF
  textures/ PBR textures (color, normal, roughness)
  audio/    ogg/mp3 ambience + SFX
```

## Character placeholder (Phase 1)

- **Superseded 2026-10-19 (Phase 1.5):** the world now uses the rigged
  `assets/characters/elora-player.glb` (three.js Soldier, see
  `docs/CREDITS.md`) with an AnimationMixer. Clip contract: `idle|walk|run`
  in-file; `jump/fall/wave/dance/crouch` fall back to documented procedural
  limb motion (shown in the character info panel as "fallback: active").
- The procedural capsule avatar (`game/avatars/avatar.ts`) remains as the
  load-fallback path: if the GLB fails to parse/missing, the game boots with
  the procedural figure + a clear console + HUD warning. It never blocks play.

## Procedural placeholder policy

Trees, lamps, benches, road/building meshes in Phase 1 are **procedural
placeholders** (original geometry, marked here): allowed, visually coherent,
and designed to be swapped with authored GLBs later via the same prefab
registry (a prefab declares `source: 'procedural' | 'glb'`; swapping is a
registry change, not a world rewrite).
