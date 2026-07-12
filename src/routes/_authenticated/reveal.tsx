import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchActiveEvent } from "@/lib/auth-helpers";
import { computeResults, loadEventBundle } from "@/lib/scoring";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import confetti from "canvas-confetti";
import { Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/reveal")({
  component: RevealPage,
});

type Stage = "title" | "countdown" | "second" | "first" | "podium";

function RevealPage() {
  const q = useQuery({
    queryKey: ["reveal"],
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

  const [stage, setStage] = useState<Stage>("title");
  const [count, setCount] = useState(5);

  const stages: Stage[] = ["title", "countdown", "second", "first", "podium"];
  function next() {
    const idx = stages.indexOf(stage);
    if (idx < stages.length - 1) setStage(stages[idx + 1]);
  }
  function prev() {
    const idx = stages.indexOf(stage);
    if (idx > 0) setStage(stages[idx - 1]);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); next(); }
      if (e.key === "ArrowLeft") prev();
      if (e.key === "f") document.documentElement.requestFullscreen?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stage]);

  useEffect(() => {
    if (stage === "countdown") {
      setCount(5);
      const t = setInterval(() => setCount((c) => (c <= 1 ? (clearInterval(t), 0) : c - 1)), 1000);
      return () => clearInterval(t);
    }
    if (stage === "first" || stage === "podium") {
      confetti({ particleCount: 200, spread: 120, origin: { y: 0.6 }, colors: ["#e879f9", "#22d3ee", "#facc15", "#4ade80"] });
    }
  }, [stage]);

  if (!q.data) return <div className="min-h-screen grid place-items-center">Loading...</div>;
  const { event, bundle, results } = q.data;
  const projectById = new Map(bundle.projects.map((p) => [p.id, p]));
  const teamById = new Map(bundle.teams.map((t) => [t.id, t]));
  const first = results[0];
  const second = results[1];

  return (
    <div className="fixed inset-0 z-50 bg-background grid place-items-center overflow-hidden" style={{ backgroundImage: "var(--gradient-stage)" }}>
      <AnimatePresence mode="wait">
        {stage === "title" && (
          <motion.div key="title" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="text-center px-6">
            <Trophy className="h-20 w-20 mx-auto text-primary mb-6 animate-pulse-glow" />
            <h1 className="text-7xl md:text-9xl font-black gradient-text">{event.name}</h1>
            <p className="mt-4 text-2xl text-muted-foreground">The results are in</p>
          </motion.div>
        )}
        {stage === "countdown" && (
          <motion.div key="cd" className="text-center">
            <motion.div key={count} initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 2, opacity: 0 }} className="text-[16rem] font-black gradient-text leading-none">
              {count || "GO"}
            </motion.div>
          </motion.div>
        )}
        {stage === "second" && second && <WinnerCard rank={2} r={second} projectById={projectById} teamById={teamById} />}
        {stage === "first" && first && <WinnerCard rank={1} r={first} projectById={projectById} teamById={teamById} />}
        {stage === "podium" && (
          <motion.div key="podium" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="text-center">
            <h2 className="text-5xl font-black mb-8 gradient-text">Winners</h2>
            <div className="flex items-end justify-center gap-6">
              {second && <PodiumCol rank={2} height="h-40" r={second} projectById={projectById} teamById={teamById} />}
              {first && <PodiumCol rank={1} height="h-56" r={first} projectById={projectById} teamById={teamById} />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-10">
        <Button variant="secondary" onClick={prev} disabled={stage === "title"}>Back</Button>
        <Button onClick={next} disabled={stage === "podium"} className="shadow-[var(--shadow-glow)]">
          {stage === "title" ? "Start countdown" : stage === "countdown" ? "Reveal 2nd" : stage === "second" ? "Reveal 1st" : "Show podium"}
        </Button>
      </div>
      <div className="fixed top-4 right-4 text-xs text-muted-foreground">Space/→ next • ← back • F fullscreen</div>
    </div>
  );
}

function WinnerCard({ rank, r, projectById, teamById }: any) {
  const p = projectById.get(r.project_id);
  const t = p ? teamById.get(p.team_id) : null;
  return (
    <motion.div initial={{ scale: 0.6, opacity: 0, rotateX: -30 }} animate={{ scale: 1, opacity: 1, rotateX: 0 }} exit={{ scale: 0.8, opacity: 0 }} transition={{ type: "spring", damping: 12 }} className="text-center px-6">
      <div className="text-3xl font-black text-muted-foreground mb-4">#{rank}</div>
      <div className="text-2xl uppercase tracking-widest text-primary mb-2">{rank === 1 ? "First Place" : "Second Place"}</div>
      <h2 className="text-7xl md:text-8xl font-black gradient-text leading-none">{p?.title}</h2>
      <p className="mt-6 text-3xl font-semibold">{t?.name}</p>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="mt-8 text-6xl font-black tabular-nums">
        {r.final_score.toFixed(1)}<span className="text-2xl text-muted-foreground">/100</span>
      </motion.div>
    </motion.div>
  );
}

function PodiumCol({ rank, height, r, projectById, teamById }: any) {
  const p = projectById.get(r.project_id);
  const t = p ? teamById.get(p.team_id) : null;
  return (
    <div className="w-64 text-center">
      <div className="mb-3">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">{rank === 1 ? "1st" : "2nd"}</div>
        <div className="font-bold text-lg line-clamp-2">{p?.title}</div>
        <div className="text-sm text-muted-foreground">{t?.name}</div>
        <div className="text-2xl font-black tabular-nums mt-1">{r.final_score.toFixed(1)}</div>
      </div>
      <div className={`${height} rounded-t-xl gradient-border`} style={{ background: rank === 1 ? "var(--gradient-hero)" : "var(--gradient-cool)" }} />
    </div>
  );
}
