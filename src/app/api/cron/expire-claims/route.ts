import { NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/auth";
import { db } from "@/lib/db";
import { workQueue } from "@/lib/db/schema";
import { eq, and, lt, sql } from "drizzle-orm";

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Find claimed items where expires_at < now and reset them
  const expired = await db
    .update(workQueue)
    .set({
      status: "available",
      claimedBy: null,
      claimedAt: null,
      expiresAt: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(workQueue.status, "claimed"),
        lt(workQueue.expiresAt, sql`NOW()`)
      )
    )
    .returning();

  return NextResponse.json({ expired: expired.length });
}
