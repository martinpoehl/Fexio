'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import Link from 'next/link'

export default function SignupPage() {
  const [vorname, setVorname] = useState('')
  const [nachname, setNachname] = useState('')
  const [firma, setFirma] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const supabase = createClient()

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('Registrierungen sind momentan deaktiviert. Bitte kontaktiere uns direkt.')
  }

  if (success) {
    return (
      <div className="w-full max-w-md">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <div className="w-14 h-14 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Fast geschafft!</h2>
          <p className="text-gray-500 text-sm mb-6">
            Wir haben dir eine Bestätigungs-E-Mail an <strong>{email}</strong> gesendet.
            Klicke auf den Link in der E-Mail um dein Konto zu aktivieren.
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
      {/* Logo */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-3 mb-3">
          <svg width="40" height="40" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="signup-bg" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
                <stop stopColor="#1a56db"/>
                <stop offset="1" stopColor="#00875A"/>
              </linearGradient>
              <linearGradient id="signup-shine" x1="0" y1="0" x2="0" y2="64" gradientUnits="userSpaceOnUse">
                <stop stopColor="white" stopOpacity="0.12"/>
                <stop offset="1" stopColor="white" stopOpacity="0"/>
              </linearGradient>
            </defs>
            <rect width="64" height="64" rx="13" fill="url(#signup-bg)"/>
            <rect width="64" height="64" rx="13" fill="url(#signup-shine)"/>
            <rect x="14" y="13" width="9" height="38" rx="2.5" fill="white"/>
            <rect x="14" y="13" width="34" height="9" rx="2.5" fill="white"/>
            <rect x="14" y="28" width="23" height="8" rx="2.5" fill="white"/>
            <circle cx="45.5" cy="46.5" r="6.5" fill="#00D98B"/>
          </svg>
          <span className="text-2xl font-bold text-gray-900">Fexio</span>
        </div>
        <p className="text-gray-500 text-sm">Kostenlos registrieren – keine Kreditkarte nötig</p>
      </div>

      {/* Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <h2 className="text-xl font-bold text-gray-900 mb-1">Konto erstellen</h2>
        <p className="text-gray-500 text-sm mb-6">Starte in wenigen Sekunden</p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSignup}>
          <div className="flex gap-3 mb-4">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Vorname
              </label>
              <input
                type="text"
                value={vorname}
                onChange={(e) => setVorname(e.target.value)}
                placeholder="Max"
                required
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Nachname
              </label>
              <input
                type="text"
                value={nachname}
                onChange={(e) => setNachname(e.target.value)}
                placeholder="Muster"
                required
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Firma <span className="text-gray-400 font-normal normal-case">(optional)</span>
            </label>
            <input
              type="text"
              value={firma}
              onChange={(e) => setFirma(e.target.value)}
              placeholder="Muster AG"
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
            />
          </div>

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
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
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
              placeholder="Mindestens 6 Zeichen"
              required
              minLength={6}
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
            />
          </div>

          <div className="mb-6">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Passwort bestätigen
            </label>
            <input
              type="password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              placeholder="Passwort wiederholen"
              required
              minLength={6}
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-[#00875A] hover:bg-[#006B47] text-white rounded-lg text-sm font-semibold transition disabled:opacity-50"
          >
            {loading ? 'Konto wird erstellt...' : 'Kostenlos registrieren'}
          </button>
        </form>

        <p className="text-xs text-gray-400 mt-4 text-center">
          Mit der Registrierung akzeptierst du die Nutzungsbedingungen und Datenschutzrichtlinie.
        </p>
      </div>

      <p className="text-center text-sm text-gray-500 mt-6">
        Bereits ein Konto?{' '}
        <Link href="/auth/login" className="text-green-700 font-semibold hover:underline">
          Anmelden
        </Link>
      </p>
    </div>
  )
}
