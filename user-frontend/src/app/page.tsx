import Link from "next/link";

const highlights = [
  {
    title: "Instant tournament entry",
    description:
      "Join verified brackets in seconds with transparent rules, timers, and prize pools.",
  },
  {
    title: "Secure Skill Wallet",
    description:
      "Track entry fees, winnings, and withdrawals with real-time settlement visibility.",
  },
  {
    title: "Skill-based matchmaking",
    description:
      "Compete against balanced opponents using adaptive ranking and fair-play checks.",
  },
];

const steps = [
  {
    title: "Create your profile",
    description:
      "Verify your gamer ID, set your play style, and choose the titles you compete in.",
  },
  {
    title: "Enter a tournament",
    description:
      "Pick a buy-in level, review the rules, and lock in your seat instantly.",
  },
  {
    title: "Win and withdraw",
    description:
      "Earn rewards, collect bonuses, and withdraw winnings straight from your wallet.",
  },
];

const tournaments = [
  {
    title: "Arena Rush: Solo Clash",
    meta: "Entry: $5 • Prize Pool: $1,500",
    status: "Live tonight",
  },
  {
    title: "Squad Elite Invitational",
    meta: "Entry: $20 • Prize Pool: $10,000",
    status: "Weekend only",
  },
  {
    title: "Mobile Masters Cup",
    meta: "Entry: Free • Prize Pool: $2,000",
    status: "Open qualifiers",
  },
];

