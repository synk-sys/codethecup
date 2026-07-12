import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchActiveEvent } from "@/lib/auth-helpers";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Users, ClipboardCheck, Target, Award, Play, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminDash,
});

function AdminDash() {
  const q = useQuery({
    queryKey: ["admin-dash"],
    queryFn: async () => {
      const event = await fetchActiveEvent();
      if (!event) return null;
      const [{ count: teamsCount }, { count: projectsCount }, { data: ballots }, { count: challengesCount }] = await Promise.all([
        supabase.from("teams").select("id", { count: "exact", head: true }).eq("event_id", event.id),
        supabase.from("projects").select("id", { count: "exact", head: true }).eq("event_id", event.id),
        supabase.from("ballots").select("id, status").eq("event_id", event.id),
        supabase.from("challenges").select("id", { count: "exact", head: true }).eq("event_id", event.id),
      ]);
      const submitted = (ballots ?? []).filter((b) => b.status === "submitted").length;
      const drafts = (ballots ?? []).filter((b) => b.status === "draft").length;
      return { event, teamsCount: teamsCount ?? 0, projectsCount: projectsCount ?? 0, submitted, drafts, challengesCount: challengesCount ?? 0 };
    },
  });

  async function makeMeAdmin() {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    const { error } = await supabase.from("user_roles").insert({ user_id: data.user.id, role: "admin" });
    if (error) toast.error(error.message);
    else toast.success("You are now an admin — refresh to see admin nav.");
  }

  if (q.isLoading) return <div>Loading...</div>;
  if (!q.data) {
    return (
      <Card className="p-8 glass text-center">
        <h2 className="text-xl font-bold">No active event</h2>
        <Button onClick={makeMeAdmin} className="mt-4">Grant myself admin</Button>
      </Card>
    );
  }

  const { event, teamsCount, projectsCount, submitted, drafts, challengesCount } = q.data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-black">{event.name}</h1>
        <p className="text-muted-foreground">{event.description}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Users} label="Teams" value={teamsCount} />
        <Stat icon={Target} label="Projects" value={projectsCount} />
        <Stat icon={ClipboardCheck} label="Votes submitted" value={submitted} sub={`${drafts} drafts`} />
        <Stat icon={Award} label="Challenges" value={challengesCount} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <QuickLink to="/admin/teams" title="Add teams & projects" body="Roster your teams and their submissions." />
        <QuickLink to="/admin/criteria" title="Tune the rubric" body="Edit weights, criteria, and score scale." />
        <QuickLink to="/admin/monitor" title="Watch live progress" body="Track who has voted." />
        <QuickLink to="/admin/results" title="Reveal winners" body="Launch the fullscreen reveal show." icon={Play} />
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, sub }: any) {
  return (
    <Card className="p-5 glass">
      <Icon className="h-5 w-5 text-primary mb-2" />
      <div className="text-3xl font-black tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground">{label}{sub && ` • ${sub}`}</div>
    </Card>
  );
}

function QuickLink({ to, title, body, icon: Icon }: any) {
  return (
    <Link to={to} className="group">
      <Card className="p-5 glass hover:border-primary/60 transition h-full">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-bold">{title}</h3>
            <p className="text-sm text-muted-foreground mt-1">{body}</p>
          </div>
          {Icon ? <Icon className="h-5 w-5 text-primary" /> : <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition" />}
        </div>
      </Card>
    </Link>
  );
}
