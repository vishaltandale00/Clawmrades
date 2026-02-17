import { NextResponse } from "next/server";
import { requireAgent } from "@/lib/auth";
import { db } from "@/lib/db";
import { workQueue } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ targetType: string; targetId: string }> }
) {
  try {
    await requireAgent(request);
  } catch (response) {
    return response as NextResponse;
  }

  const { targetType, targetId } = await params;

  // Mark all discuss_* work items for this target as completed
  const result = await db
    .update(workQueue)
    .set({
      status: "completed",
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(workQueue.targetId, targetId),
        sql`${workQueue.workType} LIKE 'discuss_%'`,
        eq(workQueue.targetType, targetType)
      )
    )
    .returning();

  return NextResponse.json({
    concluded: true,
    itemsCompleted: result.length,
  });
}
