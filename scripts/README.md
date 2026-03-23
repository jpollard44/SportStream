# SportStream Scripts

## wipeData.js — Firestore Data Wipe

Deletes all documents from every Firestore collection. Useful for resetting a development or staging environment before a production launch.

> **Warning:** This is irreversible. All game history, player stats, and user data will be permanently deleted.

### Prerequisites

1. **Firebase Admin SDK** — install in the `scripts/` directory or use the project root `node_modules`:
   ```bash
   cd scripts
   npm init -y
   npm install firebase-admin
   ```
   Or run from the project root where `firebase-admin` is already in `functions/node_modules`:
   ```bash
   node -e "require('firebase-admin')" 2>/dev/null || cd functions && npm install && cd ..
   ```

2. **Service account JSON** — download from Firebase console:
   - Go to Firebase Console → Project Settings → Service accounts
   - Click "Generate new private key"
   - Save the JSON file somewhere secure (outside the repo)

### Usage

#### Dry run (lists what would be deleted, no changes made)
```bash
GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json node scripts/wipeData.js --dry-run
```

#### Full wipe (requires typing `WIPE` to confirm)
```bash
GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json node scripts/wipeData.js
```

### What gets deleted

| Collection       | Subcollections deleted                        |
|------------------|-----------------------------------------------|
| `users`          | —                                             |
| `players`        | `stats`, `clubMemberships`                    |
| `clubs`          | `players`, `roster`, `games`, `seasonStats`   |
| `games`          | `plays`                                       |
| `highlights`     | —                                             |
| `weeklyTop10`    | —                                             |
| `invites`        | —                                             |
| `chipInSessions` | —                                             |
| `leagues`        | `teams`, `games`                              |
| `tournaments`    | `teams`                                       |

### What does NOT get deleted

- **Firebase Auth users** — delete these separately via the Firebase console (Authentication → Users → Delete all) or via the Firebase CLI:
  ```bash
  firebase auth:export users.json  # backup first
  # Then delete via console or a separate script
  ```
- **Firebase Storage files** — logos and photos remain in Cloud Storage. Delete via the Firebase console or `gsutil`.

### Running from a CI environment

Set the `GOOGLE_APPLICATION_CREDENTIALS` environment variable in your CI secrets and call the script with `--dry-run` first to validate, then without for the actual wipe.
