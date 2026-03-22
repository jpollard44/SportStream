import {
  collection, doc, addDoc, updateDoc, deleteDoc, getDoc, getDocs,
  query, where, orderBy, onSnapshot, serverTimestamp, limit,
} from 'firebase/firestore'
import { db } from './config'

// ─── Join code ────────────────────────────────────────────────────────────────

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

async function generateTournamentCode() {
  for (let attempt = 0; attempt < 20; attempt++) {
    let code = ''
    for (let i = 0; i < 6; i++) code += CHARS[Math.floor(Math.random() * CHARS.length)]
    const q = query(collection(db, 'tournaments'), where('joinCode', '==', code))
    const snap = await getDocs(q)
    if (snap.empty) return code
  }
  throw new Error('Could not generate unique tournament code')
}

// ─── Tournaments ──────────────────────────────────────────────────────────────

export async function createTournament(hostId, {
  name, sport, format, maxTeams, location, startDate, description,
  feeEnabled, entryFee, maxPlayersPerTeam,
}) {
  const joinCode = await generateTournamentCode()
  const ref = await addDoc(collection(db, 'tournaments'), {
    name,
    sport: sport || 'basketball',
    hostId,
    format: format || 'single_elimination',
    status: 'registration',
    joinCode,
    maxTeams: maxTeams || 16,
    location: location || '',
    startDate: startDate || '',
    description: description || '',
    feeEnabled: !!feeEnabled,
    entryFee: feeEnabled ? (Number(entryFee) || 0) : 0,
    maxPlayersPerTeam: feeEnabled ? (Number(maxPlayersPerTeam) || 0) : 0,
    bracket: [],
    schedule: [],
    createdAt: serverTimestamp(),
  })
  return ref.id
}

export async function getTournament(tourId) {
  const snap = await getDoc(doc(db, 'tournaments', tourId))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

export function subscribeToTournament(tourId, onChange) {
  return onSnapshot(doc(db, 'tournaments', tourId), (snap) => {
    if (snap.exists()) onChange({ id: snap.id, ...snap.data() })
  })
}

export async function getTournamentByJoinCode(code) {
  const q = query(collection(db, 'tournaments'), where('joinCode', '==', code.toUpperCase()))
  const snap = await getDocs(q)
  if (snap.empty) return null
  return { id: snap.docs[0].id, ...snap.docs[0].data() }
}

export function subscribeToOpenTournaments(onChange) {
  const q = query(
    collection(db, 'tournaments'),
    where('status', 'in', ['registration', 'active']),
    orderBy('createdAt', 'desc'),
    limit(30)
  )
  return onSnapshot(q, (snap) => {
    onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  })
}

export function subscribeToUserTournaments(userId, onChange) {
  const q = query(
    collection(db, 'tournaments'),
    where('hostId', '==', userId),
    orderBy('createdAt', 'desc')
  )
  return onSnapshot(q, (snap) => {
    onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  })
}

export async function updateTournament(tourId, data) {
  await updateDoc(doc(db, 'tournaments', tourId), data)
}

export async function deleteTournament(tourId) {
  // Delete all teams subcollection first, then the tournament doc
  const teamsSnap = await getDocs(collection(db, 'tournaments', tourId, 'teams'))
  await Promise.all(teamsSnap.docs.map((d) => deleteDoc(d.ref)))
  await deleteDoc(doc(db, 'tournaments', tourId))
}

// ─── Teams (registrations) ────────────────────────────────────────────────────

/**
 * Team managers register their team for a tournament.
 * managerId is null when registering without auth.
 */
export async function registerTeam(tourId, { name, managerName, managerEmail, managerId, clubId, players }) {
  const ref = await addDoc(collection(db, 'tournaments', tourId, 'teams'), {
    name,
    managerName,
    managerEmail,
    managerId: managerId || null,
    clubId: clubId || null,
    seed: null,
    status: 'pending',
    players: players || [],
    totalPaid: 0,
    fullyFunded: false,
    chipInPoolUrl: null,
    wins: 0, losses: 0, draws: 0, runsFor: 0, runsAgainst: 0,
    createdAt: serverTimestamp(),
  })
  return ref.id
}

/** Mark a single player in a team as paid / unpaid (host only). */
export async function markPlayerPaid(tourId, teamId, playerId, paid = true) {
  const ref  = doc(db, 'tournaments', tourId, 'teams', teamId)
  const snap = await getDoc(ref)
  if (!snap.exists()) return
  const players = (snap.data().players || []).map((p) =>
    p.id === playerId ? { ...p, paid } : p
  )
  const paidCount   = players.filter((p) => p.paid).length
  const fullyFunded = players.length > 0 && paidCount === players.length
  await updateDoc(ref, { players, totalPaid: paidCount, fullyFunded })
}

/** Store a ChipInPool pool URL on a team doc. */
export async function setTeamPoolUrl(tourId, teamId, url) {
  await updateDoc(doc(db, 'tournaments', tourId, 'teams', teamId), { chipInPoolUrl: url })
}

/** Create a ChipInPool payment pool for a team's entry fee. */
const CREATE_POOL_URL = 'https://createtournamentpool-ciynfadanq-uc.a.run.app'
export async function createTeamPool(tourId, teamId, { tournamentName, teamName, entryFee }) {
  const resp = await fetch(CREATE_POOL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tourId, teamId, tournamentName, teamName, amount: entryFee }),
  })
  if (!resp.ok) throw new Error('Failed to create payment pool')
  const { url } = await resp.json()
  await setTeamPoolUrl(tourId, teamId, url)
  return url
}

