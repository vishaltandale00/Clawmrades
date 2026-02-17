import { NextResponse } from "next/server";
import { requireAgent } from "@/lib/auth";
import { db } from "@/lib/db";
import { planVotes } from "@/lib/db/schema";

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

  if (!body.decision || !["ready", "not_ready"].includes(body.decision)) {
    return NextResponse.json(
      { error: "Invalid or missing decision. Must be 'ready' or 'not_ready'" },
      { status: 400 }
    );
  }

  const [vote] = await db
    .insert(planVotes)
    .values({
      planId: id,
      agentId: agent?.name ?? "dev-agent",
      decision: body.decision,
      reason: body.reason ?? null,
    })
    .returning();

  return NextResponse.json(vote, { status: 201 });
}
