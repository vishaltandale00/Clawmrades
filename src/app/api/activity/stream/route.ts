import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { activityLog } from "@/lib/db/schema";
import { desc } from "drizzle-orm";

export async function GET() {
  const items = await db
    .select()
    .from(activityLog)
    .orderBy(desc(activityLog.createdAt))
    .limit(20);
  return NextResponse.json({ items });
}
