import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getInvite, claimInvite } from '../firebase/firestore'

export default function InvitePage() {
  const { token } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [invite, setInvite]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [claiming, setClaiming] = useState(false)
  const [error, setError]     = useState('')
  const [claimed, setClaimed] = useState(false)

  useEffect(() => {
    getInvite(token)
      .then(setInvite)
      .catch(() => setInvite(null))
      .finally(() => setLoading(false))
  }, [token])

  async function handleClaim() {
    if (!user) return
    setClaiming(true)
    setError('')
    try {
      await claimInvite(token, user.uid)
      setClaimed(true)
      setTimeout(() => navigate(`/player/${invite.clubId}/${invite.playerId}`), 1500)
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setClaiming(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    )
  }

  if (!invite) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-gray-950 px-6 text-center">
        <p className="text-4xl">🔗</p>
        <p className="text-lg font-bold text-white">Invite not found</p>
        <p className="text-sm text-gray-400">This link may be invalid or expired.</p>
        <Link to="/" className="text-blue-400 hover:text-blue-300">← Back to SportStream</Link>
      </div>
    )
  }

  if (invite.claimed) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-gray-950 px-6 text-center">
        <p className="text-4xl">✅</p>
        <p className="text-lg font-bold text-white">Profile already claimed</p>
        <p className="text-sm text-gray-400">This invite link has already been used.</p>
        <Link to={`/player/${invite.clubId}/${invite.playerId}`} className="text-blue-400 hover:text-blue-300">
          View player profile →
        </Link>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-950 px-6">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 text-center">
          <Link to="/" className="text-2xl font-extrabold tracking-tight text-white">
            Sport<span className="text-blue-500">Stream</span>
          </Link>
        </div>

        <div className="rounded-2xl bg-gray-900 p-6">
          {/* Header */}
          <div className="mb-5 flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-blue-900/50 text-2xl font-extrabold text-blue-300">
              {invite.playerName?.charAt(0) || '?'}
            </div>
            <div>
              <p className="text-xl font-bold text-white">{invite.playerName}</p>
              <p className="text-sm text-gray-400">You've been invited to claim your SportStream profile.</p>
            </div>
          </div>

          <p className="mb-5 text-sm text-gray-300">
            Once claimed, you can view your personal stats, career history, and receive notifications
            when notable plays are recorded.
          </p>

          {error && (
            <div className="mb-4 rounded-xl bg-red-900/40 px-4 py-2.5 text-sm text-red-300">{error}</div>
          )}

          {claimed ? (
            <div className="flex items-center gap-2 rounded-xl bg-green-900/40 px-4 py-3 text-sm font-semibold text-green-300">
              <span>✓</span> Profile claimed! Redirecting…
            </div>
          ) : user ? (
            <div className="space-y-3">
              <div className="rounded-xl bg-gray-800 px-4 py-3">
                <p className="text-xs text-gray-500">Signing in as</p>
                <p className="font-semibold text-white">{user.displayName || user.email}</p>
              </div>
              <button
                onClick={handleClaim}
                disabled={claiming}
                className="btn-primary w-full"
              >
                {claiming ? 'Claiming…' : 'Claim My Profile'}
              </button>
              <p className="text-center text-xs text-gray-600">
                Not you?{' '}
                <Link to="/login" className="text-blue-400 hover:text-blue-300">
                  Sign in with a different account
                </Link>
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <Link
                to={`/login?redirect=/invite/${token}`}
                className="btn-primary block w-full text-center"
              >
                Sign in to claim
              </Link>
              <p className="text-center text-xs text-gray-500">
                New to SportStream?{' '}
                <Link to={`/login?redirect=/invite/${token}`} className="text-blue-400 hover:text-blue-300">
                  Create a free account
                </Link>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
