import { useState, useEffect } from 'react'
import { Routes, Route, Navigate, Link, useLocation } from 'react-router-dom'
import { useNotifications } from './hooks/useNotifications'
import { useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import NotificationCenter from './components/NotificationCenter'
import ProfileDropdown from './components/ProfileDropdown'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import ClubPage from './pages/ClubPage'
import GameSetupPage from './pages/GameSetupPage'
import ScorekeeperPage from './pages/ScorekeeperPage'
import PublicGamePage from './pages/PublicGamePage'
import JoinPage from './pages/JoinPage'
import FindPage from './pages/FindPage'
import SettingsPage from './pages/SettingsPage'
import TournamentsPage from './pages/TournamentsPage'
import CreateTournamentPage from './pages/CreateTournamentPage'
import TournamentPage from './pages/TournamentPage'
import TournamentJoinPage from './pages/TournamentJoinPage'
import TeamPage from './pages/TeamPage'
import PlayerPage from './pages/PlayerPage'
import InvitePage from './pages/InvitePage'
import LeaguesPage from './pages/LeaguesPage'
import CreateLeaguePage from './pages/CreateLeaguePage'
import LeaguePage from './pages/LeaguePage'
import LeagueJoinPage from './pages/LeagueJoinPage'
import FanProfilePage from './pages/FanProfilePage'
import WallOfFamePage from './pages/WallOfFamePage'
import RolePickerPage from './pages/RolePickerPage'
import EmbedPage from './pages/EmbedPage'
import PrivacyPage from './pages/PrivacyPage'
import TermsPage from './pages/TermsPage'
import ProtectedRoute from './components/auth/ProtectedRoute'
import BottomNav from './components/layout/BottomNav'
import DesktopNav from './components/layout/DesktopNav'

function OfflineBanner() {
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    function onOffline() { setOffline(true) }
    function onOnline()  { setOffline(false) }
    window.addEventListener('offline', onOffline)
    window.addEventListener('online',  onOnline)
    // Set initial state in case the page loaded offline
    if (!navigator.onLine) setOffline(true)
    return () => {
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('online',  onOnline)
    }
  }, [])

  if (!offline) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 bg-yellow-600 px-4 py-2 text-sm font-semibold text-yellow-950">
      <span>⚡</span>
      <span>You're offline — some features may not work until you reconnect.</span>
    </div>
  )
}

const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream
}

function isInStandaloneMode() {
  return window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
}

function InstallPromptBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [show, setShow] = useState(false)
  const [showIOS, setShowIOS] = useState(false)

  useEffect(() => {
    // Don't show if already installed
    if (isInStandaloneMode()) return

    // Track visit count
    const visits = parseInt(localStorage.getItem('ss_visits') || '0', 10) + 1
    localStorage.setItem('ss_visits', String(visits))

    // Check if previously dismissed within 7 days
    const dismissedAt = parseInt(localStorage.getItem('ss_install_dismissed_at') || '0', 10)
    if (dismissedAt && Date.now() - dismissedAt < DISMISS_DURATION_MS) return

    const ios = isIOS()

    if (ios) {
      // iOS: show manual instructions after 3 visits
      if (visits >= 3) setShowIOS(true)
      return
    }

    // Android/Chrome: listen for beforeinstallprompt
    const handler = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
      if (visits >= 3) setShow(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  function handleDismiss() {
    setShow(false)
    setShowIOS(false)
    localStorage.setItem('ss_install_dismissed_at', String(Date.now()))
  }

  async function handleInstall() {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setShow(false)
      localStorage.setItem('ss_install_dismissed_at', String(Date.now()))
    }
  }

  // iOS bottom sheet
  if (showIOS) {
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 px-4 pb-4">
        <div className="w-full max-w-sm rounded-3xl bg-[#1a1f2e] p-6 shadow-2xl ring-1 ring-white/10">
          <div className="mb-4 flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-xl font-extrabold text-white">
              S
            </div>
            <div>
              <p className="font-bold text-white">Install SportStream</p>
              <p className="text-xs text-gray-400">Instant access to live scores from your home screen</p>
            </div>
          </div>
          <div className="mb-5 rounded-2xl bg-[#0f1117] px-4 py-3">
            <p className="text-xs text-gray-300 leading-relaxed">
              <strong className="text-white">1.</strong> Tap the <strong className="text-white">Share</strong> button{' '}
              <span className="rounded bg-gray-700 px-1 text-white">⬆</span> at the bottom of your browser.
            </p>
            <p className="mt-2 text-xs text-gray-300 leading-relaxed">
              <strong className="text-white">2.</strong> Scroll down and tap{' '}
              <strong className="text-white">"Add to Home Screen"</strong>.
            </p>
          </div>
          <button
            onClick={handleDismiss}
            className="w-full rounded-2xl bg-gray-800 py-3 text-sm font-semibold text-gray-300 hover:bg-gray-700 transition active:scale-95"
          >
            Not now
          </button>
        </div>
      </div>
    )
  }

  // Android / Chrome bottom sheet
  if (!show || !deferredPrompt) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 px-4 pb-4">
      <div className="w-full max-w-sm rounded-3xl bg-[#1a1f2e] p-6 shadow-2xl ring-1 ring-white/10">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-xl font-extrabold text-white">
            S
          </div>
          <div>
            <p className="font-bold text-white">Install SportStream</p>
            <p className="text-xs text-gray-400">Instant access to live scores from your home screen</p>
          </div>
        </div>
        <ul className="mb-5 space-y-2">
          {[
            'Live scores + play-by-play',
            'Push alerts when your teams go live',
            'Works offline for scorekeeper mode',
          ].map((benefit) => (
            <li key={benefit} className="flex items-center gap-2 text-sm text-gray-300">
              <span className="text-green-400">✓</span> {benefit}
            </li>
          ))}
        </ul>
        <div className="flex gap-3">
          <button
            onClick={handleInstall}
            className="flex-1 rounded-2xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-500 transition active:scale-95"
          >
            Install →
          </button>
          <button
            onClick={handleDismiss}
            className="flex-1 rounded-2xl bg-gray-800 py-3 text-sm font-semibold text-gray-300 hover:bg-gray-700 transition active:scale-95"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  )
}

