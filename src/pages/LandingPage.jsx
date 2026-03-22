import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { subscribeLiveGames } from '../firebase/firestore'

const SPORTS = [
  { emoji: '🏀', name: 'Basketball' },
  { emoji: '⚾', name: 'Baseball' },
  { emoji: '🥎', name: 'Softball' },
  { emoji: '⚽', name: 'Soccer' },
  { emoji: '🏐', name: 'Volleyball' },
  { emoji: '🏈', name: 'Flag Football' },
]

const HOW_IT_WORKS = [
  { step: '1', title: 'Create your team', desc: 'Sign up free, create a club, add your roster. Takes 2 minutes.' },
  { step: '2', title: 'Set up a game', desc: 'Name the opponent, pick the sport. Share the 6-digit code with fans.' },
  { step: '3', title: 'Tap to score', desc: 'One volunteer taps plays on their phone. Scores update live for everyone.' },
  { step: '4', title: 'Stats auto-generate', desc: 'Full play-by-play, box scores, and season stats — done automatically.' },
]

const FEATURES = [
  { emoji: '📲', title: 'Idiot-proof scoring', desc: 'Tap a player, pick an action. No training required. Works on any phone.' },
  { emoji: '📡', title: 'Real-time scoreboard', desc: 'Fans see scores update instantly from anywhere. No app, no refresh.' },
  { emoji: '🎥', title: 'Live streaming', desc: 'Stream directly from the scorekeeper device. Fans watch alongside the live score.' },
  { emoji: '🏆', title: 'Tournaments & Leagues', desc: 'Run full single-elimination or round-robin tournaments. Standings update automatically.' },
  { emoji: '📊', title: 'Player stats', desc: 'Per-game box scores and season totals for every player on your roster.' },
  { emoji: '💳', title: 'Entry fee collection', desc: 'Players chip in their share via ChipInPool — everyone gets a payment link automatically.' },
  { emoji: '📴', title: 'Works offline', desc: 'Lost signal? Plays queue locally and sync the moment you reconnect.' },
  { emoji: '👥', title: 'Follow your team', desc: 'Fans follow teams to see live games on their dashboard. Never miss a game.' },
]

const TIERS = [
  {
    name: 'Free', price: '$0', highlight: false,
    features: ['Unlimited games', 'Live scoring', 'Play-by-play', 'Public team page', 'Join code for fans'],
  },
  {
    name: 'Team', price: '$5/mo', highlight: true,
    features: ['Everything in Free', 'Live streaming', 'Season stats', 'CSV export', 'Tournament hosting'],
  },
  {
    name: 'Premium', price: '$20/mo', highlight: false,
    features: ['Everything in Team', 'Multi-camera streaming', 'Advanced analytics', 'Priority support', 'Ad-free'],
  },
]

