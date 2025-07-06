import type { Request, Response, NextFunction } from "express";
import { JsonWebTokenError, TokenExpiredError } from "jsonwebtoken";
import { ZodError } from "zod";

import { AppError } from "./index.js";

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (res.headersSent) {
    next(err);
    return;
  }

  let statusCode = 500;
  let message = "Internal server error";
  let details: unknown;
  let stack: string | undefined;
  let code: string | undefined;

  const isDevelopment = process.env.NODE_ENV === "development";

  if (err instanceof TokenExpiredError || err instanceof JsonWebTokenError) {
    statusCode = 401;
    message = err.message;
    stack = err.stack;
    code = "AUTH_ERROR";
  } else if (err instanceof ZodError) {
    statusCode = 400;
    message = err.message;
    stack = err.stack;
    code = "VALIDATION_ERROR";
  } else if (err instanceof AppError && err.isOperational) {
    statusCode = err.statusCode;
    message = err.message;
    details = err.details;
    stack = err.stack;
    code = err.code;
  }

  res.status(statusCode).json({
    status: "error",
    message,
    ...(code ? { code } : {}),
    ...(details && isDevelopment ? { details } : {}),
    ...(stack && isDevelopment ? { stack } : {}),
  });

  return;
}
