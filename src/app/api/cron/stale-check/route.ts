import { NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/auth";
import { db } from "@/lib/db";
import { trackedIssues } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Recalculate staleness_days for all open issues
  const result = await db
    .update(trackedIssues)
    .set({
      stalenessDays: sql`EXTRACT(DAY FROM NOW() - ${trackedIssues.updatedAtGithub})::integer`,
      isStale: sql`EXTRACT(DAY FROM NOW() - ${trackedIssues.updatedAtGithub}) > 14`,
      updatedAt: new Date(),
    })
    .where(eq(trackedIssues.state, "open"))
    .returning();

  return NextResponse.json({
    updated: result.length,
    stale: result.filter((r) => r.isStale).length,
  });
}
