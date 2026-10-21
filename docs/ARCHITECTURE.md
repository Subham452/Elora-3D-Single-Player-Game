# ELORA — Architecture

> Living document. Updated when architecture changes.

## Overview

ELORA is a persistent, multiplayer 3D virtual-life world.

- **Client**: React 19 + Vite + TypeScript, Three.js as the core renderer,
  React Three Fiber for declarative scene composition, plain Three.js for
  systems needing frame-level control (character controller, vehicles,
  streaming).
- **Server**: Node + Express + TypeScript, Socket.IO for realtime,
  MongoDB (Mongoose) for persistence.
- **Shared**: `shared/` package with pure TypeScript types + Zod schemas used
  by both client and server as the single source of truth for the wire protocol
  and data models.

## Repository layout

```
elora/
  frontend/           React+Vite+Three.js game client and web app
  backend/            Express + Socket.IO API and realtime server
  shared/             Types and Zod schemas shared by both (wire protocol)
  docs/               Architecture, design, roadmap, pipeline, operations
  .env.example
```

## Rendering & performance strategy

- Renderer created **once** per session (fixed-time-loop, no React rerenders
  inside the frame loop). React renders HUD overlay only; game state lives in
  Zustand stores, consumed selectively in the HUD.
- Graphics presets (low/medium/high/ultra) control: shadow map size, render
  scale, view distance (camera far + fog distance), vegetation density,
  antialias both.
- World built from **prefabs + instancing**: all repeated props (trees, lamps,
  benches, hydrants, road segments) use `InstancedMesh` with a single draw call
  per prop type.
- Fog + far-plane culling stand in for chunk streaming in Phase 1; a grid
  chunk streaming system is the documented upgrade path in `docs/ROADMAP.md`.
- Physics: kinematic character controller with capsule sweeps against a static
  collider list (registered by every prefab/prop). No heavyweight physics
  engine needed for peaceful gameplay; collision resolution is document-
  and-deterministic. Vehicles use the same kinematic sweep model with a
  vehicle-specific steering/suspension controller (Phase 3).

## Data flow

```
 Input (keyboard/pointer)          Socket.IO (server world clock)
        │                                    │
        ▼                                    ▼
  PlayerController ──► World clock ──► Sun/sky/env lighting
        │                                    │
        ▼                                    ▼
 Interaction prompts ──► HUD (Zustand) ──► React overlay (rerender-isolated)
```

## Multiplayer architecture (Phases 4+)

- Socket.IO with JWT auth on the socket handshake.
- Server-managed world instances; server is authoritative for: identity,
  currency, inventory grants, ownership, world time.
- Client movement is *optimized local prediction*; server validates plausibility
  (speed, teleport, rate limits), but does not run a full physics sim — this
  is a **documented hybrid** rather than a claim of fully authoritative physics.
- Interest management: server only broadcasts entities/updates to sockets in
  the same world + within a spatial radius.
- Ephemeral player positions live in server memory (Map), written to MongoDB
  only on logout/zone-change/checkpoint. Never per-frame.

## Security model

- Access + refresh JWT, refresh token stored hashed in DB & httpOnly cookie.
- All gameplay mutations validated by Zod + ownership checks server-side.
- Role middleware (`user`, `moderator`, `admin`) enforced on REST and sockets.
- Rate limiting on auth + realtime messages; sanitized user content.
- Secrets only in environment; `.env.example` documents every variable.

## Persistence rules

- Realtime position: memory only (+ periodic/exit checkpoints).
- Currency, inventory, ownership, discoveries: server-validated transactions.
- World clock & world config: separate `WorldConfiguration` documents, admin
  editable, not per-player.
