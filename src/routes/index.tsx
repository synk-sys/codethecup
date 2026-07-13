import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useSession, isAdmin } from "@/lib/use-session";
import { Trophy, Sparkles, Users, Zap } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const { session, roles, loading } = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || !session) return;
    if (isAdmin(roles)) navigate({ to: "/admin" });
    else navigate({ to: "/vote" });
  }, [session, roles, loading, navigate]);

  return (
    <div className="min-h-screen">
      <nav className="container mx-auto px-6 py-6 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 text-xl font-black">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground">
            <Trophy className="h-4 w-4" />
          </div>
          <span className="gradient-text">Code the Cup</span>
        </Link>
        <Link to="/auth"><Button variant="secondary" className="font-semibold">Sign in</Button></Link>
      </nav>

      <main className="container mx-auto px-6 pt-16 pb-24 relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[420px] opacity-[0.07]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, transparent 0 39px, var(--google-green) 39px 40px), repeating-linear-gradient(90deg, transparent 0 39px, var(--google-green) 39px 40px)",
          }}
        />
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="relative max-w-4xl mx-auto text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-xs font-semibold text-primary border border-primary/20">
            <Sparkles className="h-3 w-3" /> ⚽ World Cup hack night
          </span>
          <h1 className="mt-6 text-6xl sm:text-7xl md:text-8xl font-black leading-[0.9] tracking-tight">
            Code the Cup,<br />
            <span className="gradient-text">judged by the fans.</span>
          </h1>
          <p className="mt-8 text-xl text-muted-foreground max-w-2xl mx-auto">
            Weighted rubrics, anonymous ballots, live progress, and a fullscreen winner reveal. No separate judges — participants vote, everyone plays.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link to="/auth"><Button size="lg" className="h-12 px-8 text-base font-semibold shadow-[0_10px_40px_-10px_#4285F499]">Enter the stadium</Button></Link>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mt-24 grid gap-6 md:grid-cols-3 max-w-5xl mx-auto">
          {[
            { icon: Users, title: "Everyone votes", body: "No separate judges. Every participant scores every eligible project — never their own." },
            { icon: Zap, title: "Weighted rubrics", body: "Configure criteria, weights, and score scales. Live weighted preview as you rate." },
            { icon: Trophy, title: "Big reveal", body: "Fullscreen Kahoot-style reveal: countdown → 2nd → 1st → confetti podium." },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="glass rounded-2xl p-6">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/15 text-primary mb-4">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="text-xl font-bold">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </motion.div>
      </main>
    </div>
  );
}
