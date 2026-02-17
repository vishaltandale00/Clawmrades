import { NextResponse } from "next/server";
import { requireAgent } from "@/lib/auth";
import { db } from "@/lib/db";
import { prQueue } from "@/lib/db/schema";
import { desc, sql } from "drizzle-orm";

export async function GET(request: Request) {
  try {
    await requireAgent(request);
  } catch (response) {
    return response as NextResponse;
  }

  // Priority-sorted queue: urgent > high > normal > low, then risk_score desc
  const items = await db
    .select()
    .from(prQueue)
    .orderBy(
      sql`CASE ${prQueue.reviewPriority}
        WHEN 'urgent' THEN 0
        WHEN 'high' THEN 1
        WHEN 'normal' THEN 2
        WHEN 'low' THEN 3
        ELSE 4
      END`,
      desc(prQueue.riskScore)
    );

  return NextResponse.json({ items });
}
