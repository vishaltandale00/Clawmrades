import { NextResponse } from "next/server";
import { requireMaintainer } from "@/lib/auth";
import { db } from "@/lib/db";
import { trackedIssues, workQueue } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getRepoConfig } from "@/lib/utils";


export async function POST(
  request: Request,
  { params }: { params: Promise<{ number: string }> }
) {
  try {
    await requireMaintainer(request);
  } catch (response) {
    return response as NextResponse;
  }

  const { number } = await params;
  const issueNumber = parseInt(number, 10);

  if (isNaN(issueNumber)) {
    return NextResponse.json(
      { error: "Invalid issue number" },
      { status: 400 }
    );
  }

  const { owner, name } = getRepoConfig();

  // Find the tracked issue
  const [issue] = await db
    .select()
    .from(trackedIssues)
    .where(
      and(
        eq(trackedIssues.repoOwner, owner),
        eq(trackedIssues.repoName, name),
        eq(trackedIssues.issueNumber, issueNumber)
      )
    )
    .limit(1);

  if (!issue) {
    return NextResponse.json({ error: "Issue not found" }, { status: 404 });
  }

  // Set triage_status to dismissed
  const [updated] = await db
    .update(trackedIssues)
    .set({
      triageStatus: "dismissed",
      updatedAt: new Date(),
    })
    .where(eq(trackedIssues.id, issue.id))
    .returning();

  // Mark all work_queue items for this issue as completed
  await db
    .update(workQueue)
    .set({
      status: "completed",
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(workQueue.targetType, "issue"),
        eq(workQueue.targetId, issueNumber.toString())
      )
    );

  return NextResponse.json(updated);
}
