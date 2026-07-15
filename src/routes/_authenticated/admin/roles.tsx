import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useState } from "react";
import { KeyRound, UserCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/roles")({
  component: AccountPage,
});

function AccountPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  const q = useQuery({
    queryKey: ["admin-account"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return data.user;
    },
  });

  async function changePassword() {
    if (password.length < 6) return toast.error("Password must be at least 6 characters");
    if (password !== confirm) return toast.error("Passwords don't match");
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Password updated");
    setPassword("");
    setConfirm("");
  }

  const user = q.data;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-3xl font-black">Account</h1>
        <p className="text-muted-foreground">Your admin account for this event.</p>
      </div>

      <Card className="p-6 glass space-y-3">
        <div className="flex items-center gap-2 font-bold"><UserCircle className="h-4 w-4" /> Signed in as</div>
        <div className="text-sm text-muted-foreground">{user?.email ?? "..."}</div>
      </Card>

      <Card className="p-6 glass space-y-3">
        <div className="flex items-center gap-2 font-bold"><KeyRound className="h-4 w-4" /> Change password</div>
        <div className="space-y-2">
          <Label htmlFor="new-password">New password</Label>
          <Input id="new-password" type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm-password">Confirm password</Label>
          <Input id="confirm-password" type="password" minLength={6} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </div>
        <Button onClick={changePassword} disabled={saving}>{saving ? "Saving..." : "Update password"}</Button>
      </Card>
    </div>
  );
}
