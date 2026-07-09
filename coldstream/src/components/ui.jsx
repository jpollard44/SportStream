// Shared UI primitives for the Coldstream app shell (dark theme).

export function Button({ children, variant = 'primary', size = 'md', className = '', ...props }) {
  const variants = {
    primary: 'bg-brand-500 hover:bg-brand-400 text-white shadow-sm shadow-brand-700/30',
    secondary: 'bg-ink-800 hover:bg-ink-700 text-slate-200 border border-ink-600/60',
    ghost: 'text-slate-300 hover:bg-ink-800 hover:text-white',
    danger: 'bg-red-600/90 hover:bg-red-500 text-white',
  }
  const sizes = { sm: 'px-2.5 py-1.5 text-xs', md: 'px-4 py-2 text-sm', lg: 'px-6 py-3 text-base' }
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

export function Card({ children, className = '', ...props }) {
  return (
    <div className={`rounded-xl border border-ink-700/60 bg-ink-900 p-5 ${className}`} {...props}>
      {children}
    </div>
  )
}

const BADGE_TONES = {
  positive: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  neutral: 'bg-slate-500/10 text-slate-300 border-slate-500/30',
  negative: 'bg-red-500/10 text-red-400 border-red-500/30',
  brand: 'bg-brand-500/10 text-brand-300 border-brand-500/30',
  warning: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
}

export function Badge({ children, tone = 'neutral', className = '' }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${BADGE_TONES[tone]} ${className}`}>
      {children}
    </span>
  )
}

export function StatusBadge({ status }) {
  const map = {
    active: ['Active', 'positive'], paused: ['Paused', 'warning'], draft: ['Draft', 'neutral'],
    completed: ['Completed', 'brand'], replied: ['Replied', 'brand'], bounced: ['Bounced', 'negative'],
    unsubscribed: ['Unsubscribed', 'negative'],
  }
  const [label, tone] = map[status] || [status, 'neutral']
  return <Badge tone={tone}>{label}</Badge>
}

export function Stat({ label, value, sub, tone }) {
  return (
    <Card className="!p-4">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${tone === 'positive' ? 'text-emerald-400' : 'text-white'}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-400">{sub}</div>}
    </Card>
  )
}

export function Input({ className = '', ...props }) {
  return (
    <input
      className={`w-full rounded-lg border border-ink-600/70 bg-ink-850 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-brand-400 ${className}`}
      {...props}
    />
  )
}

export function Textarea({ className = '', ...props }) {
  return (
    <textarea
      className={`w-full rounded-lg border border-ink-600/70 bg-ink-850 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-brand-400 font-[inherit] ${className}`}
      {...props}
    />
  )
}

export function Select({ className = '', children, ...props }) {
  return (
    <select
      className={`w-full rounded-lg border border-ink-600/70 bg-ink-850 px-3 py-2 text-sm text-slate-100 outline-none focus:border-brand-400 ${className}`}
      {...props}
    >
      {children}
    </select>
  )
}

export function Toggle({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2 text-sm text-slate-300"
    >
      <span className={`relative h-5 w-9 rounded-full transition-colors ${checked ? 'bg-brand-500' : 'bg-ink-600'}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${checked ? 'left-[18px]' : 'left-0.5'}`} />
      </span>
      {label}
    </button>
  )
}

export function Modal({ open, onClose, title, children, wide }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className={`max-h-[85vh] w-full ${wide ? 'max-w-2xl' : 'max-w-md'} overflow-y-auto rounded-xl border border-ink-600 bg-ink-900 p-6 shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white" aria-label="Close">✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function ProgressBar({ value, max = 100, tone = 'brand' }) {
  const pct = Math.min(100, Math.round((value / max) * 100))
  const color = tone === 'good' ? 'bg-emerald-500' : tone === 'warn' ? 'bg-amber-500' : tone === 'bad' ? 'bg-red-500' : 'bg-brand-400'
  return (
    <div className="h-1.5 w-full rounded-full bg-ink-700">
      <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

export function EmptyState({ title, body, action }) {
  return (
    <Card className="flex flex-col items-center py-12 text-center">
      <div className="text-lg font-medium text-white">{title}</div>
      <p className="mt-1 max-w-sm text-sm text-slate-400">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </Card>
  )
}

export function PageHeader({ title, sub, actions }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold text-white">{title}</h1>
        {sub && <p className="mt-0.5 text-sm text-slate-400">{sub}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}

export function healthTone(score) {
  return score >= 85 ? 'good' : score >= 65 ? 'warn' : 'bad'
}

export function fmtPct(part, whole) {
  if (!whole) return '—'
  return `${((part / whole) * 100).toFixed(1)}%`
}

export function fmtNum(n) {
  return (n ?? 0).toLocaleString()
}

export function timeAgo(ts) {
  const mins = Math.max(1, Math.round((Date.now() - ts) / 60000))
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.round(hrs / 24)}d ago`
}
