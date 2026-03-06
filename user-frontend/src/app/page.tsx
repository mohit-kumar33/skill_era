'use client';

import Link from "next/link";
import { useState, useEffect, useRef } from "react";

/* ═══════════════════════════════════════════════════════════
   DATA
   ═══════════════════════════════════════════════════════════ */

const highlights = [
  {
    title: "Instant tournament entry",
    description:
      "Join verified brackets in seconds with transparent rules, timers, and prize pools.",
    icon: "⚡",
    gradient: "from-cyan-400/20 to-indigo-400/20",
  },
  {
    title: "Secure Skill Wallet",
    description:
      "Track entry fees, winnings, and withdrawals with real-time settlement visibility.",
    icon: "🔒",
    gradient: "from-emerald-400/20 to-cyan-400/20",
  },
  {
    title: "Skill-based matchmaking",
    description:
      "Compete against balanced opponents using adaptive ranking and fair-play checks.",
    icon: "🎯",
    gradient: "from-fuchsia-400/20 to-indigo-400/20",
  },
];

const steps = [
  {
    num: "01",
    title: "Create your profile",
    description:
      "Verify your gamer ID, set your play style, and choose the titles you compete in.",
  },
  {
    num: "02",
    title: "Enter a tournament",
    description:
      "Pick a buy-in level, review the rules, and lock in your seat instantly.",
  },
  {
    num: "03",
    title: "Win and withdraw",
    description:
      "Earn rewards, collect bonuses, and withdraw winnings straight from your wallet.",
  },
];

const tournaments = [
  {
    title: "Arena Rush: Solo Clash",
    meta: "Entry: ₹500 • Prize Pool: ₹1,50,000",
    status: "Live tonight",
    live: true,
    players: 128,
    format: "1v1 · Mobile",
  },
  {
    title: "Squad Elite Invitational",
    meta: "Entry: ₹2,000 • Prize Pool: ₹10,00,000",
    status: "Weekend only",
    live: false,
    players: 256,
    format: "5v5 · Console + Mobile",
  },
  {
    title: "Mobile Masters Cup",
    meta: "Entry: Free • Prize Pool: ₹2,00,000",
    status: "Open qualifiers",
    live: false,
    players: 512,
    format: "Solo · Mobile",
  },
];

const testimonials = [
  {
    quote: "Skill Era pays out faster than any platform I have ever used.",
    name: "Alex R.",
    role: "Apex Competitor",
    tag: "Player highlight",
  },
  {
    quote: "We launched three brackets in a week and filled them all.",
    name: "Nova Ops",
    role: "Community League",
    tag: "Organizer highlight",
  },
  {
    quote: "Skill Era keeps our team focused with clear rules and instant updates.",
    name: "Mina Q.",
    role: "Tactical Coach",
    tag: "Coach spotlight",
  },
];

const faqs = [
  {
    question: "Is Skill Era available in India?",
    answer:
      "Yes! Skill Era is built for Indian esports players. Tournament eligibility depends on your state and local regulations.",
  },
  {
    question: "How fast are payouts?",
    answer:
      "Most withdrawals are processed within 24 hours once tournament results are verified. TDS is automatically calculated.",
  },
  {
    question: "Can I play on mobile?",
    answer:
      "Absolutely. Skill Era is optimized for mobile-first tournaments and real-time score tracking.",
  },
];

const stats = [
  { value: 120, suffix: "+", label: "Monthly tournaments" },
  { value: 25, suffix: "L+", label: "Rewards paid out" },
  { value: 24, suffix: "/7", label: "Live matchmaking" },
  { value: 10, suffix: "k+", label: "Active players" },
];

/* ═══════════════════════════════════════════════════════════
   ANIMATED COUNTER HOOK
   ═══════════════════════════════════════════════════════════ */

function useCountUp(end: number, duration = 2000) {
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started) {
          setStarted(true);
        }
      },
      { threshold: 0.3 }
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [started]);

  useEffect(() => {
    if (!started) return;
    let startTime: number;
    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      setCount(Math.floor(eased * end));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [started, end, duration]);

  return { count, ref };
}

