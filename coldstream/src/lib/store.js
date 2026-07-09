// App state: a single store persisted to localStorage, subscribed to via
// useSyncExternalStore. Swappable for Firestore later — every mutation goes
// through update(), so the persistence layer is one function.

import { useSyncExternalStore } from 'react'
import { buildSeed } from './seed.js'

const KEY = 'coldstream-v1'
const listeners = new Set()

function load() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* corrupted state falls through to reseed */ }
  return buildSeed()
}

let state = load()

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* quota */ }
}

export function getState() {
  return state
}

export function update(fn) {
  const next = fn(state)
  if (next && next !== state) state = next
  persist()
  listeners.forEach((l) => l())
}

function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useStore(selector = (s) => s) {
  return useSyncExternalStore(subscribe, () => selector(state))
}

export function resetDemo() {
  state = buildSeed()
  persist()
  listeners.forEach((l) => l())
}

let nextId = Date.now() % 1e8
export function uid(prefix = 'id') {
  return `${prefix}_${(nextId++).toString(36)}`
}

// ---- Actions ----

export function addAccount(account) {
  update((s) => ({
    ...s,
    accounts: [...s.accounts, {
      id: uid('acc'), status: 'active', warmupEnabled: true,
      warmupDay: 0, healthScore: 68, dailyLimit: 30, sentToday: 0,
      ...account,
    }],
  }))
}

export function patchAccount(id, patch) {
  update((s) => ({ ...s, accounts: s.accounts.map((a) => (a.id === id ? { ...a, ...patch } : a)) }))
}

export function removeAccount(id) {
  update((s) => ({ ...s, accounts: s.accounts.filter((a) => a.id !== id) }))
}

export function addLeads(leads, campaignId = null) {
  update((s) => {
    const existing = new Set(s.leads.map((l) => l.email))
    const fresh = leads
      .filter((l) => !existing.has(l.email))
      .map((l) => ({ id: uid('lead'), status: 'active', verified: Math.random() > 0.06, campaignId, step: 0, ...l }))
    return { ...s, leads: [...s.leads, ...fresh] }
  })
}

export function patchLead(id, patch) {
  update((s) => ({ ...s, leads: s.leads.map((l) => (l.id === id ? { ...l, ...patch } : l)) }))
}

export function createCampaign(campaign) {
  const id = uid('cmp')
  update((s) => ({
    ...s,
    campaigns: [...s.campaigns, {
      id, status: 'draft', createdAt: Date.now(),
      stats: { sent: 0, opened: 0, replied: 0, positive: 0, bounced: 0 },
      daily: [],
      ...campaign,
    }],
  }))
  return id
}

export function patchCampaign(id, patch) {
  update((s) => ({ ...s, campaigns: s.campaigns.map((c) => (c.id === id ? { ...c, ...patch } : c)) }))
}

export function deleteCampaign(id) {
  update((s) => ({
    ...s,
    campaigns: s.campaigns.filter((c) => c.id !== id),
    leads: s.leads.map((l) => (l.campaignId === id ? { ...l, campaignId: null } : l)),
    inbox: s.inbox.filter((m) => m.campaignId !== id),
  }))
}

export function patchMessage(id, patch) {
  update((s) => ({ ...s, inbox: s.inbox.map((m) => (m.id === id ? { ...m, ...patch } : m)) }))
}

export function joinWaitlist(email) {
  update((s) => ({ ...s, waitlist: [...new Set([...(s.waitlist || []), email])] }))
}

export function logActivity(text, type = 'info') {
  update((s) => ({
    ...s,
    activity: [{ id: uid('act'), ts: Date.now(), type, text }, ...s.activity].slice(0, 60),
  }))
}
