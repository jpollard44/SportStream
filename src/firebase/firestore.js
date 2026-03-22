import {
  collection,
  collectionGroup,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  increment,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore'
import { db } from './config'

// ─── Clubs ───────────────────────────────────────────────────────────────────

export async function createClub(ownerId, { name, sport }) {
  const ref = await addDoc(collection(db, 'clubs'), {
    name,
    nameLower: name.toLowerCase(),
    sport,
    ownerId,
    adminIds: [ownerId],
    logoUrl: null,
    createdAt: serverTimestamp(),
  })
  return ref.id
}

export async function searchClubs(nameQuery) {
  if (!nameQuery || nameQuery.trim().length < 2) return []
  const q = nameQuery.trim().toLowerCase()
  const snap = await getDocs(
    query(
      collection(db, 'clubs'),
      where('nameLower', '>=', q),
      where('nameLower', '<=', q + '\uf8ff'),
      limit(10)
    )
  )
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export function subscribeToUserClubs(userId, onChange) {
  const q = query(collection(db, 'clubs'), where('adminIds', 'array-contains', userId))
  return onSnapshot(q, (snap) => {
    onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  })
}

export async function getClub(clubId) {
  const snap = await getDoc(doc(db, 'clubs', clubId))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

export function subscribeToClub(clubId, onChange) {
  return onSnapshot(doc(db, 'clubs', clubId), (snap) => {
    if (snap.exists()) onChange({ id: snap.id, ...snap.data() })
  })
}

export async function updateClub(clubId, data) {
  await updateDoc(doc(db, 'clubs', clubId), data)
}

export async function deleteClub(clubId) {
  // Delete all players subcollection first, then the club doc
  const playersSnap = await getDocs(collection(db, 'clubs', clubId, 'players'))
  await Promise.all(playersSnap.docs.map((d) => deleteDoc(d.ref)))
  await deleteDoc(doc(db, 'clubs', clubId))
}

// ─── Players ─────────────────────────────────────────────────────────────────

export async function addPlayer(clubId, { name, nickname, number, position, email, phone }) {
  const ref = await addDoc(collection(db, 'clubs', clubId, 'players'), {
    name,
    nickname: nickname || '',
    number: number || '',
    position: position || '',
    email: email || '',
    phone: phone || '',
    photoUrl: null,
    active: true,
    createdAt: serverTimestamp(),
  })
  return ref.id
}

export async function updatePlayer(clubId, playerId, data) {
  await updateDoc(doc(db, 'clubs', clubId, 'players', playerId), data)
}

export async function deletePlayer(clubId, playerId) {
  await deleteDoc(doc(db, 'clubs', clubId, 'players', playerId))
}

export function subscribeToPlayers(clubId, onChange) {
  const q = query(
    collection(db, 'clubs', clubId, 'players'),
    where('active', '==', true),
    orderBy('number')
  )
  return onSnapshot(q, (snap) => {
    onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  })
}

export async function getPlayers(clubId) {
  const q = query(
    collection(db, 'clubs', clubId, 'players'),
    where('active', '==', true),
    orderBy('number')
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

// ─── Games ───────────────────────────────────────────────────────────────────

export async function createGame(clubId, {
  homeTeam, awayTeam, totalPeriods, periodLength,
  joinCode, scorekeeperId, sport,
  totalInnings,
  tournamentId = null, bracketMatchId = null,
  awayClubId = null,
  leagueId = null, homeLeagueTeamId = null, awayLeagueTeamId = null,
  scheduledAt = null,
}) {
  const isBaseball = sport === 'baseball' || sport === 'softball'
  const ref = await addDoc(collection(db, 'games'), {
    clubId,
    sport: sport || 'basketball',
    joinCode,
    status: 'setup',
    homeTeam,
    awayTeam,
    homeScore: 0,
    awayScore: 0,
    // Basketball fields
    period: 1,
    totalPeriods: isBaseball ? null : totalPeriods,
    periodLength: isBaseball ? null : periodLength,
    clockElapsed: 0,
    clockRunning: false,
    // Baseball / softball fields
    inning: 1,
    inningHalf: 'top',
    outs: 0,
    totalInnings: isBaseball ? (totalInnings || 9) : null,
    scorekeeperId,
    lastPlayId: null,
    lastPlayUndone: false,
    peerId: null,
    bases: isBaseball ? { first: null, second: null, third: null } : null,
    balls: isBaseball ? 0 : null,
    strikes: isBaseball ? 0 : null,
    homeLineup: [],
    awayLineup: [],
    homeBatterIdx: 0,
    awayBatterIdx: 0,
    // Opponent club linkage (links game to away team's club page)
    awayClubId,
    // Tournament linkage
    tournamentId,
    bracketMatchId,
    // League linkage
    leagueId,
    homeLeagueTeamId,
    awayLeagueTeamId,
    createdAt: serverTimestamp(),
    startedAt: null,
    endedAt: null,
    scheduledAt: scheduledAt || null,
  })
  return ref.id
}

export async function updateGame(gameId, data) {
  await updateDoc(doc(db, 'games', gameId), data)
}

export async function deleteGame(gameId) {
  // Delete all plays (stats/records) first — Firestore doesn't cascade subcollection deletes
  const playsSnap = await getDocs(collection(db, 'games', gameId, 'plays'))
  await Promise.all(playsSnap.docs.map((d) => deleteDoc(d.ref)))
  await deleteDoc(doc(db, 'games', gameId))
}

export async function markGameFinal(gameId) {
  await updateDoc(doc(db, 'games', gameId), { status: 'final', endedAt: serverTimestamp() })
}

/**
 * Save a team's batting order to the game doc.
 * team: 'home' | 'away'
 * lineup: [{ playerId, playerName, playerNumber, position }]
 */
export async function saveLineup(gameId, team, lineup) {
  const field = team === 'home' ? 'homeLineup' : 'awayLineup'
  const idxField = team === 'home' ? 'homeBatterIdx' : 'awayBatterIdx'
  await updateDoc(doc(db, 'games', gameId), { [field]: lineup, [idxField]: 0 })
}

export async function getGameByJoinCode(joinCode) {
  const q = query(collection(db, 'games'), where('joinCode', '==', joinCode.toUpperCase()))
  const snap = await getDocs(q)
  if (snap.empty) return null
  const d = snap.docs[0]
  return { id: d.id, ...d.data() }
}

export async function getGame(gameId) {
  const snap = await getDoc(doc(db, 'games', gameId))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

export function subscribeToGame(gameId, onChange) {
  return onSnapshot(doc(db, 'games', gameId), (snap) => {
    if (snap.exists()) onChange({ id: snap.id, ...snap.data() })
  })
}

export function subscribeToClubGames(clubId, onChange) {
  const q = query(
    collection(db, 'games'),
    where('clubId', '==', clubId),
    orderBy('createdAt', 'desc'),
    limit(20)
  )
  return onSnapshot(q, (snap) => {
    onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  })
}

// Subscribes to ALL games for a club (home AND away via awayClubId)
export function subscribeToTeamGames(clubId, onChange) {
  let homeGames = []
  let awayGames = []
  function emit() {
    const map = new Map()
    for (const g of [...homeGames, ...awayGames]) map.set(g.id, g)
    const sorted = [...map.values()].sort(
      (a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
    )
    onChange(sorted.slice(0, 30))
  }
  const q1 = query(collection(db, 'games'), where('clubId', '==', clubId), orderBy('createdAt', 'desc'), limit(20))
  const q2 = query(collection(db, 'games'), where('awayClubId', '==', clubId), orderBy('createdAt', 'desc'), limit(20))
  const u1 = onSnapshot(q1, (snap) => { homeGames = snap.docs.map((d) => ({ id: d.id, ...d.data() })); emit() })
  const u2 = onSnapshot(q2, (snap) => { awayGames = snap.docs.map((d) => ({ id: d.id, ...d.data() })); emit() })
  return () => { u1(); u2() }
}

// ─── Plays ───────────────────────────────────────────────────────────────────

/**
 * Write a play event and atomically update the game score.
 * playEvent: { type, team, playerId, playerName, playerNumber, points, scoreDelta, clockAtPlay, period }
 * gameUpdate: optional extra fields to merge into the game doc (e.g. bases, batterIdx)
 */
export async function addPlay(gameId, playEvent, gameUpdate = {}) {
  const playsRef = collection(db, 'games', gameId, 'plays')
  const playRef = await addDoc(playsRef, {
    ...playEvent,
    undone: false,
    createdAt: serverTimestamp(),
  })

  // Update game score + track lastPlayId for undo + any extra fields
  const scoreUpdate = {
    lastPlayId: playRef.id,
    lastPlayUndone: false,
    ...gameUpdate,
  }
  if (playEvent.scoreDelta) {
    if (playEvent.scoreDelta.home) scoreUpdate.homeScore = increment(playEvent.scoreDelta.home)
    if (playEvent.scoreDelta.away) scoreUpdate.awayScore = increment(playEvent.scoreDelta.away)
  }
  await updateDoc(doc(db, 'games', gameId), scoreUpdate)

  return playRef.id
}

export async function undoPlay(gameId, playId, scoreDelta, outsToRevert = 0, gameRevert = {}) {
  // Soft-delete the play
  await updateDoc(doc(db, 'games', gameId, 'plays', playId), { undone: true })

  // Revert score, outs, bases, batterIdx, and clear lastPlayId
  const revert = {
    lastPlayId: null,
    lastPlayUndone: true,
    ...gameRevert,
  }
  if (scoreDelta) {
    if (scoreDelta.home) revert.homeScore = increment(-scoreDelta.home)
    if (scoreDelta.away) revert.awayScore = increment(-scoreDelta.away)
  }
  if (outsToRevert > 0) {
    revert.outs = increment(-outsToRevert)
  }
  await updateDoc(doc(db, 'games', gameId), revert)
}

export async function deletePlay(gameId, playId, scoreDelta) {
  await updateDoc(doc(db, 'games', gameId, 'plays', playId), { undone: true })
  const revert = {}
  if (scoreDelta) {
    if (scoreDelta.home) revert.homeScore = increment(-scoreDelta.home)
    if (scoreDelta.away) revert.awayScore = increment(-scoreDelta.away)
  }
  if (Object.keys(revert).length) {
    await updateDoc(doc(db, 'games', gameId), revert)
  }
}

export async function updateUserPlan(uid, plan) {
  await updateDoc(doc(db, 'users', uid), { plan })
}

export async function getUser(uid) {
  const snap = await getDoc(doc(db, 'users', uid))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

export function subscribeToPlays(gameId, onChange) {
  const q = query(
    collection(db, 'games', gameId, 'plays'),
    where('undone', '==', false),
    orderBy('createdAt', 'desc'),
    limit(50)
  )
  return onSnapshot(q, (snap) => {
    onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  })
}

export async function getGamePlays(gameId) {
  const q = query(
    collection(db, 'games', gameId, 'plays'),
    where('undone', '==', false),
    orderBy('createdAt', 'asc')
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export async function getLastPlay(gameId, lastPlayId) {
  if (!lastPlayId) return null
  const snap = await getDoc(doc(db, 'games', gameId, 'plays', lastPlayId))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

// ─── User (real-time) ────────────────────────────────────────────────────────

export function subscribeToUser(uid, onChange) {
  return onSnapshot(doc(db, 'users', uid), (snap) => {
    onChange(snap.exists() ? { id: snap.id, ...snap.data() } : null)
  })
}

// ─── Follow system ────────────────────────────────────────────────────────────

export async function followClub(uid, clubId) {
  await updateDoc(doc(db, 'users', uid), { followedClubs: arrayUnion(clubId) })
}

export async function unfollowClub(uid, clubId) {
  await updateDoc(doc(db, 'users', uid), { followedClubs: arrayRemove(clubId) })
}

export async function saveFcmToken(uid, token) {
  await updateDoc(doc(db, 'users', uid), { fcmTokens: arrayUnion(token) })
}

// ─── Discovery queries ────────────────────────────────────────────────────────

export function subscribeLiveGames(onChange) {
  const q = query(collection(db, 'games'), where('status', '==', 'live'), limit(10))
  return onSnapshot(q, (snap) => {
    onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  })
}

export function subscribeToFollowedGames(clubIds, onChange) {
  if (!clubIds || clubIds.length === 0) {
    onChange([])
    return () => {}
  }
  const q = query(
    collection(db, 'games'),
    where('clubId', 'in', clubIds.slice(0, 30)),
    orderBy('createdAt', 'desc'),
    limit(20)
  )
  return onSnapshot(q, (snap) => {
    onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  })
}

// Returns { w, l, str } win/loss record for a club across all final games
export async function getClubRecord(clubId) {
  const [homeSnap, awaySnap] = await Promise.all([
    getDocs(query(collection(db, 'games'), where('clubId', '==', clubId), limit(60))),
    getDocs(query(collection(db, 'games'), where('awayClubId', '==', clubId), limit(60))),
  ])
  let w = 0, l = 0
  homeSnap.docs.forEach((d) => {
    const g = d.data()
    if (g.status !== 'final') return
    if (g.homeScore > g.awayScore) w++
    else if (g.awayScore > g.homeScore) l++
  })
  awaySnap.docs.forEach((d) => {
    const g = d.data()
    if (g.status !== 'final') return
    if (g.awayScore > g.homeScore) w++
    else if (g.homeScore > g.awayScore) l++
  })
  return { w, l, str: `${w}-${l}` }
}

// Returns all non-undone plays for a player across all games (collectionGroup query)
export async function getPlayerHistoricalPlays(playerId) {
  const q = query(
    collectionGroup(db, 'plays'),
    where('playerId', '==', playerId),
    limit(200)
  )
  const snap = await getDocs(q)
  return snap.docs
    .filter((d) => d.data().undone !== true)
    .map((d) => ({
      id: d.id,
      gameId: d.ref.parent.parent.id,
      ...d.data(),
    }))
}
