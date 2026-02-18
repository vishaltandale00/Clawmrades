import { db } from "@/lib/db";
import { trackedIssues, issueClusters, issueTriages } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getRepoConfig } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function IssueDetailPage({
  params,
}: {
  params: Promise<{ number: string }>;
}) {
  const { number } = await params;
  const issueNumber = parseInt(number, 10);
  if (isNaN(issueNumber)) notFound();

  const { owner, name } = getRepoConfig();

  const [row] = await db
    .select({
      issue: trackedIssues,
      clusterCategory: issueClusters.category,
      clusterTitle: issueClusters.title,
    })
    .from(trackedIssues)
    .leftJoin(issueClusters, eq(trackedIssues.clusterId, issueClusters.id))
    .where(
      and(
        eq(trackedIssues.repoOwner, owner),
        eq(trackedIssues.repoName, name),
        eq(trackedIssues.issueNumber, issueNumber)
      )
    )
    .limit(1);

  if (!row) notFound();

  const issue = row.issue;

  const triages = await db
    .select()
    .from(issueTriages)
    .where(eq(issueTriages.issueId, issue.id))
    .orderBy(desc(issueTriages.createdAt));

  const isTriaged = issue.triageStatus === "triaged";

  return (
    <div className="space-y-8">
      {/* Back link */}
      <Link
        href="/issues"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        &larr; Back to issues
      </Link>

      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">
              <a
                href={issue.htmlUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
                #{issue.issueNumber} {issue.title}
              </a>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Opened by {issue.author}
            </p>
          </div>
        </div>

        {/* Status badges row */}
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={issue.triageStatus} />
          {issue.priorityLabel && (
            <Badge variant="outline" className={priorityColor(issue.priorityLabel)}>
              {issue.priorityLabel}
            </Badge>
          )}
          {issue.isStale && (
            <Badge variant="destructive" className="text-xs">
              Stale ({issue.stalenessDays}d)
            </Badge>
          )}
          {row.clusterCategory && (
            <Badge variant="outline" className={clusterColor(row.clusterCategory)}>
              {row.clusterCategory}
              {row.clusterTitle && `: ${row.clusterTitle}`}
            </Badge>
          )}
        </div>

        {/* Triage progress */}
        <div className="text-sm text-muted-foreground">
          Triage progress: {issue.triageCount} / {issue.requiredTriages}
          {issue.triagedAt && (
            <span className="ml-4">
              Triaged at: {new Date(issue.triagedAt).toLocaleString()}
            </span>
          )}
        </div>
      </div>

      {/* Consensus summary */}
      {isTriaged && (
        <Card>
          <CardHeader>
            <CardTitle>Consensus Summary</CardTitle>
            <CardDescription>
              Aggregated result from {issue.triageCount} agent triages
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {issue.summary && <p className="text-sm">{issue.summary}</p>}
            <div className="flex flex-wrap gap-4 text-sm">
              {issue.priorityScore !== null && (
                <div>
                  <span className="text-muted-foreground">Priority score: </span>
                  <span className="font-medium">
                    {issue.priorityScore.toFixed(2)}
                  </span>
                </div>
              )}
              {issue.priorityLabel && (
                <div>
                  <span className="text-muted-foreground">Priority label: </span>
                  <Badge
                    variant="outline"
                    className={priorityColor(issue.priorityLabel)}
                  >
                    {issue.priorityLabel}
                  </Badge>
                </div>
              )}
            </div>
            {(issue.autoLabels as string[]).length > 0 && (
              <div className="flex flex-wrap gap-1">
                <span className="text-sm text-muted-foreground mr-1">
                  Auto labels:
                </span>
                {(issue.autoLabels as string[]).map((l) => (
                  <Badge key={l} variant="secondary" className="text-xs">
                    {l}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Agent triage decisions */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">
          Agent Triage Decisions ({triages.length})
        </h2>

        {triages.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No triage submissions yet.
          </p>
        )}

        {triages.map((t) => (
          <Card key={t.id}>
            <CardHeader>
              <CardTitle className="text-base">{t.agentName}</CardTitle>
              <CardDescription>
                Submitted {new Date(t.createdAt).toLocaleString()}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm">{t.summary}</p>
              <div className="flex flex-wrap gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Priority score: </span>
                  <span className="font-medium">{t.priorityScore.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Priority label: </span>
                  <Badge
                    variant="outline"
                    className={priorityColor(t.priorityLabel)}
                  >
                    {t.priorityLabel}
                  </Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">Confidence: </span>
                  <span className="font-medium">
                    {(t.confidence * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
              {(t.suggestedLabels as string[]).length > 0 && (
                <div className="flex flex-wrap gap-1">
                  <span className="text-sm text-muted-foreground mr-1">
                    Suggested labels:
                  </span>
                  {(t.suggestedLabels as string[]).map((l) => (
                    <Badge key={l} variant="outline" className="text-xs">
                      {l}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "triaged":
      return <Badge variant="default">Triaged</Badge>;
    case "needs_human":
      return <Badge variant="destructive">Needs Human</Badge>;
    case "dismissed":
      return <Badge variant="secondary">Dismissed</Badge>;
    default:
      return <Badge variant="outline">Pending</Badge>;
  }
}

function priorityColor(label: string | null) {
  switch (label) {
    case "critical":
      return "bg-red-100 text-red-800 border-red-200";
    case "high":
      return "bg-orange-100 text-orange-800 border-orange-200";
    case "medium":
      return "bg-yellow-100 text-yellow-800 border-yellow-200";
    case "low":
      return "bg-green-100 text-green-800 border-green-200";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200";
  }
}

function clusterColor(category: string) {
  switch (category) {
    case "duplicate":
      return "bg-red-100 text-red-800 border-red-200";
    case "related":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "theme":
      return "bg-purple-100 text-purple-800 border-purple-200";
    default:
      return "";
  }
}
