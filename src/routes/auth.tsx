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
import { Sparkles, Trophy, Zap } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — HackVote" },
      { name: "description", content: "Sign in to vote on hackathon projects." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"participant" | "admin">("participant");
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
      navigate({ to: "/" });
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute inset-0" style={{ background: "var(--gradient-stage)" }} />
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="relative z-10">
          <div className="flex items-center gap-2 text-2xl font-black">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground">
              <Trophy className="h-5 w-5" />
            </div>
            <span className="gradient-text">HackVote</span>
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="relative z-10 space-y-6">
          <h1 className="text-6xl font-black leading-[0.95]">
            Peer-judged<br /> hackathons,<br /><span className="gradient-text">gamified.</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-md">
            Fair weighted scoring, anonymous ballots, and a Kahoot-style winner reveal that makes every finale unforgettable.
          </p>
          <div className="grid grid-cols-3 gap-3 max-w-md">
            {[
              { icon: Sparkles, label: "Weighted scoring" },
              { icon: Zap, label: "Live progress" },
              { icon: Trophy, label: "Big reveal" },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="glass rounded-xl p-3 text-sm">
                <Icon className="h-4 w-4 mb-1 text-primary" />
                <div className="font-semibold">{label}</div>
              </div>
            ))}
          </div>
        </motion.div>
        <div className="relative z-10 text-xs text-muted-foreground">
          Built for hackers • Anonymous & fair
        </div>
      </div>

      <div className="flex items-center justify-center p-6 lg:p-12">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
          <Card className="p-8 glass">
            <div className="mb-6">
              <h2 className="text-2xl font-bold">Sign in to HackVote</h2>
              <p className="text-sm text-muted-foreground mt-1">Choose how you're joining the event.</p>
            </div>

            <Tabs value={mode} onValueChange={(v) => setMode(v as "participant" | "admin")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="participant">Participant</TabsTrigger>
                <TabsTrigger value="admin">Admin</TabsTrigger>
              </TabsList>

              <TabsContent value="participant" className="mt-6 space-y-4">
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
              </TabsContent>

              <TabsContent value="admin" className="mt-6 space-y-4">
                <form onSubmit={passwordAuth} className="space-y-4">
                  {isSignUp && (
                    <div className="space-y-2">
                      <Label htmlFor="name">Display name</Label>
                      <Input id="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name" />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="email-a">Email</Label>
                    <Input id="email-a" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
                  </div>
                  <Button type="submit" disabled={loading} className="w-full h-11 font-semibold">
                    {loading ? "..." : isSignUp ? "Create admin account" : "Sign in"}
                  </Button>
                </form>
                <button type="button" onClick={() => setIsSignUp((v) => !v)} className="text-xs text-muted-foreground hover:text-foreground w-full text-center">
                  {isSignUp ? "Already have an account? Sign in" : "First admin? Create an account"}
                </button>
              </TabsContent>
            </Tabs>
          </Card>
          <Link to="/" className="mt-4 block text-center text-xs text-muted-foreground hover:text-foreground">← Back to HackVote</Link>
        </motion.div>
      </div>
    </div>
  );
}
