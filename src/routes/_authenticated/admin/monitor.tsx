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
  const totalExpected = teams.length * Math.max(0, projects.length - 1);

  const projectByTeam = new Map(projects.map((p) => [p.team_id, p]));
  // A team's vote counts once per project regardless of how many members voted.
  const votedProjectsByTeam = new Map<string, Set<string>>();
  for (const b of ballots.filter((x) => x.status === "submitted" && x.voter_team_id)) {
    if (!votedProjectsByTeam.has(b.voter_team_id!)) votedProjectsByTeam.set(b.voter_team_id!, new Set());
    votedProjectsByTeam.get(b.voter_team_id!)!.add(b.project_id);
  }
  const submittedByTeam = new Map(Array.from(votedProjectsByTeam, ([teamId, set]) => [teamId, set.size]));
  const totalSubmitted = Array.from(submittedByTeam.values()).reduce((s, n) => s + n, 0);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <h1 className="text-3xl font-black">Voting monitor</h1>
      <Card className="p-5 glass">
        <div className="flex items-center justify-between text-sm font-medium">
          <span>Overall completion</span>
          <span className="tabular-nums">{totalSubmitted} / {totalExpected} team votes</span>
        </div>
        <Progress value={totalExpected ? (totalSubmitted / totalExpected) * 100 : 0} className="mt-3 h-3" />
      </Card>
      <Card className="p-5 glass">
        <h2 className="font-bold mb-3">Team vote counts</h2>
        <div className="space-y-2">
          {teams.map((t) => {
            const n = submittedByTeam.get(t.id) ?? 0;
            const expected = Math.max(0, projects.length - (projectByTeam.has(t.id) ? 1 : 0));
            return (
              <div key={t.id} className="flex items-center justify-between text-sm border-b border-border/40 pb-2 last:border-0">
                <div className="min-w-0 truncate font-medium">{t.name}</div>
                <Badge variant={expected && n >= expected ? "default" : "secondary"} className="tabular-nums shrink-0">{n} / {expected} votes</Badge>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
