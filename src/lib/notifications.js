import { getToken, onMessage } from 'firebase/messaging'
import { getMessagingInstance } from '../firebase/config'
import { saveFcmToken } from '../firebase/firestore'

// Generate a VAPID key pair in Firebase Console → Project Settings →
// Cloud Messaging → Web Push certificates → Generate key pair, then add it to .env.local
const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY

export async function requestNotificationPermission(uid) {
  if (!('Notification' in window)) return
  if (!('serviceWorker' in navigator)) return
  if (!VAPID_KEY) { console.warn('VITE_FIREBASE_VAPID_KEY not set — push notifications disabled'); return }

  try {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return

    const sw = await navigator.serviceWorker.register('/firebase-messaging-sw.js')
    const messaging = await getMessagingInstance()
    if (!messaging) return

    const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: sw })
    if (token) await saveFcmToken(uid, token)
  } catch (e) {
    console.error('Push notification setup error:', e)
  }
}

export async function onForegroundMessage(callback) {
  const messaging = await getMessagingInstance()
  if (!messaging) return () => {}
  return onMessage(messaging, callback)
}
