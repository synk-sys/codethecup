import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchActiveEvent } from "@/lib/auth-helpers";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { Save } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin-settings"],
    queryFn: async () => {
      const event = await fetchActiveEvent();
      if (!event) return null;
      const { data: settings } = await supabase.from("event_settings").select("*").eq("event_id", event.id).maybeSingle();
      return { event, settings };
    },
  });

  const [ev, setEv] = useState<any>(null);
  const [st, setSt] = useState<any>(null);

  useEffect(() => {
    if (q.data) { setEv(q.data.event); setSt(q.data.settings); }
  }, [q.data?.event?.id]);

  if (!q.data || !ev || !st) return <div>Loading...</div>;

  async function save() {
    const { error: e1 } = await supabase.from("events").update({
      name: ev.name, description: ev.description, event_date: ev.event_date,
      voting_start: ev.voting_start, voting_end: ev.voting_end,
      results_published: ev.results_published,
    }).eq("id", ev.id);
    const { event_id, ...settingsUpdate } = st;
    const { error: e2 } = await supabase.from("event_settings").update(settingsUpdate).eq("event_id", event_id);
    if (e1 || e2) toast.error((e1 ?? e2)!.message);
    else { toast.success("Saved"); qc.invalidateQueries(); }
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-3xl font-black">Event settings</h1>
        <p className="text-muted-foreground">Configure the hackathon and voting behavior.</p>
      </div>

      <Card className="p-6 glass space-y-4">
        <h2 className="font-bold">Event</h2>
        <Field label="Hackathon name"><Input value={ev.name ?? ""} onChange={(e) => setEv({ ...ev, name: e.target.value })} /></Field>
        <Field label="Description"><Textarea value={ev.description ?? ""} onChange={(e) => setEv({ ...ev, description: e.target.value })} /></Field>
        <div className="grid sm:grid-cols-3 gap-3">
          <Field label="Event date"><Input type="date" value={ev.event_date ?? ""} onChange={(e) => setEv({ ...ev, event_date: e.target.value })} /></Field>
          <Field label="Voting starts"><Input type="datetime-local" value={toLocal(ev.voting_start)} onChange={(e) => setEv({ ...ev, voting_start: fromLocal(e.target.value) })} /></Field>
          <Field label="Voting ends"><Input type="datetime-local" value={toLocal(ev.voting_end)} onChange={(e) => setEv({ ...ev, voting_end: fromLocal(e.target.value) })} /></Field>
        </div>
      </Card>

      <Card className="p-6 glass space-y-4">
        <h2 className="font-bold">Voting rules</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Number of winners"><Input type="number" min={1} max={10} value={st.number_of_winners} onChange={(e) => setSt({ ...st, number_of_winners: Number(e.target.value) })} /></Field>
          <Field label="Minimum votes per project"><Input type="number" min={0} value={st.min_votes_per_project} onChange={(e) => setSt({ ...st, min_votes_per_project: Number(e.target.value) })} /></Field>
          <Field label="Score scale min"><Input type="number" value={st.score_scale_min} onChange={(e) => setSt({ ...st, score_scale_min: Number(e.target.value) })} /></Field>
          <Field label="Score scale max"><Input type="number" value={st.score_scale_max} onChange={(e) => setSt({ ...st, score_scale_max: Number(e.target.value) })} /></Field>
          <Field label="Voting power">
            <Select value={st.voting_power_mode} onValueChange={(v) => setSt({ ...st, voting_power_mode: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="per_team">Equal per team (recommended)</SelectItem>
                <SelectItem value="per_participant">One per participant</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Winner reveal">
            <Select value={st.winner_reveal_style} onValueChange={(v) => setSt({ ...st, winner_reveal_style: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="kahoot">Kahoot-style show</SelectItem>
                <SelectItem value="simple">Simple podium</SelectItem>
                <SelectItem value="list">Ranked list</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
        <Toggle label="Allow vote edits" desc="Participants can update submitted votes before voting closes." v={st.allow_vote_edits} on={(v: boolean) => setSt({ ...st, allow_vote_edits: v })} />
        <Toggle label="Show live rankings" desc="Participants see rankings before voting closes (not recommended)." v={st.live_rankings_visible} on={(v: boolean) => setSt({ ...st, live_rankings_visible: v })} />
        <Toggle label="Block self-voting" desc="Prevent voting on your own team's project." v={st.block_self_voting} on={(v: boolean) => setSt({ ...st, block_self_voting: v })} />
        <Toggle label="Allow same-challenge voting" desc="Teams can vote for projects in the same challenge track." v={st.allow_same_challenge_voting} on={(v: boolean) => setSt({ ...st, allow_same_challenge_voting: v })} />
        <Toggle label="Publish results" desc="Reveal winners on the public results page." v={ev.results_published} on={(v: boolean) => setEv({ ...ev, results_published: v })} />
      </Card>

      <div className="sticky bottom-4 flex justify-end">
        <Button onClick={save} className="shadow-[var(--shadow-glow)]"><Save className="h-4 w-4 mr-2" /> Save changes</Button>
      </div>
    </div>
  );
}

function Field({ label, children }: any) { return <div className="space-y-1"><Label>{label}</Label>{children}</div>; }
function Toggle({ label, desc, v, on }: any) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border/60 p-3">
      <div><div className="font-medium text-sm">{label}</div><div className="text-xs text-muted-foreground">{desc}</div></div>
      <Switch checked={!!v} onCheckedChange={on} />
    </div>
  );
}
function toLocal(iso: string | null) { if (!iso) return ""; const d = new Date(iso); const pad = (n: number) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function fromLocal(v: string) { return v ? new Date(v).toISOString() : null; }
