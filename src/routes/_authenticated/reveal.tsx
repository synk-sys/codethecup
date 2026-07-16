import { createFileRoute, useNavigate } from "@tanstack/react-router";
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

type Stage = "title" | "countdown" | "third" | "second" | "first" | "podium";

function RevealPage() {
  const navigate = useNavigate();
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

  const stages: Stage[] = ["title", "countdown", "third", "second", "first", "podium"];
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
      if (e.key === "Escape") {
        if (document.fullscreenElement) document.exitFullscreen?.();
        navigate({ to: "/admin/results" });
      }
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
      confetti({ particleCount: 200, spread: 120, origin: { y: 0.6 }, colors: ["#4285F4", "#EA4335", "#FBBC05", "#34A853"] });
    }
  }, [stage]);

  if (!q.data) return <div className="min-h-screen grid place-items-center">Loading...</div>;
  const { event, bundle, results } = q.data;
  const projectById = new Map(bundle.projects.map((p) => [p.id, p]));
  const teamById = new Map(bundle.teams.map((t) => [t.id, t]));
  const first = results[0];
  const second = results[1];
  const third = results[2];

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
        {stage === "third" && third && <WinnerCard rank={3} r={third} projectById={projectById} teamById={teamById} />}
        {stage === "second" && second && <WinnerCard rank={2} r={second} projectById={projectById} teamById={teamById} />}
        {stage === "first" && first && <WinnerCard rank={1} r={first} projectById={projectById} teamById={teamById} />}
        {stage === "podium" && (
          <motion.div key="podium" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="text-center">
            <h2 className="text-5xl font-black mb-8 gradient-text">Winners</h2>
            <div className="flex items-end justify-center gap-6">
              {second && <PodiumCol rank={2} height="h-40" r={second} projectById={projectById} teamById={teamById} />}
              {first && <PodiumCol rank={1} height="h-56" r={first} projectById={projectById} teamById={teamById} />}
              {third && <PodiumCol rank={3} height="h-28" r={third} projectById={projectById} teamById={teamById} />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-10">
        <Button variant="secondary" onClick={prev} disabled={stage === "title"}>Back</Button>
        <Button onClick={next} disabled={stage === "podium"} className="shadow-[var(--shadow-glow)]">
          {stage === "title" ? "Start countdown" : stage === "countdown" ? "Reveal 3rd" : stage === "third" ? "Reveal 2nd" : stage === "second" ? "Reveal 1st" : "Show podium"}
        </Button>
      </div>
    </div>
  );
}

function WinnerCard({ rank, r, projectById, teamById }: any) {
  const p = projectById.get(r.project_id);
  const t = p ? teamById.get(p.team_id) : null;
  return (
    <motion.div initial={{ scale: 0.6, opacity: 0, rotateX: -30 }} animate={{ scale: 1, opacity: 1, rotateX: 0 }} exit={{ scale: 0.8, opacity: 0 }} transition={{ type: "spring", damping: 12 }} className="text-center px-6">
      <div className="text-3xl font-black text-muted-foreground mb-4">#{rank}</div>
      <div className="text-2xl uppercase tracking-widest text-primary mb-2">{rank === 1 ? "First Place" : rank === 2 ? "Second Place" : "Third Place"}</div>
      <h2 className="text-7xl md:text-8xl font-black gradient-text leading-none">{t?.name}</h2>
    </motion.div>
  );
}

function PodiumCol({ rank, height, r, projectById, teamById }: any) {
  const p = projectById.get(r.project_id);
  const t = p ? teamById.get(p.team_id) : null;
  return (
    <div className="w-64 text-center">
      <div className="mb-3">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">{rank === 1 ? "1st" : rank === 2 ? "2nd" : "3rd"}</div>
        <div className="font-bold text-lg line-clamp-2">{t?.name}</div>
      </div>
      <div className={`${height} rounded-t-xl gradient-border`} style={{ background: rank === 1 ? "var(--gradient-hero)" : rank === 2 ? "var(--gradient-cool)" : "var(--gradient-warm, var(--gradient-cool))" }} />
    </div>
  );
}
