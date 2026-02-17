import { db } from "@/lib/db";
import { plans } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { PlanCard } from "@/components/plan-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Plan } from "@/types";

export const dynamic = "force-dynamic";

export default async function PlansPage() {
  const allPlans = await db
    .select()
    .from(plans)
    .orderBy(desc(plans.createdAt))
    .limit(100);

  const drafts = allPlans.filter((p) => p.status === "draft");
  const ready = allPlans.filter((p) => p.status === "ready");
  const approved = allPlans.filter((p) => p.status === "approved");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Plans</h1>
      <Tabs defaultValue="drafts">
        <TabsList>
          <TabsTrigger value="drafts">Drafts ({drafts.length})</TabsTrigger>
          <TabsTrigger value="ready">Ready ({ready.length})</TabsTrigger>
          <TabsTrigger value="approved">
            Approved ({approved.length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="drafts">
          <PlanGrid plans={drafts} empty="No draft plans." />
        </TabsContent>
        <TabsContent value="ready">
          <PlanGrid plans={ready} empty="No plans ready for review." />
        </TabsContent>
        <TabsContent value="approved">
          <PlanGrid plans={approved} empty="No approved plans yet." />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PlanGrid({ plans: items, empty }: { plans: Plan[]; empty: string }) {
  if (items.length === 0) {
    return <p className="text-muted-foreground mt-4">{empty}</p>;
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mt-4">
      {items.map((p) => (
        <PlanCard key={p.id} plan={p} />
      ))}
    </div>
  );
}
