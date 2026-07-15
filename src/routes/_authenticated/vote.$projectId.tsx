import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { loadEventBundle, weightedScore, scoreLabel, type Criterion } from "@/lib/scoring";
import { fetchActiveEvent } from "@/lib/auth-helpers";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ExternalLink, Github, Save, Send, Sparkles, CheckCircle2 } from "lucide-react";
import confetti from "canvas-confetti";

export const Route = createFileRoute("/_authenticated/vote/$projectId")({
  head: () => ({ meta: [{ title: "Vote — Code the Cup" }] }),
  component: VotePage,
});

function VotePage() {
  const { projectId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["vote-project", projectId],
    queryFn: async () => {
      const event = await fetchActiveEvent();
      if (!event) throw new Error("No active event");
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes.user!.id;
      const bundle = await loadEventBundle(event.id);
      const project = bundle.projects.find((p) => p.id === projectId);
      if (!project) throw new Error("Project not found");
      const team = bundle.teams.find((t) => t.id === project.team_id);
      const challenge = bundle.challenges.find((c) => c.id === project.challenge_id);
      const { data: members } = await supabase.from("team_members").select("name, email").eq("team_id", project.team_id);
      const { data: ballot } = await supabase
        .from("ballots")
        .select("id, status, ballot_scores(criterion_id, score)")
        .eq("project_id", projectId)
        .eq("voter_id", userId)
        .maybeSingle();
      return { event, project, team, challenge, members: members ?? [], bundle, ballot, userId };
    },
  });

  const [scores, setScores] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (q.data?.ballot?.ballot_scores) {
      const s: Record<string, number> = {};
      for (const row of q.data.ballot.ballot_scores) {
        s[row.criterion_id] = Number(row.score);
      }
      setScores(s);
    }
  }, [q.data?.ballot?.id]);

  const preview = useMemo(() => {
    if (!q.data) return 0;
    const { bundle } = q.data;
    const rows = Object.entries(scores).map(([criterion_id, score]) => ({ criterion_id, score }));
    return weightedScore(rows, bundle.criteria, bundle.settings?.score_scale_min ?? 1, bundle.settings?.score_scale_max ?? 10);
  }, [scores, q.data]);

  if (q.isLoading) return <div className="container mx-auto px-6 py-12">Loading...</div>;
  if (q.error) return <div className="container mx-auto px-6 py-12">Error: {(q.error as Error).message}</div>;
  if (!q.data) return null;

  const { event, project, team, challenge, members, bundle, ballot, userId } = q.data;
  const settings = bundle.settings;
  const submitted = ballot?.status === "submitted";
  const votingClosed = event.voting_end ? new Date(event.voting_end) < new Date() : false;
  const canEdit = !votingClosed && (!submitted || (settings?.allow_vote_edits ?? true));
  const allScored = bundle.criteria.every((c) => scores[c.id] != null);

  async function persist(status: "draft" | "submitted") {
    if (!q.data) return;
    setSaving(true);
    try {
      const payload = {
        event_id: event.id,
        project_id: projectId,
        voter_id: userId,
        status,
        submitted_at: status === "submitted" ? new Date().toISOString() : null,
      };
      const { data: b, error } = await supabase
        .from("ballots")
        .upsert(payload, { onConflict: "voter_id,project_id" })
        .select("id")
        .single();
      if (error) throw error;

      const rows = bundle.criteria
        .filter((c) => scores[c.id] != null)
        .map((c) => ({
          ballot_id: b.id,
          criterion_id: c.id,
          score: scores[c.id],
        }));

      if (rows.length) {
        const { error: scErr } = await supabase
          .from("ballot_scores")
          .upsert(rows, { onConflict: "ballot_id,criterion_id" });
        if (scErr) throw scErr;
      }

      qc.invalidateQueries();
      if (status === "submitted") {
        setShowSuccess(true);
        confetti({ particleCount: 120, spread: 90, origin: { y: 0.6 }, colors: ["#4285F4", "#EA4335", "#FBBC05", "#34A853"] });
        setTimeout(() => navigate({ to: "/vote" }), 1800);
      } else {
        toast.success("Draft saved");
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="container mx-auto px-4 sm:px-6 py-6 max-w-4xl">
      <Link to="/vote" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="h-4 w-4" /> Back to teams
      </Link>

      <Card className="p-6 glass mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            {challenge && (
              <Badge variant="outline" className="mb-2 gap-1.5">
                {challenge.name}
              </Badge>
            )}
            <h1 className="text-3xl font-black leading-tight">{project.title || team?.name}</h1>
            {project.title && <p className="text-muted-foreground mt-1">{team?.name}</p>}
            {project.description && <p className="mt-4 text-sm leading-relaxed">{project.description}</p>}
          </div>
          {project.image_url && (
            <img src={project.image_url} alt="" className="h-24 w-24 rounded-xl object-cover shrink-0" />
          )}
        </div>
        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          {project.demo_url && <a href={project.demo_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline"><ExternalLink className="h-3.5 w-3.5" /> Demo</a>}
          {project.github_url && <a href={project.github_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline"><Github className="h-3.5 w-3.5" /> Code</a>}
        </div>
        {members.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border/60">
            <div className="text-xs text-muted-foreground mb-1">Team members</div>
            <div className="text-sm">{members.map((m) => m.name || m.email).join(" • ")}</div>
          </div>
        )}
      </Card>

      <RubricCard criteria={bundle.criteria} scaleMin={settings?.score_scale_min ?? 1} scaleMax={settings?.score_scale_max ?? 10} />

      <div className="mt-6 space-y-4">
        {bundle.criteria.map((c, idx) => (
          <CriterionCard
            key={c.id}
            index={idx + 1}
            criterion={c}
            score={scores[c.id]}
            scaleMin={settings?.score_scale_min ?? 1}
            scaleMax={settings?.score_scale_max ?? 10}
            disabled={!canEdit}
            onScore={(v) => setScores((s) => ({ ...s, [c.id]: v }))}
          />
        ))}
      </div>

      <motion.div
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        className="sticky bottom-4 mt-6 z-30"
      >
        <Card className="p-4 glass gradient-border shadow-[var(--shadow-elevated)]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground">Live weighted score</div>
              <div className="text-3xl font-black tabular-nums gradient-text">{preview.toFixed(1)}<span className="text-lg text-muted-foreground">/100</span></div>
            </div>
            <div className="flex flex-wrap gap-2">
              {canEdit && (
                <Button variant="outline" onClick={() => persist("draft")} disabled={saving}>
                  <Save className="h-4 w-4 mr-2" /> Save draft
                </Button>
              )}
              {canEdit && (
                <Button onClick={() => persist("submitted")} disabled={saving || !allScored} className="font-semibold">
                  <Send className="h-4 w-4 mr-2" /> {submitted ? "Update vote" : "Submit vote"}
                </Button>
              )}
              {!canEdit && submitted && <Badge className="bg-success/20 text-success border-success/40 border"><CheckCircle2 className="h-3 w-3 mr-1" /> Submitted</Badge>}
              {!canEdit && !submitted && <Badge variant="secondary">Voting closed</Badge>}
            </div>
          </div>
        </Card>
      </motion.div>

      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 grid place-items-center bg-background/80 backdrop-blur"
          >
            <motion.div initial={{ scale: 0.7 }} animate={{ scale: 1 }} className="text-center">
              <div className="grid h-24 w-24 place-items-center rounded-full bg-success/20 mx-auto mb-6 animate-pulse-glow">
                <CheckCircle2 className="h-12 w-12 text-success" />
              </div>
              <h2 className="text-4xl font-black gradient-text">Vote submitted!</h2>
              <p className="mt-2 text-muted-foreground">Thanks for keeping the arena fair.</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function RubricCard({ criteria, scaleMin, scaleMax }: { criteria: Criterion[]; scaleMin: number; scaleMax: number }) {
  const total = criteria.reduce((s, c) => s + Number(c.weight), 0);
  return (
    <Card className="p-5 glass">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="h-4 w-4 text-primary" />
        <h2 className="font-bold">Judging rubric</h2>
        <Badge variant="outline" className="ml-auto text-xs">Scale {scaleMin}–{scaleMax}</Badge>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {criteria.map((c) => (
          <div key={c.id} className="flex items-start justify-between gap-3 text-sm">
            <div>
              <div className="font-medium">{c.name}</div>
              {c.description && <div className="text-xs text-muted-foreground line-clamp-2">{c.description}</div>}
            </div>
            <Badge variant="secondary" className="shrink-0 tabular-nums">{Number(c.weight)}%</Badge>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Final score = Σ (normalized score × weight ÷ {total}%), reported out of 100.</p>
    </Card>
  );
}

function CriterionCard({
  index, criterion, score, scaleMin, scaleMax, disabled, onScore,
}: {
  index: number;
  criterion: Criterion;
  score: number | undefined;
  scaleMin: number;
  scaleMax: number;
  disabled: boolean;
  onScore: (v: number) => void;
}) {
  const values = Array.from({ length: scaleMax - scaleMin + 1 }, (_, i) => scaleMin + i);
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.03 }}>
      <Card className="p-5 glass">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-muted-foreground">#{index}</span>
              <h3 className="text-lg font-bold">{criterion.name}</h3>
              <Badge variant="secondary">{Number(criterion.weight)}%</Badge>
            </div>
            {criterion.description && <p className="text-sm text-muted-foreground mt-1">{criterion.description}</p>}
          </div>
          {score != null && (
            <div className="text-right shrink-0">
              <div className="text-3xl font-black tabular-nums gradient-text">{score}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{scoreLabel(score)}</div>
            </div>
          )}
        </div>
        <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
          {values.map((v) => {
            const active = score === v;
            return (
              <button
                key={v}
                type="button"
                disabled={disabled}
                onClick={() => onScore(v)}
                className={`h-10 rounded-lg text-sm font-bold tabular-nums transition ${
                  active ? "bg-primary text-primary-foreground shadow-[var(--shadow-glow)] scale-105" : "bg-muted hover:bg-muted/70"
                } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                {v}
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex justify-between text-[10px] text-muted-foreground">
          <span>Poor</span><span>Below avg</span><span>Good</span><span>Very good</span><span>Excellent</span>
        </div>
      </Card>
    </motion.div>
  );
}
