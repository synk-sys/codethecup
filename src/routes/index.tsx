import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
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

function playCameraFlashes(count: number, spread: number) {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new Ctx();
    for (let i = 0; i < count; i++) {
      const t0 = ctx.currentTime + (Math.random() * spread);
      const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.03, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let j = 0; j < data.length; j++) data[j] = (Math.random() * 2 - 1) * (1 - j / data.length);
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuf;
      const filter = ctx.createBiquadFilter();
      filter.type = "highpass";
      filter.frequency.value = 4000;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.18, t0);
      gain.gain.linearRampToValueAtTime(0, t0 + 0.03);
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      noise.start(t0);
    }
    setTimeout(() => ctx.close(), (spread + 0.2) * 1000);
  } catch {
    // audio not available — silently skip
  }
}

function playStamp() {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new Ctx();
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(160, t0);
    osc.frequency.exponentialRampToValueAtTime(45, t0 + 0.18);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.5, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.22);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.25);
    setTimeout(() => ctx.close(), 400);
  } catch {
    // audio not available — silently skip
  }
}

function playCoinFlip() {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new Ctx();
    const t0 = ctx.currentTime;
    for (let i = 0; i < 7; i++) {
      const t = t0 + i * 0.09 + (i * i) * 0.01;
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(1600 - i * 60, t);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.12, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.08);
    }
    const t1 = t0 + 0.85;
    const ding = ctx.createOscillator();
    ding.type = "sine";
    ding.frequency.setValueAtTime(1200, t1);
    const dingGain = ctx.createGain();
    dingGain.gain.setValueAtTime(0.25, t1);
    dingGain.gain.exponentialRampToValueAtTime(0.001, t1 + 0.4);
    ding.connect(dingGain);
    dingGain.connect(ctx.destination);
    ding.start(t1);
    ding.stop(t1 + 0.4);
    setTimeout(() => ctx.close(), 1400);
  } catch {
    // audio not available — silently skip
  }
}

function TunnelTransition({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) { onDone(); return; }
    playCameraFlashes(9, 1.0);
    const t = setTimeout(onDone, TRANSITION_MS + 300);
    return () => clearTimeout(t);
  }, [onDone]);

  const flashes = Array.from({ length: 9 }, (_, i) => ({
    left: `${10 + Math.random() * 80}%`,
    top: `${10 + Math.random() * 60}%`,
    delay: Math.random() * 1.0,
  }));

  return (
    <motion.div
      role="button"
      aria-label="Skip"
      onClick={onDone}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="fixed inset-0 z-50 flex items-center justify-center cursor-pointer overflow-hidden bg-black"
    >
      {/* converging tunnel walls */}
      <div className="absolute inset-0" style={{ perspective: 400 }}>
        {[0, 1, 2, 3].map((i) => (
          <motion.div
            key={i}
            className="absolute inset-0"
            style={{
              background: `linear-gradient(180deg, transparent, rgba(255,255,255,0.04) 50%, transparent)`,
              clipPath: `polygon(${8 + i * 6}% 0%, ${92 - i * 6}% 0%, ${78 - i * 4}% 100%, ${22 + i * 4}% 100%)`,
              border: "1px solid rgba(255,255,255,0.08)",
            }}
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.6, delay: i * 0.08 }}
          />
        ))}
      </div>

      {/* camera flashes */}
      {flashes.map((f, i) => (
        <motion.div
          key={i}
          className="absolute h-3 w-3 rounded-full bg-white"
          style={{ left: f.left, top: f.top, boxShadow: "0 0 40px 20px rgba(255,255,255,0.9)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 0] }}
          transition={{ duration: 0.18, delay: f.delay }}
        />
      ))}

      {/* spotlight sweep */}
      <motion.div
        className="absolute inset-0"
        style={{ background: "radial-gradient(ellipse 40% 60% at 50% 50%, rgba(66,133,244,0.25), transparent 70%)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 1] }}
        transition={{ duration: 0.8 }}
      />

      {/* player walking out, growing as it approaches */}
      <motion.div
        className="absolute rounded-full bg-white"
        style={{ width: 20, height: 46, bottom: "20%" }}
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: [0.4, 1.6], opacity: [0, 1, 1] }}
        transition={{ duration: TRANSITION_MS / 1000, ease: "easeIn" }}
      />

      <motion.p
        className="absolute top-[16%] text-white font-black tracking-wide text-center px-6"
        style={{ fontSize: "clamp(22px, 4.5vw, 40px)" }}
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: [0, 1, 1, 0], y: 0 }}
        transition={{ duration: TRANSITION_MS / 1000 + 0.3, times: [0, 0.2, 0.75, 1] }}
      >
        WALKING OUT
      </motion.p>

      <span className="absolute bottom-6 text-xs text-white/50">Tap to skip</span>
    </motion.div>
  );
}

