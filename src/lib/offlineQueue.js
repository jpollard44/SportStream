import { openDB } from 'idb'

const DB_NAME = 'sportstream-offline'
const STORE = 'play-queue'
const VERSION = 1

async function getDB() {
  return openDB(DB_NAME, VERSION, {
    upgrade(db) {
      db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true })
    },
  })
}

export async function enqueuePlay(item) {
  const db = await getDB()
  await db.add(STORE, item)
}

/**
 * Process all queued items in order.
 * processor: async (item) => void — called for each item; throws to abort
 */
export async function flushQueue(processor) {
  const db = await getDB()
  const all = await db.getAll(STORE)
  // Sort by timestamp (oldest first)
  all.sort((a, b) => a.timestamp - b.timestamp)

  for (const item of all) {
    try {
      await processor(item)
      await db.delete(STORE, item.id)
    } catch (err) {
      console.error('Offline queue flush failed for item', item.id, err)
      // Stop flushing on error to preserve order
      break
    }
  }
}

export async function getQueueLength() {
  const db = await getDB()
  return db.count(STORE)
}
