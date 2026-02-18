/**
 * One-time nuclear reset of all triage data.
 *
 * Run with:  npx tsx scripts/reset-triages.ts
 *
 * After running, the generate-work cron will recreate work items
 * and agents will re-triage everything through the full pipeline
 * (including similarity / Pinecone clustering).
 */

import { config } from "dotenv";
config({ path: ".env.local" });
import { db } from "@/lib/db";
import {
  issueTriages,
  issueClusters,
  trackedIssues,
  workQueue,
} from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { deleteIssueEmbedding } from "@/lib/pinecone";

async function main() {
  console.log("=== Triage Data Reset ===\n");

  // 1. Delete all issue_triages (FK to tracked_issues, must go first)
  const deletedTriages = await db
    .delete(issueTriages)
    .returning({ id: issueTriages.id });
  console.log(`Deleted ${deletedTriages.length} issue_triages rows`);

  // 2. Delete all issue_clusters
  const deletedClusters = await db
    .delete(issueClusters)
    .returning({ id: issueClusters.id });
  console.log(`Deleted ${deletedClusters.length} issue_clusters rows`);

  // 3. Reset all tracked_issues triage state
  const resetIssues = await db
    .update(trackedIssues)
    .set({
      triageStatus: "pending",
      triageCount: 0,
      priorityScore: null,
      priorityLabel: null,
      summary: null,
      description: null,
      triagedAt: null,
      embeddingStoredAt: null,
      clusterId: null,
      autoLabels: [],
    })
    .returning({ id: trackedIssues.id });
  console.log(`Reset ${resetIssues.length} tracked_issues to pending`);

  // 4. Delete all triage_issue work items from work_queue (all statuses)
  const deletedWork = await db
    .delete(workQueue)
    .where(eq(workQueue.workType, "triage_issue"))
    .returning({ id: workQueue.id });
  console.log(`Deleted ${deletedWork.length} triage_issue work_queue rows`);

  // 5. Delete Pinecone embeddings for every tracked issue
  console.log(`\nDeleting Pinecone embeddings for ${resetIssues.length} issues...`);
  let pineconeOk = 0;
  let pineconeFail = 0;
  for (const issue of resetIssues) {
    try {
      await deleteIssueEmbedding(issue.id);
      pineconeOk++;
    } catch (err) {
      pineconeFail++;
      console.warn(`  Failed to delete embedding for issue ${issue.id}:`, err);
    }
  }
  console.log(`Pinecone: ${pineconeOk} deleted, ${pineconeFail} failed`);

  console.log("\n=== Reset complete ===");
}

main().catch((err) => {
  console.error("Reset failed:", err);
  process.exit(1);
});
