/**
 * Deterministic terrain functions for Elora Frontier Valley.
 * Pure functions so render, physics, props and the map preview all agree.
 * seed default 1337 — same world every boot (documented in GAME_DESIGN).
 */

const seedA = 1337;
const seedB = 4242;

function hash2(x: number, y: number, seed: number): number {
  let h = seed ^ (Math.imul(x, 374761393) + Math.imul(y, 668265263));
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

function valueNoise(x: number, y: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const v00 = hash2(xi, yi, seed);
  const v10 = hash2(xi + 1, yi, seed);
  const v01 = hash2(xi, yi + 1, seed);
  const v11 = hash2(xi + 1, yi + 1, seed);
  const u = smooth(xf);
  const v = smooth(yf);
  return (v00 * (1 - u) + v10 * u) * (1 - v) + (v01 * (1 - u) + v11 * u) * v;
}

export function fbm(x: number, z: number, octaves = 4, seed = seedA): number {
  let amp = 1;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise(x * freq, z * freq, seed + i * 101);
    norm += amp;
    amp *= 0.5;
    freq *= 2.03;
  }
  return sum / norm;
}

/** Water surface world height (blocks below are underwater). */
export const WATER_LEVEL = 5.5;
export const TERRAIN_AMP = 9;
export const TERRAIN_BASE = 4;

/**
 * Base value-noise terrain (before designed plateaus).
 */
function baseTerrainHeight(x: number, z: number): number {
  const broad = fbm(x * 0.012, z * 0.012, 4, seedA); // continents
  const detail = fbm(x * 0.05, z * 0.05, 3, seedB); // small bumps
  let h = TERRAIN_BASE + (broad - 0.42) * TERRAIN_AMP + (detail - 0.5) * 2.2;

  // Carved river: a winding band that forces height toward the water bed.
  const riverX = riverPath(z);
  const dRiver = Math.abs(x - riverX);
  const riverWidth = 7.5;
  if (dRiver < riverWidth + 14) {
    const t = Math.max(0, 1 - dRiver / (riverWidth + 14));
    const carve = Math.pow(t, 1.6) * 9.5;
    h -= carve;
  }

  // Lake basin at a fixed spot (south-east of spawn).
  const dLake = Math.hypot(x - 62, z - 48);
  if (dLake < 30) {
    h -= Math.pow(1 - dLake / 30, 1.5) * 11;
  }

  return h;
}

/** The river's center winding along Z. */
export function riverPath(z: number): number {
  return 8 + Math.sin(z * 0.045) * 17 + Math.sin(z * 0.013) * 6;
}

export type BlockKind = "grass" | "dirt" | "stone" | "sand";

/** — Designed flat structures authored INTO the height function so physics,
 *    terrain mesh, and map preview all agree. — */
export const VILLAGE_RECT = { minx: -28, maxx: -2, minz: 8, maxz: 40, h: 8.4 };
export const BRIDGE_DECK = { minx: -3.4, maxx: 30.4, minz: 21.4, maxz: 26.6, h: 8.4 };
export const DOCK_DECK = { minx: 48, maxx: 60, minz: 38, maxz: 41.4, h: 7.2 };

function inRect(
  x: number,
  z: number,
  r: { minx: number; maxx: number; minz: number; maxz: number; h: number },
  blur: number,
): number {
  const dx = Math.max(0, Math.max(r.minx - x, x - r.maxx));
  const dz = Math.max(0, Math.max(r.minz - z, z - r.maxz));
  const d = Math.hypot(dx, dz);
  return d <= blur ? 1 - smooth(Math.min(1, d / blur)) : 0;
}

/**
 * Terrain height at any world XZ. Smooth value-noise hills, a carved winding
 * river, a lake basin, plus designed flat plateaus (village, bridge, dock).
 */
export function terrainHeight(x: number, z: number): number {
  let h = baseTerrainHeight(x, z);

  // Designed plateaus (village / bridge / dock) authored into the height fn:
  const v = inRect(x, z, VILLAGE_RECT, 7);
  if (v > 0) h = h * (1 - v) + VILLAGE_RECT.h * v;
  const b = inRect(x, z, BRIDGE_DECK, 1.5);
  if (b > 0) h = h * (1 - b) + BRIDGE_DECK.h * b;
  const d2 = inRect(x, z, DOCK_DECK, 1.5);
  if (d2 > 0) h = h * (1 - d2) + DOCK_DECK.h * d2;

  return h;
}

/** Which block covers the surface at (x,z). */
export function surfaceKind(x: number, z: number, h: number): BlockKind {
  if (h < WATER_LEVEL - 0.9) return "sand"; // shores & waterbeds
  if (h < WATER_LEVEL + 0.4) return "sand";
  if (h > TERRAIN_BASE + TERRAIN_AMP * 0.62) return "stone"; // highlands
  const n = fbm(x * 0.07 + 31, z * 0.07 + 17, 2, 99);
  if (h > TERRAIN_BASE + TERRAIN_AMP * 0.40 && n > 0.62) return "stone";
  return "grass";
}
