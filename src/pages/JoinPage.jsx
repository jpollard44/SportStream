import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getGameByJoinCode } from '../firebase/firestore'

export default function JoinPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleJoin(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const game = await getGameByJoinCode(code.trim().toUpperCase())
      if (!game) {
        setError('Code not found. Check the code and try again.')
        return
      }
      if (game.status === 'final') {
        setError('This game has already ended.')
        return
      }
      navigate(`/scorekeeper/${game.id}`)
    } catch (err) {
      setError('Something went wrong. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-950 px-5">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-extrabold text-white">
            Sport<span className="text-blue-500">Stream</span>
          </h1>
          <p className="mt-2 text-gray-400">Enter your scorekeeper join code</p>
        </div>

        <form onSubmit={handleJoin} className="card space-y-4">
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">Join Code</label>
            <input
              type="text"
              placeholder="ABC123"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z2-9]/g, ''))}
              maxLength={6}
              required
              autoFocus
              className="input text-center font-mono text-2xl font-bold tracking-[0.4em]"
            />
          </div>

          {error && (
            <p className="rounded-xl bg-red-900/40 px-4 py-2 text-sm text-red-300">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || code.length !== 6}
            className="btn-primary w-full"
          >
            {loading ? 'Finding game…' : 'Join Game →'}
          </button>
        </form>

        <div className="text-center">
          {user ? (
            <Link to="/dashboard" className="text-sm text-gray-500 hover:text-white">
              ← Back to dashboard
            </Link>
          ) : (
            <Link to="/" className="text-sm text-gray-500 hover:text-white">
              ← Home
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
