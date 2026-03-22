import { useState, useEffect } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase/config'

export const PLANS = {
  FREE: 'free',
  TEAM: 'team',
  PREMIUM: 'premium',
}

export const PLAN_FEATURES = {
  [PLANS.FREE]: {
    label: 'Free',
    price: '$0',
    csvExport: false,
    streaming: true,      // basic stream always included
    multiCamera: false,
    analytics: false,
    highlights: false,
    ads: true,
  },
  [PLANS.TEAM]: {
    label: 'Team',
    price: '$5/mo',
    csvExport: true,
    streaming: true,
    multiCamera: false,
    analytics: false,
    highlights: true,
    ads: false,
  },
  [PLANS.PREMIUM]: {
    label: 'Premium',
    price: '$20/mo',
    csvExport: true,
    streaming: true,
    multiCamera: true,
    analytics: true,
    highlights: true,
    ads: false,
  },
}

/**
 * Subscribes to the current user's plan from Firestore.
 * Returns { plan, features, loading } where plan is 'free' | 'team' | 'premium'.
 */
export function usePlan(uid) {
  const [plan, setPlan] = useState(PLANS.FREE)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!uid) { setLoading(false); return }
    const unsub = onSnapshot(doc(db, 'users', uid), (snap) => {
      const data = snap.data()
      setPlan(data?.plan || PLANS.FREE)
      setLoading(false)
    })
    return unsub
  }, [uid])

  const features = PLAN_FEATURES[plan] || PLAN_FEATURES[PLANS.FREE]
  return { plan, features, loading }
}
