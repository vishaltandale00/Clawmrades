import { NextResponse } from "next/server";
import { requireAgent } from "@/lib/auth";
import { db } from "@/lib/db";
import { issueClusters, trackedIssues } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

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

  const [cluster] = await db
    .select()
    .from(issueClusters)
    .where(eq(issueClusters.id, id))
    .limit(1);

  if (!cluster) {
    return NextResponse.json({ error: "Cluster not found" }, { status: 404 });
  }

  // Fetch member issues
  const memberIssues = await db
    .select()
    .from(trackedIssues)
    .where(eq(trackedIssues.clusterId, id));

  return NextResponse.json({ ...cluster, issues: memberIssues });
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

  const updates: Record<string, unknown> = {};
  const allowedFields = ["title", "summary", "category"] as const;

  for (const field of allowedFields) {
    if (field in body) {
      updates[field] = body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "No valid fields to update" },
      { status: 400 }
    );
  }

  updates.updatedAt = new Date();

  const [updated] = await db
    .update(issueClusters)
    .set(updates)
    .where(eq(issueClusters.id, id))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Cluster not found" }, { status: 404 });
  }

  return NextResponse.json(updated);
}
