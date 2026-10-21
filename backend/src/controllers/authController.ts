import crypto from "node:crypto";
import type { Request, Response } from "express";
import { env } from "../config/env";
import { User, type UserDocument } from "../models/User";
import { RefreshToken } from "../models/RefreshToken";
import { hashPassword, verifyPassword } from "../utils/password";
import {
  hashToken,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  verifyTokenHash,
} from "../services/tokenService";
import { toPublicUser } from "../utils/serialize";
import { HttpError } from "../utils/httpError";
import { loginSchema, registerSchema } from "../validators";

export const REFRESH_COOKIE = "elora_rt";

const refreshCookieBase = {
  httpOnly: true,
  sameSite: "strict",
  secure: env.NODE_ENV === "production",
  path: "/",
} as const;

const refreshCookieOptions = {
  ...refreshCookieBase,
  maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
};

function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE, refreshCookieBase);
}

/** Creates a fresh refresh-token family, sets the cookie, responds with tokens. */
async function issueSession(user: UserDocument, res: Response, status: number): Promise<void> {
  const familyId = crypto.randomUUID();
  const refresh = signRefreshToken(user._id.toString(), familyId);
  await RefreshToken.create({
    userId: user._id,
    familyId,
    jti: refresh.jti,
    tokenHash: await hashToken(refresh.token),
    expiresAt: refresh.expiresAt,
  });
  res.cookie(REFRESH_COOKIE, refresh.token, refreshCookieOptions);
  res.status(status).json({
    user: toPublicUser(user),
    accessToken: signAccessToken(user),
    refreshToken: refresh.token,
  });
}

export async function register(req: Request, res: Response): Promise<void> {
  const data = registerSchema.parse(req.body);

  const existing = await User.findOne({
    $or: [{ email: data.email }, { displayName: data.displayName }],
  })
    .lean<{ email?: string; displayName?: string }>()
    .catch(() => null);
  if (existing) {
    // Race with a concurrent signup still lands here via the 11000 handler.
    const field = existing.email === data.email ? "email" : "displayName";
    throw new HttpError(409, `An account with this ${field} already exists`, "DUPLICATE_KEY");
  }

  const user = await User.create({
    email: data.email,
    passwordHash: await hashPassword(data.password),
    displayName: data.displayName,
    // The in-world character starts with the account's display name; the rest
    // of the appearance fields fall back to schema defaults.
    profile: { appearance: { displayName: data.displayName } },
  });

  await issueSession(user, res, 201);
}

export async function login(req: Request, res: Response): Promise<void> {
  const data = loginSchema.parse(req.body);

  const user = await User.findOne({ email: data.email }).select("+passwordHash");
  if (!user || !user.passwordHash || !(await verifyPassword(data.password, user.passwordHash))) {
    throw new HttpError(401, "Invalid email or password", "INVALID_CREDENTIALS");
  }
  // Deliberately the same 401 for unknown email vs wrong password (no user enumeration).

  await User.updateOne({ _id: user._id }, { $set: { lastPlayedAt: new Date() } });
  await issueSession(user, res, 200);
}

export async function refresh(req: Request, res: Response): Promise<void> {
  const raw = (req.cookies?.[REFRESH_COOKIE] as string | undefined) ?? req.body?.refreshToken;
  if (!raw || typeof raw !== "string") {
    clearRefreshCookie(res);
    throw new HttpError(401, "Missing refresh token", "UNAUTHENTICATED");
  }

  const unauthorized = (message: string, code: string): void => {
    clearRefreshCookie(res);
    throw new HttpError(401, message, code);
  };

  let payload;
  try {
    payload = verifyRefreshToken(raw);
  } catch {
    unauthorized("Invalid or expired refresh token", "INVALID_REFRESH_TOKEN");
    return;
  }

  const doc = await RefreshToken.findOne({ jti: payload.jti });
  if (!doc || doc.userId.toString() !== payload.sub || doc.familyId !== payload.familyId) {
    unauthorized("Refresh token not recognized", "INVALID_REFRESH_TOKEN");
    return;
  }

  if (doc.revokedAt) {
    // Token reuse detected (a rotated token was replayed): revoke the whole family.
    await RefreshToken.updateMany(
      { familyId: doc.familyId, revokedAt: null },
      { $set: { revokedAt: new Date() } },
    );
    unauthorized("Refresh token reuse detected", "TOKEN_REUSE");
    return;
  }

  if (!(await verifyTokenHash(raw, doc.tokenHash))) {
    await RefreshToken.updateMany(
      { familyId: doc.familyId, revokedAt: null },
      { $set: { revokedAt: new Date() } },
    );
    unauthorized("Refresh token not recognized", "INVALID_REFRESH_TOKEN");
    return;
  }

  const user = await User.findById(payload.sub);
  if (!user) {
    unauthorized("Account no longer exists", "UNAUTHENTICATED");
    return;
  }

  // Rotate: revoke the presented token and issue its replacement in the same family.
  const rotated = signRefreshToken(user._id.toString(), doc.familyId);
  doc.revokedAt = new Date();
  doc.replacedBy = rotated.jti;
  await doc.save();
  await RefreshToken.create({
    userId: user._id,
    familyId: doc.familyId,
    jti: rotated.jti,
    tokenHash: await hashToken(rotated.token),
    expiresAt: rotated.expiresAt,
  });

  res.cookie(REFRESH_COOKIE, rotated.token, refreshCookieOptions);
  res.status(200).json({
    user: toPublicUser(user),
    accessToken: signAccessToken(user),
    refreshToken: rotated.token,
  });
}

export async function logout(req: Request, res: Response): Promise<void> {
  const raw = (req.cookies?.[REFRESH_COOKIE] as string | undefined) ?? req.body?.refreshToken;
  const payload = raw && typeof raw === "string" ? tryVerifyRefreshToken(raw) : null;
  if (payload) {
    const doc = await RefreshToken.findOne({ jti: payload.jti });
    if (doc && !doc.revokedAt) {
      doc.revokedAt = new Date();
      await doc.save();
    }
  }
  clearRefreshCookie(res);
  res.sendStatus(204);
}

/** Best-effort decode for logout; invalid tokens simply can't be revoked. */
function tryVerifyRefreshToken(token: string) {
  try {
    return verifyRefreshToken(token);
  } catch {
    return null;
  }
}

export async function getUser(req: Request, res: Response): Promise<void> {
  res.status(200).json(toPublicUser(req.user as UserDocument));
}
