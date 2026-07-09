import { useState } from 'react'
import { Link } from 'react-router-dom'
import { generateSequence } from '../lib/ai.js'
import { renderEmail } from '../lib/spintax.js'
import { useStore } from '../lib/store.js'
import { PageHeader, Card, Button, Input, Select, Badge } from '../components/ui.jsx'

export default function AiWriter() {
  const senderName = useStore((s) => s.settings.senderName)
  const [brief, setBrief] = useState({
    product: '', audience: '', pain: '', outcome: '', proof: '', tone: 'direct',
  })
  const [result, setResult] = useState(null)
  const [showRendered, setShowRendered] = useState(true)

  const generate = () => setResult(generateSequence({ ...brief, senderName }))
  const sample = { firstName: 'Ava', company: 'Quantia' }
  const ready = brief.product && brief.audience && brief.pain && brief.outcome

  const fields = [
    ['product', 'What are you selling?', 'Coldstream — cold email platform'],
    ['audience', 'Who are you selling to?', 'B2B growth teams and agencies'],
    ['pain', 'What pain do they have?', 'juggle four outbound tools and still land in spam'],
    ['outcome', 'What outcome do you deliver?', 'double reply rates in the first month'],
    ['proof', 'Proof point (optional)', 'avg 2.1× lift across 300 customers'],
  ]

  return (
    <div>
      <PageHeader
        title="AI sequence writer"
        sub="Describe the pitch; get a 3-step sequence with merge tags and spintax built in."
      />

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          {fields.map(([key, label, placeholder]) => (
            <div key={key} className="mb-3">
              <label className="mb-1 block text-xs text-slate-500">{label}</label>
              <Input value={brief[key]} placeholder={placeholder} onChange={(e) => setBrief({ ...brief, [key]: e.target.value })} />
            </div>
          ))}
          <label className="mb-1 block text-xs text-slate-500">Tone</label>
          <Select value={brief.tone} onChange={(e) => setBrief({ ...brief, tone: e.target.value })}>
            <option value="direct">Direct</option>
            <option value="casual">Casual</option>
          </Select>
          <Button className="mt-4 w-full" disabled={!ready} onClick={generate}>✨ Generate sequence</Button>
          <p className="mt-3 text-xs text-slate-500">
            The demo uses a built-in template engine. In production this calls Claude through your backend — see <code>src/lib/ai.js</code> for the drop-in integration.
          </p>
        </Card>

        <div className="space-y-4 lg:col-span-3">
          {!result && (
            <Card className="flex h-full items-center justify-center py-16 text-center">
              <div>
                <div className="text-4xl">✎</div>
                <p className="mt-3 max-w-xs text-sm text-slate-500">Fill in the brief and generate — you'll get an opener plus two follow-ups you can edit and reuse in any campaign.</p>
              </div>
            </Card>
          )}
          {result && (
            <>
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <button onClick={() => setShowRendered(true)} className={`rounded-lg px-3 py-1.5 text-xs ${showRendered ? 'bg-brand-500/20 text-brand-300' : 'text-slate-400'}`}>
                    Rendered for {sample.firstName}
                  </button>
                  <button onClick={() => setShowRendered(false)} className={`rounded-lg px-3 py-1.5 text-xs ${!showRendered ? 'bg-brand-500/20 text-brand-300' : 'text-slate-400'}`}>
                    Raw template
                  </button>
                </div>
                <Link to="/app/campaigns/new"><Button size="sm" variant="secondary">Use in a campaign →</Button></Link>
              </div>
              {result.steps.map((s, i) => (
                <Card key={i}>
                  <div className="mb-2 flex items-center gap-2">
                    <Badge tone="brand">Step {i + 1}</Badge>
                    {i > 0 && <span className="text-xs text-slate-500">wait {s.waitDays} days</span>}
                  </div>
                  {s.subject
                    ? <div className="mb-2 text-sm font-medium text-slate-200">{showRendered ? renderEmail(s.subject, sample, (o) => o[0]) : s.subject}</div>
                    : <div className="mb-2 text-sm italic text-slate-500">Same thread</div>}
                  <pre className="whitespace-pre-wrap rounded-lg bg-ink-850 p-4 text-sm leading-relaxed text-slate-200">
                    {showRendered ? renderEmail(s.body, sample, (o) => o[0]) : s.body}
                  </pre>
                </Card>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
