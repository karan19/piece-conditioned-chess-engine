import type { Request, Response } from "express";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRateLimiter, getEngineRateLimitConfig } from "./rateLimit.js";

const originalEnv = { ...process.env };

function createMockResponse() {
  const headers = new Map<string, string>();
  const response = {
    setHeader: vi.fn((name: string, value: string) => {
      headers.set(name, value);
    }),
    status: vi.fn(() => response),
    json: vi.fn(() => response)
  } as unknown as Response & {
    setHeader: ReturnType<typeof vi.fn>;
    status: ReturnType<typeof vi.fn>;
    json: ReturnType<typeof vi.fn>;
    headers: Map<string, string>;
  };

  response.headers = headers;
  return response;
}

describe("getEngineRateLimitConfig", () => {
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("uses conservative defaults", () => {
    delete process.env.ENGINE_RATE_LIMIT_WINDOW_MS;
    delete process.env.ENGINE_RATE_LIMIT_MAX;

    expect(getEngineRateLimitConfig()).toEqual({
      windowMs: 60_000,
      maxRequests: 20
    });
  });

  it("allows production overrides", () => {
    process.env.ENGINE_RATE_LIMIT_WINDOW_MS = "30000";
    process.env.ENGINE_RATE_LIMIT_MAX = "8";

    expect(getEngineRateLimitConfig()).toEqual({
      windowMs: 30_000,
      maxRequests: 8
    });
  });
});

describe("createRateLimiter", () => {
  it("blocks requests after the configured limit", () => {
    let now = 1_000;
    const limiter = createRateLimiter({
      windowMs: 60_000,
      maxRequests: 2,
      now: () => now
    });
    const request = {
      ip: "203.0.113.10",
      socket: {}
    } as Request;
    const response = createMockResponse();
    const next = vi.fn();

    limiter(request, response, next);
    limiter(request, response, next);
    limiter(request, response, next);

    expect(next).toHaveBeenCalledTimes(2);
    expect(response.status).toHaveBeenCalledWith(429);
    expect(response.json).toHaveBeenCalledWith({
      error: "Too many engine requests. Please wait a moment and try again."
    });
    expect(response.headers.get("Retry-After")).toBe("60");

    now = 61_001;
    limiter(request, response, next);

    expect(next).toHaveBeenCalledTimes(3);
  });
});
