import { useState, useEffect, useRef } from 'react'
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
  uploadHighlightClip,
  subscribeToComments,
  addComment,
  deleteComment,
} from '../firebase/highlights'

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
      setCounts((prev) => ({ ...prev, [type]: (prev[type] || 0) + (next ? 1 : -1) }))
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
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

// ── Comment Section ────────────────────────────────────────────────────────────

function CommentSection({ highlight, uid, displayName, onSignInRequired }) {
  const [comments, setComments] = useState([])
  const [expanded, setExpanded] = useState(false)
  const [inputText, setInputText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (!expanded) return
    return subscribeToComments(highlight.id, setComments)
  }, [highlight.id, expanded])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!uid) { onSignInRequired(); return }
    if (!inputText.trim() || submitting) return
    setSubmitting(true)
    try {
      await addComment(highlight.id, uid, displayName, inputText)
      setInputText('')
    } catch (err) { console.error(err) }
    finally { setSubmitting(false) }
  }

  async function handleDelete(commentId) {
    if (!window.confirm('Delete this comment?')) return
    setDeletingId(commentId)
    try { await deleteComment(highlight.id, commentId) }
    catch (err) { console.error(err) }
    finally { setDeletingId(null) }
  }

  function handleExpandClick() {
    if (!uid) { onSignInRequired(); return }
    setExpanded(true)
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  const commentCount = highlight.commentCount || 0
  const previewComments = comments.slice(-2)

  return (
    <div className="border-t border-white/5 px-4 pt-3 pb-1">
      {/* Preview / collapse toggle */}
      {!expanded ? (
        <button
          onClick={handleExpandClick}
          className="flex w-full items-center gap-2 rounded-xl bg-white/3 px-3 py-2 text-left text-xs text-gray-500 hover:bg-white/5 hover:text-gray-400 transition"
        >
          <span>💬</span>
          <span>{commentCount > 0 ? `${commentCount} comment${commentCount !== 1 ? 's' : ''} — tap to view` : 'Add a comment'}</span>
        </button>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-400">
              {commentCount > 0 ? `${commentCount} comment${commentCount !== 1 ? 's' : ''}` : 'Comments'}
            </span>
            <button onClick={() => setExpanded(false)} className="text-xs text-gray-600 hover:text-gray-400">✕ collapse</button>
          </div>

          {/* Comments list */}
          <div className="space-y-2 mb-3 max-h-48 overflow-y-auto">
            {comments.length === 0 && (
              <p className="text-xs text-gray-600 py-2">Be the first to comment!</p>
            )}
            {comments.map((c) => (
              <div key={c.id} className="flex items-start gap-2 group">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-800/50 text-[10px] font-bold text-blue-300">
                  {(c.displayName || '?').slice(0, 1).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-semibold text-gray-300">{c.displayName} </span>
                  <span className="text-xs text-gray-400">{c.text}</span>
                  <div className="text-[10px] text-gray-600 mt-0.5">{relativeTime(c.createdAt)}</div>
                </div>
                {uid === c.uid && (
                  <button
                    onClick={() => handleDelete(c.id)}
                    disabled={deletingId === c.id}
                    className="shrink-0 opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition text-xs disabled:opacity-30"
                  >
                    🗑
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Input */}
          {uid ? (
            <form onSubmit={handleSubmit} className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Add a comment…"
                maxLength={280}
                className="flex-1 rounded-xl bg-white/5 px-3 py-2 text-xs text-white placeholder-gray-600 outline-none ring-1 ring-white/10 focus:ring-blue-500/40"
              />
              <button
                type="submit"
                disabled={!inputText.trim() || submitting}
                className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-40 transition"
              >
                {submitting ? '…' : 'Send'}
              </button>
            </form>
          ) : (
            <button onClick={onSignInRequired} className="text-xs text-blue-400 hover:text-blue-300 transition">
              Sign in to comment
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Canvas Share ───────────────────────────────────────────────────────────────

async function generateShareImage(highlight) {
  const SIZE = 1080
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d')

  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, SIZE, SIZE)
  grad.addColorStop(0, '#0f1117')
  grad.addColorStop(1, '#1a2040')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, SIZE, SIZE)

  // Subtle accent glow
  const glow = ctx.createRadialGradient(SIZE / 2, SIZE * 0.4, 0, SIZE / 2, SIZE * 0.4, SIZE * 0.6)
  glow.addColorStop(0, 'rgba(59,130,246,0.15)')
  glow.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, SIZE, SIZE)

  // SportStream wordmark
  ctx.font = 'bold 52px system-ui, sans-serif'
  ctx.fillStyle = '#ffffff'
  ctx.fillText('Sport', 60, 100)
  const sportWidth = ctx.measureText('Sport').width
  ctx.fillStyle = '#3b82f6'
  ctx.fillText('Stream', 60 + sportWidth, 100)

  // Trophy icon
  ctx.font = '80px serif'
  ctx.fillText('🏆', SIZE - 160, 110)

  // Divider
  ctx.fillStyle = 'rgba(255,255,255,0.08)'
  ctx.fillRect(60, 130, SIZE - 120, 2)

  // Player avatar circle (initials)
  const avatarX = SIZE / 2
  const avatarY = 300
  const avatarR = 90

  if (highlight.playerPhoto) {
    try {
      const img = await new Promise((res, rej) => {
        const i = new Image()
        i.crossOrigin = 'anonymous'
        i.onload = () => res(i)
        i.onerror = rej
        i.src = highlight.playerPhoto
      })
      ctx.save()
      ctx.beginPath()
      ctx.arc(avatarX, avatarY, avatarR, 0, Math.PI * 2)
      ctx.clip()
      ctx.drawImage(img, avatarX - avatarR, avatarY - avatarR, avatarR * 2, avatarR * 2)
      ctx.restore()
    } catch {
      drawInitialsAvatar(ctx, avatarX, avatarY, avatarR, highlight.playerName)
    }
  } else {
    drawInitialsAvatar(ctx, avatarX, avatarY, avatarR, highlight.playerName)
  }

  // Avatar ring
  ctx.beginPath()
  ctx.arc(avatarX, avatarY, avatarR + 4, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(59,130,246,0.5)'
  ctx.lineWidth = 4
  ctx.stroke()

  // Player name
  ctx.font = 'bold 72px system-ui, sans-serif'
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'center'
  ctx.fillText(highlight.playerName || 'Unknown Player', SIZE / 2, 460)

  // Play description (large)
  ctx.font = 'bold 88px system-ui, sans-serif'
  ctx.fillStyle = '#f59e0b'
  const desc = (highlight.playDescription || '').toUpperCase()
  wrapText(ctx, desc, SIZE / 2, 580, SIZE - 120, 100)

  // Team name
  ctx.font = '44px system-ui, sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.6)'
  ctx.fillText(highlight.clubName || '', SIZE / 2, 720)

  // Divider
  ctx.fillStyle = 'rgba(255,255,255,0.08)'
  ctx.fillRect(60, 800, SIZE - 120, 2)

  // Score + date footer
  ctx.font = '38px system-ui, sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.4)'
  ctx.textAlign = 'left'
  if (highlight.homeTeam && highlight.awayTeam) {
    ctx.fillText(`${highlight.homeTeam} vs ${highlight.awayTeam}`, 60, 860)
  }
  ctx.textAlign = 'right'
  ctx.fillText('sportstream-91d22.web.app', SIZE - 60, 860)

  // Reactions count
  const rc = highlight.reactionCount || 0
  ctx.textAlign = 'center'
  ctx.font = 'bold 42px system-ui, sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.35)'
  ctx.fillText(`🔥 ${rc} reaction${rc !== 1 ? 's' : ''}`, SIZE / 2, 960)

  return canvas
}

function drawInitialsAvatar(ctx, x, y, r, name) {
  const g = ctx.createRadialGradient(x, y - r / 3, r / 4, x, y, r)
  g.addColorStop(0, '#1d4ed8')
  g.addColorStop(1, '#1e3a8a')
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fillStyle = g
  ctx.fill()
  ctx.font = `bold ${r}px system-ui, sans-serif`
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText((name || '?').slice(0, 2).toUpperCase(), x, y)
  ctx.textBaseline = 'alphabetic'
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ')
  let line = ''
  let cy = y
  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, cy)
      line = word
      cy += lineHeight
    } else {
      line = test
    }
  }
  if (line) ctx.fillText(line, x, cy)
}

// ── Clip Upload ────────────────────────────────────────────────────────────────

function ClipUploadButton({ highlightId, currentUrl, onUploaded }) {
  const [progress, setProgress] = useState(null)
  const [error, setError] = useState(null)
  const fileRef = useRef(null)

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 50 * 1024 * 1024) { setError('File too large (max 50 MB)'); return }
    setError(null)
    setProgress(0)

    // Simulate progress via a small interval while upload runs
    const interval = setInterval(() => setProgress((p) => Math.min((p || 0) + 5, 90)), 300)
    try {
      const url = await uploadHighlightClip(highlightId, file)
      clearInterval(interval)
      setProgress(100)
      onUploaded(url)
      setTimeout(() => setProgress(null), 1500)
    } catch (err) {
      clearInterval(interval)
      setError(err.message || 'Upload failed')
      setProgress(null)
    }
    e.target.value = ''
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={() => fileRef.current?.click()}
        className="text-xs text-gray-500 hover:text-gray-300 transition flex items-center gap-1"
        disabled={progress !== null}
      >
        <span>📎</span>
        <span>{currentUrl ? 'Replace Clip' : 'Attach Clip'}</span>
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="video/mp4,video/quicktime,video/webm,video/*"
        className="hidden"
        onChange={handleFile}
      />
      {progress !== null && (
        <div className="h-1 w-full rounded-full bg-gray-700">
          <div
            className="h-1 rounded-full bg-blue-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
      {error && <p className="text-[10px] text-red-400">{error}</p>}
    </div>
  )
}

// ── Share Modal (desktop fallback) ────────────────────────────────────────────

function ShareImageModal({ canvas, onClose, shareUrl }) {
  const [copied, setCopied] = useState(false)
  const imgUrl = canvas?.toDataURL('image/jpeg', 0.9)

  function handleDownload() {
    const a = document.createElement('a')
    a.href = imgUrl
    a.download = 'sportstream-highlight.jpg'
    a.click()
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(shareUrl).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-[#1a1f2e] p-4 ring-1 ring-white/10" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <p className="font-bold text-white text-sm">Share Highlight</p>
          <button onClick={onClose} className="text-gray-500 hover:text-white">✕</button>
        </div>
        {imgUrl && <img src={imgUrl} alt="Highlight card" className="w-full rounded-xl mb-3" />}
        <div className="flex gap-2">
          <button onClick={handleDownload} className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 transition">
            ↓ Download
          </button>
          <button onClick={handleCopy} className="flex-1 rounded-xl bg-gray-700 py-2.5 text-sm font-semibold text-gray-200 hover:bg-gray-600 transition">
            {copied ? '✓ Copied!' : '🔗 Copy link'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Highlight Card ─────────────────────────────────────────────────────────────

function HighlightCard({ highlight, uid, displayName, onSignInRequired, isOwner }) {
  const [nominated, setNominated] = useState(highlight.nominatedForAward)
  const [sharing, setSharing] = useState(false)
  const [shareCanvas, setShareCanvas] = useState(null)
  const [videoUrl, setVideoUrl] = useState(highlight.manualVideoUrl || null)

  async function handleNominate() {
    if (!uid) { onSignInRequired(); return }
    await nominateHighlight(highlight.id)
    setNominated(true)
  }

  async function handleShare() {
    setSharing(true)
    try {
      const canvas = await generateShareImage(highlight)
      const shareUrl = `${window.location.origin}/game/${highlight.gameId}`

      if (navigator.share && navigator.canShare) {
        try {
          const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.9))
          const file = new File([blob], 'highlight.jpg', { type: 'image/jpeg' })
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({
              title: 'SportStream Highlight',
              text: `🏆 ${highlight.playerName} — ${highlight.playDescription}`,
              files: [file],
            })
            return
          }
        } catch {}
        // Fallback: share just the URL
        try {
          await navigator.share({ title: 'SportStream Highlight', url: shareUrl })
          return
        } catch {}
      }

      // Desktop fallback: show modal
      setShareCanvas(canvas)
    } finally {
      setSharing(false)
    }
  }

  const sportEmoji = SPORT_EMOJI[highlight.sport] || '🏅'
  const initials = (highlight.playerName || '?').slice(0, 2).toUpperCase()

  return (
    <>
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
          <div className="flex shrink-0 flex-col items-end gap-1">
            {highlight.gameStatus === 'live' && (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-900/60 px-2 py-0.5 text-[10px] font-bold text-green-300 ring-1 ring-green-800/40">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" />
                LIVE
              </span>
            )}
            {highlight.nominatedForAward && (
              <span className="text-xs font-bold text-yellow-500">🏆 Nominated</span>
            )}
          </div>
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
        {videoUrl && (
          <div className="mx-4 mb-3 overflow-hidden rounded-xl">
            <video
              src={videoUrl}
              controls
              playsInline
              muted
              preload="metadata"
              className="w-full rounded-xl max-h-72"
            />
          </div>
        )}

        {/* Reactions + actions */}
        <div className="border-t border-white/5 px-4 py-3 space-y-3">
          <ReactionStrip highlight={highlight} uid={uid} onSignInRequired={onSignInRequired} />

          <div className="flex items-center gap-3">
            {isOwner && (
              <ClipUploadButton
                highlightId={highlight.id}
                currentUrl={videoUrl}
                onUploaded={(url) => setVideoUrl(url)}
              />
            )}
            {uid && !nominated && (
              <button onClick={handleNominate} className="text-xs text-gray-600 hover:text-yellow-500 transition">
                🏆 Nominate
              </button>
            )}
            <button
              onClick={handleShare}
              disabled={sharing}
              className="ml-auto text-xs text-gray-600 hover:text-gray-300 transition disabled:opacity-50"
            >
              {sharing ? '…' : '↑ Share'}
            </button>
          </div>
        </div>

        {/* Comments */}
        <CommentSection
          highlight={highlight}
          uid={uid}
          displayName={displayName}
          onSignInRequired={onSignInRequired}
        />
      </div>

      {shareCanvas && (
        <ShareImageModal
          canvas={shareCanvas}
          shareUrl={`${window.location.origin}/game/${highlight.gameId}`}
          onClose={() => setShareCanvas(null)}
        />
      )}
    </>
  )
}

// ── Top 10 Strip ───────────────────────────────────────────────────────────────

function WeeklyTop10Strip({ uid, displayName, onSignInRequired }) {
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
                <HighlightCard highlight={h} uid={uid} displayName={displayName} onSignInRequired={onSignInRequired} />
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
  const [discoverLimit, setDiscoverLimit] = useState(20)
  const [showSignInPrompt, setShowSignInPrompt] = useState(false)

  useEffect(() => {
    if (!user) return
    return subscribeToUser(user.uid, setUserDoc)
  }, [user])

  useEffect(() => {
    setDiscoverLoading(true)
    const unsub = subscribeToDiscoverHighlights((hs) => {
      setDiscoverHighlights(hs)
      setDiscoverLoading(false)
    }, discoverLimit)
    return unsub
  }, [discoverLimit])

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
  const displayName = userDoc?.displayName || user?.displayName || user?.email?.split('@')[0] || 'User'

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
            <WeeklyTop10Strip uid={uid} displayName={displayName} onSignInRequired={() => setShowSignInPrompt(true)} />

            {discoverLoading ? (
              <div className="flex justify-center py-16">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
              </div>
            ) : discoverHighlights.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 py-16 text-center">
                <p className="text-3xl mb-3">🎬</p>
                <p className="text-sm text-gray-400">No highlights yet this week — check back after games are played!</p>
                <p className="mt-1 text-xs text-gray-600">Highlights are created automatically from notable plays.</p>
              </div>
            ) : (
              <>
                {discoverHighlights.map((h) => (
                  <HighlightCard
                    key={h.id}
                    highlight={h}
                    uid={uid}
                    displayName={displayName}
                    onSignInRequired={() => setShowSignInPrompt(true)}
                  />
                ))}
                {discoverHighlights.length >= discoverLimit && (
                  <div className="flex justify-center pt-2 pb-4">
                    <button
                      onClick={() => setDiscoverLimit((n) => n + 20)}
                      className="rounded-xl bg-white/5 px-6 py-2.5 text-sm font-semibold text-gray-300 hover:bg-white/10 transition"
                    >
                      Load more
                    </button>
                  </div>
                )}
              </>
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
                {(userDoc?.followedClubs?.length || 0) + (userDoc?.followedPlayers?.length || 0) === 0 ? (
                  <>
                    <p className="text-sm text-gray-400">Follow players and teams to see their highlights here.</p>
                    <Link to="/" className="mt-4 inline-block rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500">
                      Find teams →
                    </Link>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-gray-400">No highlights from your followed teams yet.</p>
                    <p className="mt-1 text-xs text-gray-600">Check back after games are played!</p>
                  </>
                )}
              </div>
            ) : (
              followingHighlights.map((h) => (
                <HighlightCard
                  key={h.id}
                  highlight={h}
                  uid={uid}
                  displayName={displayName}
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
