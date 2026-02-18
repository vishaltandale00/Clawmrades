import { db } from "@/lib/db";
import { trackedIssues, issueClusters } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { findClusterMatches } from "@/lib/pinecone";

const DUPLICATE_THRESHOLD = 0.9;

/**
 * Incrementally assign an issue to a cluster based on embedding similarity.
 * Called right after the embedding is upserted to Pinecone during triage aggregation.
 *
 * Returns the cluster ID if the issue was assigned to one, or null.
 */
export async function assignIssueToCluster(
  issueId: number,
  embedding: number[],
  issueTitle: string
): Promise<string | null> {
  // Guard: skip if this issue is already in a cluster (re-aggregation case)
  const [current] = await db
    .select({ clusterId: trackedIssues.clusterId })
    .from(trackedIssues)
    .where(eq(trackedIssues.id, issueId))
    .limit(1);

  if (current?.clusterId) return current.clusterId;

  // 1. Find similar issues above the related threshold (0.85)
  const matches = await findClusterMatches(embedding, "issue", issueId);
  if (matches.length === 0) return null;

  const maxScore = Math.max(...matches.map((m) => m.score));
  const matchedDbIds = matches.map((m) => m.dbId);

  // 2. Check if any matched issues already belong to a cluster
  const matchedIssues = await db
    .select({
      id: trackedIssues.id,
      title: trackedIssues.title,
      clusterId: trackedIssues.clusterId,
    })
    .from(trackedIssues)
    .where(
      sql`${trackedIssues.id} IN (${sql.join(
        matchedDbIds.map((id) => sql`${id}`),
        sql`, `
      )})`
    );

  const existingClusterId = matchedIssues.find((i) => i.clusterId)?.clusterId;

  if (existingClusterId) {
    // 3a. Join the existing cluster — update this issue and bump count
    await db
      .update(trackedIssues)
      .set({ clusterId: existingClusterId, updatedAt: new Date() })
      .where(eq(trackedIssues.id, issueId));

    await db
      .update(issueClusters)
      .set({
        issueCount: sql`${issueClusters.issueCount} + 1`,
        confidenceScore: sql`GREATEST(${issueClusters.confidenceScore}, ${maxScore})`,
        updatedAt: new Date(),
      })
      .where(eq(issueClusters.id, existingClusterId));

    // Upgrade category to "duplicate" if max score warrants it
    if (maxScore >= DUPLICATE_THRESHOLD) {
      await db
        .update(issueClusters)
        .set({ category: "duplicate", updatedAt: new Date() })
        .where(eq(issueClusters.id, existingClusterId));
    }

    return existingClusterId;
  }

  // 3b. No existing cluster — create a new one with this issue + matches
  const category = maxScore >= DUPLICATE_THRESHOLD ? "duplicate" : "related";

  const memberTitles = [
    issueTitle,
    ...matchedIssues.map((i) => i.title),
  ].join(", ");

  const title =
    category === "duplicate"
      ? `Duplicate: ${issueTitle}`
      : `Related: ${issueTitle}`;

  const [cluster] = await db
    .insert(issueClusters)
    .values({
      title: title.slice(0, 500),
      summary:
        `Auto-detected ${category} cluster (max similarity: ${maxScore.toFixed(2)}). Issues: ${memberTitles}`.slice(
          0,
          2000
        ),
      category,
      representativeIssueId: issueId,
      issueCount: matchedIssues.length + 1, // matched + this issue
      createdBy: "system",
      confidenceScore: maxScore,
    })
    .returning();

  // Assign cluster to this issue and all matched issues
  const allIds = [issueId, ...matchedDbIds];
  for (const id of allIds) {
    await db
      .update(trackedIssues)
      .set({ clusterId: cluster.id, updatedAt: new Date() })
      .where(eq(trackedIssues.id, id));
  }

  return cluster.id;
}
