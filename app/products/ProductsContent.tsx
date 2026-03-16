'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { getOrCreateCompanyId } from '@/lib/getOrCreateCompany'
import { Plus, Search, Edit2, Trash2, Package, Tag, Info, X } from 'lucide-react'

type ActiveFilter = 'all' | 'active' | 'inactive'

export default function ProductsContent() {
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('active')
  const [showModal, setShowModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  // Form state
  const [formData, setFormData] = useState({
    product_type: 'dienstleistung' as 'artikel' | 'dienstleistung',
    article_nr: '',
    name: '',
    description: '',
    price: 0,
    unit: 'Stk.',
    tax_rate: 8.1,
    stock_qty: 0,
    active: true
  })

  const supabase = createClient()

  useEffect(() => {
    fetchProducts()
  }, [])

  async function fetchProducts() {
    try {
      setLoading(true)
      const companyId = await getOrCreateCompanyId(supabase)

      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('company_id', companyId)
        .order('name', { ascending: true })

      if (error) throw error
      setProducts(data || [])
    } catch (err) {
      console.error('Error fetching products:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenModal = (product: any = null) => {
    if (product) {
      setEditingProduct(product)
      setFormData({
        product_type: product.product_type || 'dienstleistung',
        article_nr: product.article_nr || '',
        name: product.name,
        description: product.description || '',
        price: Number(product.price) || 0,
        unit: product.unit || 'Stk.',
        tax_rate: Number(product.tax_rate) || 8.1,
        stock_qty: Number(product.stock_qty) || 0,
        active: product.active !== false
      })
    } else {
      setEditingProduct(null)
      setFormData({
        product_type: 'dienstleistung',
        article_nr: '',
        name: '',
        description: '',
        price: 0,
        unit: 'Stk.',
        tax_rate: 8.1,
        stock_qty: 0,
        active: true
      })
    }
    setSaveError('')
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setSaveError('')
    try {
      const companyId = await getOrCreateCompanyId(supabase)

      if (editingProduct) {
        const { error } = await supabase
          .from('products')
          .update(formData)
          .eq('id', editingProduct.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('products')
          .insert([{ ...formData, company_id: companyId }])
        if (error) throw error
      }

      setShowModal(false)
      fetchProducts()
    } catch (err: any) {
      console.error('Error saving product:', err)
      setSaveError(err?.message || 'Fehler beim Speichern des Produkts')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Möchten Sie dieses Produkt wirklich löschen?')) return
    try {
      const { error } = await supabase.from('products').delete().eq('id', id)
      if (error) throw error
      fetchProducts()
    } catch (err) {
      console.error('Error deleting product:', err)
      alert('Fehler beim Löschen des Produkts')
    }
  }

  const filteredProducts = products.filter(p => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.article_nr && p.article_nr.toLowerCase().includes(searchTerm.toLowerCase()))

    const matchesActive =
      activeFilter === 'all' ||
      (activeFilter === 'active' && p.active !== false) ||
      (activeFilter === 'inactive' && p.active === false)

    return matchesSearch && matchesActive
  })

  const fCHF = (n: number) => new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF' }).format(n)

  const filterButtons: { key: ActiveFilter; label: string }[] = [
    { key: 'all', label: 'Alle' },
    { key: 'active', label: 'Aktiv' },
    { key: 'inactive', label: 'Inaktiv' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-gray-900">Produkte</h1>
          <p className="text-gray-400 text-sm mt-1">Verwalte deine Artikel und Dienstleistungen</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 bg-[#00875A] hover:bg-[#006B47] text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
        >
          <Plus size={18} />
          Produkt hinzufügen
        </button>
      </div>

      <div className="flex items-center gap-3 bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Suchen nach Name oder Artikel-Nr..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all"
          />
        </div>
        {/* Active/Inactive filter toggle */}
        <div className="flex items-center bg-gray-100 rounded-lg p-1 gap-0.5 shrink-0">
          {filterButtons.map(btn => (
            <button
              key={btn.key}
              onClick={() => setActiveFilter(btn.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                activeFilter === btn.key
                  ? 'bg-white text-gray-800 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[700px]">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Typ</th>
              <th className="px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Artikel / Name</th>
              <th className="px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Beschreibung</th>
              <th className="px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-right">Preis</th>
              <th className="px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Einheit</th>
              <th className="px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Lager</th>
              <th className="px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">MwSt</th>
              <th className="px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-right">Aktionen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={9} className="px-6 py-10 text-center text-gray-400 text-sm">Laden...</td>
              </tr>
            ) : filteredProducts.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-6 py-10 text-center text-gray-400 text-sm">Keine Produkte gefunden</td>
              </tr>
            ) : (
              filteredProducts.map(product => (
                <tr key={product.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4">
                    {product.product_type === 'artikel' ? (
                      <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full uppercase bg-blue-100 text-blue-700">
                        Artikel
                      </span>
                    ) : (
                      <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full uppercase bg-purple-100 text-purple-700">
                        Dienstl.
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-[13px] font-semibold text-gray-900">{product.name}</div>
                    <div className="text-[11px] text-gray-400 flex items-center gap-1">
                      <Tag size={10} /> {product.article_nr || 'Keine Nr.'}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-[12px] text-gray-600 truncate max-w-[250px]" title={product.description}>
                      {product.description || '–'}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="text-[13px] font-semibold text-gray-900">{fCHF(product.price)}</div>
                  </td>
                  <td className="px-6 py-4 text-[13px] text-gray-600">
                    {product.unit || 'Stk.'}
                  </td>
                  <td className="px-6 py-4 text-[13px] text-gray-600">
                    {product.stock_qty ?? 0} Stk.
                  </td>
                  <td className="px-6 py-4 text-[13px] text-gray-600">
                    {product.tax_rate}%
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`inline-block w-2 h-2 rounded-full ${
                          product.active !== false ? 'bg-green-500' : 'bg-gray-300'
                        }`}
                      />
                      <span className={`text-[12px] ${product.active !== false ? 'text-green-700' : 'text-gray-400'}`}>
                        {product.active !== false ? 'Aktiv' : 'Inaktiv'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleOpenModal(product)}
                        className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(product.id)}
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
                {editingProduct ? 'Produkt bearbeiten' : 'Neues Produkt'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1">
              {/* Product type toggle */}
              <div className="mb-5">
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Typ</label>
                <div className="flex rounded-lg border border-gray-200 overflow-hidden w-fit">
                  <button
                    type="button"
                    onClick={() => setFormData(f => ({ ...f, product_type: 'dienstleistung' }))}
                    className={`px-5 py-2.5 text-sm font-semibold transition-colors ${
                      formData.product_type === 'dienstleistung'
                        ? 'bg-purple-600 text-white'
                        : 'bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    Dienstleistung
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData(f => ({ ...f, product_type: 'artikel' }))}
                    className={`px-5 py-2.5 text-sm font-semibold transition-colors border-l border-gray-200 ${
                      formData.product_type === 'artikel'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    Artikel
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Name *</label>
                  <input
                    required
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20"
                    placeholder="Produkt oder Dienstleistung"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Artikel-Nr</label>
                  <input
                    value={formData.article_nr}
                    onChange={e => setFormData({...formData, article_nr: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20"
                    placeholder="z.B. 1001"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Einheit</label>
                  <input
                    value={formData.unit}
                    onChange={e => setFormData({...formData, unit: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20"
                    placeholder="Stk. / Std. / km"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Stk. Anzahl</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={formData.stock_qty}
                    onChange={e => setFormData({...formData, stock_qty: Number(e.target.value)})}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Preis (Netto) *</label>
                  <input
                    required
                    type="number"
                    step="0.05"
                    min="0"
                    value={formData.price}
                    onChange={e => setFormData({...formData, price: Number(e.target.value)})}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">MwSt-Satz (%)</label>
                  <select
                    value={formData.tax_rate}
                    onChange={e => setFormData({...formData, tax_rate: Number(e.target.value)})}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20"
                  >
                    <option value={8.1}>8.1% (Normalsatz)</option>
                    <option value={2.6}>2.6% (Reduziert)</option>
                    <option value={3.8}>3.8% (Sondersatz)</option>
                    <option value={0}>0% (Befreit)</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Beschreibung</label>
                  <textarea
                    value={formData.description}
                    onChange={e => setFormData({...formData, description: e.target.value})}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20"
                    placeholder="Details zum Produkt..."
                  />
                </div>
                {/* Active toggle */}
                <div className="col-span-2">
                  <label className="flex items-center gap-3 cursor-pointer select-none">
                    <div
                      onClick={() => setFormData(f => ({ ...f, active: !f.active }))}
                      className={`relative w-10 h-6 rounded-full transition-colors ${
                        formData.active ? 'bg-[#00875A]' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                          formData.active ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </div>
                    <span className="text-sm font-semibold text-gray-700">
                      Aktiv
                    </span>
                    <span className="text-xs text-gray-400">
                      {formData.active ? 'Produkt ist aktiv und in Rechnungen verfügbar' : 'Produkt ist deaktiviert'}
                    </span>
                  </label>
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
