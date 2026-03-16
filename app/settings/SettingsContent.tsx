'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { Building2, Mail, Phone, MapPin, CreditCard, Percent, Save, CheckCircle } from 'lucide-react'

export default function SettingsContent() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [company, setCompany] = useState<any>(null)
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    zip: '',
    city: '',
    email: '',
    phone: '',
    iban: '',
    uid_nr: '',
    mwst_rate: 8.1
  })

  const supabase = createClient()

  useEffect(() => {
    fetchCompany()
  }, [])

  async function fetchCompany() {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: companies } = await supabase.from('companies').select('*').eq('user_id', user.id).limit(1)
      
      if (companies && companies.length > 0) {
        const c = companies[0]
        setCompany(c)
        setFormData({
          name: c.name || '',
          address: c.address || '',
          zip: c.zip || '',
          city: c.city || '',
          email: c.email || '',
          phone: c.phone || '',
          iban: c.iban || '',
          uid_nr: c.uid_nr || '',
          mwst_rate: Number(c.mwst_rate) || 8.1
        })
      }
    } catch (err) {
      console.error('Error fetching company:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setSaving(true)
      setSaved(false)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !company) return
      
      const { error } = await supabase
        .from('companies')
        .update(formData)
        .eq('id', company.id)

      if (error) throw error
      
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      console.error('Error saving settings:', err)
      alert('Fehler beim Speichern der Einstellungen')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="text-center py-10 text-gray-400">Laden...</div>

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-[22px] font-bold text-gray-900">Einstellungen</h1>
        <p className="text-gray-400 text-sm mt-1">Verwalte dein Firmenprofil und Standardwerte</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-50 bg-gray-50/30">
            <h2 className="text-[13px] font-bold text-gray-900 flex items-center gap-2">
              <Building2 size={16} className="text-gray-400" /> Firmendaten
            </h2>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Firmenname *</label>
              <input 
                required
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-green-500/20"
                placeholder="Meine Firma AG"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Adresse</label>
              <input 
                value={formData.address}
                onChange={e => setFormData({...formData, address: e.target.value})}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-green-500/20"
                placeholder="Musterstrasse 123"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">PLZ</label>
              <input 
                value={formData.zip}
                onChange={e => setFormData({...formData, zip: e.target.value})}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-green-500/20"
                placeholder="8000"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Ort</label>
              <input 
                value={formData.city}
                onChange={e => setFormData({...formData, city: e.target.value})}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-green-500/20"
                placeholder="Zürich"
              />
            </div>
          </div>
        </div>

        {/* Contact & Legal */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-50 bg-gray-50/30">
            <h2 className="text-[13px] font-bold text-gray-900 flex items-center gap-2">
              <Mail size={16} className="text-gray-400" /> Kontakt & Rechtliches
            </h2>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">E-Mail</label>
              <input 
                type="email"
                value={formData.email}
                onChange={e => setFormData({...formData, email: e.target.value})}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-green-500/20"
                placeholder="info@meinefirma.ch"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Telefon</label>
              <input 
                value={formData.phone}
                onChange={e => setFormData({...formData, phone: e.target.value})}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-green-500/20"
                placeholder="+41 44 123 45 67"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">IBAN</label>
              <input 
                value={formData.iban}
                onChange={e => setFormData({...formData, iban: e.target.value})}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-green-500/20"
                placeholder="CH00 0000 0000 0000 0000 0"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">UID Nummer</label>
              <input 
                value={formData.uid_nr}
                onChange={e => setFormData({...formData, uid_nr: e.target.value})}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-green-500/20"
                placeholder="CHE-123.456.789 MWST"
              />
            </div>
          </div>
        </div>

        {/* Taxes */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-50 bg-gray-50/30">
            <h2 className="text-[13px] font-bold text-gray-900 flex items-center gap-2">
              <Percent size={16} className="text-gray-400" /> Standard MwSt
            </h2>
          </div>
          <div className="p-6">
            <div className="max-w-[200px]">
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Standard MwSt-Satz (%)</label>
              <input 
                type="number"
                step="0.1"
                value={formData.mwst_rate}
                onChange={e => setFormData({...formData, mwst_rate: Number(e.target.value)})}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-green-500/20"
              />
            </div>
            <p className="mt-3 text-[11px] text-gray-400">Dieser Satz wird standardmässig für neue Produkte und Rechnungen verwendet.</p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-4 pt-4 sticky bottom-6 z-10">
          {saved && (
            <div className="flex items-center gap-2 text-green-600 font-semibold text-sm animate-in fade-in slide-in-from-right-4">
              <CheckCircle size={18} /> Einstellungen gespeichert!
            </div>
          )}
          <button 
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-8 py-3 bg-[#00875A] hover:bg-[#006B47] text-white rounded-lg text-sm font-bold transition-all shadow-md disabled:opacity-50"
          >
            <Save size={18} /> {saving ? 'Speichert...' : 'Speichern'}
          </button>
        </div>
      </form>
    </div>
  )
}
