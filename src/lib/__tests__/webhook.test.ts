import { describe, it, expect, afterEach } from "vitest";
import { createHmac } from "crypto";
import { verifyWebhookSignature } from "@/lib/webhook";

describe("verifyWebhookSignature", () => {
  const origSecret = process.env.GITHUB_WEBHOOK_SECRET;
  const origEnv = process.env.ENVIRONMENT;

  afterEach(() => {
    if (origSecret !== undefined) process.env.GITHUB_WEBHOOK_SECRET = origSecret;
    else delete process.env.GITHUB_WEBHOOK_SECRET;
    if (origEnv !== undefined) process.env.ENVIRONMENT = origEnv;
    else delete process.env.ENVIRONMENT;
  });

  function sign(payload: string, secret: string): string {
    return (
      "sha256=" + createHmac("sha256", secret).update(payload).digest("hex")
    );
  }

  it("returns true for valid HMAC signature", () => {
    process.env.GITHUB_WEBHOOK_SECRET = "webhook-secret";
    const payload = '{"action":"opened"}';
    const sig = sign(payload, "webhook-secret");
    expect(verifyWebhookSignature(payload, sig)).toBe(true);
  });

  it("returns false for invalid signature", () => {
    process.env.GITHUB_WEBHOOK_SECRET = "webhook-secret";
    const payload = '{"action":"opened"}';
    const sig = sign(payload, "wrong-secret");
    expect(verifyWebhookSignature(payload, sig)).toBe(false);
  });

  it("returns false for length mismatch (triggers timingSafeEqual throw)", () => {
    process.env.GITHUB_WEBHOOK_SECRET = "webhook-secret";
    expect(verifyWebhookSignature("payload", "short")).toBe(false);
  });

  it("returns true in dev mode when no secret is set", () => {
    delete process.env.GITHUB_WEBHOOK_SECRET;
    delete process.env.ENVIRONMENT;
    expect(verifyWebhookSignature("payload", "any")).toBe(true);
  });

  it("returns false in production when no secret is set", () => {
    delete process.env.GITHUB_WEBHOOK_SECRET;
    process.env.ENVIRONMENT = "production";
    expect(verifyWebhookSignature("payload", "any")).toBe(false);
  });
});
