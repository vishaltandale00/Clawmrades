import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { checkRateLimit } from "@/lib/rate-limiter";

describe("checkRateLimit", () => {
  let counter = 0;

  beforeEach(() => {
    vi.useFakeTimers();
    counter++;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function uniqueAgent() {
    return `agent-${counter}-${Math.random().toString(36).slice(2)}`;
  }

  it("unlimited tier always allows with remaining: Infinity", () => {
    const result = checkRateLimit(uniqueAgent(), "unlimited");
    expect(result).toEqual({ allowed: true, remaining: Infinity, resetAt: 0 });
  });

  it("first request on free tier is allowed with remaining 99", () => {
    const result = checkRateLimit(uniqueAgent(), "free");
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(99);
  });

  it("101st request on free tier is denied (limit is 100)", () => {
    const agent = uniqueAgent();
    for (let i = 0; i < 100; i++) {
      checkRateLimit(agent, "free");
    }
    const result = checkRateLimit(agent, "free");
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("resets count after window expiry", () => {
    const agent = uniqueAgent();
    // Exhaust the limit
    for (let i = 0; i < 100; i++) {
      checkRateLimit(agent, "free");
    }
    const denied = checkRateLimit(agent, "free");
    expect(denied.allowed).toBe(false);

    // Advance past the 1-hour window
    vi.advanceTimersByTime(60 * 60 * 1000 + 1);

    const result = checkRateLimit(agent, "free");
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(99);
  });

  it("standard tier has limit of 1000", () => {
    const agent = uniqueAgent();
    const first = checkRateLimit(agent, "standard");
    expect(first.remaining).toBe(999);
  });

  it("premium tier has limit of 10000", () => {
    const agent = uniqueAgent();
    const first = checkRateLimit(agent, "premium");
    expect(first.remaining).toBe(9999);
  });
});
