import type { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import { ZodError } from "zod";
import { env } from "../config/env";
import { HttpError } from "../utils/httpError";

/** 404 for everything no router matched: JSON under /api, plain text elsewhere. */
export function notFoundHandler(req: Request, res: Response, _next: NextFunction): void {
  if (req.originalUrl.startsWith("/api")) {
    res.status(404).json({ error: "Route not found", code: "NOT_FOUND" });
    return;
  }
  res.status(404).type("text").send("Not Found");
}

interface MongoDuplicateError {
  code?: number;
  keyValue?: Record<string, unknown>;
}

function isDuplicateKey(err: unknown): err is MongoDuplicateError {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as MongoDuplicateError).code === 11000
  );
}

/** Centralized error handler. Never leaks internals or stacks in production. */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (res.headersSent) {
    next(err);
    return;
  }

  let status = 500;
  let code = "INTERNAL_ERROR";
  let message = "Internal server error";
  let details: unknown;
  let logIt = false;

  if (err instanceof ZodError) {
    status = 422;
    code = "VALIDATION_ERROR";
    message = "Validation failed";
    details = err.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    }));
  } else if (err instanceof HttpError) {
    status = err.status;
    code = err.code;
    message = err.message;
    details = err.details;
  } else if (err instanceof mongoose.Error.ValidationError) {
    status = 422;
    code = "VALIDATION_ERROR";
    message = "Validation failed";
    details = Object.values(err.errors).map((e) => ({ path: e.path, message: e.message }));
  } else if (isDuplicateKey(err)) {
    status = 409;
    code = "DUPLICATE_KEY";
    message = "Resource already exists";
    details = { fields: Object.keys(err.keyValue ?? {}) };
  } else if (err instanceof mongoose.Error.CastError) {
    status = 400;
    code = "BAD_REQUEST";
    message = `Invalid value for ${err.path}`;
  } else if (err instanceof SyntaxError && "body" in err) {
    status = 400;
    code = "BAD_JSON";
    message = "Request body is not valid JSON";
  } else {
    logIt = true;
    if (env.NODE_ENV !== "production") {
      message = err instanceof Error ? err.message : String(err);
    }
  }

  if (logIt) {
    console.error(`[error] ${req.method} ${req.originalUrl}`, err);
  }

  const body: { error: string; code: string; details?: unknown } = { error: message, code };
  if (details !== undefined) body.details = details;
  res.status(status).json(body);
}
