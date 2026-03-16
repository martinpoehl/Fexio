'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: 'grid' },
  { href: '/contacts', label: 'Kontakte', icon: 'users' },
  {
    label: 'Verkauf', icon: 'file-text', children: [
      { href: '/invoices?type=offer', label: 'Offerten' },
      { href: '/invoices?type=order', label: 'Aufträge' },
      { href: '/invoices', label: 'Rechnungen' },
    ]
  },
  {
    label: 'Einkauf', icon: 'receipt', children: [
      { href: '/expenses', label: 'Aufwendungen' },
    ]
  },
  {
    label: 'Projekte & Zeit', icon: 'clock', children: [
      { href: '/projects', label: 'Projekte' },
      { href: '/time', label: 'Zeiterfassung' },
    ]
  },
  { href: '/products', label: 'Produkte', icon: 'package' },
  {
    label: 'Buchhaltung', icon: 'calculator', children: [
      { href: '/buchhaltung', label: 'Journal' },
      { href: '/buchhaltung/bilanz', label: 'Bilanz & ER' },
      { href: '/buchhaltung/mwst', label: 'MwSt-Abrechnung' },
    ]
  },
  { href: '/settings', label: 'Einstellungen', icon: 'settings' },
]

function NavIcon({ name, className = "w-[18px] h-[18px]" }: { name: string; className?: string }) {
  const icons: Record<string, JSX.Element> = {
    grid: <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>,
    users: <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    'file-text': <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
    receipt: <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
    clock: <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
    package: <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
    calculator: <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="10" y2="10"/><line x1="14" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="10" y2="14"/><line x1="14" y1="14" x2="16" y2="14"/><line x1="8" y1="18" x2="16" y2="18"/></svg>,
    settings: <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
    logout: <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  }
  return icons[name] || null
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null)
  const [company, setCompany] = useState<any>(null)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ Verkauf: true, Einkauf: true, 'Projekte & Zeit': true })
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()

  useEffect(() => {
    // Close sidebar on navigation on mobile
    setSidebarOpen(false)
  }, [pathname])

  useEffect(() => {
    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { router.push('/auth/login'); return }
        setUser(user)

        const { data: companies } = await supabase
          .from('companies')
          .select('*')
          .eq('user_id', user.id)
          .limit(1)

        if (companies && companies.length > 0) {
          setCompany(companies[0])
        }
      } catch (err) {
        console.error('Error loading AppLayout:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const toggleGroup = (label: string) => {
    setOpenGroups(prev => ({ ...prev, [label]: !prev[label] }))
  }

  const isActive = (href: string) => pathname === href || pathname?.startsWith(href + '/')


  if (loading) {
    return (
      <div className="h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 bg-[#00875A] rounded-lg flex items-center justify-center text-white font-bold text-lg mx-auto mb-3 animate-pulse">f</div>
          <p className="text-gray-400 text-sm">Laden...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden relative">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-[240px] bg-[#1B2A4A] flex flex-col shrink-0 transition-transform duration-300 lg:static lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Company header */}
        <div className="px-4 py-4 border-b border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 bg-[#00875A] rounded-md flex items-center justify-center text-white font-bold text-sm shrink-0 overflow-hidden">
              {company?.logo_url ? (
                <img src={company.logo_url} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                (company?.name || 'F').charAt(0).toUpperCase()
              )}
            </div>
            <div className="min-w-0">
              <div className="text-white text-[13px] font-semibold truncate">{company?.name || 'Meine Firma'}</div>
              <div className="text-white/40 text-[10px] truncate">{user?.email}</div>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-white/50 hover:text-white">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-2 px-2">
          {navItems.map((item, i) => {
            if ('children' in item) {
              const isOpen = openGroups[item.label]
              const hasActive = item.children?.some(c => isActive(c.href))
              return (
                <div key={item.label}>
                  {i > 0 && !('children' in navItems[i - 1]) && (
                    <div className="h-px bg-white/[0.06] mx-2 my-1.5" />
                  )}
                  <button
                    onClick={() => toggleGroup(item.label)}
                    className={`flex items-center justify-between w-full px-3 py-2 rounded-md text-[13px] transition-colors ${
                      hasActive ? 'text-white font-semibold' : 'text-white/50 hover:text-white/70'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <NavIcon name={item.icon!} />
                      {item.label}
                    </span>
                    <svg className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                  {isOpen && (
                    <div className="ml-2 mb-1">
                      {item.children?.map(child => (
                        <Link
                          key={child.href}
                          href={child.href}
                          className={`block px-3 py-1.5 pl-9 rounded-md text-[13px] transition-colors ${
                            isActive(child.href)
                              ? 'bg-[#2D4270] text-white font-semibold'
                              : 'text-white/45 hover:text-white/70 hover:bg-white/[0.04]'
                          }`}
                        >
                          {child.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )
            }

            return (
              <Link
                key={item.href}
                href={item.href!}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] transition-colors ${
                  isActive(item.href!)
                    ? 'bg-[#2D4270] text-white font-semibold'
                    : 'text-white/50 hover:text-white/70 hover:bg-white/[0.04]'
                }`}
              >
                <NavIcon name={item.icon!} />
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="px-2 py-3 border-t border-white/[0.06]">
          <button
            onClick={handleLogout}
            className="flex items-center gap-2.5 w-full px-3 py-2 rounded-md text-[13px] text-white/40 hover:text-white/70 hover:bg-white/[0.04] transition-colors"
          >
            <NavIcon name="logout" />
            Abmelden
          </button>
          <div className="px-3 mt-2 text-[10px] text-white/20">
            Fexio v3.0 – Kostenlos
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Header */}
        <header className="lg:hidden bg-[#1a56db] shrink-0" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
          <div className="flex items-center px-4 py-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 -ml-2 text-white/80 hover:text-white"
            >
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="ml-3 font-bold text-xl text-white tracking-tight">Fexio</div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-gray-50" style={{ WebkitOverflowScrolling: 'touch' }}>
          <div className="max-w-[1100px] mx-auto px-4 py-4 md:px-8 md:py-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
