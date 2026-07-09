import { useState } from 'react'
import { useStore, addLeads, patchLead } from '../lib/store.js'
import { parseLeadsCsv } from '../lib/csv.js'
import { PageHeader, Button, Modal, Textarea, Badge, StatusBadge, Input, Select, fmtNum } from '../components/ui.jsx'

export default function Leads() {
  const leads = useStore((s) => s.leads)
  const campaigns = useStore((s) => s.campaigns)
  const [importOpen, setImportOpen] = useState(false)
  const [csvText, setCsvText] = useState('')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const campaignName = (id) => campaigns.find((c) => c.id === id)?.name || '—'

  const parsed = csvText ? parseLeadsCsv(csvText) : { leads: [], skipped: 0 }

  const doImport = () => {
    addLeads(parsed.leads)
    setCsvText('')
    setImportOpen(false)
  }

  const onFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setCsvText(String(reader.result))
    reader.readAsText(file)
  }

  const filtered = leads.filter((l) => {
    if (statusFilter !== 'all' && l.status !== statusFilter) return false
    if (!query) return true
    const q = query.toLowerCase()
    return [l.email, l.firstName, l.lastName, l.company, l.title].join(' ').toLowerCase().includes(q)
  })

  const counts = leads.reduce((a, l) => ({ ...a, [l.status]: (a[l.status] || 0) + 1 }), {})

  return (
    <div>
      <PageHeader
        title="Leads"
        sub={`${fmtNum(leads.length)} total · ${fmtNum(counts.active || 0)} active · ${fmtNum(counts.replied || 0)} replied · ${fmtNum(counts.bounced || 0)} bounced`}
        actions={<Button onClick={() => setImportOpen(true)}>＋ Import CSV</Button>}
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <Input className="!w-64" placeholder="Search name, email, company…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <Select className="!w-44" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="replied">Replied</option>
          <option value="bounced">Bounced</option>
          <option value="unsubscribed">Unsubscribed</option>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-ink-700">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-ink-700 bg-ink-900 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3 font-medium">Lead</th>
              <th className="px-4 py-3 font-medium">Company</th>
              <th className="px-4 py-3 font-medium">Title</th>
              <th className="px-4 py-3 font-medium">Campaign</th>
              <th className="px-4 py-3 font-medium">Verified</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 100).map((l) => (
              <tr key={l.id} className="border-b border-ink-800 bg-ink-950 last:border-0 hover:bg-ink-900">
                <td className="px-4 py-2.5">
                  <div className="text-slate-200">{l.firstName} {l.lastName}</div>
                  <div className="text-xs text-slate-500">{l.email}</div>
                </td>
                <td className="px-4 py-2.5 text-slate-300">{l.company || '—'}</td>
                <td className="px-4 py-2.5 text-slate-400">{l.title || '—'}</td>
                <td className="px-4 py-2.5 text-xs text-slate-400">{campaignName(l.campaignId)}</td>
                <td className="px-4 py-2.5">
                  {l.verified ? <Badge tone="positive">Valid</Badge> : <Badge tone="warning">Risky</Badge>}
                </td>
                <td className="px-4 py-2.5">
                  {l.status === 'active'
                    ? <button onClick={() => patchLead(l.id, { status: 'unsubscribed' })} title="Click to unsubscribe"><StatusBadge status={l.status} /></button>
                    : <StatusBadge status={l.status} />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length > 100 && (
          <div className="border-t border-ink-800 bg-ink-900 px-4 py-2 text-xs text-slate-500">Showing first 100 of {fmtNum(filtered.length)}</div>
        )}
        {filtered.length === 0 && <div className="bg-ink-950 px-4 py-10 text-center text-sm text-slate-500">No leads match.</div>}
      </div>

      <Modal open={importOpen} onClose={() => setImportOpen(false)} title="Import leads" wide>
        <p className="mb-3 text-sm text-slate-400">
          Paste CSV or upload a file. We map common headers automatically (email, first name, company, title…) and any extra column becomes a merge tag. Duplicates and invalid emails are skipped.
        </p>
        <label className="mb-2 inline-block cursor-pointer rounded-lg border border-ink-600 px-3 py-1.5 text-xs text-slate-300 hover:border-brand-400">
          Upload CSV <input type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />
        </label>
        <Textarea rows={8} className="font-mono text-xs" value={csvText} onChange={(e) => setCsvText(e.target.value)}
          placeholder={'email,first name,company\nava.chen@brightloop.com,Ava,Brightloop'} />
        <div className="mt-3 flex items-center justify-between">
          <div className="flex gap-2 text-sm">
            {parsed.leads.length > 0 && <Badge tone="positive">{parsed.leads.length} ready</Badge>}
            {parsed.skipped > 0 && <Badge tone="warning">{parsed.skipped} skipped</Badge>}
          </div>
          <Button disabled={parsed.leads.length === 0} onClick={doImport}>Import {parsed.leads.length > 0 ? parsed.leads.length : ''} leads</Button>
        </div>
      </Modal>
    </div>
  )
}
