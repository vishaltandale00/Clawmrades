import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { agents } from "@/lib/db/schema";
import { count, desc } from "drizzle-orm";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
  } catch (response) {
    return response as NextResponse;
  }

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
  const limit = Math.min(
    100,
    Math.max(1, parseInt(url.searchParams.get("limit") ?? "20", 10))
  );
  const offset = (page - 1) * limit;

  const [agentRows, [{ total }]] = await Promise.all([
    db
      .select()
      .from(agents)
      .orderBy(desc(agents.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ total: count() }).from(agents),
  ]);

  return NextResponse.json({
    agents: agentRows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}
