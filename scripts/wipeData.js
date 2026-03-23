#!/usr/bin/env node
/**
 * SportStream — Firestore data wipe script
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json node scripts/wipeData.js
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json node scripts/wipeData.js --dry-run
 *
 * See scripts/README.md for full instructions.
 */

const admin = require('firebase-admin')
const readline = require('readline')

const DRY_RUN = process.argv.includes('--dry-run')

// ── Collections and subcollections to delete ─────────────────────────────────

const TOP_LEVEL = [
  { col: 'users',      subcols: [] },
  { col: 'players',    subcols: ['stats', 'clubMemberships'] },
  { col: 'clubs',      subcols: ['players', 'roster', 'games', 'seasonStats'] },
  { col: 'games',      subcols: ['plays'] },
  { col: 'highlights', subcols: [] },
  { col: 'weeklyTop10', subcols: [] },
  { col: 'invites',    subcols: [] },
  { col: 'chipInSessions', subcols: [] },
  { col: 'leagues',    subcols: ['teams', 'games'] },
  { col: 'tournaments', subcols: ['teams'] },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => {
    rl.question(question, (answer) => { rl.close(); resolve(answer) })
  })
}

async function deleteCollection(db, collectionRef, subcols, depth = 0) {
  const indent = '  '.repeat(depth)
  const snap = await collectionRef.get()
  if (snap.empty) {
    console.log(`${indent}${collectionRef.path}  (empty, skipping)`)
    return 0
  }

  let total = 0
  const batchSize = 400
  let batch = db.batch()
  let batchCount = 0

  for (const doc of snap.docs) {
    // Delete subcollections first
    for (const sub of subcols) {
      const subRef = doc.ref.collection(sub)
      const subCount = await deleteCollection(db, subRef, [], depth + 1)
      total += subCount
    }

    if (DRY_RUN) {
      console.log(`${indent}  [DRY RUN] would delete: ${doc.ref.path}`)
    } else {
      batch.delete(doc.ref)
      batchCount++
    }
    total++

    if (!DRY_RUN && batchCount >= batchSize) {
      await batch.commit()
      console.log(`${indent}  Deleted ${batchCount} docs from ${collectionRef.path}…`)
      batch = db.batch()
      batchCount = 0
    }
  }

  if (!DRY_RUN && batchCount > 0) {
    await batch.commit()
  }

  console.log(`${indent}${collectionRef.path}  — ${DRY_RUN ? 'would delete' : 'deleted'} ${snap.size} docs`)
  return total
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  // Validate credentials
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error('ERROR: Set GOOGLE_APPLICATION_CREDENTIALS to your service account JSON path.')
    process.exit(1)
  }

  // Init Firebase Admin
  admin.initializeApp({ credential: admin.credential.applicationDefault() })
  const db = admin.firestore()

  console.log('\n╔══════════════════════════════════════════════════╗')
  console.log('║         SportStream Firestore Data Wipe          ║')
  console.log('╚══════════════════════════════════════════════════╝\n')

  if (DRY_RUN) {
    console.log('⚠  DRY RUN MODE — no data will be deleted\n')
  } else {
    console.log('⚠  WARNING: This will PERMANENTLY delete ALL data in the following collections:')
    TOP_LEVEL.forEach(({ col, subcols }) => {
      const sub = subcols.length ? ` (+ subcollections: ${subcols.join(', ')})` : ''
      console.log(`   • ${col}${sub}`)
    })
    console.log('\n   Firebase Auth users are NOT deleted by this script.')
    console.log('   Delete auth users via the Firebase console or Firebase CLI.\n')

    const answer = await prompt('Type WIPE to confirm, or anything else to abort: ')
    if (answer.trim() !== 'WIPE') {
      console.log('\nAborted. No data was deleted.')
      process.exit(0)
    }
    console.log('')
  }

  let grandTotal = 0

  for (const { col, subcols } of TOP_LEVEL) {
    try {
      const ref = db.collection(col)
      const count = await deleteCollection(db, ref, subcols)
      grandTotal += count
    } catch (err) {
      console.error(`Error processing ${col}:`, err.message)
    }
  }

  console.log(`\n✓ Done. ${DRY_RUN ? 'Would have deleted' : 'Deleted'} ~${grandTotal} documents total.`)

  if (!DRY_RUN) {
    console.log('\nNote: Firestore may take a few minutes to reflect all deletions.')
  }

  process.exit(0)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
