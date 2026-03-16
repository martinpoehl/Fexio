import AppLayout from '@/components/AppLayout'
import InvoicesContent from './InvoicesContent'
import { Suspense } from 'react'

export default function InvoicesPage() {
  return (
    <AppLayout>
      <Suspense fallback={<div className="text-gray-400 text-sm">Laden...</div>}>
        <InvoicesContent />
      </Suspense>
    </AppLayout>
  )
}
