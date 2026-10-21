import { Router } from "express";
import { authLimiter } from "../middleware/rateLimit";
import { login, logout, refresh, register } from "../controllers/authController";

export const authRouter = Router();

authRouter.post("/register", authLimiter, register);
authRouter.post("/login", authLimiter, login);
authRouter.post("/refresh", authLimiter, refresh);
authRouter.post("/logout", authLimiter, logout);
