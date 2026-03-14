# LocalFinance – Next.js + Vercel + Supabase

Schweizer Business Software – kostenlose bexio-Alternative.
Läuft in der Cloud, erreichbar von überall, mit Login und Datenbank.

## Setup in 15 Minuten

### Schritt 1: Supabase Projekt erstellen

1. Gehe zu [supabase.com](https://supabase.com) → "Start your project"
2. Erstelle ein neues Projekt (Region: **Frankfurt** für Schweiz)
3. Warte bis das Projekt bereit ist (~2 Min)
4. Gehe zu **SQL Editor** → Neues Query
5. Kopiere den gesamten Inhalt von `supabase/schema.sql` hinein
6. Klicke **Run** → alle Tabellen werden erstellt
7. Gehe zu **Settings → API** und kopiere:
   - `Project URL` (= NEXT_PUBLIC_SUPABASE_URL)
   - `anon/public` Key (= NEXT_PUBLIC_SUPABASE_ANON_KEY)

### Schritt 2: GitHub Repository erstellen

```bash
cd LocalFinance-next
git init
git add .
git commit -m "Initial commit"
```

Erstelle ein neues Repo auf [github.com](https://github.com/new) und pushe:

```bash
git remote add origin https://github.com/DEIN-USERNAME/LocalFinance.git
git branch -M main
git push -u origin main
```

### Schritt 3: Auf Vercel deployen

1. Gehe zu [vercel.com](https://vercel.com) → "Add New Project"
2. Importiere dein GitHub Repo
3. Unter **Environment Variables** füge hinzu:
   - `NEXT_PUBLIC_SUPABASE_URL` = deine Supabase URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = dein Supabase anon Key
4. Klicke **Deploy**
5. In ~60 Sekunden ist die App live unter `LocalFinance.vercel.app`

### Schritt 4: Auth aktivieren

1. In Supabase → **Authentication → Providers**
2. Aktiviere **Email** (ist default)
3. Optional: Google, GitHub etc. für Social Login
4. Unter **URL Configuration** setze:
   - Site URL: `https://deine-app.vercel.app`
   - Redirect URLs: `https://deine-app.vercel.app/auth/callback`

### Fertig!

Öffne deine App-URL → Registrieren → Loslegen.

## Lokal entwickeln

```bash
# Dependencies installieren
npm install

# .env.local erstellen (kopiere von .env.local.example)
cp .env.local.example .env.local
# Füge deine Supabase-Keys ein

# Dev Server starten
npm run dev
```

App läuft unter http://localhost:3000

## Projektstruktur

```
LocalFinance-next/
├── app/                    # Next.js App Router
│   ├── layout.tsx          # Root Layout
│   ├── globals.css         # Tailwind + Styles
│   ├── auth/               # Login / Signup
│   ├── dashboard/          # Dashboard
│   ├── contacts/           # Kontaktverwaltung
│   ├── invoices/           # Rechnungen
│   ├── time/               # Zeiterfassung
│   ├── projects/           # Projekte
│   ├── products/           # Produkte
│   ├── expenses/           # Aufwendungen
│   ├── buchhaltung/        # Journal, Bilanz, ER, MwSt
│   └── settings/           # Firmeneinstellungen
├── components/             # Shared UI Components
├── lib/
│   ├── supabase-browser.ts # Client-side Supabase
│   └── supabase-server.ts  # Server-side Supabase
├── supabase/
│   └── schema.sql          # Datenbankschema (run in SQL Editor)
├── middleware.ts            # Auth Middleware
├── tailwind.config.js
├── next.config.js
└── package.json
```

## Datenbank-Schema

Alle Tabellen haben Row Level Security (RLS) – jeder User sieht
nur seine eigenen Daten. Multi-Mandant ist eingebaut.

| Tabelle | Beschreibung |
|---------|-------------|
| companies | Firmenprofile (1 pro User) |
| contacts | Kunden & Lieferanten |
| products | Artikel & Dienstleistungen |
| projects | Projekte mit Budget |
| documents | Offerten, Aufträge, Rechnungen |
| document_lines | Rechnungspositionen |
| time_entries | Zeiterfassung |
| expenses | Aufwendungen |
| journal_entries | Buchhaltungsbuchungen |
| bank_transactions | camt.053 Bankimport |

## Features die du jetzt bauen kannst

Da du einen Server hast (Vercel Edge Functions), sind jetzt möglich:

- Direkter E-Mail-Versand (Resend, SendGrid)
- PDF-Generierung serverseitig (react-pdf)
- camt.053/054 Bankimport
- Automatische Mahnungen (Cron Jobs via Vercel)
- QR-Rechnung mit Swiss QR Code (swissqrbill)
- Webhook für Zahlungseingang
- SIX bLink Integration (Bankanbindung)
- Multi-User mit Rollenmanagement

## Kosten

| Service | Free Tier | Pro |
|---------|-----------|-----|
| Vercel | Unlimited Deploys, 100GB Bandwidth | $20/Mo |
| Supabase | 500MB DB, 50k Auth Users, 2GB Storage | $25/Mo |
| GitHub | Unlimited Private Repos | $0 |
| **Total** | **CHF 0** | **~CHF 40/Mo** |

Zum Vergleich: bexio Pro+ kostet CHF 45/Mo und du hast keine Kontrolle über die Daten.

## Nächste Schritte

Das Grundgerüst (Schema, Auth, Middleware, Struktur) ist fertig.
Jetzt musst du die einzelnen Seiten mit UI füllen. Du kannst:

1. Die Komponenten aus der HTML-Version (LocalFinance-bexio.html) als
   Vorlage nehmen und in React/Tailwind umschreiben
2. Shadcn/ui installieren für fertige Komponenten:
   `npx shadcn-ui@latest init`
3. Mich bitten, einzelne Seiten zu bauen (z.B. "Baue die Rechnungsseite")

## Eigene Domain

In Vercel → Settings → Domains → deine Domain hinzufügen.
z.B. `app.meinefirma.ch`
