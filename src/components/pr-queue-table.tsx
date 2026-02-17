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
import type { PrQueueItem } from "@/types";

function priorityBadge(priority: string) {
  const colors: Record<string, string> = {
    urgent: "bg-red-100 text-red-800 border-red-200",
    high: "bg-orange-100 text-orange-800 border-orange-200",
    normal: "bg-blue-100 text-blue-800 border-blue-200",
    low: "bg-gray-100 text-gray-800 border-gray-200",
  };
  return (
    <Badge variant="outline" className={colors[priority] ?? colors.normal}>
      {priority}
    </Badge>
  );
}

function scoreBar(score: number | null, invert = false) {
  if (score == null) return <span className="text-xs text-muted-foreground">-</span>;
  const pct = Math.round(score * 100);
  const color = invert
    ? score > 0.7 ? "bg-red-500" : score > 0.4 ? "bg-yellow-500" : "bg-green-500"
    : score > 0.7 ? "bg-green-500" : score > 0.4 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-16 rounded-full bg-muted">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs">{pct}%</span>
    </div>
  );
}

function ciBadge(status: string | null) {
  if (!status) return null;
  const colors: Record<string, string> = {
    success: "bg-green-100 text-green-800",
    failure: "bg-red-100 text-red-800",
    pending: "bg-yellow-100 text-yellow-800",
  };
  return (
    <Badge variant="outline" className={colors[status] ?? ""}>
      {status}
    </Badge>
  );
}

export function PrQueueTable({ prs }: { prs: PrQueueItem[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-16">#</TableHead>
          <TableHead>Title</TableHead>
          <TableHead className="w-20">Author</TableHead>
          <TableHead className="w-24">Priority</TableHead>
          <TableHead className="w-28">Risk</TableHead>
          <TableHead className="w-28">Quality</TableHead>
          <TableHead className="w-20">CI</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {prs.length === 0 && (
          <TableRow>
            <TableCell colSpan={7} className="text-center text-muted-foreground">
              No PRs in queue.
            </TableCell>
          </TableRow>
        )}
        {prs.map((pr) => (
          <TableRow key={pr.id}>
            <TableCell className="font-mono text-xs">{pr.prNumber}</TableCell>
            <TableCell>
              <a
                href={pr.htmlUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium hover:underline"
              >
                {pr.title}
              </a>
            </TableCell>
            <TableCell className="text-xs">{pr.author}</TableCell>
            <TableCell>{priorityBadge(pr.reviewPriority)}</TableCell>
            <TableCell>{scoreBar(pr.riskScore, true)}</TableCell>
            <TableCell>{scoreBar(pr.qualityScore)}</TableCell>
            <TableCell>{ciBadge(pr.ciStatus)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