export function subscribeToTournamentTeams(tourId, onChange) {
  const q = query(
    collection(db, 'tournaments', tourId, 'teams'),
    orderBy('createdAt', 'asc')
  )
  return onSnapshot(q, (snap) => {
    onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  })
}

export async function getTournamentTeams(tourId) {
  const q = query(
    collection(db, 'tournaments', tourId, 'teams'),
    orderBy('createdAt', 'asc')
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export async function updateTeam(tourId, teamId, data) {
  await updateDoc(doc(db, 'tournaments', tourId, 'teams', teamId), data)
}

export async function deleteTeam(tourId, teamId) {
  await deleteDoc(doc(db, 'tournaments', tourId, 'teams', teamId))
}

/**
 * Accept a team registration (host only).
 * Also re-numbers seeds to fill gaps.
 */
export async function acceptTeam(tourId, teamId) {
  await updateDoc(doc(db, 'tournaments', tourId, 'teams', teamId), {
    status: 'accepted',
  })
}

export async function rejectTeam(tourId, teamId) {
  await updateDoc(doc(db, 'tournaments', tourId, 'teams', teamId), {
    status: 'withdrawn',
  })
}

export async function setTeamSeed(tourId, teamId, seed) {
  await updateDoc(doc(db, 'tournaments', tourId, 'teams', teamId), { seed })
}

// ─── Bracket generation ───────────────────────────────────────────────────────

/**
 * Single-elimination bracket.
 * teams: accepted teams sorted by seed.
 * Returns a flat array of matchup objects covering all rounds.
 */
export function buildSingleEliminationBracket(teams) {
  if (teams.length < 2) return []

  const sorted = [...teams].sort((a, b) => {
    if (a.seed && b.seed) return a.seed - b.seed
    if (a.seed) return -1
    if (b.seed) return 1
    return 0
  })

  const rounds  = Math.ceil(Math.log2(sorted.length))
  const slots   = Math.pow(2, rounds)                    // total bracket slots

  // Round 1 — pair top seed vs bottom seed
  const r1 = []
  for (let i = 0; i < slots / 2; i++) {
    const home = sorted[i]             || null
    const away = sorted[slots - 1 - i] || null
    r1.push({
      matchId:      `r1m${i + 1}`,
      round:        1,
      slot:         i,
      homeTeamId:   home?.id   || null,
      homeTeamName: home?.name || 'BYE',
      awayTeamId:   away?.id   || null,
      awayTeamName: away?.name || 'BYE',
      gameId:       null,
      winnerId:     null,
      winnerName:   null,
      nextMatchId:  rounds > 1 ? `r2m${Math.floor(i / 2) + 1}` : null,
      nextSlot:     i % 2 === 0 ? 'home' : 'away',
    })
  }

  // Build subsequent rounds (initially empty TBD slots)
  const all = [...r1]
  let prev = r1
  for (let r = 2; r <= rounds; r++) {
    const cur = []
    for (let i = 0; i < prev.length / 2; i++) {
      cur.push({
        matchId:      `r${r}m${i + 1}`,
        round:        r,
        slot:         i,
        homeTeamId:   null,
        homeTeamName: 'TBD',
        awayTeamId:   null,
        awayTeamName: 'TBD',
        gameId:       null,
        winnerId:     null,
        winnerName:   null,
        nextMatchId:  r < rounds ? `r${r + 1}m${Math.floor(i / 2) + 1}` : null,
        nextSlot:     i % 2 === 0 ? 'home' : 'away',
      })
    }
    all.push(...cur)
    prev = cur
  }

  // Auto-advance byes (home present, away null → home wins automatically)
  for (const match of r1) {
    if (match.homeTeamId && !match.awayTeamId) {
      match.winnerId   = match.homeTeamId
      match.winnerName = match.homeTeamName
      advanceWinner(all, match)
    }
    if (!match.homeTeamId && match.awayTeamId) {
      match.winnerId   = match.awayTeamId
      match.winnerName = match.awayTeamName
      advanceWinner(all, match)
    }
  }

  return all
}

/** Advance a winner to the next match in the bracket. */
export function advanceWinner(bracket, match) {
  if (!match.nextMatchId || !match.winnerId) return
  const next = bracket.find((m) => m.matchId === match.nextMatchId)
  if (!next) return
  if (match.nextSlot === 'home') {
    next.homeTeamId   = match.winnerId
    next.homeTeamName = match.winnerName
  } else {
    next.awayTeamId   = match.winnerId
    next.awayTeamName = match.winnerName
  }
}

/**
 * Round-robin schedule — every team plays every other team once.
 */
export function buildRoundRobinSchedule(teams) {
  const matchups = []
  let id = 1
  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      matchups.push({
        matchId:      `rr${id++}`,
        round:        1,
        slot:         id,
        homeTeamId:   teams[i].id,
        homeTeamName: teams[i].name,
        awayTeamId:   teams[j].id,
        awayTeamName: teams[j].name,
        gameId:       null,
        winnerId:     null,
        winnerName:   null,
        nextMatchId:  null,
        nextSlot:     null,
      })
    }
  }
  return matchups
}

