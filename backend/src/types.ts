/**
 * Mirror of the backend-relevant subset of `../../shared/types.ts`.
 *
 * Duplicated locally because the build emits to `dist/` with `rootDir: "src"`;
 * importing files outside the backend tree would break the emit layout
 * (`dist/index.js` entry point required by the `start` script).
 *
 * Keep field names IDENTICAL to the shared definitions.
 */

export type BodyType = "slim" | "average" | "athletic";

export type Role = "user" | "moderator" | "admin";

export interface CharacterAppearance {
  displayName: string;
  bodyType: BodyType;
  skinTone: string; // hex
  hairColor: string; // hex
  topColor: string; // hex
  bottomColor: string; // hex
  hairStyle: number; // 0..N (procedural styles)
}

/** Persisted arrival point + world checkpoint. */
export interface PlayerCheckpoint {
  worldId: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
}

export interface DiscoveryEntry {
  poiId: string;
  discoveredAt: string; // ISO
}

export interface UserDTO {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  createdAt: string;
  profile: PlayerProfileDTO;
}

export interface PlayerProfileDTO {
  appearance: CharacterAppearance;
  checkpoint: PlayerCheckpoint | null;
  discoveries: DiscoveryEntry[];
  coins: number;
}

export type ApiError = { error: string; code: string; details?: unknown };
