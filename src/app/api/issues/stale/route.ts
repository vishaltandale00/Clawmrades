import { NextResponse } from "next/server";
import { requireAgent } from "@/lib/auth";
import { db } from "@/lib/db";
import { trackedIssues } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(request: Request) {
  try {
    await requireAgent(request);
  } catch (response) {
    return response as NextResponse;
  }

  const issues = await db
    .select()
    .from(trackedIssues)
    .where(eq(trackedIssues.isStale, true))
    .orderBy(desc(trackedIssues.stalenessDays));

  return NextResponse.json({ items: issues });
}
