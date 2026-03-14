'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import Link from 'next/link'

export default function ResetPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/settings`,
    })

    if (error) {
      setError(error.message)
    } else {
      setSent(true)
    }
    setLoading(false)
  }

  if (sent) {
    return (
      <div className="w-full max-w-md">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <div className="w-14 h-14 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">E-Mail gesendet</h2>
          <p className="text-gray-500 text-sm mb-4">
            Falls ein Konto mit <strong>{email}</strong> existiert, erhältst du einen Link zum Zurücksetzen deines Passworts.
          </p>
          <Link href="/auth/login" className="text-sm text-green-700 font-semibold hover:underline">
            Zurück zum Login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-[#00875A] rounded-lg flex items-center justify-center text-white font-bold text-lg">b</div>
          <span className="text-2xl font-bold text-gray-900">BizManager</span>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <h2 className="text-xl font-bold text-gray-900 mb-1">Passwort zurücksetzen</h2>
        <p className="text-gray-500 text-sm mb-6">Gib deine E-Mail ein und wir senden dir einen Reset-Link.</p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-700">{error}</div>
        )}

        <form onSubmit={handleReset}>
          <div className="mb-6">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">E-Mail</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="max@beispiel.ch" required
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full py-2.5 bg-[#00875A] hover:bg-[#006B47] text-white rounded-lg text-sm font-semibold transition disabled:opacity-50">
            {loading ? 'Senden...' : 'Reset-Link senden'}
          </button>
        </form>
      </div>

      <p className="text-center text-sm text-gray-500 mt-6">
        <Link href="/auth/login" className="text-green-700 font-semibold hover:underline">Zurück zum Login</Link>
      </p>
    </div>
  )
}
