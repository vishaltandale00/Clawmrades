import { NextResponse } from "next/server";
import { requireMaintainer } from "@/lib/auth";
import { db } from "@/lib/db";
import { prQueue } from "@/lib/db/schema";
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
  const prNumber = parseInt(number, 10);
  const { owner, name } = getRepoConfig();

  const body = await request.json();
  const { decision, notes } = body;

  if (
    !decision ||
    !["approve", "request_changes", "close"].includes(decision)
  ) {
    return NextResponse.json(
      {
        error:
          "Invalid decision. Must be one of: approve, request_changes, close",
      },
      { status: 400 }
    );
  }

  const [updated] = await db
    .update(prQueue)
    .set({
      maintainerDecision: decision,
      maintainerNotes: notes ?? null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(prQueue.repoOwner, owner),
        eq(prQueue.repoName, name),
        eq(prQueue.prNumber, prNumber)
      )
    )
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "PR not found" }, { status: 404 });
  }

  return NextResponse.json(updated);
}
