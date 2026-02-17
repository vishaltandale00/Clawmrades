import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    await requireAdmin(request);
  } catch (response) {
    return response as NextResponse;
  }

  return NextResponse.json({ message: "Cluster detection triggered" });
}
