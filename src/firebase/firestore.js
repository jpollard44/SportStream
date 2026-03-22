import {
  collection,
  collectionGroup,
  doc,
  setDoc,
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

export async function getPlayer(clubId, playerId) {
  const snap = await getDoc(doc(db, 'clubs', clubId, 'players', playerId))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

// followedPlayers on users/{uid}: array of {playerId, clubId, name, nickname, number, photoUrl, position, clubName, clubSport}
export async function followPlayer(uid, playerInfo) {
  const userRef = doc(db, 'users', uid)
  const snap = await getDoc(userRef)
  const current = snap.data()?.followedPlayers || []
  const filtered = current.filter((p) => p.playerId !== playerInfo.playerId)
  await updateDoc(userRef, { followedPlayers: [...filtered, playerInfo] })
}

export async function unfollowPlayer(uid, playerId) {
  const userRef = doc(db, 'users', uid)
  const snap = await getDoc(userRef)
  const current = snap.data()?.followedPlayers || []
  await updateDoc(userRef, { followedPlayers: current.filter((p) => p.playerId !== playerId) })
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
 * Create a pre-scheduled game stub (no scorekeeper session yet).
 * status: 'scheduled' — listed on ClubPage schedule section.
 */
export async function createScheduledGame(clubId, {
  homeTeam, awayTeam, sport,
  scheduledAt, venue, gameType,
  awayClubId,
}) {
  const ref = await addDoc(collection(db, 'games'), {
    clubId,
    sport:        sport || 'basketball',
    status:       'scheduled',
    homeTeam,
    awayTeam,
    homeScore:    0,
    awayScore:    0,
    scheduledAt:  scheduledAt || null,
    venue:        venue       || '',
    gameType:     gameType    || 'regular',
    awayClubId:   awayClubId  || null,
    joinCode:     null,
    scorekeeperId: null,
    // Baseball / basketball placeholders
    period: 1, totalPeriods: null, periodLength: null, clockElapsed: 0, clockRunning: false,
    inning: 1, inningHalf: 'top', outs: 0, totalInnings: null,
    bases: null, balls: null, strikes: null,
    homeLineup: [], awayLineup: [], homeBatterIdx: 0, awayBatterIdx: 0,
    tournamentId: null, bracketMatchId: null, leagueId: null,
    homeLeagueTeamId: null, awayLeagueTeamId: null,
    lastPlayId: null, lastPlayUndone: false, peerId: null,
    createdAt: serverTimestamp(), startedAt: null, endedAt: null,
  })
  return ref.id
}

/**
 * Subscribe to all scheduled (pre-game) stubs for a club, sorted by scheduledAt.
 */
export function subscribeToClubSchedule(clubId, onChange) {
  const q = query(
    collection(db, 'games'),
    where('clubId', '==', clubId),
    where('status', '==', 'scheduled'),
    orderBy('scheduledAt', 'asc')
  )
  return onSnapshot(q, (snap) => {
    onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  })
}

/**
 * Find a claimed player profile for the given uid.
 * Returns null or { clubId, playerId, ...playerData }
 */
export async function getClaimedPlayerProfile(uid) {
  if (!uid) return null
  const snap = await getDocs(
    query(
      collectionGroup(db, 'players'),
      where('uid', '==', uid),
      limit(1)
    )
  )
  if (snap.empty) return null
  const d = snap.docs[0]
  return {
    playerId: d.id,
    clubId:   d.ref.parent.parent.id,
    ...d.data(),
  }
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

// Returns all-time head-to-head record between two clubs
// { w1: wins for clubId1, w2: wins for clubId2, total }
export async function getHeadToHead(clubId1, clubId2) {
  if (!clubId1 || !clubId2) return { w1: 0, w2: 0, total: 0 }
  const [snap1, snap2] = await Promise.all([
    getDocs(query(collection(db, 'games'),
      where('clubId', '==', clubId1), where('awayClubId', '==', clubId2))),
    getDocs(query(collection(db, 'games'),
      where('clubId', '==', clubId2), where('awayClubId', '==', clubId1))),
  ])
  let w1 = 0, w2 = 0
  snap1.docs.forEach((d) => {
    const g = d.data()
    if (g.status !== 'final') return
    if (g.homeScore > g.awayScore) w1++
    else if (g.awayScore > g.homeScore) w2++
  })
  snap2.docs.forEach((d) => {
    const g = d.data()
    if (g.status !== 'final') return
    if (g.homeScore > g.awayScore) w2++
    else if (g.awayScore > g.homeScore) w1++
  })
  return { w1, w2, total: w1 + w2 }
}

// Returns last N final games for a club (home or away), most recent first
export async function getRecentResults(clubId, n = 3) {
  if (!clubId) return []
  const [homeSnap, awaySnap] = await Promise.all([
    getDocs(query(collection(db, 'games'), where('clubId', '==', clubId),
      where('status', '==', 'final'), orderBy('createdAt', 'desc'), limit(n))),
    getDocs(query(collection(db, 'games'), where('awayClubId', '==', clubId),
      where('status', '==', 'final'), orderBy('createdAt', 'desc'), limit(n))),
  ])
  const all = [
    ...homeSnap.docs.map((d) => {
      const g = d.data()
      return { date: g.createdAt?.toMillis?.() || 0, win: g.homeScore > g.awayScore }
    }),
    ...awaySnap.docs.map((d) => {
      const g = d.data()
      return { date: g.createdAt?.toMillis?.() || 0, win: g.awayScore > g.homeScore }
    }),
  ]
  return all.sort((a, b) => b.date - a.date).slice(0, n)
}

// ─── Player Invites ──────────────────────────────────────────────────────────

export async function createInvite(clubId, playerId, playerName, email) {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  const token = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
  await setDoc(doc(db, 'invites', token), {
    clubId, playerId, playerName, email,
    claimed: false, claimedBy: null,
    createdAt: serverTimestamp(),
  })
  return token
}

export async function getInvite(token) {
  const snap = await getDoc(doc(db, 'invites', token))
  return snap.exists() ? { token, ...snap.data() } : null
}

export async function claimInvite(token, uid) {
  const invite = await getInvite(token)
  if (!invite) throw new Error('Invite not found')
  if (invite.claimed) throw new Error('Invite already claimed')
  await updateDoc(doc(db, 'clubs', invite.clubId, 'players', invite.playerId), { uid })
  await updateDoc(doc(db, 'invites', token), { claimed: true, claimedBy: uid, claimedAt: serverTimestamp() })
  return invite
}

// ─── Views counter ────────────────────────────────────────────────────────────

export async function incrementGameViews(gameId) {
  await updateDoc(doc(db, 'games', gameId), { views: increment(1) })
}

// ─── Notification preferences ────────────────────────────────────────────────

export async function updateNotificationPrefs(uid, prefs) {
  await updateDoc(doc(db, 'users', uid), { notificationPrefs: prefs })
}

// ─── User profile update ──────────────────────────────────────────────────────

export async function updateUserProfile(uid, data) {
  await updateDoc(doc(db, 'users', uid), data)
}

// ─── Fan counts ───────────────────────────────────────────────────────────────

// Count users who follow a given club (reads up to 500 user docs)
export async function getClubFanCount(clubId) {
  const snap = await getDocs(
    query(collection(db, 'users'), where('followedClubs', 'array-contains', clubId), limit(500))
  )
  return snap.size
}

// ─── Opponent context for schedule builder ────────────────────────────────────

// Returns teams from active leagues & tournaments this club is enrolled in.
// Uses collectionGroup('teams') to find parent league/tournament IDs, then
// fetches sibling teams — so the club can quickly pick known opponents.
export async function getClubContextOpponents(clubId) {
  const teamSnap = await getDocs(
    query(collectionGroup(db, 'teams'), where('clubId', '==', clubId))
  )

  const leagueIds = new Set()
  const tourIds   = new Set()

  for (const d of teamSnap.docs) {
    // path: (leagues|tournaments)/{parentId}/teams/{teamId}
    const parentCollId = d.ref.parent.parent?.parent?.id  // 'leagues' or 'tournaments'
    const parentId     = d.ref.parent.parent?.id
    if (!parentId) continue
    if (parentCollId === 'leagues')     leagueIds.add(parentId)
    if (parentCollId === 'tournaments') tourIds.add(parentId)
  }

  const leagueOpponents      = []
  const tournamentOpponents  = []

  await Promise.all([
    ...Array.from(leagueIds).map(async (leagueId) => {
      const snap = await getDocs(collection(db, 'leagues', leagueId, 'teams'))
      snap.docs.forEach((t) => {
        const d = t.data()
        if (d.clubId !== clubId && d.status !== 'rejected') {
          leagueOpponents.push({ name: d.name, clubId: d.clubId || null })
        }
      })
    }),
    ...Array.from(tourIds).map(async (tourId) => {
      const snap = await getDocs(collection(db, 'tournaments', tourId, 'teams'))
      snap.docs.forEach((t) => {
        const d = t.data()
        if (d.clubId !== clubId && d.status !== 'rejected' && d.status !== 'withdrawn') {
          tournamentOpponents.push({ name: d.name, clubId: d.clubId || null })
        }
      })
    }),
  ])

  return { leagueOpponents, tournamentOpponents }
}

// ─── Fan activity feed ────────────────────────────────────────────────────────

const NOTABLE_TYPES = new Set([
  'home_run', 'triple', 'double', 'strikeout',
  'score_3', '3pt', 'goal', 'touchdown', 'ace', 'kill',
  'penalty_goal', 'field_goal',
])

// Fetch recent notable plays from a set of playerIds for the activity feed.
// Returns up to 20 plays sorted newest-first.
export async function getRecentPlaysForPlayers(playerIds) {
  if (!playerIds || !playerIds.length) return []
  const limited = [...new Set(playerIds)].slice(0, 10)
  const allPlays = []
  await Promise.all(
    limited.map(async (playerId) => {
      const q = query(collectionGroup(db, 'plays'), where('playerId', '==', playerId), limit(10))
      const snap = await getDocs(q)
      snap.docs
        .filter((d) => !d.data().undone && NOTABLE_TYPES.has(d.data().type))
        .forEach((d) =>
          allPlays.push({ id: d.id, gameId: d.ref.parent.parent.id, ...d.data() })
        )
    })
  )
  return allPlays
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
    .slice(0, 20)
}

// ─── Scheduled games ──────────────────────────────────────────────────────────

// ─── Top-level Player Profiles ────────────────────────────────────────────────

export async function getPlayerProfile(uid) {
  const snap = await getDoc(doc(db, 'players', uid))
  return snap.exists() ? { uid: snap.id, ...snap.data() } : null
}

export function subscribeToPlayerProfile(uid, callback) {
  return onSnapshot(doc(db, 'players', uid), (snap) => {
    callback(snap.exists() ? { uid: snap.id, ...snap.data() } : null)
  })
}

export async function updatePlayerProfile(uid, data) {
  const ref = doc(db, 'players', uid)
  const snap = await getDoc(ref)
  if (snap.exists()) {
    await updateDoc(ref, { ...data, updatedAt: serverTimestamp() })
  } else {
    await setDoc(ref, { uid, claimed: true, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), ...data })
  }
}

export async function getPlayerStats(uid, { sport, year, leagueId, tournamentId } = {}) {
  const constraints = []
  if (sport) constraints.push(where('sport', '==', sport))
  if (leagueId) constraints.push(where('leagueId', '==', leagueId))
  if (tournamentId) constraints.push(where('tournamentId', '==', tournamentId))
  if (year) {
    constraints.push(where('gameDate', '>=', `${year}-01-01`))
    constraints.push(where('gameDate', '<=', `${year}-12-31`))
  }
  const q = constraints.length
    ? query(collection(db, 'players', uid, 'stats'), ...constraints)
    : collection(db, 'players', uid, 'stats')
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export async function getPlayerClubMemberships(uid) {
  const snap = await getDocs(collection(db, 'players', uid, 'clubMemberships'))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export function subscribeToPlayerHighlights(uid, extraPlayerIds, callback) {
  // Query highlights by this player's uid. Also queries by any roster playerIds provided.
  const ids = [uid, ...extraPlayerIds].filter(Boolean)
  const q = query(
    collection(db, 'highlights'),
    where('playerId', 'in', ids.slice(0, 10)),
    orderBy('createdAt', 'desc'),
    limit(20)
  )
  return onSnapshot(q, (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
}

// Stat computation helpers (used by backfill and Cloud Function)
function computeBaseballStats(plays) {
  const AT_BAT = new Set(['single', 'double', 'triple', 'homeRun', 'strikeout', 'groundOut', 'flyOut', 'lineOut', 'sacrifice'])
  const HIT    = new Set(['single', 'double', 'triple', 'homeRun'])
  let ab = 0, h = 0, doubles = 0, triples = 0, hr = 0, rbi = 0, bb = 0, k = 0, sb = 0, runs = 0
  for (const play of plays) {
    if (AT_BAT.has(play.type)) ab++
    if (HIT.has(play.type)) h++
    if (play.type === 'double')   doubles++
    if (play.type === 'triple')   triples++
    if (play.type === 'homeRun')  hr++
    if (play.type === 'walk' || play.type === 'hitByPitch') bb++
    if (play.type === 'strikeout') k++
    if (play.type === 'stolenBase') sb++
    if (play.type === 'run') runs++
    if (play.points) rbi += play.points
  }
  return { atBats: ab, hits: h, doubles, triples, homeRuns: hr, runs, rbi, walks: bb, strikeouts: k, stolenBases: sb }
}

function computeBasketballStats(plays) {
  let pts = 0, reb = 0, ast = 0, stl = 0, blk = 0, tov = 0
  let fgA = 0, fgM = 0, threeA = 0, threeM = 0, ftA = 0, ftM = 0
  for (const play of plays) {
    if (play.type === 'score_2')       { pts += 2; fgM++; fgA++ }
    else if (play.type === 'score_3' || play.type === '3pt') { pts += 3; threeM++; threeA++; fgM++; fgA++ }
    else if (play.type === 'ft_made')  { pts += 1; ftM++; ftA++ }
    else if (play.type === 'ft_miss')  { ftA++ }
    else if (play.type === 'rebound')  reb++
    else if (play.type === 'assist')   ast++
    else if (play.type === 'steal')    stl++
    else if (play.type === 'block')    blk++
    else if (play.type === 'turnover') tov++
  }
  return { points: pts, rebounds: reb, assists: ast, steals: stl, blocks: blk, turnovers: tov, fgAttempts: fgA, fgMade: fgM, threeAttempts: threeA, threeMade: threeM, ftAttempts: ftA, ftMade: ftM }
}

export function computeStatDocFromPlays(plays, sport) {
  if (sport === 'baseball' || sport === 'softball') return computeBaseballStats(plays)
  if (sport === 'basketball') return computeBasketballStats(plays)
  return {}
}

// Backfill stat docs from historical plays for a newly claimed player.
// Called from InvitePage after claimInvite().
export async function backfillPlayerStats(uid, clubId, playerId) {
  const [clubSnap, playsSnap] = await Promise.all([
    getDoc(doc(db, 'clubs', clubId)),
    getDocs(query(collectionGroup(db, 'plays'), where('playerId', '==', playerId), limit(200))),
  ])
  if (!clubSnap.exists()) return
  const club = clubSnap.data()
  const sport    = club.sport || 'basketball'
  const clubName = club.name  || ''

  // Ensure club membership doc exists
  await setDoc(doc(db, 'players', uid, 'clubMemberships', clubId), {
    clubId, clubName, sport,
    jerseyNumber: '', position: '',
    joinedAt: serverTimestamp(), active: true,
  }, { merge: true })

  const plays = playsSnap.docs
    .filter((d) => d.data().undone !== true)
    .map((d) => ({ id: d.id, gameId: d.ref.parent.parent.id, ...d.data() }))
  if (plays.length === 0) return

  // Group by gameId
  const byGame = {}
  for (const play of plays) {
    if (!byGame[play.gameId]) byGame[play.gameId] = []
    byGame[play.gameId].push(play)
  }

  // Write one stat doc per game
  for (const [gameId, gamePlays] of Object.entries(byGame)) {
    const gameSnap = await getDoc(doc(db, 'games', gameId)).catch(() => null)
    if (!gameSnap?.exists()) continue
    const game = gameSnap.data()
    const gameDate = (game.endedAt?.toDate?.() || game.createdAt?.toDate?.() || new Date())
      .toISOString().split('T')[0]
    const isHome   = game.clubId === clubId
    const opponent = isHome ? (game.awayTeam || '') : (game.homeTeam || '')

    await setDoc(doc(db, 'players', uid, 'stats', `${gameId}_${clubId}`), {
      gameId, clubId, clubName,
      opponentName: opponent,
      opponentClubId: isHome ? (game.awayClubId || null) : (game.clubId || null),
      sport,
      leagueId:       game.leagueId      || null,
      leagueName:     null,
      tournamentId:   game.tournamentId  || null,
      tournamentName: null,
      season:         gameDate.split('-')[0],
      gameDate,
      ...computeStatDocFromPlays(gamePlays, sport),
    }, { merge: true })
  }
}

// ─── Historical plays (legacy — kept for backwards-compat PlayerPage) ─────────

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
