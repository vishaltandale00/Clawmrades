import { db } from "@/lib/db";
import {
  trackedIssues,
  prQueue,
  issueClusters,
  plans,
  agents,
  activityLog,
} from "@/lib/db/schema";
import { eq, count, and, isNull, inArray } from "drizzle-orm";
import { desc } from "drizzle-orm";
import { OverviewCards } from "@/components/overview-cards";
import { ActivityFeed } from "@/components/activity-feed";
import type { DashboardOverview } from "@/types";

export const dynamic = "force-dynamic";

async function getOverview(): Promise<DashboardOverview> {
  const [
    [openIssues],
    [pendingTriages],
    [prsNeedReview],
    [activeClusters],
    [pendingPlans],
    [activeAgents],
  ] = await Promise.all([
    db
      .select({ count: count() })
      .from(trackedIssues)
      .where(eq(trackedIssues.state, "open")),
    db
      .select({ count: count() })
      .from(trackedIssues)
      .where(eq(trackedIssues.triageStatus, "pending")),
    db
      .select({ count: count() })
      .from(prQueue)
      .where(and(eq(prQueue.state, "open"), isNull(prQueue.maintainerDecision))),
    db
      .select({ count: count() })
      .from(issueClusters)
      .where(eq(issueClusters.maintainerReviewed, false)),
    db
      .select({ count: count() })
      .from(plans)
      .where(inArray(plans.status, ["draft", "ready"])),
    db
      .select({ count: count() })
      .from(agents)
      .where(eq(agents.status, "active")),
  ]);

  return {
    open_issues: Number(openIssues.count),
    pending_triages: Number(pendingTriages.count),
    prs_needing_review: Number(prsNeedReview.count),
    active_clusters: Number(activeClusters.count),
    pending_plans: Number(pendingPlans.count),
    active_agents: Number(activeAgents.count),
  };
}

async function getRecentActivity() {
  const items = await db
    .select()
    .from(activityLog)
    .orderBy(desc(activityLog.createdAt))
    .limit(20);

  return items.map((i) => ({
    id: i.id,
    agent_name: i.agentName,
    action_type: i.actionType,
    target_type: i.targetType,
    target_id: i.targetId,
    details: i.details as Record<string, unknown> | null,
    created_at: i.createdAt.toISOString(),
  }));
}

export default async function OverviewPage() {
  const [overview, activity] = await Promise.all([
    getOverview(),
    getRecentActivity(),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <OverviewCards data={overview} />
      <ActivityFeed initialItems={activity} />
    </div>
  );
}
