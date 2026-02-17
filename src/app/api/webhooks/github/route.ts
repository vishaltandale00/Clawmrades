import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { db } from "@/lib/db";
import { trackedIssues, prQueue, workQueue } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getRepoConfig, getWorkQueueConfig } from "@/lib/utils";

function verifyWebhookSignature(payload: string, signature: string): boolean {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) return process.env.ENVIRONMENT !== "production";
  const expected =
    "sha256=" + createHmac("sha256", secret).update(payload).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const payload = await request.text();
  const signature = request.headers.get("X-Hub-Signature-256") ?? "";

  if (!verifyWebhookSignature(payload, signature)) {
    return NextResponse.json(
      { error: "Invalid webhook signature" },
      { status: 401 }
    );
  }

  const event = request.headers.get("X-GitHub-Event");
  const body = JSON.parse(payload);
  const action = body.action;
  const repoConfig = getRepoConfig();
  const { requiredTriages, requiredPrAnalyses } = getWorkQueueConfig();

  try {
    if (event === "issues") {
      const issue = body.issue;

      if (action === "opened") {
        // Upsert tracked issue
        const [upserted] = await db
          .insert(trackedIssues)
          .values({
            repoOwner: repoConfig.owner,
            repoName: repoConfig.name,
            issueNumber: issue.number,
            title: issue.title,
            body: issue.body ?? null,
            htmlUrl: issue.html_url,
            labels: (issue.labels ?? []).map(
              (l: { name: string }) => l.name
            ),
            state: issue.state,
            author: issue.user.login,
            commentsCount: issue.comments ?? 0,
            reactionsCount: issue.reactions?.total_count ?? 0,
            createdAtGithub: new Date(issue.created_at),
            updatedAtGithub: new Date(issue.updated_at),
            syncedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [
              trackedIssues.repoOwner,
              trackedIssues.repoName,
              trackedIssues.issueNumber,
            ],
            set: {
              title: issue.title,
              body: issue.body ?? null,
              state: issue.state,
              labels: (issue.labels ?? []).map(
                (l: { name: string }) => l.name
              ),
              updatedAtGithub: new Date(issue.updated_at),
              syncedAt: new Date(),
              updatedAt: new Date(),
            },
          })
          .returning();

        // Create triage work items
        for (let i = 0; i < requiredTriages; i++) {
          await db.insert(workQueue).values({
            repoOwner: repoConfig.owner,
            repoName: repoConfig.name,
            workType: "triage_issue",
            targetType: "issue",
            targetId: String(upserted.id),
            priority: 50,
          });
        }
      }

      if (action === "closed" || action === "reopened") {
        await db
          .update(trackedIssues)
          .set({
            state: issue.state,
            updatedAtGithub: new Date(issue.updated_at),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(trackedIssues.repoOwner, repoConfig.owner),
              eq(trackedIssues.repoName, repoConfig.name),
              eq(trackedIssues.issueNumber, issue.number)
            )
          );
      }
    }

    if (event === "pull_request") {
      const pr = body.pull_request;

      if (action === "opened") {
        // Upsert PR
        const [upserted] = await db
          .insert(prQueue)
          .values({
            repoOwner: repoConfig.owner,
            repoName: repoConfig.name,
            prNumber: pr.number,
            title: pr.title,
            body: pr.body ?? null,
            htmlUrl: pr.html_url,
            author: pr.user.login,
            state: pr.state,
            labels: (pr.labels ?? []).map(
              (l: { name: string }) => l.name
            ),
            createdAtGithub: new Date(pr.created_at),
            updatedAtGithub: new Date(pr.updated_at),
            filesChanged: pr.changed_files ?? null,
            linesAdded: pr.additions ?? null,
            linesRemoved: pr.deletions ?? null,
            syncedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [
              prQueue.repoOwner,
              prQueue.repoName,
              prQueue.prNumber,
            ],
            set: {
              title: pr.title,
              body: pr.body ?? null,
              state: pr.state,
              labels: (pr.labels ?? []).map(
                (l: { name: string }) => l.name
              ),
              updatedAtGithub: new Date(pr.updated_at),
              syncedAt: new Date(),
              updatedAt: new Date(),
            },
          })
          .returning();

        // Create analyze work items
        for (let i = 0; i < requiredPrAnalyses; i++) {
          await db.insert(workQueue).values({
            repoOwner: repoConfig.owner,
            repoName: repoConfig.name,
            workType: "analyze_pr",
            targetType: "pr",
            targetId: String(upserted.id),
            priority: 50,
          });
        }
      }

      if (action === "closed") {
        const state = pr.merged ? "merged" : "closed";
        await db
          .update(prQueue)
          .set({
            state,
            updatedAtGithub: new Date(pr.updated_at),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(prQueue.repoOwner, repoConfig.owner),
              eq(prQueue.repoName, repoConfig.name),
              eq(prQueue.prNumber, pr.number)
            )
          );
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Webhook processing error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
