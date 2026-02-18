import { NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/auth";
import { generateWork } from "@/lib/generate-work";

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { created } = await generateWork();

  return NextResponse.json({ created });
}
