'use client'

import { useState, useEffect } from 'react'
import AppLayout from '@/components/AppLayout'
import { createClient } from '@/lib/supabase-browser'
import { getOrCreateCompanyId } from '@/lib/getOrCreateCompany'

function fCHF(n: number) {
  return new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF' }).format(n)
}

function getCurrentQuarter(): number {
  return Math.floor(new Date().getMonth() / 3) + 1
}

function getQuarterRange(year: number, quarter: number): { start: string; end: string } {
  const startMonth = (quarter - 1) * 3
  const endMonth = startMonth + 2
  const start = new Date(year, startMonth, 1)
  const end = new Date(year, endMonth + 1, 0)
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  }
}

function formatDate(dateStr: string) {
  if (!dateStr) return '—'
  const [y, m, d] = dateStr.split('-')
  return `${d}.${m}.${y}`
}

interface Invoice {
  id: string
  number?: string
  date: string
  status: string
  type: string
  total: number
  subtotal: number
  tax_amount: number
  contact_name?: string
}

interface Expense {
  id: string
  amount: number
  date: string
  category?: string
}

interface MwstReport {
  // Revenue groups by VAT rate
  revenue81: number    // net revenue at 8.1%
  revenue26: number    // net revenue at 2.6%
  revenue38: number    // net revenue at 3.8%
  revenue0: number     // net revenue at 0%
  tax81: number        // VAT collected at 8.1%
  tax26: number        // VAT collected at 2.6%
  tax38: number        // VAT collected at 3.8%

  // Ziffer values
  z200: number         // Gesamtumsatz (gross total)
  z220: number         // Abzüge (0)
  z299: number         // Steuerbarer Umsatz
  z302: number         // Steuer 8.1%
  z312: number         // Steuer 2.6%
  z342: number         // Steuer 3.8%
  z399: number         // Total Umsatzsteuer
  z400: number         // Vorsteuer aus Lieferungen und Leistungen
  z479: number         // Total Vorsteuer
  z500: number         // Zahllast / Überschuss

  invoices: Invoice[]
  expenses: Expense[]
}

