import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  trackedIssues,
  prQueue,
  issueClusters,
  plans,
  agents,
} from "@/lib/db/schema";
import { eq, and, count, or, sql } from "drizzle-orm";

export async function GET() {
  const [
    [{ openIssues }],
    [{ pendingTriages }],
    [{ prsNeedingReview }],
    [{ activeClusters }],
    [{ pendingPlans }],
    [{ activeAgents }],
  ] = await Promise.all([
    db
      .select({ openIssues: count() })
      .from(trackedIssues)
      .where(eq(trackedIssues.state, "open")),
    db
      .select({ pendingTriages: count() })
      .from(trackedIssues)
      .where(eq(trackedIssues.triageStatus, "pending")),
    db
      .select({ prsNeedingReview: count() })
      .from(prQueue)
      .where(
        and(
          eq(prQueue.state, "open"),
          sql`${prQueue.maintainerDecision} IS NULL`
        )
      ),
    db
      .select({ activeClusters: count() })
      .from(issueClusters)
      .where(eq(issueClusters.maintainerReviewed, false)),
    db
      .select({ pendingPlans: count() })
      .from(plans)
      .where(or(eq(plans.status, "draft"), eq(plans.status, "ready"))),
    db
      .select({ activeAgents: count() })
      .from(agents)
      .where(eq(agents.status, "active")),
  ]);

  return NextResponse.json({
    open_issues: openIssues,
    pending_triages: pendingTriages,
    prs_needing_review: prsNeedingReview,
    active_clusters: activeClusters,
    pending_plans: pendingPlans,
    active_agents: activeAgents,
  });
}
