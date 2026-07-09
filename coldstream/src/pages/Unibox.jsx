import { useState } from 'react'
import { useStore, patchMessage } from '../lib/store.js'
import { INTENTS } from '../lib/intent.js'
import { draftReply } from '../lib/ai.js'
import { PageHeader, Button, Badge, Textarea, timeAgo, EmptyState } from '../components/ui.jsx'

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'positive', label: '🔥 Interested' },
  { key: 'question', label: 'Questions' },
  { key: 'later', label: 'Later' },
  { key: 'negative', label: 'Not a fit' },
]

function bucket(intent) {
  if (intent === 'interested' || intent === 'meeting') return 'positive'
  if (intent === 'question') return 'question'
  if (intent === 'not_now' || intent === 'out_of_office' || intent === 'wrong_person') return 'later'
  return 'negative'
}

function intentTone(intent) {
  const tone = INTENTS[intent]?.tone
  return tone === 'positive' ? 'positive' : tone === 'negative' ? 'negative' : 'neutral'
}

export default function Unibox() {
  const inbox = useStore((s) => s.inbox)
  const leads = useStore((s) => s.leads)
  const campaigns = useStore((s) => s.campaigns)
  const [filter, setFilter] = useState('all')
  const [selectedId, setSelectedId] = useState(null)
  const [reply, setReply] = useState('')
  const [sentNote, setSentNote] = useState(false)

  const filtered = inbox.filter((m) => filter === 'all' || bucket(m.intent) === filter)
  const selected = inbox.find((m) => m.id === selectedId) || filtered[0]
  const lead = selected && leads.find((l) => l.id === selected.leadId)
  const campaign = selected && campaigns.find((c) => c.id === selected.campaignId)

  const open = (m) => {
    setSelectedId(m.id)
    setReply('')
    setSentNote(false)
    if (!m.read) patchMessage(m.id, { read: true })
  }

  const counts = inbox.reduce((a, m) => { const b = bucket(m.intent); a[b] = (a[b] || 0) + 1; return a }, {})

  return (
    <div>
      <PageHeader
        title="Unibox"
        sub="Every reply from every inbox, auto-labeled by intent — answer the yeses first."
      />

      <div className="mb-4 flex gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => { setFilter(f.key); setSelectedId(null) }}
            className={`rounded-lg px-3 py-1.5 text-sm ${filter === f.key ? 'bg-brand-500/20 font-medium text-brand-300' : 'text-slate-400 hover:bg-ink-800'}`}
          >
            {f.label}{f.key !== 'all' && counts[f.key] ? ` (${counts[f.key]})` : ''}
          </button>
        ))}
      </div>

      {inbox.length === 0 ? (
        <EmptyState title="No replies yet" body="Once your campaigns get replies they land here, labeled by intent." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-5">
          <div className="max-h-[70vh] space-y-1.5 overflow-y-auto pr-1 lg:col-span-2">
            {filtered.map((m) => (
              <button
                key={m.id}
                onClick={() => open(m)}
                className={`block w-full rounded-lg border p-3 text-left transition-colors ${
                  selected?.id === m.id ? 'border-brand-500/60 bg-ink-850' : 'border-ink-700 bg-ink-900 hover:border-ink-600'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={`truncate text-sm ${m.read ? 'text-slate-400' : 'font-semibold text-white'}`}>
                    {m.starred && '★ '}{m.from.split('<')[0].trim()}
                  </span>
                  <span className="shrink-0 text-xs text-slate-600">{timeAgo(m.receivedAt)}</span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <Badge tone={intentTone(m.intent)}>{INTENTS[m.intent]?.label || m.intent}</Badge>
                  <span className="truncate text-xs text-slate-500">{m.body}</span>
                </div>
              </button>
            ))}
            {filtered.length === 0 && <p className="p-4 text-sm text-slate-500">Nothing in this bucket.</p>}
          </div>

          <div className="lg:col-span-3">
            {selected ? (
              <div className="rounded-xl border border-ink-700 bg-ink-900 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-white">{selected.from}</div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      {selected.subject} · via {campaign?.name || 'campaign'} · {timeAgo(selected.receivedAt)}
                    </div>
                  </div>
                  <Badge tone={intentTone(selected.intent)}>{INTENTS[selected.intent]?.label}</Badge>
                </div>

                {lead && (
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 rounded-lg bg-ink-850 px-3 py-2 text-xs text-slate-400">
                    <span>🏢 {lead.company || '—'}</span>
                    <span>💼 {lead.title || '—'}</span>
                    <span>✉ {lead.email}</span>
                  </div>
                )}

                <div className="mt-4 whitespace-pre-line rounded-lg border border-ink-700 bg-ink-950 p-4 text-sm leading-relaxed text-slate-200">
                  {selected.body}
                </div>

                <div className="mt-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-medium text-white">Reply</span>
                    <Button size="sm" variant="secondary" onClick={() => setReply(draftReply(selected.intent, lead))}>
                      ✨ Draft with AI
                    </Button>
                  </div>
                  <Textarea rows={6} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Write a reply…" />
                  <div className="mt-2 flex items-center gap-3">
                    <Button disabled={!reply.trim()} onClick={() => { setSentNote(true); setReply('') }}>Send reply</Button>
                    <Button variant="ghost" size="sm" onClick={() => patchMessage(selected.id, { starred: !selected.starred })}>
                      {selected.starred ? '★ Starred' : '☆ Star'}
                    </Button>
                    {sentNote && <span className="text-xs text-emerald-400">Sent ✓ (demo — wire SMTP to send for real)</span>}
                  </div>
                </div>
              </div>
            ) : (
              <p className="p-6 text-sm text-slate-500">Select a message.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
