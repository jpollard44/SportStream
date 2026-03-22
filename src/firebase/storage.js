import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { storage } from './config'

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function uploadAndGetUrl(storagePath, file) {
  const storageRef = ref(storage, storagePath)
  await uploadBytes(storageRef, file)
  return getDownloadURL(storageRef)
}

// ─── Club logo ────────────────────────────────────────────────────────────────

export async function uploadClubLogo(clubId, file) {
  return uploadAndGetUrl(`clubs/${clubId}/logo`, file)
}

// ─── Player photo ─────────────────────────────────────────────────────────────

export async function uploadPlayerPhoto(clubId, playerId, file) {
  return uploadAndGetUrl(`clubs/${clubId}/players/${playerId}`, file)
}

// ─── Tournament cover photo ───────────────────────────────────────────────────

export async function uploadTournamentPhoto(tourId, file) {
  return uploadAndGetUrl(`tournaments/${tourId}/cover`, file)
}

// ─── League cover photo ───────────────────────────────────────────────────────

export async function uploadLeaguePhoto(leagueId, file) {
  return uploadAndGetUrl(`leagues/${leagueId}/cover`, file)
}
