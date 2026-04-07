import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Fexio – Schweizer Business Software',
  description: 'Kostenlose bexio-Alternative für KMU, Freelancer und Startups',
  viewport: 'width=device-width, initial-scale=1, viewport-fit=cover',
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' }
    ],
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className="bg-[#1a56db] overflow-hidden">
        {children}
      </body>
    </html>
  )
}
