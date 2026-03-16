'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useSearchParams } from 'next/navigation'
import { Plus, Search, FileText, User, Calendar, CheckCircle2, AlertCircle, Clock, Trash2, X, Edit2 } from 'lucide-react'

export default function InvoicesContent() {
  const searchParams = useSearchParams()
  const typeFilter = searchParams.get('type') || 'invoice' // invoice, offer, order

  const [documents, setDocuments] = useState<any[]>([])
  const [contacts, setContacts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingDoc, setEditingDoc] = useState<any>(null)

  const [formData, setFormData] = useState({
    number: '',
    contact_id: '',
    contact_name: '',
    date: new Date().toISOString().split('T')[0],
    due_date: '',
    status: 'entwurf',
    total: 0,
    notes: ''
  })

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const supabase = createClient()

  useEffect(() => {
    fetchDocuments()
  }, [typeFilter])

  async function fetchDocuments() {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: companies } = await supabase.from('companies').select('id').eq('user_id', user.id).limit(1)
      if (!companies?.length) return
      const companyId = companies[0].id

      const [docsResult, contactsResult] = await Promise.all([
        supabase.from('documents').select('*, contacts(name)').eq('company_id', companyId).eq('type', typeFilter).order('date', { ascending: false }),
        supabase.from('contacts').select('id, name').eq('company_id', companyId).order('name')
      ])

      if (docsResult.error) throw docsResult.error
      setDocuments(docsResult.data || [])
      setContacts(contactsResult.data || [])
    } catch (err) {
      console.error('Error fetching documents:', err)
    } finally {
      setLoading(false)
    }
  }

  const prefixes: Record<string, string> = { invoice: 'RE', offer: 'OF', order: 'AU' }
  const generateNumber = () => {
    const year = new Date().getFullYear()
    const seq = String(documents.length + 1).padStart(3, '0')
    return `${prefixes[typeFilter]}-${year}-${seq}`
  }

  const handleOpenModal = (doc: any = null) => {
    if (doc) {
      setEditingDoc(doc)
      setFormData({
        number: doc.number || '',
        contact_id: doc.contact_id || '',
        contact_name: doc.contact_name || doc.contacts?.name || '',
        date: doc.date || new Date().toISOString().split('T')[0],
        due_date: doc.due_date || '',
        status: doc.status || 'entwurf',
        total: Number(doc.total) || 0,
        notes: doc.notes || ''
      })
    } else {
      setEditingDoc(null)
      const dueDate = new Date()
      dueDate.setDate(dueDate.getDate() + 30)
      setFormData({
        number: generateNumber(),
        contact_id: '',
        contact_name: '',
        date: new Date().toISOString().split('T')[0],
        due_date: dueDate.toISOString().split('T')[0],
        status: 'entwurf',
        total: 0,
        notes: ''
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
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: companies } = await supabase.from('companies').select('id').eq('user_id', user.id).limit(1)
      if (!companies?.length) return
      const companyId = companies[0].id

      const selectedContact = contacts.find(c => c.id === formData.contact_id)
      const payload: any = {
        ...formData,
        type: typeFilter,
        company_id: companyId,
        contact_name: selectedContact?.name || formData.contact_name
      }
      if (!payload.contact_id) delete payload.contact_id

      if (editingDoc) {
        const { error } = await supabase.from('documents').update(payload).eq('id', editingDoc.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('documents').insert([payload])
        if (error) throw error
      }

      setShowModal(false)
      fetchDocuments()
    } catch (err: any) {
      console.error('Error saving document:', err)
      setSaveError(err?.message || 'Fehler beim Speichern')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Wirklich löschen?')) return
    try {
      const { error } = await supabase.from('documents').delete().eq('id', id)
      if (error) throw error
      fetchDocuments()
    } catch (err) {
      console.error('Error deleting document:', err)
    }
  }

  const filteredDocs = documents.filter(d => 
    d.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (d.contact_name && d.contact_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (d.contacts?.name && d.contacts.name.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const fCHF = (n: number) => new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF' }).format(n)
  const fD = (d: string) => {
    if (!d) return ''
    const dt = new Date(d)
    return String(dt.getDate()).padStart(2, '0') + '.' + String(dt.getMonth() + 1).padStart(2, '0') + '.' + dt.getFullYear()
  }

  const typeLabels: Record<string, string> = {
    invoice: 'Rechnungen',
    offer: 'Offerten',
    order: 'Aufträge'
  }

  const statusStyles: Record<string, string> = {
    entwurf: 'bg-gray-100 text-gray-600',
    offen: 'bg-amber-50 text-amber-600',
    versendet: 'bg-blue-50 text-blue-600',
    bezahlt: 'bg-green-50 text-green-700',
    angenommen: 'bg-green-50 text-green-700',
    storniert: 'bg-red-50 text-red-600',
    abgelehnt: 'bg-red-50 text-red-600',
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-gray-900">{typeLabels[typeFilter]}</h1>
          <p className="text-gray-400 text-sm mt-1">
            Übersicht deiner {typeLabels[typeFilter].toLowerCase()}
          </p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 bg-[#00875A] hover:bg-[#006B47] text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
        >
          <Plus size={18} />
          {typeFilter === 'invoice' ? 'Rechnung' : typeFilter === 'offer' ? 'Offerte' : 'Auftrag'} erstellen
        </button>
      </div>

      <div className="flex items-center gap-4 bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text"
            placeholder="Suchen nach Nummer oder Kontakt..."
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
              <th className="px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Nummer</th>
              <th className="px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Kontakt</th>
              <th className="px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Datum</th>
              <th className="px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-right">Betrag</th>
              <th className="px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-right"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-gray-400 text-sm">Laden...</td>
              </tr>
            ) : filteredDocs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-gray-400 text-sm">Keine Dokumente gefunden</td>
              </tr>
            ) : (
              filteredDocs.map(doc => (
                <tr key={doc.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="text-[13px] font-bold text-gray-900 flex items-center gap-2">
                      <FileText size={14} className="text-gray-400" /> {doc.number}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-[13px] text-gray-900 flex items-center gap-1.5">
                      <User size={12} className="text-gray-400" /> {doc.contact_name || doc.contacts?.name || '–'}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-[13px] text-gray-600 flex items-center gap-1.5">
                      <Calendar size={12} className="text-gray-400" /> {fD(doc.date)}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-block text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${statusStyles[doc.status] || 'bg-gray-100'}`}>
                      {doc.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="text-[14px] font-bold text-gray-900">{fCHF(doc.total || 0)}</div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => handleOpenModal(doc)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-all">
                        <Edit2 size={16} />
                      </button>
                      <button onClick={() => handleDelete(doc.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-all">
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
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <h2 className="font-bold text-gray-900">
                {editingDoc ? `${typeLabels[typeFilter].slice(0, -1)} bearbeiten` : `Neue ${typeFilter === 'invoice' ? 'Rechnung' : typeFilter === 'offer' ? 'Offerte' : 'Auftrag'}`}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Nummer *</label>
                  <input
                    required
                    value={formData.number}
                    onChange={e => setFormData({...formData, number: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Status</label>
                  <select
                    value={formData.status}
                    onChange={e => setFormData({...formData, status: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20"
                  >
                    {typeFilter === 'invoice' ? (
                      <>
                        <option value="entwurf">Entwurf</option>
                        <option value="offen">Offen</option>
                        <option value="versendet">Versendet</option>
                        <option value="bezahlt">Bezahlt</option>
                        <option value="storniert">Storniert</option>
                      </>
                    ) : (
                      <>
                        <option value="entwurf">Entwurf</option>
                        <option value="versendet">Versendet</option>
                        <option value="angenommen">Angenommen</option>
                        <option value="abgelehnt">Abgelehnt</option>
                      </>
                    )}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Kontakt</label>
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
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Datum *</label>
                  <input
                    required
                    type="date"
                    value={formData.date}
                    onChange={e => setFormData({...formData, date: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Fällig am</label>
                  <input
                    type="date"
                    value={formData.due_date}
                    onChange={e => setFormData({...formData, due_date: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Betrag (Total) *</label>
                  <input
                    required
                    type="number"
                    step="0.05"
                    min="0"
                    value={formData.total}
                    onChange={e => setFormData({...formData, total: Number(e.target.value)})}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Notizen</label>
                  <textarea
                    value={formData.notes}
                    onChange={e => setFormData({...formData, notes: e.target.value})}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20"
                    placeholder="Interne Notizen..."
                  />
                </div>
              </div>
              {saveError && <p className="text-red-600 text-xs mb-3">{saveError}</p>}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-800 transition-colors">
                  Abbrechen
                </button>
                <button type="submit" disabled={saving} className="px-6 py-2 bg-[#00875A] hover:bg-[#006B47] text-white rounded-lg text-sm font-semibold transition-colors shadow-sm disabled:opacity-50">
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
