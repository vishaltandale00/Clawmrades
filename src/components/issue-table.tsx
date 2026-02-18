"use client";

import { useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ChevronRight, ChevronDown } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import type { IssueWithCluster, IssueTriage } from "@/types";

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

function triageStatusBadge(issue: IssueWithCluster) {
  switch (issue.triageStatus) {
    case "triaged":
      return (
        <div>
          <Badge variant="default">Triaged</Badge>
          {issue.triagedAt && (
            <div className="mt-1 text-xs text-muted-foreground">
              {new Date(issue.triagedAt).toLocaleDateString()}
            </div>
          )}
        </div>
      );
    case "needs_human":
      return <Badge variant="destructive">Needs Human</Badge>;
    case "dismissed":
      return <Badge variant="secondary">Dismissed</Badge>;
    default:
      return (
        <div>
          <Badge variant="outline">Pending</Badge>
          <div className="mt-1 text-xs text-muted-foreground">
            {issue.triageCount}/{issue.requiredTriages}
          </div>
        </div>
      );
  }
}

function clusterBadge(category: IssueWithCluster["clusterCategory"]) {
  if (!category) return null;
  const styles: Record<string, string> = {
    duplicate: "bg-red-100 text-red-800 border-red-200",
    related: "bg-blue-100 text-blue-800 border-blue-200",
    theme: "bg-purple-100 text-purple-800 border-purple-200",
  };
  return (
    <Badge variant="outline" className={styles[category]}>
      {category}
    </Badge>
  );
}

export function IssueTable({
  issues,
  triagesMap,
}: {
  issues: IssueWithCluster[];
  triagesMap: Record<number, IssueTriage[]>;
}) {
  const searchParams = useSearchParams();
  const statusFilter = searchParams.get("status");

  const validStatuses = ["pending", "triaged", "needs_human", "dismissed"];
  const activeFilter = validStatuses.includes(statusFilter ?? "")
    ? statusFilter
    : null;

  const filtered = useMemo(
    () =>
      activeFilter
        ? issues.filter((issue) => issue.triageStatus === activeFilter)
        : issues,
    [issues, activeFilter],
  );

  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const toggleExpanded = (id: number) =>
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10"></TableHead>
          <TableHead className="w-16">#</TableHead>
          <TableHead>Title</TableHead>
          <TableHead className="w-24">Priority</TableHead>
          <TableHead className="w-32">Labels</TableHead>
          <TableHead className="w-28">Status</TableHead>
          <TableHead className="w-24">Cluster</TableHead>
          <TableHead className="w-20 text-right">Stale</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {filtered.length === 0 && (
          <TableRow>
            <TableCell colSpan={8} className="text-center text-muted-foreground">
              No issues found.
            </TableCell>
          </TableRow>
        )}
        {filtered.map((issue) => {
          const triages = triagesMap[issue.id] ?? [];
          const isExpanded = expandedIds.has(issue.id);
          const hasTriages = triages.length > 0;

          return (
            <IssueRowGroup
              key={issue.id}
              issue={issue}
              triages={triages}
              isExpanded={isExpanded}
              hasTriages={hasTriages}
              onToggle={() => toggleExpanded(issue.id)}
            />
          );
        })}
      </TableBody>
    </Table>
  );
}

function IssueRowGroup({
  issue,
  triages,
  isExpanded,
  hasTriages,
  onToggle,
}: {
  issue: IssueWithCluster;
  triages: IssueTriage[];
  isExpanded: boolean;
  hasTriages: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <TableRow
        className={hasTriages ? "cursor-pointer" : undefined}
        onClick={hasTriages ? onToggle : undefined}
      >
        <TableCell className="px-2">
          {hasTriages ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggle();
              }}
              className="p-1 rounded hover:bg-muted"
              aria-label={isExpanded ? "Collapse triages" : "Expand triages"}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <div className="flex items-center gap-1">
                  <ChevronRight className="h-4 w-4" />
                  <span className="text-xs text-muted-foreground">
                    {triages.length}
                  </span>
                </div>
              )}
            </button>
          ) : null}
        </TableCell>
        <TableCell className="font-mono text-xs">
          <Link
            href={`/issues/${issue.issueNumber}`}
            className="hover:underline text-primary"
            onClick={(e) => e.stopPropagation()}
          >
            {issue.issueNumber}
          </Link>
        </TableCell>
        <TableCell>
          <a
            href={issue.htmlUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {issue.title}
          </a>
          <div className="mt-1 flex gap-1 flex-wrap">
            {(issue.autoLabels as string[]).map((l) => (
              <Badge key={l} variant="outline" className="text-xs">
                {l}
              </Badge>
            ))}
          </div>
        </TableCell>
        <TableCell>
          {issue.priorityLabel && (
            <Badge
              variant="outline"
              className={priorityColor(issue.priorityLabel)}
            >
              {issue.priorityLabel}
            </Badge>
          )}
        </TableCell>
        <TableCell>
          <div className="flex gap-1 flex-wrap">
            {(issue.labels as string[]).slice(0, 3).map((l) => (
              <Badge key={l} variant="secondary" className="text-xs">
                {l}
              </Badge>
            ))}
          </div>
        </TableCell>
        <TableCell>{triageStatusBadge(issue)}</TableCell>
        <TableCell>{clusterBadge(issue.clusterCategory)}</TableCell>
        <TableCell className="text-right">
          {issue.isStale && (
            <Badge variant="destructive" className="text-xs">
              {issue.stalenessDays}d
            </Badge>
          )}
        </TableCell>
      </TableRow>

      {isExpanded && (
        <TableRow>
          <TableCell colSpan={8} className="bg-muted/30 p-4">
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {triages.map((t) => (
                <TriageCard key={t.id} triage={t} />
              ))}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function TriageCard({ triage: t }: { triage: IssueTriage }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="py-4">
      <CardHeader className="pb-2 px-4">
        <CardTitle className="text-sm">{t.agentName}</CardTitle>
        <CardDescription className="text-xs">
          {new Date(t.createdAt).toLocaleString()}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 px-4">
        <p
          className={`text-xs text-muted-foreground ${expanded ? "" : "line-clamp-3"} ${t.summary.length > 150 ? "cursor-pointer" : ""}`}
          onClick={() => {
            if (t.summary.length > 150) setExpanded(!expanded);
          }}
          title={
            t.summary.length > 150
              ? expanded
                ? "Click to collapse"
                : "Click to expand"
              : undefined
          }
        >
          {t.summary}
        </p>
        <div className="flex flex-wrap gap-3 text-xs">
          <div>
            <span className="text-muted-foreground">Score: </span>
            <span className="font-medium">
              {t.priorityScore.toFixed(2)}
            </span>
          </div>
          <div>
            <Badge
              variant="outline"
              className={`text-xs ${priorityColor(t.priorityLabel)}`}
            >
              {t.priorityLabel}
            </Badge>
          </div>
          <div>
            <span className="text-muted-foreground">Conf: </span>
            <span className="font-medium">
              {(t.confidence * 100).toFixed(0)}%
            </span>
          </div>
        </div>
        {(t.suggestedLabels as string[]).length > 0 && (
          <div className="flex flex-wrap gap-1">
            {(t.suggestedLabels as string[]).map((l) => (
              <Badge key={l} variant="outline" className="text-xs">
                {l}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
