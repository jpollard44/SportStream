import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { usePlan, PLANS } from '../hooks/usePlan'
import { logout } from '../firebase/auth'

// Cloud Function URL — Gen 2 Cloud Run URL from deploy output
const CREATE_SESSION_URL =
  'https://createchipinsession-ciynfadanq-uc.a.run.app'

const TIERS = [
  {
    plan: PLANS.FREE,
    name: 'Free',
    price: '$0',
    priceNote: 'forever',
    description: 'For casual leagues just getting started',
    features: [
      'Live scoring — all sports',
      'Real-time public scoreboard',
      'Play-by-play feed',
      'Offline sync + undo',
      'Voice input',
      'WebRTC streaming',
    ],
  },
  {
    plan: PLANS.TEAM,
    name: 'Team',
    price: '$5',
    priceNote: 'per month',
    description: 'For serious rec leagues',
    features: [
      'Everything in Free',
      'CSV box score export',
      'Game highlights',
      'No ads on public page',
      'Priority support',
    ],
    popular: true,
  },
  {
    plan: PLANS.PREMIUM,
    name: 'Premium',
    price: '$20',
    priceNote: 'per month',
    description: 'For leagues that want the full broadcast experience',
    features: [
      'Everything in Team',
      'Multi-camera support',
      'Analytics dashboard',
      'Custom overlays',
      'White-label public page',
    ],
  },
]

const planRank = { free: 0, team: 1, premium: 2 }

export default function SettingsPage() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const { plan: currentPlan, loading } = usePlan(user?.uid)
  const [upgrading, setUpgrading] = useState(null)
  const [error, setError] = useState(null)

  // Payment success redirect: /settings?upgraded=team
  const upgradedParam = searchParams.get('upgraded')
  useEffect(() => {
    if (upgradedParam) {
      setTimeout(() => setSearchParams({}, { replace: true }), 5000)
    }
  }, [upgradedParam, setSearchParams])

  async function handleUpgrade(plan) {
    setError(null)
    setUpgrading(plan)
    try {
      const res = await fetch(CREATE_SESSION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, uid: user.uid, email: user.email }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Server error ${res.status}`)
      }

      const { url } = await res.json()
      window.location.href = url
    } catch (err) {
      setError(err.message || 'Could not start checkout — try again.')
      setUpgrading(null)
    }
  }

  const currentRank = planRank[currentPlan] ?? 0

  return (
    <div className="min-h-screen bg-gray-950 pb-20">
      <header className="flex items-center justify-between px-5 py-5">
        <Link to="/dashboard" className="text-gray-400 hover:text-white">← Dashboard</Link>
        <h1 className="text-xl font-bold text-white">Account & Plan</h1>
        <button onClick={logout} className="text-sm text-gray-500 hover:text-white">Sign out</button>
      </header>

      <div className="mx-auto max-w-lg px-5">

        {/* Payment success banner */}
        {upgradedParam && (
          <div className="mb-6 rounded-2xl bg-green-900/50 px-5 py-4 ring-1 ring-green-700">
            <p className="font-semibold text-green-300">Payment received!</p>
            <p className="mt-0.5 text-sm text-green-400">
              Your plan is upgrading — it will activate within seconds.
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-4 rounded-2xl bg-red-900/40 px-5 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* Account info */}
        <div className="card mb-6">
          <p className="text-sm text-gray-400">Signed in as</p>
          <p className="font-semibold text-white">{user?.email}</p>
          {!loading && (
            <span className={`mt-2 inline-block rounded-full px-3 py-1 text-xs font-bold capitalize ${
              currentPlan === PLANS.PREMIUM ? 'bg-purple-700 text-purple-100' :
              currentPlan === PLANS.TEAM    ? 'bg-blue-700 text-blue-100' :
                                              'bg-gray-700 text-gray-300'
            }`}>
              {currentPlan} plan
            </span>
          )}
        </div>

        {/* Plan tiers */}
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">Plans</h2>
        <div className="flex flex-col gap-4">
          {TIERS.map((tier) => {
            const isCurrent = tier.plan === currentPlan
            const tierRank = planRank[tier.plan]
            const isUpgrade = tierRank > currentRank
            const isDowngrade = tierRank < currentRank
            const isLoadingThis = upgrading === tier.plan

            return (
              <div
                key={tier.plan}
                className={`card ${isCurrent ? 'ring-2 ring-blue-500' : tier.popular ? 'ring-1 ring-gray-600' : ''}`}
              >
                {/* Header */}
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white">{tier.name}</span>
                      {isCurrent && (
                        <span className="rounded-full bg-blue-600 px-2 py-0.5 text-xs font-bold text-white">Current</span>
                      )}
                      {tier.popular && !isCurrent && (
                        <span className="rounded-full bg-gray-700 px-2 py-0.5 text-xs font-semibold text-gray-300">Popular</span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-gray-400">{tier.description}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="text-2xl font-extrabold text-blue-400">{tier.price}</span>
                    <span className="ml-1 text-xs text-gray-500">{tier.priceNote}</span>
                  </div>
                </div>

                {/* Features */}
                <ul className="mb-4 space-y-1.5">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-gray-300">
                      <span className="text-green-500">✓</span> {f}
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                {isUpgrade && (
                  <button
                    onClick={() => handleUpgrade(tier.plan)}
                    disabled={!!upgrading}
                    className="btn-primary w-full text-sm disabled:opacity-50"
                  >
                    {isLoadingThis ? 'Starting checkout…' : `Upgrade to ${tier.name} →`}
                  </button>
                )}
                {isCurrent && tier.plan !== PLANS.FREE && (
                  <p className="text-center text-xs text-gray-500">
                    Active plan ·{' '}
                    <a
                      href={`mailto:support@sportstream.app?subject=Cancel ${tier.name} plan&body=Please cancel my ${tier.name} plan. My account email is ${user?.email}`}
                      className="text-gray-400 underline hover:text-white"
                    >
                      Request cancellation
                    </a>
                  </p>
                )}
                {isDowngrade && !isCurrent && (
                  <p className="text-center text-xs text-gray-500">
                    <a
                      href={`mailto:support@sportstream.app?subject=Downgrade plan`}
                      className="text-gray-400 underline hover:text-white"
                    >
                      Contact us to downgrade
                    </a>
                  </p>
                )}
              </div>
            )
          })}
        </div>

        <p className="mt-6 text-center text-xs text-gray-600">
          Payments handled by{' '}
          <a href="https://chipinpool.com" target="_blank" rel="noreferrer" className="text-gray-500 hover:text-white">
            ChipInPool
          </a>
          . Subscriptions renew monthly. Cancel anytime.
        </p>
      </div>
    </div>
  )
}
