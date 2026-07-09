import { useStore, patchAccount } from '../lib/store.js'
import { PageHeader, Card, Toggle, ProgressBar, healthTone, Badge } from '../components/ui.jsx'

// What drives the health score, and the fix when a factor is weak.
function factors(account) {
  const day = Math.floor(account.warmupDay)
  return [
    { label: 'Authentication (SPF · DKIM · DMARC)', score: 100, fix: null },
    { label: 'Warmup maturity', score: Math.min(100, Math.round((day / 28) * 100)), fix: 'Keep warmup on — full trust takes ~4 weeks per inbox.' },
    { label: 'Volume discipline', score: account.sentToday <= account.dailyLimit ? 95 : 55, fix: 'Stay under the daily limit; sudden spikes look like spam.' },
    { label: 'Spam placement rescue', score: account.warmupEnabled ? 90 : 40, fix: 'Warmup peers pull your mail out of spam and mark it important.' },
    { label: 'Reply engagement', score: Math.min(100, account.healthScore + 5), fix: 'Inboxes that get replies earn sender reputation fastest.' },
  ]
}

export default function Warmup() {
  const accounts = useStore((s) => s.accounts)
  const warming = accounts.filter((a) => a.warmupEnabled).length

  return (
    <div>
      <PageHeader
        title="Warmup"
        sub={`${warming} of ${accounts.length} inboxes warming — every account exchanges human-like email with the peer network daily.`}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {accounts.map((a) => {
          const fs = factors(a)
          const weakest = fs.filter((f) => f.fix && f.score < 80).sort((x, y) => x.score - y.score)[0]
          return (
            <Card key={a.id}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-medium text-white">{a.email}</div>
                  <div className="mt-0.5 text-xs text-slate-500">
                    Day {Math.floor(a.warmupDay)} of warmup · {a.provider}
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-3xl font-bold ${a.healthScore >= 85 ? 'text-emerald-400' : a.healthScore >= 65 ? 'text-amber-400' : 'text-red-400'}`}>
                    {a.healthScore}
                  </div>
                  <div className="text-[10px] uppercase tracking-wide text-slate-500">health score</div>
                </div>
              </div>

              <div className="mt-4 space-y-2.5">
                {fs.map((f) => (
                  <div key={f.label}>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="text-slate-400">{f.label}</span>
                      <span className="tabular-nums text-slate-500">{f.score}</span>
                    </div>
                    <ProgressBar value={f.score} tone={healthTone(f.score)} />
                  </div>
                ))}
              </div>

              {weakest && (
                <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
                  <strong>Next fix:</strong> {weakest.fix}
                </div>
              )}
              {!weakest && a.healthScore >= 85 && (
                <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
                  Ready to send at full volume. <Badge tone="positive" className="ml-1">Safe to scale</Badge>
                </div>
              )}

              <div className="mt-4 border-t border-ink-800 pt-3">
                <Toggle
                  checked={a.warmupEnabled}
                  onChange={(v) => patchAccount(a.id, { warmupEnabled: v })}
                  label={a.warmupEnabled ? 'Warmup active' : 'Warmup paused — health will decay'}
                />
              </div>
            </Card>
          )
        })}
      </div>

      <Card className="mt-4">
        <h3 className="font-medium text-white">How Coldstream warmup works</h3>
        <div className="mt-3 grid gap-4 text-sm text-slate-400 md:grid-cols-3">
          <div>
            <div className="font-medium text-slate-200">1 · Ramp</div>
            Volume starts at a handful of peer emails a day and climbs ~15% daily, mimicking a real human inbox coming online.
          </div>
          <div>
            <div className="font-medium text-slate-200">2 · Engage</div>
            Peer inboxes open, reply to, and star your messages — the engagement signals mailbox providers actually weigh.
          </div>
          <div>
            <div className="font-medium text-slate-200">3 · Rescue</div>
            Anything that lands in spam gets pulled to the inbox and marked "not spam", actively repairing your reputation.
          </div>
        </div>
      </Card>
    </div>
  )
}
