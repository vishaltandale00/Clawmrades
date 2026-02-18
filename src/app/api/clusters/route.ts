import { NextResponse } from "next/server";
import { requireAgent } from "@/lib/auth";
import { db } from "@/lib/db";
import { issueClusters, trackedIssues, activityLog } from "@/lib/db/schema";
import { eq, desc, sql } from "drizzle-orm";


export async function GET(request: Request) {
  try {
    await requireAgent(request);
  } catch (response) {
    return response as NextResponse;
  }

  const clusters = await db
    .select({
      id: issueClusters.id,
      title: issueClusters.title,
      summary: issueClusters.summary,
      category: issueClusters.category,
      representativeIssueId: issueClusters.representativeIssueId,
      issueCount: issueClusters.issueCount,
      createdBy: issueClusters.createdBy,
      confidenceScore: issueClusters.confidenceScore,
      maintainerReviewed: issueClusters.maintainerReviewed,
      maintainerAction: issueClusters.maintainerAction,
      createdAt: issueClusters.createdAt,
      updatedAt: issueClusters.updatedAt,
      memberCount: sql<number>`count(${trackedIssues.id})`.as("member_count"),
    })
    .from(issueClusters)
    .leftJoin(trackedIssues, eq(trackedIssues.clusterId, issueClusters.id))
    .groupBy(issueClusters.id)
    .orderBy(desc(issueClusters.createdAt));

  return NextResponse.json({ items: clusters });
}

export async function POST(request: Request) {
  let agent;
  try {
    agent = await requireAgent(request);
  } catch (response) {
    return response as NextResponse;
  }

  const body = await request.json();
  const { title, summary, category, issue_ids, confidence_score } = body;

  if (!title || !summary || !category || !issue_ids || confidence_score == null) {
    return NextResponse.json(
      { error: "Missing required fields: title, summary, category, issue_ids, confidence_score" },
      { status: 400 }
    );
  }

  const agentName = agent?.name ?? "dev-agent";

  // Insert the cluster
  const [cluster] = await db
    .insert(issueClusters)
    .values({
      title,
      summary,
      category,
      createdBy: agentName,
      confidenceScore: confidence_score,
      issueCount: issue_ids.length,
    })
    .returning();

  // Update tracked issues to set cluster_id
  if (issue_ids.length > 0) {
    for (const issueId of issue_ids) {
      await db
        .update(trackedIssues)
        .set({ clusterId: cluster.id, updatedAt: new Date() })
        .where(eq(trackedIssues.id, issueId));
    }
  }

  // Log activity
  await db.insert(activityLog).values({
    agentName,
    actionType: "cluster_created",
    targetType: "cluster",
    targetId: cluster.id,
    details: { title, category, issueCount: issue_ids.length },
  });

  return NextResponse.json(cluster, { status: 201 });
}
