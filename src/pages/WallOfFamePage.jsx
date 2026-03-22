import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { subscribeToUser } from '../firebase/firestore'
import {
  subscribeToDiscoverHighlights,
  subscribeToFollowingHighlights,
  getWeeklyTop10,
  getHighlightsByIds,
  getUserReaction,
  toggleReaction,
  nominateHighlight,
} from '../firebase/highlights'
import { PageSpinner } from '../components/ui'

// ── Constants ─────────────────────────────────────────────────────────────────

const REACTIONS = [
  { type: 'fire',        emoji: '🔥', label: 'Fire' },
  { type: 'electric',   emoji: '⚡', label: 'Electric' },
  { type: 'clutch',     emoji: '🎯', label: 'Clutch' },
  { type: 'unbelievable', emoji: '😱', label: 'Unbelievable' },
  { type: 'applause',   emoji: '👏', label: 'Applause' },
]

const SPORT_EMOJI = {
  basketball: '🏀', baseball: '⚾', softball: '🥎',
  soccer: '⚽', volleyball: '🏐', 'flag-football': '🏈',
}

function relativeTime(ts) {
  if (!ts) return ''
  const ms = ts?.toMillis ? ts.toMillis() : new Date(ts).getTime()
  const diff = Date.now() - ms
  if (diff < 60000) return 'just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ── Reaction Strip ─────────────────────────────────────────────────────────────

function ReactionStrip({ highlight, uid, onSignInRequired }) {
  const [myReactions, setMyReactions] = useState({})
  const [counts, setCounts] = useState(highlight.reactions || {})
  const [bouncing, setBouncing] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!uid) return
    getUserReaction(highlight.id, uid).then(setMyReactions).catch(() => {})
  }, [highlight.id, uid])

  async function handleReaction(type) {
    if (!uid) { onSignInRequired(); return }
    if (loading) return
    setLoading(true)
    setBouncing(type)
    setTimeout(() => setBouncing(null), 400)
    try {
      const next = await toggleReaction(highlight.id, uid, type)
      setMyReactions((prev) => ({ ...prev, [type]: next }))
      setCounts((prev) => ({
        ...prev,
        [type]: (prev[type] || 0) + (next ? 1 : -1),
      }))
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {REACTIONS.map(({ type, emoji }) => {
        const active = !!myReactions[type]
        const count  = counts[type] || 0
        return (
          <button
            key={type}
            onClick={() => handleReaction(type)}
            className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition-all duration-150 ${
              bouncing === type ? 'scale-125' : 'scale-100'
            } ${
              active
                ? 'bg-blue-600/30 text-blue-300 ring-1 ring-blue-500/40'
                : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-200'
            }`}
          >
            <span>{emoji}</span>
            {count > 0 && <span>{count}</span>}
          </button>
        )
      })}
    </div>
  )
}

// ── Highlight Card ─────────────────────────────────────────────────────────────

function HighlightCard({ highlight, uid, onSignInRequired }) {
  const [nominated, setNominated] = useState(highlight.nominatedForAward)
  const [sharing, setSharing] = useState(false)

  async function handleNominate() {
    if (!uid) { onSignInRequired(); return }
    await nominateHighlight(highlight.id)
    setNominated(true)
  }

  async function handleShare() {
    const url = `${window.location.origin}/game/${highlight.gameId}`
    const text = `${highlight.playerName} ${highlight.playDescription} — watch on SportStream!`
    if (navigator.share) {
      try { await navigator.share({ title: 'SportStream Highlight', text, url }) } catch {}
    } else {
      await navigator.clipboard.writeText(url)
      setSharing(true)
      setTimeout(() => setSharing(false), 2000)
    }
  }

  const sportEmoji = SPORT_EMOJI[highlight.sport] || '🏅'
  const initials = (highlight.playerName || '?').slice(0, 2).toUpperCase()

  return (
    <div className="rounded-2xl bg-[#1a1f2e] ring-1 ring-white/5 overflow-hidden">
      {/* Header: player info */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <Link to={highlight.playerId ? `/player/${highlight.clubId}/${highlight.playerId}` : '#'}>
          {highlight.playerPhoto ? (
            <img src={highlight.playerPhoto} alt={highlight.playerName}
              className="h-10 w-10 shrink-0 rounded-full object-cover ring-2 ring-white/10" />
          ) : (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-800 to-blue-600 text-sm font-bold text-white ring-2 ring-white/10">
              {initials}
            </div>
          )}
        </Link>
        <div className="min-w-0 flex-1">
          <Link
            to={highlight.playerId ? `/player/${highlight.clubId}/${highlight.playerId}` : '#'}
            className="block truncate font-bold text-white hover:text-blue-300 transition text-sm"
          >
            {highlight.playerName || 'Unknown Player'}
          </Link>
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Link to={`/team/${highlight.clubId}`} className="hover:text-gray-300 transition truncate">
              {highlight.clubName}
            </Link>
            <span>·</span>
            <span>{sportEmoji}</span>
            <span>{relativeTime(highlight.createdAt)}</span>
          </div>
        </div>
        {highlight.nominatedForAward && (
          <span className="shrink-0 text-xs font-bold text-yellow-500">🏆 Nominated</span>
        )}
      </div>

      {/* Play description */}
      <div className="px-4 pb-3">
        <p className="text-lg font-extrabold text-white leading-snug">
          {highlight.playDescription}
        </p>
        {highlight.gameContext && (
          <p className="mt-1 text-xs text-gray-500">{highlight.gameContext}</p>
        )}
        {(highlight.homeTeam || highlight.awayTeam) && (
          <Link to={`/game/${highlight.gameId}`} className="mt-1 flex items-center gap-1 text-xs text-blue-400/80 hover:text-blue-300">
            {highlight.homeTeam} vs {highlight.awayTeam} →
          </Link>
        )}
      </div>

      {/* Video player */}
      {highlight.manualVideoUrl && (
        <div className="mx-4 mb-3 overflow-hidden rounded-xl">
          <video
            src={highlight.manualVideoUrl}
            controls
            playsInline
            preload="metadata"
            className="w-full rounded-xl"
          />
        </div>
      )}

      {/* Reactions + actions */}
      <div className="border-t border-white/5 px-4 py-3 space-y-3">
        <ReactionStrip highlight={highlight} uid={uid} onSignInRequired={onSignInRequired} />

        <div className="flex items-center gap-3">
          {uid && !nominated && (
            <button
              onClick={handleNominate}
              className="text-xs text-gray-600 hover:text-yellow-500 transition"
            >
              🏆 Nominate for Award
            </button>
          )}
          <button
            onClick={handleShare}
            className="ml-auto text-xs text-gray-600 hover:text-gray-300 transition"
          >
            {sharing ? '✓ Copied!' : '↑ Share'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Top 10 Strip ───────────────────────────────────────────────────────────────

function WeeklyTop10Strip({ uid, onSignInRequired }) {
  const [weekData, setWeekData] = useState(null)
  const [highlights, setHighlights] = useState([])
  const [expanded, setExpanded] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getWeeklyTop10()
      .then(async (data) => {
        if (!data?.highlights?.length) { setLoading(false); return }
        setWeekData(data)
        const hs = await getHighlightsByIds(data.highlights)
        setHighlights(hs)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading || highlights.length === 0) return null

  return (
    <div className="mb-5">
      <p className="mb-2 px-4 text-[10px] font-bold uppercase tracking-wider text-yellow-600">
        🏆 Top 10 This Week
      </p>
      <div className="flex gap-3 overflow-x-auto px-4 pb-2 scrollbar-none">
        {highlights.map((h, i) => (
          <div key={h.id} className="shrink-0">
            {expanded === h.id ? (
              <div className="w-80">
                <button onClick={() => setExpanded(null)} className="mb-1.5 text-xs text-gray-500 hover:text-white">
                  ✕ collapse
                </button>
                <HighlightCard highlight={h} uid={uid} onSignInRequired={onSignInRequired} />
              </div>
            ) : (
              <button
                onClick={() => setExpanded(h.id)}
                className="flex w-44 flex-col gap-1.5 rounded-2xl bg-[#1a1f2e] p-3 ring-1 ring-white/5 text-left hover:ring-yellow-600/40 transition"
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-base font-extrabold text-yellow-500">#{i + 1}</span>
                  <span className="text-xs font-semibold text-white truncate">{h.playerName}</span>
                </div>
                <p className="truncate text-xs text-gray-400">{h.playDescription}</p>
                <div className="flex items-center gap-1 text-xs text-gray-600">
                  <span>🔥</span>
                  <span>{h.reactionCount || 0}</span>
                </div>
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function WallOfFamePage() {
  const { user } = useAuth()
  const [tab, setTab] = useState('discover')
  const [userDoc, setUserDoc] = useState(null)
  const [discoverHighlights, setDiscoverHighlights] = useState([])
  const [followingHighlights, setFollowingHighlights] = useState([])
  const [discoverLoading, setDiscoverLoading] = useState(true)
  const [followingLoading, setFollowingLoading] = useState(true)
  const [showSignInPrompt, setShowSignInPrompt] = useState(false)

  useEffect(() => {
    if (!user) return
    return subscribeToUser(user.uid, setUserDoc)
  }, [user])

  useEffect(() => {
    const unsub = subscribeToDiscoverHighlights((hs) => {
      setDiscoverHighlights(hs)
      setDiscoverLoading(false)
    })
    return unsub
  }, [])

  useEffect(() => {
    if (!user || !userDoc) { setFollowingLoading(false); return }
    const unsub = subscribeToFollowingHighlights(
      userDoc.followedClubs || [],
      userDoc.followedPlayers || [],
      (hs) => {
        setFollowingHighlights(hs)
        setFollowingLoading(false)
      }
    )
    return unsub
  }, [user, userDoc])

  const uid = user?.uid || null

  const tabs = [
    { id: 'discover',  label: 'Discover' },
    { id: 'following', label: 'Following' },
  ]

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
              Sign in
            </Link>
          )}
        </div>
      </nav>

      {/* Header */}
      <div className="border-b border-white/5 px-5 py-5">
        <h1 className="text-2xl font-extrabold text-white">
          🏆 Wall of <span className="bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">Fame</span>
        </h1>
        <p className="mt-0.5 text-sm text-gray-500">Top plays from across the platform</p>
      </div>

      {/* Tabs */}
      <div className="sticky top-0 z-10 flex border-b border-white/5 bg-[#0f1117]/95 backdrop-blur">
        {tabs.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`relative flex-1 py-3 text-sm font-semibold transition ${
              tab === id ? 'text-white' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {label}
            {tab === id && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-blue-500" />
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="mx-auto max-w-lg px-4 pt-5 space-y-4">

        {/* Discover tab */}
        {tab === 'discover' && (
          <>
            <WeeklyTop10Strip uid={uid} onSignInRequired={() => setShowSignInPrompt(true)} />

            {discoverLoading ? (
              <div className="flex justify-center py-16">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
              </div>
            ) : discoverHighlights.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 py-16 text-center">
                <p className="text-3xl mb-3">🎬</p>
                <p className="text-sm text-gray-400">No highlights yet.</p>
                <p className="mt-1 text-xs text-gray-600">Highlights are created automatically from notable plays.</p>
              </div>
            ) : (
              discoverHighlights.map((h) => (
                <HighlightCard
                  key={h.id}
                  highlight={h}
                  uid={uid}
                  onSignInRequired={() => setShowSignInPrompt(true)}
                />
              ))
            )}
          </>
        )}

        {/* Following tab */}
        {tab === 'following' && (
          <>
            {!user ? (
              <div className="rounded-2xl border border-dashed border-white/10 py-16 text-center">
                <p className="text-3xl mb-3">👀</p>
                <p className="text-sm text-gray-400">Sign in to see highlights from teams and players you follow.</p>
                <Link to="/login" className="mt-4 inline-block rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500">
                  Sign in →
                </Link>
              </div>
            ) : followingLoading ? (
              <div className="flex justify-center py-16">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
              </div>
            ) : followingHighlights.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 py-16 text-center">
                <p className="text-3xl mb-3">📣</p>
                <p className="text-sm text-gray-400">No highlights from your followed teams yet.</p>
                <p className="mt-1 text-xs text-gray-600">Follow teams and players to see their big moments here.</p>
                <Link to="/find" className="mt-4 inline-block rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500">
                  Find teams →
                </Link>
              </div>
            ) : (
              followingHighlights.map((h) => (
                <HighlightCard
                  key={h.id}
                  highlight={h}
                  uid={uid}
                  onSignInRequired={() => setShowSignInPrompt(true)}
                />
              ))
            )}
          </>
        )}
      </div>

      {/* Sign-in prompt modal */}
      {showSignInPrompt && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6"
          onClick={() => setShowSignInPrompt(false)}
        >
          <div
            className="w-full max-w-xs rounded-2xl bg-[#1a1f2e] p-6 text-center ring-1 ring-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-1 text-lg font-bold text-white">Sign in to react</p>
            <p className="mb-5 text-sm text-gray-400">Create a free account to react to highlights and follow players.</p>
            <Link to="/login" className="btn-primary mb-3 block">Sign in / Sign up →</Link>
            <button onClick={() => setShowSignInPrompt(false)} className="text-sm text-gray-500 hover:text-white">
              Maybe later
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
