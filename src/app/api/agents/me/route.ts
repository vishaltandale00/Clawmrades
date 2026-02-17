import { NextResponse } from "next/server";
import { requireAgent } from "@/lib/auth";

export async function GET(request: Request) {
  let agent;
  try {
    agent = await requireAgent(request);
  } catch (response) {
    return response as NextResponse;
  }

  if (!agent) {
    return NextResponse.json(
      { error: "Not authenticated (dev mode)" },
      { status: 401 }
    );
  }

  // Exclude apiKeyHash from response
  const { apiKeyHash, ...agentInfo } = agent;

  return NextResponse.json(agentInfo);
}
