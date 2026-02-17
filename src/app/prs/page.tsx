import { db } from "@/lib/db";
import { prQueue } from "@/lib/db/schema";
import { desc, sql } from "drizzle-orm";
import { PrQueueTable } from "@/components/pr-queue-table";

export const dynamic = "force-dynamic";

export default async function PrsPage() {
  const prs = await db
    .select()
    .from(prQueue)
    .orderBy(
      sql`CASE review_priority
        WHEN 'urgent' THEN 0
        WHEN 'high' THEN 1
        WHEN 'normal' THEN 2
        WHEN 'low' THEN 3
        ELSE 4 END`,
      desc(prQueue.createdAt)
    )
    .limit(100);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Pull Requests</h1>
        <div className="text-sm text-muted-foreground">
          {prs.length} PRs tracked
        </div>
      </div>
      <PrQueueTable prs={prs} />
    </div>
  );
}
