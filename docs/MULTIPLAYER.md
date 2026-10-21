# ELORA — Multiplayer Plan (Phases 4→7)

## Honest design contract

- **Phases 1–3**: single-player. No fake multiplayer — no bots pretending
  to be real users.
- **Phase 4**: real multiplayer over Socket.IO, verified by the two-session
  manual test defined below.
- The server is **authoritative for**: identity, auth, ownership, currency,
  inventory, world time, membership. The server **validates but does not
  fully simulate physics**; clients predict locally, server checks plausibility
  (rate limits, speed caps, teleport guards). This is a documented hybrid.
  No claim of fully-authoritative physics will be made in user-facing copy.

## Wire protocol (Socket.IO)

| Event | Direction | Payload (Zod-validated) |
|---|---|---|
| `world:join` | C→S | `{ worldId }` |
| `world:joined` | S→C | `{ selfId, world, players[], clock }` |
| `world:playerJoined` | S→C | `{ player }` |
| `world:playerLeft` | S→C | `{ id }` |
| `world:state` | S→C | snapshot `{ clock, players (interest radius only) }` @ ~10 Hz |
| `player:move` | C→S | `{ seq, t, x, y, z, ry, state }` @ ~15 Hz, rate-limited |
| `player:emote` | C→S | `{ emote }` |
| `chat:message` | C→S | `{ text ≤ 500 }` |
| `chat:message` | S→C | `{ id, from, name, text }` |

## Interest management

- Server keeps sockets in `worldId` rooms plus a spatial hash grid (cell 32m).
- `player:move` broadcasts to sockets in nearby cells only.
- World clock broadcast piggybacks on the 10 Hz snapshot.

## Ephemeral state

- In-memory `Map<socketId, PlayerState>` on the server; positions are never
  written to MongoDB per-frame. Checkpoints on: logout, emote/vehicle change,
  60s interval (session-only squash), zone change.
- Redis upgrade path documented for multi-process scaling (not needed for
  Phase 4 single-instance target).

## Manual two-session acceptance test

1. Two independent browser profiles, two accounts.
2. Both join same world via Play.
3. Session A moves/jumps/emotes; Session B sees A move, jump, emote, with
   nameplate.
4. A sends chat; B receives.
5. A closes tab; B sees A removed within ~10 s.
6. A reopens and logs in; identity and appearance restored.
   Checklist to be added to `docs/QA.md` when Phase 4 starts.
