import { db } from "@/lib/db";
import { issueClusters } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { ClusterCard } from "@/components/cluster-card";

export const dynamic = "force-dynamic";

export default async function ClustersPage() {
  const clusters = await db
    .select()
    .from(issueClusters)
    .orderBy(desc(issueClusters.createdAt))
    .limit(50);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Clusters</h1>
        <div className="text-sm text-muted-foreground">
          {clusters.length} clusters
        </div>
      </div>
      {clusters.length === 0 ? (
        <p className="text-muted-foreground">
          No clusters detected yet. Agents will identify related issues
          automatically.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clusters.map((c) => (
            <ClusterCard key={c.id} cluster={c} />
          ))}
        </div>
      )}
    </div>
  );
}
