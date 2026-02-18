import { NextResponse } from "next/server";
import { requireAgent } from "@/lib/auth";
import { db } from "@/lib/db";
import { prQueue, trackedIssues } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { getRepoConfig } from "@/lib/utils";

export async function GET(request: Request) {
  try {
    await requireAgent(request);
  } catch (response) {
    return response as NextResponse;
  }

  const { searchParams } = new URL(request.url);
  const minPrs = parseInt(searchParams.get("min_prs") ?? "1", 10);
  const { owner, name } = getRepoConfig();

  // Get all PRs that have linked issue numbers
  const prs = await db
    .select()
    .from(prQueue)
    .where(
      and(
        eq(prQueue.repoOwner, owner),
        eq(prQueue.repoName, name),
        sql`${prQueue.linkedIssueNumbers} IS NOT NULL AND jsonb_array_length(${prQueue.linkedIssueNumbers}) > 0`
      )
    );

  // Group PRs by linked issue number
  const issueMap = new Map<
    number,
    { prNumber: number; title: string; author: string; htmlUrl: string; state: string; createdAt: Date }[]
  >();

  for (const pr of prs) {
    const linked = pr.linkedIssueNumbers ?? [];
    for (const issueNum of linked) {
      if (!issueMap.has(issueNum)) {
        issueMap.set(issueNum, []);
      }
      issueMap.get(issueNum)!.push({
        prNumber: pr.prNumber,
        title: pr.title,
        author: pr.author,
        htmlUrl: pr.htmlUrl,
        state: pr.state,
        createdAt: pr.createdAtGithub,
      });
    }
  }

  // Filter by min_prs
  const filtered = Array.from(issueMap.entries()).filter(
    ([, prList]) => prList.length >= minPrs
  );

  // Fetch issue details for the groups
  const items = await Promise.all(
    filtered.map(async ([issueNumber, prList]) => {
      const [issue] = await db
        .select({
          title: trackedIssues.title,
          htmlUrl: trackedIssues.htmlUrl,
        })
        .from(trackedIssues)
        .where(
          and(
            eq(trackedIssues.repoOwner, owner),
            eq(trackedIssues.repoName, name),
            eq(trackedIssues.issueNumber, issueNumber)
          )
        )
        .limit(1);

      return {
        issueNumber,
        issueTitle: issue?.title ?? null,
        issueUrl: issue?.htmlUrl ?? null,
        prs: prList,
      };
    })
  );

  // Sort by number of competing PRs (descending)
  items.sort((a, b) => b.prs.length - a.prs.length);

  const totalCompeting = items.filter((g) => g.prs.length >= 2).length;

  return NextResponse.json({
    items,
    total_groups: items.length,
    total_competing: totalCompeting,
  });
}
