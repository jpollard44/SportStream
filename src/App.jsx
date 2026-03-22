import { Routes, Route, Navigate, Link } from 'react-router-dom'
import { useNotifications } from './hooks/useNotifications'
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
import RolePickerPage from './pages/RolePickerPage'
import ProtectedRoute from './components/auth/ProtectedRoute'
import BottomNav from './components/layout/BottomNav'

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

      {/* Mobile bottom nav (role-aware, hides on scorekeeper/game pages) */}
      <BottomNav />

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

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}
