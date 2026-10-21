import { z } from "zod";

/**
 * Zod-validated environment. Throws a single helpful Error listing every
 * failing variable so misconfiguration is immediately obvious on boot.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET must be at least 32 chars (use: openssl rand -hex 32)"),
  JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET must be at least 32 chars (use: openssl rand -hex 32)"),
  ACCESS_TOKEN_TTL: z.string().default("15m"),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  CLIENT_ORIGIN: z.string().min(1).default("http://localhost:5173"),
  WORLD_DAY_SECONDS: z.coerce.number().int().positive().default(600),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  const problems = parsed.error.issues
    .map((issue) => `  - ${issue.path.join(".") || "<root>"}: ${issue.message}`)
    .join("\n");
  throw new Error(`Invalid backend environment. Fix these variables (see backend/.env.example):\n${problems}`);
}

export const env = parsed.data;
export type Env = typeof env;
