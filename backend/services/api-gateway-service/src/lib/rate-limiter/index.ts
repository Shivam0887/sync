import { RateLimitError } from "@shared/src/error-handler";
import type { NextFunction, Request, Response } from "express";

interface RateLimitDetails {
  limit: string;
  remaining: string;
  reset: string;
  retryAfter: string;
}

interface FixedWindowRecord {
  count: number;
  windowStart: number;
}

interface TokenBucketRecord {
  tokens: number;
  lastRefill: number;
}

interface LeakyBucketRecord {
  queue: number;
  lastLeak: number;
}

function setRateLimitHeaders(res: Response, details: RateLimitDetails) {
  res.set({
    "X-RateLimit-Limit": details.limit,
    "X-RateLimit-Remaining": details.remaining,
    "X-RateLimit-Reset": details.reset,
    "Retry-After": details.retryAfter,
  });
}

// --- Fixed Window Rate Limiter ---
const requestMap = new Map<string, FixedWindowRecord>();

/**
 * Fixed Window Rate Limiter
 * @param limit - Max number of requests allowed within the specified time frame.
 * @param windowMs - Number of milliseconds.
 * @param message - Response to return after limit is reached.
 * @param clientIdentifier - Identify users (defaults to IP address).
 */
export const rateLimiter = (
  limit = 10,
  windowMs = 60000,
  message = "Too many requests",
  clientIdentifier?: (req: Request) => string
) => {
  // Input validation with better defaults
  const validLimit = Math.max(1, limit);
  const validWindowMs = Math.max(1000, windowMs); // Minimum 1 second

  return (req: Request, res: Response, next: NextFunction) => {
    const identifier = clientIdentifier?.(req) ?? req.ip ?? "unknown";
    const now = Date.now();

    // Align window to clock time for more predictable behavior
    const windowStart = Math.floor(now / validWindowMs) * validWindowMs;

    const record = requestMap.get(identifier);

    // Check if we're in a new window or no record exists
    if (!record || record.windowStart !== windowStart) {
      requestMap.set(identifier, { count: 1, windowStart });

      const details = {
        limit: validLimit.toString(),
        remaining: (validLimit - 1).toString(),
        reset: (windowStart + validWindowMs).toString(),
        retryAfter: "0",
      };

      setRateLimitHeaders(res, details);

      next();
      return;
    }

    // Increment request count
    record.count++;

    const remaining = Math.max(0, validLimit - record.count);

    const details = {
      limit: validLimit.toString(),
      remaining: remaining.toString(),
      reset: (windowStart + validWindowMs).toString(),
      retryAfter:
        record.count > validLimit
          ? (windowStart + validWindowMs - now).toString()
          : "0",
    };

    setRateLimitHeaders(res, details);

    if (record.count > validLimit) {
      throw new RateLimitError(message);
    }

    next();
  };
};

// --- Sliding Window Log Rate Limiter ---
const slidingWindowLogs = new Map<string, number[]>();

/**
 * Sliding Window Log Rate Limiter
 * @param limit - Max number of requests allowed within the specified time frame.
 * @param windowMs - Number of milliseconds.
 * @param message - Response to return after limit is reached.
 * @param clientIdentifier - Identify users (defaults to IP address).
 */
export const slidingWindowLogRateLimiter = (
  limit = 10,
  windowMs = 60000,
  message = "Too many requests",
  clientIdentifier?: (req: Request) => string
) => {
  const validLimit = Math.max(1, limit);
  const validWindowMs = Math.max(1000, windowMs);

  return (req: Request, res: Response, next: NextFunction) => {
    const identifier = clientIdentifier?.(req) ?? req.ip ?? "unknown";
    const now = Date.now();
    const windowStart = now - validWindowMs;

    let timestamps = slidingWindowLogs.get(identifier) ?? [];

    // Remove timestamps outside the sliding window
    timestamps = timestamps.filter((ts) => ts > windowStart);

    const requestsCount = timestamps.length;
    const oldestValidRequest = timestamps[0] ?? now;
    const nextResetTime = oldestValidRequest + validWindowMs;

    const details = {
      limit: validLimit.toString(),
      remaining: Math.max(0, validLimit - requestsCount).toString(),
      reset: nextResetTime.toString(),
      retryAfter:
        requestsCount >= validLimit
          ? Math.max(0, nextResetTime - now).toString()
          : "0",
    };

    if (requestsCount >= validLimit) {
      setRateLimitHeaders(res, details);
      throw new RateLimitError(message, details);
    }

    // Add current request timestamp
    timestamps.push(now);
    slidingWindowLogs.set(identifier, timestamps);

    // Update remaining count after adding current request
    details.remaining = Math.max(0, validLimit - timestamps.length).toString();

    setRateLimitHeaders(res, details);
    next();
  };
};

// --- Token Bucket Rate Limiter ---
const tokenBuckets = new Map<string, TokenBucketRecord>();

/**
 * Token Bucket Rate Limiter
 * @param capacity Maximum capacity of tokens a bucket can hold
 * @param refillRate Tokens refill per second
 * @param message Rate limiting response message
 * @param clientIdentifier User unique identifier
 */
