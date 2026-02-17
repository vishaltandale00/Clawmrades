"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { TrackedIssue } from "@/types";

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

function triageStatusBadge(status: string) {
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

export function IssueTable({ issues }: { issues: TrackedIssue[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-16">#</TableHead>
          <TableHead>Title</TableHead>
          <TableHead className="w-24">Priority</TableHead>
          <TableHead className="w-32">Labels</TableHead>
          <TableHead className="w-28">Status</TableHead>
          <TableHead className="w-20 text-right">Stale</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {issues.length === 0 && (
          <TableRow>
            <TableCell colSpan={6} className="text-center text-muted-foreground">
              No issues found.
            </TableCell>
          </TableRow>
        )}
        {issues.map((issue) => (
          <TableRow key={issue.id}>
            <TableCell className="font-mono text-xs">
              {issue.issueNumber}
            </TableCell>
            <TableCell>
              <a
                href={issue.htmlUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium hover:underline"
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
            <TableCell>{triageStatusBadge(issue.triageStatus)}</TableCell>
            <TableCell className="text-right">
              {issue.isStale && (
                <Badge variant="destructive" className="text-xs">
                  {issue.stalenessDays}d
                </Badge>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
