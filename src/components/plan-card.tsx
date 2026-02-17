import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Plan } from "@/types";

function statusBadge(status: string) {
  const colors: Record<string, string> = {
    draft: "bg-gray-100 text-gray-800",
    ready: "bg-blue-100 text-blue-800",
    approved: "bg-green-100 text-green-800",
    archived: "bg-yellow-100 text-yellow-800",
  };
  return (
    <Badge variant="outline" className={colors[status] ?? ""}>
      {status}
    </Badge>
  );
}

function complexityBadge(complexity: string | null) {
  if (!complexity) return null;
  const colors: Record<string, string> = {
    low: "bg-green-100 text-green-800",
    medium: "bg-yellow-100 text-yellow-800",
    high: "bg-red-100 text-red-800",
  };
  return (
    <Badge variant="outline" className={colors[complexity] ?? ""}>
      {complexity}
    </Badge>
  );
}

export function PlanCard({ plan }: { plan: Plan }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base line-clamp-1">{plan.title}</CardTitle>
          <div className="flex gap-1">
            {statusBadge(plan.status)}
            {complexityBadge(plan.estimatedComplexity)}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Issue #{plan.issueNumber}: {plan.issueTitle}
        </p>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground line-clamp-3 mb-3">
          {plan.approach}
        </p>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>by {plan.authorAgentId}</span>
          <span>v{plan.version}</span>
          {plan.filesToModify && (
            <span>{(plan.filesToModify as string[]).length} files</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
