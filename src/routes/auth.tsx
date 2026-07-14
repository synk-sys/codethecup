import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
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
  const [displayName, setDisplayName] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/" });
    });
  }, [navigate]);

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    setLoading(false);
    if (error) toast.error(error.message);
    else toast.success("Check your email for a sign-in link!");
  }

  async function passwordAuth(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    if (isSignUp) {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: { display_name: displayName || email.split("@")[0] },
        },
      });
      setLoading(false);
      if (error) return toast.error(error.message);
      toast.success("Account created! You can now sign in.");
      setIsSignUp(false);
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (error) return toast.error(error.message);
      toast.success("Welcome back!");
      navigate({ to: mode === "admin" ? "/admin" : "/vote" });
    }
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
                {lockedMode === "participant" ? (
                  <>
                    <form onSubmit={sendMagicLink} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="email-p">Email</Label>
                        <Input id="email-p" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@team.com" />
                      </div>
                      <Button type="submit" disabled={loading} className="w-full h-11 font-semibold">
                        {loading ? "Sending..." : "Send magic link"}
                      </Button>
                    </form>
                    <p className="text-xs text-muted-foreground text-center">
                      Use the email your team lead added to the roster.
                    </p>
                  </>
                ) : (
                  <>
                    <form onSubmit={passwordAuth} className="space-y-4">
                      {isSignUp && (
                        <div className="space-y-2">
                          <Label htmlFor="name-p">Display name</Label>
                          <Input id="name-p" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name" />
                        </div>
                      )}
                      <div className="space-y-2">
                        <Label htmlFor="email-p">Email</Label>
                        <Input id="email-p" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@team.com" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="password-p">Password</Label>
                        <Input id="password-p" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
                      </div>
                      <Button type="submit" disabled={loading} className="w-full h-11 font-semibold">
                        {loading ? "..." : isSignUp ? "Create account" : "Sign in"}
                      </Button>
                    </form>
                    <button type="button" onClick={() => setIsSignUp((v) => !v)} className="text-xs text-muted-foreground hover:text-foreground w-full text-center">
                      {isSignUp ? "Already have an account? Sign in" : "First time? Create an account"}
                    </button>
                  </>
                )}
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
