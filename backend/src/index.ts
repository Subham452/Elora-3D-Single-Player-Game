import "dotenv/config";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import mongoose from "mongoose";
import { env } from "./config/env";
import { errorHandler, notFoundHandler } from "./middleware/error";
import { apiLimiter } from "./middleware/rateLimit";
import { authRouter } from "./routes/auth";
import { profileRouter } from "./routes/profile";

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
  process.exit(1);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
  process.exit(1);
});

async function main(): Promise<void> {
  await mongoose.connect(env.MONGODB_URI);

  const app = express();
  app.disable("x-powered-by");

  app.use(helmet({ crossOriginResourcePolicy: false }));
  app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }));
  app.use(morgan(env.NODE_ENV === "production" ? "tiny" : "dev"));
  app.use(express.json({ limit: "100kb" }));
  app.use(cookieParser());

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, uptime: process.uptime() });
  });

  app.use("/api", apiLimiter);
  app.use("/api/auth", authRouter);
  app.use("/api", profileRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  const server = app.listen(env.PORT, () => {
    console.log(`[elora] api listening on :${env.PORT} (${env.NODE_ENV})`);
  });

  const shutdown = (signal: string): void => {
    void server.close(async () => {
      await mongoose.disconnect();
      console.log(`[elora] shutdown complete (${signal})`);
      process.exit(0);
    });
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err) => {
  console.error("Fatal bootstrap error:", err instanceof Error ? err.message : err);
  process.exit(1);
});
