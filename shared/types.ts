/**
 * ELORA shared types — single source of truth for API + wire shapes.
 * Pure TypeScript; no runtime deps. Zod schemas live server-side.
 */

export type BodyType = "slim" | "average" | "athletic";
export type QualityPreset = "low" | "medium" | "high" | "ultra";

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
  role: "user" | "moderator" | "admin";
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

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse extends AuthTokens {
  user: UserDTO;
}

export const SKIN_TONES = ["#f3d0b0", "#e0ac69", "#c68642", "#8d5524", "#5a3a22"] as const;
export const HAIR_COLORS = ["#1b1b1b", "#4a2a13", "#8a6142", "#c98b32", "#d8d8d8", "#7a2a2a"] as const;
export const TOP_COLORS = ["#2e6d4f", "#b03a3a", "#3a6fb0", "#c9a227", "#e8e2d8", "#333"] as const;
export const BOTTOM_COLORS = ["#2b2b2b", "#3a4a63", "#6b5c40", "#7a3b3b"] as const;

/** POIs exist client-side (world data) + only IDs/flags persist. */
export interface PoiDefinition {
  id: string;
  name: string;
  /** World-space anchor point. */
  x: number;
  z: number;
  /** Short in-world description shown on the map + when discovered. */
  description: string;
}

export interface GameSettings {
  quality: QualityPreset;
  shadows: boolean;
  renderScale: number; // 0.5..1.5
  viewDistance: number; // world units
  masterVolume: number; // 0..1
  sfxVolume: number;
  musicVolume: number;
  mouseSensitivity: number; // 0.2..3
  cameraFov: number; // 45..90
  invertY: boolean;
}

export const DEFAULT_GAME_SETTINGS: GameSettings = {
  quality: "high",
  shadows: true,
  renderScale: 1,
  viewDistance: 260,
  masterVolume: 0.8,
  sfxVolume: 0.9,
  musicVolume: 0.5,
  mouseSensitivity: 1.0,
  cameraFov: 65,
  invertY: false,
};
