import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { createTournament } from '../firebase/tournaments'

const SPORTS   = ['basketball', 'baseball', 'softball', 'soccer', 'volleyball', 'flag-football']
const FORMATS  = [
  { value: 'single_elimination', label: 'Single Elimination' },
  { value: 'round_robin',        label: 'Round Robin' },
]
const MAX_OPTS = [4, 8, 16, 32]

export default function CreateTournamentPage() {
  const { user }   = useAuth()
  const navigate   = useNavigate()
  const [form, setForm] = useState({
    name: '', sport: 'basketball', format: 'single_elimination',
    maxTeams: 8, location: '', startDate: '', description: '',
    feeEnabled: false, entryFee: '', maxPlayersPerTeam: '',
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr]       = useState('')

  function set(k, v) { setForm((f) => ({ ...f, [k]: v })) }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    setErr('')
    try {
      const tourId = await createTournament(user.uid, form)
      navigate(`/tournament/${tourId}`)
    } catch (e) {
      setErr(e.message || 'Failed to create tournament')
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 pb-24">
      <header className="flex items-center gap-4 px-5 py-5">
        <Link to="/tournaments" className="text-sm text-gray-400 hover:text-white">← Back</Link>
        <h1 className="text-xl font-bold text-white">Host a Tournament</h1>
      </header>

      <main className="mx-auto max-w-lg px-5">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div>
            <label className="block mb-1.5 text-sm text-gray-400">Tournament Name *</label>
            <input
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="Spring Hoops Classic"
              required
              className="input"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block mb-1.5 text-sm text-gray-400">Sport</label>
              <select value={form.sport} onChange={(e) => set('sport', e.target.value)} className="input capitalize">
                {SPORTS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block mb-1.5 text-sm text-gray-400">Format</label>
              <select value={form.format} onChange={(e) => set('format', e.target.value)} className="input">
                {FORMATS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block mb-1.5 text-sm text-gray-400">Max Teams</label>
              <select value={form.maxTeams} onChange={(e) => set('maxTeams', Number(e.target.value))} className="input">
                {MAX_OPTS.map((n) => <option key={n} value={n}>{n} teams</option>)}
              </select>
            </div>
            <div>
              <label className="block mb-1.5 text-sm text-gray-400">Start Date</label>
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => set('startDate', e.target.value)}
                className="input"
              />
            </div>
          </div>

          <div>
            <label className="block mb-1.5 text-sm text-gray-400">Location</label>
            <input
              value={form.location}
              onChange={(e) => set('location', e.target.value)}
              placeholder="Downtown Recreation Center"
              className="input"
            />
          </div>

          <div>
            <label className="block mb-1.5 text-sm text-gray-400">Description (optional)</label>
            <textarea
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="Rules, prizes, contact info…"
              rows={3}
              className="input resize-none"
            />
          </div>

          {/* Entry Fee */}
          <div className="card space-y-4 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-white">Entry Fee</p>
                <p className="text-xs text-gray-500">Collect fees via ChipInPool — players each chip in their share</p>
              </div>
              <button
                type="button"
                onClick={() => set('feeEnabled', !form.feeEnabled)}
                className={`relative h-7 w-12 rounded-full transition-colors ${form.feeEnabled ? 'bg-blue-600' : 'bg-gray-700'}`}
              >
                <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${form.feeEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>

            {form.feeEnabled && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 text-xs text-gray-400">Entry Fee per Team ($)</label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={form.entryFee}
                    onChange={(e) => set('entryFee', e.target.value)}
                    placeholder="100"
                    className="input"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-xs text-gray-400">Max Players / Team</label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={form.maxPlayersPerTeam}
                    onChange={(e) => set('maxPlayersPerTeam', e.target.value)}
                    placeholder="10"
                    className="input"
                  />
                </div>
                {form.entryFee && form.maxPlayersPerTeam && (
                  <div className="col-span-2 rounded-xl bg-blue-900/30 px-4 py-2 text-sm text-blue-300">
                    Each player contributes{' '}
                    <span className="font-bold">${(Number(form.entryFee) / Number(form.maxPlayersPerTeam)).toFixed(2)}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {err && <p className="rounded-xl bg-red-900/40 px-4 py-2 text-sm text-red-300">{err}</p>}

          <div className="flex flex-col gap-2 pt-2">
            <button type="submit" disabled={saving || !form.name.trim()} className="btn-primary py-4 text-base">
              {saving ? 'Creating…' : 'Create Tournament'}
            </button>
            <p className="text-center text-xs text-gray-500">
              A unique join code will be generated for teams to register.
            </p>
          </div>
        </form>
      </main>
    </div>
  )
}
