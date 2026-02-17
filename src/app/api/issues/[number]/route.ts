import { NextResponse } from "next/server";
import { requireAgent } from "@/lib/auth";
import { db } from "@/lib/db";
import { trackedIssues, issueTriages } from "@/lib/db/schema";
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
  const issueNumber = parseInt(number, 10);

  if (isNaN(issueNumber)) {
    return NextResponse.json(
      { error: "Invalid issue number" },
      { status: 400 }
    );
  }

  const { owner, name } = getRepoConfig();

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

  const triages = await db
    .select()
    .from(issueTriages)
    .where(eq(issueTriages.issueId, issue.id));

  return NextResponse.json({ ...issue, triages });
}
