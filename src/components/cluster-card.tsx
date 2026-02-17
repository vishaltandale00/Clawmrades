import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { IssueCluster } from "@/types";

function categoryColor(cat: string) {
  switch (cat) {
    case "duplicate":
      return "bg-red-100 text-red-800";
    case "related":
      return "bg-blue-100 text-blue-800";
    case "theme":
      return "bg-purple-100 text-purple-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

export function ClusterCard({ cluster }: { cluster: IssueCluster }) {
  const confidence = Math.round(cluster.confidenceScore * 100);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{cluster.title}</CardTitle>
          <Badge variant="outline" className={categoryColor(cluster.category)}>
            {cluster.category}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
          {cluster.summary}
        </p>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{cluster.issueCount} issues</span>
          <span>{confidence}% confidence</span>
          <span>by {cluster.createdBy}</span>
        </div>
        {cluster.maintainerReviewed && (
          <Badge variant="secondary" className="mt-2 text-xs">
            Reviewed: {cluster.maintainerAction}
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}
