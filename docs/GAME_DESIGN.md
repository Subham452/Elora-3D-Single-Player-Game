# ELORA — Game Design (Living Document)

## Elevator pitch

ELORA is a peaceful, persistent, multiplayer 3D virtual-life world. Players
create an identity, explore a living world, drive, socialize, shop, decorate,
and live a quiet digital life. It is **not** a combat game.

## Art direction

- Palette: deep greens, natural blue skies, warm late-afternoon sun, cool
  blue nights with warm emissive windows.
- Materials: PBR, matching color work across props so the world reads as one
  town rather than scattered models.
- Nyquist Test: every prop placed with intent (nothing random-scattered);
  roads connect; buildings face roads; lamps align to curbs.

## Core fantasy loops

1. **Be someone** — identity, style, clothing, avatar.
2. **Explore a living place** — districts, day/night, weather (later).
3. **Move freely** — walk, run, jump, sit, drive, emote.
4. **Meet people** — nearby players, chat, friendships.
5. **Build a life** — shop for items, own cars, own homes, discover places.

## The first vertical slice (Phase 1 acceptance)

The player can, in one world region:

- Create an account, log in, and persist their identity.
- Create a character (body type, skin tone, hair color, top/bottom color).
- Enter **Elora Central City** district (a real, hand-composed town square —
  roads, sidewalks, buildings, plaza, park, fonts/props composed with intent).
- Walk, jog, sprint, and jump with collision.
- Watch a full 24h day/night cycle.
- Interact with at least: a bench (sit), a door (enter/exit a small interior).
- Warp to a marked location via a working world map.
- Send two working emotes (wave, dance).
- Open settings that actually change graphics/audio.
- Open a working world map.
- Performance panel with real FPS/frame-time/draw-call entity-count stats.
- Persist: appearance, position checkpoint, discoveries (visited POIs).

## Zones (phase-1 ships #1 only, others documented)

1. Elora Central City — implemented in Phase 1.
2. Green Valley — Planned (Phase 5).
3. Elora Coast — Planned.
4. Old Town — Planned.
5. Residential District — Planned (minimal in Phase 1 as adjacent street).
6. Adventure Region — Planned.
7. Social Hub — Planned (bit later, Phase 5).

## Content priorities

Simulated living world reads better than acreage. One polished square with
architectural variety + populated ambience + life systems (lamps, windows,
traffic cadence) beats a large empty map.

## Non-goals (Phase 1)

- Multiplayer (Phase 4), vehicles (Phase 3), housing (Phase 5),
  economy/shop (Phase 2 for inventory only — the shop goes Phase 5 with NPC
  vendors), animals (Phase 5), riding/boating transit (Phase 3+).
