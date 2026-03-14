import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'BizManager – Schweizer Business Software',
  description: 'Kostenlose bexio-Alternative für KMU, Freelancer und Startups',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className="bg-gray-50 overflow-hidden">
        {children}
      </body>
    </html>
  )
}
