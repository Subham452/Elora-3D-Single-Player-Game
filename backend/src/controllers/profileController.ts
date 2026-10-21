import type { Request, Response } from "express";
import { User, type UserCheckpoint, type UserDocument } from "../models/User";
import { toPublicCheckpoint, toPublicDiscoveries, toPublicUser } from "../utils/serialize";
import { appearanceSchema, checkpointSchema, discoverySchema } from "../validators";

export function getMe(req: Request, res: Response): void {
  res.status(200).json(toPublicUser(req.user as UserDocument));
}

export function getCheckpoint(req: Request, res: Response): void {
  const user = req.user as UserDocument;
  const checkpoint = user.profile.checkpoint;
  res.status(200).json({ checkpoint: checkpoint ? toPublicCheckpoint(checkpoint) : null });
}

export async function setCheckpoint(req: Request, res: Response): Promise<void> {
  const user = req.user as UserDocument;
  user.profile.checkpoint = checkpointSchema.parse(req.body);
  user.lastPlayedAt = new Date();
  await user.save();
  const saved = user.profile.checkpoint as UserCheckpoint;
  res.status(200).json({ checkpoint: toPublicCheckpoint(saved) });
}

export async function updateAppearance(req: Request, res: Response): Promise<void> {
  const user = req.user as UserDocument;
  const data = appearanceSchema.parse(req.body);
  Object.assign(user.profile.appearance, data);
  await user.save();
  res.status(200).json(toPublicUser(user));
}

export async function addDiscovery(req: Request, res: Response): Promise<void> {
  const user = req.user as UserDocument;
  const { poiId } = discoverySchema.parse(req.body);

  // Idempotent upsert: only pushes if the poiId is not already present.
  const result = await User.updateOne(
    { _id: user._id, "profile.discoveries.poiId": { $ne: poiId } },
    {
      $push: { "profile.discoveries": { poiId, discoveredAt: new Date() } },
      $set: { lastPlayedAt: new Date() },
    },
  );

  const fresh = (await User.findById(user._id)) as UserDocument;
  res.status(result.modifiedCount > 0 ? 201 : 200).json({
    discoveries: toPublicDiscoveries(fresh),
  });
}

export function getDiscoveries(req: Request, res: Response): void {
  res.status(200).json({ discoveries: toPublicDiscoveries(req.user as UserDocument) });
}
