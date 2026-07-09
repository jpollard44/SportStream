import { Link } from 'react-router-dom'
import { useStore } from '../lib/store.js'
import { Card, Stat, PageHeader, Button, fmtPct, fmtNum, timeAgo, StatusBadge, healthTone, ProgressBar } from '../components/ui.jsx'
import { DailyChart } from '../components/charts.jsx'

export default function Dashboard() {
  const { campaigns, accounts, inbox, activity, leads } = useStore()

  const totals = campaigns.reduce(
    (a, c) => ({
      sent: a.sent + c.stats.sent, opened: a.opened + c.stats.opened,
      replied: a.replied + c.stats.replied, positive: a.positive + c.stats.positive,
    }),
    { sent: 0, opened: 0, replied: 0, positive: 0 },
  )

  // Merge all campaign daily series into one workspace series
  const byDate = new Map()
  for (const c of campaigns) {
    for (const d of c.daily) {
      const cur = byDate.get(d.date) || { date: d.date, sent: 0, opened: 0, replied: 0 }
      cur.sent += d.sent; cur.opened += d.opened; cur.replied += d.replied
      byDate.set(d.date, cur)
    }
  }
  const daily = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
  const unread = inbox.filter((m) => !m.read).length
  const hot = inbox.filter((m) => (m.intent === 'interested' || m.intent === 'meeting')).slice(0, 4)

  return (
    <div>
      <PageHeader
        title="Dashboard"
        sub={`${campaigns.filter((c) => c.status === 'active').length} active campaigns · ${fmtNum(leads.length)} leads · ${accounts.length} sending accounts`}
        actions={<Link to="/app/campaigns/new"><Button>＋ New campaign</Button></Link>}
      />

      <div className="grid gap-4 md:grid-cols-4">
        <Stat label="Emails sent" value={fmtNum(totals.sent)} sub="all campaigns" />
        <Stat label="Open rate" value={fmtPct(totals.opened, totals.sent)} sub={`${fmtNum(totals.opened)} opens`} />
        <Stat label="Reply rate" value={fmtPct(totals.replied, totals.sent)} sub={`${fmtNum(totals.replied)} replies`} />
        <Stat label="Positive replies" value={fmtNum(totals.positive)} sub={`${fmtPct(totals.positive, totals.replied)} of replies`} tone="positive" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h3 className="mb-3 font-medium text-white">Sending activity — last 21 days</h3>
          <DailyChart daily={daily} />
        </Card>

        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-medium text-white">Hot replies</h3>
            <Link to="/app/unibox" className="text-xs text-brand-300 hover:underline">Unibox ({unread} unread) →</Link>
          </div>
          {hot.length === 0 && <p className="text-sm text-slate-500">No positive replies yet — they'll show up here.</p>}
          <div className="space-y-3">
            {hot.map((m) => (
              <Link key={m.id} to="/app/unibox" className="block rounded-lg border border-ink-700 p-3 hover:border-brand-500/50">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="truncate">{m.from.split('<')[0].trim()}</span>
                  <span>{timeAgo(m.receivedAt)}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-slate-300">{m.body}</p>
              </Link>
            ))}
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-medium text-white">Campaigns</h3>
            <Link to="/app/campaigns" className="text-xs text-brand-300 hover:underline">View all →</Link>
          </div>
          <div className="space-y-2">
            {campaigns.slice(0, 4).map((c) => (
              <Link key={c.id} to={`/app/campaigns/${c.id}`} className="flex items-center gap-4 rounded-lg border border-ink-700 px-4 py-3 hover:border-brand-500/50">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-slate-200">{c.name}</div>
                  <div className="text-xs text-slate-500">{fmtNum(c.stats.sent)} sent · {fmtPct(c.stats.replied, c.stats.sent)} reply rate</div>
                </div>
                <StatusBadge status={c.status} />
              </Link>
            ))}
          </div>
        </Card>

        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-medium text-white">Inbox health</h3>
            <Link to="/app/warmup" className="text-xs text-brand-300 hover:underline">Warmup →</Link>
          </div>
          <div className="space-y-4">
            {accounts.map((a) => (
              <div key={a.id}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="truncate text-slate-300">{a.email}</span>
                  <span className="font-semibold text-white">{a.healthScore}</span>
                </div>
                <ProgressBar value={a.healthScore} tone={healthTone(a.healthScore)} />
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="mt-4">
        <h3 className="mb-3 font-medium text-white">Recent activity</h3>
        <div className="space-y-2 text-sm">
          {activity.slice(0, 8).map((a) => (
            <div key={a.id} className="flex items-center gap-3 text-slate-400">
              <span className="w-14 shrink-0 text-xs text-slate-600">{timeAgo(a.ts)}</span>
              <span className={a.type === 'reply' ? 'text-slate-200' : ''}>{a.text}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
