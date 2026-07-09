import { useState } from 'react'
import { useStore, addAccount, patchAccount, removeAccount, logActivity } from '../lib/store.js'
import { PageHeader, Button, Card, Modal, Input, Select, Toggle, ProgressBar, healthTone, Badge } from '../components/ui.jsx'

export default function Accounts() {
  const accounts = useStore((s) => s.accounts)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ email: '', provider: 'Google Workspace', dailyLimit: 30, warmupEnabled: true })

  const connect = () => {
    addAccount({ ...form, dailyLimit: Number(form.dailyLimit) || 30, healthScore: 55 + Math.floor(Math.random() * 15), warmupDay: 0, sentToday: 0 })
    logActivity(`Connected ${form.email} — warmup ${form.warmupEnabled ? 'started' : 'off'}`, 'warmup')
    setForm({ email: '', provider: 'Google Workspace', dailyLimit: 30, warmupEnabled: true })
    setOpen(false)
  }

  return (
    <div>
      <PageHeader
        title="Email accounts"
        sub="Unlimited sending inboxes — connect as many as you like, no per-account fees."
        actions={<Button onClick={() => setOpen(true)}>＋ Connect account</Button>}
      />

      <div className="grid gap-4 md:grid-cols-2">
        {accounts.map((a) => (
          <Card key={a.id}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate font-medium text-white">{a.email}</div>
                <div className="mt-0.5 text-xs text-slate-500">{a.provider} · limit {a.dailyLimit}/day · sent {a.sentToday} today</div>
              </div>
              <Badge tone={a.healthScore >= 85 ? 'positive' : a.healthScore >= 65 ? 'warning' : 'negative'}>
                Health {a.healthScore}
              </Badge>
            </div>

            <div className="mt-4">
              <div className="mb-1 flex justify-between text-xs text-slate-500">
                <span>Deliverability health</span>
                <span>{a.healthScore}/100</span>
              </div>
              <ProgressBar value={a.healthScore} tone={healthTone(a.healthScore)} />
            </div>

            <div className="mt-4 flex items-center justify-between">
              <Toggle
                checked={a.warmupEnabled}
                onChange={(v) => patchAccount(a.id, { warmupEnabled: v })}
                label={a.warmupEnabled ? `Warmup on — day ${Math.floor(a.warmupDay)}` : 'Warmup off'}
              />
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs text-slate-500">
                  limit
                  <Input
                    type="number" min="1" max="200" className="!w-16 !py-1 text-center"
                    value={a.dailyLimit}
                    onChange={(e) => patchAccount(a.id, { dailyLimit: Number(e.target.value) || 1 })}
                  />
                </label>
                <Button size="sm" variant="ghost" onClick={() => { if (confirm(`Disconnect ${a.email}?`)) removeAccount(a.id) }}>
                  Disconnect
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="mt-4 border-dashed">
        <h3 className="font-medium text-white">Deliverability checklist</h3>
        <ul className="mt-2 space-y-1.5 text-sm text-slate-400">
          <li>✓ SPF, DKIM and DMARC records verified on connect</li>
          <li>✓ Warmup ramps volume gradually over 3–4 weeks per inbox</li>
          <li>✓ Sends are spread across inboxes and through business hours</li>
          <li>✓ Custom tracking domain recommended before scaling past 100/day</li>
        </ul>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Connect an email account">
        <p className="mb-4 text-sm text-slate-400">
          In production this is OAuth for Google/Microsoft or SMTP + IMAP credentials. The demo connects a simulated inbox that starts warming immediately.
        </p>
        <label className="mb-1 block text-xs text-slate-500">Email address</label>
        <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@yourdomain.com" />
        <label className="mb-1 mt-3 block text-xs text-slate-500">Provider</label>
        <Select value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })}>
          <option>Google Workspace</option>
          <option>Microsoft 365</option>
          <option>Custom SMTP/IMAP</option>
        </Select>
        <label className="mb-1 mt-3 block text-xs text-slate-500">Daily sending limit</label>
        <Input type="number" min="1" max="200" value={form.dailyLimit} onChange={(e) => setForm({ ...form, dailyLimit: e.target.value })} />
        <div className="mt-4">
          <Toggle checked={form.warmupEnabled} onChange={(v) => setForm({ ...form, warmupEnabled: v })} label="Start warmup immediately (recommended)" />
        </div>
        <Button className="mt-5 w-full" disabled={!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)} onClick={connect}>
          Connect
        </Button>
      </Modal>
    </div>
  )
}
