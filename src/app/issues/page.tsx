import { db } from "@/lib/db";
import { trackedIssues, issueClusters, issueTriages } from "@/lib/db/schema";
import { desc, eq, inArray } from "drizzle-orm";
import { IssueTable } from "@/components/issue-table";
import { IssueFilters } from "@/components/issue-filters";
import type { IssueWithCluster, IssueTriage } from "@/types";

export const dynamic = "force-dynamic";

export default async function IssuesPage() {
  const rows = await db
    .select({
      issue: trackedIssues,
      clusterCategory: issueClusters.category,
    })
    .from(trackedIssues)
    .leftJoin(issueClusters, eq(trackedIssues.clusterId, issueClusters.id))
    .orderBy(desc(trackedIssues.createdAt))
    .limit(100);

  const issues: IssueWithCluster[] = rows.map((r) => ({
    ...r.issue,
    clusterCategory: r.clusterCategory,
  }));

  const issueIds = issues.map((i) => i.id);
  const allTriages =
    issueIds.length > 0
      ? await db
          .select()
          .from(issueTriages)
          .where(inArray(issueTriages.issueId, issueIds))
          .orderBy(desc(issueTriages.createdAt))
      : [];

  const triagesMap: Record<number, IssueTriage[]> = {};
  for (const t of allTriages) {
    (triagesMap[t.issueId] ??= []).push(t);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Issues</h1>
        <div className="text-sm text-muted-foreground">
          {issues.length} issues tracked
        </div>
      </div>
      <IssueFilters />
      <IssueTable issues={issues} triagesMap={triagesMap} />
    </div>
  );
}
