import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createHash } from "crypto";

// Mock the db module before importing auth
vi.mock("@/lib/db", () => {
  const selectResult = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  };
  return {
    db: {
      select: vi.fn(() => selectResult),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn().mockResolvedValue(undefined),
        })),
      })),
    },
    agents: { apiKeyHash: "apiKeyHash", id: "id" },
  };
});

import {
  hashApiKey,
  verifyCronSecret,
  requireMaintainer,
  requireAgent,
  requireAdmin,
} from "@/lib/auth";
import { db, agents } from "@/lib/db";

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/test", { headers });
}

describe("hashApiKey", () => {
  it("returns deterministic output", () => {
    expect(hashApiKey("test")).toBe(hashApiKey("test"));
  });

  it("matches known SHA-256 vector", () => {
    const expected = createHash("sha256").update("abc").digest("hex");
    expect(hashApiKey("abc")).toBe(expected);
    expect(expected).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    );
  });

  it("different inputs produce different outputs", () => {
    expect(hashApiKey("a")).not.toBe(hashApiKey("b"));
  });
});

describe("verifyCronSecret", () => {
  const origEnv = process.env.ENVIRONMENT;
  const origSecret = process.env.CRON_SECRET;

  afterEach(() => {
    if (origEnv !== undefined) process.env.ENVIRONMENT = origEnv;
    else delete process.env.ENVIRONMENT;
    if (origSecret !== undefined) process.env.CRON_SECRET = origSecret;
    else delete process.env.CRON_SECRET;
  });

  it("returns true in dev mode", () => {
    delete process.env.ENVIRONMENT;
    expect(verifyCronSecret(makeRequest())).toBe(true);
  });

  it("returns true in production with valid secret", () => {
    process.env.ENVIRONMENT = "production";
    process.env.CRON_SECRET = "secret123";
    const req = makeRequest({ Authorization: "Bearer secret123" });
    expect(verifyCronSecret(req)).toBe(true);
  });

  it("returns false in production with wrong secret", () => {
    process.env.ENVIRONMENT = "production";
    process.env.CRON_SECRET = "secret123";
    const req = makeRequest({ Authorization: "Bearer wrong" });
    expect(verifyCronSecret(req)).toBe(false);
  });

  it("returns false in production with no header", () => {
    process.env.ENVIRONMENT = "production";
    process.env.CRON_SECRET = "secret123";
    expect(verifyCronSecret(makeRequest())).toBe(false);
  });
});

describe("requireMaintainer", () => {
  const origEnv = process.env.ENVIRONMENT;
  const origToken = process.env.MAINTAINER_TOKEN;

  afterEach(() => {
    if (origEnv !== undefined) process.env.ENVIRONMENT = origEnv;
    else delete process.env.ENVIRONMENT;
    if (origToken !== undefined) process.env.MAINTAINER_TOKEN = origToken;
    else delete process.env.MAINTAINER_TOKEN;
  });

  it("returns true in dev mode with no token", async () => {
    delete process.env.ENVIRONMENT;
    expect(await requireMaintainer(makeRequest())).toBe(true);
  });

  it("returns true in production with valid X-Maintainer-Token", async () => {
    process.env.ENVIRONMENT = "production";
    process.env.MAINTAINER_TOKEN = "mt-123";
    const req = makeRequest({ "X-Maintainer-Token": "mt-123" });
    expect(await requireMaintainer(req)).toBe(true);
  });

  it("returns true in production with valid Authorization Bearer", async () => {
    process.env.ENVIRONMENT = "production";
    process.env.MAINTAINER_TOKEN = "mt-123";
    const req = makeRequest({ Authorization: "Bearer mt-123" });
    expect(await requireMaintainer(req)).toBe(true);
  });

  it("throws 403 in production with wrong token", async () => {
    process.env.ENVIRONMENT = "production";
    process.env.MAINTAINER_TOKEN = "mt-123";
    const req = makeRequest({ "X-Maintainer-Token": "wrong" });
    try {
      await requireMaintainer(req);
      expect.unreachable("should have thrown");
    } catch (e: unknown) {
      const resp = e as Response;
      expect(resp.status).toBe(403);
    }
  });

  it("throws 401 in production with no token", async () => {
    process.env.ENVIRONMENT = "production";
    process.env.MAINTAINER_TOKEN = "mt-123";
    try {
      await requireMaintainer(makeRequest());
      expect.unreachable("should have thrown");
    } catch (e: unknown) {
      const resp = e as Response;
      expect(resp.status).toBe(401);
    }
  });
});

