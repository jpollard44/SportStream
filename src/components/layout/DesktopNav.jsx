import { Link, useLocation } from 'react-router-dom'

const NAV_ITEMS = [
  { to: '/dashboard',               label: 'Home',      icon: '⊞' },
  { to: '/dashboard?tab=clubs',     label: 'My Teams',  icon: '🏟' },
  { to: '/dashboard?tab=events',    label: 'Events',    icon: '🏆' },
  { to: '/wall-of-fame',            label: 'Fame',      icon: '🏅' },
  { to: '/dashboard?tab=following', label: 'Following', icon: '⭐' },
]

export default function DesktopNav() {
  const location = useLocation()

  function isActive(item) {
    if (item.to === '/wall-of-fame') return location.pathname === '/wall-of-fame'
    if (item.to === '/dashboard')    return location.pathname === '/dashboard' && !location.search
    if (item.to.includes('tab=clubs'))     return location.pathname === '/dashboard' && (location.search.includes('clubs') || location.pathname.startsWith('/club'))
    if (item.to.includes('tab=events'))    return location.pathname === '/dashboard' && location.search.includes('events')
    if (item.to.includes('tab=following')) return location.pathname === '/dashboard' && location.search.includes('following')
    return false
  }

  return (
    <nav
      className="fixed left-0 top-0 z-40 hidden sm:flex items-center gap-1 px-4 h-14 border-b border-white/5"
      style={{
        background: 'rgba(15, 17, 23, 0.97)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        right: '96px', // leave space for NotificationCenter + ProfileDropdown
      }}
    >
      {/* Logo */}
      <Link to="/dashboard" className="mr-4 shrink-0 text-lg font-extrabold tracking-tight text-white">
        Sport<span className="text-blue-500">Stream</span>
      </Link>

      {/* Nav links */}
      {NAV_ITEMS.map((item) => {
        const active = isActive(item)
        return (
          <Link
            key={item.to}
            to={item.to}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-semibold transition ${
              active
                ? 'bg-blue-600/15 text-blue-400'
                : 'text-gray-500 hover:bg-white/5 hover:text-gray-200'
            }`}
          >
            <span className="text-base leading-none">{item.icon}</span>
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
