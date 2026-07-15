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
    const t0 = ctx.currentTime;
    const DUR = 0.9;

    const master = ctx.createGain();
    master.gain.setValueAtTime(0, t0);
    master.gain.linearRampToValueAtTime(0.22, t0 + 0.012);
    master.gain.setValueAtTime(0.22, t0 + DUR - 0.09);
    master.gain.linearRampToValueAtTime(0, t0 + DUR);
    master.connect(ctx.destination);

    // two close, slightly detuned tones beat against each other — the
    // metallic "shimmer" a rolling pea makes inside a real whistle
    const tone = ctx.createGain();
    tone.connect(master);
    [2900, 2940].forEach((freq) => {
      const osc = ctx.createOscillator();
      osc.type = "square";
      osc.frequency.setValueAtTime(freq, t0);
      const oscGain = ctx.createGain();
      oscGain.gain.value = 0.5;
      osc.connect(oscGain);
      oscGain.connect(tone);
      osc.start(t0);
      osc.stop(t0 + DUR + 0.02);
    });

    // fast tremolo — the pea trill
    const tremolo = ctx.createGain();
    tremolo.gain.value = 0.75;
    tone.disconnect();
    tone.connect(tremolo);
    tremolo.connect(master);
    const lfo = ctx.createOscillator();
    const lfoDepth = ctx.createGain();
    lfo.frequency.setValueAtTime(24, t0);
    lfoDepth.gain.setValueAtTime(0.25, t0);
    lfo.connect(lfoDepth);
    lfoDepth.connect(tremolo.gain);
    lfo.start(t0);
    lfo.stop(t0 + DUR + 0.02);

    // bandpass to tame the square wave's harsh harmonics into a whistle-like tone
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 2900;
    filter.Q.value = 3;
    master.disconnect();
    master.connect(filter);
    filter.connect(ctx.destination);

    // breathy noise burst at the attack
    const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.06, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuf;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.value = 3000;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.2, t0);
    noiseGain.gain.linearRampToValueAtTime(0, t0 + 0.06);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(t0);

    setTimeout(() => ctx.close(), (DUR + 0.1) * 1000);
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

  const flightDuration = 0.55;
  const kickDelay = 0.16;
  const netHitAt = kickDelay + flightDuration;

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
      style={{
        backgroundColor: "#1a4fd6",
        backgroundImage:
          "repeating-linear-gradient(45deg, rgba(255,255,255,0.07) 0 2px, transparent 2px 22px)," +
          "repeating-linear-gradient(-45deg, rgba(255,255,255,0.07) 0 2px, transparent 2px 22px)",
      }}
    >
      <motion.p
        className="absolute top-[12%] text-white font-black tracking-tight text-center px-6"
        style={{ fontSize: "clamp(24px, 5vw, 44px)" }}
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: [0, 1, 1, 0], scale: [0.85, 1.05, 1, 1] }}
        transition={{ duration: netHitAt, times: [0, 0.3, 0.75, 1] }}
      >
        ENTERING THE STADIUM
      </motion.p>

      {/* goal net — starts small near top-center, then rushes toward camera with the ball */}
      <motion.div
        className="absolute"
        style={{
          top: "50%",
          left: "50%",
          width: "min(60vw, 340px)",
          height: "min(30vh, 200px)",
          marginLeft: "min(-30vw, -170px)",
          marginTop: "min(-15vh, -100px)",
          zIndex: 2,
          clipPath: "polygon(8% 0%, 92% 0%, 100% 100%, 0% 100%)",
          backgroundColor: "rgba(255,255,255,0.06)",
          backgroundImage:
            "repeating-linear-gradient(35deg, rgba(255,255,255,0.85) 0 1.5px, transparent 1.5px 20px)," +
            "repeating-linear-gradient(-35deg, rgba(255,255,255,0.85) 0 1.5px, transparent 1.5px 20px)",
        }}
        initial={{ scale: 0.35, y: "-24vh", opacity: 0.5 }}
        animate={{ scale: [0.35, 8, 9], y: ["-24vh", "0vh", "0vh"], opacity: [0.5, 1, 1] }}
        transition={{
          duration: flightDuration + 0.12,
          delay: kickDelay,
          times: [0, 0.92, 1],
          ease: [0.22, 0.7, 0.35, 1],
        }}
      />

      {/* player silhouette, planted at the bottom-left, swings a leg into the ball */}
      <motion.div
        className="absolute"
        style={{ left: "18%", bottom: "14%", width: 46, height: 92 }}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: [0, 1, 1, 0], y: 0 }}
        transition={{ duration: 0.75, times: [0, 0.15, 0.75, 1], delay: 0.05 }}
      >
        {/* head */}
        <div className="absolute rounded-full bg-white/90" style={{ width: 16, height: 16, left: 15, top: 0 }} />
        {/* torso */}
        <div className="absolute rounded-full bg-white/90" style={{ width: 14, height: 34, left: 16, top: 15 }} />
        {/* standing leg */}
        <div className="absolute rounded-full bg-white/90" style={{ width: 9, height: 38, left: 13, top: 46 }} />
        {/* kicking leg — swings forward to meet the ball */}
        <motion.div
          className="absolute rounded-full bg-white/90 origin-top"
          style={{ width: 9, height: 38, left: 24, top: 46 }}
          initial={{ rotate: 25 }}
          animate={{ rotate: -85 }}
          transition={{ duration: 0.22, delay: kickDelay, ease: "easeIn" }}
        />
      </motion.div>

      {/* ball, kicked from lower-left, grows huge as it rushes into the net */}
      <motion.div
        className="absolute select-none"
        style={{ fontSize: 34, lineHeight: 1 }}
        initial={{ x: "-28vw", y: "22vh", scale: 0.7, rotate: 0, opacity: 0 }}
        animate={{ x: "0vw", y: "0vh", scale: [0.7, 16, 18], rotate: 460, opacity: 1 }}
        transition={{
          opacity: { duration: 0.05, delay: kickDelay },
          default: {
            duration: flightDuration + 0.12,
            delay: kickDelay,
            times: [0, 0.92, 1],
            ease: [0.22, 0.7, 0.35, 1],
          },
        }}
      >
        ⚽
      </motion.div>

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
          <span className="mt-14 inline-flex items-center gap-3 rounded-full bg-primary/10 px-7 py-3 text-lg sm:text-xl font-bold text-primary border border-primary/20">
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
            { icon: Zap, title: "Weighted rubrics", body: "Configure criteria, weights, and score scales for fair, consistent judging." },
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

      <div className="relative text-center text-xs text-muted-foreground pb-6 space-y-0.5">
        <p>⚽ Built for fans</p>
        <p>Developed by Kritima Kukreja</p>
        <p>Powered by SynkTech</p>
      </div>
    </div>
  );
}