function VarReviewTransition({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) { onDone(); return; }
    const stampT = setTimeout(playStamp, 950);
    const t = setTimeout(onDone, TRANSITION_MS + 500);
    return () => { clearTimeout(t); clearTimeout(stampT); };
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
      className="fixed inset-0 z-50 flex flex-col items-center justify-center cursor-pointer overflow-hidden bg-black"
    >
      <motion.div
        className="rounded-lg border-2 border-white px-4 py-1.5 text-white font-black tracking-[0.2em] text-sm mb-8"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        VAR
      </motion.div>

      {/* scanning line sweep */}
      <div className="relative w-[70vw] max-w-md h-24 border border-white/30 rounded-xl overflow-hidden mb-8">
        <motion.div
          className="absolute inset-x-0 h-1"
          style={{ background: "linear-gradient(90deg, transparent, #34A853, transparent)" }}
          initial={{ top: "0%" }}
          animate={{ top: ["0%", "100%", "0%"] }}
          transition={{ duration: 0.9, repeat: 1, ease: "linear" }}
        />
      </div>

      <motion.p
        className="text-white/80 font-semibold tracking-widest text-sm mb-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 1, 0] }}
        transition={{ duration: 0.95, times: [0, 0.2, 0.8, 1] }}
      >
        CHECKING ENTRY...
      </motion.p>

      <motion.div
        className="absolute flex items-center gap-2 rounded-xl border-4 px-6 py-3"
        style={{ borderColor: "#34A853", color: "#34A853" }}
        initial={{ opacity: 0, scale: 2, rotate: -8 }}
        animate={{ opacity: [0, 0, 1], scale: [2, 2, 1], rotate: [-8, -8, -6] }}
        transition={{ duration: 1.1, times: [0, 0.82, 1], ease: "easeOut" }}
      >
        <span className="text-3xl font-black tracking-wider">CONFIRMED ✓</span>
      </motion.div>

      <span className="absolute bottom-6 text-xs text-white/50">Tap to skip</span>
    </motion.div>
  );
}

function CoinTossTransition({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) { onDone(); return; }
    playCoinFlip();
    const t = setTimeout(onDone, TRANSITION_MS + 300);
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
      className="fixed inset-0 z-50 flex flex-col items-center justify-center cursor-pointer overflow-hidden"
      style={{ background: "var(--gradient-stage, #0d1b3d)" }}
    >
      <motion.div
        className="relative grid place-items-center rounded-full font-black text-4xl"
        style={{
          width: 120, height: 120,
          background: "linear-gradient(135deg, #FBBC05, #EA4335)",
          boxShadow: "0 0 60px rgba(251,188,5,0.5)",
          color: "#fff",
        }}
        initial={{ y: -40, rotateX: 0, scale: 0.8 }}
        animate={{
          y: [-40, -160, 0],
          rotateX: [0, 1080, 1440],
          scale: [0.8, 0.8, 1],
        }}
        transition={{ duration: 0.9, times: [0, 0.55, 1], ease: [0.33, 1, 0.68, 1] }}
      >
        ⚽
      </motion.div>

      <motion.p
        className="mt-10 text-white font-black tracking-wide text-center px-6"
        style={{ fontSize: "clamp(22px, 4.5vw, 40px)" }}
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: [0, 0, 1], scale: [0.85, 0.85, 1] }}
        transition={{ duration: 1.1, times: [0, 0.8, 1] }}
      >
        KICKOFF!
      </motion.p>

      <span className="absolute bottom-6 text-xs text-white/50">Tap to skip</span>
    </motion.div>
  );
}

const TRANSITIONS = {
  goal: StadiumTransition,
  tunnel: TunnelTransition,
  var: VarReviewTransition,
  coin: CoinTossTransition,
} as const;
type TransitionVariant = keyof typeof TRANSITIONS;

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): { transition?: TransitionVariant } => ({
    transition: (["goal", "tunnel", "var", "coin"] as const).includes(search.transition as TransitionVariant)
      ? (search.transition as TransitionVariant)
      : undefined,
  }),
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();
  const { transition } = Route.useSearch();
  const [entering, setEntering] = useState(false);
  const navigatedRef = useRef(false);
  const TransitionComponent = TRANSITIONS[transition ?? "goal"];

  function goToStadium() {
    if (navigatedRef.current) return;
    navigatedRef.current = true;
    navigate({ to: "/auth", search: { mode: "participant" } });
  }

  return (
    <div className="min-h-screen">
      <AnimatePresence>
        {entering && <TransitionComponent onDone={goToStadium} />}
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
