# ELORA — Roadmap & Live Status

Status legend: ✅ implemented & verified in this repo · 🟡 in progress / partial · 🔲 planned

> This file is updated at the end of every working session with the real,
> verified status. Verification means: code compiles, checks pass, and the
> feature was actually exercised or has a documented manual test path.

## Phase 0 — Foundations

| Item | Status |
|---|---|
| Repo structure, git, docs scaffold | ✅ |
| Architecture, game design, roadmap docs | ✅ |
| Asset pipeline + multiplayer + deployment docs | ✅ |
| Monorepo scaffolds (frontend + backend + shared), strict TS, tooling | 🔲 |
| Docker Compose for MongoDB + backend + frontend dev | 🔲 |

## Phase 1 — Playable vertical slice (target of first implementation session)

| Item | Status |
|---|---|
| Premium web shell: landing, sign-in/up/forgot flows, protected routes | 🔲 |
| Character creator (visual identity persisted) | 🔲 |
| Launcher / dashboard after sign-in | 🔲 |
| Elora Central City hand-composed district | 🔲 |
| Third-person character controller (walk/jog/sprint/jump + collision) | 🔲 |
| Third-person camera (orbit, zoom, occlusion, sensitivity) | 🔲 |
| Day/night cycle with sun/moon lighting | 🔲 |
| Interaction system + prompts (sit, door, interior exit) | 🔲 |
| Emotes (wave, dance) | 🔲 |
| World map with world↔map mapping, fast-travel to POIs | 🔲 |
| Working settings (graphics preset, shadows, audio, sensitivity) | 🔲 |
| Performance panel (FPS, frame time, draw calls, entities) | 🔲 |
| Persistence (appearance, position checkpoint, discoveries) | 🔲 |
| Backend auth (register/login/refresh/me, Zod, rate limiting, JWT) | 🔲 |

## Phase 2 — Character progression & inventory

| Item | Status |
|---|---|
| Inventory UI + server-authoritative grants | 🔲 |
| Clothing applied to character + shop hooks | 🔲 |
| Playtime/stat/achievement foundations | 🔲 |

## Phase 3 — Vehicles & activities

| Item | Status |
|---|---|
| Drivable compact car (motion, collision, enter/exit, camera) | 🔲 |
| Motorcycle | 🔲 |
| Vehicle ownership records | 🔲 |
| Two working activities (cruise, photography mode) | 🔲 |

## Phase 4 — Real multiplayer

| Item | Status |
|---|---|
| Socket.IO + JWT handshake, world instance registry | 🔲 |
| Remote players (nameplates, interpolated movement) | 🔲 |
| Local chat + emotes over network | 🔲 |
| Interest management, rate limits, message validation | 🔲 |
| Two-session manual multiplayer test passing | 🔲 |

## Phase 5 — Living world

| Item | Status |
|---|---|
| NPCs (vendors, residents) with dialogue | 🔲 |
| Animals with lightweight behavior states | 🔲 |
| Homes + furniture placement | 🔲 |
| Friends/DM/blocks/reports | 🔲 |
| Shop/economy with NPC vendors | 🔲 |

## Phase 6 — Expansion & polish

Streaming chunks, extra districts, better art, weather, events. 🔲

## Phase 7 — Production readiness

Tests, monitoring, backups, load tests, security review, deployment automation. 🔲

## Known honest limitations (updated each session)

- …
