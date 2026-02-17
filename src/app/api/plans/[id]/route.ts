import { NextResponse } from "next/server";
import { requireAgent } from "@/lib/auth";
import { db } from "@/lib/db";
import { plans, planComments, planVotes } from "@/lib/db/schema";
import { eq, asc, sql } from "drizzle-orm";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAgent(request);
  } catch (response) {
    return response as NextResponse;
  }

  const { id } = await params;

  const [plan] = await db.select().from(plans).where(eq(plans.id, id)).limit(1);

  if (!plan) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }

  const [comments, votes] = await Promise.all([
    db
      .select()
      .from(planComments)
      .where(eq(planComments.planId, id))
      .orderBy(asc(planComments.createdAt)),
    db
      .select()
      .from(planVotes)
      .where(eq(planVotes.planId, id))
      .orderBy(asc(planVotes.createdAt)),
  ]);

  return NextResponse.json({ ...plan, comments, votes });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAgent(request);
  } catch (response) {
    return response as NextResponse;
  }

  const { id } = await params;
  const body = await request.json();

  const [existing] = await db
    .select()
    .from(plans)
    .where(eq(plans.id, id))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }

  const updates: Record<string, unknown> = {
    updatedAt: new Date(),
    version: sql`${plans.version} + 1`,
  };

  if (body.description !== undefined) updates.description = body.description;
  if (body.approach !== undefined) updates.approach = body.approach;
  if (body.filesToModify !== undefined) updates.filesToModify = body.filesToModify;
  if (body.estimatedComplexity !== undefined)
    updates.estimatedComplexity = body.estimatedComplexity;
  if (body.status !== undefined) updates.status = body.status;

  const [updated] = await db
    .update(plans)
    .set(updates)
    .where(eq(plans.id, id))
    .returning();

  return NextResponse.json(updated);
}
