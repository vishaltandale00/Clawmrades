"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ActivityItem {
  id: string;
  agent_name: string;
  action_type: string;
  target_type: string;
  target_id: string;
  details: Record<string, unknown> | null;
  created_at: string;
}

function formatAction(item: ActivityItem): string {
  const target = `${item.target_type} #${item.target_id}`;
  switch (item.action_type) {
    case "triage":
      return `triaged ${target}`;
    case "cluster":
      return `created cluster for ${target}`;
    case "pr_review":
      return `analyzed ${target}`;
    case "plan_create":
      return `submitted plan for ${target}`;
    case "plan_approve":
      return `plan approved for ${target}`;
    default:
      return `${item.action_type} on ${target}`;
  }
}

function actionColor(type: string): string {
  switch (type) {
    case "triage":
      return "bg-orange-100 text-orange-800";
    case "cluster":
      return "bg-purple-100 text-purple-800";
    case "pr_review":
      return "bg-blue-100 text-blue-800";
    case "plan_create":
    case "plan_approve":
      return "bg-green-100 text-green-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

export function ActivityFeed({
  initialItems,
}: {
  initialItems: ActivityItem[];
}) {
  const [items, setItems] = useState<ActivityItem[]>(initialItems);

  useEffect(() => {
    const es = new EventSource("/api/activity/stream");

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setItems((prev) => [data, ...prev].slice(0, 50));
      } catch {
        // ignore malformed events
      }
    };

    return () => es.close();
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {items.length === 0 && (
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          )}
          {items.map((item) => (
            <div key={item.id} className="flex items-start gap-3 text-sm">
              <Badge variant="outline" className={actionColor(item.action_type)}>
                {item.action_type}
              </Badge>
              <div className="flex-1">
                <span className="font-medium">{item.agent_name}</span>{" "}
                {formatAction(item)}
              </div>
              <time className="text-xs text-muted-foreground whitespace-nowrap">
                {new Date(item.created_at).toLocaleTimeString()}
              </time>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
