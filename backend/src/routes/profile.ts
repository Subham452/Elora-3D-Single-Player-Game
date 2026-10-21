import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import {
  addDiscovery,
  getCheckpoint,
  getDiscoveries,
  getMe,
  setCheckpoint,
  updateAppearance,
} from "../controllers/profileController";

export const profileRouter = Router();

// Everything below requires a valid access token.
profileRouter.use("/me", requireAuth);

profileRouter.get("/me", getMe);
profileRouter.patch("/me/appearance", updateAppearance);
profileRouter.get("/me/checkpoint", getCheckpoint);
profileRouter.post("/me/checkpoint", setCheckpoint);
profileRouter.post("/me/discover", addDiscovery);
profileRouter.get("/me/discoveries", getDiscoveries);
