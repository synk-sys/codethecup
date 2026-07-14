import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchActiveEvent } from "@/lib/auth-helpers";
import { loadEventBundle } from "@/lib/scoring";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, ArrowRight, Ban, CheckCircle2, Clock, Circle } from "lucide-react";
import { useState } from "react";
import { motion } from "framer-motion";

export const Route = createFileRoute("/_authenticated/vote/")({
  head: () => ({ meta: [{ title: "Vote — Code the Cup" }] }),
  component: VoteDashboard,
});

type BallotSummary = { id: string; project_id: string; status: "draft" | "submitted" };

function VoteDashboard() {
  const [search, setSearch] = useState("");
  const [challenge, setChallenge] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const q = useQuery({
    queryKey: ["vote-dashboard"],
    queryFn: async () => {
      const event = await fetchActiveEvent();
      if (!event) return null;
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes.user!.id;
      const bundle = await loadEventBundle(event.id);
      const { data: myTeamId } = await supabase.rpc("get_user_team", { _user_id: userId, _event_id: event.id });
      const { data: ballots } = await supabase
        .from("ballots")
        .select("id, project_id, status")
        .eq("event_id", event.id)
        .eq("voter_id", userId);
      return { event, ...bundle, myTeamId, ballots: (ballots ?? []) as BallotSummary[] };
    },
  });

  if (q.isLoading) return <PageShell><SkeletonCards /></PageShell>;
  if (!q.data) return <PageShell><EmptyState title="No active event" body="An admin has not started an event yet." /></PageShell>;

  const { event, projects, teams, challenges, myTeamId, ballots, settings } = q.data;
  const now = new Date();
  const votingClosed = event.voting_end ? new Date(event.voting_end) < now : false;

  const eligible = projects.filter((p) => p.team_id !== myTeamId);
  const ballotByProject = new Map(ballots.map((b) => [b.project_id, b]));
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const challengeById = new Map(challenges.map((c) => [c.id, c]));

  const filtered = eligible.filter((p) => {
    if (challenge !== "all" && p.challenge_id !== challenge) return false;
    const b = ballotByProject.get(p.id);
    const status = b?.status === "submitted" ? "submitted" : b?.status === "draft" ? "draft" : "not-voted";
    if (statusFilter !== "all" && statusFilter !== status) return false;
    if (search) {
      const needle = search.toLowerCase();
      const t = teamById.get(p.team_id);
      if (!(p.title ?? "").toLowerCase().includes(needle) && !(t?.name.toLowerCase().includes(needle))) return false;
    }
    return true;
  });

  const submitted = ballots.filter((b) => b.status === "submitted").length;
  const total = eligible.length;
  const pct = total ? Math.round((submitted / total) * 100) : 0;

  return (
    <PageShell>
      <div className="mb-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black">{event.name}</h1>
            <p className="text-muted-foreground mt-1">{event.description}</p>
          </div>
          {votingClosed && <Badge variant="secondary" className="text-sm">Voting closed</Badge>}
        </div>

        <Card className="mt-6 p-5 glass">
          <div className="flex items-center justify-between text-sm font-medium">
            <span>Your progress</span>
            <span className="tabular-nums">{submitted} of {total} projects evaluated</span>
          </div>
          <Progress value={pct} className="mt-3 h-3" />
          {settings && submitted < total && !votingClosed && (
            <p className="mt-2 text-xs text-muted-foreground">
              Keep going — every vote counts. Scoring uses {settings.score_scale_min}–{settings.score_scale_max}.
            </p>
          )}
        </Card>
      </div>

      <div className="mb-6 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search projects or teams..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={challenge} onValueChange={setChallenge}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All challenges</SelectItem>
            {challenges.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="not-voted">Not voted</SelectItem>
            <SelectItem value="draft">Draft saved</SelectItem>
            <SelectItem value="submitted">Submitted</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No projects match" body="Try clearing filters or search." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p, i) => {
            const b = ballotByProject.get(p.id);
            const status = b?.status === "submitted" ? "submitted" : b?.status === "draft" ? "draft" : "not-voted";
            const team = teamById.get(p.team_id);
            const ch = p.challenge_id ? challengeById.get(p.challenge_id) : null;
            return (
              <motion.div key={p.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                <Link
                  to="/vote/$projectId"
                  params={{ projectId: p.id }}
                  className="block group"
                >
                  <Card className="p-5 h-full flex flex-col hover:border-primary/60 transition glass hover:shadow-[var(--shadow-glow)]">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <StatusBadge status={status} />
                      {ch && (
                        <Badge variant="outline" className="text-[10px] gap-1.5">
                          {ch.name}
                        </Badge>
                      )}
                    </div>
                    <h3 className="text-lg font-bold leading-tight line-clamp-2">{p.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{team?.name}</p>
                    {p.description && <p className="text-sm text-muted-foreground/80 mt-3 line-clamp-3">{p.description}</p>}
                    <div className="mt-4 pt-4 border-t border-border/60 flex items-center justify-end text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1 font-semibold text-primary group-hover:gap-2 transition-all">
                        {status === "submitted" ? "View" : "Vote"} <ArrowRight className="h-3 w-3" />
                      </span>
                    </div>
                  </Card>
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}

      {eligible.length < projects.length && myTeamId && (
        <Card className="mt-8 p-4 glass flex items-center gap-3 text-sm">
          <Ban className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-muted-foreground">Your team's own project isn't shown — you can't vote for yourself.</span>
        </Card>
      )}
    </PageShell>
  );
}

function StatusBadge({ status }: { status: "not-voted" | "draft" | "submitted" }) {
  if (status === "submitted") return <Badge className="bg-success/20 text-success border-success/30 border"><CheckCircle2 className="h-3 w-3 mr-1" /> Submitted</Badge>;
  if (status === "draft") return <Badge className="bg-warning/20 text-warning-foreground border-warning/40 border"><Clock className="h-3 w-3 mr-1" /> Draft</Badge>;
  return <Badge variant="outline"><Circle className="h-3 w-3 mr-1" /> Not voted</Badge>;
}

function PageShell({ children }: { children: React.ReactNode }) {
  return <div className="container mx-auto px-4 sm:px-6 py-8 max-w-6xl">{children}</div>;
}

function SkeletonCards() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-56 rounded-2xl bg-muted/30 animate-pulse" />)}
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <Card className="p-12 text-center glass">
      <h3 className="text-lg font-bold">{title}</h3>
      <p className="text-sm text-muted-foreground mt-1">{body}</p>
    </Card>
  );
}