const faqs = [
  {
    question: "Is Skill Era available worldwide?",
    answer:
      "Skill Era supports multiple regions. Tournament eligibility depends on local regulations and publisher rules.",
  },
  {
    question: "How fast are payouts?",
    answer:
      "Most withdrawals are processed within 24 hours once the tournament results are verified.",
  },
  {
    question: "Can I play on mobile?",
    answer:
      "Yes. Skill Era is optimized for mobile-first tournaments and real-time score tracking.",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-[#0b0b10] text-white">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(88,80,236,0.3),_transparent_55%)]" />
        <div className="absolute -top-24 right-[-10%] h-80 w-80 rounded-full bg-[radial-gradient(circle,_rgba(88,80,236,0.55),_transparent_65%)] blur-3xl" />
        <div className="absolute bottom-[-30%] left-[-15%] h-96 w-96 rounded-full bg-[radial-gradient(circle,_rgba(14,165,233,0.45),_transparent_70%)] blur-3xl" />

        <header className="relative z-10">
          <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-lg font-semibold">
                SE
              </span>
              <div>
                <p className="text-lg font-semibold tracking-wide">Skill Era</p>
                <p className="text-xs text-white/60">Competitive gaming platform</p>
              </div>
            </div>
            <div className="hidden items-center gap-6 text-sm text-white/70 md:flex">
              <Link href="/tournaments" className="hover:text-white transition-colors">
                Tournaments
              </Link>
              <Link href="/wallet" className="hover:text-white transition-colors">
                Wallet
              </Link>
              <Link href="/dashboard" className="hover:text-white transition-colors">
                Dashboard
              </Link>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Link
                href="/login"
                className="rounded-full border border-white/20 px-4 py-2 text-white/80 transition hover:border-white/60 hover:text-white"
              >
                Log in
              </Link>
              <Link
                href="/register"
                className="rounded-full bg-white px-4 py-2 font-semibold text-[#0b0b10] transition hover:bg-white/90"
              >
                Get started
              </Link>
            </div>
          </nav>
        </header>

        <section className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 pb-24 pt-12 lg:flex-row lg:items-center">
          <div className="flex-1 space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.2em] text-white/70">
              Competitive. Verified. Rewarding.
            </div>
            <h1 className="text-balance text-4xl font-semibold leading-tight sm:text-5xl lg:text-6xl">
              The arena where skills earn real rewards.
              <span className="block bg-gradient-to-r from-cyan-300 via-indigo-300 to-fuchsia-300 bg-clip-text text-transparent">
                Join the next generation of esports tournaments.
              </span>
            </h1>
            <p className="max-w-xl text-base text-white/70 sm:text-lg">
              Skill Era connects competitive players with verified tournaments, fast payouts, and
              a community built for serious match-ups. Find your bracket, enter in seconds, and
              track every win.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                href="/register"
                className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#0b0b10] transition hover:translate-y-[-1px] hover:bg-white/90"
              >
                Start competing
              </Link>
              <Link
                href="/tournaments"
                className="rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white/80 transition hover:border-white/60 hover:text-white"
              >
                Browse tournaments
              </Link>
            </div>
            <div className="flex flex-wrap gap-6 text-sm text-white/60">
              <div>
                <p className="text-2xl font-semibold text-white">120+</p>
                <p>Monthly tournaments</p>
              </div>
              <div>
                <p className="text-2xl font-semibold text-white">$250k+</p>
                <p>Rewards paid out</p>
              </div>
              <div>
                <p className="text-2xl font-semibold text-white">24/7</p>
                <p>Live matchmaking</p>
              </div>
            </div>
          </div>

          <div className="flex-1">
            <div className="grid gap-4 sm:grid-cols-2">
              {highlights.map((highlight) => (
                <div
                  key={highlight.title}
                  className="group rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur transition hover:-translate-y-1 hover:border-white/30"
                >
                  <div className="mb-4 h-10 w-10 rounded-2xl bg-gradient-to-br from-indigo-400/60 to-cyan-400/40" />
                  <h3 className="text-lg font-semibold">{highlight.title}</h3>
                  <p className="mt-2 text-sm text-white/70">{highlight.description}</p>
                </div>
              ))}
              <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 to-white/5 p-6">
                <p className="text-sm uppercase tracking-[0.25em] text-white/60">
                  Live now
                </p>
                <h3 className="mt-4 text-2xl font-semibold">Night League Finals</h3>
                <p className="mt-2 text-sm text-white/70">
                  128 players battling for the $5,000 spotlight prize. Join the stream or jump into
                  the next qualifier.
                </p>
                <div className="mt-6 flex items-center justify-between text-sm text-white/70">
                  <span>Starts in 2h 14m</span>
                  <span className="rounded-full bg-white/10 px-3 py-1">Watch now</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className="mx-auto w-full max-w-6xl px-6 py-20">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-center">
          <div className="flex-1">
            <p className="text-sm uppercase tracking-[0.3em] text-cyan-300/80">
              Built for competitors
            </p>
            <h2 className="mt-4 text-3xl font-semibold sm:text-4xl">
              Everything needed to compete, win, and grow.
            </h2>
            <p className="mt-4 max-w-xl text-base text-white/70">
              Skill Era keeps every tournament secure, transparent, and fast. From match results
              to payments, the entire experience is designed for focused players and organizers.
            </p>
          </div>
          <div className="grid flex-1 gap-6 sm:grid-cols-2">
            {steps.map((step, index) => (
              <div key={step.title} className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <p className="text-xs text-white/50">Step 0{index + 1}</p>
                <h3 className="mt-3 text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm text-white/70">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 py-20">
        <div className="flex flex-col gap-10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-fuchsia-300/80">
                Featured brackets
              </p>
              <h2 className="mt-3 text-3xl font-semibold sm:text-4xl">
                Tournaments curated by top organizers.
              </h2>
            </div>
            <Link
              href="/tournaments"
              className="text-sm font-semibold text-white/70 transition hover:text-white"
            >
              View all tournaments
            </Link>
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            {tournaments.map((tournament) => (
              <div
                key={tournament.title}
                className="rounded-3xl border border-white/10 bg-white/5 p-6 transition hover:-translate-y-1 hover:border-white/30"
              >
                <p className="text-xs uppercase tracking-[0.2em] text-white/60">
                  {tournament.status}
                </p>
                <h3 className="mt-4 text-xl font-semibold">{tournament.title}</h3>
                <p className="mt-2 text-sm text-white/70">{tournament.meta}</p>
                <div className="mt-6 flex items-center justify-between">
                  <span className="rounded-full border border-white/20 px-3 py-1 text-xs text-white/70">
                    5v5 · Console + Mobile
                  </span>
                  <span className="text-xs text-white/60">+120 registered</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 py-20">
        <div className="grid gap-8 rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 to-white/5 p-10 lg:grid-cols-[1.2fr_1fr] lg:items-center">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-emerald-300/80">
              Skill Wallet
            </p>
            <h2 className="mt-3 text-3xl font-semibold sm:text-4xl">
              Manage entries, rewards, and withdrawals in one place.
            </h2>
            <p className="mt-4 text-base text-white/70">
              Keep your competitive finances organized with transaction history, bonus rewards,
              and instant notifications. Move winnings to your bank or reinvest directly into
              upcoming tournaments.
            </p>
            <div className="mt-6 flex flex-wrap gap-3 text-sm text-white/70">
              <span className="rounded-full border border-white/20 px-3 py-1">Instant balance</span>
              <span className="rounded-full border border-white/20 px-3 py-1">Secure payouts</span>
              <span className="rounded-full border border-white/20 px-3 py-1">Bonus boosts</span>
            </div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-[#0f0f18] p-6">
            <div className="flex items-center justify-between text-sm text-white/60">
              <span>Wallet overview</span>
              <span className="rounded-full bg-white/10 px-3 py-1">Verified</span>
            </div>
            <div className="mt-6 grid gap-4">
              <div className="flex items-center justify-between rounded-2xl bg-white/5 px-4 py-3">
                <div>
                  <p className="text-sm text-white/70">Available balance</p>
                  <p className="text-2xl font-semibold">$1,284.40</p>
                </div>
                <span className="text-xs text-emerald-300">+18% this month</span>
              </div>
              <div className="rounded-2xl border border-white/10 px-4 py-3">
                <p className="text-sm text-white/70">Recent payout</p>
                <p className="text-lg font-semibold">$420.00 • Sent today</p>
                <p className="text-xs text-white/50">Night League Finals</p>
              </div>
              <div className="rounded-2xl border border-white/10 px-4 py-3">
                <p className="text-sm text-white/70">Upcoming fees</p>
                <p className="text-lg font-semibold">$35.00 • 2 tournaments</p>
                <p className="text-xs text-white/50">Auto-reserved brackets</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 py-20">
        <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr]">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-8">
            <p className="text-sm uppercase tracking-[0.3em] text-cyan-300/80">
              Community powered
            </p>
            <h2 className="mt-3 text-3xl font-semibold sm:text-4xl">
              Organized by players, amplified by Skill Era.
            </h2>
            <p className="mt-4 text-base text-white/70">
              Teams, streamers, and esports orgs run their own events with built-in bracket tools,
              rule enforcement, and live reporting dashboards.
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl bg-white/5 p-4">
                <p className="text-sm text-white/60">Organizer tools</p>
                <p className="mt-2 text-lg font-semibold">Automated brackets</p>
              </div>
              <div className="rounded-2xl bg-white/5 p-4">
                <p className="text-sm text-white/60">Live updates</p>
                <p className="mt-2 text-lg font-semibold">Score verification</p>
              </div>
              <div className="rounded-2xl bg-white/5 p-4">
                <p className="text-sm text-white/60">Audience reach</p>
                <p className="mt-2 text-lg font-semibold">Stream integration</p>
              </div>
              <div className="rounded-2xl bg-white/5 p-4">
                <p className="text-sm text-white/60">Rewards engine</p>
                <p className="mt-2 text-lg font-semibold">Sponsor boosts</p>
              </div>
            </div>
          </div>
          <div className="space-y-6">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <p className="text-sm text-white/60">Player highlight</p>
              <h3 className="mt-2 text-xl font-semibold">"Skill Era pays out faster than any platform I have used."</h3>
              <p className="mt-4 text-sm text-white/60">Alex R. · Apex competitor</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <p className="text-sm text-white/60">Organizer highlight</p>
              <h3 className="mt-2 text-xl font-semibold">"We launched three brackets in a week and filled them all."</h3>
              <p className="mt-4 text-sm text-white/60">Nova Ops · Community league</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <p className="text-sm text-white/60">Coach spotlight</p>
              <h3 className="mt-2 text-xl font-semibold">"Skill Era keeps our team focused with clear rules and instant updates."</h3>
              <p className="mt-4 text-sm text-white/60">Mina Q. · Tactical coach</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 py-20">
        <div className="grid gap-6 lg:grid-cols-3">
          {faqs.map((faq) => (
            <div key={faq.question} className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <h3 className="text-lg font-semibold">{faq.question}</h3>
              <p className="mt-3 text-sm text-white/70">{faq.answer}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 pb-24">
        <div className="rounded-3xl border border-white/10 bg-gradient-to-r from-white/10 via-white/5 to-transparent p-10 text-center">
          <h2 className="text-3xl font-semibold sm:text-4xl">
            Ready to prove your skill?
          </h2>
          <p className="mt-4 text-base text-white/70">
            Create a free account, join your first tournament, and start earning in under five
            minutes.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link
              href="/register"
              className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#0b0b10] transition hover:bg-white/90"
            >
              Create account
            </Link>
            <Link
              href="/login"
              className="rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white/80 transition hover:border-white/60 hover:text-white"
            >
              Log in
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 bg-[#09090f]">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10 text-sm text-white/60 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-base font-semibold text-white">Skill Era</p>
            <p className="mt-2 max-w-sm text-white/50">
              Competitive tournaments, verified payouts, and the community that keeps pushing you
              higher.
            </p>
          </div>
          <div className="flex flex-wrap gap-6">
            <Link href="/tournaments" className="hover:text-white transition-colors">
              Tournaments
            </Link>
            <Link href="/dashboard" className="hover:text-white transition-colors">
              Dashboard
            </Link>
            <Link href="/wallet" className="hover:text-white transition-colors">
              Wallet
            </Link>
            <Link href="/login" className="hover:text-white transition-colors">
              Log in
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
