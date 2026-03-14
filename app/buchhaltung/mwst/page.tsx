import AppLayout from '@/components/AppLayout'

export default function Page() {
  return (
    <AppLayout>
      <div>
        <h1 className="text-[22px] font-bold text-gray-900 mb-2">MwSt-Abrechnung</h1>
        <p className="text-gray-400 text-sm">Buchhaltung nach Schweizer Kontenrahmen KMU</p>
        <div className="mt-6 bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-300">
          Hier kommt die MwSt-Abrechnung hin
        </div>
      </div>
    </AppLayout>
  )
}
