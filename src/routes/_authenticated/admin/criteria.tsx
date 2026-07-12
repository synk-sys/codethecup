import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchActiveEvent } from "@/lib/auth-helpers";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { Plus, Trash2, Save } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/criteria")({
  component: CriteriaPage,
});

type Row = { id: string; name: string; description: string | null; weight: number; sort_order: number };

function CriteriaPage() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin-criteria"],
    queryFn: async () => {
      const event = await fetchActiveEvent();
      if (!event) return null;
      const { data } = await supabase.from("criteria").select("*").eq("event_id", event.id).order("sort_order");
      return { event, criteria: (data ?? []) as Row[] };
    },
  });
  const [rows, setRows] = useState<Row[]>([]);
  useEffect(() => { if (q.data) setRows(q.data.criteria); }, [q.data?.event?.id]);

  const total = rows.reduce((s, r) => s + Number(r.weight || 0), 0);

  async function save() {
    if (Math.round(total) !== 100) return toast.error(`Weights must total 100% (currently ${total}%)`);
    for (const r of rows) {
      await supabase.from("criteria").update({ name: r.name, description: r.description, weight: r.weight, sort_order: r.sort_order }).eq("id", r.id);
    }
    toast.success("Saved");
    qc.invalidateQueries();
  }
  async function add() {
    if (!q.data) return;
    const { error } = await supabase.from("criteria").insert({ event_id: q.data.event.id, name: "New criterion", weight: 0, sort_order: rows.length + 1 });
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin-criteria"] });
  }
  async function del(id: string) {
    await supabase.from("criteria").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin-criteria"] });
  }

  if (!q.data) return <div>Loading...</div>;

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-black">Judging criteria</h1>
        <Badge variant={Math.round(total) === 100 ? "default" : "destructive"} className="text-sm">Total: {total}%</Badge>
      </div>
      <div className="space-y-3">
        {rows.map((r, i) => (
          <Card key={r.id} className="p-4 glass space-y-2">
            <div className="flex gap-2">
              <Input value={r.name} onChange={(e) => setRows(rows.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} className="flex-1 font-semibold" />
              <Input type="number" min={0} max={100} step={5} value={r.weight} onChange={(e) => setRows(rows.map((x, j) => j === i ? { ...x, weight: Number(e.target.value) } : x))} className="w-24" />
              <Button variant="ghost" size="icon" onClick={() => del(r.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
            <Textarea value={r.description ?? ""} onChange={(e) => setRows(rows.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} rows={2} />
          </Card>
        ))}
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={add}><Plus className="h-4 w-4 mr-2" /> Add</Button>
        <Button onClick={save}><Save className="h-4 w-4 mr-2" /> Save</Button>
      </div>
    </div>
  );
}
