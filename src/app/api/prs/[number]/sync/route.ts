import { NextResponse } from "next/server";
import { requireAgent } from "@/lib/auth";
import { db } from "@/lib/db";
import { prQueue, workQueue } from "@/lib/db/schema";
import type { InferSelectModel } from "drizzle-orm";
import { eq, and } from "drizzle-orm";
import { getPR as fetchGithubPR, getPRFiles, parseLinkedIssueNumbers } from "@/lib/github";
import { getRepoConfig, getWorkQueueConfig } from "@/lib/utils";


export async function POST(
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
  const { requiredPrAnalyses } = getWorkQueueConfig();

  // Fetch from GitHub
  const ghPR = await fetchGithubPR(prNumber);
  const ghFiles = await getPRFiles(prNumber);

  const filesChanged = ghFiles.length;
  const linesAdded = ghFiles.reduce((sum, f) => sum + f.additions, 0);
  const linesRemoved = ghFiles.reduce((sum, f) => sum + f.deletions, 0);

  const prData = {
    repoOwner: owner,
    repoName: name,
    prNumber: ghPR.number,
    title: ghPR.title,
    body: ghPR.body ?? null,
    htmlUrl: ghPR.html_url,
    author: ghPR.user?.login ?? "unknown",
    state: ghPR.state,
    labels: (ghPR.labels?.map((l) => (typeof l === "string" ? l : l.name)).filter(Boolean) as string[]) ?? [],
    linkedIssueNumbers: parseLinkedIssueNumbers(ghPR.body),
    createdAtGithub: new Date(ghPR.created_at),
    updatedAtGithub: new Date(ghPR.updated_at),
    filesChanged,
    linesAdded,
    linesRemoved,
    syncedAt: new Date(),
    updatedAt: new Date(),
  };

  // Check if PR already exists
  const [existing] = await db
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

  let pr: InferSelectModel<typeof prQueue>;

  if (existing) {
    // Update existing PR
    const [updated] = await db
      .update(prQueue)
      .set(prData)
      .where(eq(prQueue.id, existing.id))
      .returning();
    pr = updated;
  } else {
    // Insert new PR
    const [inserted] = await db
      .insert(prQueue)
      .values({
        ...prData,
        requiredAnalyses: requiredPrAnalyses,
      })
      .returning();
    pr = inserted;

    // Create work items for analysis
    const workItems = Array.from({ length: requiredPrAnalyses }, () => ({
      repoOwner: owner,
      repoName: name,
      workType: "analyze_pr" as const,
      targetType: "pr",
      targetId: String(pr.prNumber),
      priority: 50,
    }));

    if (workItems.length > 0) {
      await db.insert(workQueue).values(workItems);
    }
  }

  return NextResponse.json(pr);
}