/* ═══════════════════════════════════════════════════════════
   INTERSECTION OBSERVER HOOK
   ═══════════════════════════════════════════════════════════ */

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setInView(true);
      },
      { threshold }
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, inView };
}

/* ═══════════════════════════════════════════════════════════
   STAT CARD COMPONENT
   ═══════════════════════════════════════════════════════════ */

function StatCard({ value, suffix, label }: { value: number; suffix: string; label: string }) {
  const { count, ref } = useCountUp(value, 2000);
  return (
    <div ref={ref} className="text-center">
      <p className="text-3xl sm:text-4xl font-bold text-white">
        {count}
        <span className="gradient-text-hero">{suffix}</span>
      </p>
      <p className="text-sm text-white/50 mt-1">{label}</p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   ANIMATED SECTION WRAPPER
   ═══════════════════════════════════════════════════════════ */

function AnimatedSection({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const { ref, inView } = useInView();
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${className} ${inView
          ? "opacity-100 translate-y-0"
          : "opacity-0 translate-y-8"
        }`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN PAGE COMPONENT
   ═══════════════════════════════════════════════════════════ */

export default function Home() {
  const [mobileNav, setMobileNav] = useState(false);

  return (
    <div className="min-h-screen bg-[#0b0b10] text-white overflow-x-hidden">
      {/* ── Animated Background Orbs ────────────────────── */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute -top-32 right-[-15%] h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle,_rgba(88,80,236,0.35),_transparent_65%)] blur-3xl animate-float" />
        <div className="absolute top-[40%] left-[-10%] h-[400px] w-[400px] rounded-full bg-[radial-gradient(circle,_rgba(14,165,233,0.25),_transparent_70%)] blur-3xl animate-float-slow" />
        <div className="absolute bottom-[-10%] right-[20%] h-[350px] w-[350px] rounded-full bg-[radial-gradient(circle,_rgba(192,132,252,0.2),_transparent_70%)] blur-3xl animate-float-delay" />
      </div>

      {/* ── Noise Texture Overlay ────────────────────────── */}
      <div className="fixed inset-0 pointer-events-none z-[1] opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      <div className="relative z-10">
        {/* ════════════════════════════════════════════════
            HEADER / NAVIGATION
            ════════════════════════════════════════════════ */}
        <header className="sticky top-0 z-50 border-b border-white/5 bg-[#0b0b10]/80 backdrop-blur-xl">
          <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
            <Link href="/" className="flex items-center gap-3 group">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-cyan-400 text-sm font-bold tracking-wider transition-transform group-hover:scale-105">
                SE
              </span>
              <div>
                <p className="text-lg font-semibold tracking-wide">Skill Era</p>
                <p className="text-[10px] uppercase tracking-[0.2em] text-white/40">
                  Competitive gaming
                </p>
              </div>
            </Link>

            {/* Desktop nav */}
            <div className="hidden items-center gap-8 text-sm text-white/60 md:flex">
              <a href="#features" className="hover:text-white transition-colors">
                Features
              </a>
              <a href="#tournaments" className="hover:text-white transition-colors">
                Tournaments
              </a>
              <a href="#wallet" className="hover:text-white transition-colors">
                Wallet
              </a>
              <a href="#faq" className="hover:text-white transition-colors">
                FAQ
              </a>
            </div>

            <div className="flex items-center gap-3 text-sm">
              <Link
                href="/login"
                className="hidden sm:inline-flex rounded-full border border-white/15 px-5 py-2 text-white/70 transition hover:border-white/40 hover:text-white"
              >
                Log in
              </Link>
              <Link
                href="/register"
                className="rounded-full bg-gradient-to-r from-indigo-500 to-cyan-400 px-5 py-2 font-semibold text-white transition hover:shadow-lg hover:shadow-indigo-500/25 hover:-translate-y-0.5"
              >
                Get started
              </Link>

              {/* Mobile menu toggle */}
              <button
                onClick={() => setMobileNav(!mobileNav)}
                className="flex md:hidden flex-col gap-1.5 p-2"
                aria-label="Toggle menu"
              >
                <span
                  className={`block h-0.5 w-5 bg-white/70 transition-all ${mobileNav ? "rotate-45 translate-y-2" : ""
                    }`}
                />
                <span
                  className={`block h-0.5 w-5 bg-white/70 transition-all ${mobileNav ? "opacity-0" : ""
                    }`}
                />
                <span
                  className={`block h-0.5 w-5 bg-white/70 transition-all ${mobileNav ? "-rotate-45 -translate-y-2" : ""
                    }`}
                />
              </button>
            </div>
          </nav>

          {/* Mobile nav dropdown */}
          {mobileNav && (
            <div className="md:hidden border-t border-white/5 bg-[#0b0b10]/95 backdrop-blur-xl animate-fade-in">
              <div className="flex flex-col gap-4 px-6 py-6 text-sm text-white/60">
                <a href="#features" onClick={() => setMobileNav(false)} className="hover:text-white transition-colors">Features</a>
                <a href="#tournaments" onClick={() => setMobileNav(false)} className="hover:text-white transition-colors">Tournaments</a>
                <a href="#wallet" onClick={() => setMobileNav(false)} className="hover:text-white transition-colors">Wallet</a>
                <a href="#faq" onClick={() => setMobileNav(false)} className="hover:text-white transition-colors">FAQ</a>
                <Link href="/login" onClick={() => setMobileNav(false)} className="hover:text-white transition-colors">Log in</Link>
              </div>
            </div>
          )}
        </header>

        {/* ════════════════════════════════════════════════
            HERO SECTION
            ════════════════════════════════════════════════ */}
        <section className="relative mx-auto flex w-full max-w-6xl flex-col gap-16 px-6 pb-28 pt-16 lg:flex-row lg:items-center">
          <div className="flex-1 space-y-8">
            <div className="animate-fade-in-up">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.2em] text-white/60 animate-pulse-glow">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse-dot" />
                Live tournaments active now
              </div>
            </div>

            <h1 className="animate-fade-in-up text-balance text-4xl font-bold leading-[1.1] sm:text-5xl lg:text-[3.5rem]"
              style={{ animationDelay: "100ms" }}
            >
              The arena where
              <br />
              <span className="gradient-text-hero">
                skills earn real rewards.
              </span>
            </h1>

            <p
              className="animate-fade-in-up max-w-xl text-base text-white/60 sm:text-lg leading-relaxed"
              style={{ animationDelay: "200ms" }}
            >
              Skill Era connects competitive players with verified tournaments,
              instant payouts, and a community built for serious match-ups.
              Find your bracket, enter in seconds, and track every win.
            </p>

            <div
              className="animate-fade-in-up flex flex-wrap gap-4"
              style={{ animationDelay: "300ms" }}
            >
              <Link
                href="/register"
                className="group rounded-full bg-gradient-to-r from-indigo-500 to-cyan-400 px-7 py-3.5 text-sm font-semibold text-white transition-all hover:shadow-xl hover:shadow-indigo-500/30 hover:-translate-y-0.5"
              >
                Start competing
                <span className="inline-block ml-2 transition-transform group-hover:translate-x-1">
                  →
                </span>
              </Link>
              <Link
                href="/login"
                className="rounded-full border border-white/15 px-7 py-3.5 text-sm font-semibold text-white/70 transition-all hover:border-white/40 hover:text-white hover:bg-white/5"
              >
                Log in to dashboard
              </Link>
            </div>

            {/* Stats row */}
            <div
              className="animate-fade-in-up flex flex-wrap gap-8 pt-4"
              style={{ animationDelay: "400ms" }}
            >
              {stats.map((stat) => (
                <StatCard key={stat.label} {...stat} />
              ))}
            </div>
          </div>

          {/* Hero right — Feature cards */}
          <div
            className="flex-1 animate-fade-in-up"
            style={{ animationDelay: "300ms" }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              {highlights.map((h, i) => (
                <div
                  key={h.title}
                  className={`group glass-card glass-card-hover rounded-3xl p-6 transition-all duration-300 hover:-translate-y-1 ${i === 0 ? "delay-100" : i === 1 ? "delay-200" : "delay-300"
                    }`}
                >
                  <div
                    className={`mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${h.gradient} text-xl transition-transform group-hover:scale-110`}
                  >
                    {h.icon}
                  </div>
                  <h3 className="text-lg font-semibold">{h.title}</h3>
                  <p className="mt-2 text-sm text-white/60">{h.description}</p>
                </div>
              ))}

              {/* Live tournament card */}
              <div className="glass-card rounded-3xl bg-gradient-to-br from-white/[0.08] to-white/[0.02] p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 h-32 w-32 bg-[radial-gradient(circle,_rgba(88,80,236,0.3),_transparent_70%)] blur-2xl" />
                <div className="relative">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-white/50">
                    <span className="h-2 w-2 rounded-full bg-red-400 animate-pulse-dot" />
                    Live now
                  </div>
                  <h3 className="mt-4 text-2xl font-bold">Night League Finals</h3>
                  <p className="mt-2 text-sm text-white/60">
                    128 players battling for the ₹5,00,000 spotlight prize.
                  </p>
                  <div className="mt-6 flex items-center justify-between text-sm">
                    <span className="text-white/50">Starts in 2h 14m</span>
                    <span className="rounded-full bg-white/10 px-3 py-1 text-white/70 hover:bg-white/20 transition-colors cursor-pointer">
                      Watch now
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Scrolling game ticker ─────────────────────── */}
        <div className="border-y border-white/5 bg-white/[0.02] py-4 overflow-hidden">
          <div className="animate-marquee flex gap-8 whitespace-nowrap text-sm text-white/30">
            {[
              "VALORANT",
              "BGMI",
              "FREE FIRE",
              "CALL OF DUTY MOBILE",
              "CLASH ROYALE",
              "APEX LEGENDS MOBILE",
              "FIFA MOBILE",
              "POKEMON UNITE",
              "VALORANT",
              "BGMI",
              "FREE FIRE",
              "CALL OF DUTY MOBILE",
              "CLASH ROYALE",
              "APEX LEGENDS MOBILE",
              "FIFA MOBILE",
              "POKEMON UNITE",
            ].map((game, i) => (
              <span key={i} className="flex items-center gap-3">
                <span className="h-1.5 w-1.5 rounded-full bg-white/20" />
                {game}
              </span>
            ))}
          </div>
        </div>

        {/* ════════════════════════════════════════════════
            HOW IT WORKS
            ════════════════════════════════════════════════ */}
        <section id="features" className="mx-auto w-full max-w-6xl px-6 py-24">
          <AnimatedSection>
            <div className="flex flex-col gap-10 lg:flex-row lg:items-center">
              <div className="flex-1">
                <p className="text-sm uppercase tracking-[0.3em] text-cyan-300/70 font-medium">
                  Built for competitors
                </p>
                <h2 className="mt-4 text-3xl font-bold sm:text-4xl leading-tight">
                  Everything needed to{" "}
                  <span className="gradient-text-hero">compete, win, and grow.</span>
                </h2>
                <p className="mt-4 max-w-xl text-base text-white/60">
                  Skill Era keeps every tournament secure, transparent, and fast.
                  From match results to payments, the entire experience is
                  designed for focused players and organizers.
                </p>
              </div>
              <div className="grid flex-1 gap-5 sm:grid-cols-2">
                {steps.map((step, index) => (
                  <AnimatedSection key={step.title} delay={index * 100}>
                    <div className="glass-card glass-card-hover rounded-3xl p-6 transition-all duration-300 group">
                      <p className="text-xs font-bold text-indigo-400/60 tracking-wider">
                        STEP {step.num}
                      </p>
                      <h3 className="mt-3 text-lg font-semibold group-hover:text-cyan-300 transition-colors">
                        {step.title}
                      </h3>
                      <p className="mt-2 text-sm text-white/60">{step.description}</p>
                    </div>
                  </AnimatedSection>
                ))}
              </div>
            </div>
          </AnimatedSection>
        </section>

        {/* ════════════════════════════════════════════════
            FEATURED TOURNAMENTS
            ════════════════════════════════════════════════ */}
        <section id="tournaments" className="mx-auto w-full max-w-6xl px-6 py-24">
          <AnimatedSection>
            <div className="flex flex-col gap-12">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.3em] text-fuchsia-300/70 font-medium">
                    Featured brackets
                  </p>
                  <h2 className="mt-3 text-3xl font-bold sm:text-4xl">
                    Tournaments curated by{" "}
                    <span className="gradient-text-hero">top organizers.</span>
                  </h2>
                </div>
                <Link
                  href="/register"
                  className="text-sm font-semibold text-white/50 transition hover:text-white group"
                >
                  View all tournaments
                  <span className="inline-block ml-1 transition-transform group-hover:translate-x-1">→</span>
                </Link>
              </div>

              <div className="grid gap-6 lg:grid-cols-3">
                {tournaments.map((tournament, i) => (
                  <AnimatedSection key={tournament.title} delay={i * 100}>
                    <div className="glass-card glass-card-hover rounded-3xl p-6 transition-all duration-300 hover:-translate-y-1 group h-full">
                      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-white/50">
                        {tournament.live && (
                          <span className="h-2 w-2 rounded-full bg-red-400 animate-pulse-dot" />
                        )}
                        {tournament.status}
                      </div>
                      <h3 className="mt-4 text-xl font-bold group-hover:text-white transition-colors">
                        {tournament.title}
                      </h3>
                      <p className="mt-2 text-sm text-white/60">{tournament.meta}</p>
                      <div className="mt-6 flex items-center justify-between text-xs text-white/50">
                        <span className="rounded-full border border-white/10 px-3 py-1">
                          {tournament.format}
                        </span>
                        <span>+{tournament.players} registered</span>
                      </div>
                    </div>
                  </AnimatedSection>
                ))}
              </div>
            </div>
          </AnimatedSection>
        </section>

        {/* ════════════════════════════════════════════════
            WALLET SECTION
            ════════════════════════════════════════════════ */}
        <section id="wallet" className="mx-auto w-full max-w-6xl px-6 py-24">
          <AnimatedSection>
            <div className="grid gap-8 rounded-[2rem] border border-white/[0.06] bg-gradient-to-br from-white/[0.06] to-white/[0.02] p-8 sm:p-12 lg:grid-cols-[1.2fr_1fr] lg:items-center relative overflow-hidden">
              {/* Background glow */}
              <div className="absolute top-0 left-0 h-48 w-48 bg-[radial-gradient(circle,_rgba(16,185,129,0.2),_transparent_70%)] blur-3xl" />
              <div className="absolute bottom-0 right-0 h-48 w-48 bg-[radial-gradient(circle,_rgba(88,80,236,0.15),_transparent_70%)] blur-3xl" />

              <div className="relative">
                <p className="text-sm uppercase tracking-[0.3em] text-emerald-300/70 font-medium">
                  Skill Wallet
                </p>
                <h2 className="mt-3 text-3xl font-bold sm:text-4xl">
                  Manage entries, rewards, and{" "}
                  <span className="gradient-text-hero">withdrawals in one place.</span>
                </h2>
                <p className="mt-4 text-base text-white/60">
                  Keep your competitive finances organized with transaction
                  history, bonus rewards, and instant notifications. Move
                  winnings to your bank directly.
                </p>
                <div className="mt-6 flex flex-wrap gap-3 text-sm text-white/60">
                  {["Instant balance", "Secure payouts", "TDS compliant", "UPI withdrawals"].map((tag) => (
                    <span key={tag} className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-1.5 hover:border-white/20 transition-colors">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Wallet mockup */}
              <div className="relative glass-card rounded-3xl p-6">
                <div className="flex items-center justify-between text-sm text-white/50">
                  <span>Wallet overview</span>
                  <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-emerald-300 text-xs font-medium">
                    ✓ Verified
                  </span>
                </div>
                <div className="mt-6 grid gap-4">
                  <div className="flex items-center justify-between rounded-2xl bg-white/[0.04] px-5 py-4">
                    <div>
                      <p className="text-xs text-white/50">Available balance</p>
                      <p className="text-2xl font-bold mt-1">₹1,28,440</p>
                    </div>
                    <span className="text-xs text-emerald-300 bg-emerald-500/10 px-3 py-1 rounded-full">
                      +18% this month
                    </span>
                  </div>
                  <div className="rounded-2xl border border-white/[0.06] px-5 py-4">
                    <p className="text-xs text-white/50">Recent payout</p>
                    <p className="text-lg font-semibold mt-1">₹42,000 • Sent today</p>
                    <p className="text-xs text-white/40 mt-0.5">Night League Finals</p>
                  </div>
                  <div className="rounded-2xl border border-white/[0.06] px-5 py-4">
                    <p className="text-xs text-white/50">Upcoming fees</p>
                    <p className="text-lg font-semibold mt-1">₹3,500 • 2 tournaments</p>
                    <p className="text-xs text-white/40 mt-0.5">Auto-reserved brackets</p>
                  </div>
                </div>
              </div>
            </div>
          </AnimatedSection>
        </section>

        {/* ════════════════════════════════════════════════
            TESTIMONIALS + COMMUNITY
            ════════════════════════════════════════════════ */}
        <section className="mx-auto w-full max-w-6xl px-6 py-24">
          <AnimatedSection>
            <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr]">
              <div className="glass-card rounded-[2rem] p-8 sm:p-10">
                <p className="text-sm uppercase tracking-[0.3em] text-cyan-300/70 font-medium">
                  Community powered
                </p>
                <h2 className="mt-3 text-3xl font-bold sm:text-4xl">
                  Organized by players,{" "}
                  <span className="gradient-text-hero">amplified by Skill Era.</span>
                </h2>
                <p className="mt-4 text-base text-white/60">
                  Teams, streamers, and esports orgs run their own events with
                  built-in bracket tools, rule enforcement, and live reporting.
                </p>
                <div className="mt-8 grid gap-4 sm:grid-cols-2">
                  {[
                    { label: "Organizer tools", value: "Automated brackets" },
                    { label: "Live updates", value: "Score verification" },
                    { label: "Audience reach", value: "Stream integration" },
                    { label: "Rewards engine", value: "Sponsor boosts" },
                  ].map((item) => (
                    <div key={item.label} className="rounded-2xl bg-white/[0.04] p-4 hover:bg-white/[0.07] transition-colors">
                      <p className="text-xs text-white/40">{item.label}</p>
                      <p className="mt-2 text-base font-semibold">{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-5">
                {testimonials.map((t, i) => (
                  <AnimatedSection key={t.name} delay={i * 100}>
                    <div className="glass-card glass-card-hover rounded-3xl p-6 transition-all duration-300 group">
                      <p className="text-xs text-white/40">{t.tag}</p>
                      <h3 className="mt-3 text-lg font-semibold leading-snug group-hover:text-cyan-200 transition-colors">
                        &ldquo;{t.quote}&rdquo;
                      </h3>
                      <p className="mt-4 text-sm text-white/50">
                        {t.name} · {t.role}
                      </p>
                    </div>
                  </AnimatedSection>
                ))}
              </div>
            </div>
          </AnimatedSection>
        </section>

        {/* ════════════════════════════════════════════════
            FAQ
            ════════════════════════════════════════════════ */}
        <section id="faq" className="mx-auto w-full max-w-6xl px-6 py-24">
          <AnimatedSection>
            <div className="text-center mb-12">
              <p className="text-sm uppercase tracking-[0.3em] text-indigo-300/70 font-medium">
                FAQ
              </p>
              <h2 className="mt-3 text-3xl font-bold sm:text-4xl">
                Frequently asked questions
              </h2>
            </div>
            <div className="grid gap-6 lg:grid-cols-3">
              {faqs.map((faq, i) => (
                <AnimatedSection key={faq.question} delay={i * 100}>
                  <div className="glass-card glass-card-hover rounded-3xl p-6 h-full transition-all duration-300">
                    <h3 className="text-lg font-semibold">{faq.question}</h3>
                    <p className="mt-3 text-sm text-white/60 leading-relaxed">{faq.answer}</p>
                  </div>
                </AnimatedSection>
              ))}
            </div>
          </AnimatedSection>
        </section>

        {/* ════════════════════════════════════════════════
            FINAL CTA
            ════════════════════════════════════════════════ */}
        <section className="mx-auto w-full max-w-6xl px-6 pb-28">
          <AnimatedSection>
            <div className="rounded-[2rem] border border-white/[0.06] bg-gradient-to-br from-indigo-500/10 via-white/[0.04] to-cyan-500/10 p-10 sm:p-16 text-center relative overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(88,80,236,0.15),_transparent_60%)]" />
              <div className="relative">
                <h2 className="text-3xl font-bold sm:text-5xl leading-tight">
                  Ready to prove
                  <br />
                  <span className="gradient-text-hero">your skill?</span>
                </h2>
                <p className="mt-6 text-base text-white/60 max-w-md mx-auto">
                  Create a free account, join your first tournament, and start
                  earning in under five minutes.
                </p>
                <div className="mt-10 flex flex-wrap justify-center gap-4">
                  <Link
                    href="/register"
                    className="group rounded-full bg-gradient-to-r from-indigo-500 to-cyan-400 px-8 py-4 text-sm font-semibold text-white transition-all hover:shadow-xl hover:shadow-indigo-500/30 hover:-translate-y-0.5"
                  >
                    Create free account
                    <span className="inline-block ml-2 transition-transform group-hover:translate-x-1">→</span>
                  </Link>
                  <Link
                    href="/login"
                    className="rounded-full border border-white/15 px-8 py-4 text-sm font-semibold text-white/70 transition-all hover:border-white/40 hover:text-white hover:bg-white/5"
                  >
                    Log in
                  </Link>
                </div>
              </div>
            </div>
          </AnimatedSection>
        </section>

        {/* ════════════════════════════════════════════════
            FOOTER
            ════════════════════════════════════════════════ */}
        <footer className="border-t border-white/[0.06] bg-[#08080d]">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-12 text-sm text-white/50 md:flex-row md:items-start md:justify-between">
            <div className="max-w-xs">
              <div className="flex items-center gap-3 mb-4">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-400 text-xs font-bold">
                  SE
                </span>
                <p className="text-base font-semibold text-white">Skill Era</p>
              </div>
              <p className="text-white/40 leading-relaxed">
                Competitive tournaments, verified payouts, and the community
                that keeps pushing you higher.
              </p>
            </div>
            <div className="flex flex-wrap gap-x-12 gap-y-4">
              <div className="space-y-3">
                <p className="text-xs uppercase tracking-wider text-white/30">Platform</p>
                <Link href="/register" className="block hover:text-white transition-colors">Tournaments</Link>
                <Link href="/register" className="block hover:text-white transition-colors">Wallet</Link>
                <Link href="/register" className="block hover:text-white transition-colors">Dashboard</Link>
              </div>
              <div className="space-y-3">
                <p className="text-xs uppercase tracking-wider text-white/30">Account</p>
                <Link href="/register" className="block hover:text-white transition-colors">Register</Link>
                <Link href="/login" className="block hover:text-white transition-colors">Log in</Link>
              </div>
            </div>
          </div>
          <div className="border-t border-white/[0.04]">
            <div className="mx-auto max-w-6xl px-6 py-5 text-center text-xs text-white/25">
              © {new Date().getFullYear()} Skill Era. All rights reserved. Play responsibly.
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