const HEADER_HIDDEN = ['/scorekeeper/', '/game/', '/login', '/onboarding', '/invite/', '/embed/']

function AppInner() {
  const { toast, dismissToast } = useNotifications()
  const { user } = useAuth()
  const location = useLocation()
  const headerHidden = HEADER_HIDDEN.some((p) => location.pathname.startsWith(p))

  return (
    <>
      {/* Fixed top-right bar: notifications + profile */}
      {user && !headerHidden && (
        <div className="fixed top-0 right-0 z-50 p-3 flex items-center gap-2">
          <NotificationCenter />
          <ProfileDropdown />
        </div>
      )}

      {/* Foreground push notification toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 z-50 w-full max-w-sm -translate-x-1/2 px-4 animate-slideDown">
          <div className="flex items-start gap-3 rounded-2xl bg-[#1a1f2e] p-4 shadow-2xl ring-1 ring-red-800/40">
            <span className="mt-0.5 h-2 w-2 shrink-0 animate-pulse rounded-full bg-red-500" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white">{toast.title}</p>
              {toast.body && <p className="mt-0.5 text-xs text-gray-400">{toast.body}</p>}
              {toast.url && (
                <Link to={toast.url} onClick={dismissToast}
                  className="mt-2 inline-block text-xs font-semibold text-blue-400 hover:text-blue-300">
                  Watch live →
                </Link>
              )}
            </div>
            <button onClick={dismissToast} className="text-gray-500 hover:text-white transition">✕</button>
          </div>
        </div>
      )}

      {/* Offline banner */}
      <OfflineBanner />

      {/* PWA install prompt banner */}
      <InstallPromptBanner />

      {/* Mobile bottom nav — hidden on desktop */}
      <BottomNav />

      {/* Desktop top nav — hidden on mobile */}
      {user && !headerHidden && <DesktopNav />}

      <div className={user && !headerHidden ? 'sm:pt-14' : ''}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/join" element={<JoinPage />} />
        <Route path="/find" element={<FindPage />} />

        {/* Protected admin routes */}
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/club/:clubId" element={<ClubPage />} />
          <Route path="/club/:clubId/game/new" element={<GameSetupPage />} />
          <Route path="/scorekeeper/:gameId" element={<ScorekeeperPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/tournament/new" element={<CreateTournamentPage />} />
          <Route path="/league/new" element={<CreateLeaguePage />} />
          <Route path="/onboarding" element={<RolePickerPage />} />
        </Route>

        {/* Public routes — no auth required */}
        <Route path="/game/:gameId" element={<PublicGamePage />} />
        <Route path="/team/:clubId" element={<TeamPage />} />
        <Route path="/player/:clubId/:playerId" element={<PlayerPage />} />
        <Route path="/invite/:token" element={<InvitePage />} />
        <Route path="/tournaments" element={<TournamentsPage />} />
        <Route path="/tournament/:tourId" element={<TournamentPage />} />
        <Route path="/tournament/:tourId/join" element={<TournamentJoinPage />} />
        <Route path="/leagues" element={<LeaguesPage />} />
        <Route path="/league/:leagueId" element={<LeaguePage />} />
        <Route path="/league/:leagueId/join" element={<LeagueJoinPage />} />
        <Route path="/fan/:uid" element={<FanProfilePage />} />
        <Route path="/wall-of-fame" element={<WallOfFamePage />} />
        <Route path="/embed/game/:gameId" element={<EmbedPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </div>
    </>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <AppInner />
    </ThemeProvider>
  )
}
