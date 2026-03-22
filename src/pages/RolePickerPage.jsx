import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { updateUserProfile } from '../firebase/firestore'

const ROLES = [
  {
    id: 'host',
    icon: '🏆',
    title: 'Host',
    desc: 'I run leagues, tournaments, or organize teams',
    color: 'yellow',
  },
  {
    id: 'manager',
    icon: '📋',
    title: 'Manager / Coach',
    desc: 'I manage a team\'s roster, lineup, and schedule',
    color: 'blue',
  },
  {
    id: 'player',
    icon: '🏃',
    title: 'Player',
    desc: 'I play on a team and want to track my stats',
    color: 'green',
  },
  {
    id: 'fan',
    icon: '📣',
    title: 'Fan',
    desc: 'I follow teams and players I care about',
    color: 'purple',
  },
  {
    id: 'scorekeeper',
    icon: '📊',
    title: 'Scorekeeper',
    desc: 'I keep score during games for a team',
    color: 'cyan',
  },
]

const colorMap = {
  yellow: {
    ring: 'ring-yellow-500/60',
    bg: 'bg-yellow-900/20',
    icon: 'bg-yellow-900/50',
    text: 'text-yellow-300',
    check: 'bg-yellow-500',
  },
  blue: {
    ring: 'ring-blue-500/60',
    bg: 'bg-blue-900/20',
    icon: 'bg-blue-900/50',
    text: 'text-blue-300',
    check: 'bg-blue-500',
  },
  green: {
    ring: 'ring-green-500/60',
    bg: 'bg-green-900/20',
    icon: 'bg-green-900/50',
    text: 'text-green-300',
    check: 'bg-green-500',
  },
  purple: {
    ring: 'ring-purple-500/60',
    bg: 'bg-purple-900/20',
    icon: 'bg-purple-900/50',
    text: 'text-purple-300',
    check: 'bg-purple-500',
  },
  cyan: {
    ring: 'ring-cyan-500/60',
    bg: 'bg-cyan-900/20',
    icon: 'bg-cyan-900/50',
    text: 'text-cyan-300',
    check: 'bg-cyan-500',
  },
}

export default function RolePickerPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from || '/dashboard'

  const [selected, setSelected] = useState([])
  const [saving, setSaving] = useState(false)

  function toggle(id) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]
    )
  }

  async function handleContinue() {
    if (!user || !selected.length) return
    setSaving(true)
    try {
      await updateUserProfile(user.uid, { role: selected, onboardingCompleted: true })
      navigate(from, { replace: true })
    } catch {
      navigate(from, { replace: true })
    } finally {
      setSaving(false)
    }
  }

  async function handleSkip() {
    if (user) {
      await updateUserProfile(user.uid, { onboardingCompleted: true }).catch(() => {})
    }
    navigate(from, { replace: true })
  }

  const displayName = user?.displayName?.split(' ')?.[0] || 'there'

  return (
    <div className="relative min-h-screen bg-[#0f1117] px-4 pb-20 pt-12 text-white">
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-0 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-blue-600/8 blur-[100px]" />
      </div>

      <div className="relative mx-auto max-w-lg">
        {/* Logo */}
        <div className="mb-10 text-center">
          <span className="text-2xl font-extrabold tracking-tight">
            Sport<span className="text-blue-500">Stream</span>
          </span>
        </div>

        {/* Header */}
        <div className="mb-8 text-center animate-slideUp">
          <p className="mb-2 text-sm font-semibold text-blue-400 uppercase tracking-widest">Welcome, {displayName}!</p>
          <h1 className="text-3xl font-extrabold leading-tight">
            What brings you here?
          </h1>
          <p className="mt-3 text-gray-500">
            Pick your role — you can select more than one.
            <br />
            This personalizes your experience.
          </p>
        </div>

        {/* Role grid */}
        <div className="stagger space-y-3 animate-slideUp">
          {ROLES.map((role) => {
            const active = selected.includes(role.id)
            const c = colorMap[role.color]
            return (
              <button
                key={role.id}
                onClick={() => toggle(role.id)}
                className={`flex w-full items-center gap-4 rounded-2xl p-4 text-left transition-all duration-200 active:scale-[0.98] ring-1 ${
                  active
                    ? `${c.bg} ${c.ring}`
                    : 'bg-[#1a1f2e] ring-white/5 hover:ring-white/10'
                }`}
              >
                {/* Icon */}
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl ${active ? c.icon : 'bg-[#0f1117]'}`}>
                  {role.icon}
                </div>

                {/* Text */}
                <div className="min-w-0 flex-1">
                  <p className={`font-bold ${active ? c.text : 'text-white'}`}>{role.title}</p>
                  <p className="text-sm text-gray-500">{role.desc}</p>
                </div>

                {/* Checkmark */}
                <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-200 ${
                  active
                    ? `${c.check} border-transparent`
                    : 'border-gray-700'
                }`}>
                  {active && (
                    <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
              </button>
            )
          })}
        </div>

        {/* Actions */}
        <div className="mt-8 flex flex-col gap-3">
          <button
            onClick={handleContinue}
            disabled={!selected.length || saving}
            className="btn-primary disabled:opacity-40"
          >
            {saving
              ? 'Saving…'
              : selected.length
              ? `Continue as ${selected.map((id) => ROLES.find((r) => r.id === id)?.title).join(' + ')} →`
              : 'Select at least one role'}
          </button>
          <button
            onClick={handleSkip}
            className="text-center text-sm text-gray-600 hover:text-gray-400 transition py-2"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  )
}
