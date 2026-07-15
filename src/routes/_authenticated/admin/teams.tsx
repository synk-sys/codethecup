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
import { Plus, Trash2, Pencil, Trophy, Shirt, RefreshCw, Unlink } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/teams")({
  component: TeamsPage,
});

function randomPasscode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function TeamsPage() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin-teams"],
    queryFn: async () => {
      const event = await fetchActiveEvent();
      if (!event) return null;
      const [teams, projects, members, challenges, passcodes] = await Promise.all([
        supabase.from("teams").select("*").eq("event_id", event.id),
        supabase.from("projects").select("*").eq("event_id", event.id),
        supabase.from("team_members").select("*"),
        supabase.from("challenges").select("*").eq("event_id", event.id),
        supabase.from("team_passcodes").select("*"),
      ]);
      return {
        event,
        teams: teams.data ?? [],
        projects: projects.data ?? [],
        members: members.data ?? [],
        challenges: challenges.data ?? [],
        passcodes: passcodes.data ?? [],
      };
    },
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    teamName: "", title: "", description: "", challenge_id: "",
    demo_url: "", github_url: "", table_number: "", names: "", noProject: false,
  });

  async function create() {
    if (!q.data || !form.teamName.trim()) return toast.error("Team / individual name required");
    const { data: team, error: e1 } = await supabase.from("teams").insert({ event_id: q.data.event.id, name: form.teamName }).select().single();
    if (e1) return toast.error(e1.message);
    await supabase.from("team_passcodes").insert({ team_id: team.id, passcode: randomPasscode() });
    if (!form.noProject) {
      const { error: e2 } = await supabase.from("projects").insert({
        event_id: q.data.event.id, team_id: team.id, title: form.title.trim() || null,
        description: form.description, challenge_id: form.challenge_id || null,
        demo_url: form.demo_url || null, github_url: form.github_url || null,
        table_number: form.table_number || null,
      });
      if (e2) return toast.error(e2.message);
    }
    const names = form.names.split(/[,\n]/).map((n) => n.trim()).filter(Boolean);
    if (names.length) {
      await supabase.from("team_members").insert(names.map((name) => ({ team_id: team.id, name })));
    }
    toast.success("Team created");
    setForm({ teamName: "", title: "", description: "", challenge_id: "", demo_url: "", github_url: "", table_number: "", names: "", noProject: false });
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["admin-teams"] });
  }

  async function delTeam(id: string) {
    await supabase.from("teams").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin-teams"] });
  }

  async function regeneratePasscode(teamId: string) {
    const { error } = await supabase.from("team_passcodes").update({ passcode: randomPasscode(), updated_at: new Date().toISOString() }).eq("team_id", teamId);
    if (error) return toast.error(error.message);
    toast.success("Passcode regenerated");
    qc.invalidateQueries({ queryKey: ["admin-teams"] });
  }

  async function resetTeamSignIn(teamId: string) {
    const { error } = await supabase.from("teams").update({ claimed_user_id: null }).eq("id", teamId);
    if (error) return toast.error(error.message);
    toast.success("Reset — this team's passcode can be used to sign in again");
    qc.invalidateQueries({ queryKey: ["admin-teams"] });
  }

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    title: "", description: "", challenge_id: "",
    demo_url: "", github_url: "", table_number: "", names: "", noProject: false,
  });

  function openEdit(teamId: string, project: any, members: any[]) {
    setEditingId(teamId);
    setEditForm({
      title: project?.title ?? "",
      description: project?.description ?? "",
      challenge_id: project?.challenge_id ?? "",
      demo_url: project?.demo_url ?? "",
      github_url: project?.github_url ?? "",
      table_number: project?.table_number ?? "",
      names: members.map((m) => m.name).filter(Boolean).join(", "),
      noProject: !project,
    });
  }

  async function saveEdit(teamId: string, existingProject: any) {
    if (!q.data) return;
    if (editForm.noProject) {
      if (existingProject) {
        await supabase.from("projects").delete().eq("id", existingProject.id);
      }
    } else if (existingProject) {
      const { error } = await supabase.from("projects").update({
        title: editForm.title.trim() || null, description: editForm.description,
        challenge_id: editForm.challenge_id || null,
        demo_url: editForm.demo_url || null, github_url: editForm.github_url || null,
        table_number: editForm.table_number || null,
      }).eq("id", existingProject.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("projects").insert({
        event_id: q.data.event.id, team_id: teamId, title: editForm.title.trim() || null,
        description: editForm.description, challenge_id: editForm.challenge_id || null,
        demo_url: editForm.demo_url || null, github_url: editForm.github_url || null,
        table_number: editForm.table_number || null,
      });
      if (error) return toast.error(error.message);
    }
    const names = editForm.names.split(/[,\n]/).map((n) => n.trim()).filter(Boolean);
    const existingMembers = q.data.members.filter((m) => m.team_id === teamId);
    const existingNames = new Set(existingMembers.map((m) => m.name));
    const newNamesSet = new Set(names);
    const toAdd = names.filter((n) => !existingNames.has(n));
    const toRemove = existingMembers.filter((m) => !newNamesSet.has(m.name));
    if (toRemove.length) {
      await supabase.from("team_members").delete().in("id", toRemove.map((m) => m.id));
    }
    if (toAdd.length) {
      await supabase.from("team_members").insert(toAdd.map((name) => ({ team_id: teamId, name })));
    }
    toast.success("Team updated");
    setEditingId(null);
    qc.invalidateQueries({ queryKey: ["admin-teams"] });
  }

  const [viewingId, setViewingId] = useState<string | null>(null);

  if (!q.data) return <div>Loading...</div>;
  const membersByTeam = new Map<string, any[]>();
  for (const m of q.data.members) {
    if (!membersByTeam.has(m.team_id)) membersByTeam.set(m.team_id, []);
    membersByTeam.get(m.team_id)!.push(m);
  }
  const projectByTeam = new Map(q.data.projects.map((p) => [p.team_id, p]));
  const challengeById = new Map(q.data.challenges.map((c) => [c.id, c]));
  const passcodeByTeam = new Map(q.data.passcodes.map((p) => [p.team_id, p.passcode]));

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <div
        className="relative overflow-hidden rounded-2xl p-5 flex items-center justify-between gap-3"
        style={{ background: "linear-gradient(120deg, #006633 0%, #0a8a44 100%)", boxShadow: "0 0 0 3px #ffcc00" }}
      >
        <div
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{ backgroundImage: "repeating-linear-gradient(45deg, #fff 0, #fff 2px, transparent 2px, transparent 14px)" }}
        />
        <div className="relative flex items-center gap-2 text-white">
          <Trophy className="h-6 w-6 text-yellow-300" />
          <h1 className="text-3xl font-black tracking-wide">Teams</h1>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="relative bg-yellow-400 text-[#006633] hover:bg-yellow-300 font-bold"><Plus className="h-4 w-4 mr-2" /> Add team</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>New team</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Team / individual name</Label><Input value={form.teamName} onChange={(e) => setForm({ ...form, teamName: e.target.value })} /></div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.noProject} onChange={(e) => setForm({ ...form, noProject: e.target.checked })} />
                Non-competing team (mentors/organizers) — hidden from voting
              </label>
              {!form.noProject && (
                <>
                  <div><Label>Project title (optional)</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
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
                  <div><Label>Number of members</Label><Input type="number" min={1} value={form.table_number} onChange={(e) => setForm({ ...form, table_number: e.target.value })} /></div>
                </>
              )}
              <div><Label>Participant names (comma or newline)</Label><Textarea value={form.names} onChange={(e) => setForm({ ...form, names: e.target.value })} rows={3} /></div>
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
          const passcode = passcodeByTeam.get(t.id);
          return (
            <Card
              key={t.id}
              className="p-5 glass cursor-pointer hover:border-yellow-400/60 transition border-l-4"
              style={{ borderLeftColor: "#ffcc00" }}
              onClick={() => setViewingId(t.id)}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2"><Shirt className="h-4 w-4 text-primary" /><h3 className="font-bold">{t.name}</h3></div>
                  {p && <div className="mt-1"><div className="font-semibold">{p.title}</div><div className="text-sm text-muted-foreground">{p.description}</div></div>}
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {ch && <span>Challenge: {ch.name}</span>}
                    <span>{p?.table_number ?? members.length} member{(p?.table_number ?? members.length) === "1" || (p?.table_number ?? members.length) === 1 ? "" : "s"}</span>
                    {passcode && (
                      <span className="inline-flex items-center gap-1 font-mono font-bold text-foreground" onClick={(e) => e.stopPropagation()}>
                        Passcode: {passcode}
                        <button type="button" title="Regenerate" onClick={() => regeneratePasscode(t.id)} className="text-muted-foreground hover:text-foreground">
                          <RefreshCw className="h-3 w-3" />
                        </button>
                      </span>
                    )}
                  </div>
                  {members.length > 0 && <div className="mt-2 text-xs text-muted-foreground">{members.map((m) => m.name).filter(Boolean).join(", ")}</div>}
                </div>
                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" onClick={() => openEdit(t.id, p, members)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => delTeam(t.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
      <Dialog open={!!editingId} onOpenChange={(v) => !v && setEditingId(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Edit team details</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={editForm.noProject} onChange={(e) => setEditForm({ ...editForm, noProject: e.target.checked })} />
              Non-competing team (mentors/organizers) — hidden from voting
            </label>
            {!editForm.noProject && (
              <>
                <div><Label>Project title</Label><Input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} /></div>
                <div><Label>Description</Label><Textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} /></div>
                <div><Label>Challenge</Label>
                  <Select value={editForm.challenge_id} onValueChange={(v) => setEditForm({ ...editForm, challenge_id: v })}>
                    <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>{q.data.challenges.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>Demo URL</Label><Input value={editForm.demo_url} onChange={(e) => setEditForm({ ...editForm, demo_url: e.target.value })} /></div>
                  <div><Label>GitHub</Label><Input value={editForm.github_url} onChange={(e) => setEditForm({ ...editForm, github_url: e.target.value })} /></div>
                </div>
                <div><Label>Number of members</Label><Input type="number" min={1} value={editForm.table_number} onChange={(e) => setEditForm({ ...editForm, table_number: e.target.value })} /></div>
              </>
            )}
            <div><Label>Participant names (comma or newline)</Label><Textarea value={editForm.names} onChange={(e) => setEditForm({ ...editForm, names: e.target.value })} rows={3} /></div>
            {editingId && q.data.teams.find((t) => t.id === editingId)?.claimed_user_id && (
              <div className="flex items-center justify-between text-xs bg-muted/40 rounded-md px-2 py-1">
                <span>Signed in on a device</span>
                <button type="button" onClick={() => resetTeamSignIn(editingId)} className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
                  <Unlink className="h-3 w-3" /> Reset sign-in
                </button>
              </div>
            )}
            <Button
              onClick={() => editingId && saveEdit(editingId, projectByTeam.get(editingId))}
              className="w-full"
            >
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={!!viewingId} onOpenChange={(v) => !v && setViewingId(null)}>
        <DialogContent className="max-w-md p-0 overflow-hidden border-0 bg-transparent shadow-none">
          {(() => {
            const t = q.data.teams.find((t) => t.id === viewingId);
            if (!t) return null;
            const p = projectByTeam.get(t.id);
            const members = membersByTeam.get(t.id) ?? [];
            const ch = p?.challenge_id ? challengeById.get(p.challenge_id) : null;
            return (
              <div
                className="relative rounded-2xl p-8 text-center text-white overflow-hidden"
                style={{
                  background: "linear-gradient(160deg, #006633 0%, #0a8a44 55%, #146c36 100%)",
                  boxShadow: "0 0 0 4px #ffcc00, 0 20px 60px rgba(0,0,0,0.4)",
                }}
              >
                <div
                  className="absolute inset-0 opacity-10 pointer-events-none"
                  style={{
                    backgroundImage:
                      "repeating-linear-gradient(45deg, #fff 0, #fff 2px, transparent 2px, transparent 14px)",
                  }}
                />
                <div className="relative">
                  <Trophy className="h-10 w-10 mx-auto mb-3 text-yellow-300 drop-shadow" />
                  <h2 className="text-3xl font-black uppercase tracking-wide drop-shadow-sm mb-1">{t.name}</h2>
                  {t.claimed_user_id && (
                    <div className="text-[10px] uppercase tracking-widest text-yellow-200/80 mb-2">Signed in</div>
                  )}
                  {ch && (
                    <div className="inline-block mb-4 px-4 py-1 rounded-full bg-white/15 backdrop-blur text-sm font-semibold border border-white/30">
                      {ch.name}
                    </div>
                  )}
                  {p?.title && <div className="text-lg font-bold mb-4">{p.title}</div>}
                  <div className="mt-2 rounded-xl bg-black/20 backdrop-blur p-4 text-left">
                    <div className="text-xs uppercase tracking-widest text-yellow-200 font-semibold mb-2 text-center">Squad</div>
                    {members.length > 0 ? (
                      <ul className="space-y-1.5">
                        {members.map((m, i) => (
                          <li key={m.id} className="flex items-center gap-3 text-sm">
                            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-yellow-300 text-[#006633] font-black text-xs">{i + 1}</span>
                            <span className="font-medium">{m.name || "Unnamed"}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="text-sm text-white/70 text-center">No members added yet</div>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
