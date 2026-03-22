import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useState, useEffect } from 'react'
import { subscribeToUser } from '../../firebase/firestore'

const NAV_ITEMS_DEFAULT = [
  { to: '/dashboard', icon: HomeIcon, label: 'Home' },
  { to: '/find',      icon: SearchIcon, label: 'Find' },
  { to: '/tournaments', icon: TrophyIcon, label: 'Discover' },
  { to: '/settings',  icon: ProfileIcon, label: 'Profile' },
]

// Role-aware overrides for the middle two slots
function getRoleItems(roles = []) {
  const isHost = roles.includes('host')
  const isFan = roles.includes('fan')
  const isScorekeeper = roles.includes('scorekeeper')
  const isPlayer = roles.includes('player') || roles.includes('manager')

  const middle1 = isFan
    ? { to: '/dashboard', label: 'Following', icon: StarIcon }
    : isScorekeeper
    ? { to: '/join', label: 'Join Game', icon: JoinIcon }
    : isPlayer
    ? { to: '/dashboard', label: 'My Team', icon: TeamIcon }
    : { to: '/find', label: 'Find', icon: SearchIcon }

  const middle2 = isHost
    ? { to: '/tournaments', label: 'Events', icon: TrophyIcon }
    : { to: '/tournaments', label: 'Discover', icon: TrophyIcon }

  return [
    { to: '/dashboard', icon: HomeIcon, label: 'Home' },
    middle1,
    middle2,
    { to: '/settings', icon: ProfileIcon, label: 'Profile' },
  ]
}

// Pages where bottom nav should NOT show
const NAV_HIDDEN_PATHS = [
  '/scorekeeper',
  '/game/',
  '/login',
  '/onboarding',
  '/invite',
]

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
  const hidden = NAV_HIDDEN_PATHS.some((p) => location.pathname.startsWith(p))
  if (!user || hidden) return null

  const items = getRoleItems(userRole)
  const path = location.pathname

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 block border-t border-white/5 safe-bottom sm:hidden"
      style={{ background: 'rgba(15, 17, 23, 0.92)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}
    >
      <div className="flex items-stretch">
        {items.map((item, i) => {
          const isActive = item.to === '/dashboard'
            ? path === '/dashboard' || path.startsWith('/club')
            : item.to === '/settings'
            ? path === '/settings'
            : path.startsWith(item.to)
          const Icon = item.icon
          return (
            <Link
              key={i}
              to={item.to}
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-3 text-[10px] font-semibold transition-colors duration-150 ${
                isActive ? 'text-blue-400' : 'text-gray-600 hover:text-gray-400'
              }`}
            >
              <Icon active={isActive} />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

// ── SVG Icons ──────────────────────────────────────────────────────────────────

function HomeIcon({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" />
      <path d="M9 21V12h6v9" />
    </svg>
  )
}

function SearchIcon({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.15 : 0} />
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.35-4.35" />
    </svg>
  )
}

function TrophyIcon({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 21h8M12 17v4M5 3H3v4a4 4 0 004 4h10a4 4 0 004-4V3h-2" />
      <path d="M5 3h14v6a7 7 0 01-7 7 7 7 0 01-7-7V3z" />
    </svg>
  )
}

function ProfileIcon({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.582-7 8-7s8 3 8 7" />
    </svg>
  )
}

function StarIcon({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  )
}

function JoinIcon({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.15 : 0} />
      <path d="M12 8v8M8 12h8" />
    </svg>
  )
}

function TeamIcon({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="7" r="3" />
      <circle cx="17" cy="7" r="3" />
      <path d="M1 21c0-3 3-5 8-5s8 2 8 5" />
      <path d="M17 13c3 0 6 1.5 6 4" />
    </svg>
  )
}
