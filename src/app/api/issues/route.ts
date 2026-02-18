import { NextResponse } from "next/server";
import { requireAgent } from "@/lib/auth";
import { db } from "@/lib/db";
import { trackedIssues } from "@/lib/db/schema";
import { eq, desc, asc, sql, count, and, or, ilike } from "drizzle-orm";

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

  const status = url.searchParams.get("status");
  const state = url.searchParams.get("state");
  const isStale = url.searchParams.get("is_stale");
  const sort = url.searchParams.get("sort") ?? "created_at";
  const search = url.searchParams.get("search");

  // Build filter conditions
  const conditions = [];

  if (search) {
    const term = `%${search}%`;
    conditions.push(
      or(
        ilike(trackedIssues.title, term),
        ilike(trackedIssues.body, term)
      )
    );
  }
  if (status) {
    conditions.push(eq(trackedIssues.triageStatus, status as "pending" | "triaged" | "needs_human" | "dismissed"));
  }
  if (state) {
    conditions.push(eq(trackedIssues.state, state));
  }
  if (isStale !== null && isStale !== undefined && isStale !== "") {
    conditions.push(eq(trackedIssues.isStale, isStale === "true"));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Determine sort column and direction
  let orderBy;
  switch (sort) {
    case "priority_score":
      orderBy = desc(trackedIssues.priorityScore);
      break;
    case "staleness_days":
      orderBy = desc(trackedIssues.stalenessDays);
      break;
    case "created_at":
    default:
      orderBy = desc(trackedIssues.createdAt);
      break;
  }

  const [items, [{ total }]] = await Promise.all([
    db
      .select()
      .from(trackedIssues)
      .where(whereClause)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset),
    db
      .select({ total: count() })
      .from(trackedIssues)
      .where(whereClause),
  ]);

  return NextResponse.json({
    items,
    total,
    page,
    limit,
  });
}
