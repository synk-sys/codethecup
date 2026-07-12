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
import { Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/challenges")({
  component: ChallengesPage,
});

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
  const [form, setForm] = useState({ name: "", description: "", sponsor: "" });

  async function add() {
    if (!q.data || !form.name.trim()) return;
    const { error } = await supabase.from("challenges").insert({ ...form, event_id: q.data.event.id });
    if (error) return toast.error(error.message);
    setForm({ name: "", description: "", sponsor: "" });
    qc.invalidateQueries({ queryKey: ["admin-challenges"] });
  }
  async function del(id: string) {
    await supabase.from("challenges").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin-challenges"] });
  }

  if (!q.data) return <div>Loading...</div>;
  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-3xl font-black">Challenges</h1>
      <Card className="p-5 glass space-y-3">
        <Input placeholder="Challenge name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <Input placeholder="Sponsor (optional)" value={form.sponsor} onChange={(e) => setForm({ ...form, sponsor: e.target.value })} />
        <Textarea placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <Button onClick={add}><Plus className="h-4 w-4 mr-2" /> Add challenge</Button>
      </Card>
      <div className="space-y-2">
        {q.data.challenges.map((c) => (
          <Card key={c.id} className="p-4 glass flex items-center justify-between">
            <div><div className="font-bold">{c.name}</div><div className="text-xs text-muted-foreground">{c.sponsor} • {c.description}</div></div>
            <Button size="sm" variant="ghost" onClick={() => del(c.id)}><Trash2 className="h-4 w-4" /></Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
