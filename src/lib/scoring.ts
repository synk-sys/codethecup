import { supabase } from "@/integrations/supabase/client";

export type Criterion = { id: string; name: string; description: string | null; weight: number; sort_order: number };
export type ScoreRow = { criterion_id: string; score: number };
export type Project = { id: string; event_id: string; team_id: string; title: string; description: string | null; challenge_id: string | null; demo_url: string | null; github_url: string | null; table_number: string | null; image_url: string | null };

export function weightedScore(scores: ScoreRow[], criteria: Criterion[], scaleMin = 1, scaleMax = 10): number {
  const range = scaleMax - scaleMin;
  const byId = new Map(scores.map((s) => [s.criterion_id, s.score]));
  const totalWeight = criteria.reduce((s, c) => s + Number(c.weight), 0) || 100;
  let sum = 0;
  for (const c of criteria) {
    const raw = byId.get(c.id);
    if (raw == null) continue;
    const normalized = ((raw - scaleMin) / range) * 100;
    sum += normalized * (Number(c.weight) / totalWeight);
  }
  return Math.round(sum * 10) / 10;
}

/**
 * Compute final rankings across projects using submitted ballots.
 * Returns projects sorted by final score.
 */
export type BallotAgg = {
  project_id: string;
  team_ballots: number;
  final_score: number;
  criterion_avgs: Record<string, number>; // criterion_id -> avg /100
};

type BallotWithScores = {
  id: string;
  project_id: string;
  voter_team_id: string | null;
  voter_id: string;
  status: string;
  ballot_scores: { criterion_id: string; score: number }[];
};

export function computeResults(
  ballots: BallotWithScores[],
  criteria: Criterion[],
  opts: { scaleMin: number; scaleMax: number; perTeam: boolean; minVotes: number }
): BallotAgg[] {
  const submitted = ballots.filter((b) => b.status === "submitted");
  // Compute a normalized 0-100 weighted score per ballot
  const perBallot = submitted.map((b) => ({
    project_id: b.project_id,
    team: b.voter_team_id ?? `solo:${b.voter_id}`,
    weighted: weightedScore(b.ballot_scores as ScoreRow[], criteria, opts.scaleMin, opts.scaleMax),
    scores: new Map(b.ballot_scores.map((s) => [s.criterion_id, s.score])),
  }));

  // Group by project
  const byProject = new Map<string, typeof perBallot>();
  for (const b of perBallot) {
    if (!byProject.has(b.project_id)) byProject.set(b.project_id, []);
    byProject.get(b.project_id)!.push(b);
  }

  const results: BallotAgg[] = [];
  for (const [pid, list] of byProject) {
    // If per-team, average by team first
    let effective = list;
    if (opts.perTeam) {
      const groups = new Map<string, typeof list>();
      for (const b of list) {
        if (!groups.has(b.team)) groups.set(b.team, []);
        groups.get(b.team)!.push(b);
      }
      effective = Array.from(groups.values()).map((g) => ({
        project_id: pid,
        team: g[0].team,
        weighted: g.reduce((s, x) => s + x.weighted, 0) / g.length,
        scores: averageScoreMaps(g.map((x) => x.scores)),
      }));
    }
    const finalScore = effective.reduce((s, x) => s + x.weighted, 0) / (effective.length || 1);
    const critAvg: Record<string, number> = {};
    for (const c of criteria) {
      const vals = effective.map((e) => e.scores.get(c.id)).filter((v): v is number => v != null);
      if (vals.length) {
        const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
        // normalize to /100
        critAvg[c.id] = Math.round(((avg - opts.scaleMin) / (opts.scaleMax - opts.scaleMin)) * 1000) / 10;
      }
    }
    results.push({
      project_id: pid,
      team_ballots: effective.length,
      final_score: Math.round(finalScore * 10) / 10,
      criterion_avgs: critAvg,
    });
  }

  return results
    .filter((r) => r.team_ballots >= opts.minVotes)
    .sort((a, b) => b.final_score - a.final_score);
}

function averageScoreMaps(maps: Map<string, number>[]): Map<string, number> {
  const acc = new Map<string, { s: number; n: number }>();
  for (const m of maps) {
    for (const [k, v] of m) {
      const cur = acc.get(k) ?? { s: 0, n: 0 };
      cur.s += v; cur.n += 1;
      acc.set(k, cur);
    }
  }
  return new Map(Array.from(acc, ([k, { s, n }]) => [k, s / n]));
}

export async function loadEventBundle(eventId: string) {
  const [criteria, settings, projects, teams, challenges] = await Promise.all([
    supabase.from("criteria").select("*").eq("event_id", eventId).order("sort_order"),
    supabase.from("event_settings").select("*").eq("event_id", eventId).maybeSingle(),
    supabase.from("projects").select("*").eq("event_id", eventId),
    supabase.from("teams").select("*").eq("event_id", eventId),
    supabase.from("challenges").select("*").eq("event_id", eventId).order("sort_order"),
  ]);
  return {
    criteria: (criteria.data ?? []) as Criterion[],
    settings: settings.data,
    projects: (projects.data ?? []) as Project[],
    teams: teams.data ?? [],
    challenges: challenges.data ?? [],
  };
}
