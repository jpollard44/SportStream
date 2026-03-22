import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { subscribeLiveGames } from '../firebase/firestore'
import { AppBadge, LiveBadge } from '../components/ui'

const SPORTS = [
  { emoji: '🏀', name: 'Basketball' },
  { emoji: '⚾', name: 'Baseball' },
  { emoji: '🥎', name: 'Softball' },
  { emoji: '⚽', name: 'Soccer' },
  { emoji: '🏐', name: 'Volleyball' },
  { emoji: '🏈', name: 'Flag Football' },
]

const FEATURES = [
  {
    icon: '📲',
    title: 'One-tap scoring',
    desc: 'Tap a player, pick an action. No training required. Any phone, any sport.',
    accent: 'blue',
  },
  {
    icon: '📡',
    title: 'Real-time scoreboard',
    desc: 'Fans watch scores update live from anywhere — no app, no refresh needed.',
    accent: 'cyan',
  },
  {
    icon: '🎥',
    title: 'Live streaming',
    desc: 'Stream directly from the scorekeeper\'s phone. Score + video in one place.',
    accent: 'purple',
  },
  {
    icon: '🏆',
    title: 'Tournaments & Leagues',
    desc: 'Full brackets, standings, and scheduling. Auto-updates as games finish.',
    accent: 'yellow',
  },
  {
    icon: '📊',
    title: 'Player stats',
    desc: 'Box scores and season totals per player. Career stats build automatically.',
    accent: 'green',
  },
  {
    icon: '🔔',
    title: 'Fan alerts',
    desc: 'Push notifications when your team goes live or a player has a big moment.',
    accent: 'orange',
  },
]

const HOW_IT_WORKS = [
  { n: '01', title: 'Create your team', desc: 'Sign up free, add your roster and sport in under 2 minutes.' },
  { n: '02', title: 'Set up a game', desc: 'Name the opponent. Share the 6-digit code with fans.' },
  { n: '03', title: 'Tap to score', desc: 'One volunteer keeps score on their phone — live for everyone.' },
  { n: '04', title: 'Stats auto-generate', desc: 'Full play-by-play, box scores, season stats — all automatic.' },
]

const TIERS = [
  {
    name: 'Free',
    price: '$0',
    note: 'forever',
    highlight: false,
    features: ['Unlimited games', 'Live scoring — all sports', 'Real-time public scoreboard', 'Public team page', '6-digit join code'],
  },
  {
    name: 'Team',
    price: '$5',
    note: '/mo',
    highlight: true,
    features: ['Everything in Free', 'Live streaming', 'Season stats & CSV export', 'Tournament hosting', 'Player fan alerts'],
  },
  {
    name: 'Premium',
    price: '$20',
    note: '/mo',
    highlight: false,
    features: ['Everything in Team', 'Multi-camera streaming', 'Advanced analytics', 'White-label scoreboard', 'Priority support'],
  },
]

const accentBorder = {
  blue: 'border-blue-800/40 hover:border-blue-600/60',
  cyan: 'border-cyan-800/40 hover:border-cyan-600/60',
  purple: 'border-purple-800/40 hover:border-purple-600/60',
  yellow: 'border-yellow-800/40 hover:border-yellow-600/60',
  green: 'border-green-800/40 hover:border-green-600/60',
  orange: 'border-orange-800/40 hover:border-orange-600/60',
}

const accentIcon = {
  blue: 'bg-blue-900/50',
  cyan: 'bg-cyan-900/50',
  purple: 'bg-purple-900/50',
  yellow: 'bg-yellow-900/50',
  green: 'bg-green-900/50',
  orange: 'bg-orange-900/50',
}

