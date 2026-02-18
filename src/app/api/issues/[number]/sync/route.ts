import { NextResponse } from "next/server";
import { requireAgent } from "@/lib/auth";
import { db } from "@/lib/db";
import { trackedIssues, workQueue } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getIssue as fetchGithubIssue } from "@/lib/github";
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
  const issueNumber = parseInt(number, 10);

  if (isNaN(issueNumber)) {
    return NextResponse.json(
      { error: "Invalid issue number" },
      { status: 400 }
    );
  }

  const { owner, name } = getRepoConfig();
  const { requiredTriages } = getWorkQueueConfig();

  // Fetch issue from GitHub
  let ghIssue;
  try {
    ghIssue = await fetchGithubIssue(issueNumber);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch issue from GitHub" },
      { status: 502 }
    );
  }

  // Check if issue already exists
  const [existing] = await db
    .select({ id: trackedIssues.id })
    .from(trackedIssues)
    .where(
      and(
        eq(trackedIssues.repoOwner, owner),
        eq(trackedIssues.repoName, name),
        eq(trackedIssues.issueNumber, issueNumber)
      )
    )
    .limit(1);

  const isNew = !existing;

  // Upsert the issue
  const [issue] = await db
    .insert(trackedIssues)
    .values({
      repoOwner: owner,
      repoName: name,
      issueNumber: ghIssue.number,
      title: ghIssue.title,
      body: ghIssue.body ?? null,
      htmlUrl: ghIssue.html_url,
      labels: (ghIssue.labels ?? []).map((l) =>
        typeof l === "string" ? l : l.name ?? ""
      ),
      state: ghIssue.state,
      author: ghIssue.user?.login ?? "unknown",
      commentsCount: ghIssue.comments ?? 0,
      reactionsCount: (ghIssue.reactions as { total_count?: number })?.total_count ?? 0,
      createdAtGithub: new Date(ghIssue.created_at),
      updatedAtGithub: new Date(ghIssue.updated_at),
      requiredTriages,
      syncedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [
        trackedIssues.repoOwner,
        trackedIssues.repoName,
        trackedIssues.issueNumber,
      ],
      set: {
        title: ghIssue.title,
        body: ghIssue.body ?? null,
        htmlUrl: ghIssue.html_url,
        labels: (ghIssue.labels ?? []).map((l) =>
          typeof l === "string" ? l : l.name ?? ""
        ),
        state: ghIssue.state,
        author: ghIssue.user?.login ?? "unknown",
        commentsCount: ghIssue.comments ?? 0,
        reactionsCount: (ghIssue.reactions as { total_count?: number })?.total_count ?? 0,
        updatedAtGithub: new Date(ghIssue.updated_at),
        syncedAt: new Date(),
        updatedAt: new Date(),
      },
    })
    .returning();

  // If new issue, create work queue items for triage
  if (isNew) {
    const workItems = Array.from({ length: requiredTriages }, () => ({
      repoOwner: owner,
      repoName: name,
      workType: "triage_issue" as const,
      targetType: "issue",
      targetId: issueNumber.toString(),
      status: "available" as const,
    }));

    await db.insert(workQueue).values(workItems);
  }

  return NextResponse.json(issue);
}
