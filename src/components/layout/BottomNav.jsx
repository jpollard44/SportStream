import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

// Pages where bottom nav should NOT show
const NAV_HIDDEN_PREFIXES = [
  '/scorekeeper/',
  '/game/',
  '/login',
  '/onboarding',
  '/invite/',
]

function getNavItems() {
  return [
    { to: '/dashboard',               label: 'Home',      Icon: HomeIcon },
    { to: '/dashboard?tab=clubs',     label: 'My Teams',  Icon: TeamIcon },
    { to: '/dashboard?tab=events',    label: 'Events',    Icon: TrophyIcon },
    { to: '/wall-of-fame',            label: 'Fame',      Icon: FameIcon },
    { to: '/dashboard?tab=following', label: 'Following', Icon: StarIcon },
  ]
}

export default function BottomNav() {
  const { user } = useAuth()
  const location = useLocation()

  // Hide on certain pages
  const hidden = NAV_HIDDEN_PREFIXES.some((p) => location.pathname.startsWith(p))
  if (!user || hidden) return null

  const items = getNavItems()
  const path = location.pathname

  function isActive(item) {
    if (item.to === '/wall-of-fame')          return path === '/wall-of-fame'
    if (item.to === '/dashboard')             return path === '/dashboard' && !location.search
    if (item.to.includes('tab=clubs'))        return path === '/dashboard' && (location.search.includes('clubs') || path.startsWith('/club'))
    if (item.to.includes('tab=events'))       return path === '/dashboard' && location.search.includes('events')
    if (item.to.includes('tab=following'))    return path === '/dashboard' && location.search.includes('following')
    return false
  }

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 block border-t border-white/5 sm:hidden"
      style={{
        background: 'rgba(15, 17, 23, 0.95)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <div className="flex items-stretch">
        {items.map((item, i) => {
          const active = isActive(item)
          const { Icon } = item
          return (
            <Link
              key={i}
              to={item.to}
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2.5 text-[9px] font-semibold transition-colors duration-150 ${
                active ? 'text-blue-400' : 'text-gray-600 hover:text-gray-400'
              }`}
            >
              <Icon active={active} />
              <span className="mt-0.5 leading-none">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

// ── Icons ──────────────────────────────────────────────────────────────────────

function HomeIcon({ active }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" />
      <path d="M9 21V12h6v9" />
    </svg>
  )
}

function SearchIcon({ active }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {active && <circle cx="11" cy="11" r="7" fill="currentColor" fillOpacity="0.15" />}
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.35-4.35" />
    </svg>
  )
}

function TrophyIcon({ active }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 21h8M12 17v4M5 3H3v4a4 4 0 004 4h10a4 4 0 004-4V3h-2" />
      <path d="M5 3h14v6a7 7 0 01-7 7 7 7 0 01-7-7V3z" />
    </svg>
  )
}

function ProfileIcon({ active }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.582-7 8-7s8 3 8 7" />
    </svg>
  )
}

function StarIcon({ active }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  )
}

function JoinIcon({ active }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {active && <circle cx="12" cy="12" r="9" fill="currentColor" fillOpacity="0.15" />}
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  )
}

function TeamIcon({ active }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="7" r="3" />
      <circle cx="17" cy="7" r="3" />
      <path d="M1 21c0-3 3-5 8-5s8 2 8 5" />
      <path d="M17 13c3 0 6 1.5 6 4" />
    </svg>
  )
}

function CalendarIcon({ active }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  )
}

function FameIcon({ active }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="6" />
      <path d="M8 21h8M12 17v4" />
      <path d="M9 8l1.5 3L12 8.5l1.5 2.5L15 8" strokeWidth="1.5" />
    </svg>
  )
}
