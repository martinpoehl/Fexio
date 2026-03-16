'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { Building2, Mail, Phone, MapPin, CreditCard, Percent, Save, CheckCircle, Upload, X, User } from 'lucide-react'

export default function SettingsContent() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
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
    mwst_rate: 8.1,
    logo_url: ''
  })

  const [userMeta, setUserMeta] = useState({
    first_name: '',
    last_name: ''
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

      setUserMeta({
        first_name: user.user_metadata?.first_name || '',
        last_name: user.user_metadata?.last_name || ''
      })

      const { data: companies } = await supabase.from('companies').select('*').eq('user_id', user.id).limit(1)

      if (companies && companies.length > 0) {
        const c = companies[0]
        setCompany(c)
        setFormData({
          name: c.name || user.user_metadata?.company || '',
          address: c.address || '',
          zip: c.zip || '',
          city: c.city || '',
          email: c.email || '',
          phone: c.phone || '',
          iban: c.iban || '',
          uid_nr: c.uid_nr || '',
          mwst_rate: Number(c.mwst_rate) || 8.1,
          logo_url: c.logo_url || ''
        })
      }
    } catch (err) {
      console.error('Error fetching company:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = e.target.files?.[0]
      if (!file) return

      const allowedTypes = ['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp']
      if (!allowedTypes.includes(file.type)) {
        alert('Nur JPG, PNG, SVG oder WebP erlaubt.')
        return
      }
      if (file.size > 2 * 1024 * 1024) {
        alert('Datei zu gross. Maximal 2 MB erlaubt.')
        return
      }

      setUploading(true)
      const fileExt = file.name.split('.').pop()
      const fileName = `${Math.random()}.${fileExt}`
      const filePath = `${company.id}/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('logos')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('logos')
        .getPublicUrl(filePath)

      setFormData({ ...formData, logo_url: publicUrl })
      
      // Auto-save logo_url to DB
      await supabase
        .from('companies')
        .update({ logo_url: publicUrl })
        .eq('id', company.id)

    } catch (err) {
      console.error('Error uploading logo:', err)
      alert('Fehler beim Upload des Logos')
    } finally {
      setUploading(false)
    }
  }

  const removeLogo = async () => {
    try {
      setFormData({ ...formData, logo_url: '' })
      await supabase
        .from('companies')
        .update({ logo_url: '' })
        .eq('id', company.id)
    } catch (err) {
      console.error('Error removing logo:', err)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setSaving(true)
      setSaved(false)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !company) return

      const [{ error: companyError }, { error: userError }] = await Promise.all([
        supabase.from('companies').update(formData).eq('id', company.id),
        supabase.auth.updateUser({
          data: {
            first_name: userMeta.first_name,
            last_name: userMeta.last_name,
            full_name: `${userMeta.first_name} ${userMeta.last_name}`.trim()
          }
        })
      ])

      if (companyError) throw companyError
      if (userError) throw userError

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
        {/* Logo Section */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-50 bg-gray-50/30">
            <h2 className="text-[13px] font-bold text-gray-900 flex items-center gap-2">
              <Upload size={16} className="text-gray-400" /> Firmenlogo
            </h2>
          </div>
          <div className="p-6 flex items-center gap-8">
            <div className="relative group">
              <div className="w-24 h-24 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden">
                {formData.logo_url ? (
                  <img src={formData.logo_url} alt="Logo" className="w-full h-full object-contain p-2" />
                ) : (
                  <Building2 size={32} className="text-gray-300" />
                )}
                {uploading && (
                  <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>
              {formData.logo_url && (
                <button 
                  type="button"
                  onClick={removeLogo}
                  className="absolute -top-2 -right-2 p-1 bg-red-100 text-red-600 rounded-full hover:bg-red-200 transition-colors"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-gray-900 mb-1">Logo hochladen</div>
              <p className="text-xs text-gray-500 mb-4">PNG, JPG oder SVG. Quadratisch empfohlen.</p>
              <label className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-[13px] font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer transition-all shadow-sm">
                <Upload size={16} /> Datei wählen
                <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
              </label>
            </div>
          </div>
        </div>

        {/* Personal Info */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-50 bg-gray-50/30">
            <h2 className="text-[13px] font-bold text-gray-900 flex items-center gap-2">
              <User size={16} className="text-gray-400" /> Kontaktperson
            </h2>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Vorname</label>
              <input
                value={userMeta.first_name}
                onChange={e => setUserMeta({...userMeta, first_name: e.target.value})}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-green-500/20"
                placeholder="Max"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Nachname</label>
              <input
                value={userMeta.last_name}
                onChange={e => setUserMeta({...userMeta, last_name: e.target.value})}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-green-500/20"
                placeholder="Muster"
              />
            </div>
          </div>
        </div>

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
