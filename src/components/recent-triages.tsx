"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, ChevronDown } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { IssueTriage } from "@/types";

interface RecentTriageIssue {
  id: number;
  issueNumber: number;
  title: string;
  triageStatus: string;
  triageCount: number;
  requiredTriages: number;
  priorityLabel: string | null;
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

function statusBadge(status: string) {
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

export function RecentTriages({
  issues,
  triagesMap,
}: {
  issues: RecentTriageIssue[];
  triagesMap: Record<number, IssueTriage[]>;
}) {
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const toggleExpanded = (id: number) =>
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (issues.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Recent Triage Decisions</CardTitle>
        <CardDescription>
          Issues with agent triage submissions
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {issues.map((issue) => {
          const triages = triagesMap[issue.id] ?? [];
          const isExpanded = expandedIds.has(issue.id);

          return (
            <div key={issue.id} className="border rounded-lg">
              <button
                className="w-full flex items-center gap-3 p-3 text-left hover:bg-muted/50 rounded-lg"
                onClick={() => toggleExpanded(issue.id)}
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/issues/${issue.issueNumber}`}
                      className="font-mono text-xs text-primary hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      #{issue.issueNumber}
                    </Link>
                    <span className="text-sm font-medium truncate">
                      {issue.title}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-muted-foreground">
                    {issue.triageCount}/{issue.requiredTriages}
                  </span>
                  {statusBadge(issue.triageStatus)}
                  {issue.priorityLabel && (
                    <Badge
                      variant="outline"
                      className={`text-xs ${priorityColor(issue.priorityLabel)}`}
                    >
                      {issue.priorityLabel}
                    </Badge>
                  )}
                </div>
              </button>

              {isExpanded && triages.length > 0 && (
                <div className="px-3 pb-3">
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {triages.map((t) => (
                      <TriageCard key={t.id} triage={t} />
                    ))}
                  </div>
                </div>
              )}

              {isExpanded && triages.length === 0 && (
                <div className="px-3 pb-3">
                  <p className="text-xs text-muted-foreground">
                    No triage submissions yet.
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
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
          title={t.summary.length > 150 ? (expanded ? "Click to collapse" : "Click to expand") : undefined}
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
