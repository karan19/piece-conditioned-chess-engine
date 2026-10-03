import type { RequestHandler } from "express";

export type RateLimitConfig = {
  windowMs: number;
  maxRequests: number;
};

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

type RateLimiterOptions = RateLimitConfig & {
  now?: () => number;
  keyPrefix?: string;
};

const defaultWindowMs = 60_000;
const defaultMaxRequests = 20;

function readPositiveInteger(name: string, fallback: number) {
  const value = Number(process.env[name]);

  if (Number.isInteger(value) && value > 0) {
    return value;
  }

  return fallback;
}

export function getEngineRateLimitConfig(): RateLimitConfig {
  return {
    windowMs: readPositiveInteger("ENGINE_RATE_LIMIT_WINDOW_MS", defaultWindowMs),
    maxRequests: readPositiveInteger("ENGINE_RATE_LIMIT_MAX", defaultMaxRequests)
  };
}

export function createRateLimiter({
  windowMs,
  maxRequests,
  now = Date.now,
  keyPrefix = "rate-limit"
}: RateLimiterOptions): RequestHandler {
  const buckets = new Map<string, RateLimitBucket>();

  return (request, response, next) => {
    const timestamp = now();
    const key = `${keyPrefix}:${request.ip ?? request.socket.remoteAddress ?? "unknown"}`;
    const current = buckets.get(key);
    const bucket =
      current && current.resetAt > timestamp
        ? current
        : {
            count: 0,
            resetAt: timestamp + windowMs
          };

    bucket.count += 1;
    buckets.set(key, bucket);

    const remaining = Math.max(maxRequests - bucket.count, 0);
    response.setHeader("RateLimit-Limit", String(maxRequests));
    response.setHeader("RateLimit-Remaining", String(remaining));
    response.setHeader("RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count > maxRequests) {
      const retryAfterSeconds = Math.max(Math.ceil((bucket.resetAt - timestamp) / 1000), 1);
      response.setHeader("Retry-After", String(retryAfterSeconds));
      response.status(429).json({
        error: "Too many engine requests. Please wait a moment and try again."
      });
      return;
    }

    next();
  };
}
