'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { getOrCreateCompanyId } from '@/lib/getOrCreateCompany'
import { Upload, X, CheckCircle, AlertCircle, ArrowDownCircle, ArrowUpCircle } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ParsedTransaction {
  date: string
  amount: number
  currency: string
  description: string
  debtor_name: string
  is_credit: boolean
}

interface BankTransaction {
  id: string
  date: string
  amount: number
  currency: string
  description: string
  debtor_name: string | null
  is_credit: boolean
  matched: boolean
  document_id: string | null
  created_at: string
}

interface OpenInvoice {
  id: string
  number: string
  contact_name: string
  total: number
  date: string
  status: string
}

// ─── camt.053 XML Parser ──────────────────────────────────────────────────────

function parseCamt053(xmlText: string): ParsedTransaction[] {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlText, 'application/xml')

  const parseError = doc.querySelector('parsererror')
  if (parseError) {
    throw new Error('Ungültige XML-Datei: ' + parseError.textContent?.slice(0, 100))
  }

  const getText = (el: Element | null, ...selectors: string[]): string => {
    for (const sel of selectors) {
      const found = el?.querySelector(sel)
      if (found?.textContent?.trim()) return found.textContent.trim()
    }
    return ''
  }

  const entries = Array.from(doc.querySelectorAll('Ntry'))
  if (entries.length === 0) {
    throw new Error('Keine Transaktionen (Ntry-Elemente) in der Datei gefunden.')
  }

  const transactions: ParsedTransaction[] = []

  for (const entry of entries) {
    // Date: prefer BookgDt/Dt, fallback to ValDt/Dt
    const date = getText(entry, 'BookgDt Dt') || getText(entry, 'ValDt Dt')

    // Amount
    const amtEl = entry.querySelector('Amt')
    const amount = amtEl ? parseFloat(amtEl.textContent?.trim() || '0') : 0
    const currency = amtEl?.getAttribute('Ccy') || 'CHF'

    // Direction
    const cdtDbt = getText(entry, 'CdtDbtInd')
    const is_credit = cdtDbt === 'CRDT'

    // Description: AddtlNtryInf first, then remittance info
    const description =
      getText(entry, 'AddtlNtryInf') ||
      getText(entry, 'NtryDtls TxDtls RmtInf Ustrd') ||
      '(keine Beschreibung)'

    // Debtor name
    const debtor_name = getText(entry, 'NtryDtls TxDtls RltdPties Dbtr Nm')

    if (date) {
      transactions.push({ date, amount, currency, description, debtor_name, is_credit })
    }
  }

  return transactions
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fCurrency = (amount: number, currency = 'CHF') =>
  new Intl.NumberFormat('de-CH', { style: 'currency', currency }).format(amount)

