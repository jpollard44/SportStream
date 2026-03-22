// SportStream UI Component Library
// Import individual components: import { AppButton, AppCard, ... } from '../components/ui'

import { useState, useEffect } from 'react'

// ── AppButton ──────────────────────────────────────────────────────────────────
export function AppButton({
  variant = 'primary',
  size = 'md',
  className = '',
  fullWidth = false,
  children,
  ...props
}) {
  const base = 'inline-flex items-center justify-center font-semibold transition-all duration-150 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none gap-2'
  const variants = {
    primary:   'bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-600/20',
    secondary: 'bg-[#1a1f2e] text-white ring-1 ring-white/10 hover:bg-[#242938]',
    ghost:     'text-gray-400 hover:text-white hover:bg-white/5',
    danger:    'bg-red-700 text-white hover:bg-red-600',
    success:   'bg-green-600 text-white hover:bg-green-500 shadow-lg shadow-green-600/20',
    outline:   'border border-white/20 text-white hover:bg-white/5',
  }
  const sizes = {
    xs: 'rounded-lg px-3 py-1.5 text-xs',
    sm: 'rounded-xl px-4 py-2 text-sm',
    md: 'rounded-xl px-5 py-2.5 text-sm',
    lg: 'rounded-2xl px-6 py-3.5 text-base',
    xl: 'rounded-2xl px-8 py-4 text-lg',
  }
  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

// ── AppCard ────────────────────────────────────────────────────────────────────
export function AppCard({ className = '', hover = false, onClick, children }) {
  const hoverClass = hover
    ? 'cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/30 hover:ring-white/10'
    : ''
  return (
    <div
      onClick={onClick}
      className={`rounded-2xl bg-[#1a1f2e] p-5 ring-1 ring-white/5 ${hoverClass} ${className}`}
    >
      {children}
    </div>
  )
}

// ── AppBadge ───────────────────────────────────────────────────────────────────
export function AppBadge({ color = 'gray', dot = false, children }) {
  const colors = {
    gray:   'bg-gray-800/80 text-gray-400',
    blue:   'bg-blue-900/60 text-blue-300 ring-1 ring-blue-800/40',
    green:  'bg-green-900/60 text-green-300 ring-1 ring-green-800/40',
    red:    'bg-red-900/60 text-red-300 ring-1 ring-red-800/40',
    yellow: 'bg-yellow-900/60 text-yellow-300 ring-1 ring-yellow-800/40',
    purple: 'bg-purple-900/60 text-purple-300 ring-1 ring-purple-800/40',
    cyan:   'bg-cyan-900/60 text-cyan-300 ring-1 ring-cyan-800/40',
  }
  const dotColors = {
    gray: 'bg-gray-400', blue: 'bg-blue-400', green: 'bg-green-400',
    red: 'bg-red-400', yellow: 'bg-yellow-400', purple: 'bg-purple-400', cyan: 'bg-cyan-400',
  }
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${colors[color]}`}>
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${dotColors[color]} animate-pulse`} />}
      {children}
    </span>
  )
}

// ── AppAvatar ──────────────────────────────────────────────────────────────────
export function AppAvatar({ src, name = '', size = 'md', className = '' }) {
  const initials = (name || '?')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
  const sizes = {
    xs: 'h-6 w-6 text-[10px]',
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-14 w-14 text-lg',
    xl: 'h-20 w-20 text-2xl',
  }
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={`${sizes[size]} shrink-0 rounded-full object-cover ring-2 ring-white/10 ${className}`}
      />
    )
  }
  return (
    <div
      className={`${sizes[size]} shrink-0 flex items-center justify-center rounded-full bg-gradient-to-br from-blue-800 to-blue-600 font-bold text-white ring-2 ring-white/10 ${className}`}
    >
      {initials}
    </div>
  )
}

