'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { getOrCreateCompanyId } from '@/lib/getOrCreateCompany'
import { Plus, Search, MoreHorizontal, Edit2, Trash2, Mail, Phone, Building2, X } from 'lucide-react'

export default function ContactsContent() {
  const [contacts, setContacts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingContact, setEditingContact] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  // Form state
  const [formData, setFormData] = useState({
    contact_type: 'firma' as 'firma' | 'person',
    first_name: '',
    last_name: '',
    firm: '',
    email: '',
    phone: '',
    mobile: '',
    address: '',
    zip: '',
    city: '',
    country: 'CH',
    uid_nr: '',
    website: '',
    customer_number: '',
    type: 'kunde',
    notes: ''
  })

  const supabase = createClient()

  useEffect(() => {
    fetchContacts()
  }, [])

  async function fetchContacts() {
    try {
      setLoading(true)
      const companyId = await getOrCreateCompanyId(supabase)

      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('company_id', companyId)
        .order('last_name', { ascending: true })

      if (error) throw error
      setContacts(data || [])
    } catch (err) {
      console.error('Error fetching contacts:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenModal = (contact: any = null) => {
    if (contact) {
      setEditingContact(contact)
      setFormData({
        contact_type: contact.contact_type || 'firma',
        first_name: contact.first_name || '',
        last_name: contact.last_name || '',
        firm: contact.firm || '',
        email: contact.email || '',
        phone: contact.phone || '',
        mobile: contact.mobile || '',
        address: contact.address || '',
        zip: contact.zip || '',
        city: contact.city || '',
        country: contact.country || 'CH',
        uid_nr: contact.uid_nr || '',
        website: contact.website || '',
        customer_number: contact.customer_number || '',
        type: contact.type || 'kunde',
        notes: contact.notes || ''
      })
    } else {
      setEditingContact(null)
      const yy = String(new Date().getFullYear()).slice(-2)
      const prefix = `${yy}-`
      const existing = contacts
        .map(c => c.customer_number || '')
        .filter(n => n.startsWith(prefix))
        .map(n => parseInt(n.replace(prefix, ''), 10))
        .filter(n => !isNaN(n))
      const nextNum = existing.length > 0 ? Math.max(...existing) + 1 : 1030
      setFormData({
        contact_type: 'firma',
        first_name: '',
        last_name: '',
        firm: '',
        email: '',
        phone: '',
        mobile: '',
        address: '',
        zip: '',
        city: '',
        country: 'CH',
        uid_nr: '',
        website: '',
        customer_number: `${prefix}${nextNum}`,
        type: 'kunde',
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
      const companyId = await getOrCreateCompanyId(supabase)

      const combinedName = `${formData.first_name} ${formData.last_name}`.trim() || formData.firm || 'Unbenannter Kontakt'

      const payload = { ...formData, company_id: companyId, name: combinedName }
      let { error } = editingContact
        ? await supabase.from('contacts').update(payload).eq('id', editingContact.id)
        : await supabase.from('contacts').insert([payload])

      // Fallback: customer_number column not migrated yet — retry without it
      if (error?.message?.includes('customer_number')) {
        const { customer_number: _cn, ...withoutCN } = payload
        const fallback = { ...withoutCN, company_id: companyId, name: combinedName };
        ({ error } = editingContact
          ? await supabase.from('contacts').update(fallback).eq('id', editingContact.id)
          : await supabase.from('contacts').insert([fallback]))
      }

      // Fallback: first_name/last_name columns not migrated yet
      if (error?.message?.includes('first_name') || error?.message?.includes('last_name')) {
        const fallback: any = {
          company_id: companyId,
          name: combinedName,
          firm: formData.firm,
          email: formData.email,
          phone: formData.phone,
          address: formData.address,
          zip: formData.zip,
          city: formData.city,
          type: formData.type,
          notes: formData.notes
        };
        ({ error } = editingContact
          ? await supabase.from('contacts').update(fallback).eq('id', editingContact.id)
          : await supabase.from('contacts').insert([fallback]))
      }

      if (error) throw error

      setShowModal(false)
      fetchContacts()
    } catch (err: any) {
      console.error('Error saving contact:', err)
      setSaveError(err?.message || 'Fehler beim Speichern des Kontakts')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Möchten Sie diesen Kontakt wirklich löschen?')) return
    try {
      const { error } = await supabase.from('contacts').delete().eq('id', id)
      if (error) throw error
      fetchContacts()
    } catch (err) {
      console.error('Error deleting contact:', err)
      alert('Fehler beim Löschen des Kontakts')
    }
  }

  const filteredContacts = contacts.filter(c =>
    (c.first_name && c.first_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (c.last_name && c.last_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (c.firm && c.firm.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (c.email && c.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (c.name && c.name.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-gray-900">Kunden</h1>
          <p className="text-gray-400 text-sm mt-1">Verwalte deine Kunden</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 bg-[#00875A] hover:bg-[#006B47] text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
        >
          <Plus size={18} />
          Kunde hinzufügen
        </button>
      </div>

      {/* Search */}
      <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Suchen nach Name, Firma oder Email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Typ</th>
              <th className="px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Name</th>
              <th className="px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Firma</th>
              <th className="px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Ort</th>
              <th className="px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Telefon</th>
              <th className="px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">E-Mail</th>
              <th className="px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-right">Aktionen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-6 py-10 text-center text-gray-400 text-sm">Laden...</td>
              </tr>
            ) : filteredContacts.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-10 text-center text-gray-400 text-sm">Keine Kunden gefunden</td>
              </tr>
            ) : (
              filteredContacts.map(contact => (
                <tr key={contact.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4">
                    {contact.contact_type === 'person' ? (
                      <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full uppercase bg-gray-100 text-gray-600">
                        Person
                      </span>
                    ) : (
                      <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full uppercase bg-[#1e3a5f] text-white">
                        Firma
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-[13px] font-semibold text-gray-900">
                      {contact.first_name || contact.last_name ? `${contact.first_name || ''} ${contact.last_name || ''}`.trim() : contact.name}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-[13px] text-gray-600">
                    {contact.firm || '–'}
                  </td>
                  <td className="px-6 py-4 text-[13px] text-gray-600">
                    {contact.zip || contact.city ? `${contact.zip || ''} ${contact.city || ''}`.trim() : '–'}
                  </td>
                  <td className="px-6 py-4 text-[12px] text-gray-600">
                    {contact.phone || contact.mobile ? (
                      <div className="space-y-0.5">
                        {contact.phone && <div className="flex items-center gap-1.5"><Phone size={11} className="text-gray-400" />{contact.phone}</div>}
                        {contact.mobile && <div className="flex items-center gap-1.5"><Phone size={11} className="text-gray-400" />{contact.mobile}</div>}
                      </div>
                    ) : '–'}
                  </td>
                  <td className="px-6 py-4 text-[12px] text-gray-600">
                    {contact.email ? (
                      <div className="flex items-center gap-1.5">
                        <Mail size={12} className="text-gray-400" /> {contact.email}
                      </div>
                    ) : '–'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleOpenModal(contact)}
                        className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(contact.id)}
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
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <h2 className="font-bold text-gray-900">
                {editingContact ? 'Kunde bearbeiten' : 'Neuer Kunde'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1">
              {/* Contact type toggle */}
              <div className="mb-6">
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Kontakttyp</label>
                <div className="flex rounded-lg border border-gray-200 overflow-hidden w-fit">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, contact_type: 'firma' })}
                    className={`px-6 py-2.5 text-sm font-semibold transition-colors ${
                      formData.contact_type === 'firma'
                        ? 'bg-[#1e3a5f] text-white'
                        : 'bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    Firma
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, contact_type: 'person' })}
                    className={`px-6 py-2.5 text-sm font-semibold transition-colors border-l border-gray-200 ${
                      formData.contact_type === 'person'
                        ? 'bg-gray-600 text-white'
                        : 'bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    Person
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Vorname</label>
                  <input
                    value={formData.first_name}
                    onChange={e => setFormData({...formData, first_name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20"
                    placeholder="Max"
                  />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Nachname</label>
                  <input
                    value={formData.last_name}
                    onChange={e => setFormData({...formData, last_name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20"
                    placeholder="Muster"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Firma</label>
                  <input
                    value={formData.firm}
                    onChange={e => setFormData({...formData, firm: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20"
                    placeholder="Firmenname"
                  />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">E-Mail</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20"
                    placeholder="email@beispiel.ch"
                  />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Telefon</label>
                  <input
                    value={formData.phone}
                    onChange={e => setFormData({...formData, phone: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20"
                    placeholder="+41 44 000 00 00"
                  />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Mobile</label>
                  <input
                    value={formData.mobile}
                    onChange={e => setFormData({...formData, mobile: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20"
                    placeholder="+41 79 000 00 00"
                  />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Website</label>
                  <input
                    value={formData.website}
                    onChange={e => setFormData({...formData, website: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20"
                    placeholder="www.beispiel.ch"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Adresse</label>
                  <input
                    value={formData.address}
                    onChange={e => setFormData({...formData, address: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20"
                    placeholder="Strasse / Nr."
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">PLZ</label>
                  <input
                    value={formData.zip}
                    onChange={e => setFormData({...formData, zip: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20"
                    placeholder="8000"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Ort</label>
                  <input
                    value={formData.city}
                    onChange={e => setFormData({...formData, city: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20"
                    placeholder="Zürich"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Land</label>
                  <input
                    value={formData.country}
                    onChange={e => setFormData({...formData, country: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20"
                    placeholder="CH"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">UID-Nummer</label>
                  <input
                    value={formData.uid_nr}
                    onChange={e => setFormData({...formData, uid_nr: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20"
                    placeholder="CHE-123.456.789"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Kundennummer</label>
                  <input
                    value={formData.customer_number}
                    onChange={e => setFormData({...formData, customer_number: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20"
                    placeholder="K-1000"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Notizen</label>
                  <textarea
                    value={formData.notes}
                    onChange={e => setFormData({...formData, notes: e.target.value})}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20"
                  />
                </div>
              </div>
              {saveError && (
                <p className="text-red-600 text-xs mb-3">{saveError}</p>
              )}
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
