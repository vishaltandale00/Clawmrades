import { NextResponse } from "next/server";
import { requireAgent } from "@/lib/auth";
import { db } from "@/lib/db";
import { trackedIssues } from "@/lib/db/schema";
import { getEmbedding, querySimilarIssues } from "@/lib/pinecone";

interface IssueRow {
  id: number;
  issueNumber: number;
  title: string;
  description: string | null;
  state: string;
  triageStatus: string;
}

export async function POST(request: Request) {
  try {
    await requireAgent(request);
  } catch (response) {
    return response as NextResponse;
  }

  const body = await request.json();
  const { description, top_k } = body;

  if (!description || typeof description !== "string") {
    return NextResponse.json(
      { error: "Missing required field: description" },
      { status: 400 }
    );
  }

  const topK = Math.min(Math.max(top_k ?? 10, 1), 50);

  const embedding = await getEmbedding(description);
  const matches = await querySimilarIssues(embedding, topK);

  // Fetch full issue data for matched IDs
  const issueMap = new Map<number, IssueRow>();

  if (matches.length > 0) {
    const issueRows = await db
      .select({
        id: trackedIssues.id,
        issueNumber: trackedIssues.issueNumber,
        title: trackedIssues.title,
        description: trackedIssues.description,
        state: trackedIssues.state,
        triageStatus: trackedIssues.triageStatus,
      })
      .from(trackedIssues);

    for (const row of issueRows) {
      issueMap.set(row.id, row);
    }
  }

  const items = matches
    .map((m) => {
      const issue = issueMap.get(m.dbId);
      if (!issue) return null;
      return {
        issue_id: m.dbId,
        issue_number: issue.issueNumber,
        title: issue.title,
        score: m.score,
        description: issue.description,
        state: issue.state,
        triage_status: issue.triageStatus,
      };
    })
    .filter(Boolean);

  return NextResponse.json({ items });
}
