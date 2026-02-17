import { NextResponse } from "next/server";
import { requireAgent } from "@/lib/auth";
import { db } from "@/lib/db";
import { planComments } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAgent(request);
  } catch (response) {
    return response as NextResponse;
  }

  const { id } = await params;

  const comments = await db
    .select()
    .from(planComments)
    .where(eq(planComments.planId, id))
    .orderBy(asc(planComments.createdAt));

  return NextResponse.json({ items: comments });
}

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

  if (!body.body) {
    return NextResponse.json(
      { error: "Missing required field: body" },
      { status: 400 }
    );
  }

  const [comment] = await db
    .insert(planComments)
    .values({
      planId: id,
      agentId: agent?.name ?? "dev-agent",
      body: body.body,
    })
    .returning();

  return NextResponse.json(comment, { status: 201 });
}
