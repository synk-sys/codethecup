import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useSession, isAdmin } from "@/lib/use-session";
import { Trophy, Users, Zap, Shield } from "lucide-react";

const GOOGLE_COLORS = ["#4285F4", "#EA4335", "#FBBC05", "#34A853"];
const TRANSITION_MS = 1300;

function playWhistle() {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(2200, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(2600, ctx.currentTime + 0.12);
    osc.frequency.linearRampToValueAtTime(2100, ctx.currentTime + 0.35);
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.03);
    gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.3);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.42);
    osc.onended = () => ctx.close();
  } catch {
    // audio not available — silently skip
  }
}

function StadiumTransition({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      onDone();
      return;
    }
    playWhistle();
    const t = setTimeout(onDone, TRANSITION_MS);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <motion.div
      role="button"
      aria-label="Skip"
      onClick={onDone}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="fixed inset-0 z-50 flex items-center justify-center cursor-pointer overflow-hidden"
      style={{ background: "radial-gradient(circle at 50% 45%, #131a26 0%, #05070b 70%)" }}
    >
      {[...Array(8)].map((_, i) => (
        <motion.span
          key={i}
          className="absolute text-3xl select-none"
          style={{ left: `${8 + i * 11}%`, bottom: "-10%" }}
          initial={{ y: 0, opacity: 0, rotate: 0 }}
          animate={{ y: "-120vh", opacity: [0, 1, 1, 0], rotate: 360 }}
          transition={{ duration: 1.1 + (i % 3) * 0.15, delay: i * 0.05, ease: "easeIn" }}
        >
          ⚽
        </motion.span>
      ))}
      <motion.p
        className="relative text-white font-black tracking-tight text-center px-6"
        style={{ fontSize: "clamp(28px, 6vw, 56px)" }}
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: [0, 1, 1, 0], scale: [0.85, 1.05, 1, 1.02] }}
        transition={{ duration: TRANSITION_MS / 1000, times: [0, 0.25, 0.75, 1] }}
      >
        ENTERING THE STADIUM
      </motion.p>
      <span className="absolute bottom-6 text-xs text-white/50">Tap to skip</span>
    </motion.div>
  );
}

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const { session, roles, loading } = useSession();
  const navigate = useNavigate();
  const [entering, setEntering] = useState(false);
  const navigatedRef = useRef(false);

  useEffect(() => {
    if (loading || !session) return;
    if (isAdmin(roles)) navigate({ to: "/admin" });
    else navigate({ to: "/vote" });
  }, [session, roles, loading, navigate]);

  function goToStadium() {
    if (navigatedRef.current) return;
    navigatedRef.current = true;
    navigate({ to: "/auth", search: { mode: "participant" } });
  }

  return (
    <div className="min-h-screen">
      <AnimatePresence>
        {entering && <StadiumTransition onDone={goToStadium} />}
      </AnimatePresence>
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
          <div className="flex items-center justify-center gap-2 mb-4">
            {GOOGLE_COLORS.map((c) => (
              <span key={c} className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c }} />
            ))}
          </div>
          <h1 className="mt-6 text-6xl sm:text-7xl md:text-8xl font-black leading-[1.1] tracking-tight">
            Code the Cup,<br />
            <span className="gradient-text">judged by the fans.</span>
          </h1>
          <span className="mt-8 inline-flex items-center gap-3 rounded-full bg-primary/10 px-7 py-3 text-lg sm:text-xl font-bold text-primary border border-primary/20">
            ⚽ World Cup hack night
          </span>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Button
              size="lg"
              onClick={() => setEntering(true)}
              className="h-12 px-8 text-base font-semibold shadow-[0_10px_40px_-10px_#4285F499]"
            >
              Enter the stadium
            </Button>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mt-24 grid gap-6 sm:grid-cols-2 lg:grid-cols-4 max-w-6xl mx-auto">
          {[
            { icon: Users, title: "Everyone votes", body: "No separate judges. Every participant scores every eligible project — never their own." },
            { icon: Shield, title: "Fair & anonymous", body: "Ballots are anonymous by design, so scores reflect the project, not the popularity." },
            { icon: Zap, title: "Weighted rubrics", body: "Configure criteria, weights, and score scales. Live weighted preview as you rate." },
            { icon: Trophy, title: "Big reveal", body: "Fullscreen Kahoot-style reveal: countdown → 2nd → 1st → confetti podium." },
          ].map(({ icon: Icon, title, body }, i) => (
            <div key={title} className="glass rounded-2xl p-6">
              <div
                className="grid h-11 w-11 place-items-center rounded-xl mb-4"
                style={{ backgroundColor: `color-mix(in oklab, ${GOOGLE_COLORS[i]} 15%, transparent)`, color: GOOGLE_COLORS[i] }}
              >
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
