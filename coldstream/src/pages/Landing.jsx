import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Logo } from '../components/Layout.jsx'
import { joinWaitlist } from '../lib/store.js'

const FEATURES = [
  { icon: '✉', title: 'Unlimited email accounts', body: 'Connect every sending inbox you own — Google, Microsoft, or any SMTP — with no per-account fees, ever. Rotate sends across all of them automatically.' },
  { icon: '🔥', title: 'Warmup that protects your domain', body: 'Every account warms in a peer network with human-like open, reply, and rescue-from-spam behavior. Watch health scores climb before you send a single campaign.' },
  { icon: '🎯', title: 'Deliverability Health Score', body: 'One number per inbox that tells you whether to send, slow down, or stop — with the specific fixes (SPF, DKIM, volume, content) that move it.' },
  { icon: '🤖', title: 'AI sequences that sound human', body: 'Describe your product and audience; get a 3-step sequence with spintax and merge tags baked in. Edit inline, A/B variants included.' },
  { icon: '📥', title: 'A unibox that reads intent', body: 'Every reply from every inbox lands in one place, auto-labeled: Interested, Meeting booked, Not now, Wrong person. Work the pipeline, not the inbox.' },
  { icon: '📈', title: 'Analytics on what matters', body: 'Positive reply rate front and center — not vanity send counts. Per-step, per-variant, per-inbox breakdowns to find what converts.' },
]

const COMPARISON = [
  ['Sending email accounts', 'Unlimited, free', 'Unlimited, free'],
  ['Warmup included', 'Yes, every plan', 'Yes'],
  ['Reply intent labels in inbox', 'Built in', 'Add-on tier'],
  ['Deliverability score + fixes', 'Built in', '—'],
  ['AI sequence writer', 'Every plan', 'Higher tiers'],
  ['Uploaded contacts', 'Unlimited', 'Capped per tier'],
  ['Pricing', 'One flat plan, $47/mo', '$37–$358/mo tiers'],
]

const STEPS = [
  { n: '1', title: 'Connect inboxes', body: 'OAuth into Google or Microsoft, or paste SMTP/IMAP. Warmup starts immediately.' },
  { n: '2', title: 'Import leads & write', body: 'Drop a CSV, let the AI draft your sequence, add spintax variants in one click.' },
  { n: '3', title: 'Launch & work replies', body: 'Coldstream paces sends across inboxes and business hours. You just answer the people who say yes.' },
]

