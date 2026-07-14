import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { fetchActiveEvent } from "@/lib/auth-helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Trophy } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Code the Cup" },
      { name: "description", content: "Sign in to vote on hackathon projects." },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { mode?: "participant" | "admin" } => ({
    mode: search.mode === "admin" ? "admin" : search.mode === "participant" ? "participant" : undefined,
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { mode: lockedMode } = Route.useSearch();
  const [mode, setMode] = useState<"participant" | "admin">(lockedMode ?? "participant");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const [teams, setTeams] = useState<{ id: string; name: string }[]>([]);
  const [teamId, setTeamId] = useState("");
  const [members, setMembers] = useState<{ id: string; name: string }[]>([]);
  const [memberId, setMemberId] = useState("");
  const [passcode, setPasscode] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session && !data.session.user.is_anonymous) navigate({ to: "/" });
    });
  }, [navigate]);

  useEffect(() => {
    if (mode !== "participant") return;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) await supabase.auth.signInAnonymously();
      const event = await fetchActiveEvent();
      if (!event) return;
      const { data: teamRows } = await supabase.from("teams").select("id,name").eq("event_id", event.id).order("name");
      setTeams(teamRows ?? []);
    })();
  }, [mode]);

  useEffect(() => {
    if (!teamId) return setMembers([]);
    (async () => {
      const { data } = await supabase.from("team_members").select("id,name").eq("team_id", teamId).not("name", "is", null).order("name");
      setMembers((data ?? []) as { id: string; name: string }[]);
    })();
  }, [teamId]);

  async function joinAsParticipant(e: React.FormEvent) {
    e.preventDefault();
    if (!memberId || !passcode.trim()) return toast.error("Pick your name and enter the passcode");
    setLoading(true);
    const { error } = await supabase.rpc("claim_team_member", {
      _team_member_id: memberId,
      _passcode: passcode.trim().toUpperCase(),
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("You're in!");
    navigate({ to: "/vote" });
  }

  async function passwordAuth(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Welcome back!");
    navigate({ to: "/admin" });
  }

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      <div className="absolute inset-0" style={{ background: "var(--gradient-stage)" }} />

      <div className="relative flex-1 flex flex-col items-center justify-center gap-8 p-6 py-12">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-center">
          <div className="flex items-center justify-center gap-2 text-2xl font-black mb-4">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground">
              <Trophy className="h-5 w-5" />
            </div>
            <span className="gradient-text">Code the Cup</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black leading-[1.05]">
            World Cup<br /> hackathon,<br /><span className="gradient-text">gamified.</span>
          </h1>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="w-full max-w-md">
          <Card className="p-8 glass">
            <div className="mb-6">
              <h2 className="text-2xl font-bold">Sign in to Code the Cup</h2>
              {!lockedMode && (
                <p className="text-sm text-muted-foreground mt-1">Choose how you're joining the event.</p>
              )}
            </div>

            <Tabs value={mode} onValueChange={(v) => setMode(v as "participant" | "admin")}>
              {!lockedMode && (
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="participant">Participant</TabsTrigger>
                  <TabsTrigger value="admin">Admin</TabsTrigger>
                </TabsList>
              )}

              <TabsContent value="participant" className="mt-6 space-y-4">
                <form onSubmit={joinAsParticipant} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Team</Label>
                    <Select value={teamId} onValueChange={(v) => { setTeamId(v); setMemberId(""); }}>
                      <SelectTrigger><SelectValue placeholder="Select your team" /></SelectTrigger>
                      <SelectContent>{teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Your name</Label>
                    <Select value={memberId} onValueChange={setMemberId} disabled={!teamId}>
                      <SelectTrigger><SelectValue placeholder="Select your name" /></SelectTrigger>
                      <SelectContent>{members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="passcode">Team passcode</Label>
                    <Input id="passcode" required value={passcode} onChange={(e) => setPasscode(e.target.value)} placeholder="e.g. AB12CD" className="uppercase tracking-widest" />
                  </div>
                  <Button type="submit" disabled={loading} className="w-full h-11 font-semibold">
                    {loading ? "Joining..." : "Join"}
                  </Button>
                </form>
                <p className="text-xs text-muted-foreground text-center">
                  Ask an organizer for your team's passcode.
                </p>
              </TabsContent>

              <TabsContent value="admin" className="mt-6 space-y-4">
                <form onSubmit={passwordAuth} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email-a">Email</Label>
                    <Input id="email-a" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
                  </div>
                  <Button type="submit" disabled={loading} className="w-full h-11 font-semibold">
                    {loading ? "..." : "Sign in"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </Card>
          <Link to="/" className="mt-4 block text-center text-xs text-muted-foreground hover:text-foreground">← Back to Code the Cup</Link>
        </motion.div>
      </div>

      <div className="relative text-center text-xs text-muted-foreground pb-6 space-y-0.5">
        <p>⚽ Built for fans</p>
        <p>Developed by Kritima Kukreja</p>
        <p>Powered by SynkTech</p>
      </div>
    </div>
  );
}
