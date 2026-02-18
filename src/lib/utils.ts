import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getRepoConfig() {
  return {
    owner: process.env.REPO_OWNER ?? "",
    name: process.env.REPO_NAME ?? "",
  };
}

/**
 * Maps an issue's priority_score (0-1 float) to a work queue priority integer.
 * Untriaged issues (null score) get default 50.
 * Triaged issues get 1-100 based on their score, so high-priority issues are picked first.
 */
export function issuePriorityToWorkPriority(priorityScore: number | null | undefined): number {
  if (priorityScore == null) return 50;
  return Math.max(1, Math.round(priorityScore * 100));
}

export function getWorkQueueConfig() {
  return {
    requiredTriages: parseInt(process.env.REQUIRED_TRIAGES ?? "3", 10),
    requiredPrAnalyses: parseInt(process.env.REQUIRED_PR_ANALYSES ?? "3", 10),
    maxConcurrentClaims: parseInt(process.env.MAX_CONCURRENT_CLAIMS ?? "3", 10),
    claimTimeoutMinutes: parseInt(
      process.env.WORK_CLAIM_TIMEOUT_MINUTES ?? "30",
      10
    ),
  };
}
