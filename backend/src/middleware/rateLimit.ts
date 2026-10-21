import { rateLimit, type Options } from "express-rate-limit";

const jsonHandler: Options["handler"] = (_req, res) => {
  res.status(429).json({
    error: "Too many requests, please try again later",
    code: "RATE_LIMITED",
  });
};

/** 20 requests / 15 min / IP — auth endpoints. */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: jsonHandler,
});

/** 300 requests / 5 min / IP — general API. */
export const apiLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 300,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: jsonHandler,
});
