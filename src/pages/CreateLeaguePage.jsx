import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { createLeague } from '../firebase/leagues'

const SPORTS = ['basketball', 'baseball', 'softball', 'soccer', 'volleyball', 'flag-football']

export default function CreateLeaguePage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [name, setName]           = useState('')
  const [sport, setSport]         = useState('basketball')
  const [season, setSeason]       = useState('')
  const [location, setLocation]   = useState('')
  const [description, setDesc]    = useState('')
  const [maxTeams, setMaxTeams]   = useState('')
  const [creating, setCreating]   = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setCreating(true)
    try {
      const { id } = await createLeague(user.uid, {
        name: name.trim(),
        sport,
        season: season.trim(),
        location: location.trim(),
        description: description.trim(),
        maxTeams: maxTeams ? Number(maxTeams) : null,
      })
      navigate(`/league/${id}`)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 pb-20">
      <header className="flex items-center gap-4 px-5 py-5">
        <Link to="/leagues" className="text-gray-400 hover:text-white">← Back</Link>
        <h1 className="text-xl font-bold text-white">New League</h1>
      </header>

      <main className="mx-auto max-w-lg px-5">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">

          <div className="card space-y-4">
            <h2 className="font-semibold text-white">League Info</h2>
            <div>
              <label className="mb-1.5 block text-sm text-gray-400">League name *</label>
              <input value={name} onChange={(e) => setName(e.target.value)} required
                placeholder="e.g. Downtown Rec Basketball League" className="input" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-gray-400">Sport *</label>
              <select value={sport} onChange={(e) => setSport(e.target.value)} className="input capitalize">
                {SPORTS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-gray-400">Season / Year</label>
              <input value={season} onChange={(e) => setSeason(e.target.value)}
                placeholder="e.g. Spring 2026" className="input" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-gray-400">Location</label>
              <input value={location} onChange={(e) => setLocation(e.target.value)}
                placeholder="City, park, gym name…" className="input" />
            </div>
          </div>

          <div className="card space-y-4">
            <h2 className="font-semibold text-white">Optional</h2>
            <div>
              <label className="mb-1.5 block text-sm text-gray-400">Max teams</label>
              <input type="number" min={2} max={64} value={maxTeams}
                onChange={(e) => setMaxTeams(e.target.value)}
                placeholder="Leave blank for unlimited" className="input" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-gray-400">Description</label>
              <textarea value={description} onChange={(e) => setDesc(e.target.value)}
                rows={3} placeholder="Rules, schedule info, contact…" className="input resize-none" />
            </div>
          </div>

          <button type="submit" disabled={creating || !name.trim()} className="btn-primary">
            {creating ? 'Creating…' : 'Create League'}
          </button>
        </form>
      </main>
    </div>
  )
}
