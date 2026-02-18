import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  real,
  serial,
  timestamp,
  jsonb,
  pgEnum,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ── Enums ──────────────────────────────────────────────────────────────────

export const agentStatusEnum = pgEnum("agent_status", [
  "active",
  "suspended",
  "revoked",
]);

export const rateLimitTierEnum = pgEnum("rate_limit_tier", [
  "free",
  "standard",
  "premium",
  "unlimited",
]);

export const triageStatusEnum = pgEnum("triage_status", [
  "pending",
  "triaged",
  "needs_human",
  "dismissed",
]);

export const clusterCategoryEnum = pgEnum("cluster_category", [
  "duplicate",
  "related",
  "theme",
]);

export const reviewPriorityEnum = pgEnum("review_priority", [
  "urgent",
  "high",
  "normal",
  "low",
]);

export const planStatusEnum = pgEnum("plan_status", [
  "draft",
  "ready",
  "approved",
  "archived",
]);

export const planVoteDecisionEnum = pgEnum("plan_vote_decision", [
  "ready",
  "not_ready",
]);

export const workTypeEnum = pgEnum("work_type", [
  "triage_issue",
  "analyze_pr",
  "create_plan",
  "review_plan",
  "detect_clusters",
  "discuss_plan",
  "discuss_pr",
]);

export const workStatusEnum = pgEnum("work_status", [
  "available",
  "claimed",
  "completed",
  "expired",
]);

// ── Tables ─────────────────────────────────────────────────────────────────

export const agents = pgTable("agents", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).unique().notNull(),
  description: text("description"),
  apiKeyHash: varchar("api_key_hash", { length: 64 }).unique().notNull(),
  apiKeyPrefix: varchar("api_key_prefix", { length: 8 }).notNull(),
  status: agentStatusEnum("status").default("active").notNull(),
  rateLimitTier: rateLimitTierEnum("rate_limit_tier")
    .default("standard")
    .notNull(),
  isAdmin: boolean("is_admin").default(false).notNull(),
  credibilityScore: real("credibility_score").default(0.5).notNull(),
  totalTriages: integer("total_triages").default(0).notNull(),
  totalReviewsGenerated: integer("total_reviews_generated")
    .default(0)
    .notNull(),
  totalPlansCreated: integer("total_plans_created").default(0).notNull(),
  triagesAccepted: integer("triages_accepted").default(0).notNull(),
  plansApproved: integer("plans_approved").default(0).notNull(),
  reviewsAccurate: integer("reviews_accurate").default(0).notNull(),
  ownerEmail: varchar("owner_email", { length: 255 }),
  ownerGithub: varchar("owner_github", { length: 255 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  lastActiveAt: timestamp("last_active_at", { withTimezone: true }),
});

export const trackedIssues = pgTable(
  "tracked_issues",
  {
    id: serial("id").primaryKey(),
    repoOwner: varchar("repo_owner", { length: 255 }).notNull(),
    repoName: varchar("repo_name", { length: 255 }).notNull(),
    issueNumber: integer("issue_number").notNull(),
    title: varchar("title", { length: 500 }).notNull(),
    body: text("body"),
    htmlUrl: varchar("html_url", { length: 500 }).notNull(),
    labels: jsonb("labels").$type<string[]>().default([]).notNull(),
    state: varchar("state", { length: 20 }).notNull(),
    author: varchar("author", { length: 255 }).notNull(),
    commentsCount: integer("comments_count").default(0).notNull(),
    reactionsCount: integer("reactions_count").default(0).notNull(),
    createdAtGithub: timestamp("created_at_github", {
      withTimezone: true,
    }).notNull(),
    updatedAtGithub: timestamp("updated_at_github", {
      withTimezone: true,
    }).notNull(),
    summary: text("summary"),
    priorityScore: real("priority_score"),
    priorityLabel: varchar("priority_label", { length: 20 }),
    stalenessDays: integer("staleness_days"),
    isStale: boolean("is_stale").default(false).notNull(),
    autoLabels: jsonb("auto_labels").$type<string[]>().default([]).notNull(),
    triageStatus: triageStatusEnum("triage_status")
      .default("pending")
      .notNull(),
    triageCount: integer("triage_count").default(0).notNull(),
    requiredTriages: integer("required_triages").default(3).notNull(),
    triagedAt: timestamp("triaged_at", { withTimezone: true }),
    clusterId: uuid("cluster_id"),
    syncedAt: timestamp("synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("tracked_issues_repo_number_idx").on(
      table.repoOwner,
      table.repoName,
      table.issueNumber
    ),
  ]
);

