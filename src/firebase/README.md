# Firebase Layer

This directory contains all Firebase client SDK helpers used by the frontend.

---

## Files

| File | Purpose |
|---|---|
| `config.js` | Initializes Firebase app; exports `auth`, `db` (Firestore), `storage` |
| `auth.js` | Email/password + Google sign-in helpers |
| `firestore.js` | All Firestore CRUD operations and real-time subscriptions |
| `storage.js` | Firebase Storage upload helpers (logos, player photos, cover photos) |
| `leagues.js` | League CRUD, team registration, standings computation |
| `tournaments.js` | Tournament CRUD, team registration, bracket generation |
| `chipinpool.js` | Callable wrapper for the `createTournamentPool` Cloud Function |

---

## Firestore Schema

### `users/{uid}`
```
displayName: string
email: string
createdAt: Timestamp
followedClubs: string[]      // array of clubIds
fcmTokens: string[]          // FCM device tokens for push notifications
```

### `clubs/{clubId}`
```
name: string
nameLower: string            // lowercase copy for prefix search
sport: string                // 'basketball' | 'baseball' | 'softball' | 'soccer' | 'volleyball' | 'flag-football'
ownerId: string              // uid
adminIds: string[]           // uids with admin access
logoUrl: string | null       // Firebase Storage URL
```

### `clubs/{clubId}/players/{playerId}`
```
name: string
nickname: string             // optional display name shown prominently in UI
number: string
position: string
email: string
phone: string
photoUrl: string | null      // Firebase Storage URL
active: boolean
```

### `games/{gameId}`
```
joinCode: string             // 6-char alphanumeric
clubId: string               // home team's club
awayClubId: string | null    // if opponent is a SportStream club
sport: string
status: 'setup' | 'live' | 'paused' | 'final'
homeTeam: string
awayTeam: string
homeScore: number
awayScore: number

// Basketball
period: number
totalPeriods: number
periodLength: number         // seconds
clockElapsed: number
clockRunning: boolean

// Baseball/Softball
inning: number
totalInnings: number
inningHalf: 'top' | 'bottom'
outs: number
bases: { first, second, third }   // null or { playerId, playerName, playerNumber }
homeLineup: LineupEntry[]
awayLineup: LineupEntry[]
homeBatterIdx: number
awayBatterIdx: number
balls: number
strikes: number

// Shared
scorekeeperId: string
lastPlayId: string
lastPlayUndone: boolean
peerId: string               // PeerJS peer ID for streaming
tournamentId: string | null
bracketMatchId: string | null
leagueId: string | null
homeLeagueTeamId: string | null
awayLeagueTeamId: string | null
scheduledAt: string | null   // ISO date string for scheduled games
createdAt: Timestamp
```

### `games/{gameId}/plays/{playId}`
```
type: string                 // play type key (see playEventHelpers.js / baseballHelpers.js)
team: 'home' | 'away'
playerId: string | null
playerName: string | null
playerNumber: string | null
points: number               // basketball only
scoreDelta: { home?, away? } // score change this play applied
clockAtPlay: number
period: number               // basketball
inning: number               // baseball
inningHalf: 'top' | 'bottom'
undone: boolean
createdBy: string            // uid
createdAt: Timestamp
```

### `tournaments/{tourId}`
```
name: string
sport: string
hostId: string
format: 'single_elimination' | 'round_robin'
status: 'registration' | 'active' | 'complete'
joinCode: string
maxTeams: number
location: string
startDate: string
description: string
bracket: Matchup[]           // single elimination
schedule: Matchup[]          // round robin
photoUrl: string | null
createdAt: Timestamp
```

### `tournaments/{tourId}/teams/{teamId}`
```
name: string
managerName: string
managerEmail: string
managerId: string | null
clubId: string | null
seed: number
status: 'pending' | 'accepted' | 'withdrawn'
wins: number
losses: number
draws: number
runsFor: number
runsAgainst: number
// ChipInPool fields (optional)
chipInSessionId: string
chipInCheckoutUrl: string
chipInStatus: string
chipInAmount: number
createdAt: Timestamp
```

### `leagues/{leagueId}`
```
name: string
nameLower: string
sport: string
hostId: string
status: 'registration' | 'active' | 'complete'
joinCode: string
season: string
location: string
description: string
maxTeams: number
photoUrl: string | null
createdAt: Timestamp
```

### `leagues/{leagueId}/teams/{teamId}`
```
name: string
managerName: string
managerEmail: string
managerId: string | null
clubId: string | null
status: 'pending' | 'accepted' | 'rejected'
wins: number
losses: number
draws: number
pointsFor: number
pointsAgainst: number
createdAt: Timestamp
```

### `chipInSessions/{sessionId}`
ChipInPool checkout session lookup; written by the `createTournamentPool` Cloud Function.

---

## Security Rules

### `firestore.rules`

Key rule design decisions:
- **Games**: public read (anyone can view a scoreboard); write requires `scorekeeperId == request.auth.uid`
- **Clubs**: public read (team pages visible without auth); write requires owner/admin
- **Players**: public read; write requires club owner/admin
- **Tournaments / Leagues**: public read; team registration is open (no auth required) to allow public sign-up links
- **Users**: only the owner can read/write their own document

### `storage.rules`

- All uploaded media is **publicly readable**
- Writes require `request.auth != null` and a file size limit
- Paths:
  - `clubs/{clubId}/logo` — club logo (5 MB limit)
  - `clubs/{clubId}/players/{playerId}` — player photo (5 MB limit)
  - `tournaments/{tourId}/cover` — cover photo (10 MB limit)
  - `leagues/{leagueId}/cover` — cover photo (10 MB limit)

> **Note:** `contentType` matching is intentionally omitted from storage rules — the Firebase JS SDK does not always forward the content-type metadata in the security rule context, which causes false `storage/unauthorized` errors.

---

## Real-time vs. One-time Reads

| Helper | Type | Notes |
|---|---|---|
| `subscribeToClub` | Real-time (`onSnapshot`) | Used by `useClub` hook |
| `subscribeToPlayers` | Real-time | Roster in scorekeeper + club page |
| `subscribeToClubGames` | Real-time | Club admin game list |
| `subscribeToTeamGames` | Real-time | Public team page (merges home+away) |
| `subscribeLiveGames` | Real-time | Landing page live game feed |
| `subscribeToUser` | Real-time | Follow state |
| `getClub`, `getPlayers` | One-time | Used where real-time isn't needed (e.g. TeamPage initial load) |
| `getGamePlays` | One-time | Stats computation (run once per game) |

---

## Score / Stat Integrity

- Scores are **atomically incremented** (`increment()`) on the game doc alongside each play write — they are never recomputed from the plays subcollection
- Undo is a **soft delete**: `undone: true` on the play doc + an inverse `increment()` on the game doc
- Deleting a game with `deleteGame()` first fetches and deletes all documents in the `plays` subcollection, then deletes the game document (Firestore does not cascade subcollection deletes)