export const tokenBucketRateLimiter = (
  capacity = 10,
  refillRate = 1, // tokens per second
  message = "Too many requests",
  clientIdentifier?: (req: Request) => string
) => {
  const validCapacity = Math.max(1, capacity);
  const validRefillRate = Math.max(0.1, refillRate); // Minimum 0.1 tokens per second

  return (req: Request, res: Response, next: NextFunction) => {
    const identifier = clientIdentifier?.(req) ?? req.ip ?? "unknown";
    const now = Date.now();

    let bucket = tokenBuckets.get(identifier);
    if (!bucket) {
      bucket = { tokens: validCapacity - 1, lastRefill: now }; // -1 for current request
      tokenBuckets.set(identifier, bucket);

      const details = {
        limit: validCapacity.toString(),
        remaining: bucket.tokens.toString(),
        reset: (now + 1000 / validRefillRate).toString(),
        retryAfter: "0",
      };

      setRateLimitHeaders(res, details);
      next();
      return;
    }

    // Calculate tokens to add based on time elapsed
    const secondsElapsed = (now - bucket.lastRefill) / 1000;
    const tokensToAdd = secondsElapsed * validRefillRate;

    // Only update if we're adding at least a fraction of a token
    if (tokensToAdd >= 0.01) {
      bucket.tokens = Math.min(validCapacity, bucket.tokens + tokensToAdd);
      bucket.lastRefill = now;
    }

    const timeToRefill = 1000 / validRefillRate;
    const nextRefillTime = bucket.lastRefill + timeToRefill;

    const details = {
      limit: validCapacity.toString(),
      remaining: Math.floor(bucket.tokens).toString(),
      reset: nextRefillTime.toString(),
      retryAfter:
        bucket.tokens < 1 ? Math.max(0, nextRefillTime - now).toString() : "0",
    };

    setRateLimitHeaders(res, details);

    if (bucket.tokens < 1) {
      throw new RateLimitError(message);
    }

    bucket.tokens -= 1;
    tokenBuckets.set(identifier, bucket);

    next();
  };
};

// --- Leaky Bucket Rate Limiter ---
const leakyBuckets = new Map<string, LeakyBucketRecord>();

/**
 * Leaky Bucket Rate Limiter
 * @param capacity Maximum queue size (bucket size)
 * @param leakRate Leak rate (requests per second)
 * @param message Rate limiting response message
 * @param clientIdentifier User unique identifier
 */
export const leakyBucketRateLimiter = (
  capacity = 10,
  leakRate = 1, // requests per second
  message = "Too many requests",
  clientIdentifier?: (req: Request) => string
) => {
  const validCapacity = Math.max(1, capacity);
  const validLeakRate = Math.max(0.1, leakRate);

  return (req: Request, res: Response, next: NextFunction) => {
    const identifier = clientIdentifier?.(req) ?? req.ip ?? "unknown";
    const now = Date.now();

    let bucket = leakyBuckets.get(identifier);
    if (!bucket) {
      bucket = { queue: 1, lastLeak: now }; // Start with 1 for current request
      leakyBuckets.set(identifier, bucket);

      const details = {
        limit: validCapacity.toString(),
        remaining: (validCapacity - 1).toString(),
        reset: (now + 1000 / validLeakRate).toString(),
        retryAfter: "0",
      };

      setRateLimitHeaders(res, details);
      next();
      return;
    }

    // Calculate how many requests have leaked out
    const secondsElapsed = (now - bucket.lastLeak) / 1000;
    const leaked = secondsElapsed * validLeakRate;

    if (leaked >= 0.01) {
      // Only update if significant leakage occurred
      bucket.queue = Math.max(0, bucket.queue - leaked);
      bucket.lastLeak = now;
    }

    // Check if bucket is full
    if (bucket.queue >= validCapacity) {
      const timeToLeak =
        ((bucket.queue - validCapacity + 1) / validLeakRate) * 1000;

      const details = {
        limit: validCapacity.toString(),
        remaining: "0",
        reset: (now + timeToLeak).toString(),
        retryAfter: timeToLeak.toString(),
      };

      setRateLimitHeaders(res, details);
      throw new RateLimitError(message);
    }

    // Add current request to queue
    bucket.queue += 1;
    leakyBuckets.set(identifier, bucket);

    const timeToProcess = (bucket.queue / validLeakRate) * 1000;
    const details = {
      limit: validCapacity.toString(),
      remaining: Math.max(0, validCapacity - bucket.queue).toString(),
      reset: (bucket.lastLeak + timeToProcess).toString(),
      retryAfter: "0",
    };

    setRateLimitHeaders(res, details);
    next();
  };
};

function cleanupExpiredEntries<
  T extends { windowStart?: number; lastRefill?: number; lastLeak?: number }
>(map: Map<string, T>, now: number, windowMs: number) {
  const cutoff = now - windowMs * 2; // Keep entries for 2 window periods

  for (const [key, value] of map.entries()) {
    const timestamp =
      value.windowStart ?? value.lastRefill ?? value.lastLeak ?? 0;
    if (timestamp < cutoff) {
      map.delete(key);
    }
  }
}

// --- Enhanced Periodic Cleanup ---
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
let cleanupInterval: NodeJS.Timeout | undefined;

function periodicCleanup() {
  const now = Date.now();

  cleanupExpiredEntries(requestMap, now, CLEANUP_INTERVAL_MS);
  cleanupExpiredEntries(slidingWindowLogs as any, now, CLEANUP_INTERVAL_MS);
  cleanupExpiredEntries(tokenBuckets, now, CLEANUP_INTERVAL_MS);
  cleanupExpiredEntries(leakyBuckets, now, CLEANUP_INTERVAL_MS);
}

// Ensure we don't have multiple intervals running
if (cleanupInterval) {
  clearInterval(cleanupInterval);
}
cleanupInterval = setInterval(periodicCleanup, CLEANUP_INTERVAL_MS);
