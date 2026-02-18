import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  issuePriorityToWorkPriority,
  getRepoConfig,
  getWorkQueueConfig,
} from "@/lib/utils";

describe("issuePriorityToWorkPriority", () => {
  it("returns 50 for null", () => {
    expect(issuePriorityToWorkPriority(null)).toBe(50);
  });

  it("returns 50 for undefined", () => {
    expect(issuePriorityToWorkPriority(undefined)).toBe(50);
  });

  it("clamps 0 to 1 via Math.max", () => {
    expect(issuePriorityToWorkPriority(0)).toBe(1);
  });

  it("maps 0.5 to 50", () => {
    expect(issuePriorityToWorkPriority(0.5)).toBe(50);
  });

  it("maps 1.0 to 100", () => {
    expect(issuePriorityToWorkPriority(1.0)).toBe(100);
  });

  it("rounds 0.123 to 12", () => {
    expect(issuePriorityToWorkPriority(0.123)).toBe(12);
  });

  it("rounds 0.126 to 13", () => {
    expect(issuePriorityToWorkPriority(0.126)).toBe(13);
  });

  it("does not upper clamp: 1.5 maps to 150", () => {
    expect(issuePriorityToWorkPriority(1.5)).toBe(150);
  });
});

describe("getRepoConfig", () => {
  const origOwner = process.env.REPO_OWNER;
  const origName = process.env.REPO_NAME;

  afterEach(() => {
    if (origOwner !== undefined) process.env.REPO_OWNER = origOwner;
    else delete process.env.REPO_OWNER;
    if (origName !== undefined) process.env.REPO_NAME = origName;
    else delete process.env.REPO_NAME;
  });

  it("returns env vars when both are set", () => {
    process.env.REPO_OWNER = "acme";
    process.env.REPO_NAME = "widgets";
    expect(getRepoConfig()).toEqual({ owner: "acme", name: "widgets" });
  });

  it('returns empty strings when neither is set', () => {
    delete process.env.REPO_OWNER;
    delete process.env.REPO_NAME;
    expect(getRepoConfig()).toEqual({ owner: "", name: "" });
  });
});

describe("getWorkQueueConfig", () => {
  const envKeys = [
    "REQUIRED_TRIAGES",
    "REQUIRED_PR_ANALYSES",
    "MAX_CONCURRENT_CLAIMS",
    "WORK_CLAIM_TIMEOUT_MINUTES",
  ] as const;

  const originals: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of envKeys) {
      originals[k] = process.env[k];
    }
  });

  afterEach(() => {
    for (const k of envKeys) {
      if (originals[k] !== undefined) process.env[k] = originals[k];
      else delete process.env[k];
    }
  });

  it("returns defaults when no env vars set", () => {
    for (const k of envKeys) delete process.env[k];
    expect(getWorkQueueConfig()).toEqual({
      requiredTriages: 3,
      requiredPrAnalyses: 3,
      maxConcurrentClaims: 3,
      claimTimeoutMinutes: 30,
    });
  });

  it("returns custom values when all overridden", () => {
    process.env.REQUIRED_TRIAGES = "5";
    process.env.REQUIRED_PR_ANALYSES = "7";
    process.env.MAX_CONCURRENT_CLAIMS = "10";
    process.env.WORK_CLAIM_TIMEOUT_MINUTES = "60";
    expect(getWorkQueueConfig()).toEqual({
      requiredTriages: 5,
      requiredPrAnalyses: 7,
      maxConcurrentClaims: 10,
      claimTimeoutMinutes: 60,
    });
  });

  it("returns NaN for non-numeric input (documents lack of validation)", () => {
    process.env.REQUIRED_TRIAGES = "abc";
    const config = getWorkQueueConfig();
    expect(config.requiredTriages).toBeNaN();
  });
});
