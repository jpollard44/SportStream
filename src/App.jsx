import { useState, useEffect, lazy, Suspense } from 'react'
import { Routes, Route, Navigate, Link } from 'react-router-dom'
import { useNotifications } from './hooks/useNotifications'
// Eager: the entry pages users hit first
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import ProtectedRoute from './components/auth/ProtectedRoute'
import BottomNav from './components/layout/BottomNav'
// Lazy: everything else loads per-route so a shared game link doesn't
// download the scorekeeper, tournament builder, settings, etc.
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const ClubPage = lazy(() => import('./pages/ClubPage'))
const GameSetupPage = lazy(() => import('./pages/GameSetupPage'))
const ScorekeeperPage = lazy(() => import('./pages/ScorekeeperPage'))
const PublicGamePage = lazy(() => import('./pages/PublicGamePage'))
const JoinPage = lazy(() => import('./pages/JoinPage'))
const FindPage = lazy(() => import('./pages/FindPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const TournamentsPage = lazy(() => import('./pages/TournamentsPage'))
const CreateTournamentPage = lazy(() => import('./pages/CreateTournamentPage'))
const TournamentPage = lazy(() => import('./pages/TournamentPage'))
const TournamentJoinPage = lazy(() => import('./pages/TournamentJoinPage'))
const TeamPage = lazy(() => import('./pages/TeamPage'))
const PlayerPage = lazy(() => import('./pages/PlayerPage'))
const InvitePage = lazy(() => import('./pages/InvitePage'))
const LeaguesPage = lazy(() => import('./pages/LeaguesPage'))
const CreateLeaguePage = lazy(() => import('./pages/CreateLeaguePage'))
const LeaguePage = lazy(() => import('./pages/LeaguePage'))
const LeagueJoinPage = lazy(() => import('./pages/LeagueJoinPage'))
const FanProfilePage = lazy(() => import('./pages/FanProfilePage'))
const WallOfFamePage = lazy(() => import('./pages/WallOfFamePage'))
const RolePickerPage = lazy(() => import('./pages/RolePickerPage'))

function RouteFallback() {
  return (
    <div className="flex h-screen items-center justify-center bg-gray-950">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
    </div>
  )
}

function InstallPromptBanner() {
  const [prompt, setPrompt] = useState(null)
  const [show, setShow] = useState(false)

  useEffect(() => {
    // Track visit count
    const visits = parseInt(localStorage.getItem('ss_visits') || '0', 10) + 1
    localStorage.setItem('ss_visits', String(visits))

    const dismissed = localStorage.getItem('ss_install_dismissed') === 'true'
    if (dismissed) return

    const handler = (e) => {
      e.preventDefault()
      setPrompt(e)
      if (visits >= 2) setShow(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  if (!show || !prompt) return null

  async function handleInstall() {
    prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted') setShow(false)
  }

  function handleDismiss() {
    setShow(false)
    localStorage.setItem('ss_install_dismissed', 'true')
  }

  return (
    <div className="fixed bottom-20 left-0 right-0 z-40 px-4 sm:bottom-4">
      <div className="mx-auto flex max-w-sm items-center gap-3 rounded-2xl bg-[#1a1f2e] p-4 shadow-2xl ring-1 ring-blue-800/40">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-lg font-bold text-white">
          S
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-white">Add to Home Screen</p>
          <p className="text-xs text-gray-400">Get quick access to SportStream</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleInstall}
            className="rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 transition active:scale-95"
          >
            Install
          </button>
          <button onClick={handleDismiss} className="text-gray-500 hover:text-white transition">✕</button>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const { toast, dismissToast } = useNotifications()

  return (
    <>
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

      {/* PWA install prompt banner */}
      <InstallPromptBanner />

      {/* Mobile bottom nav (role-aware, hides on scorekeeper/game pages) */}
      <BottomNav />

      <Suspense fallback={<RouteFallback />}>
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

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
    </>
  )
}
