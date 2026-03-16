'use client'

import { useState, useEffect } from 'react'
import AppLayout from '@/components/AppLayout'
import { createClient } from '@/lib/supabase-browser'
import { getOrCreateCompanyId } from '@/lib/getOrCreateCompany'

const VAT_RATES = [8.1, 2.6, 3.8, 0] as const
type VatRate = typeof VAT_RATES[number]

function fCHF(n: number) {
  return new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF' }).format(n)
}

function fPct(n: number) {
  return n.toFixed(1) + '%'
}

function getCurrentQuarter(): number {
  return Math.floor(new Date().getMonth() / 3) + 1
}

function getQuarterRange(year: number, quarter: number): { start: string; end: string } {
  const startMonth = (quarter - 1) * 3
  const endMonth = startMonth + 2
  const start = new Date(year, startMonth, 1)
  const end = new Date(year, endMonth + 1, 0) // last day of endMonth
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  }
}

interface VatGroup {
  rate: number
  umsatz: number      // revenue at this rate (gross)
  umsatzNetto: number // revenue net of VAT
  steuer: number      // VAT amount collected
  vorsteuer: number   // input tax from expenses
}

interface MwstReport {
  groups: Record<number, VatGroup>
  gesamtumsatz: number     // Ziffer 200
  steuerbarerUmsatz: number // Ziffer 400
  steuer: number           // Ziffer 500 (output VAT)
  vorsteuer: number        // Ziffer 400 Vorsteuer (input VAT)
  zahllast: number         // net payable
}

