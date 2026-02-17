import { db, agents } from "@/lib/db";
import { eq } from "drizzle-orm";
import { createHash } from "crypto";
import { NextResponse } from "next/server";

function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export async function requireAgent(request: Request) {
  const apiKey = request.headers.get("X-API-Key");

  if (!apiKey) {
    // Dev mode: allow unauthenticated
    if (process.env.ENVIRONMENT !== "production") {
      return null;
    }
    throw NextResponse.json({ error: "Missing X-API-Key header" }, { status: 401 });
  }

  const hash = hashApiKey(apiKey);
  const [agent] = await db
    .select()
    .from(agents)
    .where(eq(agents.apiKeyHash, hash))
    .limit(1);

  if (!agent) {
    throw NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  }

  if (agent.status === "revoked") {
    throw NextResponse.json({ error: "Agent revoked" }, { status: 403 });
  }

  if (agent.status === "suspended") {
    throw NextResponse.json({ error: "Agent suspended" }, { status: 403 });
  }

  // Update last active
  await db
    .update(agents)
    .set({ lastActiveAt: new Date() })
    .where(eq(agents.id, agent.id));

  return agent;
}

export async function requireAdmin(request: Request) {
  const agent = await requireAgent(request);

  if (!agent) {
    // Dev mode pass-through
    if (process.env.ENVIRONMENT !== "production") return null;
    throw NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!agent.isAdmin) {
    throw NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  return agent;
}

export async function requireMaintainer(request: Request) {
  const token =
    request.headers.get("X-Maintainer-Token") ??
    request.headers.get("Authorization")?.replace("Bearer ", "");

  if (!token) {
    if (process.env.ENVIRONMENT !== "production") return true;
    throw NextResponse.json(
      { error: "Missing maintainer token" },
      { status: 401 }
    );
  }

  if (token !== process.env.MAINTAINER_TOKEN) {
    throw NextResponse.json(
      { error: "Invalid maintainer token" },
      { status: 403 }
    );
  }

  return true;
}

export function verifyCronSecret(request: Request): boolean {
  const secret = request.headers.get("Authorization")?.replace("Bearer ", "");
  if (process.env.ENVIRONMENT !== "production") return true;
  return secret === process.env.CRON_SECRET;
}

export { hashApiKey };
