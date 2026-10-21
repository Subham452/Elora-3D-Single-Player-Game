import type { HydratedDocument } from "mongoose";
import type { RequestHandler } from "express";
import { User, type IUser, type Role } from "../models/User";
import { verifyAccessToken } from "../services/tokenService";
import { HttpError } from "../utils/httpError";

declare module "express-serve-static-core" {
  interface Request {
    user?: HydratedDocument<IUser>;
  }
}

/** Verifies the Bearer access token and attaches the user document. */
export const requireAuth: RequestHandler = async (req, _res, next) => {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7).trim() : undefined;
  if (!token) {
    next(new HttpError(401, "Missing bearer token", "UNAUTHENTICATED"));
    return;
  }
  try {
    const payload = verifyAccessToken(token);
    const user = await User.findById(payload.sub);
    if (!user) throw new HttpError(401, "Account no longer exists", "UNAUTHENTICATED");
    req.user = user;
    next();
  } catch (err) {
    next(
      err instanceof HttpError
        ? err
        : new HttpError(401, "Invalid or expired access token", "INVALID_TOKEN"),
    );
  }
};

/** Must run after requireAuth. */
export const requireRole =
  (...roles: Role[]): RequestHandler =>
  (req, _res, next) => {
    const user = req.user;
    if (!user) {
      next(new HttpError(401, "Authentication required", "UNAUTHENTICATED"));
      return;
    }
    if (!roles.includes(user.role)) {
      next(new HttpError(403, "Insufficient role", "FORBIDDEN"));
      return;
    }
    next();
  };
