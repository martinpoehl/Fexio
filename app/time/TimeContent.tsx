'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { getOrCreateCompanyId } from '@/lib/getOrCreateCompany'
import { Plus, Search, Edit2, Trash2, Clock, Calendar, Briefcase, User, CheckCircle2, XCircle, X, Play, Square } from 'lucide-react'

const TIMER_KEY = 'fexio_timer'

interface TimerState {
  startTime: number // unix ms
  description: string
  project_id: string
}

function loadTimer(): TimerState | null {
  try {
    const raw = localStorage.getItem(TIMER_KEY)
    if (!raw) return null
    return JSON.parse(raw) as TimerState
  } catch {
    return null
  }
}

function saveTimer(state: TimerState) {
  localStorage.setItem(TIMER_KEY, JSON.stringify(state))
}

function clearTimer() {
  localStorage.removeItem(TIMER_KEY)
}

function fHMS(ms: number) {
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function TimeContent() {
  const [entries, setEntries] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingEntry, setEditingEntry] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  // Default hourly rate
  const [defaultRate, setDefaultRate] = useState(0)
  const [rateInput, setRateInput] = useState('')
  const [companyId, setCompanyId] = useState<string | null>(null)

  // Timer state
  const [timerRunning, setTimerRunning] = useState(false)
  const [timerStart, setTimerStart] = useState<number | null>(null)
  const [timerDesc, setTimerDesc] = useState('')
  const [timerProject, setTimerProject] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    description: '',
    date: new Date().toISOString().split('T')[0],
    duration_minutes: 0,
    start_time: '',
    end_time: '',
    project_id: '',
    billable: true,
    hourly_rate: 0
  })

  const supabase = createClient()

  // Load persisted timer on mount
  useEffect(() => {
    const saved = loadTimer()
    if (saved) {
      setTimerRunning(true)
      setTimerStart(saved.startTime)
      setTimerDesc(saved.description)
      setTimerProject(saved.project_id)
      setElapsed(Date.now() - saved.startTime)
    }
    fetchData()
  }, [])

  // Tick interval
  useEffect(() => {
    if (timerRunning && timerStart !== null) {
      tickRef.current = setInterval(() => {
        setElapsed(Date.now() - timerStart)
      }, 1000)
    } else {
      if (tickRef.current) clearInterval(tickRef.current)
    }
    return () => {
      if (tickRef.current) clearInterval(tickRef.current)
    }
  }, [timerRunning, timerStart])

  function handleStartTimer() {
    const now = Date.now()
    setTimerStart(now)
    setTimerRunning(true)
    setElapsed(0)
    saveTimer({ startTime: now, description: timerDesc, project_id: timerProject })
  }

  function handleStopTimer() {
    if (!timerStart) return
    const durationMs = Date.now() - timerStart
    const durationMinutes = Math.max(1, Math.round(durationMs / 60000))
    const startISO = new Date(timerStart)
    const endISO = new Date()

    // Pre-fill form with timer data
    setEditingEntry(null)
    const proj = projects.find(p => p.id === timerProject)
    setFormData({
      description: timerDesc,
      date: startISO.toISOString().split('T')[0],
      duration_minutes: durationMinutes,
      start_time: startISO.toTimeString().slice(0, 5),
      end_time: endISO.toTimeString().slice(0, 5),
      project_id: timerProject,
      billable: true,
      hourly_rate: proj ? Number(proj.hourly_rate) : defaultRate
    })

    // Stop timer
    setTimerRunning(false)
    setTimerStart(null)
    setElapsed(0)
    setTimerDesc('')
    setTimerProject('')
    clearTimer()

    setSaveError('')
    setShowModal(true)
  }

  // Keep localStorage in sync when description/project change while running
  useEffect(() => {
    if (timerRunning && timerStart !== null) {
      saveTimer({ startTime: timerStart, description: timerDesc, project_id: timerProject })
    }
  }, [timerDesc, timerProject])

  async function fetchData() {
    try {
      setLoading(true)
      const cId = await getOrCreateCompanyId(supabase)
      setCompanyId(cId)

      const [entriesRes, projectsRes, companyRes] = await Promise.all([
        supabase
          .from('time_entries')
          .select('*, projects(name, hourly_rate)')
          .eq('company_id', cId)
          .order('date', { ascending: false }),
        supabase
          .from('projects')
          .select('id, name, hourly_rate')
          .eq('company_id', cId)
          .eq('status', 'aktiv')
          .order('name'),
        supabase
          .from('companies')
          .select('default_hourly_rate')
          .eq('id', cId)
          .single(),
      ])

      if (entriesRes.error) throw entriesRes.error
      setEntries(entriesRes.data || [])
      setProjects(projectsRes.data || [])

      const rate = Number(companyRes.data?.default_hourly_rate) || 0
      setDefaultRate(rate)
      setRateInput(rate > 0 ? String(rate) : '')
    } catch (err) {
      console.error('Error fetching data:', err)
    } finally {
      setLoading(false)
    }
  }

  async function saveDefaultRate(value: number) {
    if (!companyId) return
    setDefaultRate(value)
    await supabase
      .from('companies')
      .update({ default_hourly_rate: value })
      .eq('id', companyId)
  }

  const handleOpenModal = (entry: any = null) => {
    if (entry) {
      setEditingEntry(entry)
      setFormData({
        description: entry.description,
        date: entry.date || new Date().toISOString().split('T')[0],
        duration_minutes: entry.duration_minutes || 0,
        start_time: entry.start_time ? entry.start_time.slice(0, 5) : '',
        end_time: entry.end_time ? entry.end_time.slice(0, 5) : '',
        project_id: entry.project_id || '',
        billable: entry.billable !== false,
        hourly_rate: Number(entry.hourly_rate) || 0
      })
    } else {
      setEditingEntry(null)
      setFormData({
        description: '',
        date: new Date().toISOString().split('T')[0],
        duration_minutes: 0,
        start_time: '',
        end_time: '',
        project_id: '',
        billable: true,
        hourly_rate: defaultRate
      })
    }
    setSaveError('')
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setSaveError('')
    try {
      const companyId = await getOrCreateCompanyId(supabase)

      const payload: any = { ...formData, company_id: companyId }
      if (payload.project_id === '') delete payload.project_id
      if (!payload.start_time) delete payload.start_time
      if (!payload.end_time) delete payload.end_time

      if (editingEntry) {
        const { error } = await supabase
          .from('time_entries')
          .update(payload)
          .eq('id', editingEntry.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('time_entries')
          .insert([payload])
        if (error) throw error
      }

      setShowModal(false)
      fetchData()
    } catch (err: any) {
      console.error('Error saving entry:', err)
      setSaveError(err?.message || 'Fehler beim Speichern der Zeit')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Möchten Sie diesen Eintrag wirklich löschen?')) return
    try {
      const { error } = await supabase.from('time_entries').delete().eq('id', id)
      if (error) throw error
      fetchData()
    } catch (err) {
      console.error('Error deleting entry:', err)
      alert('Fehler beim Löschen der Zeit')
    }
  }

  const filteredEntries = entries.filter(e =>
    e.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (e.projects?.name && e.projects.name.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const fDur = (m: number) => Math.floor(m / 60) + 'h ' + String(m % 60).padStart(2, '0') + 'min'
  const fD = (d: string) => {
    if (!d) return ''
    const [y, m, day] = d.split('-')
    return `${day}.${m}.${y}`
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-gray-900">Zeiterfassung</h1>
          <p className="text-gray-400 text-sm mt-1">Erfasse deine Arbeitszeiten auf Projekten</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 bg-[#00875A] hover:bg-[#006B47] text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
        >
          <Plus size={18} />
          Manuell erfassen
        </button>
      </div>

      {/* Default hourly rate card */}
      <div className={`rounded-xl border-2 bg-white shadow-sm p-5 flex items-center justify-between gap-6 ${defaultRate === 0 ? 'border-amber-300 bg-amber-50/40' : 'border-gray-200'}`}>
        <div className="flex items-center gap-4 min-w-0">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${defaultRate === 0 ? 'bg-amber-100' : 'bg-green-100'}`}>
            <Clock size={18} className={defaultRate === 0 ? 'text-amber-600' : 'text-green-600'} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900">Standard-Stundensatz</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {defaultRate === 0
                ? 'Noch nicht festgelegt — wird für neue Zeiteinträge und Rechnungen verwendet'
                : 'Wird automatisch für neue Zeiteinträge übernommen'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-sm font-medium text-gray-500">CHF</span>
          <input
            type="number"
            min="0"
            step="any"
            value={rateInput}
            onChange={e => setRateInput(e.target.value)}
            onBlur={() => {
              const v = Number(rateInput) || 0
              saveDefaultRate(v)
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                const v = Number(rateInput) || 0
                saveDefaultRate(v)
                ;(e.target as HTMLInputElement).blur()
              }
            }}
            placeholder="z.B. 120"
            className={`w-28 px-3 py-2 border rounded-lg text-sm font-semibold text-right focus:outline-none focus:ring-2 transition-colors ${
              defaultRate === 0
                ? 'border-amber-300 bg-amber-50 focus:ring-amber-400/30 focus:border-amber-400 placeholder-amber-300'
                : 'border-gray-200 bg-gray-50 focus:ring-green-500/20 focus:border-green-500'
            }`}
          />
          <span className="text-sm text-gray-500">/ Std.</span>
        </div>
      </div>

      {/* Live Timer Card */}
      <div className={`rounded-xl border-2 shadow-sm transition-all ${timerRunning ? 'border-[#00875A] bg-green-50/60' : 'border-gray-200 bg-white'}`}>
        <div className="p-5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            {/* Timer display */}
            <div className="flex items-center gap-4 flex-1">
              <div className={`flex items-center justify-center w-12 h-12 rounded-full ${timerRunning ? 'bg-[#00875A]' : 'bg-gray-100'}`}>
                <Clock size={22} className={timerRunning ? 'text-white' : 'text-gray-400'} />
              </div>
              <div>
                <div className={`text-3xl font-mono font-bold tabular-nums tracking-tight ${timerRunning ? 'text-[#00875A]' : 'text-gray-300'}`}>
                  {fHMS(elapsed)}
                </div>
                <div className="text-[11px] text-gray-400 mt-0.5">
                  {timerRunning ? 'Timer läuft...' : 'Timer gestoppt'}
                </div>
              </div>
            </div>

            {/* Start / Stop button */}
            {!timerRunning ? (
              <button
                onClick={handleStartTimer}
                className="flex items-center gap-2 bg-[#00875A] hover:bg-[#006B47] text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors shadow-sm"
              >
                <Play size={16} />
                Starten
              </button>
            ) : (
              <button
                onClick={handleStopTimer}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors shadow-sm"
              >
                <Square size={16} />
                Stoppen
              </button>
            )}
          </div>

          {/* Inline inputs while timer is running */}
          {timerRunning && (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 uppercase mb-1">Woran arbeitest du?</label>
                <input
                  type="text"
                  value={timerDesc}
                  onChange={e => setTimerDesc(e.target.value)}
                  placeholder="Beschreibung..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 bg-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 uppercase mb-1">Projekt</label>
                <select
                  value={timerProject}
                  onChange={e => setTimerProject(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 bg-white"
                >
                  <option value="">– Keines / Intern –</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4 bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Suchen nach Beschreibung oder Projekt..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all"
          />
        </div>
      </div>

      {/* Entries table */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[700px]">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Datum</th>
              <th className="px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Beschreibung / Projekt</th>
              <th className="px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Zeitraum</th>
              <th className="px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Dauer</th>
              <th className="px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Verrechenbar</th>
              <th className="px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-right">Aktionen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-gray-400 text-sm">Laden...</td>
              </tr>
            ) : filteredEntries.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-gray-400 text-sm">Keine Einträge gefunden</td>
              </tr>
            ) : (
              filteredEntries.map(entry => (
                <tr key={entry.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="text-[13px] font-medium text-gray-900 flex items-center gap-2">
                      <Calendar size={13} className="text-gray-400" /> {fD(entry.date)}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-[13px] font-semibold text-gray-900">{entry.description}</div>
                    <div className="text-[11px] text-gray-500 flex items-center gap-1 mt-0.5">
                      <Briefcase size={10} /> {entry.projects?.name || 'Privat / Intern'}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {entry.start_time || entry.end_time ? (
                      <div className="text-[12px] text-gray-500 font-mono">
                        {entry.start_time ? entry.start_time.slice(0, 5) : '--:--'}
                        {' – '}
                        {entry.end_time ? entry.end_time.slice(0, 5) : '--:--'}
                      </div>
                    ) : (
                      <span className="text-[11px] text-gray-300">–</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-[13px] font-bold text-gray-900 flex items-center gap-2">
                      <Clock size={13} className="text-gray-400" /> {fDur(entry.duration_minutes || 0)}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {entry.billable ? (
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-green-600">
                        <CheckCircle2 size={12} /> Ja
                        {entry.invoiced && <span className="ml-1 text-[9px] bg-blue-50 text-blue-500 px-1.5 rounded-full">Verrechnet</span>}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-gray-400">
                        <XCircle size={12} /> Nein
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleOpenModal(entry)}
                        className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(entry.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <h2 className="font-bold text-gray-900">
                {editingEntry ? 'Eintrag bearbeiten' : 'Zeit erfassen'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1">
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Beschreibung *</label>
                  <input
                    required
                    value={formData.description}
                    onChange={e => setFormData({...formData, description: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20"
                    placeholder="Was hast du gemacht?"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Datum</label>
                    <input
                      type="date"
                      value={formData.date}
                      onChange={e => setFormData({...formData, date: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Dauer (Minuten)</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.duration_minutes}
                      onChange={e => setFormData({...formData, duration_minutes: Number(e.target.value)})}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20"
                      placeholder="z.B. 60"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Startzeit (optional)</label>
                    <input
                      type="time"
                      value={formData.start_time}
                      onChange={e => setFormData({...formData, start_time: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Endzeit (optional)</label>
                    <input
                      type="time"
                      value={formData.end_time}
                      onChange={e => setFormData({...formData, end_time: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Stundensatz (CHF)</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={formData.hourly_rate === 0 ? '' : formData.hourly_rate}
                      onChange={e => setFormData({...formData, hourly_rate: Number(e.target.value) || 0})}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20"
                      placeholder={defaultRate > 0 ? String(defaultRate) : '0'}
                    />
                  </div>
                  <div className="flex items-end pb-2">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id="billable"
                        checked={formData.billable}
                        onChange={e => setFormData({...formData, billable: e.target.checked})}
                        className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                      />
                      <label htmlFor="billable" className="text-sm font-medium text-gray-700 select-none">Verrechenbar</label>
                    </div>
                  </div>
                </div>
              </div>
              {saveError && <p className="text-red-600 text-xs mb-3">{saveError}</p>}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2 bg-[#00875A] hover:bg-[#006B47] text-white rounded-lg text-sm font-semibold transition-colors shadow-sm disabled:opacity-50"
                >
                  {saving ? 'Speichert...' : 'Speichern'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
