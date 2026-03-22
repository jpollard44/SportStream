import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useState, useEffect } from 'react'
import { subscribeToUser } from '../../firebase/firestore'

// Pages where bottom nav should NOT show
const NAV_HIDDEN_PREFIXES = [
  '/scorekeeper/',
  '/game/',
  '/login',
  '/onboarding',
  '/invite/',
]

// Build role-specific nav items
function getNavItems(roles = []) {
  const r = roles || []

  if (r.includes('fan') && !r.includes('host') && !r.includes('manager')) {
    return [
      { to: '/dashboard', label: 'Home',      Icon: HomeIcon },
      { to: '/find',      label: 'Discover',  Icon: SearchIcon },
      { to: '/dashboard', label: 'Following', Icon: StarIcon, tab: 'following' },
      { to: '/tournaments', label: 'Events',  Icon: TrophyIcon },
      { to: '/settings',  label: 'Profile',   Icon: ProfileIcon },
    ]
  }

  if (r.includes('scorekeeper') && !r.includes('host') && !r.includes('manager') && !r.includes('player')) {
    return [
      { to: '/join',      label: 'Join Game', Icon: JoinIcon },
      { to: '/dashboard', label: 'Home',      Icon: HomeIcon },
      { to: '/find',      label: 'Find',      Icon: SearchIcon },
      { to: '/tournaments', label: 'Events',  Icon: TrophyIcon },
      { to: '/settings',  label: 'Profile',   Icon: ProfileIcon },
    ]
  }

  if (r.includes('player') && !r.includes('host') && !r.includes('manager')) {
    return [
      { to: '/dashboard', label: 'Home',      Icon: HomeIcon },
      { to: '/dashboard', label: 'My Team',   Icon: TeamIcon, tab: 'clubs' },
      { to: '/find',      label: 'Find',      Icon: SearchIcon },
      { to: '/dashboard', label: 'Following', Icon: StarIcon, tab: 'following' },
      { to: '/settings',  label: 'Profile',   Icon: ProfileIcon },
    ]
  }

  if (r.includes('manager') && !r.includes('host')) {
    return [
      { to: '/dashboard', label: 'Home',      Icon: HomeIcon },
      { to: '/dashboard', label: 'Roster',    Icon: TeamIcon, tab: 'clubs' },
      { to: '/dashboard', label: 'Schedule',  Icon: CalendarIcon, tab: 'events' },
      { to: '/find',      label: 'Find',      Icon: SearchIcon },
      { to: '/settings',  label: 'Profile',   Icon: ProfileIcon },
    ]
  }

  // Host or default
  return [
    { to: '/dashboard', label: 'Home',      Icon: HomeIcon },
    { to: '/dashboard', label: 'My Teams',  Icon: TeamIcon, tab: 'clubs' },
    { to: '/dashboard', label: 'Events',    Icon: TrophyIcon, tab: 'events' },
    { to: '/find',      label: 'Discover',  Icon: SearchIcon },
    { to: '/settings',  label: 'Profile',   Icon: ProfileIcon },
  ]
}

export default function BottomNav() {
  const { user } = useAuth()
  const location = useLocation()
  const [userRole, setUserRole] = useState([])

  useEffect(() => {
    if (!user) return
    return subscribeToUser(user.uid, (u) => {
      setUserRole(u?.role || [])
    })
  }, [user])

  // Hide on certain pages
  const hidden = NAV_HIDDEN_PREFIXES.some((p) => location.pathname.startsWith(p))
  if (!user || hidden) return null

  const items = getNavItems(userRole)
  const path = location.pathname

  function isActive(item) {
    if (item.to === '/settings') return path === '/settings'
    if (item.to === '/join')     return path === '/join'
    if (item.to === '/find')     return path === '/find'
    if (item.to === '/tournaments') return path.startsWith('/tournament') || path.startsWith('/league')
    if (item.to === '/dashboard') return path === '/dashboard' || path.startsWith('/club')
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
