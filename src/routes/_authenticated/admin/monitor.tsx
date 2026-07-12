import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchActiveEvent } from "@/lib/auth-helpers";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/_authenticated/admin/monitor")({
  component: MonitorPage,
});

function MonitorPage() {
  const q = useQuery({
    queryKey: ["admin-monitor"],
    refetchInterval: 5000,
    queryFn: async () => {
      const event = await fetchActiveEvent();
      if (!event) return null;
      const [{ data: teams }, { data: projects }, { data: ballots }] = await Promise.all([
        supabase.from("teams").select("*").eq("event_id", event.id),
        supabase.from("projects").select("*").eq("event_id", event.id),
        supabase.from("ballots").select("id, project_id, voter_team_id, status").eq("event_id", event.id),
      ]);
      return { event, teams: teams ?? [], projects: projects ?? [], ballots: ballots ?? [] };
    },
  });

  if (!q.data) return <div>Loading...</div>;
  const { teams, projects, ballots } = q.data;
  const projectById = new Map(projects.map((p) => [p.id, p]));
  const votesPerProject = new Map<string, number>();
  for (const b of ballots.filter((x) => x.status === "submitted")) {
    votesPerProject.set(b.project_id, (votesPerProject.get(b.project_id) ?? 0) + 1);
  }
  const totalExpected = teams.length * Math.max(0, projects.length - 1);
  const totalSubmitted = ballots.filter((b) => b.status === "submitted").length;

  return (
    <div className="space-y-6 max-w-5xl">
      <h1 className="text-3xl font-black">Voting monitor</h1>
      <Card className="p-5 glass">
        <div className="flex items-center justify-between text-sm font-medium">
          <span>Overall completion</span>
          <span className="tabular-nums">{totalSubmitted} / {totalExpected} ballots</span>
        </div>
        <Progress value={totalExpected ? (totalSubmitted / totalExpected) * 100 : 0} className="mt-3 h-3" />
      </Card>
      <Card className="p-5 glass">
        <h2 className="font-bold mb-3">Project vote counts</h2>
        <div className="space-y-2">
          {projects.map((p) => {
            const n = votesPerProject.get(p.id) ?? 0;
            return (
              <div key={p.id} className="flex items-center justify-between text-sm border-b border-border/40 pb-2 last:border-0">
                <div className="min-w-0 truncate font-medium">{p.title}</div>
                <Badge variant={n >= 3 ? "default" : "secondary"} className="tabular-nums shrink-0">{n} votes</Badge>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
