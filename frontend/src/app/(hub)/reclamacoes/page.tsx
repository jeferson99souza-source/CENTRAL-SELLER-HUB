import { Suspense } from 'react'
import { apiFetch, type Complaint } from '@/lib/api'
import ReclamacoesLayout from './ReclamacoesLayout'

async function ReclamacoesData() {
  const complaints = await apiFetch<Complaint[]>('/complaints')
  return <ReclamacoesLayout complaints={complaints} />
}

function Skeleton() {
  return (
    <div className="space-y-3">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="bg-white rounded-3xl p-5 shadow-sm animate-pulse">
          <div className="h-4 bg-gray-100 rounded w-1/3 mb-2" />
          <div className="h-4 bg-gray-100 rounded w-2/3" />
        </div>
      ))}
    </div>
  )
}

export default function ReclamacoesPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Reclamações</h2>
        <p className="text-sm text-[#5B657A] mt-1">Mercado Livre</p>
      </div>
      <Suspense fallback={<Skeleton />}>
        <ReclamacoesData />
      </Suspense>
    </div>
  )
}
