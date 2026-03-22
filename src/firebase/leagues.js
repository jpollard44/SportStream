import {
  collection,
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
} from 'firebase/firestore'
import { db } from './config'

function randomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

// ─── Leagues ─────────────────────────────────────────────────────────────────

export async function createLeague(hostId, { name, sport, description, season, location, maxTeams }) {
  const joinCode = randomCode()
  const ref = await addDoc(collection(db, 'leagues'), {
    name,
    nameLower: name.toLowerCase(),
    sport,
    hostId,
    description: description || '',
    season: season || '',
    location: location || '',
    maxTeams: maxTeams ? Number(maxTeams) : null,
    status: 'registration',
    joinCode,
    createdAt: serverTimestamp(),
  })
  return { id: ref.id, joinCode }
}

export async function getLeague(leagueId) {
  const snap = await getDoc(doc(db, 'leagues', leagueId))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

export async function updateLeague(leagueId, data) {
  await updateDoc(doc(db, 'leagues', leagueId), data)
}

export function subscribeToLeague(leagueId, onChange) {
  return onSnapshot(doc(db, 'leagues', leagueId), (snap) => {
    if (snap.exists()) onChange({ id: snap.id, ...snap.data() })
  })
}

export function subscribeToUserLeagues(hostId, onChange) {
  const q = query(
    collection(db, 'leagues'),
    where('hostId', '==', hostId),
    orderBy('createdAt', 'desc')
  )
  return onSnapshot(q, (snap) => {
    onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  })
}

export function subscribeToPublicLeagues(onChange) {
  const q = query(
    collection(db, 'leagues'),
    orderBy('createdAt', 'desc'),
    limit(30)
  )
  return onSnapshot(q, (snap) => {
    onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  })
}

export async function getLeagueByJoinCode(code) {
  const q = query(collection(db, 'leagues'), where('joinCode', '==', code.toUpperCase()))
  const snap = await getDocs(q)
  if (snap.empty) return null
  return { id: snap.docs[0].id, ...snap.docs[0].data() }
}

// ─── League teams ─────────────────────────────────────────────────────────────

export async function registerLeagueTeam(leagueId, { name, managerName, managerEmail, managerId, clubId, players }) {
  const ref = await addDoc(collection(db, 'leagues', leagueId, 'teams'), {
    name,
    managerName:  managerName || '',
    managerEmail: managerEmail || '',
    managerId:    managerId || null,
    clubId:       clubId || null,
    players:      players || [],
    status:       'pending',
    wins: 0, losses: 0, draws: 0,
    pointsFor: 0, pointsAgainst: 0,
    totalPaid: 0, fullyFunded: false,
    chipInCheckoutUrl: null,
    createdAt: serverTimestamp(),
  })
  return ref.id
}

export async function updateLeagueTeam(leagueId, teamId, data) {
  await updateDoc(doc(db, 'leagues', leagueId, 'teams', teamId), data)
}

export async function deleteLeagueTeam(leagueId, teamId) {
  await deleteDoc(doc(db, 'leagues', leagueId, 'teams', teamId))
}

export async function deleteLeague(leagueId) {
  // Delete all teams subcollection first, then the league doc
  const teamsSnap = await getDocs(collection(db, 'leagues', leagueId, 'teams'))
  await Promise.all(teamsSnap.docs.map((d) => deleteDoc(d.ref)))
  await deleteDoc(doc(db, 'leagues', leagueId))
}

export function subscribeToLeagueTeams(leagueId, onChange) {
  const q = query(collection(db, 'leagues', leagueId, 'teams'), orderBy('createdAt', 'asc'))
  return onSnapshot(q, (snap) => {
    onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  })
}

// ─── League games ─────────────────────────────────────────────────────────────

export function subscribeToLeagueGames(leagueId, onChange) {
  const q = query(
    collection(db, 'games'),
    where('leagueId', '==', leagueId),
    orderBy('createdAt', 'desc'),
    limit(50)
  )
  return onSnapshot(q, (snap) => {
    onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  })
}

// ─── Standings (computed client-side) ────────────────────────────────────────

export function computeLeagueStandings(teams, games) {
  const stats = {}
  for (const t of teams) {
    if (t.status !== 'accepted') continue
    stats[t.id] = { ...t, W: 0, L: 0, T: 0, pf: 0, pa: 0 }
  }
  for (const g of games) {
    if (g.status !== 'final') continue
    const hId = g.homeLeagueTeamId
    const aId = g.awayLeagueTeamId
    if (!hId || !aId) continue
    if (stats[hId]) {
      stats[hId].pf += g.homeScore || 0
      stats[hId].pa += g.awayScore || 0
      if (g.homeScore > g.awayScore) stats[hId].W++
      else if (g.awayScore > g.homeScore) stats[hId].L++
      else stats[hId].T++
    }
    if (stats[aId]) {
      stats[aId].pf += g.awayScore || 0
      stats[aId].pa += g.homeScore || 0
      if (g.awayScore > g.homeScore) stats[aId].W++
      else if (g.homeScore > g.awayScore) stats[aId].L++
      else stats[aId].T++
    }
  }
  return Object.values(stats).sort((a, b) => {
    const ptsA = a.W * 2 + a.T
    const ptsB = b.W * 2 + b.T
    if (ptsB !== ptsA) return ptsB - ptsA
    return (b.pf - b.pa) - (a.pf - a.pa)
  })
}
