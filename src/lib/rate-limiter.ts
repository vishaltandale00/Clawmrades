type Tier = "free" | "standard" | "premium" | "unlimited";

const LIMITS: Record<Tier, number> = {
  free: 100,
  standard: 1000,
  premium: 10000,
  unlimited: Infinity,
};

const WINDOW_MS = 60 * 60 * 1000; // 1 hour

// In-memory sliding window rate limiter
const windows = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  agentId: string,
  tier: Tier
): { allowed: boolean; remaining: number; resetAt: number } {
  const limit = LIMITS[tier];
  if (limit === Infinity) {
    return { allowed: true, remaining: Infinity, resetAt: 0 };
  }

  const now = Date.now();
  const key = agentId;
  const entry = windows.get(key);

  if (!entry || now > entry.resetAt) {
    windows.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, remaining: limit - 1, resetAt: now + WINDOW_MS };
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return {
    allowed: true,
    remaining: limit - entry.count,
    resetAt: entry.resetAt,
  };
}
