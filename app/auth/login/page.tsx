'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import Link from 'next/link'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [magicLinkSent, setMagicLinkSent] = useState(false)
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message === 'Invalid login credentials'
        ? 'E-Mail oder Passwort falsch.'
        : error.message)
      setLoading(false)
    } else {
      window.location.href = '/dashboard'
    }
  }

  const handleMagicLink = async () => {
    if (!email) { setError('Bitte E-Mail eingeben.'); return }
    setError('')
    setLoading(true)

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` }
    })

    if (error) {
      setError(error.message)
    } else {
      setMagicLinkSent(true)
    }
    setLoading(false)
  }

  const handleSocialLogin = async (provider: 'google' | 'github') => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` }
    })
    if (error) setError(error.message)
  }

  if (magicLinkSent) {
    return (
      <div className="w-full max-w-md">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <div className="w-14 h-14 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">E-Mail prüfen</h2>
          <p className="text-gray-500 text-sm mb-4">
            Wir haben dir einen Login-Link an <strong>{email}</strong> gesendet.
            Klicke auf den Link in der E-Mail um dich anzumelden.
          </p>
          <button onClick={() => setMagicLinkSent(false)} className="text-sm text-green-700 hover:underline">
            Zurück zum Login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md">
      {/* Logo */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-3 mb-3">
          <svg width="40" height="40" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="login-bg" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
                <stop stopColor="#1a56db"/>
                <stop offset="1" stopColor="#00875A"/>
              </linearGradient>
              <linearGradient id="login-shine" x1="0" y1="0" x2="0" y2="64" gradientUnits="userSpaceOnUse">
                <stop stopColor="white" stopOpacity="0.12"/>
                <stop offset="1" stopColor="white" stopOpacity="0"/>
              </linearGradient>
            </defs>
            <rect width="64" height="64" rx="13" fill="url(#login-bg)"/>
            <rect width="64" height="64" rx="13" fill="url(#login-shine)"/>
            <rect x="14" y="13" width="9" height="38" rx="2.5" fill="white"/>
            <rect x="14" y="13" width="34" height="9" rx="2.5" fill="white"/>
            <rect x="14" y="28" width="23" height="8" rx="2.5" fill="white"/>
            <circle cx="45.5" cy="46.5" r="6.5" fill="#00D98B"/>
          </svg>
          <span className="text-2xl font-bold text-gray-900">Fexio</span>
        </div>
        <p className="text-gray-500 text-sm">Schweizer Business Software für KMU</p>
      </div>

      {/* Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <h2 className="text-xl font-bold text-gray-900 mb-1">Anmelden</h2>
        <p className="text-gray-500 text-sm mb-6">Melde dich an oder erstelle ein Konto</p>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleLogin}>
          <div className="mb-4">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              E-Mail
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="max@beispiel.ch"
              required
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition"
            />
          </div>

          <div className="mb-4">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Passwort
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition"
            />
            <div className="mt-1.5 text-right">
              <Link href="/auth/reset" className="text-xs text-green-700 hover:underline" tabIndex={-1}>
                Passwort vergessen?
              </Link>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-[#00875A] hover:bg-[#006B47] text-white rounded-lg text-sm font-semibold transition disabled:opacity-50"
          >
            {loading ? 'Laden...' : 'Anmelden'}
          </button>
        </form>

        {/* Magic Link */}
        <button
          onClick={handleMagicLink}
          disabled={loading}
          className="w-full mt-3 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition disabled:opacity-50"
        >
          Login-Link per E-Mail senden
        </button>
      </div>

      {/* Signup Link */}
      <p className="text-center text-sm text-gray-500 mt-6">
        Noch kein Konto?{' '}
        <Link href="/auth/signup" className="text-green-700 font-semibold hover:underline">
          Kostenlos registrieren
        </Link>
      </p>
    </div>
  )
}
