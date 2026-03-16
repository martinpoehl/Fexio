'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { Calculator, Search, Calendar, ArrowRight, FileText, Receipt } from 'lucide-react'

export default function JournalContent() {
  const [entries, setEntries] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  const supabase = createClient()

  useEffect(() => {
    fetchEntries()
  }, [])

  async function fetchEntries() {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: companies } = await supabase.from('companies').select('id').eq('user_id', user.id).limit(1)
      if (!companies?.length) return
      const companyId = companies[0].id

      const { data, error } = await supabase
        .from('journal_entries')
        .select('*')
        .eq('company_id', companyId)
        .order('date', { ascending: false })

      if (error) throw error
      setEntries(data || [])
    } catch (err) {
      console.error('Error fetching journal:', err)
    } finally {
      setLoading(false)
    }
  }

  const filteredEntries = entries.filter(e =>
    e.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.debit_account.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.credit_account.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const fCHF = (n: number) => new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF' }).format(n)
  const fD = (d: string) => {
    if (!d) return ''
    const dt = new Date(d)
    return String(dt.getDate()).padStart(2, '0') + '.' + String(dt.getMonth() + 1).padStart(2, '0') + '.' + dt.getFullYear()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-gray-900">Journal</h1>
          <p className="text-gray-400 text-sm mt-1">Chronologische Liste aller Buchungen</p>
        </div>
      </div>

      <div className="flex items-center gap-4 bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text"
            placeholder="Suchen nach Beschreibung, Konto..."
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
              <th className="px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Datum</th>
              <th className="px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Beschreibung</th>
              <th className="px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-center">Soll / Haben</th>
              <th className="px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-right">Betrag</th>
              <th className="px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-center">Typ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-center text-gray-400 text-sm">Laden...</td>
              </tr>
            ) : filteredEntries.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-center text-gray-400 text-sm">Keine Buchungen gefunden</td>
              </tr>
            ) : (
              filteredEntries.map(entry => (
                <tr key={entry.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="text-[13px] font-medium text-gray-900 flex items-center gap-2">
                      <Calendar size={13} className="text-gray-400" /> {fD(entry.date)}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-[13px] font-semibold text-gray-900">{entry.description}</div>
                    <div className="text-[11px] text-gray-400">{entry.reference || '–'}</div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-3 text-[13px]">
                      <span className="font-mono text-gray-600 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100">{entry.debit_account}</span>
                      <ArrowRight size={12} className="text-gray-300" />
                      <span className="font-mono text-gray-600 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100">{entry.credit_account}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="text-[13px] font-bold text-gray-900">{fCHF(entry.amount)}</div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    {entry.document_id ? (
                      <div className="flex justify-center" title="Rechnung">
                        <FileText size={16} className="text-blue-500" />
                      </div>
                    ) : entry.expense_id ? (
                      <div className="flex justify-center" title="Ausgabe">
                        <Receipt size={16} className="text-red-400" />
                      </div>
                    ) : (
                      <div className="flex justify-center text-[10px] text-gray-400 font-bold uppercase">Manuell</div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
