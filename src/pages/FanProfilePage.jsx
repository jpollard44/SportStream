import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getUser } from '../firebase/firestore'
import { formatDate } from '../lib/formatters'

const SPORT_EMOJI = {
  basketball: '🏀', baseball: '⚾', softball: '🥎',
  soccer: '⚽', volleyball: '🏐', 'flag-football': '🏈',
}

export default function FanProfilePage() {
  const { uid } = useParams()
  const [userData, setUserData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getUser(uid)
      .then(setUserData)
      .catch(() => setUserData(null))
      .finally(() => setLoading(false))
  }, [uid])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    )
  }

  if (!userData) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-gray-950 text-gray-400">
        <p>Fan profile not found.</p>
        <Link to="/" className="text-blue-400">← Home</Link>
      </div>
    )
  }

  const displayName = userData.displayName || userData.email?.split('@')[0] || 'SportStream Fan'
  const initials = displayName.slice(0, 2).toUpperCase()
  const followedClubs = userData.followedClubs || []
  const followedPlayers = userData.followedPlayers || []

  // Fan since = createdAt timestamp
  const fanSince = userData.createdAt?.toDate?.() || null

  return (
    <div className="min-h-screen bg-gray-950 pb-20 text-white">
      {/* Nav */}
      <nav className="flex items-center justify-between border-b border-gray-800 px-5 py-4">
        <Link to="/" className="text-lg font-extrabold tracking-tight">
          Sport<span className="text-blue-500">Stream</span>
        </Link>
      </nav>

      {/* Back nav */}
      <div className="flex items-center gap-3 border-b border-gray-800/50 px-4 py-2">
        <Link to="/" className="text-xs text-gray-500 hover:text-gray-300">← Home</Link>
      </div>

      {/* Profile header */}
      <div className="border-b border-gray-800 bg-gray-900 px-5 py-6">
        <div className="mx-auto max-w-lg">
          <div className="flex items-center gap-4">
            {userData.photoUrl ? (
              <img src={userData.photoUrl} alt={displayName} className="h-20 w-20 shrink-0 rounded-2xl object-cover ring-2 ring-gray-700" />
            ) : (
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-blue-900/50 text-2xl font-extrabold text-blue-300 ring-2 ring-gray-700">
                {initials}
              </div>
            )}
            <div>
              <h1 className="text-2xl font-extrabold text-white">{displayName}</h1>
              <p className="mt-1 text-sm text-gray-400">SportStream Fan</p>
              {fanSince && (
                <p className="mt-0.5 text-xs text-gray-500">
                  Fan since {fanSince.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </p>
              )}
              <div className="mt-2 flex gap-3 text-xs text-gray-500">
                <span>{followedClubs.length} team{followedClubs.length !== 1 ? 's' : ''}</span>
                <span>·</span>
                <span>{followedPlayers.length} player{followedPlayers.length !== 1 ? 's' : ''}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-lg space-y-6 px-5 pt-6">

        {/* Teams they follow */}
        {followedClubs.length > 0 && (
          <section>
            <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-gray-500">
              Teams ({followedClubs.length})
            </p>
            <div className="flex flex-col gap-2">
              {followedClubs.map((clubId) => (
                <Link
                  key={clubId}
                  to={`/team/${clubId}`}
                  className="flex items-center gap-3 rounded-2xl bg-gray-900 px-4 py-3 transition hover:bg-gray-800"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-800 text-xl">🎽</div>
                  <p className="flex-1 text-sm font-semibold text-white truncate">{clubId}</p>
                  <span className="text-xs text-gray-600">→</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Players they follow */}
        {followedPlayers.length > 0 && (
          <section>
            <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-gray-500">
              Players ({followedPlayers.length})
            </p>
            <div className="flex flex-col gap-2">
              {followedPlayers.map((fp) => (
                <Link
                  key={fp.playerId}
                  to={`/player/${fp.clubId}/${fp.playerId}`}
                  className="flex items-center gap-3 rounded-2xl bg-gray-900 px-4 py-3 transition hover:bg-gray-800"
                >
                  {fp.photoUrl ? (
                    <img src={fp.photoUrl} alt={fp.name} className="h-10 w-10 shrink-0 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-900 text-sm font-bold text-blue-200">
                      {fp.number || fp.name?.charAt(0) || '?'}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    {fp.nickname ? (
                      <>
                        <p className="truncate font-bold text-white">"{fp.nickname}"</p>
                        <p className="truncate text-xs text-gray-500">{fp.name} · {fp.clubName || ''}</p>
                      </>
                    ) : (
                      <>
                        <p className="truncate font-semibold text-white">{fp.name}</p>
                        <p className="truncate text-xs text-gray-500">{fp.clubName || ''} {fp.position ? `· ${fp.position}` : ''}</p>
                      </>
                    )}
                  </div>
                  {fp.clubSport && <span className="shrink-0 text-lg">{SPORT_EMOJI[fp.clubSport] || '🏅'}</span>}
                </Link>
              ))}
            </div>
          </section>
        )}

        {followedClubs.length === 0 && followedPlayers.length === 0 && (
          <div className="rounded-2xl border border-dashed border-gray-800 py-14 text-center">
            <p className="text-sm text-gray-500">This fan hasn't followed any teams or players yet.</p>
          </div>
        )}
      </div>
    </div>
  )
}