// ─── Tournament games ─────────────────────────────────────────────────────────

/**
 * Subscribe to games that belong to a tournament.
 */
export function subscribeToTournamentGames(tourId, onChange) {
  const q = query(
    collection(db, 'games'),
    where('tournamentId', '==', tourId),
    orderBy('createdAt', 'desc')
  )
  return onSnapshot(q, (snap) => {
    onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  })
}

/**
 * Declare the winner of a matchup and advance them to the next round.
 * Saves updated bracket to Firestore.
 */
export async function declareMatchWinner(tourId, bracketMatchId, winnerId, winnerName, tournament) {
  const field   = tournament.format === 'round_robin' ? 'schedule' : 'bracket'
  const bracket = [...(tournament[field] || [])]

  const matchIdx = bracket.findIndex((m) => m.matchId === bracketMatchId)
  if (matchIdx === -1) return

  bracket[matchIdx] = { ...bracket[matchIdx], winnerId, winnerName }

  // Advance winner in bracket
  advanceWinner(bracket, bracket[matchIdx])

  await updateDoc(doc(db, 'tournaments', tourId), { [field]: bracket })
}

/**
 * Save a gameId back onto a bracket matchup (after scheduling the game).
 */
export async function linkGameToMatchup(tourId, bracketMatchId, gameId, tournament) {
  const field   = tournament.format === 'round_robin' ? 'schedule' : 'bracket'
  const bracket = (tournament[field] || []).map((m) =>
    m.matchId === bracketMatchId ? { ...m, gameId } : m
  )
  await updateDoc(doc(db, 'tournaments', tourId), { [field]: bracket })
}

/**
 * Compute round-robin standings from bracket + teams.
 */
export function computeStandings(schedule, teams) {
  const stats = {}
  for (const t of teams) {
    stats[t.id] = { teamId: t.id, name: t.name, w: 0, l: 0, d: 0, pts: 0 }
  }
  for (const match of schedule) {
    if (!match.winnerId) continue
    const loserId = match.winnerId === match.homeTeamId ? match.awayTeamId : match.homeTeamId
    if (stats[match.winnerId]) { stats[match.winnerId].w++; stats[match.winnerId].pts += 2 }
    if (loserId && stats[loserId]) { stats[loserId].l++ }
  }
  return Object.values(stats).sort((a, b) => b.pts - a.pts || b.w - a.w)
}