describe("requireAgent", () => {
  const origEnv = process.env.ENVIRONMENT;

  afterEach(() => {
    if (origEnv !== undefined) process.env.ENVIRONMENT = origEnv;
    else delete process.env.ENVIRONMENT;
    vi.restoreAllMocks();
  });

  function mockDbSelect(rows: unknown[]) {
    const selectResult = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue(rows),
    };
    vi.mocked(db.select).mockReturnValue(selectResult as never);
  }

  it("returns null in dev mode with no key", async () => {
    delete process.env.ENVIRONMENT;
    const result = await requireAgent(makeRequest());
    expect(result).toBeNull();
  });

  it("throws 401 in production with no key", async () => {
    process.env.ENVIRONMENT = "production";
    try {
      await requireAgent(makeRequest());
      expect.unreachable("should have thrown");
    } catch (e: unknown) {
      const resp = e as Response;
      expect(resp.status).toBe(401);
    }
  });

  it("returns agent and updates lastActiveAt for valid key + active agent", async () => {
    delete process.env.ENVIRONMENT;
    const fakeAgent = { id: "a1", status: "active", isAdmin: false };
    mockDbSelect([fakeAgent]);

    const mockWhere = vi.fn().mockResolvedValue(undefined);
    const mockSet = vi.fn(() => ({ where: mockWhere }));
    vi.mocked(db.update).mockReturnValue({ set: mockSet } as never);

    const req = makeRequest({ "X-API-Key": "my-secret-key" });
    const result = await requireAgent(req);
    expect(result).toEqual(fakeAgent);
    expect(db.update).toHaveBeenCalled();
  });

  it("throws 401 for valid key but agent not found", async () => {
    delete process.env.ENVIRONMENT;
    mockDbSelect([]);

    const req = makeRequest({ "X-API-Key": "unknown-key" });
    try {
      await requireAgent(req);
      expect.unreachable("should have thrown");
    } catch (e: unknown) {
      const resp = e as Response;
      expect(resp.status).toBe(401);
    }
  });

  it("throws 403 for revoked agent", async () => {
    delete process.env.ENVIRONMENT;
    mockDbSelect([{ id: "a1", status: "revoked" }]);

    const req = makeRequest({ "X-API-Key": "revoked-key" });
    try {
      await requireAgent(req);
      expect.unreachable("should have thrown");
    } catch (e: unknown) {
      const resp = e as Response;
      expect(resp.status).toBe(403);
    }
  });

  it("throws 403 for suspended agent", async () => {
    delete process.env.ENVIRONMENT;
    mockDbSelect([{ id: "a1", status: "suspended" }]);

    const req = makeRequest({ "X-API-Key": "suspended-key" });
    try {
      await requireAgent(req);
      expect.unreachable("should have thrown");
    } catch (e: unknown) {
      const resp = e as Response;
      expect(resp.status).toBe(403);
    }
  });
});

describe("requireAdmin", () => {
  const origEnv = process.env.ENVIRONMENT;

  afterEach(() => {
    if (origEnv !== undefined) process.env.ENVIRONMENT = origEnv;
    else delete process.env.ENVIRONMENT;
    vi.restoreAllMocks();
  });

  function mockDbSelect(rows: unknown[]) {
    const selectResult = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue(rows),
    };
    vi.mocked(db.select).mockReturnValue(selectResult as never);
  }

  it("returns null in dev mode", async () => {
    delete process.env.ENVIRONMENT;
    const result = await requireAdmin(makeRequest());
    expect(result).toBeNull();
  });

  it("returns agent for valid key with isAdmin: true", async () => {
    delete process.env.ENVIRONMENT;
    const fakeAgent = { id: "a1", status: "active", isAdmin: true };
    mockDbSelect([fakeAgent]);

    const mockWhere = vi.fn().mockResolvedValue(undefined);
    const mockSet = vi.fn(() => ({ where: mockWhere }));
    vi.mocked(db.update).mockReturnValue({ set: mockSet } as never);

    const req = makeRequest({ "X-API-Key": "admin-key" });
    const result = await requireAdmin(req);
    expect(result).toEqual(fakeAgent);
  });

  it("throws 403 for valid key with isAdmin: false", async () => {
    delete process.env.ENVIRONMENT;
    const fakeAgent = { id: "a1", status: "active", isAdmin: false };
    mockDbSelect([fakeAgent]);

    const mockWhere = vi.fn().mockResolvedValue(undefined);
    const mockSet = vi.fn(() => ({ where: mockWhere }));
    vi.mocked(db.update).mockReturnValue({ set: mockSet } as never);

    const req = makeRequest({ "X-API-Key": "normal-key" });
    try {
      await requireAdmin(req);
      expect.unreachable("should have thrown");
    } catch (e: unknown) {
      const resp = e as Response;
      expect(resp.status).toBe(403);
    }
  });
});
