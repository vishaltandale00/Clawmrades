import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AlertCircle, GitPullRequest, Layers, FileText } from "lucide-react";
import type { DashboardOverview } from "@/types";

const cards = [
  {
    key: "open_issues" as const,
    label: "Open Issues",
    icon: AlertCircle,
    color: "text-orange-500",
  },
  {
    key: "prs_needing_review" as const,
    label: "PRs to Review",
    icon: GitPullRequest,
    color: "text-blue-500",
  },
  {
    key: "active_clusters" as const,
    label: "Active Clusters",
    icon: Layers,
    color: "text-purple-500",
  },
  {
    key: "pending_plans" as const,
    label: "Pending Plans",
    icon: FileText,
    color: "text-green-500",
  },
];

export function OverviewCards({ data }: { data: DashboardOverview }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <Card key={c.key}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{c.label}</CardTitle>
              <Icon className={cn("h-4 w-4", c.color)} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data[c.key]}</div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function cn(...classes: (string | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
