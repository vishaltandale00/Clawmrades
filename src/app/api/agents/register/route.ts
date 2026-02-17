import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { agents } from "@/lib/db/schema";

export async function POST(request: Request) {
  // Check registration token if configured
  const registrationToken = process.env.REGISTRATION_TOKEN;
  if (registrationToken) {
    const provided = request.headers.get("X-Registration-Token");
    if (provided !== registrationToken) {
      return NextResponse.json(
        { error: "Invalid or missing registration token" },
        { status: 403 }
      );
    }
  }

  const body = await request.json();
  const { name, description, owner_email, owner_github } = body;

  if (!name || typeof name !== "string") {
    return NextResponse.json(
      { error: "name is required" },
      { status: 400 }
    );
  }

  // Generate API key and hash
  const apiKey = "clw_" + nanoid(40);
  const apiKeyHash = createHash("sha256").update(apiKey).digest("hex");
  const apiKeyPrefix = apiKey.slice(0, 8);

  try {
    const [agent] = await db
      .insert(agents)
      .values({
        name,
        description: description ?? null,
        ownerEmail: owner_email ?? null,
        ownerGithub: owner_github ?? null,
        apiKeyHash,
        apiKeyPrefix,
      })
      .returning({
        id: agents.id,
        name: agents.name,
        apiKeyPrefix: agents.apiKeyPrefix,
      });

    return NextResponse.json(
      {
        id: agent.id,
        name: agent.name,
        api_key: apiKey,
        api_key_prefix: agent.apiKeyPrefix,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown error";

    if (message.includes("unique") || message.includes("duplicate")) {
      return NextResponse.json(
        { error: "Agent name already exists" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Failed to register agent" },
      { status: 500 }
    );
  }
}
