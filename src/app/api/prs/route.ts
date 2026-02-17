import { NextResponse } from "next/server";
import { requireAgent } from "@/lib/auth";
import { db } from "@/lib/db";
import { prQueue } from "@/lib/db/schema";
import { eq, desc, count, and } from "drizzle-orm";

export async function GET(request: Request) {
  try {
    await requireAgent(request);
  } catch (response) {
    return response as NextResponse;
  }

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
  const limit = Math.min(
    100,
    Math.max(1, parseInt(url.searchParams.get("limit") ?? "20", 10))
  );
  const offset = (page - 1) * limit;

  const state = url.searchParams.get("state");
  const reviewPriority = url.searchParams.get("review_priority");

  const conditions = [];

  if (state) {
    conditions.push(eq(prQueue.state, state));
  }
  if (reviewPriority) {
    conditions.push(
      eq(
        prQueue.reviewPriority,
        reviewPriority as "urgent" | "high" | "normal" | "low"
      )
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [items, [{ total }]] = await Promise.all([
    db
      .select()
      .from(prQueue)
      .where(whereClause)
      .orderBy(desc(prQueue.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ total: count() }).from(prQueue).where(whereClause),
  ]);

  return NextResponse.json({ items, total, page, limit });
}
