import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { nanoid } from "nanoid";
import { requireAgent } from "@/lib/auth";
import { db } from "@/lib/db";
import { agents } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let caller;
  try {
    caller = await requireAgent(request);
  } catch (response) {
    return response as NextResponse;
  }

  const { id } = await params;

  // Verify the caller is either the agent themselves or an admin
  if (caller && caller.id !== id && !caller.isAdmin) {
    return NextResponse.json(
      { error: "You can only rotate your own key, or must be an admin" },
      { status: 403 }
    );
  }

  // Verify the target agent exists
  const [target] = await db
    .select({ id: agents.id, name: agents.name })
    .from(agents)
    .where(eq(agents.id, id))
    .limit(1);

  if (!target) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  // Generate new API key
  const apiKey = "clw_" + nanoid(40);
  const apiKeyHash = createHash("sha256").update(apiKey).digest("hex");
  const apiKeyPrefix = apiKey.slice(0, 8);

  await db
    .update(agents)
    .set({ apiKeyHash, apiKeyPrefix, updatedAt: new Date() })
    .where(eq(agents.id, id));

  return NextResponse.json({
    id: target.id,
    name: target.name,
    api_key: apiKey,
    api_key_prefix: apiKeyPrefix,
  });
}
