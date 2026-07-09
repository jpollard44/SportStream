import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useStore, createCampaign, addLeads, uid, logActivity, getState } from '../lib/store.js'
import { parseLeadsCsv } from '../lib/csv.js'
import { renderEmail, extractMergeTags } from '../lib/spintax.js'
import { generateSequence } from '../lib/ai.js'
import { PageHeader, Button, Card, Input, Textarea, Badge, Toggle, healthTone, ProgressBar } from '../components/ui.jsx'

const WIZARD_STEPS = ['Leads', 'Sequence', 'Sending', 'Review']

export default function CampaignNew() {
  const navigate = useNavigate()
  const accounts = useStore((s) => s.accounts)

  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [csvText, setCsvText] = useState('')
  const [leads, setLeads] = useState([])
  const [skipped, setSkipped] = useState(0)
  const [seq, setSeq] = useState([{ id: uid('step'), subject: '', body: '', waitDays: 0 }])
  const [accountIds, setAccountIds] = useState(accounts.map((a) => a.id))
  const [dailyLimit, setDailyLimit] = useState(50)
  const [stopOnReply, setStopOnReply] = useState(true)
  const [trackOpens, setTrackOpens] = useState(true)
  const [schedule, setSchedule] = useState({ days: [1, 2, 3, 4, 5], from: '09:00', to: '17:00', timezone: 'America/New_York' })
  const [preview, setPreview] = useState(null)

  const importCsv = (text) => {
    setCsvText(text)
    const { leads: parsed, skipped: sk } = parseLeadsCsv(text)
    setLeads(parsed)
    setSkipped(sk)
  }

  const onFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => importCsv(String(reader.result))
    reader.readAsText(file)
  }

  const aiFill = () => {
    const { steps } = generateSequence({
      product: name || 'Coldstream',
      audience: 'growth teams',
      pain: 'juggle four outbound tools and still guess why replies dried up',
      outcome: 'double reply rates in the first month',
      proof: 'avg 2.1× lift across customers',
      senderName: getState().settings.senderName || 'you',
    })
    setSeq(steps.map((s) => ({ ...s, id: uid('step') })))
  }

  const leadFields = new Set(leads.flatMap((l) => Object.keys(l)))
  const missingTags = [...new Set(seq.flatMap((s) => extractMergeTags(s.subject + ' ' + s.body)))]
    .filter((t) => !leadFields.has(t) && t !== 'senderName')

  const canNext =
    step === 0 ? name.trim() && leads.length > 0 :
    step === 1 ? seq.every((s, i) => s.body.trim() && (i > 0 || s.subject.trim())) :
    step === 2 ? accountIds.length > 0 : true

  const launch = (asDraft) => {
    const id = createCampaign({
      name: name.trim(),
      status: asDraft ? 'draft' : 'active',
      steps: seq,
      accountIds,
      dailyLimit: Number(dailyLimit) || 50,
      stopOnReply,
      trackOpens,
      schedule,
    })
    addLeads(leads, id)
    logActivity(`Campaign "${name.trim()}" ${asDraft ? 'saved as draft' : 'launched'} with ${leads.length} leads`, 'send')
    navigate(`/app/campaigns/${id}`)
  }

  const sampleLead = leads[0] || { firstName: 'Ava', company: 'Quantia' }

  return (
    <div>
      <PageHeader
        title="New campaign"
        sub={<span>Step {step + 1} of 4 — {WIZARD_STEPS[step]}</span>}
        actions={<Link to="/app/campaigns"><Button variant="ghost">Cancel</Button></Link>}
      />

      <div className="mb-6 flex gap-2">
        {WIZARD_STEPS.map((label, i) => (
          <button
            key={label}
            onClick={() => i < step && setStep(i)}
            className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-brand-400' : 'bg-ink-700'}`}
            aria-label={label}
          />
        ))}
      </div>

      {step === 0 && (
        <Card>
          <label className="mb-1 block text-sm text-slate-400">Campaign name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="SaaS founders — Q3 outbound" />

          <div className="mt-6 flex items-center justify-between">
            <label className="block text-sm text-slate-400">Leads — upload a CSV or paste below (email, first name, company, …)</label>
            <label className="cursor-pointer rounded-lg border border-ink-600 px-3 py-1.5 text-xs text-slate-300 hover:border-brand-400">
              Upload CSV <input type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />
            </label>
          </div>
          <Textarea
            rows={7}
            className="mt-2 font-mono text-xs"
            value={csvText}
            onChange={(e) => importCsv(e.target.value)}
            placeholder={'email,first name,company,title\nava.chen@brightloop.com,Ava,Brightloop,Head of Sales'}
          />
          <div className="mt-3 flex items-center gap-3 text-sm">
            {leads.length > 0 && <Badge tone="positive">{leads.length} valid leads</Badge>}
            {skipped > 0 && <Badge tone="warning">{skipped} skipped (invalid or duplicate email)</Badge>}
            {leads.length > 0 && (
              <span className="text-xs text-slate-500">Merge tags available: {[...leadFields].map((f) => `{{${f}}}`).join(' ')}</span>
            )}
          </div>
        </Card>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-400">
              Use <code className="rounded bg-ink-800 px-1">{'{{firstName|there}}'}</code> merge tags and{' '}
              <code className="rounded bg-ink-800 px-1">{'{Hi|Hey}'}</code> spintax. Follow-ups with an empty subject send in the same thread.
            </p>
            <Button variant="secondary" size="sm" onClick={aiFill}>✨ Write it for me</Button>
          </div>
          {missingTags.length > 0 && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-400">
              Heads up: {missingTags.map((t) => `{{${t}}}`).join(', ')} {missingTags.length === 1 ? 'is' : 'are'} not a column in your lead list — add a fallback like {'{{'}{missingTags[0]}|there{'}}'}.
            </div>
          )}
          {seq.map((s, i) => (
            <Card key={s.id}>
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Badge tone="brand">Step {i + 1}</Badge>
                  {i > 0 && (
                    <label className="flex items-center gap-2 text-xs text-slate-400">
                      wait
                      <Input type="number" min="1" max="30" className="!w-16 !py-1 text-center" value={s.waitDays}
                        onChange={(e) => setSeq(seq.map((x) => (x.id === s.id ? { ...x, waitDays: Number(e.target.value) } : x)))} />
                      days after step {i}
                    </label>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setPreview({ ...s, index: i })}>Preview</Button>
                  {seq.length > 1 && (
                    <Button variant="ghost" size="sm" onClick={() => setSeq(seq.filter((x) => x.id !== s.id))}>Remove</Button>
                  )}
                </div>
              </div>
              <Input
                placeholder={i === 0 ? 'Subject line' : 'Subject (leave empty to reply in-thread)'}
                value={s.subject}
                onChange={(e) => setSeq(seq.map((x) => (x.id === s.id ? { ...x, subject: e.target.value } : x)))}
              />
              <Textarea
                rows={7}
                className="mt-2"
                placeholder={'{Hi|Hey} {{firstName|there}},\n\nYour email...'}
                value={s.body}
                onChange={(e) => setSeq(seq.map((x) => (x.id === s.id ? { ...x, body: e.target.value } : x)))}
              />
            </Card>
          ))}
          <Button variant="secondary" onClick={() => setSeq([...seq, { id: uid('step'), subject: '', body: '', waitDays: 3 }])}>
            ＋ Add follow-up
          </Button>

          {preview && (
            <Card className="border-brand-500/40">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-medium text-white">Preview — step {preview.index + 1}, rendered for {sampleLead.firstName || sampleLead.email}</span>
                <Button variant="ghost" size="sm" onClick={() => setPreview(null)}>Close</Button>
              </div>
              {preview.subject && <div className="mb-2 text-sm text-slate-300"><span className="text-slate-500">Subject:</span> {renderEmail(preview.subject, sampleLead)}</div>}
              <pre className="whitespace-pre-wrap rounded-lg bg-ink-850 p-4 text-sm text-slate-200">{renderEmail(preview.body, sampleLead)}</pre>
            </Card>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <Card>
            <h3 className="mb-3 font-medium text-white">Sending accounts</h3>
            <p className="mb-3 text-sm text-slate-400">Sends rotate across selected inboxes. Healthier inboxes carry more volume.</p>
            <div className="space-y-2">
              {accounts.map((a) => (
                <label key={a.id} className="flex cursor-pointer items-center gap-3 rounded-lg border border-ink-700 px-4 py-3 hover:border-brand-500/40">
                  <input
                    type="checkbox"
                    checked={accountIds.includes(a.id)}
                    onChange={(e) => setAccountIds(e.target.checked ? [...accountIds, a.id] : accountIds.filter((id) => id !== a.id))}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-slate-200">{a.email}</div>
                    <div className="mt-1 w-40"><ProgressBar value={a.healthScore} tone={healthTone(a.healthScore)} /></div>
                  </div>
                  <span className="text-xs text-slate-500">health {a.healthScore} · limit {a.dailyLimit}/day</span>
                </label>
              ))}
            </div>
            {accounts.length === 0 && <p className="text-sm text-amber-400">No accounts connected yet — add one under Email accounts.</p>}
          </Card>

          <Card>
            <h3 className="mb-3 font-medium text-white">Schedule & limits</h3>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs text-slate-500">Send between</label>
                <div className="flex items-center gap-2">
                  <Input type="time" value={schedule.from} onChange={(e) => setSchedule({ ...schedule, from: e.target.value })} />
                  <span className="text-slate-500">—</span>
                  <Input type="time" value={schedule.to} onChange={(e) => setSchedule({ ...schedule, to: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500">Days</label>
                <div className="flex gap-1">
                  {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => {
                    const day = i + 1
                    const on = schedule.days.includes(day)
                    return (
                      <button
                        key={i}
                        onClick={() => setSchedule({ ...schedule, days: on ? schedule.days.filter((x) => x !== day) : [...schedule.days, day] })}
                        className={`h-9 w-9 rounded-lg text-xs font-medium ${on ? 'bg-brand-500 text-white' : 'bg-ink-800 text-slate-500'}`}
                      >
                        {d}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500">Campaign daily limit</label>
                <Input type="number" min="1" value={dailyLimit} onChange={(e) => setDailyLimit(e.target.value)} />
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-3">
              <Toggle checked={stopOnReply} onChange={setStopOnReply} label="Stop sequence when a lead replies" />
              <Toggle checked={trackOpens} onChange={setTrackOpens} label="Track opens (tracking pixel)" />
            </div>
          </Card>
        </div>
      )}

      {step === 3 && (
        <Card>
          <h3 className="mb-4 font-medium text-white">Ready to launch</h3>
          <dl className="grid gap-x-8 gap-y-3 text-sm md:grid-cols-2">
            <div><dt className="text-slate-500">Campaign</dt><dd className="text-slate-200">{name}</dd></div>
            <div><dt className="text-slate-500">Leads</dt><dd className="text-slate-200">{leads.length} ({skipped} skipped on import)</dd></div>
            <div><dt className="text-slate-500">Sequence</dt><dd className="text-slate-200">{seq.length} step{seq.length > 1 ? 's' : ''} over ~{seq.reduce((a, s) => a + (s.waitDays || 0), 0)} days</dd></div>
            <div><dt className="text-slate-500">Accounts</dt><dd className="text-slate-200">{accountIds.length} inbox{accountIds.length > 1 ? 'es' : ''}, up to {dailyLimit}/day</dd></div>
            <div><dt className="text-slate-500">Window</dt><dd className="text-slate-200">{schedule.from}–{schedule.to}, {schedule.days.length} days/week</dd></div>
            <div><dt className="text-slate-500">On reply</dt><dd className="text-slate-200">{stopOnReply ? 'Stop sequence' : 'Keep sending'}</dd></div>
          </dl>
          <div className="mt-6 flex gap-3">
            <Button onClick={() => launch(false)}>🚀 Launch campaign</Button>
            <Button variant="secondary" onClick={() => launch(true)}>Save as draft</Button>
          </div>
        </Card>
      )}

      <div className="mt-6 flex justify-between">
        <Button variant="ghost" disabled={step === 0} onClick={() => setStep(step - 1)}>← Back</Button>
        {step < 3 && <Button disabled={!canNext} onClick={() => setStep(step + 1)}>Continue →</Button>}
      </div>
    </div>
  )
}
