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
