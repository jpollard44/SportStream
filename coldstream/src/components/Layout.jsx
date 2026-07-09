import { NavLink, Outlet, Link } from 'react-router-dom'
import { useEffect } from 'react'
import { useStore } from '../lib/store.js'
import { startEngine } from '../lib/engine.js'

const NAV = [
  { to: '/app', label: 'Dashboard', icon: '▦', end: true },
  { to: '/app/campaigns', label: 'Campaigns', icon: '➤' },
  { to: '/app/leads', label: 'Leads', icon: '☰' },
  { to: '/app/unibox', label: 'Unibox', icon: '✉', badge: 'unread' },
  { to: '/app/accounts', label: 'Email accounts', icon: '@' },
  { to: '/app/warmup', label: 'Warmup', icon: '🔥' },
  { to: '/app/analytics', label: 'Analytics', icon: '∿' },
  { to: '/app/writer', label: 'AI writer', icon: '✎' },
  { to: '/app/settings', label: 'Settings', icon: '⚙' },
]

export function Logo({ light }) {
  return (
    <span className={`flex items-center gap-2 font-semibold ${light ? 'text-ink-950' : 'text-white'}`}>
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-500 text-sm text-white">❄</span>
      Coldstream
    </span>
  )
}

export default function Layout() {
  const unread = useStore((s) => s.inbox.filter((m) => !m.read).length)
  const demo = useStore((s) => s.settings.demo)

  useEffect(() => startEngine(), [])

  return (
    <div className="flex min-h-screen bg-ink-950 text-slate-200">
      <aside className="fixed inset-y-0 z-20 flex w-56 flex-col border-r border-ink-800 bg-ink-900">
        <div className="px-5 py-5">
          <Link to="/"><Logo /></Link>
        </div>
        <nav className="flex-1 space-y-0.5 px-3">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                  isActive ? 'bg-brand-500/15 text-brand-300 font-medium' : 'text-slate-400 hover:bg-ink-800 hover:text-slate-200'
                }`
              }
            >
              <span className="w-4 text-center text-xs opacity-80">{item.icon}</span>
              {item.label}
              {item.badge === 'unread' && unread > 0 && (
                <span className="ml-auto rounded-full bg-brand-500 px-1.5 text-[10px] font-semibold text-white">{unread}</span>
              )}
            </NavLink>
          ))}
        </nav>
        {demo && (
          <div className="m-3 rounded-lg border border-brand-500/30 bg-brand-500/10 p-3 text-xs text-brand-300">
            Demo workspace — activity is simulated so you can explore every screen.
          </div>
        )}
      </aside>
      <main className="ml-56 flex-1 px-8 py-6">
        <div className="mx-auto max-w-6xl">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
