import { Link, useNavigate } from 'react-router-dom'
import { useStore, patchCampaign, deleteCampaign } from '../lib/store.js'
import { PageHeader, Button, StatusBadge, fmtNum, fmtPct, EmptyState } from '../components/ui.jsx'

export default function Campaigns() {
  const campaigns = useStore((s) => s.campaigns)
  const leads = useStore((s) => s.leads)
  const navigate = useNavigate()

  return (
    <div>
      <PageHeader
        title="Campaigns"
        sub="Sequences, sending schedules, and results in one place."
        actions={<Link to="/app/campaigns/new"><Button>＋ New campaign</Button></Link>}
      />

      {campaigns.length === 0 ? (
        <EmptyState
          title="No campaigns yet"
          body="Create your first campaign: import leads, write (or AI-generate) a sequence, pick sending accounts, launch."
          action={<Link to="/app/campaigns/new"><Button>Create campaign</Button></Link>}
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-ink-700">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-ink-700 bg-ink-900 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3 font-medium">Campaign</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Leads</th>
                <th className="px-4 py-3 font-medium text-right">Sent</th>
                <th className="px-4 py-3 font-medium text-right">Opens</th>
                <th className="px-4 py-3 font-medium text-right">Replies</th>
                <th className="px-4 py-3 font-medium text-right">Positive</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => {
                const leadCount = leads.filter((l) => l.campaignId === c.id).length
                return (
                  <tr
                    key={c.id}
                    className="cursor-pointer border-b border-ink-800 bg-ink-950 last:border-0 hover:bg-ink-900"
                    onClick={() => navigate(`/app/campaigns/${c.id}`)}
                  >
                    <td className="px-4 py-3 font-medium text-slate-200">{c.name}</td>
                    <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-400">{fmtNum(leadCount)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-400">{fmtNum(c.stats.sent)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-400">{fmtPct(c.stats.opened, c.stats.sent)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-300">{fmtPct(c.stats.replied, c.stats.sent)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-emerald-400">{fmtNum(c.stats.positive)}</td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      {c.status === 'active' && (
                        <Button size="sm" variant="secondary" onClick={() => patchCampaign(c.id, { status: 'paused' })}>Pause</Button>
                      )}
                      {c.status === 'paused' && (
                        <Button size="sm" variant="secondary" onClick={() => patchCampaign(c.id, { status: 'active' })}>Resume</Button>
                      )}
                      {c.status === 'draft' && (
                        <Button size="sm" variant="ghost" onClick={() => { if (confirm(`Delete draft "${c.name}"?`)) deleteCampaign(c.id) }}>Delete</Button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
