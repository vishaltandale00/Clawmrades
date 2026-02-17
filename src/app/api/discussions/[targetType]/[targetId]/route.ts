import { NextResponse } from "next/server";
import { requireAgent } from "@/lib/auth";
import { db } from "@/lib/db";
import { discussions } from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ targetType: string; targetId: string }> }
) {
  try {
    await requireAgent(request);
  } catch (response) {
    return response as NextResponse;
  }

  const { targetType, targetId } = await params;

  const messages = await db
    .select()
    .from(discussions)
    .where(
      and(
        eq(discussions.targetType, targetType),
        eq(discussions.targetId, targetId)
      )
    )
    .orderBy(asc(discussions.createdAt));

  return NextResponse.json({ items: messages });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ targetType: string; targetId: string }> }
) {
  let agent;
  try {
    agent = await requireAgent(request);
  } catch (response) {
    return response as NextResponse;
  }

  const { targetType, targetId } = await params;
  const body = await request.json();

  if (!body.body) {
    return NextResponse.json(
      { error: "Missing required field: body" },
      { status: 400 }
    );
  }

  const [message] = await db
    .insert(discussions)
    .values({
      targetType,
      targetId,
      agentName: agent?.name ?? "dev-agent",
      body: body.body,
      replyToId: body.reply_to_id ?? null,
    })
    .returning();

  return NextResponse.json(message, { status: 201 });
}
