import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchActiveEvent } from "@/lib/auth-helpers";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useState } from "react";
import { Plus, Trash2, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/teams")({
  component: TeamsPage,
});

function TeamsPage() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin-teams"],
    queryFn: async () => {
      const event = await fetchActiveEvent();
      if (!event) return null;
      const [teams, projects, members, challenges] = await Promise.all([
        supabase.from("teams").select("*").eq("event_id", event.id),
        supabase.from("projects").select("*").eq("event_id", event.id),
        supabase.from("team_members").select("*"),
        supabase.from("challenges").select("*").eq("event_id", event.id),
      ]);
      return {
        event,
        teams: teams.data ?? [],
        projects: projects.data ?? [],
        members: members.data ?? [],
        challenges: challenges.data ?? [],
      };
    },
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    teamName: "", title: "", description: "", challenge_id: "",
    demo_url: "", github_url: "", table_number: "", emails: "",
  });

  async function create() {
    if (!q.data || !form.teamName || !form.title) return toast.error("Team & title required");
    const { data: team, error: e1 } = await supabase.from("teams").insert({ event_id: q.data.event.id, name: form.teamName }).select().single();
    if (e1) return toast.error(e1.message);
    const { error: e2 } = await supabase.from("projects").insert({
      event_id: q.data.event.id, team_id: team.id, title: form.title,
      description: form.description, challenge_id: form.challenge_id || null,
      demo_url: form.demo_url || null, github_url: form.github_url || null,
      table_number: form.table_number || null,
    });
    if (e2) return toast.error(e2.message);
    const emails = form.emails.split(/[,\n]/).map((e) => e.trim()).filter(Boolean);
    if (emails.length) {
      await supabase.from("team_members").insert(emails.map((email) => ({ team_id: team.id, email })));
    }
    toast.success("Team created");
    setForm({ teamName: "", title: "", description: "", challenge_id: "", demo_url: "", github_url: "", table_number: "", emails: "" });
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["admin-teams"] });
  }

  async function delTeam(id: string) {
    await supabase.from("teams").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin-teams"] });
  }

  if (!q.data) return <div>Loading...</div>;
  const membersByTeam = new Map<string, any[]>();
  for (const m of q.data.members) {
    if (!membersByTeam.has(m.team_id)) membersByTeam.set(m.team_id, []);
    membersByTeam.get(m.team_id)!.push(m);
  }
  const projectByTeam = new Map(q.data.projects.map((p) => [p.team_id, p]));
  const challengeById = new Map(q.data.challenges.map((c) => [c.id, c]));

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-black">Teams & projects</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" /> Add team</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>New team & project</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Team / individual name</Label><Input value={form.teamName} onChange={(e) => setForm({ ...form, teamName: e.target.value })} /></div>
              <div><Label>Project title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
              <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div><Label>Challenge</Label>
                <Select value={form.challenge_id} onValueChange={(v) => setForm({ ...form, challenge_id: v })}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>{q.data.challenges.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Demo URL</Label><Input value={form.demo_url} onChange={(e) => setForm({ ...form, demo_url: e.target.value })} /></div>
                <div><Label>GitHub</Label><Input value={form.github_url} onChange={(e) => setForm({ ...form, github_url: e.target.value })} /></div>
              </div>
              <div><Label>Table number</Label><Input value={form.table_number} onChange={(e) => setForm({ ...form, table_number: e.target.value })} /></div>
              <div><Label>Participant emails (comma or newline)</Label><Textarea value={form.emails} onChange={(e) => setForm({ ...form, emails: e.target.value })} rows={3} /></div>
              <Button onClick={create} className="w-full">Create</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <div className="grid gap-3">
        {q.data.teams.map((t) => {
          const p = projectByTeam.get(t.id);
          const members = membersByTeam.get(t.id) ?? [];
          const ch = p?.challenge_id ? challengeById.get(p.challenge_id) : null;
          return (
            <Card key={t.id} className="p-5 glass">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2"><Users className="h-4 w-4 text-primary" /><h3 className="font-bold">{t.name}</h3></div>
                  {p && <div className="mt-1"><div className="font-semibold">{p.title}</div><div className="text-sm text-muted-foreground">{p.description}</div></div>}
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {ch && <span>Challenge: {ch.name}</span>}
                    {p?.table_number && <span>Table {p.table_number}</span>}
                    <span>{members.length} member{members.length === 1 ? "" : "s"}</span>
                  </div>
                  {members.length > 0 && <div className="mt-2 text-xs text-muted-foreground">{members.map((m) => m.email).join(", ")}</div>}
                </div>
                <Button variant="ghost" size="icon" onClick={() => delTeam(t.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
