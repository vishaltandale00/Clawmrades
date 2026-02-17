import { NextResponse } from "next/server";
import { requireAgent } from "@/lib/auth";
import { db } from "@/lib/db";
import { workQueue } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(request: Request) {
  let agent;
  try {
    agent = await requireAgent(request);
  } catch (response) {
    return response as NextResponse;
  }

  const agentName = agent?.name ?? "dev-agent";

  const items = await db
    .select()
    .from(workQueue)
    .where(
      and(
        eq(workQueue.status, "claimed"),
        eq(workQueue.claimedBy, agentName)
      )
    );

  return NextResponse.json({ items });
}
