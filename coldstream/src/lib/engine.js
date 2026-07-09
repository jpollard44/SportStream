// Demo sending engine. In production this logic lives in a queue worker that
// talks SMTP; here it advances campaign state based on wall-clock time so the
// workspace keeps moving between visits. Rates are tuned to realistic cold
// email benchmarks (50-60% open, 5-8% reply, ~40% of replies positive).

import { getState, update, uid } from './store.js'
import { REPLY_SAMPLES } from './seed.js'
import { classifyIntent } from './intent.js'

const HOUR = 3600 * 1000

function inSendWindow(ts, schedule) {
  const d = new Date(ts)
  const day = d.getDay()
  if (!schedule?.days?.includes(day === 0 ? 7 : day) && !schedule?.days?.includes(day)) return false
  const hour = d.getHours()
  const from = parseInt(schedule?.from || '9', 10)
  const to = parseInt(schedule?.to || '17', 10)
  return hour >= from && hour < to
}

export function tick(now = Date.now()) {
  const s = getState()
  const elapsed = now - (s.lastTick || now)
  if (elapsed < 30 * 1000) return
  const hours = Math.min(elapsed / HOUR, 24 * 7) // cap catch-up at a week

  update((state) => {
    let { campaigns, leads, inbox, accounts, activity } = state
    campaigns = campaigns.map((c) => ({ ...c }))
    leads = leads.map((l) => ({ ...l }))
    accounts = accounts.map((a) => ({ ...a }))
    inbox = [...inbox]
    activity = [...activity]
    const today = new Date(now).toISOString().slice(0, 10)

    for (const c of campaigns) {
      if (c.status !== 'active' || c.accountIds.length === 0) continue
      const pool = leads.filter((l) => l.campaignId === c.id && l.status === 'active')
      if (pool.length === 0) continue

      // Send rate: campaign daily limit spread over an 8h window
      const perHour = (c.dailyLimit || 50) / 8
      const windowFactor = inSendWindow(now, c.schedule) ? 1 : 0.25 // catch-up smoothing
      const sends = Math.min(pool.length, Math.round(perHour * hours * windowFactor))
      if (sends <= 0) continue

      const opened = Math.round(sends * (0.5 + Math.random() * 0.12))
      const replies = Math.min(pool.length, Math.round(sends * (0.05 + Math.random() * 0.03)))
      const bounces = Math.random() < sends * 0.015 ? 1 : 0

      c.stats = { ...c.stats, sent: c.stats.sent + sends, opened: c.stats.opened + opened, bounced: c.stats.bounced + bounces }
      c.daily = [...c.daily]
      let day = c.daily[c.daily.length - 1]
      if (!day || day.date !== today) {
        day = { date: today, sent: 0, opened: 0, replied: 0 }
        c.daily.push(day)
      } else {
        day = { ...day }
        c.daily[c.daily.length - 1] = day
      }
      day.sent += sends
      day.opened += opened

      // Materialize replies as inbox messages + lead status changes
      for (let i = 0; i < replies; i++) {
        const lead = pool[Math.floor(Math.random() * pool.length)]
        if (lead.status !== 'active') continue
        const sample = REPLY_SAMPLES[Math.floor(Math.random() * REPLY_SAMPLES.length)]
        const intent = classifyIntent(sample.text)
        lead.status = intent === 'unsubscribe' ? 'unsubscribed' : 'replied'
        c.stats.replied += 1
        day.replied += 1
        if (intent === 'interested' || intent === 'meeting') c.stats.positive += 1
        inbox.unshift({
          id: uid('msg'), leadId: lead.id, campaignId: c.id,
          from: `${lead.firstName || ''} ${lead.lastName || ''} <${lead.email}>`.trim(),
          subject: `Re: ${(c.steps[0]?.subject || 'your email').replace(/\{\{?[^}]*\}?\}/g, lead.company || '')}`,
          body: sample.text, intent, receivedAt: now - Math.floor(Math.random() * elapsed),
          read: false, starred: intent === 'interested' || intent === 'meeting',
        })
        activity.unshift({
          id: uid('act'), ts: now, type: 'reply',
          text: `New reply from ${lead.firstName} ${lead.lastName} (${lead.company}) — ${intent.replace(/_/g, ' ')}`,
        })
      }
      if (sends > 2) {
        activity.unshift({ id: uid('act'), ts: now, type: 'send', text: `${c.name}: ${sends} emails sent` })
      }
      if (pool.every((l) => l.status !== 'active')) c.status = 'completed'
    }

    // Warmup: health climbs toward mid-90s while enabled, decays slowly when off
    const days = hours / 24
    for (const a of accounts) {
      if (a.warmupEnabled) {
        a.warmupDay = Math.min(45, +(a.warmupDay + days).toFixed(2))
        a.healthScore = Math.min(97, Math.round(a.healthScore + days * (a.healthScore < 80 ? 3 : 1)))
      } else {
        a.healthScore = Math.max(35, Math.round(a.healthScore - days * 2))
      }
    }

    return {
      ...state, campaigns, leads, inbox, accounts,
      activity: activity.slice(0, 60), lastTick: now,
    }
  })
}

export function startEngine() {
  tick()
  const id = setInterval(() => tick(), 45 * 1000)
  return () => clearInterval(id)
}
