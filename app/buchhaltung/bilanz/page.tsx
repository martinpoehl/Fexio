'use client'

import { useState, useEffect } from 'react'
import AppLayout from '@/components/AppLayout'
import { createClient } from '@/lib/supabase-browser'
import { getOrCreateCompanyId } from '@/lib/getOrCreateCompany'

// Swiss KMU chart of accounts classification
function classifyAccount(accountNr: string, isDebit: boolean) {
  const nr = parseInt(accountNr, 10)
  if (isNaN(nr)) return null

  // AKTIVEN
  if (nr >= 1000 && nr <= 1999) return 'aktiven_umlauf'
  if (nr >= 2000 && nr <= 2799 && isDebit) return 'aktiven_anlage'

  // PASSIVEN
  if (nr >= 2000 && nr <= 2799 && !isDebit) return 'passiven_fremd'
  if (nr >= 2800 && nr <= 2999 && !isDebit) return 'passiven_eigen'
  if (nr >= 2800 && nr <= 2999 && isDebit) return 'aktiven_anlage'

  // AUFWAND (expense accounts)
  if (nr >= 3000 && nr <= 6999 && isDebit) return 'aufwand'

  // ERTRAG (revenue accounts)
  if (nr >= 3000 && nr <= 4999 && !isDebit) return 'ertrag'

  return null
}

function fCHF(n: number) {
  return new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF' }).format(n)
}

interface AccountBalance {
  account: string
  label: string
  balance: number
}

interface ReportData {
  aktiven_umlauf: AccountBalance[]
  aktiven_anlage: AccountBalance[]
  passiven_fremd: AccountBalance[]
  passiven_eigen: AccountBalance[]
  aufwand: AccountBalance[]
  ertrag: AccountBalance[]
}

function SectionTable({ title, rows, totalLabel, totalColor = 'text-gray-900' }: {
  title: string
  rows: AccountBalance[]
  totalLabel: string
  totalColor?: string
}) {
  const total = rows.reduce((s, r) => s + r.balance, 0)
  return (
    <div className="overflow-hidden">
      <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200">
        <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">{title}</span>
      </div>
      {rows.length === 0 ? (
        <div className="px-4 py-3 text-[12px] text-gray-300 italic">Keine Buchungen</div>
      ) : (
        rows.map((row, i) => (
          <div key={i} className="flex items-center justify-between px-4 py-2 border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{row.account}</span>
              <span className="text-[13px] text-gray-700">{row.label}</span>
            </div>
            <span className="text-[13px] font-semibold text-gray-900 tabular-nums">{fCHF(row.balance)}</span>
          </div>
        ))
      )}
      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50/80 border-t border-gray-200">
        <span className="text-[12px] font-bold text-gray-600 uppercase tracking-wide">{totalLabel}</span>
        <span className={`text-[14px] font-bold tabular-nums ${totalColor}`}>{fCHF(total)}</span>
      </div>
    </div>
  )
}

