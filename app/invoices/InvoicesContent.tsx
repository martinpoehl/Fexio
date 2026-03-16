'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { getOrCreateCompanyId } from '@/lib/getOrCreateCompany'
import { useSearchParams } from 'next/navigation'
import { Plus, Search, FileText, User, Calendar, Trash2, X, Edit2, Package, FileDown, Mail } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface LineItem {
  id?: string          // set when loaded from DB
  position: number
  description: string
  quantity: number
  unit: string
  unit_price: number
  discount: number     // 0-100 %
  tax_rate: number
  total: number        // calculated: quantity * unit_price * (1 - discount/100) * (1 + tax_rate/100)
}

interface FormData {
  number: string
  title: string
  contact_id: string
  contact_name: string
  date: string
  due_date: string
  status: string
  notes: string
}

const TAX_RATES = [8.1, 2.6, 3.8, 0]

const emptyLine = (position: number): LineItem => ({
  position,
  description: '',
  quantity: 1,
  unit: 'Stk.',
  unit_price: 0,
  discount: 0,
  tax_rate: 8.1,
  total: 0,
})

// ─── Component ────────────────────────────────────────────────────────────────

export default function InvoicesContent() {
  const searchParams = useSearchParams()
  const typeFilter = searchParams.get('type') || 'invoice' // invoice | offer | order

  const [documents, setDocuments] = useState<any[]>([])
  const [contacts, setContacts] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('alle')
  const [showModal, setShowModal] = useState(false)
  const [editingDoc, setEditingDoc] = useState<any>(null)

  const [formData, setFormData] = useState<FormData>({
    number: '',
    title: '',
    contact_id: '',
    contact_name: '',
    date: new Date().toISOString().split('T')[0],
    due_date: '',
    status: 'entwurf',
    notes: '',
  })

  const [lines, setLines] = useState<LineItem[]>([emptyLine(1)])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  // ─── Email modal state ───────────────────────────────────────────────────────
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [emailDoc, setEmailDoc] = useState<any>(null)
  const [emailForm, setEmailForm] = useState({ to: '', subject: '', message: '' })
  const [emailSending, setEmailSending] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [emailError, setEmailError] = useState('')

  const supabase = createClient()

  // ─── Fetch ──────────────────────────────────────────────────────────────────

  const fetchDocuments = useCallback(async () => {
    try {
      setLoading(true)
      const companyId = await getOrCreateCompanyId(supabase)

      const [docsResult, contactsResult, productsResult] = await Promise.all([
        supabase
          .from('documents')
          .select('*, contacts(name, first_name, last_name, firm)')
          .eq('company_id', companyId)
          .eq('type', typeFilter)
          .order('date', { ascending: false }),
        supabase
          .from('contacts')
          .select('id, name, first_name, last_name, firm, email')
          .eq('company_id', companyId)
          .order('last_name'),
        supabase
          .from('products')
          .select('id, name, description, price, unit, tax_rate')
          .eq('company_id', companyId)
          .order('name'),
      ])

      if (docsResult.error) throw docsResult.error
      setDocuments(docsResult.data || [])
      setContacts(contactsResult.data || [])
      setProducts(productsResult.data || [])
    } catch (err) {
      console.error('Error fetching documents:', err)
    } finally {
      setLoading(false)
    }
  }, [typeFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchDocuments()
    setStatusFilter('alle')
  }, [fetchDocuments])

  // ─── Helpers ────────────────────────────────────────────────────────────────

  const prefixes: Record<string, string> = { invoice: 'RE', offer: 'OF', order: 'AU' }

  const generateNumber = () => {
    const year = new Date().getFullYear()
    const seq = String(documents.length + 1).padStart(3, '0')
    return `${prefixes[typeFilter]}-${year}-${seq}`
  }

  const getContactLabel = (c: any) => {
    const fullName = [c.first_name, c.last_name].filter(Boolean).join(' ')
    return fullName || c.name || c.firm || '–'
  }

  const calcLineTotal = (line: LineItem): number => {
    const net = line.quantity * line.unit_price * (1 - (line.discount || 0) / 100)
    return Math.round(net * (1 + line.tax_rate / 100) * 100) / 100
  }

  const calcTotals = (ls: LineItem[]) => {
    const subtotal = ls.reduce((sum, l) => sum + l.quantity * l.unit_price * (1 - (l.discount || 0) / 100), 0)
    const total = ls.reduce((sum, l) => sum + l.total, 0)
    const tax_amount = total - subtotal
    return {
      subtotal: Math.round(subtotal * 100) / 100,
      tax_amount: Math.round(tax_amount * 100) / 100,
      total: Math.round(total * 100) / 100,
    }
  }

  const fCHF = (n: number) =>
    new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF' }).format(n)

  const fD = (d: string) => {
    if (!d) return ''
    const dt = new Date(d)
    return (
      String(dt.getDate()).padStart(2, '0') +
      '.' +
      String(dt.getMonth() + 1).padStart(2, '0') +
      '.' +
      dt.getFullYear()
    )
  }

  // ─── Status filter tabs ──────────────────────────────────────────────────────

  const invoiceStatusTabs = ['alle', 'entwurf', 'versendet', 'bezahlt', 'storniert']
  const offerStatusTabs = ['alle', 'entwurf', 'versendet', 'akzeptiert', 'abgelehnt']
  const statusTabs = typeFilter === 'offer' ? offerStatusTabs : invoiceStatusTabs

  const statusTabLabels: Record<string, string> = {
    alle: 'Alle',
    entwurf: 'Entwurf',
    versendet: 'Versendet',
    bezahlt: 'Bezahlt',
    storniert: 'Storniert',
    akzeptiert: 'Akzeptiert',
    abgelehnt: 'Abgelehnt',
  }

  // ─── Modal open/close ───────────────────────────────────────────────────────

  const handleOpenModal = async (doc: any = null) => {
    setSaveError('')
    if (doc) {
      setEditingDoc(doc)
      setFormData({
        number: doc.number || '',
        title: doc.title || '',
        contact_id: doc.contact_id || '',
        contact_name: doc.contact_name || doc.contacts?.name || '',
        date: doc.date || new Date().toISOString().split('T')[0],
        due_date: doc.due_date || '',
        status: doc.status || 'entwurf',
        notes: doc.notes || '',
      })

      // Load existing lines
      const { data: existingLines } = await supabase
        .from('document_lines')
        .select('*')
        .eq('document_id', doc.id)
        .order('position')

      if (existingLines && existingLines.length > 0) {
        setLines(
          existingLines.map((l: any) => ({
            id: l.id,
            position: l.position,
            description: l.description || '',
            quantity: Number(l.quantity) || 1,
            unit: l.unit || 'Stk.',
            unit_price: Number(l.unit_price) || 0,
            discount: Number(l.discount) || 0,
            tax_rate: Number(l.tax_rate) ?? 8.1,
            total: Number(l.total) || 0,
          }))
        )
      } else {
        setLines([emptyLine(1)])
      }
    } else {
      setEditingDoc(null)
      const dueDate = new Date()
      dueDate.setDate(dueDate.getDate() + 30)
      setFormData({
        number: generateNumber(),
        title: '',
        contact_id: '',
        contact_name: '',
        date: new Date().toISOString().split('T')[0],
        due_date: dueDate.toISOString().split('T')[0],
        status: 'entwurf',
        notes: '',
      })
      setLines([emptyLine(1)])
    }
    setShowModal(true)
  }

  // ─── Line item manipulation ──────────────────────────────────────────────────

  const updateLine = (index: number, patch: Partial<LineItem>) => {
    setLines(prev => {
      const updated = prev.map((l, i) => {
        if (i !== index) return l
        const merged = { ...l, ...patch }
        merged.total = calcLineTotal(merged)
        return merged
      })
      return updated
    })
  }

  const addLine = () => {
    setLines(prev => [...prev, emptyLine(prev.length + 1)])
  }

  const deleteLine = (index: number) => {
    setLines(prev => {
      const filtered = prev.filter((_, i) => i !== index)
      return filtered.map((l, i) => ({ ...l, position: i + 1 }))
    })
  }

  const applyProduct = (index: number, productId: string) => {
    if (!productId) return
    const product = products.find(p => p.id === productId)
    if (!product) return
    updateLine(index, {
      description: product.name || '',
      unit_price: Number(product.price) || 0,
      unit: product.unit || 'Stk.',
      tax_rate: Number(product.tax_rate) ?? 8.1,
    })
  }

  // ─── Save ────────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setSaveError('')
    try {
      const companyId = await getOrCreateCompanyId(supabase)
      const selectedContact = contacts.find(c => c.id === formData.contact_id)
      const { subtotal, tax_amount, total } = calcTotals(lines)

      const docPayload: any = {
        ...formData,
        type: typeFilter,
        company_id: companyId,
        contact_name: selectedContact
          ? getContactLabel(selectedContact)
          : formData.contact_name,
        subtotal,
        tax_amount,
        total,
      }
      if (!docPayload.contact_id) delete docPayload.contact_id

      let documentId: string

      if (editingDoc) {
        const { error } = await supabase
          .from('documents')
          .update(docPayload)
          .eq('id', editingDoc.id)
        if (error) throw error
        documentId = editingDoc.id

        // Delete existing lines then re-insert
        const { error: delErr } = await supabase
          .from('document_lines')
          .delete()
          .eq('document_id', documentId)
        if (delErr) throw delErr
      } else {
        const { data: inserted, error } = await supabase
          .from('documents')
          .insert([docPayload])
          .select('id')
          .single()
        if (error) throw error
        documentId = inserted.id
      }

      // Insert lines
      if (lines.length > 0) {
        const lineRows = lines.map((l, i) => ({
          document_id: documentId,
          position: i + 1,
          description: l.description,
          quantity: l.quantity,
          unit: l.unit,
          unit_price: l.unit_price,
          discount: l.discount || 0,
          tax_rate: l.tax_rate,
          total: l.total,
        }))
        const { error: linesErr } = await supabase
          .from('document_lines')
          .insert(lineRows)
        if (linesErr) throw linesErr
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

  // ─── Delete document ─────────────────────────────────────────────────────────

  const handleDelete = async (id: string) => {
    if (!confirm('Wirklich löschen?')) return
    try {
      // Lines should cascade-delete via FK; if not, delete explicitly first
      await supabase.from('document_lines').delete().eq('document_id', id)
      const { error } = await supabase.from('documents').delete().eq('id', id)
      if (error) throw error
      fetchDocuments()
    } catch (err) {
      console.error('Error deleting document:', err)
    }
  }

  // ─── Email ───────────────────────────────────────────────────────────────────

  const handleOpenEmailModal = async (doc: any) => {
    setEmailError('')
    setEmailSent(false)
    setEmailDoc(doc)

    // Try to get contact email
    let contactEmail = ''
    if (doc.contact_id) {
      const contact = contacts.find((c: any) => c.id === doc.contact_id)
      contactEmail = contact?.email || ''
    }

    const companyId = await getOrCreateCompanyId(supabase)
    const { data: company } = await supabase
      .from('companies')
      .select('name')
      .eq('id', companyId)
      .single()
    const companyName = company?.name || 'Unser Unternehmen'

    const typeLabelsEmail: Record<string, string> = {
      invoice: 'Rechnung',
      offer: 'Offerte',
      order: 'Auftrag',
    }
    const docLabel = typeLabelsEmail[doc.type] || 'Dokument'

    setEmailForm({
      to: contactEmail,
      subject: `${docLabel} ${doc.number} von ${companyName}`,
      message: `Sehr geehrte Damen und Herren,\n\nIm Anhang finden Sie die ${docLabel} ${doc.number}.\n\nBei Fragen stehen wir Ihnen gerne zur Verfügung.\n\nFreundliche Grüsse\n${companyName}`,
    })
    setShowEmailModal(true)
  }

  const handleSendEmail = async () => {
    if (!emailForm.to || !emailForm.subject) return
    setEmailSending(true)
    setEmailError('')
    try {
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: emailDoc.id,
          recipientEmail: emailForm.to,
          subject: emailForm.subject,
          message: emailForm.message,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setEmailError(data.error || 'Fehler beim Senden.')
      } else {
        setEmailSent(true)
      }
    } catch (err: any) {
      setEmailError(err?.message || 'Netzwerkfehler.')
    } finally {
      setEmailSending(false)
    }
  }

  // ─── Derived state ────────────────────────────────────────────────────────────

  const filteredDocs = documents.filter(d => {
    const matchesSearch =
      d.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (d.contact_name && d.contact_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (d.contacts?.name && d.contacts.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (d.title && d.title.toLowerCase().includes(searchTerm.toLowerCase()))

    const matchesStatus = statusFilter === 'alle' || d.status === statusFilter

    return matchesSearch && matchesStatus
  })

  const { subtotal, tax_amount, total } = calcTotals(lines)

  const typeLabels: Record<string, string> = {
    invoice: 'Rechnungen',
    offer: 'Offerten',
    order: 'Aufträge',
  }

  const statusStyles: Record<string, string> = {
    entwurf: 'bg-gray-100 text-gray-600',
    offen: 'bg-amber-50 text-amber-600',
    versendet: 'bg-blue-50 text-blue-600',
    bezahlt: 'bg-green-50 text-green-700',
    akzeptiert: 'bg-green-50 text-green-700',
    angenommen: 'bg-green-50 text-green-700',
    storniert: 'bg-red-50 text-red-600',
    abgelehnt: 'bg-red-50 text-red-600',
  }

  const statusLabels: Record<string, string> = {
    entwurf: 'Entwurf',
    offen: 'Offen',
    versendet: 'Versendet',
    bezahlt: 'Bezahlt',
    akzeptiert: 'Akzeptiert',
    angenommen: 'Akzeptiert',
    storniert: 'Storniert',
    abgelehnt: 'Abgelehnt',
  }

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
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
          {typeFilter === 'invoice'
            ? 'Rechnung'
            : typeFilter === 'offer'
            ? 'Offerte'
            : 'Auftrag'}{' '}
          erstellen
        </button>
      </div>

      {/* Search + Status Filter Tabs */}
      <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm space-y-3">
        {/* Status filter pills */}
        <div className="flex items-center gap-2 flex-wrap">
          {statusTabs.map(tab => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors border ${
                statusFilter === tab
                  ? 'bg-[#00875A] text-white border-[#00875A]'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}
            >
              {statusTabLabels[tab]}
            </button>
          ))}
        </div>
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Suchen nach Nummer, Titel oder Kontakt..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[900px]">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Nummer</th>
              <th className="px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Titel</th>
              <th className="px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Kontakt</th>
              <th className="px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Datum</th>
              <th className="px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Fällig</th>
              <th className="px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-right">Betrag CHF</th>
              <th className="px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-right"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={8} className="px-6 py-10 text-center text-gray-400 text-sm">Laden...</td>
              </tr>
            ) : filteredDocs.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-10 text-center text-gray-400 text-sm">Keine Dokumente gefunden</td>
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
                    <div className="text-[13px] text-gray-600 max-w-[160px] truncate" title={doc.title}>
                      {doc.title || '–'}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-[13px] text-gray-900 flex items-center gap-1.5">
                      <User size={12} className="text-gray-400" />
                      {doc.contact_name || (doc.contacts ? getContactLabel(doc.contacts) : '–')}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-[13px] text-gray-600 flex items-center gap-1.5">
                      <Calendar size={12} className="text-gray-400" /> {fD(doc.date)}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-[13px] text-gray-600">
                      {doc.due_date ? fD(doc.due_date) : '–'}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-block text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                        statusStyles[doc.status] || 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {statusLabels[doc.status] || doc.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="text-[14px] font-bold text-gray-900">
                      {fCHF(doc.total || 0)}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <a
                        href={`/api/pdf?documentId=${doc.id}`}
                        target="_blank"
                        download
                        className="p-1.5 text-gray-400 hover:text-[#00875A] hover:bg-green-50 rounded-md transition-all"
                        title="PDF herunterladen"
                      >
                        <FileDown size={16} />
                      </a>
                      <button
                        onClick={() => handleOpenEmailModal(doc)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-all"
                        title="Per E-Mail senden"
                      >
                        <Mail size={16} />
                      </button>
                      <button
                        onClick={() => handleOpenModal(doc)}
                        className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-all"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(doc.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-all"
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

      {/* ─── Email Modal ───────────────────────────────────────────────────────── */}
      {showEmailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 rounded-t-xl">
              <div className="flex items-center gap-2">
                <Mail size={18} className="text-blue-500" />
                <h2 className="font-bold text-gray-900">
                  {emailDoc
                    ? `${emailDoc.type === 'invoice' ? 'Rechnung' : emailDoc.type === 'offer' ? 'Offerte' : 'Auftrag'} senden`
                    : 'E-Mail senden'}
                </h2>
              </div>
              <button
                onClick={() => setShowEmailModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {emailSent ? (
                <div className="flex flex-col items-center gap-3 py-6 text-center">
                  <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                    <Mail size={22} className="text-green-600" />
                  </div>
                  <p className="font-semibold text-gray-900">E-Mail erfolgreich gesendet!</p>
                  <p className="text-sm text-gray-500">Die E-Mail wurde an {emailForm.to} verschickt.</p>
                  <button
                    onClick={() => setShowEmailModal(false)}
                    className="mt-2 px-5 py-2 bg-[#00875A] hover:bg-[#006B47] text-white rounded-lg text-sm font-semibold transition-colors"
                  >
                    Schliessen
                  </button>
                </div>
              ) : (
                <>
                  {/* To */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">
                      An *
                    </label>
                    <input
                      type="email"
                      required
                      value={emailForm.to}
                      onChange={e => setEmailForm({ ...emailForm, to: e.target.value })}
                      placeholder="empfaenger@beispiel.ch"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
                    />
                  </div>

                  {/* Subject */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">
                      Betreff *
                    </label>
                    <input
                      type="text"
                      required
                      value={emailForm.subject}
                      onChange={e => setEmailForm({ ...emailForm, subject: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
                    />
                  </div>

                  {/* Message */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">
                      Nachricht
                    </label>
                    <textarea
                      value={emailForm.message}
                      onChange={e => setEmailForm({ ...emailForm, message: e.target.value })}
                      rows={6}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all resize-none"
                    />
                  </div>

                  {emailError && (
                    <p className="text-red-600 text-xs bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                      {emailError}
                    </p>
                  )}

                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowEmailModal(false)}
                      className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-800 transition-colors"
                    >
                      Abbrechen
                    </button>
                    <button
                      type="button"
                      onClick={handleSendEmail}
                      disabled={emailSending || !emailForm.to || !emailForm.subject}
                      className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm disabled:opacity-50"
                    >
                      <Mail size={15} />
                      {emailSending ? 'Sendet...' : 'Senden'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal ─────────────────────────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl my-6 flex flex-col">
            {/* Modal header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 rounded-t-xl">
              <h2 className="font-bold text-gray-900">
                {editingDoc
                  ? `${typeLabels[typeFilter].slice(0, -1)} bearbeiten`
                  : `Neue${typeFilter === 'invoice' ? ' Rechnung' : typeFilter === 'offer' ? ' Offerte' : 'r Auftrag'}`}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* ── Meta fields ── */}
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Nummer *</label>
                  <input
                    required
                    value={formData.number}
                    onChange={e => setFormData({ ...formData, number: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20"
                  />
                </div>
                <div className="col-span-2 sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Titel</label>
                  <input
                    value={formData.title}
                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20"
                    placeholder="z.B. Dienstleistungen Februar 2025"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Status</label>
                  <select
                    value={formData.status}
                    onChange={e => setFormData({ ...formData, status: e.target.value })}
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
                        <option value="akzeptiert">Akzeptiert</option>
                        <option value="abgelehnt">Abgelehnt</option>
                      </>
                    )}
                  </select>
                </div>
                <div className="col-span-2 sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Kontakt</label>
                  <select
                    value={formData.contact_id}
                    onChange={e => setFormData({ ...formData, contact_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20"
                  >
                    <option value="">– Keiner –</option>
                    {contacts.map(c => (
                      <option key={c.id} value={c.id}>
                        {getContactLabel(c)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Datum *</label>
                  <input
                    required
                    type="date"
                    value={formData.date}
                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Fällig am</label>
                  <input
                    type="date"
                    value={formData.due_date}
                    onChange={e => setFormData({ ...formData, due_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20"
                  />
                </div>
                <div className="col-span-2 sm:col-span-3">
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Notizen</label>
                  <textarea
                    value={formData.notes}
                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20"
                    placeholder="Interne Notizen..."
                  />
                </div>
              </div>

              {/* ── Line items ── */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Positionen</h3>
                  <button
                    type="button"
                    onClick={addLine}
                    className="flex items-center gap-1.5 text-xs font-semibold text-[#00875A] hover:text-[#006B47] transition-colors"
                  >
                    <Plus size={14} /> Position hinzufügen
                  </button>
                </div>

                {/* Column headers */}
                <div className="hidden md:grid grid-cols-[2fr_1fr_80px_1fr_80px_100px_90px_32px] gap-2 mb-1 px-1">
                  {['Beschreibung', 'Menge', 'Einheit', 'Preis', 'Rabatt %', 'MwSt%', 'Total', ''].map(h => (
                    <span key={h} className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                      {h}
                    </span>
                  ))}
                </div>

                <div className="space-y-2">
                  {lines.map((line, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-1 md:grid-cols-[2fr_1fr_80px_1fr_80px_100px_90px_32px] gap-2 items-center bg-gray-50 rounded-lg p-2 border border-gray-100"
                    >
                      {/* Product picker + description */}
                      <div className="flex flex-col gap-1">
                        <div className="relative">
                          <Package
                            size={12}
                            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                          />
                          <select
                            defaultValue=""
                            onChange={e => applyProduct(idx, e.target.value)}
                            className="w-full pl-7 pr-2 py-1.5 border border-gray-200 rounded-md text-xs bg-white focus:outline-none focus:ring-1 focus:ring-green-500/30 text-gray-500"
                          >
                            <option value="">Produkt wählen…</option>
                            {products.map(p => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <input
                          type="text"
                          placeholder="Beschreibung"
                          value={line.description}
                          onChange={e => updateLine(idx, { description: e.target.value })}
                          className="w-full px-2.5 py-1.5 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-green-500/30"
                        />
                      </div>

                      {/* Quantity */}
                      <div className="flex items-center border border-gray-200 rounded-md overflow-hidden">
                        <button type="button" onClick={() => updateLine(idx, { quantity: Math.max(0, line.quantity - 1) })} className="px-2 py-1.5 text-gray-500 hover:bg-gray-100 font-bold leading-none transition-colors">−</button>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={line.quantity}
                          onChange={e => updateLine(idx, { quantity: Math.max(0, Number(e.target.value)) })}
                          className="w-full text-center py-1.5 text-sm focus:outline-none bg-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <button type="button" onClick={() => updateLine(idx, { quantity: line.quantity + 1 })} className="px-2 py-1.5 text-gray-500 hover:bg-gray-100 font-bold leading-none transition-colors">+</button>
                      </div>

                      {/* Unit */}
                      <input
                        type="text"
                        placeholder="Stk."
                        value={line.unit}
                        onChange={e => updateLine(idx, { unit: e.target.value })}
                        className="w-full px-2.5 py-1.5 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-green-500/30"
                      />

                      {/* Unit price */}
                      <input
                        type="number"
                        min="0"
                        step="0.05"
                        value={line.unit_price}
                        onChange={e => updateLine(idx, { unit_price: Number(e.target.value) })}
                        className="w-full px-2.5 py-1.5 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-green-500/30"
                      />

                      {/* Discount */}
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={line.discount}
                        onChange={e => updateLine(idx, { discount: Number(e.target.value) })}
                        className="w-full px-2.5 py-1.5 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-green-500/30"
                        placeholder="0"
                      />

                      {/* Tax rate */}
                      <select
                        value={line.tax_rate}
                        onChange={e => updateLine(idx, { tax_rate: Number(e.target.value) })}
                        className="w-full px-2.5 py-1.5 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-green-500/30"
                      >
                        {TAX_RATES.map(r => (
                          <option key={r} value={r}>
                            {r}%
                          </option>
                        ))}
                      </select>

                      {/* Line total */}
                      <div className="px-2.5 py-1.5 text-sm font-semibold text-gray-700 text-right whitespace-nowrap">
                        {fCHF(line.total)}
                      </div>

                      {/* Delete */}
                      <button
                        type="button"
                        onClick={() => deleteLine(idx)}
                        className="flex items-center justify-center w-7 h-7 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                        title="Position löschen"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Totals summary */}
                <div className="mt-4 flex justify-end">
                  <div className="w-72 space-y-1 text-sm">
                    <div className="flex justify-between text-gray-600">
                      <span>Nettobetrag</span>
                      <span>{fCHF(subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>MwSt</span>
                      <span>{fCHF(tax_amount)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-gray-900 border-t border-gray-200 pt-1 mt-1">
                      <span>Total CHF</span>
                      <span>{fCHF(total)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Footer ── */}
              {saveError && <p className="text-red-600 text-xs">{saveError}</p>}
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
