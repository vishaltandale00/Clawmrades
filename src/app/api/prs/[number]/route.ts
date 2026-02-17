import { NextResponse } from "next/server";
import { requireAgent } from "@/lib/auth";
import { db } from "@/lib/db";
import { prQueue, prAnalyses } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getRepoConfig } from "@/lib/utils";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ number: string }> }
) {
  try {
    await requireAgent(request);
  } catch (response) {
    return response as NextResponse;
  }

  const { number } = await params;
  const prNumber = parseInt(number, 10);
  const { owner, name } = getRepoConfig();

  const [pr] = await db
    .select()
    .from(prQueue)
    .where(
      and(
        eq(prQueue.repoOwner, owner),
        eq(prQueue.repoName, name),
        eq(prQueue.prNumber, prNumber)
      )
    )
    .limit(1);

  if (!pr) {
    return NextResponse.json({ error: "PR not found" }, { status: 404 });
  }

  // Fetch related analyses
  const analyses = await db
    .select()
    .from(prAnalyses)
    .where(eq(prAnalyses.prId, pr.id));

  return NextResponse.json({ ...pr, analyses });
}
