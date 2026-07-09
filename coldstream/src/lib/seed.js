// Demo workspace seed: three weeks of realistic history so every screen has
// something to show the moment someone lands in the product.

const DAY = 24 * 60 * 60 * 1000

const FIRST = ['Ava', 'Liam', 'Maya', 'Noah', 'Zoe', 'Eli', 'Ruth', 'Owen', 'Ines', 'Jack', 'Nora', 'Theo', 'Lena', 'Marcus', 'Priya', 'Diego', 'Hana', 'Felix', 'Sofia', 'Kai']
const LAST = ['Chen', 'Alvarez', 'Okafor', 'Novak', 'Kim', 'Rossi', 'Haddad', 'Berg', 'Silva', 'Tanaka', 'Moreau', 'Patel', 'Larsen', 'Weber', 'Costa', 'Nakamura', 'Iversen', 'Duarte', 'Kovacs', 'Reyes']
const COMPANIES = ['Brightloop', 'Fernhill Labs', 'Quantia', 'Mosaic HQ', 'Northbeam Co', 'Papertrail', 'Vantage Peak', 'Corely', 'Driftwood', 'Signalhouse', 'Opal Metrics', 'Lumen & Co', 'Stackline', 'Harbor AI', 'Fieldnote', 'Crescent Data', 'Tidewater', 'Redwood Ops', 'Juniper Soft', 'Basecoat']
const TITLES = ['Head of Sales', 'VP Marketing', 'Founder', 'Growth Lead', 'CEO', 'Director of Ops', 'RevOps Manager', 'CMO', 'Head of Partnerships', 'Sales Manager']

const REPLY_SAMPLES = [
  { intent: 'interested', text: "This actually looks interesting — tell me more about how the setup works? We're mid-migration right now but open to a look." },
  { intent: 'interested', text: "Sounds good. Send over the 2-min demo and pricing and I'll take a look this week." },
  { intent: 'meeting', text: "Sure — booked a time on your Calendly for Thursday. See you then." },
  { intent: 'question', text: "How much does this cost for a team of 8? And does it integrate with HubSpot?" },
  { intent: 'question', text: "Can you share a case study from someone in fintech? Curious about deliverability numbers." },
  { intent: 'not_now', text: "Not right now — we're heads down until end of quarter. Circle back in October?" },
  { intent: 'not_interested', text: "Thanks but we're all set — already using something in-house for this." },
  { intent: 'out_of_office', text: "I'm out of the office until Monday with limited email access. For urgent matters contact ops@." },
  { intent: 'wrong_person', text: "I'm not the right person for this — try reaching our head of growth, she owns outbound tooling." },
  { intent: 'unsubscribe', text: "Please remove me from your list." },
]

function pick(arr, i) { return arr[i % arr.length] }

