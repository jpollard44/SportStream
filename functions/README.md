# Cloud Functions

Firebase Functions v2 (Node 20) running in `us-central1`.

---

## Functions

### `createTournamentPool` (onCall)

Called from the frontend after a team registers for a tournament or league. Creates a ChipInPool checkout session for the entry fee and notifies players via email + SMS.

**Parameters:**
```js
{
  col: 'tournaments' | 'leagues',
  parentId: string,    // tourId or leagueId
  teamId: string,
  amount: number,      // entry fee in cents
  productTitle: string,
  managerEmail: string,
}
```

**Side effects:**
- Creates a ChipInPool session via the ChipInPool REST API
- Stores session metadata in `chipInSessions/{sessionId}`
- Updates `{col}/{parentId}/teams/{teamId}` with `chipInSessionId`, `chipInCheckoutUrl`, `chipInStatus`
- Emails + texts all players the shared payment link (Resend + Twilio)

---

### `chipInWebhook` (onRequest)

HTTP webhook called by ChipInPool when a payment session is fully funded.

**Endpoint:** Register this URL in the ChipInPool Merchant Dashboard.

**Behavior:**
- Verifies the `X-ChipInPool-Signature` header using `CHIPINPOOL_WEBHOOK_SECRET`
- On `session.completed` event: sets `fullyFunded: true` on the matching team doc

---

### `createChipInSession` (onCall)

Lower-level callable that creates a single ChipInPool checkout session without the notification flow.

---

### `onGameLive` (onDocumentUpdated — `games/{gameId}`)

Fires when a game document's `status` field changes to `'live'`.

**Behavior:**
- Queries all users whose `followedClubs` array contains the game's `clubId`
- Sends an FCM multicast push to all their registered device tokens
- Removes stale (invalid) FCM tokens from user documents after send

---

## Secrets

All secrets are stored in Firebase Secret Manager. Set them with:

```bash
firebase functions:secrets:set SECRET_NAME
```

| Secret | Used by | Required? |
|---|---|---|
| `CHIPINPOOL_API_KEY` | `createTournamentPool`, `createChipInSession` | Required for entry fees |
| `CHIPINPOOL_WEBHOOK_SECRET` | `chipInWebhook` | Required for entry fees |
| `RESEND_API_KEY` | `createTournamentPool` | Optional (email notifications) |
| `TWILIO_ACCOUNT_SID` | `createTournamentPool` | Optional (SMS notifications) |
| `TWILIO_AUTH_TOKEN` | `createTournamentPool` | Optional (SMS notifications) |
| `TWILIO_FROM_PHONE` | `createTournamentPool` | Optional (SMS notifications) |

---

## Local Development

Functions are not emulated locally by default. To run them with the Firebase Emulator Suite:

```bash
firebase emulators:start --only functions,firestore
```

Make sure secrets are available in your emulator environment or stub them out for local testing.

---

## Deployment

```bash
# Deploy all functions
firebase deploy --only functions

# Deploy a single function
firebase deploy --only functions:createTournamentPool
```
