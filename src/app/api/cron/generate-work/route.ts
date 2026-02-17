import { NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/auth";
import { db } from "@/lib/db";
import { trackedIssues, prQueue, workQueue } from "@/lib/db/schema";
import { eq, and, lt, count, sql } from "drizzle-orm";
import { getRepoConfig, getWorkQueueConfig } from "@/lib/utils";

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const repoConfig = getRepoConfig();
  const { requiredTriages, requiredPrAnalyses } = getWorkQueueConfig();
  let created = 0;

  // Find issues needing more triages
  const issuesNeedingTriages = await db
    .select()
    .from(trackedIssues)
    .where(
      and(
        lt(trackedIssues.triageCount, sql`${trackedIssues.requiredTriages}`),
        eq(trackedIssues.state, "open"),
        eq(trackedIssues.triageStatus, "pending")
      )
    );

  for (const issue of issuesNeedingTriages) {
    // Count existing triage work items for this issue
    const [{ existingCount }] = await db
      .select({ existingCount: count() })
      .from(workQueue)
      .where(
        and(
          eq(workQueue.targetId, String(issue.id)),
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
        targetId: String(issue.id),
        priority: 50,
      });
      created++;
    }
  }

  // Find PRs needing more analyses
  const prsNeedingAnalyses = await db
    .select()
    .from(prQueue)
    .where(
      and(
        lt(prQueue.analysisCount, sql`${prQueue.requiredAnalyses}`),
        eq(prQueue.state, "open")
      )
    );

  for (const pr of prsNeedingAnalyses) {
    // Count existing analyze work items for this PR
    const [{ existingCount }] = await db
      .select({ existingCount: count() })
      .from(workQueue)
      .where(
        and(
          eq(workQueue.targetId, String(pr.id)),
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
        targetId: String(pr.id),
        priority: 50,
      });
      created++;
    }
  }

  return NextResponse.json({ created });
}
