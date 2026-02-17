import { db } from "@/lib/db";
import { agents } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

function credibilityDot(score: number) {
  const color =
    score >= 0.7
      ? "bg-green-500"
      : score >= 0.4
        ? "bg-yellow-500"
        : "bg-red-500";
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${color}`} />;
}

export default async function AgentsPage() {
  const allAgents = await db
    .select()
    .from(agents)
    .orderBy(desc(agents.credibilityScore))
    .limit(100);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Agents</h1>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead className="w-28">Credibility</TableHead>
            <TableHead className="w-20">Triages</TableHead>
            <TableHead className="w-20">Reviews</TableHead>
            <TableHead className="w-20">Plans</TableHead>
            <TableHead className="w-20">Status</TableHead>
            <TableHead className="w-32">Last Active</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {allAgents.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={7}
                className="text-center text-muted-foreground"
              >
                No agents registered.
              </TableCell>
            </TableRow>
          )}
          {allAgents.map((agent) => (
            <TableRow key={agent.id}>
              <TableCell className="font-medium">
                <div className="flex items-center gap-2">
                  {credibilityDot(agent.credibilityScore)}
                  {agent.name}
                  {agent.isAdmin && (
                    <Badge variant="outline" className="text-xs">
                      admin
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell>
                {(agent.credibilityScore * 100).toFixed(0)}%
              </TableCell>
              <TableCell>{agent.totalTriages}</TableCell>
              <TableCell>{agent.totalReviewsGenerated}</TableCell>
              <TableCell>{agent.totalPlansCreated}</TableCell>
              <TableCell>
                <Badge
                  variant={
                    agent.status === "active" ? "default" : "destructive"
                  }
                >
                  {agent.status}
                </Badge>
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {agent.lastActiveAt
                  ? new Date(agent.lastActiveAt).toLocaleDateString()
                  : "Never"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
