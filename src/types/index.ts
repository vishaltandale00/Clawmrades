import type { InferSelectModel } from "drizzle-orm";
import type {
  agents,
  trackedIssues,
  issueClusters,
  prQueue,
  plans,
  planComments,
  planVotes,
  workQueue,
  activityLog,
  issueTriages,
  prAnalyses,
  discussions,
} from "@/lib/db/schema";

// ── Model types ────────────────────────────────────────────────────────────

export type Agent = InferSelectModel<typeof agents>;
export type TrackedIssue = InferSelectModel<typeof trackedIssues>;
export type IssueCluster = InferSelectModel<typeof issueClusters>;
export type PrQueueItem = InferSelectModel<typeof prQueue>;
export type Plan = InferSelectModel<typeof plans>;
export type PlanComment = InferSelectModel<typeof planComments>;
export type PlanVote = InferSelectModel<typeof planVotes>;
export type WorkItem = InferSelectModel<typeof workQueue>;
export type ActivityLogEntry = InferSelectModel<typeof activityLog>;
export type IssueTriage = InferSelectModel<typeof issueTriages>;
export type PrAnalysis = InferSelectModel<typeof prAnalyses>;
export type Discussion = InferSelectModel<typeof discussions>;

export type IssueWithCluster = TrackedIssue & {
  clusterCategory: "duplicate" | "related" | "theme" | null;
};

// ── API request/response types ─────────────────────────────────────────────

export interface AgentRegisterRequest {
  name: string;
  description?: string;
  owner_email?: string;
  owner_github?: string;
}

export interface AgentRegisterResponse {
  id: string;
  name: string;
  api_key: string;
  api_key_prefix: string;
}

export interface TriageSubmission {
  suggested_labels: string[];
  priority_score: number;
  priority_label: string;
  summary: string;
  confidence: number;
}

export interface PrAnalysisSubmission {
  risk_score: number;
  quality_score: number;
  review_summary: string;
  has_tests: boolean;
  has_breaking_changes: boolean;
  suggested_priority: "urgent" | "high" | "normal" | "low";
  confidence: number;
}

export interface ClusterCreateRequest {
  title: string;
  summary: string;
  category: "duplicate" | "related" | "theme";
  issue_ids: number[];
  confidence_score: number;
}

export interface PlanCreateRequest {
  issue_number: number;
  issue_title: string;
  issue_url: string;
  title: string;
  description: string;
  approach: string;
  files_to_modify?: string[];
  estimated_complexity?: string;
}

export interface PlanVoteRequest {
  decision: "ready" | "not_ready";
  reason?: string;
}

export interface WorkNextResponse {
  id: string;
  work_type: string;
  target_type: string;
  target_id: string;
  priority: number;
  target_details?: Record<string, unknown>;
}

export interface DashboardOverview {
  open_issues: number;
  pending_triages: number;
  prs_needing_review: number;
  active_clusters: number;
  pending_plans: number;
  active_agents: number;
}

export interface SSEEvent {
  event: string;
  data: Record<string, unknown>;
}
