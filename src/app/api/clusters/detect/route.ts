import { NextResponse } from "next/server";
import { requireMaintainer } from "@/lib/auth";
import { db } from "@/lib/db";
import { trackedIssues } from "@/lib/db/schema";
import { isNotNull, inArray } from "drizzle-orm";
import { getEmbedding, querySimilarIssues } from "@/lib/pinecone";
import { assignIssueToCluster } from "@/lib/clustering";

const CLUSTER_RELATED_THRESHOLD = 0.85;

export async function POST(request: Request) {
  try {
    await requireMaintainer(request);
  } catch (response) {
    return response as NextResponse;
  }

  const { searchParams } = new URL(request.url);
  const assign = searchParams.get("assign") === "true";

  // 1. Fetch all issues that have embeddings stored
  const allEmbedded = await db
    .select({
      id: trackedIssues.id,
      issueNumber: trackedIssues.issueNumber,
      title: trackedIssues.title,
      description: trackedIssues.description,
      summary: trackedIssues.summary,
      body: trackedIssues.body,
      clusterId: trackedIssues.clusterId,
    })
    .from(trackedIssues)
    .where(isNotNull(trackedIssues.embeddingStoredAt));

  // 2. Split into unclustered vs already clustered
  const unclustered = allEmbedded.filter((i) => i.clusterId === null);
  const clustered = allEmbedded.filter((i) => i.clusterId !== null);

  // 3. For each unclustered issue, re-embed and query Pinecone
  let highestScore = 0;
  const issues: Array<{
    id: number;
    issueNumber: number;
    title: string;
    clusterId: string | null;
    topMatches: Array<{
      dbId: number;
      issueNumber: number | null;
      score: number;
      title: string;
    }>;
    meetsThreshold: boolean;
    assignedCluster: string | null;
  }> = [];

  for (const issue of unclustered) {
    const text = issue.description || issue.summary || issue.body || issue.title;

    let embedding: number[];
    try {
      embedding = await getEmbedding(text);
    } catch (err) {
      issues.push({
        id: issue.id,
        issueNumber: issue.issueNumber,
        title: issue.title,
        clusterId: null,
        topMatches: [],
        meetsThreshold: false,
        assignedCluster: null,
      });
      continue;
    }

    // Query Pinecone — returns ALL matches (no threshold filter)
    const results = await querySimilarIssues(embedding, 10);

    // Filter out self-match
    const matches = results.filter((m) => m.dbId !== issue.id);

    // Enrich matches with issue numbers
    const matchDbIds = matches.map((m) => m.dbId);
    let matchedIssueMap = new Map<number, { issueNumber: number; title: string }>();
    if (matchDbIds.length > 0) {
      const matchedRows = await db
        .select({
          id: trackedIssues.id,
          issueNumber: trackedIssues.issueNumber,
          title: trackedIssues.title,
        })
        .from(trackedIssues)
        .where(inArray(trackedIssues.id, matchDbIds));
      for (const row of matchedRows) {
        matchedIssueMap.set(row.id, {
          issueNumber: row.issueNumber,
          title: row.title,
        });
      }
    }

    const topMatches = matches.map((m) => {
      const info = matchedIssueMap.get(m.dbId);
      return {
        dbId: m.dbId,
        issueNumber: info?.issueNumber ?? null,
        score: Math.round(m.score * 10000) / 10000,
        title: info?.title ?? m.metadata?.title ?? "Unknown",
      };
    });

    const bestScore = topMatches.length > 0 ? Math.max(...topMatches.map((m) => m.score)) : 0;
    if (bestScore > highestScore) highestScore = bestScore;

    const meetsThreshold = bestScore >= CLUSTER_RELATED_THRESHOLD;

    // 4. Optionally assign to cluster
    let assignedCluster: string | null = null;
    if (assign && meetsThreshold) {
      try {
        assignedCluster = await assignIssueToCluster(issue.id, embedding, issue.title);
      } catch {
        // non-fatal — report null
      }
    }

    issues.push({
      id: issue.id,
      issueNumber: issue.issueNumber,
      title: issue.title,
      clusterId: null,
      topMatches,
      meetsThreshold,
      assignedCluster,
    });
  }

  // Also include already-clustered issues (brief)
  for (const issue of clustered) {
    issues.push({
      id: issue.id,
      issueNumber: issue.issueNumber,
      title: issue.title,
      clusterId: issue.clusterId,
      topMatches: [],
      meetsThreshold: true,
      assignedCluster: null,
    });
  }

  const qualifyingCount = issues.filter((i) => i.meetsThreshold && !i.clusterId).length;

  const summary =
    qualifyingCount > 0
      ? `${qualifyingCount} issue(s) meet the ${CLUSTER_RELATED_THRESHOLD} threshold. Highest pairwise score: ${highestScore.toFixed(4)}`
      : `No issues meet the ${CLUSTER_RELATED_THRESHOLD} threshold. Highest pairwise score: ${highestScore.toFixed(4)}`;

  return NextResponse.json({
    embeddedCount: allEmbedded.length,
    clusteredCount: clustered.length,
    unclusteredCount: unclustered.length,
    threshold: CLUSTER_RELATED_THRESHOLD,
    highestScore: Math.round(highestScore * 10000) / 10000,
    issues,
    summary,
  });
}
