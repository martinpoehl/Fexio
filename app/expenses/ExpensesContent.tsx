'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { getOrCreateCompanyId } from '@/lib/getOrCreateCompany'
import { Plus, Search, Edit2, Trash2, Receipt, Calendar, User, Tag, X, Paperclip, Upload } from 'lucide-react'

const ACCOUNTS = [
  { id: '6700', label: '6700 - Sonstiger Betriebsaufwand' },
  { id: '4000', label: '4000 - Wareneinkauf' },
  { id: '4500', label: '4500 - Dienstleistungen von Dritten' },
  { id: '6000', label: '6000 - Raumaufwand' },
  { id: '6200', label: '6200 - Fahrzeugaufwand' },
  { id: '6500', label: '6500 - Versicherungen' },
  { id: '6570', label: '6570 - Informatikaufwand' },
  { id: '6600', label: '6600 - Werbeaufwand' },
]

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5 MB

export default function ExpensesContent() {
  const [expenses, setExpenses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingExpense, setEditingExpense] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  // Receipt upload state
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [receiptUploading, setReceiptUploading] = useState(false)
  const [receiptUrl, setReceiptUrl] = useState<string>('')
  const [receiptError, setReceiptError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Form state
  const [formData, setFormData] = useState({
    description: '',
    amount: 0,
    date: new Date().toISOString().split('T')[0],
    category: 'Sonstige',
    vendor: '',
    account_nr: '6700',
    notes: '',
    receipt_url: ''
  })

  const supabase = createClient()

  useEffect(() => {
    fetchExpenses()
  }, [])

  async function fetchExpenses() {
    try {
      setLoading(true)
      const companyId = await getOrCreateCompanyId(supabase)

      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('company_id', companyId)
        .order('date', { ascending: false })

      if (error) throw error
      setExpenses(data || [])
    } catch (err) {
      console.error('Error fetching expenses:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenModal = (expense: any = null) => {
    if (expense) {
      setEditingExpense(expense)
      setFormData({
        description: expense.description,
        amount: Number(expense.amount) || 0,
        date: expense.date || new Date().toISOString().split('T')[0],
        category: expense.category || 'Sonstige',
        vendor: expense.vendor || '',
        account_nr: expense.account_nr || '6700',
        notes: expense.notes || '',
        receipt_url: expense.receipt_url || ''
      })
      setReceiptUrl(expense.receipt_url || '')
    } else {
      setEditingExpense(null)
      setFormData({
        description: '',
        amount: 0,
        date: new Date().toISOString().split('T')[0],
        category: 'Sonstige',
        vendor: '',
        account_nr: '6700',
        notes: '',
        receipt_url: ''
      })
      setReceiptUrl('')
    }
    setReceiptFile(null)
    setReceiptError('')
    setSaveError('')
    setShowModal(true)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setReceiptError('')

    const allowed = ['image/jpeg', 'image/png', 'application/pdf']
    if (!allowed.includes(file.type)) {
      setReceiptError('Nur JPG, PNG oder PDF erlaubt.')
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      setReceiptError('Datei ist zu groß (max. 5 MB).')
      return
    }
    setReceiptFile(file)
  }

  const uploadReceipt = async (companyId: string): Promise<string> => {
    if (!receiptFile) return receiptUrl

    setReceiptUploading(true)
    try {
      const ext = receiptFile.name.split('.').pop()
      const fileName = `${companyId}/${Date.now()}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(fileName, receiptFile, { upsert: false })

      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage
        .from('receipts')
        .getPublicUrl(fileName)

      return urlData?.publicUrl || ''
    } catch (err: any) {
      console.error('Receipt upload error:', err)
      throw new Error('Beleg konnte nicht hochgeladen werden: ' + (err?.message || ''))
    } finally {
      setReceiptUploading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setSaveError('')
    try {
      const companyId = await getOrCreateCompanyId(supabase)

      let finalReceiptUrl = receiptUrl
      if (receiptFile) {
        finalReceiptUrl = await uploadReceipt(companyId)
      }

      const payload = { ...formData, receipt_url: finalReceiptUrl }

      if (editingExpense) {
        const { error } = await supabase
          .from('expenses')
          .update(payload)
          .eq('id', editingExpense.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('expenses')
          .insert([{ ...payload, company_id: companyId }])
        if (error) throw error
      }

      setShowModal(false)
      fetchExpenses()
    } catch (err: any) {
      console.error('Error saving expense:', err)
      setSaveError(err?.message || 'Fehler beim Speichern der Ausgabe')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Möchten Sie diese Ausgabe wirklich löschen?')) return
    try {
      const { error } = await supabase.from('expenses').delete().eq('id', id)
      if (error) throw error
      fetchExpenses()
    } catch (err) {
      console.error('Error deleting expense:', err)
      alert('Fehler beim Löschen der Ausgabe')
    }
  }

  const filteredExpenses = expenses.filter(e =>
    e.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (e.vendor && e.vendor.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const fCHF = (n: number) => new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF' }).format(n)
  const fD = (d: string) => {
    if (!d) return ''
    const dt = new Date(d)
    return String(dt.getDate()).padStart(2, '0') + '.' + String(dt.getMonth() + 1).padStart(2, '0') + '.' + dt.getFullYear()
  }

  const getReceiptFilename = (url: string) => {
    try {
      const parts = new URL(url).pathname.split('/')
      return decodeURIComponent(parts[parts.length - 1])
    } catch {
      return 'Beleg'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-gray-900">Ausgaben</h1>
          <p className="text-gray-400 text-sm mt-1">Verwalte deine Ausgaben und Lieferantenrechnungen</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 bg-[#00875A] hover:bg-[#006B47] text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
        >
          <Plus size={18} />
          Ausgabe hinzufügen
        </button>
      </div>

      <div className="flex items-center gap-4 bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Suchen nach Beschreibung oder Lieferant..."
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
              <th className="px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Datum / Beleg</th>
              <th className="px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Beschreibung / Lieferant</th>
              <th className="px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Konto</th>
              <th className="px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-right">Betrag</th>
              <th className="px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-right">Aktionen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-center text-gray-400 text-sm">Laden...</td>
              </tr>
            ) : filteredExpenses.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-center text-gray-400 text-sm">Keine Ausgaben gefunden</td>
              </tr>
            ) : (
              filteredExpenses.map(expense => (
                <tr key={expense.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="text-[13px] font-medium text-gray-900 flex items-center gap-2">
                      <Calendar size={13} className="text-gray-400" /> {fD(expense.date)}
                    </div>
                    {expense.receipt_url && (
                      <a
                        href={expense.receipt_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 mt-1 text-[11px] text-blue-500 hover:text-blue-700 transition-colors"
                        title="Beleg öffnen"
                      >
                        <Paperclip size={11} />
                        Beleg
                      </a>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-[13px] font-semibold text-gray-900">{expense.description}</div>
                    <div className="text-[11px] text-gray-500 flex items-center gap-1 mt-0.5">
                      <User size={10} /> {expense.vendor || '–'}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-[12px] text-gray-600">
                      {expense.account_nr}
                    </div>
                    <div className="text-[10px] text-gray-400 truncate max-w-[150px]">
                      {ACCOUNTS.find(a => a.id === expense.account_nr)?.label.split(' - ')[1] || 'Betriebsaufwand'}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="text-[13px] font-bold text-red-600">{fCHF(expense.amount)}</div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleOpenModal(expense)}
                        className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(expense.id)}
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
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <h2 className="font-bold text-gray-900">
                {editingExpense ? 'Ausgabe bearbeiten' : 'Neue Ausgabe'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Beschreibung *</label>
                  <input
                    required
                    value={formData.description}
                    onChange={e => setFormData({...formData, description: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20"
                    placeholder="Wofür war diese Ausgabe?"
                  />
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
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Betrag (Brutto) *</label>
                  <input
                    required
                    type="number"
                    step="0.05"
                    min="0"
                    value={formData.amount}
                    onChange={e => setFormData({...formData, amount: Number(e.target.value)})}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Lieferant</label>
                  <input
                    value={formData.vendor}
                    onChange={e => setFormData({...formData, vendor: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20"
                    placeholder="Name des Lieferanten / Verkäufer"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Buchhaltungskonto</label>
                  <select
                    value={formData.account_nr}
                    onChange={e => setFormData({...formData, account_nr: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20"
                  >
                    {ACCOUNTS.map(acc => (
                      <option key={acc.id} value={acc.id}>{acc.label}</option>
                    ))}
                  </select>
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

                {/* Receipt upload */}
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Beleg hochladen</label>
                  <div
                    className="border-2 border-dashed border-gray-200 rounded-lg p-4 flex flex-col items-center gap-2 cursor-pointer hover:border-green-400 hover:bg-green-50/30 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload size={20} className="text-gray-400" />
                    <p className="text-[12px] text-gray-500 text-center">
                      JPG, PNG oder PDF – max. 5 MB
                    </p>
                    {receiptFile ? (
                      <span className="text-[12px] font-medium text-green-700 flex items-center gap-1">
                        <Paperclip size={12} /> {receiptFile.name}
                      </span>
                    ) : receiptUrl ? (
                      <span className="text-[12px] font-medium text-blue-600 flex items-center gap-1">
                        <Paperclip size={12} /> {getReceiptFilename(receiptUrl)}
                      </span>
                    ) : null}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".jpg,.jpeg,.png,.pdf"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  {receiptError && <p className="text-red-500 text-xs mt-1">{receiptError}</p>}
                  {receiptUrl && !receiptFile && (
                    <div className="mt-2 flex items-center gap-2">
                      <a
                        href={receiptUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[12px] text-blue-500 hover:text-blue-700 underline flex items-center gap-1"
                      >
                        <Paperclip size={12} /> Aktuellen Beleg öffnen
                      </a>
                      <button
                        type="button"
                        onClick={() => { setReceiptUrl(''); setFormData(f => ({ ...f, receipt_url: '' })) }}
                        className="text-[11px] text-red-400 hover:text-red-600 transition-colors"
                      >
                        Entfernen
                      </button>
                    </div>
                  )}
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
                  disabled={saving || receiptUploading}
                  className="px-6 py-2 bg-[#00875A] hover:bg-[#006B47] text-white rounded-lg text-sm font-semibold transition-colors shadow-sm disabled:opacity-50"
                >
                  {saving || receiptUploading ? 'Speichert...' : 'Speichern'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
