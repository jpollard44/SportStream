import { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { loginWithEmail, registerWithEmail, loginWithGoogle } from '../firebase/auth'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const params = new URLSearchParams(location.search)
  const from = params.get('redirect') || location.state?.from?.pathname || '/dashboard'

  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (user) {
    navigate(from, { replace: true })
    return null
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'register') {
        await registerWithEmail(email, password, displayName)
      } else {
        await loginWithEmail(email, password)
      }
      navigate(from, { replace: true })
    } catch (err) {
      setError(friendlyError(err.code))
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogle() {
    setError('')
    setLoading(true)
    try {
      await loginWithGoogle()
      navigate(from, { replace: true })
    } catch (err) {
      setError(friendlyError(err.code))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-950 px-4">
      <Link to="/" className="mb-8 text-2xl font-extrabold tracking-tight text-white">
        Sport<span className="text-blue-500">Stream</span>
      </Link>

      <div className="w-full max-w-sm rounded-2xl bg-gray-900 p-8 shadow-xl">
        <h1 className="mb-6 text-center text-xl font-bold text-white">
          {mode === 'login' ? 'Sign in to your account' : 'Create your account'}
        </h1>

        {error && (
          <div className="mb-4 rounded-lg bg-red-900/40 px-4 py-3 text-sm text-red-300">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {mode === 'register' && (
            <input
              type="text"
              placeholder="Full name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              className="input"
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="input"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="input"
          />
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Loading…' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div className="my-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-gray-700" />
          <span className="text-xs text-gray-500">or</span>
          <div className="h-px flex-1 bg-gray-700" />
        </div>

        <button onClick={handleGoogle} disabled={loading} className="btn-secondary flex w-full items-center justify-center gap-2">
          <GoogleIcon />
          Continue with Google
        </button>

        <p className="mt-6 text-center text-sm text-gray-400">
          {mode === 'login' ? (
            <>
              No account?{' '}
              <button onClick={() => setMode('register')} className="text-blue-400 underline">
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have one?{' '}
              <button onClick={() => setMode('login')} className="text-blue-400 underline">
                Sign in
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
      <path fill="#FBBC05" d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"/>
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z"/>
    </svg>
  )
}

function friendlyError(code) {
  switch (code) {
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Invalid email or password.'
    case 'auth/email-already-in-use':
      return 'An account with this email already exists.'
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.'
    case 'auth/popup-closed-by-user':
      return 'Sign-in cancelled.'
    default:
      return 'Something went wrong. Please try again.'
  }
}
