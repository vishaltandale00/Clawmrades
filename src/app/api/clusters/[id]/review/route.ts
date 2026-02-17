import { NextResponse } from "next/server";
import { requireMaintainer } from "@/lib/auth";
import { db } from "@/lib/db";
import { issueClusters, trackedIssues } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

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
  const body = await request.json();
  const { action } = body;

  if (!action || !["merged", "dismissed", "split"].includes(action)) {
    return NextResponse.json(
      { error: "Invalid action. Must be one of: merged, dismissed, split" },
      { status: 400 }
    );
  }

  const [cluster] = await db
    .select()
    .from(issueClusters)
    .where(eq(issueClusters.id, id))
    .limit(1);

  if (!cluster) {
    return NextResponse.json({ error: "Cluster not found" }, { status: 404 });
  }

  // Update cluster with review info
  const [updated] = await db
    .update(issueClusters)
    .set({
      maintainerReviewed: true,
      maintainerAction: action,
      updatedAt: new Date(),
    })
    .where(eq(issueClusters.id, id))
    .returning();

  if (action === "dismissed") {
    // Clear cluster_id from all member issues
    await db
      .update(trackedIssues)
      .set({ clusterId: null, updatedAt: new Date() })
      .where(eq(trackedIssues.clusterId, id));
  }

  if (action === "merged") {
    // Keep canonical (representative) issue, dismiss duplicates
    // The representative issue stays, others get marked as part of the merged cluster
    // No cluster_id changes needed — they remain linked to the reviewed cluster
  }

  return NextResponse.json(updated);
}
