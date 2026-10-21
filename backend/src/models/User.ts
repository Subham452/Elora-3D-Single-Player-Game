import { Schema, model, type HydratedDocument } from "mongoose";

export type Role = "user" | "moderator" | "admin";
export type BodyType = "slim" | "average" | "athletic";

export interface UserAppearance {
  displayName: string;
  bodyType: BodyType;
  skinTone: string;
  hairColor: string;
  topColor: string;
  bottomColor: string;
  hairStyle: number;
}

export interface UserCheckpoint {
  worldId: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
}

export interface UserDiscovery {
  poiId: string;
  discoveredAt: Date;
}

export interface UserProfile {
  appearance: UserAppearance;
  checkpoint: UserCheckpoint | null;
  discoveries: UserDiscovery[];
  coins: number;
}

export interface IUser {
  email: string;
  passwordHash?: string;
  displayName: string;
  role: Role;
  profile: UserProfile;
  lastPlayedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const appearanceSchema = new Schema<UserAppearance>(
  {
    displayName: { type: String, required: true },
    bodyType: { type: String, enum: ["slim", "average", "athletic"], default: "average" },
    skinTone: { type: String, default: "#f3d0b0" },
    hairColor: { type: String, default: "#1b1b1b" },
    topColor: { type: String, default: "#2e6d4f" },
    bottomColor: { type: String, default: "#2b2b2b" },
    hairStyle: { type: Number, default: 0 },
  },
  { _id: false },
);

const checkpointSchema = new Schema<UserCheckpoint>(
  {
    worldId: { type: String, required: true },
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    z: { type: Number, required: true },
    yaw: { type: Number, required: true },
  },
  { _id: false },
);

const discoverySchema = new Schema<UserDiscovery>(
  {
    poiId: { type: String, required: true },
    discoveredAt: { type: Date, required: true },
  },
  { _id: false },
);

const profileSchema = new Schema<UserProfile>(
  {
    appearance: { type: appearanceSchema, required: true, default: () => ({}) },
    checkpoint: { type: checkpointSchema, default: null },
    discoveries: { type: [discoverySchema], default: [] },
    coins: { type: Number, default: 100 },
  },
  { _id: false },
);

const userSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    displayName: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 24,
    },
    role: { type: String, enum: ["user", "moderator", "admin"], default: "user" },
    profile: { type: profileSchema, required: true, default: () => ({}) },
    lastPlayedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export const User = model<IUser>("User", userSchema);
export type UserDocument = HydratedDocument<IUser>;