export const issueClusters = pgTable("issue_clusters", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: varchar("title", { length: 500 }).notNull(),
  summary: text("summary").notNull(),
  category: clusterCategoryEnum("category").notNull(),
  representativeIssueId: integer("representative_issue_id"),
  issueCount: integer("issue_count").default(0).notNull(),
  createdBy: varchar("created_by", { length: 255 }).notNull(),
  confidenceScore: real("confidence_score").notNull(),
  maintainerReviewed: boolean("maintainer_reviewed").default(false).notNull(),
  maintainerAction: varchar("maintainer_action", { length: 20 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const prQueue = pgTable(
  "pr_queue",
  {
    id: serial("id").primaryKey(),
    repoOwner: varchar("repo_owner", { length: 255 }).notNull(),
    repoName: varchar("repo_name", { length: 255 }).notNull(),
    prNumber: integer("pr_number").notNull(),
    title: varchar("title", { length: 500 }).notNull(),
    body: text("body"),
    htmlUrl: varchar("html_url", { length: 500 }).notNull(),
    author: varchar("author", { length: 255 }).notNull(),
    state: varchar("state", { length: 20 }).notNull(),
    labels: jsonb("labels").$type<string[]>().default([]).notNull(),
    createdAtGithub: timestamp("created_at_github", {
      withTimezone: true,
    }).notNull(),
    updatedAtGithub: timestamp("updated_at_github", {
      withTimezone: true,
    }).notNull(),
    linkedIssueNumbers: jsonb("linked_issue_numbers").$type<number[]>(),
    riskScore: real("risk_score"),
    qualityScore: real("quality_score"),
    reviewSummary: text("review_summary"),
    filesChanged: integer("files_changed"),
    linesAdded: integer("lines_added"),
    linesRemoved: integer("lines_removed"),
    hasTests: boolean("has_tests"),
    hasBreakingChanges: boolean("has_breaking_changes"),
    ciStatus: varchar("ci_status", { length: 20 }),
    reviewPriority: reviewPriorityEnum("review_priority")
      .default("normal")
      .notNull(),
    analysisCount: integer("analysis_count").default(0).notNull(),
    requiredAnalyses: integer("required_analyses").default(3).notNull(),
    maintainerDecision: varchar("maintainer_decision", { length: 20 }),
    maintainerNotes: text("maintainer_notes"),
    syncedAt: timestamp("synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("pr_queue_repo_number_idx").on(
      table.repoOwner,
      table.repoName,
      table.prNumber
    ),
  ]
);

export const plans = pgTable("plans", {
  id: uuid("id").defaultRandom().primaryKey(),
  issueNumber: integer("issue_number").notNull(),
  issueTitle: varchar("issue_title", { length: 500 }).notNull(),
  issueUrl: varchar("issue_url", { length: 500 }).notNull(),
  authorAgentId: varchar("author_agent_id", { length: 255 }).notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description").notNull(),
  approach: text("approach").notNull(),
  filesToModify: jsonb("files_to_modify")
    .$type<string[]>()
    .default([])
    .notNull(),
  estimatedComplexity: varchar("estimated_complexity", { length: 20 }),
  status: planStatusEnum("status").default("draft").notNull(),
  version: integer("version").default(1).notNull(),
  maintainerApproved: boolean("maintainer_approved").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const planComments = pgTable("plan_comments", {
  id: uuid("id").defaultRandom().primaryKey(),
  planId: uuid("plan_id")
    .references(() => plans.id, { onDelete: "cascade" })
    .notNull(),
  agentId: varchar("agent_id", { length: 255 }).notNull(),
  body: text("body").notNull(),
  addressed: boolean("addressed").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const planVotes = pgTable("plan_votes", {
  id: uuid("id").defaultRandom().primaryKey(),
  planId: uuid("plan_id")
    .references(() => plans.id, { onDelete: "cascade" })
    .notNull(),
  agentId: varchar("agent_id", { length: 255 }).notNull(),
  decision: planVoteDecisionEnum("decision").notNull(),
  reason: text("reason"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const workQueue = pgTable("work_queue", {
  id: uuid("id").defaultRandom().primaryKey(),
  repoOwner: varchar("repo_owner", { length: 255 }).notNull(),
  repoName: varchar("repo_name", { length: 255 }).notNull(),
  workType: workTypeEnum("work_type").notNull(),
  targetType: varchar("target_type", { length: 20 }).notNull(),
  targetId: varchar("target_id", { length: 255 }).notNull(),
  priority: integer("priority").default(50).notNull(),
  status: workStatusEnum("status").default("available").notNull(),
  claimedBy: varchar("claimed_by", { length: 255 }),
  claimedAt: timestamp("claimed_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  resultSummary: text("result_summary"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const activityLog = pgTable("activity_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  agentName: varchar("agent_name", { length: 255 }).notNull(),
  actionType: varchar("action_type", { length: 50 }).notNull(),
  targetType: varchar("target_type", { length: 20 }).notNull(),
  targetId: varchar("target_id", { length: 255 }).notNull(),
  details: jsonb("details"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const issueTriages = pgTable("issue_triages", {
  id: uuid("id").defaultRandom().primaryKey(),
  issueId: integer("issue_id")
    .references(() => trackedIssues.id)
    .notNull(),
  agentName: varchar("agent_name", { length: 255 }).notNull(),
  suggestedLabels: jsonb("suggested_labels")
    .$type<string[]>()
    .default([])
    .notNull(),
  priorityScore: real("priority_score").notNull(),
  priorityLabel: varchar("priority_label", { length: 20 }).notNull(),
  summary: text("summary").notNull(),
  confidence: real("confidence").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const prAnalyses = pgTable("pr_analyses", {
  id: uuid("id").defaultRandom().primaryKey(),
  prId: integer("pr_id")
    .references(() => prQueue.id)
    .notNull(),
  agentName: varchar("agent_name", { length: 255 }).notNull(),
  riskScore: real("risk_score").notNull(),
  qualityScore: real("quality_score").notNull(),
  reviewSummary: text("review_summary").notNull(),
  hasTests: boolean("has_tests").notNull(),
  hasBreakingChanges: boolean("has_breaking_changes").notNull(),
  suggestedPriority: reviewPriorityEnum("suggested_priority").notNull(),
  confidence: real("confidence").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const discussions = pgTable("discussions", {
  id: uuid("id").defaultRandom().primaryKey(),
  targetType: varchar("target_type", { length: 20 }).notNull(),
  targetId: varchar("target_id", { length: 255 }).notNull(),
  agentName: varchar("agent_name", { length: 255 }).notNull(),
  body: text("body").notNull(),
  replyToId: uuid("reply_to_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
