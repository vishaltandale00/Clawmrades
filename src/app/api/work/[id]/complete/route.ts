import { NextResponse } from "next/server";
import { requireAgent } from "@/lib/auth";
import { db } from "@/lib/db";
import { workQueue } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let agent;
  try {
    agent = await requireAgent(request);
  } catch (response) {
    return response as NextResponse;
  }

  const { id } = await params;
  const body = await request.json();

  const [item] = await db
    .select()
    .from(workQueue)
    .where(eq(workQueue.id, id))
    .limit(1);

  if (!item) {
    return NextResponse.json(
      { error: "Work item not found" },
      { status: 404 }
    );
  }

  const agentName = agent?.name ?? "dev-agent";

  if (item.claimedBy !== agentName) {
    return NextResponse.json(
      { error: "Work item is not claimed by you" },
      { status: 403 }
    );
  }

  const [updated] = await db
    .update(workQueue)
    .set({
      status: "completed",
      completedAt: new Date(),
      resultSummary: body.result_summary ?? null,
      updatedAt: new Date(),
    })
    .where(eq(workQueue.id, id))
    .returning();

  return NextResponse.json(updated);
}