export default function MwstPage() {
  const currentYear = new Date().getFullYear()
  const [loading, setLoading] = useState(true)
  const [year, setYear] = useState(currentYear)
  const [quarter, setQuarter] = useState(getCurrentQuarter())
  const [report, setReport] = useState<MwstReport | null>(null)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  useEffect(() => {
    fetchReport()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, quarter])

  async function fetchReport() {
    try {
      setLoading(true)
      setError(null)
      const companyId = await getOrCreateCompanyId(supabase)
      const { start, end } = getQuarterRange(year, quarter)

      // Fetch paid/sent invoices
      const { data: invoiceRows, error: invErr } = await supabase
        .from('documents')
        .select('id, number, date, status, type, total, subtotal, tax_amount, contact_name')
        .eq('company_id', companyId)
        .eq('type', 'invoice')
        .in('status', ['bezahlt', 'versendet'])
        .gte('date', start)
        .lte('date', end)
        .order('date', { ascending: true })

      if (invErr) throw invErr

      // Fetch expenses
      const { data: expenseRows, error: expErr } = await supabase
        .from('expenses')
        .select('id, amount, date, category')
        .eq('company_id', companyId)
        .gte('date', start)
        .lte('date', end)
        .order('date', { ascending: true })

      if (expErr) throw expErr

      // Process invoices
      // For now assume all invoices are at 8.1% (standard rate)
      // If subtotal/tax_amount are 0 but total is not, derive them
      let z200 = 0
      let revenue81 = 0
      let tax81 = 0

      const invoices: Invoice[] = (invoiceRows || []).map((row) => {
        const total = Number(row.total) || 0
        let subtotal = Number(row.subtotal) || 0
        let tax_amount = Number(row.tax_amount) || 0

        // Fallback: derive subtotal and tax_amount from total at 8.1%
        if ((subtotal === 0 && tax_amount === 0) && total > 0) {
          subtotal = total / 1.081
          tax_amount = total - subtotal
        }

        return {
          id: row.id,
          number: row.number,
          date: row.date,
          status: row.status,
          type: row.type,
          total,
          subtotal,
          tax_amount,
          contact_name: row.contact_name,
        }
      })

      for (const inv of invoices) {
        z200 += inv.total
        revenue81 += inv.subtotal
        tax81 += inv.tax_amount
      }

      // Process expenses — Vorsteuer at 8.1%
      let z400 = 0
      const expenses: Expense[] = (expenseRows || []).map((row) => ({
        id: row.id,
        amount: Number(row.amount) || 0,
        date: row.date,
        category: row.category,
      }))

      for (const exp of expenses) {
        // Assume 8.1% included in expense amount
        const vorsteuer = (exp.amount / 1.081) * 0.081
        z400 += vorsteuer
      }

      const z220 = 0
      const z299 = revenue81    // steuerbarer Umsatz = net revenue
      const z302 = tax81        // Steuer 8.1%
      const z312 = 0            // Steuer 2.6% — no invoices at this rate
      const z342 = 0            // Steuer 3.8% — no invoices at this rate
      const z399 = z302 + z312 + z342
      const z479 = z400
      const z500 = z399 - z479

      setReport({
        revenue81,
        revenue26: 0,
        revenue38: 0,
        revenue0: 0,
        tax81,
        tax26: 0,
        tax38: 0,
        z200,
        z220,
        z299,
        z302,
        z312,
        z342,
        z399,
        z400,
        z479,
        z500,
        invoices,
        expenses,
      })
    } catch (err: unknown) {
      console.error('Error fetching MwSt data:', err)
      setError('Fehler beim Laden der Daten.')
    } finally {
      setLoading(false)
    }
  }

  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i)
  const { start, end } = getQuarterRange(year, quarter)
  const hasData = report && (report.invoices.length > 0 || report.expenses.length > 0)

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-[22px] font-bold text-gray-900">MwSt-Abrechnung</h1>
            <p className="text-gray-400 text-sm mt-1">Mehrwertsteuer-Abrechnung nach Schweizer Recht (ESTV)</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <label className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide">Quartal</label>
            <select
              value={quarter}
              onChange={e => setQuarter(Number(e.target.value))}
              className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 shadow-sm"
            >
              <option value={1}>Q1 (Jan–Mär)</option>
              <option value={2}>Q2 (Apr–Jun)</option>
              <option value={3}>Q3 (Jul–Sep)</option>
              <option value={4}>Q4 (Okt–Dez)</option>
            </select>
            <select
              value={year}
              onChange={e => setYear(Number(e.target.value))}
              className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 shadow-sm"
            >
              {yearOptions.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
            Daten laden…
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
            {error}
          </div>
        ) : !hasData ? (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-5 flex items-start gap-3">
            <svg className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            <div>
              <div className="text-[13px] font-semibold text-amber-800">Keine Daten für diesen Zeitraum</div>
              <div className="text-[12px] text-amber-700 mt-0.5">
                Es wurden keine bezahlten oder versendeten Rechnungen für Q{quarter}/{year} ({formatDate(start)} – {formatDate(end)}) gefunden.
              </div>
            </div>
          </div>
        ) : report ? (
          <>
            {/* Period label */}
            <div className="text-[12px] text-gray-400 -mt-2">
              Abrechnungsperiode: Q{quarter}/{year} &nbsp;·&nbsp; {formatDate(start)} – {formatDate(end)}
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Gesamtumsatz</div>
                <div className="text-lg font-bold text-gray-900 tabular-nums">{fCHF(report.z200)}</div>
                <div className="text-[10px] text-gray-400 mt-0.5">Ziffer 200</div>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Steuerbarer Umsatz</div>
                <div className="text-lg font-bold text-gray-900 tabular-nums">{fCHF(report.z299)}</div>
                <div className="text-[10px] text-gray-400 mt-0.5">Ziffer 299</div>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Umsatzsteuer</div>
                <div className="text-lg font-bold text-amber-700 tabular-nums">{fCHF(report.z399)}</div>
                <div className="text-[10px] text-gray-400 mt-0.5">Ziffer 399</div>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Vorsteuer</div>
                <div className="text-lg font-bold text-[#00875A] tabular-nums">{fCHF(report.z479)}</div>
                <div className="text-[10px] text-gray-400 mt-0.5">Ziffer 479</div>
              </div>
              <div className={`rounded-lg border p-4 shadow-sm ${report.z500 >= 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Zahllast</div>
                <div className={`text-lg font-bold tabular-nums ${report.z500 >= 0 ? 'text-red-700' : 'text-[#00875A]'}`}>
                  {fCHF(Math.abs(report.z500))}
                </div>
                <div className="text-[10px] text-gray-400 mt-0.5">
                  {report.z500 >= 0 ? 'zu bezahlen' : 'Guthaben'}
                </div>
              </div>
            </div>

            {/* Official Swiss VAT Form */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-200 bg-[#1B2A4A]">
                <h2 className="text-[13px] font-bold text-white uppercase tracking-wider">MwSt-Abrechnung (ESTV-Formular)</h2>
                <p className="text-[11px] text-white/50 mt-0.5">Effektive Abrechnungsmethode · Q{quarter}/{year}</p>
              </div>

              <div className="divide-y divide-gray-100">

                {/* Section: Umsatz */}
                <div className="px-5 py-2 bg-gray-50">
                  <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">I. Umsatz</span>
                </div>

                {/* Ziffer 200 */}
                <div className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50/50">
                  <div className="flex items-start gap-3">
                    <span className="text-[12px] font-bold text-gray-400 w-12 shrink-0 mt-0.5">Ziff. 200</span>
                    <div>
                      <div className="text-[13px] font-semibold text-gray-900">Gesamtumsatz der Abrechnungsperiode</div>
                      <div className="text-[11px] text-gray-400 mt-0.5">Total aller vereinnahmten Entgelte inkl. MwSt (bezahlte + versendete Rechnungen)</div>
                    </div>
                  </div>
                  <div className="text-[14px] font-bold text-gray-900 tabular-nums ml-6 shrink-0">{fCHF(report.z200)}</div>
                </div>

                {/* Ziffer 220 */}
                <div className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50/50">
                  <div className="flex items-start gap-3">
                    <span className="text-[12px] font-bold text-gray-400 w-12 shrink-0 mt-0.5">Ziff. 220</span>
                    <div>
                      <div className="text-[13px] font-semibold text-gray-900">Vom Gesamtumsatz abzuziehen</div>
                      <div className="text-[11px] text-gray-400 mt-0.5">Steuerbefreite Leistungen, nicht steuerbare Umsätze, Ausland etc.</div>
                    </div>
                  </div>
                  <div className="text-[14px] font-bold text-gray-500 tabular-nums ml-6 shrink-0">{fCHF(report.z220)}</div>
                </div>

                {/* Ziffer 299 */}
                <div className="flex items-center justify-between px-5 py-3.5 bg-blue-50/30 hover:bg-blue-50/50">
                  <div className="flex items-start gap-3">
                    <span className="text-[12px] font-bold text-blue-500 w-12 shrink-0 mt-0.5">Ziff. 299</span>
                    <div>
                      <div className="text-[13px] font-bold text-gray-900">Steuerbarer Umsatz (netto)</div>
                      <div className="text-[11px] text-gray-400 mt-0.5">Ziffer 200 minus Ziffer 220</div>
                    </div>
                  </div>
                  <div className="text-[14px] font-bold text-gray-900 tabular-nums ml-6 shrink-0">{fCHF(report.z299)}</div>
                </div>

                {/* Section: Steuer */}
                <div className="px-5 py-2 bg-gray-50">
                  <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">II. Berechnung der Steuer</span>
                </div>

                {/* Ziffer 302 */}
                <div className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50/50">
                  <div className="flex items-start gap-3">
                    <span className="text-[12px] font-bold text-gray-400 w-12 shrink-0 mt-0.5">Ziff. 302</span>
                    <div>
                      <div className="text-[13px] font-semibold text-gray-900">Leistungen zum Normalsatz (8.1%)</div>
                      <div className="text-[11px] text-gray-400 mt-0.5">Nettoumsatz: {fCHF(report.revenue81)}</div>
                    </div>
                  </div>
                  <div className="text-[14px] font-bold text-amber-700 tabular-nums ml-6 shrink-0">{fCHF(report.z302)}</div>
                </div>

                {/* Ziffer 312 */}
                <div className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50/50">
                  <div className="flex items-start gap-3">
                    <span className="text-[12px] font-bold text-gray-400 w-12 shrink-0 mt-0.5">Ziff. 312</span>
                    <div>
                      <div className="text-[13px] font-semibold text-gray-900">Leistungen zum Sondersatz (2.6%)</div>
                      <div className="text-[11px] text-gray-400 mt-0.5">Nettoumsatz: {fCHF(report.revenue26)}</div>
                    </div>
                  </div>
                  <div className="text-[14px] font-bold text-amber-700 tabular-nums ml-6 shrink-0">{fCHF(report.z312)}</div>
                </div>

                {/* Ziffer 342 */}
                <div className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50/50">
                  <div className="flex items-start gap-3">
                    <span className="text-[12px] font-bold text-gray-400 w-12 shrink-0 mt-0.5">Ziff. 342</span>
                    <div>
                      <div className="text-[13px] font-semibold text-gray-900">Leistungen zum reduzierten Satz (3.8%)</div>
                      <div className="text-[11px] text-gray-400 mt-0.5">Nettoumsatz: {fCHF(report.revenue38)}</div>
                    </div>
                  </div>
                  <div className="text-[14px] font-bold text-amber-700 tabular-nums ml-6 shrink-0">{fCHF(report.z342)}</div>
                </div>

                {/* Ziffer 399 */}
                <div className="flex items-center justify-between px-5 py-4 bg-amber-50/40 hover:bg-amber-50/60">
                  <div className="flex items-start gap-3">
                    <span className="text-[12px] font-bold text-amber-600 w-12 shrink-0 mt-0.5">Ziff. 399</span>
                    <div>
                      <div className="text-[13px] font-bold text-gray-900">Total geschuldete Steuer (Umsatzsteuer)</div>
                      <div className="text-[11px] text-gray-400 mt-0.5">Summe Ziffer 302 + 312 + 342</div>
                    </div>
                  </div>
                  <div className="text-[15px] font-bold text-amber-700 tabular-nums ml-6 shrink-0">{fCHF(report.z399)}</div>
                </div>

                {/* Section: Vorsteuer */}
                <div className="px-5 py-2 bg-gray-50">
                  <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">III. Vorsteuer</span>
                </div>

                {/* Ziffer 400 */}
                <div className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50/50">
                  <div className="flex items-start gap-3">
                    <span className="text-[12px] font-bold text-gray-400 w-12 shrink-0 mt-0.5">Ziff. 400</span>
                    <div>
                      <div className="text-[13px] font-semibold text-gray-900">Vorsteuer aus Lieferungen und Leistungen</div>
                      <div className="text-[11px] text-gray-400 mt-0.5">
                        MwSt auf Ausgaben (8.1% auf {report.expenses.length} Ausgaben, Brutto: {fCHF(report.expenses.reduce((s, e) => s + e.amount, 0))})
                      </div>
                    </div>
                  </div>
                  <div className="text-[14px] font-bold text-[#00875A] tabular-nums ml-6 shrink-0">{fCHF(report.z400)}</div>
                </div>

                {/* Ziffer 479 */}
                <div className="flex items-center justify-between px-5 py-4 bg-green-50/30 hover:bg-green-50/50">
                  <div className="flex items-start gap-3">
                    <span className="text-[12px] font-bold text-[#00875A] w-12 shrink-0 mt-0.5">Ziff. 479</span>
                    <div>
                      <div className="text-[13px] font-bold text-gray-900">Total abziehbare Vorsteuer</div>
                      <div className="text-[11px] text-gray-400 mt-0.5">Summe der Vorsteuern</div>
                    </div>
                  </div>
                  <div className="text-[15px] font-bold text-[#00875A] tabular-nums ml-6 shrink-0">{fCHF(report.z479)}</div>
                </div>

                {/* Section: Zahllast */}
                <div className="px-5 py-2 bg-gray-50">
                  <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">IV. Zahllast / Überschuss</span>
                </div>

                {/* Ziffer 500 */}
                <div className={`flex items-center justify-between px-5 py-5 border-t-2 ${report.z500 >= 0 ? 'bg-red-50 border-red-300' : 'bg-green-50 border-green-300'}`}>
                  <div className="flex items-start gap-3">
                    <span className={`text-[12px] font-bold w-12 shrink-0 mt-0.5 ${report.z500 >= 0 ? 'text-red-600' : 'text-[#00875A]'}`}>Ziff. 500</span>
                    <div>
                      <div className={`text-[14px] font-bold uppercase tracking-wide ${report.z500 >= 0 ? 'text-red-700' : 'text-[#00875A]'}`}>
                        {report.z500 >= 0 ? 'Zahllast — zu bezahlen an ESTV' : 'Steuerguthaben — Rückerstattung'}
                      </div>
                      <div className="text-[11px] text-gray-500 mt-0.5">Ziffer 399 minus Ziffer 479</div>
                    </div>
                  </div>
                  <div className={`text-[20px] font-bold tabular-nums ml-6 shrink-0 ${report.z500 >= 0 ? 'text-red-700' : 'text-[#00875A]'}`}>
                    {fCHF(Math.abs(report.z500))}
                  </div>
                </div>

              </div>
            </div>

            {/* Invoices table */}
            {report.invoices.length > 0 && (
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-200">
                  <h2 className="text-[13px] font-bold text-gray-900">Einbezogene Rechnungen</h2>
                  <p className="text-[11px] text-gray-400 mt-0.5">{report.invoices.length} Rechnung{report.invoices.length !== 1 ? 'en' : ''} im Zeitraum Q{quarter}/{year}</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[620px]">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Datum</th>
                        <th className="px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Nummer</th>
                        <th className="px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Kunde</th>
                        <th className="px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-right">Netto</th>
                        <th className="px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-right">MwSt</th>
                        <th className="px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-right">Brutto</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {report.invoices.map((inv) => (
                        <tr key={inv.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-4 py-3 text-[12px] text-gray-600 tabular-nums">{formatDate(inv.date)}</td>
                          <td className="px-4 py-3 text-[12px] font-mono text-gray-700">{inv.number || '—'}</td>
                          <td className="px-4 py-3 text-[13px] text-gray-700">{inv.contact_name || '—'}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                              inv.status === 'bezahlt'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-blue-100 text-blue-700'
                            }`}>
                              {inv.status === 'bezahlt' ? 'Bezahlt' : 'Versendet'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right text-[13px] text-gray-700 tabular-nums">{fCHF(inv.subtotal)}</td>
                          <td className="px-4 py-3 text-right text-[13px] text-amber-700 tabular-nums">{fCHF(inv.tax_amount)}</td>
                          <td className="px-4 py-3 text-right text-[13px] font-semibold text-gray-900 tabular-nums">{fCHF(inv.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-50 border-t-2 border-gray-200">
                        <td colSpan={4} className="px-4 py-3 text-[12px] font-bold text-gray-700 uppercase tracking-wide">Total</td>
                        <td className="px-4 py-3 text-right text-[13px] font-bold text-gray-900 tabular-nums">{fCHF(report.revenue81)}</td>
                        <td className="px-4 py-3 text-right text-[13px] font-bold text-amber-700 tabular-nums">{fCHF(report.tax81)}</td>
                        <td className="px-4 py-3 text-right text-[13px] font-bold text-gray-900 tabular-nums">{fCHF(report.z200)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* Disclaimer */}
            <p className="text-[11px] text-gray-400 pb-2">
              Hinweis: Diese Auswertung dient als Hilfsmittel und ersetzt nicht die offizielle ESTV-Abrechnung.
              Vorsteuer wird auf Basis von 8.1% auf alle Ausgaben in der Periode berechnet (Bruttobeträge).
              Massgebend ist stets die offizielle Abrechnung über das ESTV-Portal.
            </p>
          </>
        ) : null}
      </div>
    </AppLayout>
  )
}
