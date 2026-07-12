import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchActiveEvent } from "@/lib/auth-helpers";
import { computeResults, loadEventBundle } from "@/lib/scoring";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Lock } from "lucide-react";
import { motion } from "framer-motion";

export const Route = createFileRoute("/_authenticated/results")({
  head: () => ({ meta: [{ title: "Results — HackVote" }] }),
  component: ResultsPage,
});

function ResultsPage() {
  const q = useQuery({
    queryKey: ["public-results"],
    queryFn: async () => {
      const event = await fetchActiveEvent();
      if (!event) return null;
      const bundle = await loadEventBundle(event.id);
      if (!event.results_published) return { event, bundle, results: null };
      const { data: ballots } = await supabase
        .from("ballots")
        .select("id, project_id, voter_id, voter_team_id, status, ballot_scores(criterion_id, score)")
        .eq("event_id", event.id)
        .eq("status", "submitted");
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

  if (q.isLoading) return <div className="container mx-auto px-6 py-12">Loading...</div>;
  if (!q.data) return <div className="container mx-auto px-6 py-12"><Card className="p-8 glass text-center">No active event.</Card></div>;

  const { event, bundle, results } = q.data;

  if (!results) {
    return (
      <div className="container mx-auto px-4 sm:px-6 py-16 max-w-3xl">
        <Card className="p-10 glass text-center">
          <Lock className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
          <h1 className="text-3xl font-black">Results are locked</h1>
          <p className="mt-2 text-muted-foreground">Winners will be revealed by the admin. Hold tight!</p>
        </Card>
      </div>
    );
  }

  const projectById = new Map(bundle.projects.map((p) => [p.id, p]));
  const teamById = new Map(bundle.teams.map((t) => [t.id, t]));
  const numWinners = bundle.settings?.number_of_winners ?? 2;

  return (
    <div className="container mx-auto px-4 sm:px-6 py-8 max-w-4xl">
      <div className="text-center mb-10">
        <Trophy className="h-10 w-10 mx-auto text-primary mb-3" />
        <h1 className="text-5xl font-black">{event.name}</h1>
        <p className="text-muted-foreground mt-2">Final rankings</p>
      </div>
      <div className="space-y-3">
        {results.slice(0, numWinners * 3).map((r, i) => {
          const p = projectById.get(r.project_id);
          const t = p ? teamById.get(p.team_id) : null;
          const isWinner = i < numWinners;
          return (
            <motion.div key={r.project_id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className={`p-5 glass ${isWinner ? "gradient-border shadow-[var(--shadow-glow)]" : ""}`}>
                <div className="flex items-center gap-4">
                  <div className={`text-3xl font-black tabular-nums w-12 ${isWinner ? "gradient-text" : "text-muted-foreground"}`}>#{i + 1}</div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-lg font-bold truncate">{p?.title}</h3>
                    <p className="text-sm text-muted-foreground">{t?.name}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-black tabular-nums">{r.final_score.toFixed(1)}</div>
                    <Badge variant="outline" className="text-[10px]">{r.team_ballots} ballots</Badge>
                  </div>
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
