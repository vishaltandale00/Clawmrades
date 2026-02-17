import { db } from "@/lib/db";
import { trackedIssues } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { IssueTable } from "@/components/issue-table";

export const dynamic = "force-dynamic";

export default async function IssuesPage() {
  const issues = await db
    .select()
    .from(trackedIssues)
    .orderBy(desc(trackedIssues.createdAt))
    .limit(100);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Issues</h1>
        <div className="text-sm text-muted-foreground">
          {issues.length} issues tracked
        </div>
      </div>
      <IssueTable issues={issues} />
    </div>
  );
}
