import { NextResponse } from "next/server";
import { requireAgent } from "@/lib/auth";
import { db } from "@/lib/db";
import { prQueue } from "@/lib/db/schema";
import { getEmbedding, querySimilarPrs } from "@/lib/pinecone";

interface PrRow {
  id: number;
  prNumber: number;
  title: string;
  description: string | null;
  state: string;
  reviewPriority: string;
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
  const matches = await querySimilarPrs(embedding, topK);

  // Fetch full PR data for matched IDs
  const prMap = new Map<number, PrRow>();

  if (matches.length > 0) {
    const prRows = await db
      .select({
        id: prQueue.id,
        prNumber: prQueue.prNumber,
        title: prQueue.title,
        description: prQueue.description,
        state: prQueue.state,
        reviewPriority: prQueue.reviewPriority,
      })
      .from(prQueue);

    for (const row of prRows) {
      prMap.set(row.id, row);
    }
  }

  const items = matches
    .map((m) => {
      const pr = prMap.get(m.dbId);
      if (!pr) return null;
      return {
        pr_id: m.dbId,
        pr_number: pr.prNumber,
        title: pr.title,
        score: m.score,
        description: pr.description,
        state: pr.state,
        review_priority: pr.reviewPriority,
      };
    })
    .filter(Boolean);

  return NextResponse.json({ items });
}
