import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchActiveEvent } from "@/lib/auth-helpers";
import { computeResults, loadEventBundle } from "@/lib/scoring";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trophy, Play, Download } from "lucide-react";
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";

export const Route = createFileRoute("/_authenticated/admin/results")({
  component: AdminResults,
});

function AdminResults() {
  const q = useQuery({
    queryKey: ["admin-results"],
    queryFn: async () => {
      const event = await fetchActiveEvent();
      if (!event) return null;
      const bundle = await loadEventBundle(event.id);
      const { data: ballots } = await supabase
        .from("ballots")
        .select("id, project_id, voter_id, voter_team_id, status, ballot_scores(criterion_id, score)")
        .eq("event_id", event.id);
      const results = computeResults(
        (ballots ?? []) as any,
        bundle.criteria,
        {
          scaleMin: bundle.settings?.score_scale_min ?? 1,
          scaleMax: bundle.settings?.score_scale_max ?? 10,
          perTeam: (bundle.settings?.voting_power_mode ?? "per_team") === "per_team",
          minVotes: bundle.settings?.min_votes_per_project ?? 0,
        }
      );
      return { event, bundle, results };
    },
  });

  if (!q.data) return <div>Loading...</div>;
  const { event, bundle, results } = q.data;
  const projectById = new Map(bundle.projects.map((p) => [p.id, p]));
  const teamById = new Map(bundle.teams.map((t) => [t.id, t]));
  const numWinners = bundle.settings?.number_of_winners ?? 2;

  function exportCsv() {
    const rows = [["rank", "team", "project", "final_score", "ballots"].join(",")];
    results.forEach((r, i) => {
      const p = projectById.get(r.project_id);
      const t = p ? teamById.get(p.team_id) : null;
      rows.push([i + 1, JSON.stringify(t?.name ?? ""), JSON.stringify(p?.title ?? ""), r.final_score, r.team_ballots].join(","));
    });
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${event.name}-results.csv`;
    a.click();
  }

  const chartData = results.slice(0, 8).map((r) => {
    const p = projectById.get(r.project_id);
    return { name: p?.title?.slice(0, 20) ?? "?", score: r.final_score };
  });
  const top = results[0];
  const radarData = bundle.criteria.map((c) => ({
    criterion: c.name.split(" ")[0],
    value: top ? top.criterion_avgs[c.id] ?? 0 : 0,
  }));

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-black">Results</h1>
          <p className="text-muted-foreground text-sm">{results.length} eligible projects</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-2" /> Export CSV</Button>
          <Link to="/reveal"><Button className="shadow-[var(--shadow-glow)]"><Play className="h-4 w-4 mr-2" /> Launch reveal</Button></Link>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5 glass">
          <h2 className="font-bold mb-3">Top scores</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData}>
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Bar dataKey="score" fill="oklch(0.72 0.24 320)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card className="p-5 glass">
          <h2 className="font-bold mb-3">Winner category breakdown</h2>
          <ResponsiveContainer width="100%" height={280}>
            <RadarChart data={radarData}>
              <PolarGrid />
              <PolarAngleAxis dataKey="criterion" tick={{ fontSize: 10 }} />
              <Radar dataKey="value" stroke="oklch(0.72 0.24 320)" fill="oklch(0.72 0.24 320)" fillOpacity={0.4} />
            </RadarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card className="p-5 glass">
        <h2 className="font-bold mb-3">Full rankings</h2>
        <div className="space-y-2">
          {results.map((r, i) => {
            const p = projectById.get(r.project_id);
            const t = p ? teamById.get(p.team_id) : null;
            const isWinner = i < numWinners;
            return (
              <div key={r.project_id} className={`flex items-center gap-3 rounded-lg p-3 ${isWinner ? "bg-primary/10 border border-primary/30" : "border border-border/40"}`}>
                <div className={`text-xl font-black tabular-nums w-8 ${isWinner ? "gradient-text" : "text-muted-foreground"}`}>#{i + 1}</div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold truncate">{p?.title}</div>
                  <div className="text-xs text-muted-foreground">{t?.name}</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-black tabular-nums">{r.final_score.toFixed(1)}</div>
                  <Badge variant="outline" className="text-[10px]">{r.team_ballots} ballots</Badge>
                </div>
                {isWinner && <Trophy className="h-4 w-4 text-primary" />}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
