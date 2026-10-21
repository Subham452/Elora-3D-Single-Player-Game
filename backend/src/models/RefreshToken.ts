import { Schema, model, type Types } from "mongoose";

export interface IRefreshToken {
  userId: Types.ObjectId;
  familyId: string;
  /** JWT `jti` of the refresh token this doc describes. */
  jti: string;
  /** bcrypt hash of the refresh JWT — the raw token is never stored. */
  tokenHash: string;
  expiresAt: Date;
  revokedAt?: Date | null;
  /** jti of the token that replaced this one during rotation. */
  replacedBy?: string | null;
  createdAt: Date;
}

const refreshTokenSchema = new Schema<IRefreshToken>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    familyId: { type: String, required: true, index: true },
    jti: { type: String, required: true, unique: true },
    tokenHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    replacedBy: { type: String, default: null },
  },
  { timestamps: true },
);

// TTL: purge expired docs automatically.
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshToken = model<IRefreshToken>("RefreshToken", refreshTokenSchema);
