import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchActiveEvent } from "@/lib/auth-helpers";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useState } from "react";
import { Plus, Trash2, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/challenges")({
  component: ChallengesPage,
});

export const GOOGLE_COLORS = [
  { name: "Blue", value: "#4285F4" },
  { name: "Red", value: "#EA4335" },
  { name: "Yellow", value: "#FBBC05" },
  { name: "Green", value: "#34A853" },
];

const CODE_THE_CUP_CHALLENGES = [
  { name: "Match Predictor AI", description: "Build a tool that predicts match outcomes using historical stats, team form, or fan sentiment. Bonus points for explaining why it predicts what it predicts." },
  { name: "Fan Translator", description: "A real-time translation or phrasebook app so fans from different countries can chat, order food, or trash-talk rival teams at the stadium." },
  { name: "Stadium Navigator", description: "An AI assistant that helps fans find their gate, nearest washroom, food stall, or exit in a crowded stadium using a simple chat or voice interface." },
  { name: "Fan Watch Party Finder", description: "An app that connects fans to local watch parties or bars showing their team's matches, with filters like country, language, or vibe." },
  { name: "Chant & Banner Creator", description: "An AI tool that generates custom fan chants, banners, or social posts for a chosen team, personalized with player names and country flair." },
  { name: "Referee Decision Explainer", description: "A tool that explains offside calls, VAR decisions, or common rules to new fans in plain language, using diagrams or simple Q&A." },
  { name: "Culture & Cuisine Guide", description: "An app that pairs each participating country with its food, traditions, or fun facts, useful for fans hosting a World Cup watch party at home." },
  { name: "Accessibility Companion", description: "A tool that makes match-day more accessible: live captions for commentary, sign-language avatar overlays, or audio descriptions for visually impaired fans." },
];

function ChallengesPage() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin-challenges"],
    queryFn: async () => {
      const event = await fetchActiveEvent();
      if (!event) return null;
      const { data } = await supabase.from("challenges").select("*").eq("event_id", event.id).order("sort_order");
      return { event, challenges: data ?? [] };
    },
  });
  const [form, setForm] = useState({ name: "", description: "", sponsor: "", color: GOOGLE_COLORS[0].value });

  async function add() {
    if (!q.data || !form.name.trim()) return;
    const { error } = await supabase.from("challenges").insert({ ...form, event_id: q.data.event.id });
    if (error) return toast.error(error.message);
    setForm({ name: "", description: "", sponsor: "", color: GOOGLE_COLORS[0].value });
    qc.invalidateQueries({ queryKey: ["admin-challenges"] });
  }
  async function del(id: string) {
    await supabase.from("challenges").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin-challenges"] });
  }
  async function loadCodeTheCupPack() {
    if (!q.data) return;
    const rows = CODE_THE_CUP_CHALLENGES.map((c, i) => ({
      ...c,
      event_id: q.data!.event.id,
      color: GOOGLE_COLORS[i % GOOGLE_COLORS.length].value,
      sort_order: i,
    }));
    const { error } = await supabase.from("challenges").insert(rows);
    if (error) return toast.error(error.message);
    toast.success("Loaded Code the Cup challenges");
    qc.invalidateQueries({ queryKey: ["admin-challenges"] });
  }

  if (!q.data) return <div>Loading...</div>;
  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-3xl font-black">Challenges</h1>
        <Button variant="outline" onClick={loadCodeTheCupPack}>
          <Sparkles className="h-4 w-4 mr-2" /> Load Code the Cup pack
        </Button>
      </div>
      <Card className="p-5 glass space-y-3">
        <Input placeholder="Challenge name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <Input placeholder="Sponsor (optional)" value={form.sponsor} onChange={(e) => setForm({ ...form, sponsor: e.target.value })} />
        <Textarea placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <div className="flex items-center gap-2">
          {GOOGLE_COLORS.map((c) => (
            <button
              key={c.value}
              type="button"
              title={c.name}
              onClick={() => setForm({ ...form, color: c.value })}
              className="h-7 w-7 rounded-full transition ring-offset-2 ring-offset-background"
              style={{ backgroundColor: c.value, boxShadow: form.color === c.value ? `0 0 0 2px ${c.value}` : undefined }}
            />
          ))}
        </div>
        <Button onClick={add}><Plus className="h-4 w-4 mr-2" /> Add challenge</Button>
      </Card>
      <div className="space-y-2">
        {q.data.challenges.map((c) => (
          <Card key={c.id} className="p-4 glass flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: c.color ?? "var(--muted-foreground)" }} />
              <div><div className="font-bold">{c.name}</div><div className="text-xs text-muted-foreground">{c.sponsor} • {c.description}</div></div>
            </div>
            <Button size="sm" variant="ghost" onClick={() => del(c.id)}><Trash2 className="h-4 w-4" /></Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
