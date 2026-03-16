'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { Plus, Search, Edit2, Trash2, Briefcase, User, Target, Clock } from 'lucide-react'

export default function ProjectsContent() {
  const [projects, setProjects] = useState<any[]>([])
  const [contacts, setContacts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingProject, setEditingProject] = useState<any>(null)
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    contact_id: '',
    hourly_rate: 120,
    budget: 0,
    status: 'aktiv'
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

      // Fetch projects with contact name
      const { data: projectsData, error: projErr } = await supabase
        .from('projects')
        .select('*, contacts(name)')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })

      if (projErr) throw projErr
      setProjects(projectsData || [])

      // Fetch contacts for dropdown
      const { data: contactsData } = await supabase
        .from('contacts')
        .select('id, name')
        .eq('company_id', companyId)
        .order('name')
      
      setContacts(contactsData || [])
    } catch (err) {
      console.error('Error fetching data:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenModal = (project: any = null) => {
    if (project) {
      setEditingProject(project)
      setFormData({
        name: project.name,
        contact_id: project.contact_id || '',
        hourly_rate: Number(project.hourly_rate) || 120,
        budget: Number(project.budget) || 0,
        status: project.status || 'aktiv'
      })
    } else {
      setEditingProject(null)
      setFormData({
        name: '',
        contact_id: '',
        hourly_rate: 120,
        budget: 0,
        status: 'aktiv'
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
      if (payload.contact_id === '') delete (payload as any).contact_id

      if (editingProject) {
        const { error } = await supabase
          .from('projects')
          .update(payload)
          .eq('id', editingProject.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('projects')
          .insert([payload])
        if (error) throw error
      }

      setShowModal(false)
      fetchData()
    } catch (err) {
      console.error('Error saving project:', err)
      alert('Fehler beim Speichern des Projekts')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Möchten Sie dieses Projekt wirklich löschen?')) return
    try {
      const { error } = await supabase.from('projects').delete().eq('id', id)
      if (error) throw error
      fetchData()
    } catch (err) {
      console.error('Error deleting project:', err)
      alert('Fehler beim Löschen des Projekts')
    }
  }

  const filteredProjects = projects.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.contacts?.name && p.contacts.name.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const fCHF = (n: number) => new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF' }).format(n)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-gray-900">Projekte</h1>
          <p className="text-gray-400 text-sm mt-1">Verwalte deine Projekte und Stundenbudgets</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 bg-[#00875A] hover:bg-[#006B47] text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
        >
          <Plus size={18} />
          Projekt erstellen
        </button>
      </div>

      <div className="flex items-center gap-4 bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text"
            placeholder="Suchen nach Projektname oder Kunde..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full py-10 text-center text-gray-400 text-sm">Laden...</div>
        ) : filteredProjects.length === 0 ? (
          <div className="col-span-full py-10 text-center text-gray-400 text-sm">Keine Projekte gefunden</div>
        ) : (
          filteredProjects.map(project => (
            <div key={project.id} className="bg-white rounded-lg border border-gray-200 shadow-sm hover:border-green-500/50 transition-all group p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="p-2 bg-green-50 text-green-700 rounded-lg">
                  <Briefcase size={20} />
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleOpenModal(project)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md">
                    <Edit2 size={14} />
                  </button>
                  <button onClick={() => handleDelete(project.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              
              <h3 className="font-bold text-gray-900 text-base mb-1">{project.name}</h3>
              <div className="flex items-center gap-1.5 text-[12px] text-gray-500 mb-4">
                <User size={12} /> {project.contacts?.name || 'Kein Kunde'}
              </div>

              <div className="space-y-3 pt-4 border-t border-gray-50">
                <div className="flex items-center justify-between text-[12px]">
                  <span className="text-gray-400 flex items-center gap-1.5"><Clock size={12} /> Stundensatz</span>
                  <span className="font-semibold text-gray-900">{fCHF(project.hourly_rate)}</span>
                </div>
                <div className="flex items-center justify-between text-[12px]">
                  <span className="text-gray-400 flex items-center gap-1.5"><Target size={12} /> Budget</span>
                  <span className="font-semibold text-gray-900">{project.budget > 0 ? fCHF(project.budget) : 'Kein Limit'}</span>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                    project.status === 'aktiv' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {project.status}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <h2 className="font-bold text-gray-900">
                {editingProject ? 'Projekt bearbeiten' : 'Neues Projekt'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <Plus className="rotate-45" size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6">
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Projektname *</label>
                  <input 
                    required
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20"
                    placeholder="z.B. Website Redesign"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Kunde</label>
                  <select 
                    value={formData.contact_id}
                    onChange={e => setFormData({...formData, contact_id: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20"
                  >
                    <option value="">– Keiner –</option>
                    {contacts.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Stundensatz</label>
                    <input 
                      type="number"
                      value={formData.hourly_rate}
                      onChange={e => setFormData({...formData, hourly_rate: Number(e.target.value)})}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Budget (Betrag)</label>
                    <input 
                      type="number"
                      value={formData.budget}
                      onChange={e => setFormData({...formData, budget: Number(e.target.value)})}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Status</label>
                  <select 
                    value={formData.status}
                    onChange={e => setFormData({...formData, status: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20"
                  >
                    <option value="aktiv">Aktiv</option>
                    <option value="abgeschlossen">Abgeschlossen</option>
                  </select>
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