// ── AppModal ───────────────────────────────────────────────────────────────────
export function AppModal({ open, onClose, title, children, maxWidth = 'max-w-md' }) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className={`animate-slideUp w-full ${maxWidth} rounded-t-3xl bg-[#1a1f2e] p-6 ring-1 ring-white/10 sm:rounded-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">{title}</h2>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-gray-400 hover:text-white transition"
            >
              ✕
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}

// ── AppTabs ────────────────────────────────────────────────────────────────────
export function AppTabs({ tabs, active, onChange, className = '' }) {
  return (
    <div className={`flex border-b border-white/5 ${className}`}>
      {tabs.map(({ id, label, icon }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className={`relative flex flex-1 items-center justify-center gap-1.5 py-3 text-sm font-semibold transition-colors duration-200 ${
            active === id ? 'text-white' : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          {icon && <span className="text-base">{icon}</span>}
          {label}
          {active === id && (
            <span className="absolute bottom-0 left-1/4 right-1/4 h-0.5 rounded-full bg-blue-500" />
          )}
        </button>
      ))}
    </div>
  )
}

// ── StatCard ───────────────────────────────────────────────────────────────────
export function StatCard({ value, label, sub, accent = false, className = '' }) {
  return (
    <div className={`rounded-2xl bg-[#1a1f2e] px-4 py-4 text-center ring-1 ring-white/5 ${className}`}>
      <p className={`text-2xl font-extrabold tabular-nums ${accent ? 'text-blue-400' : 'text-white'}`}>
        {value ?? '—'}
      </p>
      <p className="mt-1 text-xs text-gray-500">{label}</p>
      {sub && <p className="mt-0.5 text-[10px] text-gray-600">{sub}</p>}
    </div>
  )
}

// ── EmptyState ─────────────────────────────────────────────────────────────────
export function EmptyState({ icon = '📭', title, message, cta, onCta, ctaLink }) {
  return (
    <div className="animate-fadeIn flex flex-col items-center gap-3 rounded-2xl border border-dashed border-white/10 px-6 py-14 text-center">
      <span className="text-4xl">{icon}</span>
      {title && <p className="text-base font-semibold text-white">{title}</p>}
      {message && <p className="max-w-xs text-sm text-gray-500">{message}</p>}
      {cta && (
        onCta ? (
          <button
            onClick={onCta}
            className="mt-2 rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-500 transition active:scale-95"
          >
            {cta}
          </button>
        ) : ctaLink ? (
          <a
            href={ctaLink}
            className="mt-2 inline-block rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-500 transition active:scale-95"
          >
            {cta}
          </a>
        ) : null
      )}
    </div>
  )
}

// ── Spinner ────────────────────────────────────────────────────────────────────
export function Spinner({ size = 'md', className = '' }) {
  const sizes = { xs: 'h-3 w-3 border', sm: 'h-4 w-4', md: 'h-8 w-8', lg: 'h-12 w-12' }
  return (
    <div
      className={`${sizes[size]} animate-spin rounded-full border-2 border-blue-500 border-t-transparent ${className}`}
    />
  )
}

export function PageSpinner() {
  return (
    <div className="flex h-screen items-center justify-center bg-[#0f1117]">
      <div className="flex flex-col items-center gap-4">
        <Spinner size="lg" />
        <p className="text-sm text-gray-500">Loading…</p>
      </div>
    </div>
  )
}

// ── SkeletonCard ───────────────────────────────────────────────────────────────
export function SkeletonCard({ lines = 3 }) {
  return (
    <div className="rounded-2xl bg-[#1a1f2e] p-5 ring-1 ring-white/5 space-y-3">
      <div className="skeleton h-4 w-1/2" />
      {Array.from({ length: lines - 1 }).map((_, i) => (
        <div key={i} className={`skeleton h-3 ${i % 2 === 0 ? 'w-full' : 'w-3/4'}`} />
      ))}
    </div>
  )
}

// ── LiveBadge ──────────────────────────────────────────────────────────────────
export function LiveBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-red-900/60 px-2.5 py-0.5 text-xs font-bold text-red-300 ring-1 ring-red-800/40">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />
      LIVE
    </span>
  )
}

// ── LiveDot ────────────────────────────────────────────────────────────────────
// Subtle inline pulsing green dot — use next to team/player names during live games
export function LiveDot({ title = 'Live game in progress' }) {
  return (
    <span
      title={title}
      className="inline-block h-2 w-2 flex-shrink-0 animate-pulse rounded-full bg-green-400"
    />
  )
}
