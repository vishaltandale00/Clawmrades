import { NextResponse } from "next/server";
import { requireAgent } from "@/lib/auth";
import { db } from "@/lib/db";
import { workQueue } from "@/lib/db/schema";
import { eq, and, desc, asc, count, sql } from "drizzle-orm";
import { getRepoConfig, getWorkQueueConfig } from "@/lib/utils";

export async function GET(request: Request) {
  let agent;
  try {
    agent = await requireAgent(request);
  } catch (response) {
    return response as NextResponse;
  }

  const url = new URL(request.url);
  const typesParam = url.searchParams.get("types");
  const types = typesParam
    ? typesParam.split(",").map((t) => t.trim())
    : [
        "triage_issue",
        "analyze_pr",
        "create_plan",
        "review_plan",
        "discuss_plan",
        "discuss_pr",
      ];

  const agentId = agent?.id ?? "dev-agent";
  const { claimTimeoutMinutes, maxConcurrentClaims } = getWorkQueueConfig();
  const repoConfig = getRepoConfig();

  // Count active claims
  const [{ count: activeClaims }] = await db
    .select({ count: count() })
    .from(workQueue)
    .where(
      and(
        eq(workQueue.claimedBy, agentId),
        eq(workQueue.status, "claimed")
      )
    );

  if (Number(activeClaims) >= maxConcurrentClaims) {
    return NextResponse.json(
      { error: "Max concurrent claims reached" },
      { status: 429 }
    );
  }

  // Build the types filter
  const typesFilter = sql`${workQueue.workType} IN (${sql.join(
    types.map((t) => sql`${t}`),
    sql`, `
  )})`;

  // Subquery to exclude items where agent already has completed/claimed work on same target
  const excludeSubquery = sql`NOT EXISTS (
    SELECT 1 FROM work_queue AS wq2
    WHERE wq2.target_id = ${workQueue.targetId}
      AND wq2.work_type = ${workQueue.workType}
      AND wq2.claimed_by = ${agentId}
      AND wq2.status IN ('completed', 'claimed')
  )`;

  // Find available work item
  const [available] = await db
    .select()
    .from(workQueue)
    .where(
      and(
        eq(workQueue.status, "available"),
        eq(workQueue.repoOwner, repoConfig.owner),
        eq(workQueue.repoName, repoConfig.name),
        typesFilter,
        excludeSubquery
      )
    )
    .orderBy(desc(workQueue.priority), asc(workQueue.createdAt))
    .limit(1);

  if (!available) {
    return new NextResponse(null, { status: 204 });
  }

  // Atomically claim the work item
  const expiresAt = new Date(Date.now() + claimTimeoutMinutes * 60 * 1000);

  const [claimed] = await db
    .update(workQueue)
    .set({
      status: "claimed",
      claimedBy: agentId,
      claimedAt: new Date(),
      expiresAt,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(workQueue.id, available.id),
        eq(workQueue.status, "available")
      )
    )
    .returning();

  if (!claimed) {
    // Another agent claimed it first
    return new NextResponse(null, { status: 204 });
  }

  return NextResponse.json(claimed);
}