export default function Landing() {
  const [email, setEmail] = useState('')
  const [joined, setJoined] = useState(false)

  const submit = (e) => {
    e.preventDefault()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return
    joinWaitlist(email)
    setJoined(true)
  }

  return (
    <div className="min-h-screen bg-ink-950 text-slate-200">
      {/* Nav */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Logo />
        <nav className="hidden items-center gap-8 text-sm text-slate-400 md:flex">
          <a href="#features" className="hover:text-white">Features</a>
          <a href="#how" className="hover:text-white">How it works</a>
          <a href="#pricing" className="hover:text-white">Pricing</a>
        </nav>
        <Link to="/app" className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-400">
          Open the app
        </Link>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-6 pb-20 pt-16 text-center">
        <div className="mx-auto mb-6 w-fit rounded-full border border-brand-500/30 bg-brand-500/10 px-4 py-1 text-xs font-medium text-brand-300">
          The Instantly alternative that measures what actually converts
        </div>
        <h1 className="text-4xl font-bold leading-tight text-white md:text-6xl">
          Cold email that lands,<br />
          <span className="bg-gradient-to-r from-brand-300 to-mint-400 bg-clip-text text-transparent">warms, and converts.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-400">
          Unlimited sending inboxes, warmup that guards your domain, AI-written sequences,
          and a unified inbox that tells you who's ready to buy. One flat price. No lead caps.
        </p>
        <form onSubmit={submit} className="mx-auto mt-8 flex max-w-md gap-2">
          {joined ? (
            <div className="w-full rounded-lg border border-mint-500/40 bg-mint-500/10 px-4 py-3 text-sm text-mint-400">
              You're on the list — we'll be in touch at <strong>{email}</strong>. Meanwhile, <Link to="/app" className="underline">explore the live demo →</Link>
            </div>
          ) : (
            <>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="w-full rounded-lg border border-ink-600 bg-ink-900 px-4 py-3 text-sm text-white placeholder-slate-500 outline-none focus:border-brand-400"
              />
              <button className="shrink-0 rounded-lg bg-brand-500 px-5 py-3 text-sm font-semibold text-white hover:bg-brand-400">
                Get early access
              </button>
            </>
          )}
        </form>
        <p className="mt-3 text-xs text-slate-500">Free to try · No card required · Set up in 10 minutes</p>

        {/* Product shot substitute: live stats strip */}
        <div className="mt-14 grid grid-cols-2 gap-4 rounded-2xl border border-ink-700 bg-ink-900 p-6 md:grid-cols-4">
          {[['2.1×', 'average reply-rate lift, month one'], ['97', 'best-in-class inbox health score'], ['80%', 'less time managing deliverability'], ['$0', 'per extra sending account']].map(([v, l]) => (
            <div key={l}>
              <div className="text-3xl font-bold text-white">{v}</div>
              <div className="mt-1 text-xs text-slate-400">{l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-center text-3xl font-bold text-white">Everything outbound, one roof</h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-slate-400">
          Stop stitching together a warmup tool, a sender, a verifier, and a shared inbox.
        </p>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-xl border border-ink-700 bg-ink-900 p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-500/15 text-lg">{f.icon}</div>
              <h3 className="mt-4 font-semibold text-white">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-4xl px-6 py-16">
        <h2 className="text-center text-3xl font-bold text-white">Live in an afternoon</h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="text-center">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-brand-500 font-bold text-white">{s.n}</div>
              <h3 className="mt-4 font-semibold text-white">{s.title}</h3>
              <p className="mt-2 text-sm text-slate-400">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Comparison */}
      <section className="mx-auto max-w-3xl px-6 py-16">
        <h2 className="text-center text-3xl font-bold text-white">Why teams switch</h2>
        <div className="mt-8 overflow-x-auto rounded-xl border border-ink-700">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="border-b border-ink-700 bg-ink-900 text-left">
                <th className="px-4 py-3 font-medium text-slate-400"></th>
                <th className="px-4 py-3 font-semibold text-brand-300">Coldstream</th>
                <th className="px-4 py-3 font-medium text-slate-400">Typical incumbent</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON.map(([feature, us, them]) => (
                <tr key={feature} className="border-b border-ink-800 last:border-0">
                  <td className="px-4 py-3 text-slate-300">{feature}</td>
                  <td className="px-4 py-3 font-medium text-white">{us}</td>
                  <td className="px-4 py-3 text-slate-500">{them}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="mx-auto max-w-4xl px-6 py-16 text-center">
        <h2 className="text-3xl font-bold text-white">One plan. Everything in it.</h2>
        <p className="mt-3 text-slate-400">No lead caps, no per-inbox fees, no "contact sales" tier hiding the good features.</p>
        <div className="mx-auto mt-10 max-w-sm rounded-2xl border border-brand-500/40 bg-ink-900 p-8">
          <div className="text-sm font-medium uppercase tracking-wide text-brand-300">Coldstream Pro</div>
          <div className="mt-3 text-5xl font-bold text-white">$47<span className="text-lg font-normal text-slate-400">/mo</span></div>
          <ul className="mt-6 space-y-2.5 text-left text-sm text-slate-300">
            {['Unlimited email accounts + warmup', 'Unlimited contacts & campaigns', 'AI sequence writer & reply drafts', 'Intent-labeled unibox', 'Deliverability health scores', 'A/B testing & spintax', 'API + CSV everything'].map((f) => (
              <li key={f} className="flex gap-2"><span className="text-mint-400">✓</span>{f}</li>
            ))}
          </ul>
          <Link to="/app" className="mt-8 block rounded-lg bg-brand-500 py-3 font-semibold text-white hover:bg-brand-400">
            Try the live demo
          </Link>
          <p className="mt-3 text-xs text-slate-500">14-day free trial when we launch — join the waitlist above</p>
        </div>
      </section>

      <footer className="border-t border-ink-800 py-10 text-center text-xs text-slate-500">
        <Logo /> <span className="mt-3 block">© {new Date().getFullYear()} Coldstream. Send better email.</span>
      </footer>
    </div>
  )
}
