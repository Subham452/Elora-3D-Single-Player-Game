import type { PoiDefinition } from "@/shared/types";
import { terrainHeight, WATER_LEVEL } from "@/game/world/voxel/terrainNoise";

/**
 * Elora Frontier Valley — the playable Phase 1.5 region.
 * World space: +X east, -Z north, real heights from terrainHeight().
 * worldXZ → mapX/mapY share ONE conversion used by HUD minimap + full map.
 */

export const WORLD_ID = "frontier";
export const MAP = {
  extent: 200,
  size: 900,
};

export function worldToMap(x: number, z: number): { mx: number; my: number } {
  return {
    mx: ((x + MAP.extent / 2) / MAP.extent) * MAP.size,
    my: ((z + MAP.extent / 2) / MAP.extent) * MAP.size,
  };
}

export function mapToWorld(mx: number, my: number): { x: number; z: number } {
  return {
    x: (mx / MAP.size) * MAP.extent - MAP.extent / 2,
    z: (my / MAP.size) * MAP.extent - MAP.extent / 2,
  };
}

function overlookPoi(): PoiDefinition {
  let best = { x: -62, z: -34, h: terrainHeight(-62, -34) };
  for (let x = -96; x <= -30; x += 5) {
    for (let z = -100; z <= -30; z += 5) {
      const h = terrainHeight(x, z);
      if (h > best.h) best = { x, z, h };
    }
  }
  return {
    id: "overlook",
    name: "Hilltop Overlook",
    x: best.x,
    z: best.z,
    description: `The high ground west of the valley — ${Math.round(best.h)}m above sea level.`,
  };
}

export const POIS: PoiDefinition[] = [
  {
    id: "village-well",
    name: "Village Well",
    x: -15.5,
    z: 24.5,
    description: "Where every villager meets — the well with its little roof.",
  },
  {
    id: "cozy-home",
    name: "The Cozy House",
    x: -21,
    z: 33,
    description: "The enterable home with a table, chairs, and a bed.",
  },
  {
    id: "old-bridge",
    name: "The Old Bridge",
    x: 13,
    z: 24,
    description: "Planked crossing over the winding river.",
  },
  {
    id: "lake-dock",
    name: "Lake Dock",
    x: 54,
    z: 39.7,
    description: "A quiet dock where the lake breeze is coolest.",
  },
  {
    id: "shores-hillock",
    name: "Waterfall Vista",
    x: -70,
    z: -80,
    description: "A viewpoint near where fall terrain begins. Look north.",
  },
  overlookPoi(),
];

/** Real-world seconds for one 24h in-world day. */
export const DEFAULT_DAY_SECONDS = 600;

export const INTERIOR_ID = "frontier-village"; // stream rooms later (Phase 5)
export const SPAWN = { x: -16, z: 24 }; // outside the well, on the square

/** Whether the terrain spot is usable as a fast-travel target (dry land). */
export function poiTravelable(p: PoiDefinition): boolean {
  return terrainHeight(p.x, p.z) > WATER_LEVEL + 0.5;
}
