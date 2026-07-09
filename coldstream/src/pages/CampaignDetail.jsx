import { useParams, Link, useNavigate } from 'react-router-dom'
import { useStore, patchCampaign, deleteCampaign } from '../lib/store.js'
import { PageHeader, Button, Card, Stat, StatusBadge, Badge, fmtNum, fmtPct } from '../components/ui.jsx'
import { DailyChart, Funnel } from '../components/charts.jsx'
import { renderEmail } from '../lib/spintax.js'

export default function CampaignDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  // Select stable references only — getSnapshot must not build new arrays
  const campaign = useStore((s) => s.campaigns.find((c) => c.id === id))
  const allLeads = useStore((s) => s.leads)
  const inbox = useStore((s) => s.inbox)
  const leads = allLeads.filter((l) => l.campaignId === id)
  const replies = inbox.filter((m) => m.campaignId === id)

  if (!campaign) {
    return (
      <div>
        <PageHeader title="Campaign not found" />
        <Link to="/app/campaigns" className="text-brand-300 hover:underline">← Back to campaigns</Link>
      </div>
    )
  }

  const { stats } = campaign
  const sample = leads[0] || { firstName: 'Ava', company: 'Quantia' }
  const active = leads.filter((l) => l.status === 'active').length

  return (
    <div>
      <PageHeader
        title={campaign.name}
        sub={<span className="flex items-center gap-2"><StatusBadge status={campaign.status} /> {fmtNum(leads.length)} leads · {active} still in sequence</span>}
        actions={
          <>
            {campaign.status === 'active' && <Button variant="secondary" onClick={() => patchCampaign(id, { status: 'paused' })}>Pause</Button>}
            {campaign.status === 'paused' && <Button onClick={() => patchCampaign(id, { status: 'active' })}>Resume</Button>}
            {campaign.status === 'draft' && leads.length > 0 && campaign.accountIds.length > 0 && (
              <Button onClick={() => patchCampaign(id, { status: 'active' })}>🚀 Launch</Button>
            )}
            <Button variant="ghost" onClick={() => { if (confirm(`Delete "${campaign.name}"? Leads are kept, campaign stats are not.`)) { deleteCampaign(id); navigate('/app/campaigns') } }}>
              Delete
            </Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        <Stat label="Sent" value={fmtNum(stats.sent)} />
        <Stat label="Open rate" value={fmtPct(stats.opened, stats.sent)} />
        <Stat label="Reply rate" value={fmtPct(stats.replied, stats.sent)} />
        <Stat label="Positive replies" value={fmtNum(stats.positive)} tone="positive" sub={`${fmtPct(stats.bounced, stats.sent)} bounce rate`} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h3 className="mb-3 font-medium text-white">Daily activity</h3>
          <DailyChart daily={campaign.daily} />
        </Card>
        <Card>
          <h3 className="mb-3 font-medium text-white">Funnel</h3>
          <Funnel stats={stats} />
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <h3 className="mb-3 font-medium text-white">Sequence ({campaign.steps.length} steps)</h3>
          <div className="space-y-3">
            {campaign.steps.map((s, i) => (
              <div key={s.id || i} className="rounded-lg border border-ink-700 p-4">
                <div className="mb-2 flex items-center gap-2 text-xs text-slate-500">
                  <Badge tone="brand">Step {i + 1}</Badge>
                  {i > 0 && <span>after {s.waitDays} day{s.waitDays > 1 ? 's' : ''}</span>}
                </div>
                {s.subject
                  ? <div className="text-sm font-medium text-slate-200">{renderEmail(s.subject, sample, (o) => o[0])}</div>
                  : <div className="text-sm italic text-slate-500">Sends in the same thread</div>}
                <p className="mt-1 line-clamp-3 whitespace-pre-line text-xs text-slate-400">{renderEmail(s.body, sample, (o) => o[0])}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-medium text-white">Replies ({replies.length})</h3>
            <Link to="/app/unibox" className="text-xs text-brand-300 hover:underline">Open in Unibox →</Link>
          </div>
          {replies.length === 0 && <p className="text-sm text-slate-500">No replies yet.</p>}
          <div className="space-y-2">
            {replies.slice(0, 6).map((m) => (
              <div key={m.id} className="rounded-lg border border-ink-700 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">{m.from.split('<')[0].trim()}</span>
                  <Badge tone={m.intent === 'interested' || m.intent === 'meeting' ? 'positive' : m.intent === 'not_interested' || m.intent === 'unsubscribe' ? 'negative' : 'neutral'}>
                    {m.intent.replace(/_/g, ' ')}
                  </Badge>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-slate-300">{m.body}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
