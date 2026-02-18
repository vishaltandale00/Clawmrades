import { NextResponse } from "next/server";
import { requireMaintainer } from "@/lib/auth";
import { db } from "@/lib/db";
import { plans, agents } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";


export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireMaintainer(request);
  } catch (response) {
    return response as NextResponse;
  }

  const { id } = await params;

  const [plan] = await db.select().from(plans).where(eq(plans.id, id)).limit(1);

  if (!plan) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }

  const [updated] = await db
    .update(plans)
    .set({
      status: "approved",
      maintainerApproved: true,
      updatedAt: new Date(),
    })
    .where(eq(plans.id, id))
    .returning();

  // Update author agent stats
  await db
    .update(agents)
    .set({
      plansApproved: sql`${agents.plansApproved} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(agents.name, plan.authorAgentId));

  return NextResponse.json(updated);
}
