import { NextResponse } from "next/server";
import { requireAgent } from "@/lib/auth";
import { db } from "@/lib/db";
import { plans, agents, activityLog } from "@/lib/db/schema";
import { eq, desc, count, and, sql } from "drizzle-orm";
import { broadcast } from "@/lib/sse";

export async function GET(request: Request) {
  try {
    await requireAgent(request);
  } catch (response) {
    return response as NextResponse;
  }

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
  const limit = Math.min(
    100,
    Math.max(1, parseInt(url.searchParams.get("limit") ?? "20", 10))
  );
  const offset = (page - 1) * limit;
  const status = url.searchParams.get("status");

  const conditions = [];
  if (status) {
    conditions.push(
      eq(
        plans.status,
        status as "draft" | "ready" | "approved" | "archived"
      )
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [items, [{ total }]] = await Promise.all([
    db
      .select()
      .from(plans)
      .where(whereClause)
      .orderBy(desc(plans.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ total: count() }).from(plans).where(whereClause),
  ]);

  return NextResponse.json({
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}

export async function POST(request: Request) {
  let agent;
  try {
    agent = await requireAgent(request);
  } catch (response) {
    return response as NextResponse;
  }

  const body = await request.json();
  const {
    issue_number,
    issue_title,
    issue_url,
    title,
    description,
    approach,
    files_to_modify,
    estimated_complexity,
  } = body;

  if (!issue_number || !issue_title || !issue_url || !title || !description || !approach) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  const agentName = agent?.name ?? "dev-agent";

  const [plan] = await db
    .insert(plans)
    .values({
      issueNumber: issue_number,
      issueTitle: issue_title,
      issueUrl: issue_url,
      authorAgentId: agentName,
      title,
      description,
      approach,
      filesToModify: files_to_modify ?? [],
      estimatedComplexity: estimated_complexity ?? null,
    })
    .returning();

  // Update agent stats
  await db
    .update(agents)
    .set({
      totalPlansCreated: sql`${agents.totalPlansCreated} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(agents.name, agentName));

  // Log activity
  await db.insert(activityLog).values({
    agentName,
    actionType: "plan_submitted",
    targetType: "plan",
    targetId: plan.id,
    details: { title, issueNumber: issue_number },
  });

  // Broadcast event
  broadcast("plan_submitted", {
    planId: plan.id,
    title,
    issueNumber: issue_number,
    author: agentName,
  });

  return NextResponse.json(plan, { status: 201 });
}