export default function LandingPage() {
  const { user } = useAuth()
  const [liveGames, setLiveGames] = useState([])
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const unsub = subscribeLiveGames(setLiveGames)
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => { unsub(); window.removeEventListener('scroll', onScroll) }
  }, [])

  return (
    <div className="min-h-screen bg-[#0f1117] text-white">

      {/* ── Sticky Nav ── */}
      <nav className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-5 py-3 transition-all duration-300 ${
        scrolled ? 'glass-dark border-b border-white/5' : 'bg-transparent'
      }`}>
        <Link to="/" className="text-xl font-extrabold tracking-tight">
          Sport<span className="text-blue-500">Stream</span>
        </Link>
        <div className="flex items-center gap-1">
          <Link to="/tournaments" className="hidden px-3 py-2 text-sm text-gray-400 transition hover:text-white sm:block">
            Tournaments
          </Link>
          <Link to="/leagues" className="hidden px-3 py-2 text-sm text-gray-400 transition hover:text-white sm:block">
            Leagues
          </Link>
          <Link to="/find" className="hidden px-3 py-2 text-sm text-gray-400 transition hover:text-white sm:block">
            Find game
          </Link>
          <Link to="/pricing" className="hidden px-3 py-2 text-sm text-gray-400 transition hover:text-white sm:block">
            Pricing
          </Link>
          {user ? (
            <Link to="/dashboard" className="ml-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold transition hover:bg-blue-500 active:scale-95">
              Dashboard →
            </Link>
          ) : (
            <>
              <Link to="/login" className="px-3 py-2 text-sm text-gray-400 transition hover:text-white">
                Sign in
              </Link>
              <Link to="/login" className="ml-1 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold transition hover:bg-blue-500 active:scale-95">
                Get started free
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-5 pb-16 pt-24 text-center">
        {/* Background glows */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-0 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-blue-600/10 blur-[100px]" />
          <div className="absolute left-1/4 top-1/2 h-[400px] w-[400px] -translate-y-1/2 rounded-full bg-purple-600/5 blur-[80px]" />
          <div className="absolute right-1/4 top-1/3 h-[300px] w-[300px] rounded-full bg-cyan-600/5 blur-[80px]" />
        </div>

        <div className="relative mx-auto max-w-3xl">
          {/* Live games badge */}
          {liveGames.length > 0 && (
            <div className="animate-slideDown mb-6 inline-flex items-center gap-2 rounded-full bg-[#1a1f2e] px-4 py-1.5 text-xs font-semibold ring-1 ring-white/10">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />
              <span className="text-gray-300">{liveGames.length} game{liveGames.length !== 1 ? 's' : ''} live right now</span>
              <Link to="/find" className="text-blue-400 hover:text-blue-300">Watch →</Link>
            </div>
          )}
          {liveGames.length === 0 && (
            <div className="animate-slideDown mb-6 inline-flex items-center gap-2 rounded-full bg-[#1a1f2e] px-4 py-1.5 text-xs font-semibold text-blue-300 ring-1 ring-blue-800/40">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
              Built for rec leagues, school teams &amp; pickup games
            </div>
          )}

          {/* Headline */}
          <h1 className="animate-slideUp mb-5 text-5xl font-extrabold leading-[1.1] tracking-tight sm:text-6xl lg:text-7xl">
            Live scoring &amp; streaming
            <br />
            <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent">
              for every team
            </span>
          </h1>

          <p className="animate-slideUp mb-10 text-lg text-gray-400 sm:text-xl" style={{ animationDelay: '80ms' }}>
            One volunteer taps scores on their phone.
            Fans anywhere get a live scoreboard, play-by-play, and stream —
            <br className="hidden sm:block" />
            no app install required.
          </p>

          {/* CTAs */}
          <div className="animate-slideUp flex flex-col items-center gap-3 sm:flex-row sm:justify-center" style={{ animationDelay: '160ms' }}>
            <Link
              to="/login"
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-8 py-4 text-base font-bold text-white shadow-xl shadow-blue-600/25 transition hover:bg-blue-500 active:scale-95 sm:w-auto"
            >
              Start for free →
            </Link>
            <Link
              to="/find"
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#1a1f2e] px-8 py-4 text-base font-semibold text-white ring-1 ring-white/10 transition hover:bg-[#242938] active:scale-95 sm:w-auto"
            >
              🔍 Find a game
            </Link>
          </div>

          {/* Social proof */}
          <p className="animate-slideUp mt-8 text-sm text-gray-600" style={{ animationDelay: '240ms' }}>
            Free forever for basic use · No credit card required
          </p>
        </div>

        {/* Mock scoreboard floating card */}
        <div className="animate-float relative mx-auto mt-16 w-full max-w-xs">
          <div className="rounded-2xl bg-[#1a1f2e] p-5 ring-1 ring-white/10 shadow-2xl shadow-black/50">
            <div className="mb-3 flex items-center justify-between">
              <LiveBadge />
              <span className="text-xs text-gray-500">Q3 · 4:22</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="text-center">
                <p className="text-xs text-gray-500 mb-1">HOME</p>
                <p className="text-4xl font-extrabold tabular-nums text-white">48</p>
                <p className="mt-1 text-sm font-semibold text-gray-300">Eagles</p>
              </div>
              <div className="text-2xl font-bold text-gray-600">—</div>
              <div className="text-center">
                <p className="text-xs text-gray-500 mb-1">AWAY</p>
                <p className="text-4xl font-extrabold tabular-nums text-white">41</p>
                <p className="mt-1 text-sm font-semibold text-gray-300">Falcons</p>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 rounded-xl bg-[#0f1117] px-3 py-2">
              <span className="text-sm">🏀</span>
              <p className="text-xs text-gray-400">Johnson — 3-pointer · <span className="text-yellow-400 font-semibold">+3</span></p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Sports Strip ── */}
      <section className="border-y border-white/5 bg-[#0f1117] py-6">
        <div className="flex items-center justify-center gap-3 flex-wrap px-5">
          {SPORTS.map((s) => (
            <div key={s.name} className="flex items-center gap-2 rounded-full bg-[#1a1f2e] px-4 py-2 ring-1 ring-white/5">
              <span className="text-xl">{s.emoji}</span>
              <span className="text-sm font-medium text-gray-300">{s.name}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section className="px-5 py-24">
        <div className="mx-auto max-w-5xl">
          <div className="mb-4 text-center">
            <span className="text-xs font-bold uppercase tracking-widest text-blue-400">Features</span>
          </div>
          <h2 className="mb-4 text-center text-3xl font-extrabold sm:text-4xl">
            Everything a league needs
          </h2>
          <p className="mb-14 text-center text-gray-500">
            Built for the volunteers who run it all — coaches, managers, parents, and fans.
          </p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className={`rounded-2xl border bg-[#1a1f2e] p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/30 ${accentBorder[f.accent]}`}
              >
                <div className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl text-2xl ${accentIcon[f.accent]}`}>
                  {f.icon}
                </div>
                <h3 className="mb-2 font-bold text-white">{f.title}</h3>
                <p className="text-sm leading-relaxed text-gray-500">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="bg-[#0a0d13] px-5 py-24">
        <div className="mx-auto max-w-4xl">
          <div className="mb-4 text-center">
            <span className="text-xs font-bold uppercase tracking-widest text-blue-400">How it works</span>
          </div>
          <h2 className="mb-14 text-center text-3xl font-extrabold sm:text-4xl">
            Up and running in minutes
          </h2>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {HOW_IT_WORKS.map((step, i) => (
              <div key={i} className="relative">
                <div className="mb-4 text-5xl font-extrabold text-blue-500/20">{step.n}</div>
                <h3 className="mb-2 font-bold text-white">{step.title}</h3>
                <p className="text-sm leading-relaxed text-gray-500">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Live Games Promo ── */}
      {liveGames.length > 0 && (
        <section className="px-5 py-16">
          <div className="mx-auto max-w-2xl">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="section-label mb-1">Live right now</p>
                <h2 className="text-xl font-bold text-white">{liveGames.length} game{liveGames.length !== 1 ? 's' : ''} in progress</h2>
              </div>
              <Link to="/find" className="text-sm text-blue-400 hover:text-blue-300 transition">
                Find by code →
              </Link>
            </div>
            <div className="space-y-3">
              {liveGames.slice(0, 3).map((game) => (
                <Link
                  key={game.id}
                  to={`/game/${game.id}`}
                  className="flex items-center justify-between rounded-2xl bg-[#1a1f2e] px-5 py-4 ring-1 ring-white/5 transition hover:ring-white/10"
                >
                  <div className="flex items-center gap-3">
                    <LiveBadge />
                    <div>
                      <p className="font-semibold text-white text-sm">
                        {game.homeTeam} <span className="text-gray-500 font-normal">vs</span> {game.awayTeam}
                      </p>
                      <p className="text-xs text-gray-500 capitalize">{game.sport}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-mono font-bold text-white tabular-nums">{game.homeScore}–{game.awayScore}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Pricing ── */}
      <section className="px-5 py-24">
        <div className="mx-auto max-w-4xl">
          <div className="mb-4 text-center">
            <span className="text-xs font-bold uppercase tracking-widest text-blue-400">Pricing</span>
          </div>
          <h2 className="mb-4 text-center text-3xl font-extrabold sm:text-4xl">
            Simple, honest pricing
          </h2>
          <p className="mb-14 text-center text-gray-500">
            Start free — upgrade when you need more.
          </p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {TIERS.map((tier) => (
              <div
                key={tier.name}
                className={`relative rounded-2xl p-6 ${
                  tier.highlight
                    ? 'bg-gradient-to-b from-blue-600/20 to-[#1a1f2e] ring-2 ring-blue-500/60'
                    : 'bg-[#1a1f2e] ring-1 ring-white/5'
                }`}
              >
                {tier.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="rounded-full bg-blue-600 px-3 py-1 text-xs font-bold text-white">Most Popular</span>
                  </div>
                )}
                <p className="mb-1 font-bold text-white">{tier.name}</p>
                <div className="mb-1 flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold text-white">{tier.price}</span>
                  <span className="text-sm text-gray-500">{tier.note}</span>
                </div>
                <div className="my-5 h-px bg-white/5" />
                <ul className="space-y-3">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-gray-400">
                      <span className="mt-0.5 text-green-400">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  to="/login"
                  className={`mt-6 flex w-full items-center justify-center rounded-xl py-2.5 text-sm font-semibold transition active:scale-95 ${
                    tier.highlight
                      ? 'bg-blue-600 text-white hover:bg-blue-500'
                      : 'bg-white/5 text-white hover:bg-white/10'
                  }`}
                >
                  Get started →
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="px-5 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="mb-4 text-3xl font-extrabold sm:text-4xl">
            Ready to go live?
          </h2>
          <p className="mb-8 text-gray-500">
            Set up your team in 2 minutes. First game is free — always.
          </p>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-10 py-4 text-base font-bold text-white shadow-xl shadow-blue-600/25 transition hover:bg-blue-500 active:scale-95"
          >
            Create your team →
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/5 px-5 py-10">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 sm:flex-row">
          <span className="text-sm font-bold text-gray-600">
            Sport<span className="text-blue-500">Stream</span>
          </span>
          <div className="flex gap-5 text-xs text-gray-600">
            <Link to="/tournaments" className="hover:text-gray-400 transition">Tournaments</Link>
            <Link to="/leagues" className="hover:text-gray-400 transition">Leagues</Link>
            <Link to="/find" className="hover:text-gray-400 transition">Find a game</Link>
            <Link to="/pricing" className="hover:text-gray-400 transition">Pricing</Link>
            <Link to="/login" className="hover:text-gray-400 transition">Sign in</Link>
          </div>
          <p className="text-xs text-gray-700">© 2026 SportStream</p>
        </div>
      </footer>
    </div>
  )
}
