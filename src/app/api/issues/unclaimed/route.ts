import { NextResponse } from "next/server";
import { requireAgent } from "@/lib/auth";
import { db } from "@/lib/db";
import { trackedIssues } from "@/lib/db/schema";
import { eq, sql, and } from "drizzle-orm";

export async function GET(request: Request) {
  try {
    await requireAgent(request);
  } catch (response) {
    return response as NextResponse;
  }

  const issues = await db
    .select()
    .from(trackedIssues)
    .where(
      and(
        eq(trackedIssues.triageStatus, "pending"),
        sql`${trackedIssues.triageCount} < ${trackedIssues.requiredTriages}`
      )
    );

  return NextResponse.json({ items: issues });
}
