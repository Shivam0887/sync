import { env } from "@/config/env.js";

import { verify, type JwtPayload } from "jsonwebtoken";
import { createProxyMiddleware, Options } from "http-proxy-middleware";

import * as Sentry from "@sentry/node";

import { services } from "@/lib/constants";

import type { NextFunction, Request, Response, RequestHandler } from "express";
import type { ServiceName, TCircuitBreaker } from "@/types";
import {
  AuthError,
  ServiceUnavailableError,
  ValidationError,
} from "@shared/dist/error-handler";
import redis from "@/config/redis-db";

const ACCESS_TOKEN_SECRET = env.ACCESS_TOKEN_SECRET;
const JWT_ISSUER = env.JWT_ISSUER;

const publicEndpoints = [
  /\/api\/auth\/signup/,
  /\/api\/auth\/signin/,
  /\/api\/auth\/refresh-token/,
  /\/api\/user\/username\/.*\/check/,
  /^\api\/socket/,
];

export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Skip auth for public endpoints
  if (publicEndpoints.some((endpoint) => endpoint.test(req.path))) {
    next();
    return;
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      throw new ValidationError(
        "Invalid authorization schema. It must be 'Bearer'."
      );
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      throw new AuthError("Access token required");
    }

    // Check if token is blacklisted (logged out)
    if (await redis.sismember("token-blacklist", token)) {
      throw new AuthError("Token has been revoked");
    }

    // Verify the token
    const decoded = verify(token, ACCESS_TOKEN_SECRET, {
      issuer: JWT_ISSUER,
      audience: "web-client",
    }) as JwtPayload;

    if (decoded.type !== "access_token") {
      throw new AuthError("Unauthorized or invalid access token");
    }

    req.headers["X-Forwarded-User"] = JSON.stringify(decoded);
    next();
  } catch (error) {
    next(error);
  }
};

export const serviceAvailability = (
  serviceName: ServiceName,
  circuitBreaker: TCircuitBreaker
) => {
  const service = services[serviceName];

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const isActive = await circuitBreaker.execute(service.healthCheck);
      if (!isActive) {
        throw new ServiceUnavailableError(
          `${serviceName} service is temporarily unavailable`
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

export const httpReverseProxy = (
  serviceName: ServiceName,
  options?: Options<Request, Response>
): RequestHandler => {
  const service = services[serviceName];

  return createProxyMiddleware<Request, Response>({
    target: service.url,
    changeOrigin: true,
    proxyTimeout: service.timeout,
    pathRewrite: (path, req) => req.originalUrl,
    on: {
      error: (err, req, res) => {
        Sentry.withScope((scope) => {
          scope.setContext("service", {
            serviceName,
            targetUrl: service.url,
            originalUrl: req.originalUrl,
          });

          Sentry.captureException(err);
        });
      },
    },
    ...options,
  });
};
