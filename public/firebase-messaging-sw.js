importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey: 'AIzaSyAIgkVC_sn0C6Eff7UTgsJpQQ69ZlS7FYU',
  authDomain: 'sportstream-91d22.firebaseapp.com',
  projectId: 'sportstream-91d22',
  storageBucket: 'sportstream-91d22.firebasestorage.app',
  messagingSenderId: '579645806369',
  appId: '1:579645806369:web:e57bb3bee753a93bcf5060',
})

const messaging = firebase.messaging()

// Handle background push messages
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || 'SportStream'
  const body  = payload.notification?.body  || ''
  self.registration.showNotification(title, {
    body,
    icon:  '/favicon.svg',
    badge: '/favicon.svg',
    data:  payload.data || {},
  })
})

// Open the game URL when the notification is clicked
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const win of windows) {
        if (win.url === url && 'focus' in win) return win.focus()
      }
      if (clients.openWindow) return clients.openWindow(url)
    })
  )
})
