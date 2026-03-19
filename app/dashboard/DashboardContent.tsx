'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { getOrCreateCompanyId } from '@/lib/getOrCreateCompany'
import Link from 'next/link'
import { FileText, UserPlus, Clock, Receipt, AlertTriangle, TrendingUp } from 'lucide-react'

function StatCard({ label, value, color, href }: { label: string; value: string; color: string; href: string }) {
  return (
    <Link href={href} className="flex-1 min-w-[160px] bg-white rounded-lg border border-gray-200 p-5 hover:border-gray-300 hover:shadow-md transition-all group">
      <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">{label}</div>
      <div className={`text-2xl font-bold ${color} group-hover:opacity-80 transition-opacity`}>{value}</div>
    </Link>
  )
}

function fCHF(n: number) {
  return new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF' }).format(n)
}

export default function DashboardContent() {
  const [stats, setStats] = useState({ revenue: 0, outstanding: 0, expenses: 0, weekMinutes: 0 })
  const [recentInvoices, setRecentInvoices] = useState<any[]>([])
  const [recentTime, setRecentTime] = useState<any[]>([])
  const [overdueInvoices, setOverdueInvoices] = useState<any[]>([])
  const [topCustomers, setTopCustomers] = useState<{ name: string; total: number }[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      try {
        const companyId = await getOrCreateCompanyId(supabase)
        const today = new Date().toISOString().split('T')[0]

        // Revenue (paid invoices)
        const { data: paidInv } = await supabase
          .from('documents')
          .select('total')
          .eq('company_id', companyId)
          .eq('type', 'invoice')
          .eq('status', 'bezahlt')
        const revenue = (paidInv || []).reduce((s, i) => s + Number(i.total || 0), 0)

        // Outstanding (open invoices)
        const { data: openInv } = await supabase
          .from('documents')
          .select('total')
          .eq('company_id', companyId)
          .eq('type', 'invoice')
          .in('status', ['offen', 'versendet'])
        const outstanding = (openInv || []).reduce((s, i) => s + Number(i.total || 0), 0)

        // Expenses
        const { data: exps } = await supabase
          .from('expenses')
          .select('amount')
          .eq('company_id', companyId)
        const expenses = (exps || []).reduce((s, e) => s + Number(e.amount || 0), 0)

        // This week time
        const weekStart = new Date()
        weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1)
        weekStart.setHours(0, 0, 0, 0)
        const { data: weekTime } = await supabase
          .from('time_entries')
          .select('duration_minutes')
          .eq('company_id', companyId)
          .gte('date', weekStart.toISOString().split('T')[0])
        const weekMinutes = (weekTime || []).reduce((s, t) => s + (t.duration_minutes || 0), 0)

        setStats({ revenue, outstanding, expenses, weekMinutes })

        // Recent invoices
        const { data: recInv } = await supabase
          .from('documents')
          .select('*')
          .eq('company_id', companyId)
          .eq('type', 'invoice')
          .order('created_at', { ascending: false })
          .limit(5)
        setRecentInvoices(recInv || [])

        // Recent time entries
        const { data: recTime } = await supabase
          .from('time_entries')
          .select('*, projects(name)')
          .eq('company_id', companyId)
          .order('date', { ascending: false })
          .limit(5)
        setRecentTime(recTime || [])

        // Overdue invoices: offen or versendet with due_date < today
        const { data: overdueData } = await supabase
          .from('documents')
          .select('id, number, contact_name, total, due_date, status')
          .eq('company_id', companyId)
          .eq('type', 'invoice')
          .in('status', ['offen', 'versendet'])
          .lt('due_date', today)
          .order('due_date', { ascending: true })
        setOverdueInvoices(overdueData || [])

        // Top customers by revenue (paid invoices with contact_name)
        const { data: paidFull } = await supabase
          .from('documents')
          .select('contact_name, total')
          .eq('company_id', companyId)
          .eq('type', 'invoice')
          .eq('status', 'bezahlt')
          .not('contact_name', 'is', null)

        const customerMap: Record<string, number> = {}
        for (const inv of paidFull || []) {
          const name = inv.contact_name || 'Unbekannt'
          customerMap[name] = (customerMap[name] || 0) + Number(inv.total || 0)
        }
        const sorted = Object.entries(customerMap)
          .map(([name, total]) => ({ name, total }))
          .sort((a, b) => b.total - a.total)
          .slice(0, 3)
        setTopCustomers(sorted)
      } catch (err) {
        console.error('Error loading dashboard:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const fDur = (m: number) => Math.floor(m / 60) + 'h ' + String(m % 60).padStart(2, '0') + 'min'
  const fD = (d: string) => {
    if (!d) return ''
    const [y, m, day] = d.split('-')
    return `${day}.${m}.${y}`
  }

  const statusColors: Record<string, string> = {
    entwurf: 'bg-gray-100 text-gray-500',
    offen: 'bg-amber-50 text-amber-600',
    versendet: 'bg-blue-50 text-blue-600',
    bezahlt: 'bg-green-50 text-green-700',
    storniert: 'bg-red-50 text-red-600',
  }

  const overdueTotal = overdueInvoices.reduce((s, i) => s + Number(i.total || 0), 0)

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Dashboard laden...</div>
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-[22px] font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-400 text-sm mt-1">Übersicht deines Geschäfts</p>
      </div>

      {/* Quick Actions */}
      <div className="flex gap-3 flex-wrap mb-6">
        <Link
          href="/invoices"
          className="flex items-center gap-2 bg-[#1B2A4A] hover:bg-[#243660] text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors shadow-sm"
        >
          <FileText size={16} />
          Rechnung erstellen
        </Link>
        <Link
          href="/contacts"
          className="flex items-center gap-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors shadow-sm"
        >
          <UserPlus size={16} />
          Kontakt hinzufügen
        </Link>
        <Link
          href="/time"
          className="flex items-center gap-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors shadow-sm"
        >
          <Clock size={16} />
          Zeit erfassen
        </Link>
        <Link
          href="/expenses"
          className="flex items-center gap-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors shadow-sm"
        >
          <Receipt size={16} />
          Ausgabe erfassen
        </Link>
      </div>

      {/* Overdue Invoices Alert */}
      {overdueInvoices.length > 0 && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">
            <AlertTriangle size={18} className="text-red-500" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold text-red-700 mb-0.5">
              {overdueInvoices.length} {overdueInvoices.length === 1 ? 'überfällige Rechnung' : 'überfällige Rechnungen'}
            </div>
            <div className="text-xs text-red-600">
              Gesamtbetrag: <span className="font-bold">{fCHF(overdueTotal)}</span>
              {' · '}
              Älteste seit {fD(overdueInvoices[0]?.due_date)}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {overdueInvoices.slice(0, 3).map(inv => (
                <span key={inv.id} className="inline-flex items-center gap-1 text-[11px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
                  {inv.number} · {fCHF(inv.total || 0)}
                </span>
              ))}
              {overdueInvoices.length > 3 && (
                <Link href="/invoices" className="text-[11px] text-red-500 underline font-medium">
                  +{overdueInvoices.length - 3} weitere anzeigen
                </Link>
              )}
            </div>
          </div>
          <Link
            href="/invoices"
            className="flex-shrink-0 text-[11px] font-semibold text-red-600 hover:text-red-800 underline"
          >
            Alle anzeigen
          </Link>
        </div>
      )}

      {/* Stats */}
      <div className="flex gap-3.5 flex-wrap mb-6">
        <StatCard label="Umsatz (bezahlt)" value={fCHF(stats.revenue)} color="text-green-700" href="/invoices" />
        <StatCard label="Offene Rechnungen" value={fCHF(stats.outstanding)} color="text-amber-600" href="/invoices" />
        <StatCard label="Ausgaben" value={fCHF(stats.expenses)} color="text-red-600" href="/expenses" />
        <StatCard label="Stunden (Woche)" value={fDur(stats.weekMinutes)} color="text-blue-600" href="/time" />
      </div>

      {/* Two columns */}
      <div className="flex gap-3.5 flex-wrap mb-3.5">
        {/* Recent Invoices */}
        <div className="flex-1 min-w-[300px] bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <span className="font-semibold text-[13px] text-gray-900">Letzte Rechnungen</span>
            <Link href="/invoices" className="text-[11px] text-[#00875A] hover:underline font-medium">Alle anzeigen</Link>
          </div>
          {recentInvoices.length === 0 ? (
            <div className="p-6 text-center text-gray-300 text-sm">Keine Rechnungen</div>
          ) : (
            recentInvoices.map(inv => (
              <div key={inv.id} className="px-4 py-2.5 border-b border-gray-50 flex items-center justify-between hover:bg-gray-50/50">
                <div>
                  <div className="text-[13px] font-medium text-gray-900">{inv.number}</div>
                  <div className="text-[11px] text-gray-400">{inv.contact_name || '–'} · {fD(inv.date)}</div>
                </div>
                <div className="text-right">
                  <div className="text-[13px] font-semibold text-gray-900">{fCHF(inv.total || 0)}</div>
                  <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded ${statusColors[inv.status] || statusColors.entwurf}`}>
                    {inv.status === 'bezahlt' ? 'Bezahlt' : inv.status === 'offen' ? 'Offen' : inv.status === 'versendet' ? 'Versendet' : 'Entwurf'}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Recent Time */}
        <div className="flex-1 min-w-[300px] bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <span className="font-semibold text-[13px] text-gray-900">Letzte Zeiteinträge</span>
            <Link href="/time" className="text-[11px] text-[#00875A] hover:underline font-medium">Alle anzeigen</Link>
          </div>
          {recentTime.length === 0 ? (
            <div className="p-6 text-center text-gray-300 text-sm">Keine Zeiteinträge</div>
          ) : (
            recentTime.map(t => (
              <div key={t.id} className="px-4 py-2.5 border-b border-gray-50 flex items-center justify-between hover:bg-gray-50/50">
                <div>
                  <div className="text-[13px] font-medium text-gray-900">{t.description}</div>
                  <div className="text-[11px] text-gray-400">
                    {t.projects?.name || 'Kein Projekt'} · {fD(t.date)}
                  </div>
                </div>
                <div className="text-[13px] font-semibold text-blue-600">{fDur(t.duration_minutes || 0)}</div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Top Customers */}
      {topCustomers.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <TrendingUp size={14} className="text-[#00875A]" />
            <span className="font-semibold text-[13px] text-gray-900">Top Kunden nach Umsatz</span>
          </div>
          <div className="divide-y divide-gray-50">
            {topCustomers.map((c, i) => (
              <div key={c.name} className="px-4 py-3 flex items-center gap-3 hover:bg-gray-50/50">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[11px] font-bold text-gray-500">
                  {i + 1}
                </div>
                <div className="flex-1 text-[13px] font-medium text-gray-900">{c.name}</div>
                <div className="text-[13px] font-bold text-green-700">{fCHF(c.total)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
