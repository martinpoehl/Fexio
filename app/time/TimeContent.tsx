'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { Plus, Search, Edit2, Trash2, Clock, Calendar, Briefcase, User, CheckCircle2, XCircle } from 'lucide-react'

export default function TimeContent() {
  const [entries, setEntries] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingEntry, setEditingEntry] = useState<any>(null)
  
  // Form state
  const [formData, setFormData] = useState({
    description: '',
    date: new Date().toISOString().split('T')[0],
    duration_minutes: 0,
    project_id: '',
    billable: true,
    hourly_rate: 0
  })

  const supabase = createClient()

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: companies } = await supabase.from('companies').select('id').eq('user_id', user.id).limit(1)
      if (!companies?.length) return
      const companyId = companies[0].id

      // Fetch entries with project name
      const { data: entriesData, error: entErr } = await supabase
        .from('time_entries')
        .select('*, projects(name, hourly_rate)')
        .eq('company_id', companyId)
        .order('date', { ascending: false })

      if (entErr) throw entErr
      setEntries(entriesData || [])

      // Fetch projects for dropdown
      const { data: projectsData } = await supabase
        .from('projects')
        .select('id, name, hourly_rate')
        .eq('company_id', companyId)
        .eq('status', 'aktiv')
        .order('name')
      
      setProjects(projectsData || [])
    } catch (err) {
      console.error('Error fetching data:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenModal = (entry: any = null) => {
    if (entry) {
      setEditingEntry(entry)
      setFormData({
        description: entry.description,
        date: entry.date || new Date().toISOString().split('T')[0],
        duration_minutes: entry.duration_minutes || 0,
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
        project_id: '',
        billable: true,
        hourly_rate: 0
      })
    }
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      
      const { data: companies } = await supabase.from('companies').select('id').eq('user_id', user.id).limit(1)
      if (!companies?.length) return
      const companyId = companies[0].id

      const payload = { ...formData, company_id: companyId }
      if (payload.project_id === '') delete (payload as any).project_id

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
    } catch (err) {
      console.error('Error saving entry:', err)
      alert('Fehler beim Speichern der Zeit')
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
    const dt = new Date(d)
    return String(dt.getDate()).padStart(2, '0') + '.' + String(dt.getMonth() + 1).padStart(2, '0') + '.' + dt.getFullYear()
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
          Zeit erfassen
        </button>
      </div>

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

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[700px]">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Datum</th>
              <th className="px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Beschreibung / Projekt</th>
              <th className="px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Dauer</th>
              <th className="px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Verrechenbar</th>
              <th className="px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-right">Aktionen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-center text-gray-400 text-sm">Laden...</td>
              </tr>
            ) : filteredEntries.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-center text-gray-400 text-sm">Keine Einträge gefunden</td>
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
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <h2 className="font-bold text-gray-900">
                {editingEntry ? 'Eintrag bearbeiten' : 'Zeit erfassen'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <Plus className="rotate-45" size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6">
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
                      value={formData.duration_minutes}
                      onChange={e => {
                        const val = Number(e.target.value)
                        setFormData({...formData, duration_minutes: val})
                      }}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20"
                      placeholder="z.B. 60"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Projekt</label>
                  <select 
                    value={formData.project_id}
                    onChange={e => {
                      const projId = e.target.value
                      const proj = projects.find(p => p.id === projId)
                      setFormData({
                        ...formData, 
                        project_id: projId,
                        hourly_rate: proj ? Number(proj.hourly_rate) : 0
                      })
                    }}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20"
                  >
                    <option value="">– Keines / Intern –</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-3 py-2">
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
                  className="px-6 py-2 bg-[#00875A] hover:bg-[#006B47] text-white rounded-lg text-sm font-semibold transition-colors shadow-sm"
                >
                  Speichern
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
