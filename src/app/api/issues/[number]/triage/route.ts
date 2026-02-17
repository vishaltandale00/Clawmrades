import { NextResponse } from "next/server";
import { requireAgent } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  trackedIssues,
  issueTriages,
  agents,
  activityLog,
} from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { getRepoConfig, getWorkQueueConfig } from "@/lib/utils";
import { broadcast } from "@/lib/sse";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ number: string }> }
) {
  let agent;
  try {
    agent = await requireAgent(request);
  } catch (response) {
    return response as NextResponse;
  }

  const { number } = await params;
  const issueNumber = parseInt(number, 10);

  if (isNaN(issueNumber)) {
    return NextResponse.json(
      { error: "Invalid issue number" },
      { status: 400 }
    );
  }

  const body = await request.json();
  const { suggested_labels, priority_score, priority_label, summary, confidence } = body;

  if (
    !priority_label ||
    priority_score === undefined ||
    !summary ||
    confidence === undefined
  ) {
    return NextResponse.json(
      { error: "Missing required fields: priority_score, priority_label, summary, confidence" },
      { status: 400 }
    );
  }

  const { owner, name } = getRepoConfig();
  const { requiredTriages } = getWorkQueueConfig();

  // Find the tracked issue
  const [issue] = await db
    .select()
    .from(trackedIssues)
    .where(
      and(
        eq(trackedIssues.repoOwner, owner),
        eq(trackedIssues.repoName, name),
        eq(trackedIssues.issueNumber, issueNumber)
      )
    )
    .limit(1);

  if (!issue) {
    return NextResponse.json({ error: "Issue not found" }, { status: 404 });
  }

  const agentName = agent?.name ?? "dev-agent";

  // Insert triage record
  const [triage] = await db
    .insert(issueTriages)
    .values({
      issueId: issue.id,
      agentName,
      suggestedLabels: suggested_labels ?? [],
      priorityScore: priority_score,
      priorityLabel: priority_label,
      summary,
      confidence,
    })
    .returning();

  // Increment triage_count on tracked issue
  await db
    .update(trackedIssues)
    .set({
      triageCount: sql`${trackedIssues.triageCount} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(trackedIssues.id, issue.id));

  // Update agent stats
  if (agent) {
    await db
      .update(agents)
      .set({
        totalTriages: sql`${agents.totalTriages} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(agents.id, agent.id));
  }

  const newTriageCount = issue.triageCount + 1;

  // If we have enough triages, run aggregation
  if (newTriageCount >= requiredTriages) {
    // Get all triages for this issue
    const allTriages = await db
      .select()
      .from(issueTriages)
      .where(eq(issueTriages.issueId, issue.id));

    // Get each agent's credibility score
    const agentNames = [...new Set(allTriages.map((t) => t.agentName))];
    const agentRows = await db
      .select({ name: agents.name, credibilityScore: agents.credibilityScore })
      .from(agents);

    const credibilityMap = new Map<string, number>();
    for (const a of agentRows) {
      credibilityMap.set(a.name, a.credibilityScore);
    }

    // Default credibility for unknown agents
    const getCredibility = (name: string) => credibilityMap.get(name) ?? 0.5;

    // Weighted average for priority_score
    let totalWeight = 0;
    let weightedPriorityScore = 0;
    for (const t of allTriages) {
      const w = getCredibility(t.agentName);
      weightedPriorityScore += t.priorityScore * w;
      totalWeight += w;
    }
    const avgPriorityScore = totalWeight > 0 ? weightedPriorityScore / totalWeight : 0;

    // Credibility-weighted mode for priority_label
    const labelWeights = new Map<string, number>();
    for (const t of allTriages) {
      const w = getCredibility(t.agentName);
      labelWeights.set(
        t.priorityLabel,
        (labelWeights.get(t.priorityLabel) ?? 0) + w
      );
    }
    let bestLabel = "";
    let bestLabelWeight = 0;
    for (const [label, weight] of labelWeights) {
      if (weight > bestLabelWeight) {
        bestLabelWeight = weight;
        bestLabel = label;
      }
    }

    // Auto labels: keep labels suggested by agents whose credibility sums > 50% of total credibility
    const totalCredibility = allTriages.reduce(
      (sum, t) => sum + getCredibility(t.agentName),
      0
    );
    const labelCredibility = new Map<string, number>();
    for (const t of allTriages) {
      const w = getCredibility(t.agentName);
      for (const label of t.suggestedLabels) {
        labelCredibility.set(label, (labelCredibility.get(label) ?? 0) + w);
      }
    }
    const autoLabels: string[] = [];
    for (const [label, cred] of labelCredibility) {
      if (cred > totalCredibility * 0.5) {
        autoLabels.push(label);
      }
    }

    // Summary: use the summary from the highest-credibility agent
    let bestSummary = "";
    let bestCredibility = -1;
    for (const t of allTriages) {
      const cred = getCredibility(t.agentName);
      if (cred > bestCredibility) {
        bestCredibility = cred;
        bestSummary = t.summary;
      }
    }

    // Update tracked issue with aggregated values
    await db
      .update(trackedIssues)
      .set({
        priorityScore: avgPriorityScore,
        priorityLabel: bestLabel,
        autoLabels,
        summary: bestSummary,
        triageStatus: "triaged",
        updatedAt: new Date(),
      })
      .where(eq(trackedIssues.id, issue.id));
  }

  // Log activity
  await db.insert(activityLog).values({
    agentName,
    actionType: "triage_submitted",
    targetType: "issue",
    targetId: issueNumber.toString(),
    details: {
      priorityScore: priority_score,
      priorityLabel: priority_label,
      confidence,
      triageCount: newTriageCount,
      aggregated: newTriageCount >= requiredTriages,
    },
  });

  broadcast("issue_triaged", {
    issueNumber,
    agentName,
    triageCount: newTriageCount,
    aggregated: newTriageCount >= requiredTriages,
  });

  return NextResponse.json(triage);
}