export default function BilanzPage() {
  const [loading, setLoading] = useState(true)
  const [year, setYear] = useState(new Date().getFullYear())
  const [data, setData] = useState<ReportData>({
    aktiven_umlauf: [],
    aktiven_anlage: [],
    passiven_fremd: [],
    passiven_eigen: [],
    aufwand: [],
    ertrag: [],
  })

  const supabase = createClient()

  useEffect(() => {
    fetchReport()
  }, [year])

  async function fetchReport() {
    try {
      setLoading(true)
      const companyId = await getOrCreateCompanyId(supabase)

      const { data: entries, error } = await supabase
        .from('journal_entries')
        .select('debit_account, credit_account, amount, date')
        .eq('company_id', companyId)
        .gte('date', `${year}-01-01`)
        .lte('date', `${year}-12-31`)

      if (error) throw error

      // Accumulate net balances per account
      // For each entry: debit_account is debited, credit_account is credited
      const accountDebits: Record<string, number> = {}
      const accountCredits: Record<string, number> = {}

      for (const e of entries || []) {
        const amt = Number(e.amount) || 0
        accountDebits[e.debit_account] = (accountDebits[e.debit_account] || 0) + amt
        accountCredits[e.credit_account] = (accountCredits[e.credit_account] || 0) + amt
      }

      // All accounts mentioned
      const allAccounts = new Set([
        ...Object.keys(accountDebits),
        ...Object.keys(accountCredits),
      ])

      const buckets: ReportData = {
        aktiven_umlauf: [],
        aktiven_anlage: [],
        passiven_fremd: [],
        passiven_eigen: [],
        aufwand: [],
        ertrag: [],
      }

      const ACCOUNT_LABELS: Record<string, string> = {
        '1000': 'Kasse',
        '1020': 'Bank',
        '1100': 'Debitoren',
        '1200': 'Vorräte',
        '1300': 'Aktive Rechnungsabgrenzung',
        '1400': 'Wertschriften',
        '1500': 'Mobile Sachanlagen',
        '1520': 'Fahrzeuge',
        '1600': 'Immobile Sachanlagen',
        '2000': 'Kreditoren',
        '2100': 'Bankdarlehen',
        '2200': 'Passive Rechnungsabgrenzung',
        '2300': 'Langfristige Schulden',
        '2800': 'Aktienkapital',
        '2900': 'Gesetzliche Reserven',
        '2970': 'Gewinnvortrag',
        '2979': 'Jahresgewinn/-verlust',
        '3000': 'Umsatzerlöse',
        '3200': 'Dienstleistungserlöse',
        '3400': 'Erträge aus Lieferungen',
        '3800': 'Sonstige Erträge',
        '4000': 'Wareneinkauf',
        '4500': 'Dienstleistungen von Dritten',
        '5000': 'Lohnaufwand',
        '5800': 'Sozialleistungen',
        '6000': 'Raumaufwand',
        '6200': 'Fahrzeugaufwand',
        '6500': 'Versicherungen',
        '6570': 'Informatikaufwand',
        '6600': 'Werbeaufwand',
        '6700': 'Sonstiger Betriebsaufwand',
        '6800': 'Abschreibungen',
        '6900': 'Finanzaufwand',
      }

      for (const acc of allAccounts) {
        const debits = accountDebits[acc] || 0
        const credits = accountCredits[acc] || 0
        const netDebit = debits - credits  // positive = net debit balance
        const netCredit = credits - debits // positive = net credit balance
        const label = ACCOUNT_LABELS[acc] || `Konto ${acc}`

        // Determine if account has a net debit or credit balance
        const isNetDebit = netDebit > 0
        const balance = Math.abs(netDebit) > Math.abs(netCredit) ? netDebit : netCredit
        const classification = classifyAccount(acc, netDebit >= 0)

        if (!classification) continue

        const row: AccountBalance = { account: acc, label, balance: Math.abs(balance) }
        buckets[classification as keyof ReportData].push(row)
      }

      // Sort each bucket by account number
      for (const key of Object.keys(buckets) as (keyof ReportData)[]) {
        buckets[key].sort((a, b) => a.account.localeCompare(b.account, undefined, { numeric: true }))
      }

      setData(buckets)
    } catch (err) {
      console.error('Error fetching Bilanz data:', err)
    } finally {
      setLoading(false)
    }
  }

  const totalAktiven =
    data.aktiven_umlauf.reduce((s, r) => s + r.balance, 0) +
    data.aktiven_anlage.reduce((s, r) => s + r.balance, 0)

  const totalPassiven =
    data.passiven_fremd.reduce((s, r) => s + r.balance, 0) +
    data.passiven_eigen.reduce((s, r) => s + r.balance, 0)

  const totalErtrag = data.ertrag.reduce((s, r) => s + r.balance, 0)
  const totalAufwand = data.aufwand.reduce((s, r) => s + r.balance, 0)
  const gewinn = totalErtrag - totalAufwand

  const currentYear = new Date().getFullYear()
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i)

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-[22px] font-bold text-gray-900">Bilanz & Erfolgsrechnung</h1>
            <p className="text-gray-400 text-sm mt-1">Schweizer Kontenrahmen KMU – Jahresabschluss</p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide">Jahr</label>
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
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Total Aktiven</div>
                <div className="text-xl font-bold text-gray-900 tabular-nums">{fCHF(totalAktiven)}</div>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Total Passiven</div>
                <div className="text-xl font-bold text-gray-900 tabular-nums">{fCHF(totalPassiven)}</div>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Ertrag</div>
                <div className="text-xl font-bold text-[#00875A] tabular-nums">{fCHF(totalErtrag)}</div>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                  {gewinn >= 0 ? 'Jahresgewinn' : 'Jahresverlust'}
                </div>
                <div className={`text-xl font-bold tabular-nums ${gewinn >= 0 ? 'text-[#00875A]' : 'text-red-600'}`}>
                  {fCHF(Math.abs(gewinn))}
                </div>
              </div>
            </div>

            {/* Two-column layout: Bilanz + Erfolgsrechnung */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

              {/* BILANZ – AKTIVEN */}
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-200 bg-[#1B2A4A]">
                  <h2 className="text-[13px] font-bold text-white uppercase tracking-wider">Bilanz — Aktiven</h2>
                  <p className="text-[11px] text-white/50 mt-0.5">Mittelverwendung per 31.12.{year}</p>
                </div>
                <SectionTable
                  title="Umlaufvermögen (1000–1999)"
                  rows={data.aktiven_umlauf}
                  totalLabel="Total Umlaufvermögen"
                />
                <SectionTable
                  title="Anlagevermögen (2000–2999)"
                  rows={data.aktiven_anlage}
                  totalLabel="Total Anlagevermögen"
                />
                <div className="flex items-center justify-between px-4 py-3 bg-[#00875A]/5 border-t-2 border-[#00875A]/20">
                  <span className="text-[13px] font-bold text-gray-900 uppercase tracking-wide">Total Aktiven</span>
                  <span className="text-[15px] font-bold text-[#00875A] tabular-nums">{fCHF(totalAktiven)}</span>
                </div>
              </div>

              {/* BILANZ – PASSIVEN */}
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-200 bg-[#1B2A4A]">
                  <h2 className="text-[13px] font-bold text-white uppercase tracking-wider">Bilanz — Passiven</h2>
                  <p className="text-[11px] text-white/50 mt-0.5">Mittelherkunft per 31.12.{year}</p>
                </div>
                <SectionTable
                  title="Fremdkapital (2000–2799)"
                  rows={data.passiven_fremd}
                  totalLabel="Total Fremdkapital"
                />
                <SectionTable
                  title="Eigenkapital (2800–2999)"
                  rows={data.passiven_eigen}
                  totalLabel="Total Eigenkapital"
                />
                <div className="flex items-center justify-between px-4 py-3 bg-[#00875A]/5 border-t-2 border-[#00875A]/20">
                  <span className="text-[13px] font-bold text-gray-900 uppercase tracking-wide">Total Passiven</span>
                  <span className="text-[15px] font-bold text-[#00875A] tabular-nums">{fCHF(totalPassiven)}</span>
                </div>
              </div>

              {/* ERFOLGSRECHNUNG – ERTRAG */}
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-200" style={{ background: '#00875A' }}>
                  <h2 className="text-[13px] font-bold text-white uppercase tracking-wider">Erfolgsrechnung — Ertrag</h2>
                  <p className="text-[11px] text-white/60 mt-0.5">Einnahmen 01.01.–31.12.{year}</p>
                </div>
                <SectionTable
                  title="Ertrag (3000–4999 Haben)"
                  rows={data.ertrag}
                  totalLabel="Total Ertrag"
                  totalColor="text-[#00875A]"
                />
              </div>

              {/* ERFOLGSRECHNUNG – AUFWAND + ERGEBNIS */}
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-200" style={{ background: '#00875A' }}>
                  <h2 className="text-[13px] font-bold text-white uppercase tracking-wider">Erfolgsrechnung — Aufwand</h2>
                  <p className="text-[11px] text-white/60 mt-0.5">Ausgaben 01.01.–31.12.{year}</p>
                </div>
                <SectionTable
                  title="Aufwand (3000–6999 Soll)"
                  rows={data.aufwand}
                  totalLabel="Total Aufwand"
                  totalColor="text-red-600"
                />
                {/* Ergebnis */}
                <div className="border-t-2 border-gray-200">
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
                    <span className="text-[12px] text-gray-500">Total Ertrag</span>
                    <span className="text-[12px] font-semibold text-gray-700 tabular-nums">{fCHF(totalErtrag)}</span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
                    <span className="text-[12px] text-gray-500">./. Total Aufwand</span>
                    <span className="text-[12px] font-semibold text-gray-700 tabular-nums">- {fCHF(totalAufwand)}</span>
                  </div>
                  <div className={`flex items-center justify-between px-4 py-3 ${gewinn >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                    <span className="text-[13px] font-bold text-gray-900 uppercase tracking-wide">
                      {gewinn >= 0 ? 'Jahresgewinn' : 'Jahresverlust'}
                    </span>
                    <span className={`text-[15px] font-bold tabular-nums ${gewinn >= 0 ? 'text-[#00875A]' : 'text-red-600'}`}>
                      {fCHF(Math.abs(gewinn))}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bilanz balance check */}
            {(totalAktiven > 0 || totalPassiven > 0) && (
              <div className={`rounded-lg border p-4 text-sm flex items-center gap-3 ${
                Math.abs(totalAktiven - totalPassiven) < 1
                  ? 'bg-green-50 border-green-200 text-green-700'
                  : 'bg-amber-50 border-amber-200 text-amber-700'
              }`}>
                <span className="text-lg">{Math.abs(totalAktiven - totalPassiven) < 1 ? '✓' : '!'}</span>
                <div>
                  {Math.abs(totalAktiven - totalPassiven) < 1
                    ? 'Bilanz ist ausgeglichen — Aktiven entsprechen den Passiven.'
                    : `Bilanzierungsdifferenz: ${fCHF(Math.abs(totalAktiven - totalPassiven))} — Aktiven und Passiven stimmen nicht überein. Prüfe manuelle Buchungen.`
                  }
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  )
}
