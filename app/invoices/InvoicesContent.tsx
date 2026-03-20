'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { getOrCreateCompanyId } from '@/lib/getOrCreateCompany'
import { useSearchParams } from 'next/navigation'
import { Plus, Search, FileText, User, Calendar, Trash2, X, Edit2, Package, FileDown, Mail, Clock, Receipt } from 'lucide-react'

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
  service_period: string
  reference: string
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
  const [spFrom, setSpFrom] = useState('')
  const [spTo, setSpTo] = useState('')

  const [formData, setFormData] = useState<FormData>({
    number: '',
    title: '',
    contact_id: '',
    contact_name: '',
    date: new Date().toISOString().split('T')[0],
    due_date: '',
    service_period: '',
    reference: '',
    status: 'entwurf',
    notes: '',
  })

  const [lines, setLines] = useState<LineItem[]>([])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const fmtServicePeriod = (from: string, to: string) => {
    const fmt = (d: string) => { const [y,m,day] = d.split('-'); return `${day}.${m}.${y}` }
    if (from && to) return `${fmt(from)} - ${fmt(to)}`
    if (from) return fmt(from)
    return ''
  }

  const parseServicePeriod = (val: string): [string, string] => {
    const parts = val.split(' - ')
    const toIso = (d: string) => { const [day,m,y] = d.split('.'); return `${y}-${m}-${day}` }
    if (parts.length === 2) return [toIso(parts[0]), toIso(parts[1])]
    return ['', '']
  }

  // ─── Time entries import state ───────────────────────────────────────────────
  const [showTimeModal, setShowTimeModal] = useState(false)
  const [timeEntries, setTimeEntries] = useState<any[]>([])
  const [selectedTimeIds, setSelectedTimeIds] = useState<string[]>([])
  const [importedTimeEntryIds, setImportedTimeEntryIds] = useState<string[]>([])

  // ─── Product import state ─────────────────────────────────────────────────────
  const [showProductModal, setShowProductModal] = useState(false)
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([])

  // ─── Expenses import state ────────────────────────────────────────────────────
  const [showExpenseModal, setShowExpenseModal] = useState(false)
  const [expenses, setExpenses] = useState<any[]>([])
  const [selectedExpenseIds, setSelectedExpenseIds] = useState<string[]>([])
  const [importedExpenseIds, setImportedExpenseIds] = useState<string[]>([])

  // ─── Rapporte state ───────────────────────────────────────────────────────────
  const [rapporte, setRapporte] = useState<any[]>([])

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

  const prefixes: Record<string, string> = { invoice: 'RE', offer: 'OF', order: 'AR' }

  const generateNumber = () => {
    if (typeFilter === 'order') {
      const arNumbers = documents
        .map((d: any) => d.number)
        .filter((n: string) => n && n.startsWith('AR-'))
        .map((n: string) => parseInt(n.replace('AR-', ''), 10))
        .filter((n: number) => !isNaN(n))
      const maxNum = arNumbers.length > 0 ? Math.max(...arNumbers) : 4449
      return `AR-${maxNum + 1}`
    }
    if (typeFilter === 'invoice') {
      const nums = documents
        .map((d: any) => d.number)
        .filter((n: string) => n)
        .map((n: string) => parseInt(n.replace('RE-', ''), 10))
        .filter((n: number) => !isNaN(n))
      const maxNum = nums.length > 0 ? Math.max(...nums) : 0
      return `RE-${String(maxNum + 1).padStart(4, '0')}`
    }
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
    const [y, m, day] = d.split('-')
    return `${day}.${m}.${y}`
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

  const fetchUnbilledTimeEntries = async () => {
    const companyId = await getOrCreateCompanyId(supabase)
    const { data } = await supabase
      .from('time_entries')
      .select('*, projects(name)')
      .eq('company_id', companyId)
      .or('billable.is.null,billable.eq.true')
      .or('invoiced.is.null,invoiced.eq.false')
      .order('date', { ascending: false })
    setTimeEntries(data || [])
  }

  const handleOpenTimeModal = async () => {
    setSelectedTimeIds([])
    await fetchUnbilledTimeEntries()
    setShowTimeModal(true)
  }

  const handleImportTimeEntries = () => {
    const toImport = timeEntries.filter(e => selectedTimeIds.includes(e.id))
    const totalHours = Math.round(toImport.reduce((sum, e) => sum + e.duration_minutes / 60, 0) * 100) / 100
    const totalAmount = toImport.reduce((sum, e) => sum + (e.duration_minutes / 60) * (Number(e.hourly_rate) || 0), 0)
    const effectiveRate = totalHours > 0 ? Math.round((totalAmount / totalHours) * 100) / 100 : 0
    const aufwandLine: LineItem = {
      position: lines.length + 1,
      description: 'Aufwand',
      quantity: totalHours,
      unit: 'Std.',
      unit_price: effectiveRate,
      discount: 0,
      tax_rate: 8.1,
      total: 0,
    }
    aufwandLine.total = calcLineTotal(aufwandLine)
    setLines(prev => [...prev, aufwandLine])
    setImportedTimeEntryIds(prev => [...prev, ...selectedTimeIds])
    setSelectedTimeIds([])
    setShowTimeModal(false)
  }

  const fetchNonInvoicedExpenses = async () => {
    const companyId = await getOrCreateCompanyId(supabase)
    const { data } = await supabase
      .from('expenses')
      .select('*')
      .eq('company_id', companyId)
      .order('date', { ascending: false })
    // filter client-side so missing invoiced column (pre-migration) doesn't break the query
    setExpenses((data || []).filter((e: any) => e.invoiced !== true))
  }

  const handleOpenExpenseModal = async () => {
    setSelectedExpenseIds([])
    await fetchNonInvoicedExpenses()
    setShowExpenseModal(true)
  }

  const handleImportExpenses = () => {
    const toImport = expenses.filter(e => selectedExpenseIds.includes(e.id))
    const newLines: LineItem[] = toImport.map((e, i) => {
      const desc = [e.description, e.vendor].filter(Boolean).join(' – ')
      const line: LineItem = {
        position: lines.length + i + 1,
        description: desc || 'Aufwand',
        quantity: 1,
        unit: 'Pauschal',
        unit_price: Number(e.amount) || 0,
        discount: 0,
        tax_rate: 0,
        total: 0,
      }
      line.total = calcLineTotal(line)
      return line
    })
    setLines(prev => [...prev, ...newLines])
    setImportedExpenseIds(prev => [...prev, ...selectedExpenseIds])
    setSelectedExpenseIds([])
    setShowExpenseModal(false)
  }

  const handleOpenModal = async (doc: any = null) => {
    setSaveError('')
    setImportedTimeEntryIds([])
    setImportedExpenseIds([])

    // Fetch rapporte for the dropdown (only relevant for invoices)
    if (typeFilter === 'invoice') {
      const companyId = await getOrCreateCompanyId(supabase)
      const { data: rapportData } = await supabase
        .from('documents')
        .select('id, number, title, contact_name')
        .eq('company_id', companyId)
        .eq('type', 'order')
        .order('number', { ascending: false })
      setRapporte(rapportData || [])
    }
    if (doc) {
      setEditingDoc(doc)
      const [parsedFrom, parsedTo] = parseServicePeriod(doc.service_period || '')
      setSpFrom(parsedFrom)
      setSpTo(parsedTo)
      setFormData({
        number: doc.number || '',
        title: doc.title || '',
        contact_id: doc.contact_id || '',
        contact_name: doc.contact_name || doc.contacts?.name || '',
        date: doc.date || new Date().toISOString().split('T')[0],
        due_date: doc.due_date || '',
        service_period: doc.service_period || '',
        reference: doc.reference || '',
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
        setLines([])
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
        service_period: '',
        reference: '',
        status: 'entwurf',
        notes: '',
      })
      setSpFrom('')
      setSpTo('')
      setLines([])
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

  const handleOpenProductModal = () => {
    setSelectedProductIds([])
    setShowProductModal(true)
  }

  const handleImportProducts = () => {
    const toImport = products.filter(p => selectedProductIds.includes(p.id))
    const newLines: LineItem[] = toImport.map((p, i) => {
      const line: LineItem = {
        position: lines.length + i + 1,
        description: p.name || '',
        quantity: 1,
        unit: p.unit || 'Stk.',
        unit_price: Number(p.price) || 0,
        discount: 0,
        tax_rate: Number(p.tax_rate) ?? 8.1,
        total: 0,
      }
      line.total = calcLineTotal(line)
      return line
    })
    setLines(prev => [...prev, ...newLines])
    setSelectedProductIds([])
    setShowProductModal(false)
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

      const saveDoc = async (payload: any) => {
        if (editingDoc) {
          const { error } = await supabase.from('documents').update(payload).eq('id', editingDoc.id)
          return { error, id: editingDoc.id as string }
        } else {
          const { data: inserted, error } = await supabase.from('documents').insert([payload]).select('id').single()
          return { error, id: inserted?.id as string }
        }
      }

      let { error: saveError, id: savedId } = await saveDoc(docPayload)
      if (saveError?.message?.includes('service_period') || saveError?.message?.includes('reference')) {
        const { service_period: _sp, reference: _ref, ...withoutNew } = docPayload;
        ({ error: saveError, id: savedId } = await saveDoc(withoutNew))
      }
      if (saveError) throw saveError
      documentId = savedId

      if (editingDoc) {
        // Delete existing lines then re-insert
        const { error: delErr } = await supabase
          .from('document_lines')
          .delete()
          .eq('document_id', documentId)
        if (delErr) throw delErr
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

      // Mark imported time entries as invoiced
      if (importedTimeEntryIds.length > 0) {
        await supabase
          .from('time_entries')
          .update({ invoiced: true, invoice_id: documentId })
          .in('id', importedTimeEntryIds)
      }

      // Mark imported expenses as invoiced
      if (importedExpenseIds.length > 0) {
        await supabase
          .from('expenses')
          .update({ invoiced: true, invoice_id: documentId })
          .in('id', importedExpenseIds)
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
      // Release linked time entries and expenses so they can be re-imported
      await supabase.from('time_entries').update({ invoiced: false, invoice_id: null }).eq('invoice_id', id)
      await supabase.from('expenses').update({ invoiced: false, invoice_id: null }).eq('invoice_id', id)
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
      order: 'Rapport',
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
    order: 'Rapporte',
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
            : 'Rapport'}{' '}
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
              <th className="px-3 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider w-24">Nummer</th>
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
                  <td className="px-3 py-4">
                    <div className="text-[13px] font-bold text-gray-900 flex items-center gap-1.5 whitespace-nowrap">
                      <FileText size={13} className="text-gray-400 shrink-0" /> {doc.number}
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

      {/* ─── Time entries import modal ─────────────────────────────────────────── */}
      {showTimeModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 rounded-t-xl">
              <div className="flex items-center gap-2">
                <Clock size={18} className="text-blue-500" />
                <h2 className="font-bold text-gray-900">Zeiten importieren</h2>
              </div>
              <button onClick={() => setShowTimeModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-4">
              {timeEntries.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-10">Keine verrechenbaren Zeiteinträge vorhanden</p>
              ) : (
                <div className="space-y-1">
                  {timeEntries.map(entry => {
                    const hours = Math.round((entry.duration_minutes / 60) * 100) / 100
                    const total = hours * (Number(entry.hourly_rate) || 0)
                    const isSelected = selectedTimeIds.includes(entry.id)
                    return (
                      <label
                        key={entry.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          isSelected ? 'border-blue-300 bg-blue-50' : 'border-gray-100 bg-gray-50 hover:bg-gray-100'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={e => {
                            if (e.target.checked) {
                              setSelectedTimeIds(prev => [...prev, entry.id])
                            } else {
                              setSelectedTimeIds(prev => prev.filter(id => id !== entry.id))
                            }
                          }}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {entry.description || 'Ohne Beschreibung'}
                          </p>
                          <p className="text-xs text-gray-500">
                            {fD(entry.date)}{entry.projects?.name ? ` · ${entry.projects.name}` : ''}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-semibold text-gray-700">{hours} Std.</p>
                          <p className="text-xs text-gray-400">{fCHF(total)}</p>
                        </div>
                      </label>
                    )
                  })}
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
              <span className="text-xs text-gray-500">{selectedTimeIds.length} ausgewählt</span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowTimeModal(false)}
                  className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Abbrechen
                </button>
                <button
                  type="button"
                  onClick={handleImportTimeEntries}
                  disabled={selectedTimeIds.length === 0}
                  className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm disabled:opacity-50"
                >
                  <Plus size={15} /> Übernehmen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Product import modal ────────────────────────────────────────────────── */}
      {showProductModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 rounded-t-xl">
              <div className="flex items-center gap-2">
                <Package size={18} className="text-green-600" />
                <h2 className="font-bold text-gray-900">Produkt importieren</h2>
              </div>
              <button onClick={() => setShowProductModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-4">
              {products.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-10">Keine Produkte vorhanden</p>
              ) : (
                <div className="space-y-1">
                  {products.map(product => {
                    const isSelected = selectedProductIds.includes(product.id)
                    return (
                      <label
                        key={product.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          isSelected ? 'border-green-300 bg-green-50' : 'border-gray-100 bg-gray-50 hover:bg-gray-100'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={e => {
                            if (e.target.checked) {
                              setSelectedProductIds(prev => [...prev, product.id])
                            } else {
                              setSelectedProductIds(prev => prev.filter(id => id !== product.id))
                            }
                          }}
                          className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{product.name}</p>
                          {product.description && (
                            <p className="text-xs text-gray-500 truncate">{product.description}</p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-semibold text-gray-700">{fCHF(Number(product.price) || 0)}</p>
                          <p className="text-xs text-gray-400">{product.unit || 'Stk.'} · {product.tax_rate ?? 8.1}% MwSt.</p>
                        </div>
                      </label>
                    )
                  })}
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
              <span className="text-xs text-gray-500">{selectedProductIds.length} ausgewählt</span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowProductModal(false)}
                  className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Abbrechen
                </button>
                <button
                  type="button"
                  onClick={handleImportProducts}
                  disabled={selectedProductIds.length === 0}
                  className="flex items-center gap-2 px-5 py-2 bg-[#00875A] hover:bg-[#006B47] text-white rounded-lg text-sm font-semibold transition-colors shadow-sm disabled:opacity-50"
                >
                  <Plus size={15} /> Übernehmen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Expenses import modal ───────────────────────────────────────────────── */}
      {showExpenseModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 rounded-t-xl">
              <div className="flex items-center gap-2">
                <Receipt size={18} className="text-orange-500" />
                <h2 className="font-bold text-gray-900">Ausgaben importieren</h2>
              </div>
              <button onClick={() => setShowExpenseModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-4">
              {expenses.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-10">Keine offenen Ausgaben vorhanden</p>
              ) : (
                <div className="space-y-1">
                  {expenses.map(expense => {
                    const isSelected = selectedExpenseIds.includes(expense.id)
                    return (
                      <label
                        key={expense.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          isSelected ? 'border-orange-300 bg-orange-50' : 'border-gray-100 bg-gray-50 hover:bg-gray-100'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={e => {
                            if (e.target.checked) {
                              setSelectedExpenseIds(prev => [...prev, expense.id])
                            } else {
                              setSelectedExpenseIds(prev => prev.filter(id => id !== expense.id))
                            }
                          }}
                          className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {expense.description || 'Ohne Beschreibung'}
                          </p>
                          <p className="text-xs text-gray-500">
                            {fD(expense.date)}{expense.vendor ? ` · ${expense.vendor}` : ''}{expense.category ? ` · ${expense.category}` : ''}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-semibold text-gray-700">{fCHF(Number(expense.amount) || 0)}</p>
                        </div>
                      </label>
                    )
                  })}
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
              <span className="text-xs text-gray-500">{selectedExpenseIds.length} ausgewählt</span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowExpenseModal(false)}
                  className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Abbrechen
                </button>
                <button
                  type="button"
                  onClick={handleImportExpenses}
                  disabled={selectedExpenseIds.length === 0}
                  className="flex items-center gap-2 px-5 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm disabled:opacity-50"
                >
                  <Plus size={15} /> Übernehmen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
                    ? `${emailDoc.type === 'invoice' ? 'Rechnung' : emailDoc.type === 'offer' ? 'Offerte' : 'Rapport'} senden`
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
                  : `Neue${typeFilter === 'invoice' ? ' Rechnung' : typeFilter === 'offer' ? ' Offerte' : 'r Rapport'}`}
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
                <div className="col-span-2 sm:col-span-3">
                  <div className="flex items-end gap-3 flex-wrap">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Datum *</label>
                      <input
                        required
                        type="date"
                        value={formData.date}
                        onChange={e => setFormData({ ...formData, date: e.target.value })}
                        className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Fällig am</label>
                      <input
                        type="date"
                        value={formData.due_date}
                        onChange={e => setFormData({ ...formData, due_date: e.target.value })}
                        className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Leistungszeitraum</label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="date"
                          value={spFrom}
                          onChange={e => {
                            setSpFrom(e.target.value)
                            setFormData({ ...formData, service_period: fmtServicePeriod(e.target.value, spTo) })
                          }}
                          className="w-[155px] px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20"
                        />
                        <span className="text-gray-400 text-sm shrink-0">–</span>
                        <input
                          type="date"
                          value={spTo}
                          onChange={e => {
                            setSpTo(e.target.value)
                            setFormData({ ...formData, service_period: fmtServicePeriod(spFrom, e.target.value) })
                          }}
                          className="w-[155px] px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20"
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Verknüpfter Rapport</label>
                  {typeFilter === 'invoice' && rapporte.length > 0 ? (
                    <select
                      value={formData.reference}
                      onChange={e => setFormData({ ...formData, reference: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 bg-white"
                    >
                      <option value="">– Kein Rapport –</option>
                      {rapporte.map(r => (
                        <option key={r.id} value={r.number}>
                          {r.number}{r.title ? ` – ${r.title}` : ''}{r.contact_name ? ` (${r.contact_name})` : ''}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={formData.reference}
                      onChange={e => setFormData({ ...formData, reference: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20"
                      placeholder="z.B. AR-0012"
                    />
                  )}
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
                  <div className="flex items-center gap-3">
                    {(typeFilter === 'invoice' || typeFilter === 'order') && (
                      <>
                        <button
                          type="button"
                          onClick={handleOpenTimeModal}
                          className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
                        >
                          <Clock size={14} /> Zeiten importieren
                        </button>
                        <button
                          type="button"
                          onClick={handleOpenExpenseModal}
                          className="flex items-center gap-1.5 text-xs font-semibold text-orange-600 hover:text-orange-800 transition-colors"
                        >
                          <Receipt size={14} /> Ausgaben importieren
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={handleOpenProductModal}
                      className="flex items-center gap-1.5 text-xs font-semibold text-[#00875A] hover:text-[#006B47] transition-colors"
                    >
                      <Package size={14} /> Produkt importieren
                    </button>
                    <button
                      type="button"
                      onClick={addLine}
                      className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700 transition-colors"
                    >
                      <Plus size={14} /> Eigene Position
                    </button>
                  </div>
                </div>

                {/* Column headers */}
                <div className="hidden md:grid grid-cols-[2fr_60px_65px_80px_60px_65px_75px_28px] gap-2 mb-1 px-1">
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
                      className="grid grid-cols-1 md:grid-cols-[2fr_60px_65px_80px_60px_65px_75px_28px] gap-2 items-center bg-gray-50 rounded-lg p-2 border border-gray-100"
                    >
                      {/* Description */}
                      <input
                        type="text"
                        placeholder="Beschreibung"
                        value={line.description}
                        onChange={e => updateLine(idx, { description: e.target.value })}
                        className="w-full px-2.5 py-1.5 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-green-500/30"
                      />

                      {/* Quantity */}
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.quantity}
                        onChange={e => updateLine(idx, { quantity: Math.max(0, Number(e.target.value)) })}
                        className="w-full px-2 py-1.5 border border-gray-200 rounded-md text-sm text-center focus:outline-none focus:ring-1 focus:ring-green-500/30 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />

                      {/* Unit */}
                      <select
                        value={line.unit}
                        onChange={e => updateLine(idx, { unit: e.target.value })}
                        className="w-full px-2.5 py-1.5 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-green-500/30 bg-white"
                      >
                        <option value="Stk.">Stk.</option>
                        <option value="Std.">Std.</option>
                      </select>

                      {/* Unit price */}
                      <input
                        type="number"
                        min="0"
                        step="0.05"
                        value={line.unit_price === 0 ? '' : line.unit_price}
                        onChange={e => updateLine(idx, { unit_price: Number(e.target.value) || 0 })}
                        className="w-full px-2.5 py-1.5 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-green-500/30"
                      />

                      {/* Discount */}
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={line.discount === 0 ? '' : line.discount}
                        onChange={e => updateLine(idx, { discount: Number(e.target.value) || 0 })}
                        className="w-full px-2.5 py-1.5 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-green-500/30"
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
