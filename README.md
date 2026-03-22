# SportStream

A mobile-first web app for recreational, school, and pickup teams to **live-stream games** and **manually track scores and stats** in real time. Built for the teams that don't make ESPN — but still deserve a scoreboard.

Live app: [https://sportstream-91d22.web.app](https://sportstream-91d22.web.app)

---

## Features

- **Live scorekeeper** — basketball and baseball/softball UIs with play-by-play logging, pitch count, base runners, and lineup management
- **Public scoreboard** — shareable game page with real-time score, play feed, and per-player stats
- **WebRTC streaming** — hosts can broadcast a camera feed; viewers watch via a join code (PeerJS, future phase)
- **Leagues** — create round-robin leagues, auto-schedule games, track standings, manage rosters
- **Tournaments** — single-elimination and round-robin brackets with auto-seeding and drag/drop schedule reorder
- **Team pages** — public profile with season record, game history, roster, and a follow/notification system
- **Universal code search** — find any game, tournament, or league with a 6-character join code
- **Offline queue** — plays recorded offline are synced to Firestore on reconnect (IndexedDB)
- **Push notifications** — followers get an FCM push when a team goes live
- **Entry fees** — optional ChipInPool integration for tournament/league registration fees
- **Photo uploads** — team logos, player photos, tournament and league cover photos (Firebase Storage)
- **Nickname display** — show player nicknames prominently throughout scorekeeping and rosters

### Supported Sports
Basketball · Baseball · Softball · Soccer · Volleyball · Flag Football

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite 5 |
| Styling | Tailwind CSS 3 |
| Routing | React Router v6 |
| Backend / DB | Firebase Firestore (real-time) |
| Auth | Firebase Auth (email/password + Google) |
| Storage | Firebase Storage |
| Functions | Firebase Functions v2 (Node 20) |
| Streaming | PeerJS (WebRTC) |
| Offline | `idb` (IndexedDB) |
| Push | Firebase Cloud Messaging (FCM) |
| Notifications | Twilio (SMS) + Resend (email) via Functions |
| Payments | ChipInPool (entry fee collection) |

---

## Project Structure

```
SportStream/
├── src/
│   ├── App.jsx                   # Root: routes + FCM hook
│   ├── main.jsx                  # React entry point
│   ├── pages/                    # One file per route
│   │   ├── LandingPage.jsx
│   │   ├── DashboardPage.jsx
│   │   ├── ClubPage.jsx          # Club admin: roster, games, logo
│   │   ├── TeamPage.jsx          # Public team profile
│   │   ├── PublicGamePage.jsx    # Live scoreboard + play-by-play
│   │   ├── ScorekeeperPage.jsx   # Scorekeeper entry (delegates to sport UI)
│   │   ├── GameSetupPage.jsx
│   │   ├── LeaguesPage.jsx
│   │   ├── LeaguePage.jsx        # League hub: standings, schedule, teams
│   │   ├── TournamentsPage.jsx
│   │   ├── TournamentPage.jsx    # Tournament hub: bracket, games, teams
│   │   ├── FindPage.jsx          # Universal code search
│   │   ├── SettingsPage.jsx
│   │   └── ...
│   ├── components/
│   │   ├── scorekeeper/
│   │   │   ├── baseball/         # BaseballScorekeeper, LineupSheet, BaseDiamond, BaseballActionSheet
│   │   │   ├── PlayerGrid.jsx    # Basketball player tap grid
│   │   │   ├── ScoreActionSheet.jsx
│   │   │   ├── VolleyballScorekeeper.jsx
│   │   │   ├── StreamButton.jsx  # Camera start/stop
│   │   │   ├── VoiceButton.jsx   # Hold-to-talk play input
│   │   │   └── UndoButton.jsx
│   │   ├── public/
│   │   │   └── StreamViewer.jsx  # Viewer-side video player
│   │   └── tournament/
│   │       └── BracketView.jsx   # SE bracket + RR schedule rendering
│   ├── firebase/
│   │   ├── config.js             # Firebase init (auth, db, storage)
│   │   ├── auth.js               # Sign-in helpers
│   │   ├── firestore.js          # All Firestore CRUD + subscriptions
│   │   ├── storage.js            # Photo upload helpers
│   │   ├── leagues.js            # League CRUD + standings
│   │   ├── tournaments.js        # Tournament CRUD + bracket generation
│   │   └── chipinpool.js         # Entry fee callable wrapper
│   ├── context/
│   │   ├── AuthContext.jsx       # onAuthStateChanged provider
│   │   └── OfflineQueueContext.jsx
│   ├── hooks/
│   │   ├── useClub.js            # Real-time club + players subscription
│   │   ├── useStream.js          # PeerJS broadcaster hook
│   │   ├── useVoiceInput.js      # Web Speech API
│   │   ├── usePlan.js            # User plan (free/team/premium)
│   │   └── useNotifications.js   # FCM permission + foreground listener
│   ├── lib/
│   │   ├── formatters.js         # Clock, date, period/inning labels, nickDisplay
│   │   ├── playEventHelpers.js   # Basketball play types
│   │   ├── baseballHelpers.js    # Baseball play types + inning state machine
│   │   ├── statsHelpers.js       # Per-game + season stat computation
│   │   ├── offlineQueue.js       # IndexedDB queue (idb)
│   │   └── generateJoinCode.js   # Collision-safe 6-char code generator
│   └── styles/
│       └── index.css             # Tailwind + custom component utilities
├── functions/
│   └── index.js                  # Firebase Functions (ChipInPool, FCM, webhooks)
├── public/
│   └── firebase-messaging-sw.js  # FCM service worker
├── firestore.rules               # Firestore security rules
├── firestore.indexes.json        # Composite index definitions
├── storage.rules                 # Firebase Storage security rules
├── firebase.json                 # Firebase project config
└── .env.local                    # Firebase credentials (not committed)
```

---

## Prerequisites

- Node.js 18+
- Firebase CLI: `npm install -g firebase-tools`
- A Firebase project (see Firebase Setup below)

---

## Environment Variables

Create a `.env.local` file in the project root:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_VAPID_KEY=your_vapid_key
```

Get these values from the Firebase Console → Project Settings → Your apps → Web app config.

The VAPID key is for push notifications: Firebase Console → Project Settings → Cloud Messaging → Web Push certificates → Generate key pair.

---

## Firebase Setup

### 1. Create a Firebase project

Go to [console.firebase.google.com](https://console.firebase.google.com) and create a new project.

### 2. Enable services

- **Firestore** — Create a database in production mode
- **Authentication** — Enable Email/Password and Google providers
- **Storage** — Enable Firebase Storage
- **Functions** — Requires Blaze (pay-as-you-go) plan for Cloud Functions

### 3. Deploy security rules and indexes

```bash
firebase login
firebase use your-project-id
firebase deploy --only firestore:rules,firestore:indexes,storage
```

### 4. Required Firestore composite indexes

Firestore creates single-field indexes automatically. These composites must be created manually (Firebase will provide a direct link on first query failure):

| Collection | Fields |
|---|---|
| `players` (subcollection) | `active ASC` + `number ASC` |
| `games` | `clubId ASC` + `createdAt DESC` |
| `games` | `awayClubId ASC` + `createdAt DESC` |
| `games` | `tournamentId ASC` + `createdAt DESC` |
| `plays` (subcollection) | `undone ASC` + `createdAt DESC` |
| `tournaments` | `status ASC` + `createdAt DESC` |
| `tournaments` | `hostId ASC` + `createdAt DESC` |
| `teams` (subcollection) | `status ASC` + `createdAt ASC` |
| `leagues` | `hostId ASC` + `createdAt DESC` |

### 5. Functions secrets (optional — required for ChipInPool/email/SMS)

```bash
firebase functions:secrets:set CHIPINPOOL_API_KEY
firebase functions:secrets:set CHIPINPOOL_WEBHOOK_SECRET
firebase functions:secrets:set RESEND_API_KEY
firebase functions:secrets:set TWILIO_ACCOUNT_SID
firebase functions:secrets:set TWILIO_AUTH_TOKEN
firebase functions:secrets:set TWILIO_FROM_PHONE
```

### 6. FCM service worker

`public/firebase-messaging-sw.js` contains hardcoded Firebase config. Update it with your project's values to enable background push notifications.

---

## Local Development

```bash
# Install frontend dependencies
npm install

# Install functions dependencies
cd functions && npm install && cd ..

# Start the dev server (hot reload)
npm run dev
```

App runs at `http://localhost:5173`.

---

## Deployment

```bash
# Build the frontend
npm run build

# Deploy everything (hosting, functions, rules)
firebase deploy

# Deploy only hosting
firebase deploy --only hosting

# Deploy only storage rules
firebase deploy --only storage

# Deploy only Firestore rules + indexes
firebase deploy --only firestore
```

---

## Routes

| Path | Description | Auth |
|---|---|---|
| `/` | Landing page | Public |
| `/login` | Email + Google sign-in | Public |
| `/find` | Universal code search | Public |
| `/join` | Join a game by code | Public |
| `/game/:gameId` | Public scoreboard + play-by-play | Public |
| `/team/:clubId` | Public team profile | Public |
| `/tournaments` | Tournament browser | Public |
| `/tournament/:tourId` | Tournament hub | Public |
| `/tournament/:tourId/join` | Team registration | Public |
| `/leagues` | League browser | Public |
| `/league/:leagueId` | League hub | Public |
| `/league/:leagueId/join` | Team registration | Public |
| `/dashboard` | Club list + followed games | Auth required |
| `/club/:clubId` | Club admin panel | Auth required |
| `/club/:clubId/game/new` | Game setup | Auth required |
| `/scorekeeper/:gameId` | Live scorekeeper | Auth required |
| `/tournament/new` | Create tournament | Auth required |
| `/league/new` | Create league | Auth required |
| `/settings` | Account + plan | Auth required |

---

## Key Patterns

- **Score updates** — atomic `increment()` on the game doc alongside each play write; never recomputed from plays
- **Clock** — ticks locally with `setInterval`; writes to Firestore only on pause/resume/period-end
- **Undo** — soft-delete (`undone: true`) on the play doc + inverse score increment on the game doc
- **Offline** — plays are written to IndexedDB and flushed to Firestore on the `window online` event
- **Join codes** — 6-char alphanumeric (no 0/O/1/I), collision-checked against Firestore before use
- **Nickname display** — `nickDisplay(name, nickname)` in `formatters.js`; shown prominently throughout scorekeeping and roster views

---

## Contributing

See [`src/firebase/README.md`](src/firebase/README.md) for details on the Firestore schema and security rules.
