import { NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/auth";
import { db } from "@/lib/db";
import { trackedIssues, prQueue, workQueue } from "@/lib/db/schema";
import { eq, and, count } from "drizzle-orm";
import { listAllOpenIssues, listAllOpenPRs, parseLinkedIssueNumbers } from "@/lib/github";
import { getRepoConfig, getWorkQueueConfig, issuePriorityToWorkPriority } from "@/lib/utils";

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const repoConfig = getRepoConfig();
  const { requiredTriages, requiredPrAnalyses } = getWorkQueueConfig();
  let issuesSynced = 0;
  let prsSynced = 0;
  let workCreated = 0;

  // Sync open issues
  const allIssues = await listAllOpenIssues();

  for (const issue of allIssues) {
    const [upserted] = await db
      .insert(trackedIssues)
      .values({
        repoOwner: repoConfig.owner,
        repoName: repoConfig.name,
        issueNumber: issue.number,
        title: issue.title,
        body: issue.body ?? null,
        htmlUrl: issue.html_url,
        labels: (issue.labels ?? []).map((l) =>
          typeof l === "string" ? l : l.name ?? ""
        ),
        state: issue.state ?? "open",
        author: issue.user?.login ?? "unknown",
        commentsCount: issue.comments ?? 0,
        reactionsCount: issue.reactions?.total_count ?? 0,
        createdAtGithub: new Date(issue.created_at),
        updatedAtGithub: new Date(issue.updated_at),
        syncedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [
          trackedIssues.repoOwner,
          trackedIssues.repoName,
          trackedIssues.issueNumber,
        ],
        set: {
          title: issue.title,
          body: issue.body ?? null,
          state: issue.state ?? "open",
          labels: (issue.labels ?? []).map((l) =>
            typeof l === "string" ? l : l.name ?? ""
          ),
          commentsCount: issue.comments ?? 0,
          reactionsCount: issue.reactions?.total_count ?? 0,
          updatedAtGithub: new Date(issue.updated_at),
          syncedAt: new Date(),
          updatedAt: new Date(),
        },
      })
      .returning();

    issuesSynced++;

    // Check if work items are needed
    const [{ existingCount }] = await db
      .select({ existingCount: count() })
      .from(workQueue)
      .where(
        and(
          eq(workQueue.targetId, String(upserted.id)),
          eq(workQueue.workType, "triage_issue"),
          eq(workQueue.targetType, "issue")
        )
      );

    const needed = requiredTriages - Number(existingCount);
    for (let i = 0; i < needed; i++) {
      await db.insert(workQueue).values({
        repoOwner: repoConfig.owner,
        repoName: repoConfig.name,
        workType: "triage_issue",
        targetType: "issue",
        targetId: String(upserted.id),
        priority: issuePriorityToWorkPriority(upserted.priorityScore),
      });
      workCreated++;
    }
  }

  // Sync open PRs
  const allPRs = await listAllOpenPRs();

  for (const pr of allPRs) {
    const linkedIssueNumbers = parseLinkedIssueNumbers(pr.body);

    const [upserted] = await db
      .insert(prQueue)
      .values({
        repoOwner: repoConfig.owner,
        repoName: repoConfig.name,
        prNumber: pr.number,
        title: pr.title,
        body: pr.body ?? null,
        htmlUrl: pr.html_url,
        author: pr.user?.login ?? "unknown",
        state: pr.state,
        labels: (pr.labels ?? []).map((l) => l.name ?? ""),
        linkedIssueNumbers,
        createdAtGithub: new Date(pr.created_at),
        updatedAtGithub: new Date(pr.updated_at),
        filesChanged: (pr as Record<string, unknown>).changed_files as number ?? null,
        linesAdded: (pr as Record<string, unknown>).additions as number ?? null,
        linesRemoved: (pr as Record<string, unknown>).deletions as number ?? null,
        syncedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [prQueue.repoOwner, prQueue.repoName, prQueue.prNumber],
        set: {
          title: pr.title,
          body: pr.body ?? null,
          state: pr.state,
          labels: (pr.labels ?? []).map((l) => l.name ?? ""),
          linkedIssueNumbers,
          updatedAtGithub: new Date(pr.updated_at),
          filesChanged: (pr as Record<string, unknown>).changed_files as number ?? null,
          linesAdded: (pr as Record<string, unknown>).additions as number ?? null,
          linesRemoved: (pr as Record<string, unknown>).deletions as number ?? null,
          syncedAt: new Date(),
          updatedAt: new Date(),
        },
      })
      .returning();

    prsSynced++;

    // Check if work items are needed
    const [{ existingCount }] = await db
      .select({ existingCount: count() })
      .from(workQueue)
      .where(
        and(
          eq(workQueue.targetId, String(upserted.id)),
          eq(workQueue.workType, "analyze_pr"),
          eq(workQueue.targetType, "pr")
        )
      );

    const needed = requiredPrAnalyses - Number(existingCount);
    for (let i = 0; i < needed; i++) {
      await db.insert(workQueue).values({
        repoOwner: repoConfig.owner,
        repoName: repoConfig.name,
        workType: "analyze_pr",
        targetType: "pr",
        targetId: String(upserted.id),
        priority: 50,
      });
      workCreated++;
    }
  }

  return NextResponse.json({
    issues_synced: issuesSynced,
    prs_synced: prsSynced,
    work_created: workCreated,
  });
}
