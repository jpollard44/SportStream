import { useStore } from '../lib/store.js'
import { INTENTS } from '../lib/intent.js'
import { PageHeader, Card, Stat, fmtNum, fmtPct } from '../components/ui.jsx'
import { DailyChart, BreakdownBars, Funnel, SERIES } from '../components/charts.jsx'

export default function Analytics() {
  const campaigns = useStore((s) => s.campaigns)
  const inbox = useStore((s) => s.inbox)

  const totals = campaigns.reduce(
    (a, c) => ({
      sent: a.sent + c.stats.sent, opened: a.opened + c.stats.opened,
      replied: a.replied + c.stats.replied, positive: a.positive + c.stats.positive,
      bounced: a.bounced + c.stats.bounced,
    }),
    { sent: 0, opened: 0, replied: 0, positive: 0, bounced: 0 },
  )

  const byDate = new Map()
  for (const c of campaigns) {
    for (const d of c.daily) {
      const cur = byDate.get(d.date) || { date: d.date, sent: 0, opened: 0, replied: 0 }
      cur.sent += d.sent; cur.opened += d.opened; cur.replied += d.replied
      byDate.set(d.date, cur)
    }
  }
  const daily = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))

  const intentCounts = inbox.reduce((a, m) => ({ ...a, [m.intent]: (a[m.intent] || 0) + 1 }), {})
  const intentItems = Object.entries(intentCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([intent, value], i) => ({ label: INTENTS[intent]?.label || intent, value, color: SERIES[i % SERIES.length] }))

  const rows = campaigns
    .filter((c) => c.stats.sent > 0)
    .sort((a, b) => (b.stats.replied / b.stats.sent) - (a.stats.replied / a.stats.sent))

  return (
    <div>
      <PageHeader title="Analytics" sub="Positive reply rate is the number that pays — everything else explains it." />

      <div className="grid gap-4 md:grid-cols-4">
        <Stat label="Sent" value={fmtNum(totals.sent)} />
        <Stat label="Open rate" value={fmtPct(totals.opened, totals.sent)} />
        <Stat label="Reply rate" value={fmtPct(totals.replied, totals.sent)} />
        <Stat label="Positive reply rate" value={fmtPct(totals.positive, totals.sent)} tone="positive" sub={`bounce ${fmtPct(totals.bounced, totals.sent)}`} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h3 className="mb-3 font-medium text-white">Workspace activity</h3>
          <DailyChart daily={daily} height={200} />
        </Card>
        <Card>
          <h3 className="mb-3 font-medium text-white">Funnel</h3>
          <Funnel stats={totals} />
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <h3 className="mb-3 font-medium text-white">Reply intents</h3>
          {intentItems.length === 0
            ? <p className="text-sm text-slate-500">No replies yet.</p>
            : <BreakdownBars items={intentItems} />}
        </Card>

        <Card>
          <h3 className="mb-3 font-medium text-white">Campaign leaderboard — by reply rate</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 font-medium">Campaign</th>
                <th className="py-2 text-right font-medium">Sent</th>
                <th className="py-2 text-right font-medium">Replies</th>
                <th className="py-2 text-right font-medium">Rate</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="border-t border-ink-800">
                  <td className="py-2 text-slate-200">{c.name}</td>
                  <td className="py-2 text-right tabular-nums text-slate-400">{fmtNum(c.stats.sent)}</td>
                  <td className="py-2 text-right tabular-nums text-slate-400">{fmtNum(c.stats.replied)}</td>
                  <td className="py-2 text-right tabular-nums font-medium text-white">{fmtPct(c.stats.replied, c.stats.sent)}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan="4" className="py-6 text-center text-slate-500">Launch a campaign to see results here.</td></tr>}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  )
}
