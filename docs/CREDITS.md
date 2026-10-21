# ELORA — Asset Credits & Licenses

| Asset | Path | Source | License | Notes |
|---|---|---|---|---|
| Player character `elora-player.glb` (aka Soldier.glb) | `frontend/public/assets/characters/elora-player.glb` | three.js official examples (https://github.com/mrdoob/three.js, `examples/models/gltf/Soldier.glb`; original model by Mixamo-style author distributed via three.js examples) | Three.js examples asset policy (free redistribution; see three.js LICENSE/examples) | Rigged humanoid, 49-joint skeleton. Included clips: `Idle`, `Walk`, `Run`, `TPose`. NO `Jump` clip in source — airborne poses are procedural code in `CharacterRig.ts` (documented fallback, not a fake animation). Replaceable per `docs/ASSET_PIPELINE.md`. |

## Replacement instructions

1. Drop a new rigged `.glb` at
   `frontend/public/assets/characters/elora-player.glb`
   (or update `PLAYER_MODEL_URL` in `frontend/src/game/characters/CharacterRig.ts`).
2. Required animation-clip contract (names case-insensitive): `idle`, `walk`,
   `run`; optional but recommended: `jump`, `fall`, `wave`, `dance`, `crouch`.
   Missing optional clips fall back to procedural limb motion — the HUD/status
   panel shows which fallbacks are active (no pretending).
3. Model must face **+Z** in its default bind pose (like the current asset).
   Anything else: set `MODEL_YAW_OFFSET` in `CharacterRig.ts`.
4. Recommended source for future upgrade: Quaternius animated-character packs
   (CC0) or Mixamo-exported clips (subject to Adobe ToS) — re-export with the
   same skeleton orientation, then update this table.
