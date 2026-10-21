import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import type { Types } from "mongoose";
import { env } from "../config/env";
import { ROUNDS } from "../utils/password";
import type { Role } from "../models/User";

export interface AccessTokenPayload {
  sub: string;
  role: Role;
}

export interface RefreshTokenPayload {
  sub: string;
  familyId: string;
  jti: string;
}

export interface SignedRefreshToken {
  token: string;
  jti: string;
  expiresAt: Date;
}

export function signAccessToken(user: { _id: Types.ObjectId; role: Role }): string {
  const options: SignOptions = {
    expiresIn: env.ACCESS_TOKEN_TTL as SignOptions["expiresIn"],
    algorithm: "HS256",
  };
  return jwt.sign({ sub: user._id.toString(), role: user.role }, env.JWT_ACCESS_SECRET, options);
}

export function signRefreshToken(userId: string, familyId: string): SignedRefreshToken {
  const jti = crypto.randomUUID();
  const ttlMs = env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;
  const token = jwt.sign({ sub: userId, familyId, jti }, env.JWT_REFRESH_SECRET, {
    expiresIn: `${env.REFRESH_TOKEN_TTL_DAYS}d` as SignOptions["expiresIn"],
    algorithm: "HS256",
  });
  return { token, jti, expiresAt: new Date(Date.now() + ttlMs) };
}

function assertPayload(decoded: string | jwt.JwtPayload): jwt.JwtPayload & { sub: string } {
  if (typeof decoded === "string" || typeof (decoded as jwt.JwtPayload).sub !== "string") {
    throw new jwt.JsonWebTokenError("Malformed token payload");
  }
  // JwtPayload has an index signature, so the typeof check above is not enough for TS.
  return decoded as jwt.JwtPayload & { sub: string };
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const payload = assertPayload(jwt.verify(token, env.JWT_ACCESS_SECRET));
  return { sub: payload.sub, role: payload.role as Role };
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const payload = assertPayload(jwt.verify(token, env.JWT_REFRESH_SECRET));
  if (typeof payload.familyId !== "string" || typeof payload.jti !== "string") {
    throw new jwt.JsonWebTokenError("Malformed refresh payload");
  }
  return { sub: payload.sub, familyId: payload.familyId, jti: payload.jti };
}

/** Refresh tokens are stored bcrypt-hashed (same cost as passwords). */
export function hashToken(token: string): Promise<string> {
  return bcrypt.hash(token, ROUNDS);
}

export function verifyTokenHash(token: string, hash: string): Promise<boolean> {
  return bcrypt.compare(token, hash);
}