const fDate = (d: string) => {
  if (!d) return ''
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return d
  return (
    String(dt.getDate()).padStart(2, '0') +
    '.' +
    String(dt.getMonth() + 1).padStart(2, '0') +
    '.' +
    dt.getFullYear()
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function BankContent() {
  const [transactions, setTransactions] = useState<BankTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [importError, setImportError] = useState('')

  // Import preview
  const [showImportModal, setShowImportModal] = useState(false)
  const [parsedTxns, setParsedTxns] = useState<ParsedTransaction[]>([])
  const [fileName, setFileName] = useState('')

  // Reconciliation modal
  const [showMatchModal, setShowMatchModal] = useState(false)
  const [matchingTxn, setMatchingTxn] = useState<BankTransaction | null>(null)
  const [openInvoices, setOpenInvoices] = useState<OpenInvoice[]>([])
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('')
  const [matchSaving, setMatchSaving] = useState(false)
  const [matchError, setMatchError] = useState('')

  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  // ─── Fetch transactions ───────────────────────────────────────────────────

  useEffect(() => {
    fetchTransactions()
  }, [])

  async function fetchTransactions() {
    try {
      setLoading(true)
      const companyId = await getOrCreateCompanyId(supabase)
      const { data, error } = await supabase
        .from('bank_transactions')
        .select('*')
        .eq('company_id', companyId)
        .order('date', { ascending: false })
      if (error) throw error
      setTransactions(data || [])
    } catch (err: any) {
      console.error('Error fetching bank transactions:', err)
    } finally {
      setLoading(false)
    }
  }

  // ─── File upload handling ─────────────────────────────────────────────────

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setImportError('')

    if (!file.name.toLowerCase().endsWith('.xml')) {
      setImportError('Bitte eine XML-Datei (.xml) auswählen.')
      return
    }

    setFileName(file.name)
    setImporting(true)

    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const text = evt.target?.result as string
        const parsed = parseCamt053(text)
        setParsedTxns(parsed)
        setShowImportModal(true)
      } catch (err: any) {
        setImportError(err?.message || 'Fehler beim Parsen der XML-Datei.')
      } finally {
        setImporting(false)
      }
    }
    reader.onerror = () => {
      setImportError('Datei konnte nicht gelesen werden.')
      setImporting(false)
    }
    reader.readAsText(file)
  }

  // ─── Confirm import (save to DB) ─────────────────────────────────────────

  const handleConfirmImport = async () => {
    if (parsedTxns.length === 0) return
    setSaving(true)
    setImportError('')
    try {
      const companyId = await getOrCreateCompanyId(supabase)
      const rows = parsedTxns.map((t) => ({
        company_id: companyId,
        date: t.date,
        amount: t.amount,
        currency: t.currency,
        description: t.description,
        debtor_name: t.debtor_name || null,
        is_credit: t.is_credit,
        matched: false,
        document_id: null,
      }))

      const { error } = await supabase.from('bank_transactions').insert(rows)
      if (error) throw error

      setShowImportModal(false)
      setParsedTxns([])
      setFileName('')
      await fetchTransactions()
    } catch (err: any) {
      console.error('Import error:', err)
      setImportError(err?.message || 'Fehler beim Speichern der Transaktionen.')
    } finally {
      setSaving(false)
    }
  }

  // ─── Open reconciliation modal ────────────────────────────────────────────

  const handleOpenMatch = async (txn: BankTransaction) => {
    setMatchingTxn(txn)
    setSelectedInvoiceId('')
    setMatchError('')
    setShowMatchModal(true)

    try {
      const companyId = await getOrCreateCompanyId(supabase)
      const { data, error } = await supabase
        .from('documents')
        .select('id, number, contact_name, total, date, status')
        .eq('company_id', companyId)
        .eq('type', 'invoice')
        .in('status', ['offen', 'versendet'])
        .order('date', { ascending: false })
      if (error) throw error
      setOpenInvoices(data || [])
    } catch (err: any) {
      console.error('Error fetching open invoices:', err)
      setMatchError('Rechnungen konnten nicht geladen werden.')
    }
  }

  // ─── Confirm reconciliation ───────────────────────────────────────────────

  const handleConfirmMatch = async () => {
    if (!matchingTxn || !selectedInvoiceId) return
    setMatchSaving(true)
    setMatchError('')
    try {
      // Update bank transaction
      const { error: txnError } = await supabase
        .from('bank_transactions')
        .update({ matched: true, document_id: selectedInvoiceId })
        .eq('id', matchingTxn.id)
      if (txnError) throw txnError

      // Update invoice status
      const { error: invError } = await supabase
        .from('documents')
        .update({ status: 'bezahlt', paid_at: new Date().toISOString() })
        .eq('id', selectedInvoiceId)
      if (invError) throw invError

      setShowMatchModal(false)
      setMatchingTxn(null)
      await fetchTransactions()
    } catch (err: any) {
      console.error('Reconciliation error:', err)
      setMatchError(err?.message || 'Fehler beim Abgleichen.')
    } finally {
      setMatchSaving(false)
    }
  }

  // ─── Stats ────────────────────────────────────────────────────────────────

  const totalImported = transactions.length
  const totalUnmatched = transactions.filter((t) => !t.matched).length
  const totalCredits = transactions
    .filter((t) => t.is_credit)
    .reduce((s, t) => s + Number(t.amount), 0)
  const totalDebits = transactions
    .filter((t) => !t.is_credit)
    .reduce((s, t) => s + Number(t.amount), 0)

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-gray-900">Bankabgleich</h1>
          <p className="text-gray-400 text-sm mt-1">
            Importiere camt.053-Kontoauszüge und gleiche Zahlungen mit Rechnungen ab
          </p>
        </div>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={importing}
          className="flex items-center gap-2 bg-[#00875A] hover:bg-[#006B47] text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-60"
        >
          <Upload size={18} />
          {importing ? 'Liest Datei...' : 'Import'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xml"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {importError && !showImportModal && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle size={16} className="shrink-0" />
          {importError}
        </div>
      )}

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
          <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
            Importierte Transaktionen
          </div>
          <div className="text-2xl font-bold text-gray-900">{totalImported}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
          <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
            Offene
          </div>
          <div className="text-2xl font-bold text-orange-500">{totalUnmatched}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
          <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
            Eingänge total
          </div>
          <div className="text-2xl font-bold text-green-600">{fCurrency(totalCredits)}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
          <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
            Ausgaben total
          </div>
          <div className="text-2xl font-bold text-red-500">{fCurrency(totalDebits)}</div>
        </div>
      </div>

      {/* Transactions table */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[700px]">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                Datum
              </th>
              <th className="px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                Beschreibung
              </th>
              <th className="px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-right">
                Betrag
              </th>
              <th className="px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-right">
                Aktionen
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-center text-gray-400 text-sm">
                  Laden...
                </td>
              </tr>
            ) : transactions.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-16 text-center">
                  <div className="flex flex-col items-center gap-3 text-gray-400">
                    <Upload size={32} className="text-gray-300" />
                    <p className="text-sm">Noch keine Transaktionen importiert</p>
                    <p className="text-xs text-gray-300">
                      Klicke auf «Import» um eine camt.053 XML-Datei hochzuladen
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              transactions.map((txn) => (
                <tr key={txn.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="text-[13px] font-medium text-gray-900">{fDate(txn.date)}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 shrink-0">
                        {txn.is_credit ? (
                          <ArrowDownCircle size={15} className="text-green-500" />
                        ) : (
                          <ArrowUpCircle size={15} className="text-red-400" />
                        )}
                      </span>
                      <div>
                        <div className="text-[13px] font-semibold text-gray-900 line-clamp-2 max-w-xs">
                          {txn.description}
                        </div>
                        {txn.debtor_name && (
                          <div className="text-[11px] text-gray-500 mt-0.5">{txn.debtor_name}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span
                      className={`text-[13px] font-bold ${
                        txn.is_credit ? 'text-green-600' : 'text-red-500'
                      }`}
                    >
                      {txn.is_credit ? '+' : '–'}
                      {fCurrency(Number(txn.amount), txn.currency)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {txn.matched ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-green-100 text-green-700">
                        <CheckCircle size={11} />
                        Abgeglichen
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-orange-100 text-orange-600">
                        <AlertCircle size={11} />
                        Offen
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {txn.is_credit && !txn.matched && (
                      <button
                        onClick={() => handleOpenMatch(txn)}
                        className="px-3 py-1.5 bg-[#1a56db] hover:bg-[#1648c5] text-white rounded-md text-[12px] font-semibold transition-colors"
                      >
                        Abgleichen
                      </button>
                    )}
                    {txn.matched && (
                      <span className="text-[11px] text-gray-400">–</span>
                    )}
                    {!txn.is_credit && !txn.matched && (
                      <span className="text-[11px] text-gray-400">–</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Import Preview Modal ─────────────────────────────────────────────── */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div>
                <h2 className="font-bold text-gray-900">Import vorschau</h2>
                <p className="text-[12px] text-gray-500 mt-0.5">
                  {fileName} — {parsedTxns.length} Transaktion
                  {parsedTxns.length !== 1 ? 'en' : ''} gefunden
                </p>
              </div>
              <button
                onClick={() => { setShowImportModal(false); setParsedTxns([]) }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 sticky top-0">
                    <th className="px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                      Datum
                    </th>
                    <th className="px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                      Beschreibung
                    </th>
                    <th className="px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-right">
                      Betrag
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {parsedTxns.map((t, i) => (
                    <tr key={i} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3 text-[12px] text-gray-700 whitespace-nowrap">
                        {fDate(t.date)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-[12px] text-gray-900 line-clamp-1 max-w-[300px]">
                          {t.description}
                        </div>
                        {t.debtor_name && (
                          <div className="text-[11px] text-gray-400">{t.debtor_name}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <span
                          className={`text-[12px] font-bold ${
                            t.is_credit ? 'text-green-600' : 'text-red-500'
                          }`}
                        >
                          {t.is_credit ? '+' : '–'}
                          {fCurrency(t.amount, t.currency)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {importError && (
              <div className="px-6 py-3 bg-red-50 border-t border-red-100 text-red-600 text-sm flex items-center gap-2">
                <AlertCircle size={14} />
                {importError}
              </div>
            )}

            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3 bg-gray-50/50">
              <button
                type="button"
                onClick={() => { setShowImportModal(false); setParsedTxns([]) }}
                className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-800 transition-colors"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={saving}
                className="px-6 py-2 bg-[#00875A] hover:bg-[#006B47] text-white rounded-lg text-sm font-semibold transition-colors shadow-sm disabled:opacity-50"
              >
                {saving ? 'Wird importiert...' : `${parsedTxns.length} Transaktionen importieren`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reconciliation Modal ─────────────────────────────────────────────── */}
      {showMatchModal && matchingTxn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div>
                <h2 className="font-bold text-gray-900">Zahlung abgleichen</h2>
                <p className="text-[12px] text-gray-500 mt-0.5">
                  Wähle die passende Rechnung für diese Zahlung
                </p>
              </div>
              <button
                onClick={() => setShowMatchModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>

            <div className="px-6 py-4 bg-blue-50 border-b border-blue-100">
              <div className="text-[11px] font-semibold text-blue-500 uppercase tracking-wider mb-1">
                Bankzahlung
              </div>
              <div className="text-[13px] font-semibold text-gray-900">
                {matchingTxn.description}
              </div>
              <div className="flex items-center gap-4 mt-1">
                <span className="text-[12px] text-gray-500">{fDate(matchingTxn.date)}</span>
                <span className="text-[13px] font-bold text-green-600">
                  +{fCurrency(Number(matchingTxn.amount), matchingTxn.currency)}
                </span>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-4">
              <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Offene Rechnungen
              </div>

              {openInvoices.length === 0 ? (
                <p className="text-sm text-gray-400 py-6 text-center">
                  Keine offenen Rechnungen gefunden
                </p>
              ) : (
                <div className="space-y-2">
                  {openInvoices.map((inv) => (
                    <label
                      key={inv.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedInvoiceId === inv.id
                          ? 'border-[#1a56db] bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="invoice"
                        value={inv.id}
                        checked={selectedInvoiceId === inv.id}
                        onChange={() => setSelectedInvoiceId(inv.id)}
                        className="text-[#1a56db]"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[13px] font-semibold text-gray-900">
                            {inv.number}
                          </span>
                          <span className="text-[13px] font-bold text-gray-700">
                            {fCurrency(Number(inv.total))}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-[11px] text-gray-500 truncate">
                            {inv.contact_name}
                          </span>
                          <span className="text-[11px] text-gray-400">{fDate(inv.date)}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-600 font-semibold">
                            {inv.status}
                          </span>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {matchError && (
              <div className="px-6 py-3 bg-red-50 border-t border-red-100 text-red-600 text-sm flex items-center gap-2">
                <AlertCircle size={14} />
                {matchError}
              </div>
            )}

            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3 bg-gray-50/50">
              <button
                type="button"
                onClick={() => setShowMatchModal(false)}
                className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-800 transition-colors"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={handleConfirmMatch}
                disabled={matchSaving || !selectedInvoiceId}
                className="px-6 py-2 bg-[#1a56db] hover:bg-[#1648c5] text-white rounded-lg text-sm font-semibold transition-colors shadow-sm disabled:opacity-50"
              >
                {matchSaving ? 'Wird abgeglichen...' : 'Abgleichen bestätigen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
