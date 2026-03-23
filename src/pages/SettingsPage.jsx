import { useState, useEffect } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { usePlan, PLANS } from '../hooks/usePlan'
import { logout } from '../firebase/auth'
import { updateNotificationPrefs, updateUserProfile, subscribeToUser } from '../firebase/firestore'
import { deleteUser, EmailAuthProvider, reauthenticateWithCredential, GoogleAuthProvider, signInWithPopup } from 'firebase/auth'
import { auth } from '../firebase/config'

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

const NOTIF_PREFS = [
  { key: 'liveAlerts',   label: 'Game goes live',        desc: 'Push when a team you follow starts streaming' },
  { key: 'finalScores',  label: 'Final scores',          desc: 'Push when a followed game ends' },
  { key: 'notablePlays', label: 'Notable plays',         desc: 'Push for home runs, touchdowns, and big moments' },
]

function VoiceAnnouncePref() {
  const [enabled, setEnabled] = useState(() => {
    try { return localStorage.getItem('ss_voice_announce') === 'true' } catch { return false }
  })
  function toggle() {
    const next = !enabled
    setEnabled(next)
    try { localStorage.setItem('ss_voice_announce', String(next)) } catch {}
  }
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-semibold text-white">Voice play announcements</p>
        <p className="text-xs text-gray-500">Speak play descriptions aloud during games (scorekeeper only)</p>
      </div>
      <button
        onClick={toggle}
        className={`relative flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 focus:outline-none ${
          enabled ? 'bg-blue-600' : 'bg-gray-700'
        }`}
      >
        <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${
          enabled ? 'translate-x-5' : 'translate-x-0'
        }`} />
      </button>
    </div>
  )
}

export default function SettingsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { plan: currentPlan, loading } = usePlan(user?.uid)
  const [upgrading, setUpgrading] = useState(null)
  const [error, setError] = useState(null)

  // Display name edit
  const [displayName, setDisplayName] = useState(user?.displayName || '')
  const [editingName, setEditingName] = useState(false)
  const [savingName, setSavingName] = useState(false)

  // Notification prefs
  const [notifPrefs, setNotifPrefs] = useState({ liveAlerts: true, finalScores: true, notablePlays: true })
  const [savingPrefs, setSavingPrefs] = useState(false)

  // Delete account
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')
  const [deletingAccount, setDeletingAccount] = useState(false)
  const [deleteError, setDeleteError] = useState(null)

  // Load user prefs
  useEffect(() => {
    if (!user) return
    return subscribeToUser(user.uid, (u) => {
      if (u?.notificationPrefs) setNotifPrefs((prev) => ({ ...prev, ...u.notificationPrefs }))
      if (u?.displayName) setDisplayName(u.displayName)
    })
  }, [user])

  async function handleSaveName() {
    if (!displayName.trim() || !user) return
    setSavingName(true)
    try {
      await updateUserProfile(user.uid, { displayName: displayName.trim() })
      setEditingName(false)
    } finally {
      setSavingName(false)
    }
  }

  async function handleTogglePref(key) {
    const next = { ...notifPrefs, [key]: !notifPrefs[key] }
    setNotifPrefs(next)
    setSavingPrefs(true)
    try { await updateNotificationPrefs(user.uid, next) }
    finally { setSavingPrefs(false) }
  }

  async function handleDeleteAccount() {
    setDeleteError(null)
    setDeletingAccount(true)
    try {
      // Determine re-auth method based on sign-in provider
      const isGoogle = auth.currentUser?.providerData?.some((p) => p.providerId === 'google.com')
      if (isGoogle) {
        const googleProvider = new GoogleAuthProvider()
        await signInWithPopup(auth, googleProvider)
      } else {
        const credential = EmailAuthProvider.credential(user.email, deletePassword)
        await reauthenticateWithCredential(auth.currentUser, credential)
      }
      await deleteUser(auth.currentUser)
      // Redirect to landing page with a deleted flag
      navigate('/?deleted=1', { replace: true })
    } catch (err) {
      setDeleteError(err.message || 'Could not delete account — check your password.')
      setDeletingAccount(false)
    }
  }

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

          {/* Display name */}
          <div className="mt-4 border-t border-gray-800 pt-4">
            <p className="mb-1 text-xs text-gray-500">Display name</p>
            {editingName ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="input flex-1 text-sm"
                  placeholder="Your name"
                  autoFocus
                />
                <button
                  onClick={handleSaveName}
                  disabled={savingName}
                  className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
                >
                  {savingName ? '…' : 'Save'}
                </button>
                <button onClick={() => setEditingName(false)} className="text-sm text-gray-500 hover:text-gray-300">
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-white">{displayName || <span className="text-gray-500">Not set</span>}</span>
                <button onClick={() => setEditingName(true)} className="text-xs text-blue-400 hover:text-blue-300">Edit</button>
              </div>
            )}
          </div>
        </div>

        {/* Notification preferences */}
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">Notifications {savingPrefs && <span className="ml-2 text-xs font-normal text-gray-600">Saving…</span>}</h2>
        <div className="card mb-6 space-y-4">
          {NOTIF_PREFS.map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">{label}</p>
                <p className="text-xs text-gray-500">{desc}</p>
              </div>
              <button
                onClick={() => handleTogglePref(key)}
                className={`relative flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 focus:outline-none ${
                  notifPrefs[key] ? 'bg-blue-600' : 'bg-gray-700'
                }`}
              >
                <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${
                  notifPrefs[key] ? 'translate-x-5' : 'translate-x-0'
                }`} />
              </button>
            </div>
          ))}
        </div>

        {/* Voice announcements — local preference */}
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">Scorekeeper</h2>
        <div className="card mb-6">
          <VoiceAnnouncePref />
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

        <div className="mt-4 flex justify-center gap-4 text-xs text-gray-700">
          <Link to="/privacy" className="hover:text-gray-400 transition">Privacy Policy</Link>
          <Link to="/terms" className="hover:text-gray-400 transition">Terms of Service</Link>
        </div>

        {/* Danger zone */}
        <div className="mt-10">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-red-700">Danger Zone</h2>
          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full rounded-2xl border border-red-900/60 py-3 text-sm font-semibold text-red-500 hover:bg-red-900/20 transition"
            >
              Delete my account
            </button>
          ) : (
            <div className="rounded-2xl border border-red-800 bg-red-950/40 px-5 py-5 space-y-4">
              <p className="text-sm text-red-300 font-semibold">This is permanent and cannot be undone.</p>
              <p className="text-xs text-gray-400">Enter your password to confirm deletion of your SportStream account. Your clubs and game history will remain.</p>
              <input
                type="password"
                placeholder="Your password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                className="input text-sm"
              />
              {deleteError && <p className="text-xs text-red-400">{deleteError}</p>}
              <div className="flex gap-3">
                <button
                  onClick={handleDeleteAccount}
                  disabled={!deletePassword || deletingAccount}
                  className="flex-1 rounded-xl bg-red-700 py-2.5 text-sm font-bold text-white hover:bg-red-600 disabled:opacity-40 transition"
                >
                  {deletingAccount ? 'Deleting…' : 'Delete account'}
                </button>
                <button
                  onClick={() => { setShowDeleteConfirm(false); setDeletePassword(''); setDeleteError(null) }}
                  className="flex-1 rounded-xl bg-gray-800 py-2.5 text-sm font-semibold text-gray-300 hover:bg-gray-700 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
