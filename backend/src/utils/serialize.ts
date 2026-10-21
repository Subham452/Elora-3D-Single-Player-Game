import type { HydratedDocument } from "mongoose";
import type { CharacterAppearance, DiscoveryEntry, PlayerCheckpoint, UserDTO } from "../types";
import type { IUser, UserCheckpoint } from "../models/User";

/** Serializes a checkpoint subdoc to the shared wire shape. */
export function toPublicCheckpoint(cp: UserCheckpoint): PlayerCheckpoint {
  return { worldId: cp.worldId, x: cp.x, y: cp.y, z: cp.z, yaw: cp.yaw };
}

/** Public user JSON with appearance; profile-safe (never exposes secrets). */
export function toPublicAppearance(a: {
  displayName: string;
  bodyType: string;
  skinTone: string;
  hairColor: string;
  topColor: string;
  bottomColor: string;
  hairStyle: number;
}): CharacterAppearance {
  return {
    displayName: a.displayName,
    bodyType: a.bodyType as CharacterAppearance["bodyType"],
    skinTone: a.skinTone,
    hairColor: a.hairColor,
    topColor: a.topColor,
    bottomColor: a.bottomColor,
    hairStyle: a.hairStyle,
  };
}

export function toPublicDiscoveries(user: HydratedDocument<IUser>): DiscoveryEntry[] {
  return user.profile.discoveries.map((d) => ({
    poiId: d.poiId,
    discoveredAt: d.discoveredAt.toISOString(),
  }));
}

/** Full public user: never returns passwordHash or refresh token hashes. */
export function toPublicUser(user: HydratedDocument<IUser>): UserDTO {
  const appearance = user.profile.appearance;
  const checkpoint = user.profile.checkpoint;
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
    profile: {
      appearance: toPublicAppearance(appearance),
      checkpoint: checkpoint ? toPublicCheckpoint(checkpoint) : null,
      discoveries: toPublicDiscoveries(user),
      coins: user.profile.coins,
    },
  };
}