export function buildSeed() {
  const now = Date.now()
  let n = 0
  const uid = (p) => `${p}_seed${(n++).toString(36)}`

  const accounts = [
    { id: uid('acc'), email: 'jo@coldstream-mail.com', provider: 'Google Workspace', status: 'active', warmupEnabled: true, warmupDay: 21, healthScore: 94, dailyLimit: 40, sentToday: 26 },
    { id: uid('acc'), email: 'jo@getcoldstream.io', provider: 'Google Workspace', status: 'active', warmupEnabled: true, warmupDay: 14, healthScore: 87, dailyLimit: 30, sentToday: 22 },
    { id: uid('acc'), email: 'jordan@coldstream-hq.com', provider: 'Microsoft 365', status: 'active', warmupEnabled: true, warmupDay: 6, healthScore: 71, dailyLimit: 20, sentToday: 9 },
  ]

  const mkDaily = (days, base, rates) => {
    const out = []
    for (let d = days - 1; d >= 0; d--) {
      const dow = new Date(now - d * DAY).getDay()
      const weekend = dow === 0 || dow === 6
      const sent = weekend ? 0 : Math.round(base * (0.75 + ((d * 7) % 10) / 20))
      out.push({
        date: new Date(now - d * DAY).toISOString().slice(0, 10),
        sent,
        opened: Math.round(sent * rates.open),
        replied: Math.round(sent * rates.reply),
      })
    }
    return out
  }

  const sum = (daily, k) => daily.reduce((a, d) => a + d[k], 0)

  const seqA = [
    { id: uid('step'), subject: '{Quick question|Question} for {{company}}', waitDays: 0, body: "{Hi|Hey} {{firstName}},\n\nQuick question — how is {{company}} currently handling outbound? Most growth teams we talk to are stitching together 4 tools and still guessing why replies dried up.\n\nColdstream runs your sending, warmup, and inbox in one place — teams typically see reply rates double in the first month.\n\n{Worth a quick look|Open to seeing how it works}? Happy to send a 2-min demo, no meeting needed.\n\n{Best|Thanks},\nJo" },
    { id: uid('step'), subject: '', waitDays: 3, body: "{Hi|Hey} {{firstName}},\n\n{Floating this back up|Bumping this} in case it got buried. Short version: unlimited sending accounts, warmup that actually protects your domain, and an inbox that flags who's ready to buy.\n\nIf outbound isn't a priority for {{company}} right now, no worries — just let me know and I'll close the loop.\n\nThanks,\nJo" },
    { id: uid('step'), subject: '{Last one|Closing the loop}, {{firstName}}', waitDays: 4, body: "{{firstName}} —\n\nLast note from me. Three things people ask:\n\n1. Setup takes ~10 minutes\n2. Reply rates typically 2x in month one\n3. Free to try, no card required\n\nIf the timing's wrong, reply \"later\" and I'll check back next quarter.\n\nBest,\nJo" },
  ]
  const seqB = [
    { id: uid('step'), subject: 'Agencies running outbound for clients', waitDays: 0, body: "{Hi|Hey} {{firstName}},\n\nSaw {{company}} runs outbound for clients — the hard part is usually keeping 30+ inboxes healthy without a full-time person babysitting deliverability.\n\nColdstream gives you unlimited client inboxes under one roof, per-client health scores, and white-label reporting.\n\nWorth 15 minutes?\n\nBest,\nJo" },
    { id: uid('step'), subject: '', waitDays: 4, body: "{{firstName}} — one more thought: agencies on Coldstream cut inbox-management time by ~80% and stopped losing domains to spam folders.\n\nHappy to show you the client dashboard if useful.\n\nThanks,\nJo" },
  ]

  const dailyA = mkDaily(21, 55, { open: 0.58, reply: 0.072 })
  const dailyB = mkDaily(12, 30, { open: 0.51, reply: 0.058 })

  const campaigns = [
    {
      id: uid('cmp'), name: 'SaaS founders — Q3 outbound', status: 'active', createdAt: now - 21 * DAY,
      steps: seqA, accountIds: [accounts[0].id, accounts[1].id], dailyLimit: 70,
      schedule: { days: [1, 2, 3, 4, 5], from: '09:00', to: '17:00', timezone: 'America/New_York' },
      stopOnReply: true, trackOpens: true,
      daily: dailyA,
      stats: { sent: sum(dailyA, 'sent'), opened: sum(dailyA, 'opened'), replied: sum(dailyA, 'replied'), positive: Math.round(sum(dailyA, 'replied') * 0.42), bounced: Math.round(sum(dailyA, 'sent') * 0.013) },
    },
    {
      id: uid('cmp'), name: 'Agencies — white label pitch', status: 'active', createdAt: now - 12 * DAY,
      steps: seqB, accountIds: [accounts[1].id, accounts[2].id], dailyLimit: 45,
      schedule: { days: [1, 2, 3, 4, 5], from: '08:00', to: '16:00', timezone: 'America/New_York' },
      stopOnReply: true, trackOpens: true,
      daily: dailyB,
      stats: { sent: sum(dailyB, 'sent'), opened: sum(dailyB, 'opened'), replied: sum(dailyB, 'replied'), positive: Math.round(sum(dailyB, 'replied') * 0.38), bounced: Math.round(sum(dailyB, 'sent') * 0.016) },
    },
    {
      id: uid('cmp'), name: 'Ecommerce ops leaders (draft)', status: 'draft', createdAt: now - 2 * DAY,
      steps: [{ id: uid('step'), subject: '', waitDays: 0, body: '' }], accountIds: [], dailyLimit: 50,
      schedule: { days: [1, 2, 3, 4, 5], from: '09:00', to: '17:00', timezone: 'America/New_York' },
      stopOnReply: true, trackOpens: true, daily: [],
      stats: { sent: 0, opened: 0, replied: 0, positive: 0, bounced: 0 },
    },
  ]

  const leads = []
  for (let i = 0; i < 120; i++) {
    const first = pick(FIRST, i)
    const last = pick(LAST, i * 3 + 1)
    const company = pick(COMPANIES, i * 7 + 2)
    const domain = company.toLowerCase().replace(/[^a-z]/g, '') + '.com'
    const campaignId = i < 70 ? campaigns[0].id : i < 105 ? campaigns[1].id : null
    const roll = (i * 13) % 100
    const status = roll < 6 ? 'replied' : roll < 8 ? 'bounced' : roll < 9 ? 'unsubscribed' : 'active'
    leads.push({
      id: uid('lead'),
      email: `${first.toLowerCase()}.${last.toLowerCase()}@${domain}`,
      firstName: first, lastName: last, company, title: pick(TITLES, i * 5),
      status, verified: roll !== 42, campaignId, step: campaignId ? (i % 3) : 0,
    })
  }

  const repliedLeads = leads.filter((l) => l.status === 'replied')
  const inbox = repliedLeads.map((lead, i) => {
    const sample = pick(REPLY_SAMPLES, i)
    return {
      id: uid('msg'),
      leadId: lead.id,
      campaignId: lead.campaignId || campaigns[0].id,
      from: `${lead.firstName} ${lead.lastName} <${lead.email}>`,
      subject: `Re: Quick question for ${lead.company}`,
      body: sample.text,
      intent: sample.intent,
      receivedAt: now - ((i * 11) % 96) * 3600 * 1000,
      read: i % 3 === 0,
      starred: sample.intent === 'interested' || sample.intent === 'meeting',
    }
  }).sort((a, b) => b.receivedAt - a.receivedAt)

  return {
    settings: { workspaceName: 'My workspace', senderName: 'Jo', demo: true },
    accounts,
    leads,
    campaigns,
    inbox,
    activity: [
      { id: uid('act'), ts: now - 2 * 3600e3, type: 'reply', text: 'New reply from Maya Okafor (Quantia) — flagged Interested' },
      { id: uid('act'), ts: now - 5 * 3600e3, type: 'send', text: 'SaaS founders — Q3 outbound: 48 emails sent today' },
      { id: uid('act'), ts: now - 8 * 3600e3, type: 'warmup', text: 'jordan@coldstream-hq.com warmup day 6 complete — health 71' },
      { id: uid('act'), ts: now - DAY, type: 'reply', text: 'Meeting booked with Theo Berg (Signalhouse)' },
    ],
    waitlist: [],
    lastTick: now,
  }
}

export { REPLY_SAMPLES }
