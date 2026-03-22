import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const TIERS = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    description: 'For casual teams just getting started',
    color: 'gray',
    features: [
      'Live scoring — all 6 sports',
      'Real-time public scoreboard',
      'Play-by-play feed',
      'Offline sync + undo',
      'Voice input',
      'WebRTC live streaming',
      'Wall of Fame highlights',
      'Tournaments & leagues',
    ],
    cta: 'Get started free',
    ctaTo: '/login',
    available: true,
  },
  {
    name: 'Pro',
    price: '$5',
    period: 'per month',
    description: 'For serious rec leagues and coaches',
    color: 'blue',
    popular: true,
    features: [
      'Everything in Free',
      'CSV box score export',
      'Game highlights reel',
      'No ads on public scoreboard',
      'Priority support',
      'Season stats dashboard',
      'Custom team colors',
    ],
    cta: 'Coming Soon',
    available: false,
  },
  {
    name: 'League',
    price: '$20',
    period: 'per month',
    description: 'For full broadcast leagues',
    color: 'purple',
    features: [
      'Everything in Pro',
      'Multi-camera streaming',
      'Analytics dashboard',
      'Custom overlays & branding',
      'White-label public page',
      'Sponsor banner management',
      'Entry fee collection',
      'Dedicated support',
    ],
    cta: 'Coming Soon',
    available: false,
  },
]

const colorStyles = {
  gray:   { ring: 'ring-gray-700',   badge: 'bg-gray-700 text-gray-300',   btn: 'bg-gray-700 text-white hover:bg-gray-600' },
  blue:   { ring: 'ring-blue-500/60', badge: 'bg-blue-600 text-white',      btn: 'bg-blue-600 text-white hover:bg-blue-500' },
  purple: { ring: 'ring-purple-500/60', badge: 'bg-purple-700 text-purple-100', btn: 'bg-purple-700 text-white hover:bg-purple-600' },
}

export default function PricingPage() {
  const { user } = useAuth()

  return (
    <div className="min-h-screen bg-[#0f1117] pb-24 text-white">
      {/* Nav */}
      <nav className="flex items-center justify-between border-b border-white/5 px-5 py-4">
        <Link to="/" className="text-lg font-extrabold tracking-tight">
          Sport<span className="text-blue-500">Stream</span>
        </Link>
        <div className="flex items-center gap-3">
          {user ? (
            <Link to="/dashboard" className="text-sm text-gray-400 hover:text-white">Dashboard</Link>
          ) : (
            <Link to="/login" className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500">
              Get started free
            </Link>
          )}
        </div>
      </nav>

      {/* Hero */}
      <div className="text-center px-5 py-12">
        <p className="text-sm font-semibold text-blue-400 uppercase tracking-widest mb-2">Pricing</p>
        <h1 className="text-3xl font-extrabold text-white leading-tight">
          Simple, transparent pricing
        </h1>
        <p className="mt-3 text-gray-400 max-w-md mx-auto">
          Start free — always. Upgrade when your league needs more.
        </p>
      </div>

      {/* Tiers */}
      <div className="mx-auto max-w-lg px-4 flex flex-col gap-5">
        {TIERS.map((tier) => {
          const s = colorStyles[tier.color]
          return (
            <div
              key={tier.name}
              className={`card ring-1 relative ${s.ring} ${tier.popular ? 'shadow-lg shadow-blue-900/20' : ''}`}
            >
              {tier.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="rounded-full bg-blue-600 px-4 py-1 text-xs font-bold text-white shadow">
                    Most Popular
                  </span>
                </div>
              )}

              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-extrabold text-white">{tier.name}</h2>
                    {!tier.available && (
                      <span className="rounded-full bg-gray-700/60 px-2 py-0.5 text-[10px] font-semibold text-gray-400">
                        Coming Soon
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{tier.description}</p>
                </div>
                <div className="shrink-0 text-right">
                  <span className="text-3xl font-extrabold text-white">{tier.price}</span>
                  <span className="ml-1 text-xs text-gray-500">{tier.period}</span>
                </div>
              </div>

              <ul className="space-y-2 mb-5">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-300">
                    <span className="mt-0.5 shrink-0 text-green-500">✓</span>
                    {f}
                  </li>
                ))}
              </ul>

              {tier.available ? (
                <Link to={tier.ctaTo} className={`block w-full rounded-xl py-3 text-center text-sm font-bold transition ${s.btn}`}>
                  {tier.cta} →
                </Link>
              ) : (
                <button
                  disabled
                  className="w-full rounded-xl py-3 text-sm font-bold text-gray-500 bg-gray-800/50 cursor-not-allowed"
                >
                  {tier.cta}
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* FAQ */}
      <div className="mx-auto max-w-lg px-4 mt-12">
        <h2 className="text-lg font-bold text-white mb-4">Frequently Asked Questions</h2>
        <div className="space-y-4">
          {[
            {
              q: 'Is SportStream really free?',
              a: 'Yes — the Free tier has no limits on teams, games, or players. Live scoring, streaming, and stats are all free.',
            },
            {
              q: 'When will Pro and League plans launch?',
              a: 'We are actively building them. Sign up for the free tier and you will be notified when paid plans become available.',
            },
            {
              q: 'How does payment work?',
              a: 'Paid plans will use Stripe for secure monthly billing. Cancel anytime with no penalties.',
            },
            {
              q: 'Can I upgrade mid-season?',
              a: 'Yes — you can upgrade at any time. Your stats and game history are always preserved.',
            },
          ].map(({ q, a }) => (
            <div key={q} className="rounded-2xl bg-[#1a1f2e] px-5 py-4 ring-1 ring-white/5">
              <p className="font-semibold text-white text-sm">{q}</p>
              <p className="mt-1.5 text-xs text-gray-400">{a}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA banner */}
      <div className="mx-auto max-w-lg px-4 mt-12">
        <div className="rounded-2xl bg-gradient-to-br from-blue-900/50 to-indigo-900/30 px-6 py-8 text-center ring-1 ring-blue-800/40">
          <p className="text-xl font-extrabold text-white">Ready to get started?</p>
          <p className="mt-2 text-sm text-gray-300">Create your free team in under 2 minutes.</p>
          <Link to="/login" className="mt-5 inline-block rounded-xl bg-blue-600 px-8 py-3 font-bold text-white hover:bg-blue-500 transition">
            Start free →
          </Link>
        </div>
      </div>
    </div>
  )
}
