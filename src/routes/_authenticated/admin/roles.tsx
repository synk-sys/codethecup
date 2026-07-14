import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useState } from "react";
import { ShieldCheck, UserMinus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/roles")({
  component: RolesPage,
});

function RolesPage() {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");

  const q = useQuery({
    queryKey: ["admin-roles"],
    queryFn: async () => {
      const { data: roles, error } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
      if (error) throw error;
      const ids = (roles ?? []).map((r) => r.user_id);
      if (ids.length === 0) return [];
      const { data: profiles } = await supabase.from("profiles").select("id, email, display_name").in("id", ids);
      return profiles ?? [];
    },
  });

  async function promote() {
    const trimmed = email.trim();
    if (!trimmed) return;
    const { data: profile, error: pErr } = await supabase.from("profiles").select("id").eq("email", trimmed).maybeSingle();
    if (pErr || !profile) { toast.error("No user found with that email"); return; }
    const { error } = await supabase.from("user_roles").insert({ user_id: profile.id, role: "admin" });
    if (error) toast.error(error.message);
    else { toast.success("Promoted to admin"); setEmail(""); qc.invalidateQueries({ queryKey: ["admin-roles"] }); }
  }

  async function demote(userId: string) {
    const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", "admin");
    if (error) toast.error(error.message);
    else { toast.success("Removed admin"); qc.invalidateQueries({ queryKey: ["admin-roles"] }); }
  }

  const admins = q.data ?? [];

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-3xl font-black">Admins</h1>
        <p className="text-muted-foreground">Manage who has admin access to this event.</p>
      </div>

      <Card className="p-6 glass space-y-3">
        <h2 className="font-bold">Promote a user</h2>
        <div className="flex gap-2">
          <Input placeholder="user@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Button onClick={promote}><ShieldCheck className="h-4 w-4 mr-2" /> Make admin</Button>
        </div>
      </Card>

      <Card className="p-6 glass space-y-3">
        <h2 className="font-bold">Current admins</h2>
        {q.isLoading ? (
          <div className="text-sm text-muted-foreground">Loading...</div>
        ) : admins.length === 0 ? (
          <div className="text-sm text-muted-foreground">No admins found.</div>
        ) : (
          <div className="space-y-2">
            {admins.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-4 rounded-lg border border-border/60 p-3">
                <div>
                  <div className="font-medium text-sm">{a.display_name || a.email}</div>
                  <div className="text-xs text-muted-foreground">{a.email}</div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={admins.length === 1}
                  onClick={() => demote(a.id)}
                >
                  <UserMinus className="h-4 w-4 mr-2" /> Remove admin
                </Button>
              </div>
            ))}
          </div>
        )}
        {admins.length === 1 && (
          <p className="text-xs text-muted-foreground">Can't remove the only admin — promote someone else first.</p>
        )}
      </Card>
    </div>
  );
}
