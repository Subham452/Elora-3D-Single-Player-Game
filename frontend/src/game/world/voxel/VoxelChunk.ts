import * as THREE from "three";
import {
  BlockKind,
  surfaceKind,
  terrainHeight,
  WATER_LEVEL,
} from "@/game/world/voxel/terrainNoise";

/**
 * Chunked voxel terrain.
 * - Chunks of 16×16 columns; block = 1 world unit.
 * - Only the TOP block of each column is instanced + sub-block side pieces
 *   where neighboring height differs (approximate Minecraft silhouette with
 *   a tiny mesh budget).
 * - One InstancedMesh per (chunk, blockKind).
 * - Chunk manager disposes GPU resources when chunks leave the view ring.
 * - pure data functions from terrainNoise guarantee physics/render agreement.
 */

export const BLOCK = 1;
export const CHUNK = 16;

const KINDS: BlockKind[] = ["grass", "dirt", "stone", "sand"];

const matGrass = new THREE.MeshStandardMaterial({ color: 0x5a9c46, roughness: 0.95 });
const matDirt = new THREE.MeshStandardMaterial({ color: 0x7a5b3a, roughness: 1 });
const matStone = new THREE.MeshStandardMaterial({ color: 0x8d9299, roughness: 1 });
const matSand = new THREE.MeshStandardMaterial({ color: 0xdccf9e, roughness: 1 });

const boxGeo = new THREE.BoxGeometry(BLOCK, BLOCK, BLOCK);

export class VoxelChunk {
  readonly meshes: THREE.InstancedMesh[] = [];
  readonly cx: number;
  readonly cz: number;

  constructor(cx: number, cz: number) {
    this.cx = cx;
    this.cz = cz;
    const originX = cx * CHUNK;
    const originZ = cz * CHUNK;

    const lists: Record<BlockKind, { top: THREE.Matrix4[]; side: THREE.Matrix4[] }> = {
      grass: { top: [], side: [] },
      dirt: { top: [], side: [] },
      stone: { top: [], side: [] },
      sand: { top: [], side: [] },
    };

    for (let lx = 0; lx < CHUNK; lx++) {
      for (let lz = 0; lz < CHUNK; lz++) {
        const wx = originX + lx;
        const wz = originZ + lz;
        const h = terrainHeight(wx, wz);
        const kind = surfaceKind(wx, wz, h);
        const topY = Math.ceil(h);
        // Top block (the visible floor).
        lists[kind].top.push(
          new THREE.Matrix4().setPosition(wx + 0.5, topY - 0.5, wz + 0.5),
        );
        // Side pieces: exposed block faces toward downhill neighbors.
        const nE = terrainHeight(wx + 1, wz);
        const nW = terrainHeight(wx - 1, wz);
        const nN = terrainHeight(wx, wz - 1);
        const nS = terrainHeight(wx, wz + 1);
        for (const [nh] of [
          [nE],
          [nW],
          [nN],
          [nS],
        ] as const) {
          const drop = topY - Math.ceil(nh);
          for (let d = 0; d < Math.min(drop, 3); d++) {
            // Fill blocks straight down the exposed column — the cliff face.
            lists[kind].side.push(
              new THREE.Matrix4().setPosition(wx + 0.5, topY - 0.5 - d, wz + 0.5),
            );
          }
        }
      }
    }

    const kindMat: Record<BlockKind, THREE.Material> = {
      grass: matGrass,
      dirt: matDirt,
      stone: matStone,
      sand: matSand,
    };
    for (const k of KINDS) {
      for (const group of ["top", "side"] as const) {
        const arr = lists[k][group];
        if (arr.length === 0) continue;
        const im = new THREE.InstancedMesh(boxGeo, kindMat[k], arr.length);
        arr.forEach((m, i) => im.setMatrixAt(i, m));
        im.castShadow = true;
        im.receiveShadow = true;
        im.instanceMatrix.needsUpdate = true;
        this.meshes.push(im);
      }
    }
  }

  dispose(): void {
    for (const m of this.meshes) {
      m.dispose(); // InstancedMesh dispose frees instanceMatrix; geometry shared
    }
    this.meshes.length = 0;
  }
}

/** Chunk-level water mesh per chunk (transparent plane at WATER_LEVEL). */
export function chunkWater(cx: number, cz: number): THREE.Mesh | null {
  const waterMat = sharedWater();
  const originX = cx * CHUNK;
  const originZ = cz * CHUNK;
  // Does this chunk dip below water level?
  let hasWater = false;
  for (let i = 0; i < CHUNK; i += 3) {
    for (let j = 0; j < CHUNK; j += 3) {
      if (terrainHeight(originX + i, originZ + j) < WATER_LEVEL) {
        hasWater = true;
        break;
      }
    }
  }
  if (!hasWater) return null;
  const w = new THREE.Mesh(new THREE.PlaneGeometry(CHUNK, CHUNK), waterMat);
  w.rotation.x = -Math.PI / 2;
  w.position.set(originX + CHUNK / 2, WATER_LEVEL + 0.42, originZ + CHUNK / 2);
  w.receiveShadow = false;
  return w;
}

let waterShared: THREE.MeshStandardMaterial | null = null;
function sharedWater(): THREE.MeshStandardMaterial {
  if (!waterShared) {
    waterShared = new THREE.MeshStandardMaterial({
      color: 0x2e6f9e,
      transparent: true,
      opacity: 0.78,
      roughness: 0.08,
      metalness: 0.12,
    });
  }
  return waterShared;
}