export default function LandingPage() {
  const { user } = useAuth()
  const [liveGames, setLiveGames] = useState([])

  useEffect(() => {
    return subscribeLiveGames(setLiveGames)
  }, [])

  return (
    <div className="min-h-screen bg-gray-950 text-white">

      {/* Nav */}
      <nav className="flex items-center justify-between px-5 py-4">
        <span className="text-xl font-extrabold tracking-tight">
          Sport<span className="text-blue-500">Stream</span>
        </span>
        <div className="flex items-center gap-2">
          <Link to="/tournaments" className="hidden px-3 py-2 text-sm text-gray-400 hover:text-white sm:block">
            Tournaments
          </Link>
          <Link to="/leagues" className="hidden px-3 py-2 text-sm text-gray-400 hover:text-white sm:block">
            Leagues
          </Link>
          <Link to="/find" className="hidden px-3 py-2 text-sm text-gray-400 hover:text-white sm:block">
            Find by code
          </Link>
          {user ? (
            <Link to="/dashboard" className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold hover:bg-blue-500">
              Dashboard →
            </Link>
          ) : (
            <>
              <Link to="/join" className="px-3 py-2 text-sm text-gray-400 hover:text-white">
                Join game
              </Link>
              <Link to="/login" className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold hover:bg-blue-500">
                Get started free
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* Hero */}
      <section className="px-5 pb-16 pt-14 text-center">
        <div className="mx-auto max-w-2xl">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-blue-900/40 px-4 py-1.5 text-xs font-semibold text-blue-300 ring-1 ring-blue-800/50">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
            Built for rec leagues, school teams &amp; pickup games
          </div>
          <h1 className="mb-5 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            Live scoring &amp; streaming<br />
            <span className="text-blue-500">for teams without a TV crew</span>
          </h1>
          <p className="mb-8 text-lg leading-relaxed text-gray-400">
            One volunteer taps scores on their phone. Fans anywhere get a real-time
            scoreboard, play-by-play, and live stream — no app install required.
          </p>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link to="/login"
              className="w-full rounded-2xl bg-blue-600 px-8 py-4 text-base font-bold hover:bg-blue-500 active:scale-95 transition sm:w-auto">
              Start for free →
            </Link>
            <Link to="/join"
              className="w-full rounded-2xl bg-gray-800 px-8 py-4 text-base font-medium hover:bg-gray-700 transition sm:w-auto">
              Join a game
            </Link>
          </div>
        </div>
      </section>

      {/* Sports strip */}
      <section className="border-y border-gray-800 bg-gray-900/50 px-5 py-6">
        <div className="mx-auto max-w-2xl">
          <p className="mb-4 text-center text-[10px] font-bold uppercase tracking-widest text-gray-600">
            Supported sports
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {SPORTS.map((s) => (
              <div key={s.name}
                className="flex items-center gap-2 rounded-xl bg-gray-800 px-4 py-2 text-sm font-medium text-gray-300">
                <span>{s.emoji}</span>
                <span>{s.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Mock scoreboard */}
      <section className="px-5 py-16">
        <div className="mx-auto max-w-sm rounded-3xl bg-gray-900 p-6 shadow-2xl ring-1 ring-gray-700">
          <div className="mb-2 flex items-center justify-center gap-2 text-xs font-bold text-red-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" /> LIVE
          </div>
          <div className="flex items-center justify-between">
            <div className="text-center">
              <p className="text-xs text-gray-400">DOWNTOWN REC</p>
              <p className="font-mono text-6xl font-extrabold">67</p>
            </div>
            <div className="text-center">
              <p className="font-mono text-lg text-gray-400">3:42</p>
              <p className="text-xs text-gray-500">Q4</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-400">RIVAL REC</p>
              <p className="font-mono text-6xl font-extrabold">61</p>
            </div>
          </div>
          <div className="mt-4 space-y-2 border-t border-gray-800 pt-4 text-sm">
            {[
              { who: '#23 Jake', action: '3 PT', pts: '+3', team: 'home' },
              { who: '#11 Torres', action: 'Rebound', pts: null, team: 'away' },
              { who: '#7 Marcus', action: '2 PT', pts: '+2', team: 'home' },
            ].map((play, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className={`h-1.5 w-1.5 rounded-full ${play.team === 'home' ? 'bg-blue-500' : 'bg-orange-400'}`} />
                <span className="flex-1 text-gray-300">{play.who} — {play.action}</span>
                {play.pts && <span className="text-xs font-bold text-green-400">{play.pts}</span>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Live Right Now */}
      {liveGames.length > 0 && (
        <section className="px-5 pb-16">
          <div className="mx-auto max-w-lg">
            <div className="mb-4 flex items-center gap-2">
              <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
              <p className="text-xs font-bold uppercase tracking-widest text-red-400">Live Right Now</p>
            </div>
            <div className="flex flex-col gap-2">
              {liveGames.map((game) => (
                <Link key={game.id} to={`/game/${game.id}`}
                  className="flex items-center justify-between rounded-2xl bg-gray-900 px-4 py-3.5 ring-1 ring-red-900/30 transition hover:bg-gray-800 hover:ring-red-700/40">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-white">
                      {game.homeTeam} <span className="font-normal text-gray-500">vs</span> {game.awayTeam}
                    </p>
                    <p className="text-xs capitalize text-gray-500">{game.sport}</p>
                  </div>
                  <div className="ml-4 flex shrink-0 items-center gap-3">
                    <p className="font-mono text-lg font-extrabold text-white">
                      {game.homeScore}–{game.awayScore}
                    </p>
                    <span className="rounded-xl bg-red-700 px-3 py-1 text-xs font-bold text-white">Watch</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* How it works */}
      <section id="how-it-works" className="px-5 pb-20">
        <div className="mx-auto max-w-2xl">
          <h2 className="mb-10 text-center text-2xl font-bold">Up and running in minutes</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {HOW_IT_WORKS.map(({ step, title, desc }) => (
              <div key={step} className="flex gap-4 rounded-2xl bg-gray-900 p-5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-extrabold text-white">
                  {step}
                </div>
                <div>
                  <h3 className="mb-1 font-semibold text-white">{title}</h3>
                  <p className="text-sm leading-relaxed text-gray-400">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-5 pb-20">
        <div className="mx-auto max-w-2xl">
          <h2 className="mb-10 text-center text-2xl font-bold">Everything you need, nothing you don't</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <div key={f.title} className="card">
                <div className="mb-3 text-3xl">{f.emoji}</div>
                <h3 className="mb-1 font-semibold text-white">{f.title}</h3>
                <p className="text-sm leading-relaxed text-gray-400">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tournaments & Leagues callout */}
      <section className="px-5 pb-20">
        <div className="mx-auto max-w-2xl">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-3xl bg-gradient-to-br from-blue-900/40 to-blue-950 p-6 ring-1 ring-blue-800/50">
              <div className="mb-3 text-3xl">🏆</div>
              <h3 className="mb-2 text-lg font-bold text-white">Run a Tournament</h3>
              <p className="mb-4 text-sm leading-relaxed text-gray-400">
                Single elimination or round robin. Teams register by code, bracket auto-generates,
                games link to live scoreboards.
              </p>
              <Link to="/tournaments"
                className="inline-block rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold hover:bg-blue-500 transition">
                Browse Tournaments
              </Link>
            </div>
            <div className="rounded-3xl bg-gradient-to-br from-purple-900/40 to-purple-950 p-6 ring-1 ring-purple-800/50">
              <div className="mb-3 text-3xl">📅</div>
              <h3 className="mb-2 text-lg font-bold text-white">Run a League</h3>
              <p className="mb-4 text-sm leading-relaxed text-gray-400">
                Full season scheduling and standings. Teams join by code. Live scores update
                the standings table instantly.
              </p>
              <Link to="/leagues"
                className="inline-block rounded-xl bg-purple-600 px-5 py-2.5 text-sm font-semibold hover:bg-purple-500 transition">
                Browse Leagues
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="px-5 pb-20">
        <div className="mx-auto max-w-2xl">
          <h2 className="mb-3 text-center text-2xl font-bold">Simple pricing</h2>
          <p className="mb-10 text-center text-sm text-gray-500">Start free. Upgrade when your team is ready.</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {TIERS.map((tier) => (
              <div key={tier.name} className={`card ${tier.highlight ? 'ring-2 ring-blue-500' : ''}`}>
                {tier.highlight && (
                  <span className="mb-3 inline-block rounded-full bg-blue-600 px-2.5 py-0.5 text-xs font-bold">
                    Most Popular
                  </span>
                )}
                <p className="text-lg font-bold text-white">{tier.name}</p>
                <p className="mb-4 text-2xl font-extrabold text-blue-400">{tier.price}</p>
                <ul className="space-y-2">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-gray-300">
                      <span className="mt-0.5 shrink-0 text-green-500">✓</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link to="/login" className={`mt-5 block rounded-xl py-2.5 text-center text-sm font-semibold transition ${
                  tier.highlight
                    ? 'bg-blue-600 text-white hover:bg-blue-500'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}>
                  {tier.name === 'Free' ? 'Get started' : 'Choose plan'}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-5 pb-20 text-center">
        <div className="mx-auto max-w-lg rounded-3xl bg-blue-900/30 p-10 ring-1 ring-blue-800">
          <h2 className="mb-3 text-2xl font-bold">Ready for game day?</h2>
          <p className="mb-6 text-gray-400">Set up your team and first game in under 2 minutes. Free forever.</p>
          <Link to="/login"
            className="inline-block rounded-2xl bg-blue-600 px-10 py-4 font-bold hover:bg-blue-500 active:scale-95 transition">
            Start free →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 px-5 py-8">
        <div className="mx-auto max-w-2xl">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <span className="text-lg font-extrabold tracking-tight">
              Sport<span className="text-blue-500">Stream</span>
            </span>
            <div className="flex flex-wrap gap-5 text-sm text-gray-500">
              <Link to="/tournaments" className="hover:text-white">Tournaments</Link>
              <Link to="/leagues" className="hover:text-white">Leagues</Link>
              <Link to="/join" className="hover:text-white">Join a game</Link>
              <Link to="/login" className="hover:text-white">Sign in</Link>
            </div>
          </div>
          <p className="text-center text-xs text-gray-700">
            © {new Date().getFullYear()} SportStream · Built for rec leagues everywhere
          </p>
        </div>
      </footer>
    </div>
  )
}
