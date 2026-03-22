import {
  collection, doc, addDoc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  query, where, orderBy, limit, onSnapshot, serverTimestamp,
  increment, runTransaction,
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from './config'

// ── Helpers ───────────────────────────────────────────────────────────────────

function getISOWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7)
}

export function currentWeekKey() {
  const now = new Date()
  const week = getISOWeek(now)
  return `${now.getFullYear()}-W${String(week).padStart(2, '0')}`
}

// ── Subscriptions ─────────────────────────────────────────────────────────────

/** Discover tab: top highlights by reactionCount, with createdAt tiebreaker, configurable limit */
export function subscribeToDiscoverHighlights(cb, limitCount = 20) {
  const q = query(
    collection(db, 'highlights'),
    orderBy('reactionCount', 'desc'),
    limit(limitCount)
  )
  return onSnapshot(q, (snap) => {
    const hs = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    // Secondary sort by createdAt descending as tiebreaker (client-side)
    hs.sort((a, b) => {
      if (b.reactionCount !== a.reactionCount) return b.reactionCount - a.reactionCount
      const ta = a.createdAt?.toMillis?.() || 0
      const tb = b.createdAt?.toMillis?.() || 0
      return tb - ta
    })
    cb(hs)
  })
}

/** Following tab: highlights from followed clubs (max 10 clubIds) or players (max 10) */
export function subscribeToFollowingHighlights(followedClubs = [], followedPlayers = [], cb) {
  const clubIds   = followedClubs.slice(0, 10)
  const playerIds = followedPlayers.slice(0, 10).map((fp) => fp.playerId || fp)

  if (clubIds.length === 0 && playerIds.length === 0) {
    cb([])
    return () => {}
  }

  // Use clubId query (more common); merge with player query client-side
  const constraints = []
  if (clubIds.length > 0) {
    constraints.push(
      query(
        collection(db, 'highlights'),
        where('clubId', 'in', clubIds),
        orderBy('createdAt', 'desc'),
        limit(20)
      )
    )
  }
  if (playerIds.length > 0) {
    constraints.push(
      query(
        collection(db, 'highlights'),
        where('playerId', 'in', playerIds),
        orderBy('createdAt', 'desc'),
        limit(20)
      )
    )
  }

  const results = {}
  const unsubs = []

  function merge() {
    const all = Object.values(results).flat()
    const seen = new Set()
    const deduped = all.filter((h) => {
      if (seen.has(h.id)) return false
      seen.add(h.id)
      return true
    })
    deduped.sort((a, b) => {
      const ta = a.createdAt?.toMillis?.() || 0
      const tb = b.createdAt?.toMillis?.() || 0
      return tb - ta
    })
    cb(deduped)
  }

  constraints.forEach((q, i) => {
    const unsub = onSnapshot(q, (snap) => {
      results[i] = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      merge()
    })
    unsubs.push(unsub)
  })

  return () => unsubs.forEach((u) => u())
}

/** Weekly top 10 */
export async function getWeeklyTop10(weekKey) {
  const key = weekKey || currentWeekKey()
  const snap = await getDoc(doc(db, 'weeklyTop10', key))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() }
}

/** Get a batch of highlights by IDs */
export async function getHighlightsByIds(ids) {
  if (!ids?.length) return []
  const snaps = await Promise.all(ids.map((id) => getDoc(doc(db, 'highlights', id))))
  return snaps.filter((s) => s.exists()).map((s) => ({ id: s.id, ...s.data() }))
}

// ── Reactions ─────────────────────────────────────────────────────────────────

const REACTION_TYPES = ['fire', 'electric', 'clutch', 'unbelievable', 'applause']

/** Get the current user's reactions for a highlight */
export async function getUserReaction(highlightId, uid) {
  if (!uid) return {}
  const snap = await getDoc(doc(db, 'highlights', highlightId, 'userReactions', uid))
  return snap.exists() ? (snap.data().reactions || {}) : {}
}

