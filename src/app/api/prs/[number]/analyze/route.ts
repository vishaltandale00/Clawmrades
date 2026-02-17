import { NextResponse } from "next/server";
import { requireAgent } from "@/lib/auth";
import { db } from "@/lib/db";
import { prQueue, prAnalyses, agents, activityLog } from "@/lib/db/schema";
import { eq, and, sql, inArray } from "drizzle-orm";
import { getRepoConfig } from "@/lib/utils";
import { broadcast } from "@/lib/sse";

const PRIORITY_ORDER = ["urgent", "high", "normal", "low"] as const;

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
  const prNumber = parseInt(number, 10);
  const { owner, name } = getRepoConfig();
  const agentName = agent?.name ?? "dev-agent";

  const body = await request.json();
  const {
    risk_score,
    quality_score,
    review_summary,
    has_tests,
    has_breaking_changes,
    suggested_priority,
    confidence,
  } = body;

  if (
    risk_score == null ||
    quality_score == null ||
    !review_summary ||
    has_tests == null ||
    has_breaking_changes == null ||
    !suggested_priority ||
    confidence == null
  ) {
    return NextResponse.json(
      {
        error:
          "Missing required fields: risk_score, quality_score, review_summary, has_tests, has_breaking_changes, suggested_priority, confidence",
      },
      { status: 400 }
    );
  }

  // Find PR by number + repo config
  const [pr] = await db
    .select()
    .from(prQueue)
    .where(
      and(
        eq(prQueue.repoOwner, owner),
        eq(prQueue.repoName, name),
        eq(prQueue.prNumber, prNumber)
      )
    )
    .limit(1);

  if (!pr) {
    return NextResponse.json({ error: "PR not found" }, { status: 404 });
  }

  // Insert analysis
  const [analysis] = await db
    .insert(prAnalyses)
    .values({
      prId: pr.id,
      agentName,
      riskScore: risk_score,
      qualityScore: quality_score,
      reviewSummary: review_summary,
      hasTests: has_tests,
      hasBreakingChanges: has_breaking_changes,
      suggestedPriority: suggested_priority,
      confidence,
    })
    .returning();

  // Increment analysis_count on pr_queue
  const [updatedPr] = await db
    .update(prQueue)
    .set({
      analysisCount: sql`${prQueue.analysisCount} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(prQueue.id, pr.id))
    .returning();

  // Update agent stats: totalReviewsGenerated += 1
  if (agent) {
    await db
      .update(agents)
      .set({
        totalReviewsGenerated: sql`${agents.totalReviewsGenerated} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(agents.id, agent.id));
  }

  // If analysis_count >= required_analyses, aggregate
  if (updatedPr.analysisCount >= updatedPr.requiredAnalyses) {
    // Get all analyses for this PR
    const allAnalyses = await db
      .select()
      .from(prAnalyses)
      .where(eq(prAnalyses.prId, pr.id));

    // Get agent credibility scores for weighting
    const agentNames = [...new Set(allAnalyses.map((a) => a.agentName))];
    const agentRows = await db
      .select({ name: agents.name, credibilityScore: agents.credibilityScore })
      .from(agents)
      .where(inArray(agents.name, agentNames));

    const credibilityMap = new Map<string, number>();
    for (const a of agentRows) {
      credibilityMap.set(a.name, a.credibilityScore);
    }

    // Credibility-weighted averages
    let totalWeight = 0;
    let weightedRisk = 0;
    let weightedQuality = 0;
    let highestCredibility = 0;
    let bestSummary = allAnalyses[0].reviewSummary;
    let worstPriorityIndex = PRIORITY_ORDER.length - 1;
    let anyBreaking = false;
    let testVoteWeightTrue = 0;
    let testVoteWeightFalse = 0;

    for (const a of allAnalyses) {
      const cred = credibilityMap.get(a.agentName) ?? 0.5;
      totalWeight += cred;
      weightedRisk += a.riskScore * cred;
      weightedQuality += a.qualityScore * cred;

      if (cred > highestCredibility) {
        highestCredibility = cred;
        bestSummary = a.reviewSummary;
      }

      // Worst case priority (lowest index = highest priority)
      const pIndex = PRIORITY_ORDER.indexOf(a.suggestedPriority);
      if (pIndex !== -1 && pIndex < worstPriorityIndex) {
        worstPriorityIndex = pIndex;
      }

      if (a.hasBreakingChanges) {
        anyBreaking = true;
      }

      if (a.hasTests) {
        testVoteWeightTrue += cred;
      } else {
        testVoteWeightFalse += cred;
      }
    }

    const aggregatedRisk = totalWeight > 0 ? weightedRisk / totalWeight : 0;
    const aggregatedQuality =
      totalWeight > 0 ? weightedQuality / totalWeight : 0;
    const aggregatedPriority = PRIORITY_ORDER[worstPriorityIndex];
    const aggregatedHasTests = testVoteWeightTrue >= testVoteWeightFalse;

    await db
      .update(prQueue)
      .set({
        riskScore: aggregatedRisk,
        qualityScore: aggregatedQuality,
        reviewSummary: bestSummary,
        reviewPriority: aggregatedPriority,
        hasBreakingChanges: anyBreaking,
        hasTests: aggregatedHasTests,
        updatedAt: new Date(),
      })
      .where(eq(prQueue.id, pr.id));
  }

  // Log activity
  await db.insert(activityLog).values({
    agentName,
    actionType: "pr_analyzed",
    targetType: "pr",
    targetId: String(pr.id),
    details: { prNumber, riskScore: risk_score, qualityScore: quality_score },
  });

  broadcast("pr_analyzed", { prId: pr.id, prNumber, analysis });

  return NextResponse.json(analysis, { status: 201 });
}