export default function MwstPage() {
  const currentYear = new Date().getFullYear()
  const [loading, setLoading] = useState(true)
  const [year, setYear] = useState(currentYear)
  const [quarter, setQuarter] = useState(getCurrentQuarter())
  const [report, setReport] = useState<MwstReport | null>(null)

  const supabase = createClient()

  useEffect(() => {
    fetchReport()
  }, [year, quarter])

  async function fetchReport() {
    try {
      setLoading(true)
      const companyId = await getOrCreateCompanyId(supabase)
      const { start, end } = getQuarterRange(year, quarter)

      // Fetch paid/sent invoices in range
      const { data: invoices } = await supabase
        .from('documents')
        .select('total, vat_rate, vat_amount, subtotal')
        .eq('company_id', companyId)
        .eq('type', 'invoice')
        .in('status', ['bezahlt', 'versendet'])
        .gte('date', start)
        .lte('date', end)

      // Fetch expenses in range (for Vorsteuer)
      const { data: expenses } = await supabase
        .from('expenses')
        .select('amount, vat_rate, vat_amount')
        .eq('company_id', companyId)
        .gte('date', start)
        .lte('date', end)

      // Build groups
      const groups: Record<number, VatGroup> = {}
      for (const rate of VAT_RATES) {
        groups[rate] = { rate, umsatz: 0, umsatzNetto: 0, steuer: 0, vorsteuer: 0 }
      }

      let gesamtumsatz = 0

      for (const inv of invoices || []) {
        const total = Number(inv.total) || 0
        const rate = Number(inv.vat_rate) || 0
        // vat_amount stored directly, or calculate from rate
        const vatAmt = inv.vat_amount != null
          ? Number(inv.vat_amount)
          : total - total / (1 + rate / 100)
        const netto = total - vatAmt

        // Find matching rate bucket (nearest)
        const bucketRate = VAT_RATES.reduce((prev, curr) =>
          Math.abs(curr - rate) < Math.abs(prev - rate) ? curr : prev
        )

        if (groups[bucketRate]) {
          groups[bucketRate].umsatz += total
          groups[bucketRate].umsatzNetto += netto
          groups[bucketRate].steuer += vatAmt
        }

        gesamtumsatz += total
      }

      for (const exp of expenses || []) {
        const amount = Number(exp.amount) || 0
        const rate = Number(exp.vat_rate) || 0
        const vatAmt = exp.vat_amount != null
          ? Number(exp.vat_amount)
          : amount - amount / (1 + rate / 100)

        const bucketRate = VAT_RATES.reduce((prev, curr) =>
          Math.abs(curr - rate) < Math.abs(prev - rate) ? curr : prev
        )

        if (groups[bucketRate]) {
          groups[bucketRate].vorsteuer += vatAmt
        }
      }

      const steuerbarerUmsatz = Object.values(groups)
        .filter(g => g.rate > 0)
        .reduce((s, g) => s + g.umsatzNetto, 0)

      const steuer = Object.values(groups).reduce((s, g) => s + g.steuer, 0)
      const vorsteuer = Object.values(groups).reduce((s, g) => s + g.vorsteuer, 0)
      const zahllast = steuer - vorsteuer

      setReport({ groups, gesamtumsatz, steuerbarerUmsatz, steuer, vorsteuer, zahllast })
    } catch (err) {
      console.error('Error fetching MwSt data:', err)
    } finally {
      setLoading(false)
    }
  }

  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i)

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-[22px] font-bold text-gray-900">MwSt-Abrechnung</h1>
            <p className="text-gray-400 text-sm mt-1">Mehrwertsteuer-Abrechnung nach Schweizer Recht</p>
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
            Daten laden...
          </div>
        ) : report ? (
          <>
            {/* Period label */}
            <div className="text-[12px] text-gray-400 -mt-2">
              Abrechnungsperiode: Q{quarter}/{year} &nbsp;·&nbsp; {getQuarterRange(year, quarter).start.split('-').reverse().join('.')} – {getQuarterRange(year, quarter).end.split('-').reverse().join('.')}
            </div>

            {/* ESTV Formular summary */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-200 bg-[#1B2A4A]">
                <h2 className="text-[13px] font-bold text-white uppercase tracking-wider">MwSt-Formular (vereinfacht)</h2>
                <p className="text-[11px] text-white/50 mt-0.5">Effektive Abrechnungsmethode</p>
              </div>

              <div className="divide-y divide-gray-100">
                {/* Ziffer 200 */}
                <div className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50/50">
                  <div>
                    <div className="text-[13px] font-semibold text-gray-900">Ziffer 200 — Gesamtumsatz (brutto)</div>
                    <div className="text-[11px] text-gray-400 mt-0.5">Total aller vereinnahmten Entgelte (bezahlte + versendete Rechnungen)</div>
                  </div>
                  <div className="text-[14px] font-bold text-gray-900 tabular-nums ml-6 shrink-0">{fCHF(report.gesamtumsatz)}</div>
                </div>

                {/* Ziffer 400 Umsatz */}
                <div className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50/50">
                  <div>
                    <div className="text-[13px] font-semibold text-gray-900">Ziffer 400 — Steuerbarer Umsatz (netto)</div>
                    <div className="text-[11px] text-gray-400 mt-0.5">Umsatz zu Normalsatz, Sondersatz & reduziertem Satz (exkl. MwSt)</div>
                  </div>
                  <div className="text-[14px] font-bold text-gray-900 tabular-nums ml-6 shrink-0">{fCHF(report.steuerbarerUmsatz)}</div>
                </div>

                {/* Ziffer 500 Steuer */}
                <div className="flex items-center justify-between px-5 py-3.5 bg-amber-50/40 hover:bg-amber-50/60">
                  <div>
                    <div className="text-[13px] font-semibold text-gray-900">Ziffer 500 — Steuer (geschuldete MwSt)</div>
                    <div className="text-[11px] text-gray-400 mt-0.5">Auf dem steuerbaren Umsatz geschuldete Mehrwertsteuer</div>
                  </div>
                  <div className="text-[14px] font-bold text-amber-700 tabular-nums ml-6 shrink-0">{fCHF(report.steuer)}</div>
                </div>

                {/* Ziffer 400 Vorsteuer */}
                <div className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50/50">
                  <div>
                    <div className="text-[13px] font-semibold text-gray-900">Vorsteuer — Abziehbare Vorsteuer</div>
                    <div className="text-[11px] text-gray-400 mt-0.5">MwSt auf Aufwendungen / Einkauf (aus Ausgaben)</div>
                  </div>
                  <div className="text-[14px] font-bold text-[#00875A] tabular-nums ml-6 shrink-0">- {fCHF(report.vorsteuer)}</div>
                </div>

                {/* Zahllast */}
                <div className={`flex items-center justify-between px-5 py-4 border-t-2 ${report.zahllast >= 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                  <div>
                    <div className={`text-[14px] font-bold uppercase tracking-wide ${report.zahllast >= 0 ? 'text-red-700' : 'text-[#00875A]'}`}>
                      {report.zahllast >= 0 ? 'Zahllast (zu bezahlen an ESTV)' : 'Steuerguthaben (Rückerstattung)'}
                    </div>
                    <div className="text-[11px] text-gray-500 mt-0.5">Geschuldete MwSt ./. abziehbare Vorsteuer</div>
                  </div>
                  <div className={`text-[18px] font-bold tabular-nums ml-6 shrink-0 ${report.zahllast >= 0 ? 'text-red-700' : 'text-[#00875A]'}`}>
                    {fCHF(Math.abs(report.zahllast))}
                  </div>
                </div>
              </div>
            </div>

            {/* VAT rate breakdown */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-200">
                <h2 className="text-[13px] font-bold text-gray-900">Aufgliederung nach Steuersatz</h2>
                <p className="text-[11px] text-gray-400 mt-0.5">Umsatz und Vorsteuer je Mehrwertsteuersatz</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[600px]">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-5 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Steuersatz</th>
                      <th className="px-5 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-right">Bruttoumsatz</th>
                      <th className="px-5 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-right">Nettoumsatz</th>
                      <th className="px-5 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-right">MwSt (Steuer)</th>
                      <th className="px-5 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-right">Vorsteuer</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {VAT_RATES.map(rate => {
                      const g = report.groups[rate]
                      return (
                        <tr key={rate} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-5 py-3.5">
                            <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[12px] font-bold ${
                              rate === 8.1
                                ? 'bg-blue-50 text-blue-700'
                                : rate === 2.6
                                ? 'bg-purple-50 text-purple-700'
                                : rate === 3.8
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-gray-100 text-gray-500'
                            }`}>
                              {fPct(rate)}
                              {rate === 8.1 && <span className="text-[10px] font-normal">Normalsatz</span>}
                              {rate === 2.6 && <span className="text-[10px] font-normal">Sondersatz</span>}
                              {rate === 3.8 && <span className="text-[10px] font-normal">Beherbergung</span>}
                              {rate === 0 && <span className="text-[10px] font-normal">Befreit</span>}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-right text-[13px] text-gray-700 tabular-nums">{fCHF(g.umsatz)}</td>
                          <td className="px-5 py-3.5 text-right text-[13px] text-gray-700 tabular-nums">{fCHF(g.umsatzNetto)}</td>
                          <td className="px-5 py-3.5 text-right text-[13px] font-semibold text-amber-700 tabular-nums">{fCHF(g.steuer)}</td>
                          <td className="px-5 py-3.5 text-right text-[13px] font-semibold text-[#00875A] tabular-nums">{fCHF(g.vorsteuer)}</td>
                        </tr>
                      )
                    })}
                    {/* Totals row */}
                    <tr className="bg-gray-50 border-t-2 border-gray-200">
                      <td className="px-5 py-3 text-[12px] font-bold text-gray-700 uppercase tracking-wide">Total</td>
                      <td className="px-5 py-3 text-right text-[13px] font-bold text-gray-900 tabular-nums">{fCHF(report.gesamtumsatz)}</td>
                      <td className="px-5 py-3 text-right text-[13px] font-bold text-gray-900 tabular-nums">{fCHF(report.steuerbarerUmsatz)}</td>
                      <td className="px-5 py-3 text-right text-[13px] font-bold text-amber-700 tabular-nums">{fCHF(report.steuer)}</td>
                      <td className="px-5 py-3 text-right text-[13px] font-bold text-[#00875A] tabular-nums">{fCHF(report.vorsteuer)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Note */}
            <p className="text-[11px] text-gray-400 pb-2">
              Hinweis: Diese Auswertung dient als Hilfsmittel. Massgebend ist die offizielle ESTV-Abrechnung.
              Vorsteuer wird nur erfasst, wenn im Ausgaben-Formular ein MwSt-Betrag (vat_amount) oder Steuersatz (vat_rate) hinterlegt ist.
            </p>
          </>
        ) : null}
      </div>
    </AppLayout>
  )
}