/** Toggle a reaction. Returns the new boolean state. */
export async function toggleReaction(highlightId, uid, reactionType) {
  if (!uid || !REACTION_TYPES.includes(reactionType)) throw new Error('Invalid args')

  const reactionRef  = doc(db, 'highlights', highlightId, 'userReactions', uid)
  const highlightRef = doc(db, 'highlights', highlightId)

  return runTransaction(db, async (tx) => {
    const reactionSnap  = await tx.get(reactionRef)
    const existing      = reactionSnap.exists() ? (reactionSnap.data().reactions || {}) : {}
    const currentlySet  = !!existing[reactionType]
    const nextVal       = !currentlySet

    const updatedReactions = { ...existing, [reactionType]: nextVal }
    tx.set(reactionRef, { reactions: updatedReactions }, { merge: true })

    const delta = nextVal ? 1 : -1
    tx.update(highlightRef, {
      [`reactions.${reactionType}`]: increment(delta),
      reactionCount: increment(delta),
    })

    return nextVal
  })
}

// ── Nominate ──────────────────────────────────────────────────────────────────

export async function nominateHighlight(highlightId) {
  await updateDoc(doc(db, 'highlights', highlightId), { nominatedForAward: true })
}

// ── Manual highlight creation ─────────────────────────────────────────────────

export async function createManualHighlight({
  playerId, playerName, playerPhoto, clubId, clubName,
  gameId, sport, playType, playDescription, gameContext,
  homeTeam, awayTeam, leagueId, tournamentId,
}) {
  const now = new Date()
  function getISOWeekLocal(d) {
    const copy = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
    const dn = copy.getUTCDay() || 7
    copy.setUTCDate(copy.getUTCDate() + 4 - dn)
    const ys = new Date(Date.UTC(copy.getUTCFullYear(), 0, 1))
    return Math.ceil((((copy - ys) / 86400000) + 1) / 7)
  }

  const ref = await addDoc(collection(db, 'highlights'), {
    playerId: playerId || '',
    playerName: playerName || '',
    playerPhoto: playerPhoto || null,
    clubId: clubId || '',
    clubName: clubName || '',
    gameId: gameId || '',
    sport: sport || '',
    playType: playType || '',
    playDescription: playDescription || '',
    gameContext: gameContext || '',
    homeTeam: homeTeam || '',
    awayTeam: awayTeam || '',
    leagueId: leagueId || null,
    tournamentId: tournamentId || null,
    createdAt: serverTimestamp(),
    reactions: { fire: 0, electric: 0, clutch: 0, unbelievable: 0, applause: 0 },
    reactionCount: 0,
    nominatedForAward: false,
    weekNumber: getISOWeekLocal(now),
    year: now.getFullYear(),
    manualVideoUrl: null,
  })
  return ref.id
}

// ── Comments ──────────────────────────────────────────────────────────────────

/** Real-time listener for comments on a highlight (chronological) */
export function subscribeToComments(highlightId, cb) {
  const q = query(
    collection(db, 'highlights', highlightId, 'comments'),
    orderBy('createdAt', 'asc'),
    limit(50)
  )
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
}

/** Add a comment to a highlight */
export async function addComment(highlightId, uid, displayName, text) {
  await addDoc(collection(db, 'highlights', highlightId, 'comments'), {
    uid,
    displayName: displayName || 'Anonymous',
    text: text.trim(),
    createdAt: serverTimestamp(),
  })
  await updateDoc(doc(db, 'highlights', highlightId), { commentCount: increment(1) })
}

/** Delete own comment */
export async function deleteComment(highlightId, commentId) {
  await deleteDoc(doc(db, 'highlights', highlightId, 'comments', commentId))
  await updateDoc(doc(db, 'highlights', highlightId), { commentCount: increment(-1) })
}

/** Upload a video clip for a highlight to Firebase Storage */
export async function uploadHighlightClip(highlightId, file) {
  const storageRef = ref(storage, `highlights/${highlightId}/clip.mp4`)
  await uploadBytes(storageRef, file)
  const url = await getDownloadURL(storageRef)
  await updateDoc(doc(db, 'highlights', highlightId), { manualVideoUrl: url })
  return url
}
