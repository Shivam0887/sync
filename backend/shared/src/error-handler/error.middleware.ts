import type { Request, Response, NextFunction } from "express";

import jwt from "jsonwebtoken";
import { ZodError } from "zod";

import { AppError } from "./index.js";

function isAppError(err: unknown): err is AppError {
  return (
    !!err &&
    typeof err === "object" &&
    typeof (err as any).isOperational === "boolean" &&
    typeof (err as any).code === "string" &&
    typeof (err as any).statusCode === "number"
  );
}

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

  let status = "error";
  let statusCode = 500;
  let message = "Internal server error";
  let stack: string | undefined;
  let code: string | undefined;

  const isDevelopment = process.env.NODE_ENV === "development";

  if (
    err instanceof jwt.TokenExpiredError ||
    err instanceof jwt.JsonWebTokenError
  ) {
    statusCode = 401;
    message = err.message;
    stack = err.stack;
    code = "AUTH_ERROR";
  } else if (err instanceof ZodError) {
    statusCode = 400;
    message = err.message;
    stack = err.stack;
    code = "VALIDATION_ERROR";
  } else if (isAppError(err) && err.isOperational) {
    statusCode = err.statusCode;
    message = err.message;
    stack = err.stack;
    code = err.code;
    status = err.status ?? "error";
  }

  res.status(statusCode).json({
    status,
    message,
    ...(code && { code }),
    ...(stack && isDevelopment && { stack }),
  });

  return;
}
