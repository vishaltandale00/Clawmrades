import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { activityLog } from "@/lib/db/schema";
import { desc } from "drizzle-orm";

export async function GET() {
  const rows = await db
    .select()
    .from(activityLog)
    .orderBy(desc(activityLog.createdAt))
    .limit(20);

  const items = rows.map((i) => ({
    id: i.id,
    agent_name: i.agentName,
    action_type: i.actionType,
    target_type: i.targetType,
    target_id: i.targetId,
    details: i.details,
    created_at: i.createdAt.toISOString(),
  }));

  return NextResponse.json({ items });
}
