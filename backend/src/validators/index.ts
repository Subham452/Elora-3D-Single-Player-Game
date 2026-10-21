import { z } from "zod";

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Must be a hex color like #1b1b1b");
const finiteNumber = z.number().refine(Number.isFinite, "Must be a finite number");

export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
  displayName: z
    .string()
    .trim()
    .min(3, "Display name must be at least 3 characters")
    .max(24, "Display name must be at most 24 characters"),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(72),
});

export const appearanceSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(3, "Display name must be at least 3 characters")
    .max(24, "Display name must be at most 24 characters"),
  bodyType: z.enum(["slim", "average", "athletic"]),
  skinTone: hexColor,
  hairColor: hexColor,
  topColor: hexColor,
  bottomColor: hexColor,
  hairStyle: z.number().int().min(0).max(32),
});

export const checkpointSchema = z.object({
  worldId: z.string().trim().min(1).max(64),
  x: finiteNumber,
  y: finiteNumber,
  z: finiteNumber,
  yaw: finiteNumber,
});

export const discoverySchema = z.object({
  poiId: z.string().trim().min(1).max(64),
});
