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
    losersBracket: [],
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
  const teamsSnap = await getDocs(collection(db, 'tournaments', tourId, 'teams'))
  await Promise.all(teamsSnap.docs.map((d) => deleteDoc(d.ref)))
  await deleteDoc(doc(db, 'tournaments', tourId))
}

// ─── Teams (registrations) ────────────────────────────────────────────────────

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

export async function setTeamPoolUrl(tourId, teamId, url) {
  await updateDoc(doc(db, 'tournaments', tourId, 'teams', teamId), { chipInPoolUrl: url })
}

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

export async function acceptTeam(tourId, teamId) {
  await updateDoc(doc(db, 'tournaments', tourId, 'teams', teamId), { status: 'accepted' })
}

export async function rejectTeam(tourId, teamId) {
  await updateDoc(doc(db, 'tournaments', tourId, 'teams', teamId), { status: 'withdrawn' })
}

export async function setTeamSeed(tourId, teamId, seed) {
  await updateDoc(doc(db, 'tournaments', tourId, 'teams', teamId), { seed })
}

// ─── Bracket generation — Single Elimination ──────────────────────────────────

export function buildSingleEliminationBracket(teams) {
  if (teams.length < 2) return []

  const sorted = [...teams].sort((a, b) => {
    if (a.seed && b.seed) return a.seed - b.seed
    if (a.seed) return -1
    if (b.seed) return 1
    return 0
  })

  const rounds = Math.ceil(Math.log2(sorted.length))
  const slots  = Math.pow(2, rounds)

  const r1 = []
  for (let i = 0; i < slots / 2; i++) {
    const home = sorted[i]             || null
    const away = sorted[slots - 1 - i] || null
    r1.push({
      matchId:      `r1m${i + 1}`,
      bracket:      'winners',
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

  const all = [...r1]
  let prev = r1
  for (let r = 2; r <= rounds; r++) {
    const cur = []
    for (let i = 0; i < prev.length / 2; i++) {
      cur.push({
        matchId:      `r${r}m${i + 1}`,
        bracket:      'winners',
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

// ─── Bracket generation — Double Elimination ──────────────────────────────────

/**
 * Build a full double-elimination bracket.
 * Returns { bracket: [...winnersMatches, grandFinalMatch], losersBracket: [...losersMatches] }
 *
 * Winners bracket matchIds: wR{round}M{slot+1}
 * Losers bracket matchIds:  lR{lRound}M{slot+1}
 * Grand final matchId:      gf
 */
export function buildDoubleEliminationBracket(teams) {
  if (teams.length < 2) return { bracket: [], losersBracket: [] }

  const sorted = [...teams].sort((a, b) => {
    if (a.seed && b.seed) return a.seed - b.seed
    if (a.seed) return -1
    if (b.seed) return 1
    return 0
  })

  const rounds = Math.ceil(Math.log2(sorted.length))
  const slots  = Math.pow(2, rounds)  // total bracket slots (padded to power of 2)

  const wb = []  // winners bracket
  const lb = []  // losers bracket

  // ── Winners bracket R1 ───────────────────────────────────────────────────────
  const r1 = []
  const r1Count = slots / 2  // number of R1 matches
  const lR1Count = r1Count / 2  // number of L-R1 matches

  for (let i = 0; i < r1Count; i++) {
    const home = sorted[i]              || null
    const away = sorted[slots - 1 - i]  || null

    // Cross-pairing for losers: M[i] loser goes to lR1M[lR1Count-i] to avoid early rematch
    // First half (i < lR1Count): takes home slot in L-R1 match i+1
    // Second half (i >= lR1Count): takes away slot in L-R1 match (lR1Count - (i - lR1Count))
    let loserNextMatchId, loserNextSlot
    if (i < lR1Count) {
      loserNextMatchId = `lR1M${i + 1}`
      loserNextSlot    = 'home'
    } else {
      loserNextMatchId = `lR1M${r1Count - i}`
      loserNextSlot    = 'away'
    }

    const m = {
      matchId:         `wR1M${i + 1}`,
      bracket:         'winners',
      round:           1,
      slot:            i,
      homeTeamId:      home?.id   || null,
      homeTeamName:    home?.name || 'BYE',
      awayTeamId:      away?.id   || null,
      awayTeamName:    away?.name || 'BYE',
      gameId:          null,
      winnerId:        null,
      winnerName:      null,
      nextMatchId:     rounds > 1 ? `wR2M${Math.floor(i / 2) + 1}` : 'gf',
      nextSlot:        rounds > 1 ? (i % 2 === 0 ? 'home' : 'away') : 'home',
      loserNextMatchId,
      loserNextSlot,
    }
    r1.push(m)
  }
  wb.push(...r1)

  // ── Winners bracket R2+ ──────────────────────────────────────────────────────
  let prevW = r1
  for (let r = 2; r <= rounds; r++) {
    const cur = []
    const matchCount = prevW.length / 2

    for (let i = 0; i < matchCount; i++) {
      // W-Rr losers go to L-R(2r-2) — the cross round for that W round
      const lr = 2 * (r - 1)
      const lRounds = 2 * (rounds - 1)
      const isLFinal = lr === lRounds
      const loserNextMatchId = isLFinal ? `lR${lr}M1` : `lR${lr}M${i + 1}`
      const loserNextSlot    = 'away' // W losers always fill away slot in L cross rounds

      cur.push({
        matchId:         `wR${r}M${i + 1}`,
        bracket:         'winners',
        round:           r,
        slot:            i,
        homeTeamId:      null,
        homeTeamName:    'TBD',
        awayTeamId:      null,
        awayTeamName:    'TBD',
        gameId:          null,
        winnerId:        null,
        winnerName:      null,
        nextMatchId:     r < rounds ? `wR${r + 1}M${Math.floor(i / 2) + 1}` : 'gf',
        nextSlot:        r < rounds ? (i % 2 === 0 ? 'home' : 'away') : 'home',
        loserNextMatchId,
        loserNextSlot,
      })
    }
    wb.push(...cur)
    prevW = cur
  }

  // ── Grand final ───────────────────────────────────────────────────────────────
  const grandFinal = {
    matchId:      'gf',
    bracket:      'grandFinal',
    round:        rounds + 1,
    slot:         0,
    homeTeamId:   null,
    homeTeamName: 'W Bracket Champion',
    awayTeamId:   null,
    awayTeamName: 'L Bracket Champion',
    gameId:       null,
    winnerId:     null,
    winnerName:   null,
    nextMatchId:  null,
    nextSlot:     null,
  }

  // ── Losers bracket ────────────────────────────────────────────────────────────
  const lRounds = 2 * (rounds - 1)

  for (let lr = 1; lr <= lRounds; lr++) {
    // Match count for this L round: 2^(rounds - 1 - ceil(lr/2))
    const matchCount = Math.pow(2, rounds - 1 - Math.ceil(lr / 2))

    for (let i = 0; i < matchCount; i++) {
      let nextMatchId, nextSlot

      if (lr === lRounds) {
        // L-Final: winner goes to GF (away slot)
        nextMatchId = 'gf'
        nextSlot    = 'away'
      } else if (lr % 2 === 1) {
        // Odd L-round (internal or initial): same count going to next (cross) round
        nextMatchId = `lR${lr + 1}M${i + 1}`
        nextSlot    = 'home' // L survivors take home slot in cross rounds
      } else {
        // Even L-round (cross): count halves going to next (internal) round
        nextMatchId = `lR${lr + 1}M${Math.floor(i / 2) + 1}`
        nextSlot    = i % 2 === 0 ? 'home' : 'away'
      }

      lb.push({
        matchId:      `lR${lr}M${i + 1}`,
        bracket:      'losers',
        lRound:       lr,
        slot:         i,
        homeTeamId:   null,
        homeTeamName: 'TBD',
        awayTeamId:   null,
        awayTeamName: 'TBD',
        gameId:       null,
        winnerId:     null,
        winnerName:   null,
        nextMatchId,
        nextSlot,
      })
    }
  }

  // ── Auto-advance byes ─────────────────────────────────────────────────────────
  for (const match of r1) {
    const isBye = (match.homeTeamId && !match.awayTeamId) || (!match.homeTeamId && match.awayTeamId)
    if (isBye) {
      const winner = match.homeTeamId ? { id: match.homeTeamId, name: match.homeTeamName }
                                      : { id: match.awayTeamId, name: match.awayTeamName }
      match.winnerId   = winner.id
      match.winnerName = winner.name
      // Advance winner in W bracket
      const next = wb.find((m) => m.matchId === match.nextMatchId)
      if (next) {
        if (match.nextSlot === 'home') { next.homeTeamId = winner.id; next.homeTeamName = winner.name }
        else                           { next.awayTeamId = winner.id; next.awayTeamName = winner.name }
      }
      // No loser goes to L bracket for bye matches
      match.loserNextMatchId = null
    }
  }

  return { bracket: [...wb, grandFinal], losersBracket: lb }
}

// ─── Round-robin schedule ─────────────────────────────────────────────────────

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

// ─── Smart scheduling ─────────────────────────────────────────────────────────

/**
 * Auto-assign scheduledAt + field to a list of match groups (ordered by round).
 *
 * @param {Array<Array>} roundGroups  - Array of round arrays, each containing match objects
 * @param {Object} opts
 *   startDate      - ISO date string "YYYY-MM-DD"
 *   numFields      - number of concurrent courts/fields (1-4)
 *   gameDurationMin - game length in minutes
 *   firstGameTime  - "HH:MM" (24h) start of first game each day
 *   lastGameTime   - "HH:MM" (24h) last allowed game start each day
 *
 * Returns the same match objects with scheduledAt (ISO) and field ("Field N") set.
 */
export function buildSmartSchedule(roundGroups, opts) {
  const {
    startDate,
    numFields       = 1,
    gameDurationMin = 60,
    firstGameTime   = '09:00',
    lastGameTime    = '20:00',
  } = opts

  const [startY, startM, startD] = startDate.split('-').map(Number)
  const [firstH, firstMin] = firstGameTime.split(':').map(Number)
  const [lastH,  lastMin]  = lastGameTime.split(':').map(Number)

  const firstMinOfDay = firstH * 60 + firstMin
  const lastMinOfDay  = lastH  * 60 + lastMin

  // Current scheduling state
  let dayOffset   = 0   // days since startDate
  let slotMin     = firstMinOfDay  // minute-of-day for next game
  let fieldIndex  = 0   // 0-based field index within current time slot

  function getNextSlot() {
    // If we've filled all fields at this time slot, advance time
    if (fieldIndex >= numFields) {
      fieldIndex = 0
      slotMin   += gameDurationMin
      // If slot exceeds last allowed start time, move to next day
      if (slotMin > lastMinOfDay) {
        dayOffset++
        slotMin = firstMinOfDay
      }
    }

    const field = `Field ${fieldIndex + 1}`
    fieldIndex++

    // Build the ISO datetime
    const date = new Date(startY, startM - 1, startD + dayOffset)
    date.setHours(Math.floor(slotMin / 60), slotMin % 60, 0, 0)
    return { scheduledAt: date.toISOString(), field }
  }

  const result = []
  for (const group of roundGroups) {
    // Each match in a round can run concurrently (across fields)
    // but we schedule them sequentially across fields and time slots
    for (const match of group) {
      const { scheduledAt, field } = getNextSlot()
      result.push({ ...match, scheduledAt, field })
    }
    // After each round, advance to next time slot (teams need rest between rounds)
    // Move to next time block (after all matches in this round are placed)
    // fieldIndex might be mid-slot; advance to next full slot
    if (fieldIndex > 0 && fieldIndex < numFields) {
      fieldIndex = 0
      slotMin   += gameDurationMin
      if (slotMin > lastMinOfDay) {
        dayOffset++
        slotMin = firstMinOfDay
      }
    }
  }

  return result
}

// ─── Tournament games ─────────────────────────────────────────────────────────

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

// ─── Declare winner ───────────────────────────────────────────────────────────

/**
 * Declare the winner of any match type (winners bracket, losers bracket, grand final).
 * bracketType: 'winners' | 'losers' | 'grandFinal'
 *
 * For winners bracket: also places the loser in the appropriate losers bracket slot.
 * For losers bracket: advances winner to next L match (loser is eliminated).
 * For grandFinal: sets overall tournament champion.
 */
export async function declareMatchWinner(tourId, bracketMatchId, winnerId, winnerName, tournament, bracketType = 'winners') {
  const bracket      = [...(tournament.bracket || [])]
  const losersBracket = [...(tournament.losersBracket || [])]

  const isSE = tournament.format === 'single_elimination'
  const isRR = tournament.format === 'round_robin'
  const isDE = tournament.format === 'double_elimination'

  if (isRR) {
    const idx = bracket.findIndex((m) => m.matchId === bracketMatchId)
    if (idx === -1) return
    bracket[idx] = { ...bracket[idx], winnerId, winnerName }
    await updateDoc(doc(db, 'tournaments', tourId), { bracket })
    return
  }

  if (isSE) {
    const field = 'bracket'
    const matchup = [...(tournament[field] || [])]
    const idx = matchup.findIndex((m) => m.matchId === bracketMatchId)
    if (idx === -1) return
    matchup[idx] = { ...matchup[idx], winnerId, winnerName }
    advanceWinner(matchup, matchup[idx])
    await updateDoc(doc(db, 'tournaments', tourId), { [field]: matchup })
    return
  }

  if (isDE) {
    if (bracketType === 'grandFinal') {
      // Grand final — just record the winner
      const idx = bracket.findIndex((m) => m.matchId === 'gf')
      if (idx !== -1) {
        bracket[idx] = { ...bracket[idx], winnerId, winnerName }
      }
      await updateDoc(doc(db, 'tournaments', tourId), { bracket, losersBracket })
      return
    }

    if (bracketType === 'winners') {
      const matchIdx = bracket.findIndex((m) => m.matchId === bracketMatchId)
      if (matchIdx === -1) return

      const match   = { ...bracket[matchIdx], winnerId, winnerName }
      bracket[matchIdx] = match

      // Advance winner in W bracket (or GF)
      const loserId   = match.homeTeamId === winnerId ? match.awayTeamId   : match.homeTeamId
      const loserName = match.homeTeamId === winnerId ? match.awayTeamName : match.homeTeamName

      // Advance winner to next W bracket match or GF
      if (match.nextMatchId === 'gf') {
        const gfIdx = bracket.findIndex((m) => m.matchId === 'gf')
        if (gfIdx !== -1) {
          if (match.nextSlot === 'home') {
            bracket[gfIdx] = { ...bracket[gfIdx], homeTeamId: winnerId, homeTeamName: winnerName }
          } else {
            bracket[gfIdx] = { ...bracket[gfIdx], awayTeamId: winnerId, awayTeamName: winnerName }
          }
        }
      } else {
        const nextIdx = bracket.findIndex((m) => m.matchId === match.nextMatchId)
        if (nextIdx !== -1) {
          if (match.nextSlot === 'home') {
            bracket[nextIdx] = { ...bracket[nextIdx], homeTeamId: winnerId, homeTeamName: winnerName }
          } else {
            bracket[nextIdx] = { ...bracket[nextIdx], awayTeamId: winnerId, awayTeamName: winnerName }
          }
        }
      }

      // Place loser in losers bracket
      if (loserId && match.loserNextMatchId) {
        const lIdx = losersBracket.findIndex((m) => m.matchId === match.loserNextMatchId)
        if (lIdx !== -1) {
          if (match.loserNextSlot === 'home') {
            losersBracket[lIdx] = { ...losersBracket[lIdx], homeTeamId: loserId, homeTeamName: loserName }
          } else {
            losersBracket[lIdx] = { ...losersBracket[lIdx], awayTeamId: loserId, awayTeamName: loserName }
          }
        }
      }

      await updateDoc(doc(db, 'tournaments', tourId), { bracket, losersBracket })
      return
    }

    if (bracketType === 'losers') {
      const lIdx = losersBracket.findIndex((m) => m.matchId === bracketMatchId)
      if (lIdx === -1) return

      const match = { ...losersBracket[lIdx], winnerId, winnerName }
      losersBracket[lIdx] = match

      // Advance winner to next L match or GF
      if (match.nextMatchId === 'gf') {
        const gfIdx = bracket.findIndex((m) => m.matchId === 'gf')
        if (gfIdx !== -1) {
          if (match.nextSlot === 'home') {
            bracket[gfIdx] = { ...bracket[gfIdx], homeTeamId: winnerId, homeTeamName: winnerName }
          } else {
            bracket[gfIdx] = { ...bracket[gfIdx], awayTeamId: winnerId, awayTeamName: winnerName }
          }
        }
      } else {
        const nextIdx = losersBracket.findIndex((m) => m.matchId === match.nextMatchId)
        if (nextIdx !== -1) {
          if (match.nextSlot === 'home') {
            losersBracket[nextIdx] = { ...losersBracket[nextIdx], homeTeamId: winnerId, homeTeamName: winnerName }
          } else {
            losersBracket[nextIdx] = { ...losersBracket[nextIdx], awayTeamId: winnerId, awayTeamName: winnerName }
          }
        }
      }

      await updateDoc(doc(db, 'tournaments', tourId), { bracket, losersBracket })
      return
    }
  }
}

/**
 * Save a gameId back onto a bracket matchup (after scheduling the game).
 * bracketType: 'winners' | 'losers' | 'grandFinal' (for DE), or default for SE/RR
 */
export async function linkGameToMatchup(tourId, bracketMatchId, gameId, tournament, bracketType = 'winners') {
  const isRR = tournament.format === 'round_robin'
  const isDE = tournament.format === 'double_elimination'

  if (isRR) {
    const schedule = (tournament.schedule || []).map((m) =>
      m.matchId === bracketMatchId ? { ...m, gameId } : m
    )
    await updateDoc(doc(db, 'tournaments', tourId), { schedule })
    return
  }

  if (isDE && (bracketType === 'losers')) {
    const losersBracket = (tournament.losersBracket || []).map((m) =>
      m.matchId === bracketMatchId ? { ...m, gameId } : m
    )
    await updateDoc(doc(db, 'tournaments', tourId), { losersBracket })
    return
  }

  // Winners bracket (SE or DE) + GF
  const bracket = (tournament.bracket || []).map((m) =>
    m.matchId === bracketMatchId ? { ...m, gameId } : m
  )
  await updateDoc(doc(db, 'tournaments', tourId), { bracket })
}

// ─── Standings (round robin) ───────────────────────────────────────────────────

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
