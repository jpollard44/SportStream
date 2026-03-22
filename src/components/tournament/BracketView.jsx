import { useState } from 'react'
import { Link } from 'react-router-dom'
import { computeStandings } from '../../firebase/tournaments'

function fmtDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

// Compact version for small bracket cards (e.g. "Sat 3/22 · 10:00 AM")
function fmtDateCompact(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export default function BracketView({ tournament, teams, isHost, onSchedule, onDeclare, onEdit }) {
  const isSE = tournament.format === 'single_elimination'
  const isRR = tournament.format === 'round_robin'
  const isDE = tournament.format === 'double_elimination'

  const wMatchups = tournament.bracket || []
  const lMatchups = tournament.losersBracket || []

  if (isSE && wMatchups.length === 0) {
    return <EmptyBracket isHost={isHost} />
  }
  if (isRR && (tournament.schedule || []).length === 0) {
    return <EmptyBracket isHost={isHost} />
  }
  if (isDE && wMatchups.length === 0) {
    return <EmptyBracket isHost={isHost} />
  }

  if (isSE) return (
    <SingleEliminationBracket
      matchups={wMatchups}
      isHost={isHost}
      onSchedule={onSchedule}
      onDeclare={(match) => onDeclare(match, 'winners')}
      onEdit={onEdit}
    />
  )
  if (isRR) return (
    <RoundRobinSchedule
      matchups={tournament.schedule || []}
      teams={teams}
      isHost={isHost}
      onSchedule={onSchedule}
      onDeclare={(match) => onDeclare(match, 'winners')}
      onEdit={onEdit}
    />
  )
  if (isDE) return (
    <DoubleEliminationBracket
      winnersBracket={wMatchups}
      losersBracket={lMatchups}
      isHost={isHost}
      onSchedule={onSchedule}
      onDeclare={onDeclare}
      onEdit={onEdit}
    />
  )
  return null
}

function EmptyBracket({ isHost }) {
  return (
    <div className="px-5 py-16 text-center">
      <p className="text-sm text-gray-400">
        {isHost
          ? 'Accept teams and click "Generate Bracket / Schedule" to start.'
          : 'The bracket has not been generated yet.'}
      </p>
    </div>
  )
}

// ── Layout constants ───────────────────────────────────────────────────────────

const CARD_W    = 168
const CARD_H    = 56
const GAP_W     = 48
const SLOT_BASE = 96

function roundLabel(r, total) {
  if (r === total) return 'Final'
  if (r === total - 1 && total > 1) return 'Semis'
  if (r === total - 2 && total > 2) return 'Quarters'
  return `Round ${r}`
}

// ── Single-elimination bracket ─────────────────────────────────────────────────

function SingleEliminationBracket({ matchups, isHost, onSchedule, onDeclare, onEdit }) {
  const rounds      = [...new Set(matchups.map((m) => m.round))].sort((a, b) => a - b)
  const totalRounds = rounds.length
  const r1Count     = matchups.filter((m) => m.round === 1).length
  const totalH      = r1Count * SLOT_BASE

  const pos = {}
  matchups.forEach((m) => {
    const slotH = SLOT_BASE * Math.pow(2, m.round - 1)
    pos[m.matchId] = {
      lx: (m.round - 1) * (CARD_W + GAP_W),
      rx: (m.round - 1) * (CARD_W + GAP_W) + CARD_W,
      cy: m.slot * slotH + slotH / 2,
    }
  })

  const champStubW = 56
  const totalW = totalRounds * (CARD_W + GAP_W) - GAP_W + champStubW

  const childMap = {}
  matchups.forEach((m) => {
    if (!m.nextMatchId) return
    if (!childMap[m.nextMatchId]) childMap[m.nextMatchId] = []
    childMap[m.nextMatchId].push(m.matchId)
  })

  const paths = []
  Object.entries(childMap).forEach(([parentId, childIds]) => {
    const parent   = pos[parentId]
    const children = childIds.map((id) => pos[id]).filter(Boolean)
    if (!parent || !children.length) return
    const midX = parent.lx - GAP_W / 2
    const ys   = children.map((c) => c.cy)
    children.forEach((c) => paths.push(`M ${c.rx} ${c.cy} H ${midX}`))
    if (ys.length > 1) paths.push(`M ${midX} ${Math.min(...ys)} V ${Math.max(...ys)}`)
    paths.push(`M ${midX} ${parent.cy} H ${parent.lx}`)
  })

  const finalMatch = matchups.find((m) => !m.nextMatchId)
  const hasChamp   = finalMatch && !!finalMatch.winnerId

  return (
    <div className="overflow-x-auto py-6 px-4">
      <div style={{ minWidth: totalW }}>
        <div className="mb-4 flex items-end">
          {rounds.map((r, ri) => (
            <div
              key={r}
              style={{ width: CARD_W + (ri < totalRounds - 1 ? GAP_W : 0), flexShrink: 0 }}
            >
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                {roundLabel(r, totalRounds)}
              </span>
            </div>
          ))}
          <div style={{ width: champStubW, flexShrink: 0, paddingLeft: 12 }}>
            <span className="text-[10px] font-bold uppercase tracking-widest text-yellow-600/80">🏆</span>
          </div>
        </div>
        <div className="relative" style={{ height: totalH, width: totalW }}>
          <svg className="pointer-events-none absolute inset-0" width={totalW} height={totalH} overflow="visible">
            {paths.map((d, i) => (
              <path key={i} d={d} fill="none" stroke="#374151" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
            ))}
            {finalMatch && pos[finalMatch.matchId] && (
              <path
                d={`M ${pos[finalMatch.matchId].rx} ${pos[finalMatch.matchId].cy} h 20`}
                fill="none" stroke={hasChamp ? '#CA8A04' : '#374151'} strokeWidth={1.5} strokeLinecap="round"
              />
            )}
          </svg>
          {matchups.map((m) => {
            const { lx, cy } = pos[m.matchId]
            return (
              <div key={m.matchId} style={{ position: 'absolute', left: lx, top: cy - CARD_H / 2, width: CARD_W, zIndex: 1 }}>
                <BracketCard match={m} isHost={isHost} onSchedule={onSchedule} onDeclare={onDeclare} onEdit={onEdit} />
              </div>
            )
          })}
          {hasChamp && finalMatch && pos[finalMatch.matchId] && (
            <div
              style={{ position: 'absolute', left: pos[finalMatch.matchId].rx + 24, top: pos[finalMatch.matchId].cy - 20, zIndex: 1 }}
              className="flex flex-col items-center"
            >
              <span className="text-2xl leading-none">🏆</span>
              <span className="mt-1 max-w-[80px] truncate text-center text-[10px] font-bold text-yellow-400 leading-tight">
                {finalMatch.winnerName}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Double-elimination bracket ─────────────────────────────────────────────────

function DoubleEliminationBracket({ winnersBracket, losersBracket, isHost, onSchedule, onDeclare, onEdit }) {
  const [deTab, setDeTab] = useState('winners')

  const wMatches = winnersBracket.filter((m) => m.bracket !== 'grandFinal')
  const gfMatch  = winnersBracket.find((m) => m.matchId === 'gf')

  return (
    <div>
      {/* Sub-tab bar */}
      <div className="flex gap-1 border-b border-gray-800 px-4 bg-gray-900/50">
        {[
          { id: 'winners', label: 'Winners Bracket' },
          { id: 'losers',  label: 'Losers Bracket' },
          { id: 'grand',   label: 'Grand Final' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setDeTab(t.id)}
            className={`relative py-2.5 px-3 text-xs font-semibold transition ${
              deTab === t.id ? 'text-white' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {t.label}
            {deTab === t.id && <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-blue-500" />}
          </button>
        ))}
      </div>

      {deTab === 'winners' && (
        <div>
          <p className="px-5 pt-3 text-[10px] font-bold uppercase tracking-wider text-green-600">Winners Bracket</p>
          <SEBracketCanvas
            matchups={wMatches}
            isHost={isHost}
            onSchedule={onSchedule}
            onDeclare={(match) => onDeclare(match, 'winners')}
            onEdit={onEdit}
          />
        </div>
      )}

      {deTab === 'losers' && (
        <div>
          <p className="px-5 pt-3 text-[10px] font-bold uppercase tracking-wider text-orange-600">Losers Bracket</p>
          {losersBracket.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm text-gray-500">Losers bracket populates as games are played.</p>
            </div>
          ) : (
            <LosersScheduleList
              matchups={losersBracket}
              isHost={isHost}
              onSchedule={onSchedule}
              onDeclare={(match) => onDeclare(match, 'losers')}
              onEdit={onEdit}
            />
          )}
        </div>
      )}

      {deTab === 'grand' && (
        <div className="px-5 py-6">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-yellow-600">Grand Final</p>
          {gfMatch ? (
            <MatchupCard
              match={gfMatch}
              isHost={isHost}
              onSchedule={onSchedule}
              onDeclare={(match) => onDeclare(match, 'grandFinal')}
              onEdit={onEdit}
            />
          ) : (
            <p className="text-sm text-gray-500">Grand final will appear here after both brackets complete.</p>
          )}
          {gfMatch?.winnerId && (
            <div className="mt-6 rounded-2xl border border-yellow-700/50 bg-yellow-900/20 p-5 text-center">
              <p className="text-3xl mb-2">🏆</p>
              <p className="text-sm text-yellow-400 font-bold uppercase tracking-wider">Tournament Champion</p>
              <p className="text-xl font-extrabold text-white mt-1">{gfMatch.winnerName}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Shared SE canvas (reused by both SE and winners bracket in DE) ──────────────

function SEBracketCanvas({ matchups, isHost, onSchedule, onDeclare, onEdit }) {
  if (!matchups.length) return null
  const rounds      = [...new Set(matchups.map((m) => m.round))].sort((a, b) => a - b)
  const totalRounds = rounds.length
  const r1Count     = matchups.filter((m) => m.round === rounds[0]).length
  const totalH      = r1Count * SLOT_BASE

  const pos = {}
  matchups.forEach((m) => {
    const roundIdx = rounds.indexOf(m.round)
    const slotH    = SLOT_BASE * Math.pow(2, roundIdx)
    pos[m.matchId] = {
      lx: roundIdx * (CARD_W + GAP_W),
      rx: roundIdx * (CARD_W + GAP_W) + CARD_W,
      cy: m.slot * slotH + slotH / 2,
    }
  })

  const champStubW = 24
  const totalW = totalRounds * (CARD_W + GAP_W) - GAP_W + champStubW

  const childMap = {}
  matchups.forEach((m) => {
    const nextId = m.nextMatchId
    if (!nextId || nextId === 'gf') return
    if (!childMap[nextId]) childMap[nextId] = []
    childMap[nextId].push(m.matchId)
  })

  const paths = []
  Object.entries(childMap).forEach(([parentId, childIds]) => {
    const parent   = pos[parentId]
    const children = childIds.map((id) => pos[id]).filter(Boolean)
    if (!parent || !children.length) return
    const midX = parent.lx - GAP_W / 2
    const ys   = children.map((c) => c.cy)
    children.forEach((c) => paths.push(`M ${c.rx} ${c.cy} H ${midX}`))
    if (ys.length > 1) paths.push(`M ${midX} ${Math.min(...ys)} V ${Math.max(...ys)}`)
    paths.push(`M ${midX} ${parent.cy} H ${parent.lx}`)
  })

  return (
    <div className="overflow-x-auto py-4 px-4">
      <div style={{ minWidth: totalW }}>
        <div className="mb-3 flex items-end">
          {rounds.map((r, ri) => (
            <div key={r} style={{ width: CARD_W + (ri < totalRounds - 1 ? GAP_W : 0), flexShrink: 0 }}>
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                Round {ri + 1}{ri === totalRounds - 1 ? ' (W Final)' : ''}
              </span>
            </div>
          ))}
        </div>
        <div className="relative" style={{ height: totalH, width: totalW }}>
          <svg className="pointer-events-none absolute inset-0" width={totalW} height={totalH} overflow="visible">
            {paths.map((d, i) => (
              <path key={i} d={d} fill="none" stroke="#374151" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
            ))}
          </svg>
          {matchups.map((m) => {
            const p = pos[m.matchId]
            if (!p) return null
            return (
              <div key={m.matchId} style={{ position: 'absolute', left: p.lx, top: p.cy - CARD_H / 2, width: CARD_W, zIndex: 1 }}>
                <BracketCard match={m} isHost={isHost} onSchedule={onSchedule} onDeclare={onDeclare} onEdit={onEdit} />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Losers bracket — list view (grouped by L round) ───────────────────────────

function LosersScheduleList({ matchups, isHost, onSchedule, onDeclare, onEdit }) {
  const lRounds = [...new Set(matchups.map((m) => m.lRound))].sort((a, b) => a - b)
  return (
    <div className="space-y-5 px-4 py-3">
      {lRounds.map((lr) => {
        const matches = matchups.filter((m) => m.lRound === lr)
        const total   = Math.max(...matchups.map((m) => m.lRound))
        const label   = lr === total ? 'L Bracket Final' : `L Round ${lr}`
        return (
          <div key={lr}>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-500">{label}</p>
            <div className="flex flex-col gap-2">
              {matches.map((match) => (
                <MatchupCard
                  key={match.matchId}
                  match={match}
                  isHost={isHost}
                  onSchedule={onSchedule}
                  onDeclare={onDeclare}
                  onEdit={onEdit}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Bracket card (winners bracket) ────────────────────────────────────────────

function BracketCard({ match, isHost, onSchedule, onDeclare, onEdit }) {
  const [expanded, setExpanded] = useState(false)

  const homeWon     = match.winnerId === match.homeTeamId
  const awayWon     = match.winnerId === match.awayTeamId
  const homeBye     = !match.homeTeamId && match.homeTeamName !== 'TBD'
  const awayBye     = !match.awayTeamId && match.awayTeamName !== 'TBD'
  const canSchedule = !match.gameId && match.homeTeamId && match.awayTeamId
  const canDeclare  = match.homeTeamId && match.awayTeamId && !match.winnerId

  return (
    <div>
      <div
        onClick={() => isHost && setExpanded((v) => !v)}
        style={{ height: CARD_H }}
        className={`overflow-hidden rounded-lg border ${
          match.winnerId ? 'border-green-800/60' : 'border-gray-700'
        } ${isHost ? 'cursor-pointer hover:border-gray-500 transition-colors' : ''}`}
      >
        <div className={`flex h-1/2 items-center gap-1.5 border-b border-gray-700/60 px-2.5 ${homeWon ? 'bg-green-900/20' : 'bg-gray-900'}`}>
          <span className={`flex-1 truncate text-[11px] font-semibold leading-none ${
            homeWon ? 'text-green-400' : homeBye ? 'italic text-gray-600' : match.homeTeamId ? 'text-white' : 'text-gray-500'
          }`}>
            {match.homeTeamName || 'TBD'}
          </span>
          {homeWon && <span className="shrink-0 text-[8px] font-black tracking-widest text-green-500">W</span>}
        </div>
        <div className={`flex h-1/2 items-center gap-1.5 px-2.5 ${awayWon ? 'bg-green-900/20' : 'bg-gray-900'}`}>
          <span className={`flex-1 truncate text-[11px] font-semibold leading-none ${
            awayWon ? 'text-green-400' : awayBye ? 'italic text-gray-600' : match.awayTeamId ? 'text-white' : 'text-gray-500'
          }`}>
            {match.awayTeamName || 'TBD'}
          </span>
          {awayWon && <span className="shrink-0 text-[8px] font-black tracking-widest text-green-500">W</span>}
        </div>
      </div>

      {!expanded && (
        <div className="mt-0.5 space-y-px px-0.5">
          {match.field && (
            <p className="truncate text-[9px] font-semibold leading-tight text-blue-400/70">
              Field {match.field}
            </p>
          )}
          {match.scheduledAt ? (
            <p className="truncate text-[9px] leading-tight text-gray-600">
              {fmtDateCompact(match.scheduledAt)}
            </p>
          ) : !match.field && (
            <p className="text-[9px] leading-tight text-gray-700">TBD</p>
          )}
        </div>
      )}

      {expanded && isHost && (
        <div className="mt-1 flex flex-wrap gap-1">
          {match.gameId && (
            <Link to={`/game/${match.gameId}`}
              className="rounded bg-gray-800 px-2 py-0.5 text-[10px] font-semibold text-blue-400 hover:bg-gray-700">
              View →
            </Link>
          )}
          {canSchedule && (
            <button
              onClick={(e) => { e.stopPropagation(); onSchedule(match); setExpanded(false) }}
              className="rounded bg-blue-700 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-blue-600"
            >
              + Game
            </button>
          )}
          {canDeclare && (
            <button
              onClick={(e) => { e.stopPropagation(); onDeclare(match); setExpanded(false) }}
              className="rounded bg-gray-700 px-2 py-0.5 text-[10px] font-semibold text-gray-200 hover:bg-gray-600"
            >
              Winner
            </button>
          )}
          {onEdit && (
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(match); setExpanded(false) }}
              className="rounded bg-gray-800 px-2 py-0.5 text-[10px] text-gray-500 hover:text-white"
            >
              ✎
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded(false) }}
            className="rounded bg-gray-800 px-2 py-0.5 text-[10px] text-gray-600 hover:text-gray-400"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  )
}

// ── Round-robin / losers bracket matchup card ──────────────────────────────────

function MatchupCard({ match, isHost, onSchedule, onDeclare, onEdit }) {
  const hasWinner   = !!match.winnerId
  const hasGame     = !!match.gameId
  const canSchedule = !hasGame && match.homeTeamId && match.awayTeamId
  const canDeclare  = match.homeTeamId && match.awayTeamId && !hasWinner

  const homeTbd = !match.homeTeamId
  const awayTbd = !match.awayTeamId

  return (
    <div className={`rounded-xl border p-3 ${
      hasWinner ? 'border-green-800 bg-green-900/20' : 'border-gray-800 bg-gray-900'
    }`}>
      <div className="flex items-center gap-2">
        <p className={`flex-1 truncate text-sm font-semibold ${
          match.winnerId === match.homeTeamId ? 'text-green-400' : homeTbd ? 'text-gray-600 italic' : 'text-white'
        }`}>
          {match.homeTeamName || 'TBD'}
        </p>
        <span className="shrink-0 text-[10px] font-bold text-gray-600">VS</span>
        <p className={`flex-1 truncate text-right text-sm font-semibold ${
          match.winnerId === match.awayTeamId ? 'text-green-400' : awayTbd ? 'text-gray-600 italic' : 'text-white'
        }`}>
          {match.awayTeamName || 'TBD'}
        </p>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
        {match.field && (
          <span className="text-[10px] font-semibold text-blue-400/70">Field {match.field}</span>
        )}
        {match.scheduledAt ? (
          <span className="text-[10px] text-gray-500">{fmtDate(match.scheduledAt)}</span>
        ) : !match.field && (
          <span className="text-[10px] text-gray-700">TBD</span>
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {hasGame && (
          <Link to={`/game/${match.gameId}`}
            className="rounded-lg bg-gray-800 px-3 py-1 text-[11px] font-semibold text-blue-400 hover:bg-gray-700">
            View Game →
          </Link>
        )}
        {isHost && canSchedule && (
          <button onClick={() => onSchedule(match)}
            className="rounded-lg bg-blue-700 px-3 py-1 text-[11px] font-semibold text-white hover:bg-blue-600">
            + Schedule
          </button>
        )}
        {isHost && canDeclare && (
          <button onClick={() => onDeclare(match)}
            className="rounded-lg bg-gray-700 px-3 py-1 text-[11px] font-semibold text-gray-200 hover:bg-gray-600">
            Declare Winner
          </button>
        )}
        {isHost && onEdit && (
          <button onClick={() => onEdit(match)}
            className="rounded-lg bg-gray-800 px-3 py-1 text-[11px] text-gray-500 hover:text-white">
            ✎ Edit
          </button>
        )}
      </div>
    </div>
  )
}

// ── Round-robin schedule ───────────────────────────────────────────────────────

function RoundRobinSchedule({ matchups, teams, isHost, onSchedule, onDeclare, onEdit }) {
  const standings = computeStandings(matchups, teams)
  const rounds = [...new Set(matchups.map((m) => m.round))].sort((a, b) => a - b)

  return (
    <div className="space-y-6 px-4 py-4">
      {standings.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-500">Standings</p>
          <div className="overflow-x-auto rounded-2xl bg-gray-900">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-800 text-gray-500">
                  <th className="px-4 py-2 text-left">#</th>
                  <th className="px-2 py-2 text-left">Team</th>
                  <th className="px-2 py-2">W</th>
                  <th className="px-2 py-2">L</th>
                  <th className="px-2 py-2">Pts</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((row, i) => (
                  <tr key={row.teamId} className="border-t border-gray-800 text-white">
                    <td className="px-4 py-2 font-bold text-gray-400">{i + 1}</td>
                    <td className="px-2 py-2 font-semibold">{row.name}</td>
                    <td className="px-2 py-2 text-center font-bold text-green-400">{row.w}</td>
                    <td className="px-2 py-2 text-center text-red-400">{row.l}</td>
                    <td className="px-2 py-2 text-center font-bold">{row.pts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {rounds.map((r) => {
        const rMatchups = matchups.filter((m) => m.round === r)
        return (
          <div key={r}>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-500">
              {rounds.length > 1 ? `Round ${r}` : 'Schedule'}
            </p>
            <div className="flex flex-col gap-2">
              {rMatchups.map((match) => (
                <MatchupCard
                  key={match.matchId}
                  match={match}
                  isHost={isHost}
                  onSchedule={onSchedule}
                  onDeclare={onDeclare}
                  onEdit={onEdit}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
