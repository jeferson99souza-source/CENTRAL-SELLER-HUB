import { Suspense } from 'react'
import { apiFetch, type Order } from '@/lib/api'
import EnviosLayout from './EnviosLayout'

async function EnviosData() {
  try {
    const result = await apiFetch<unknown>('/orders')
    const orders: Order[] = Array.isArray(result) ? result : []
    return <EnviosLayout orders={orders} />
  } catch {
    return <EnviosLayout orders={[]} />
  }
}

function Skeleton() {
  return (
    <div className="flex gap-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="w-72 shrink-0 space-y-3">
          <div className="h-10 bg-gray-100 rounded-2xl animate-pulse" />
          <div className="h-24 bg-white rounded-2xl shadow-sm animate-pulse" />
          <div className="h-24 bg-white rounded-2xl shadow-sm animate-pulse" />
        </div>
      ))}
    </div>
  )
}

export const dynamic = 'force-dynamic'

export default function EnviosPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Envios</h2>
        <p className="text-sm text-[#5B657A] mt-1">
          Acompanhe seus envios — do despacho à entrega — e as devoluções
        </p>
      </div>
      <Suspense fallback={<Skeleton />}>
        <EnviosData />
      </Suspense>
    </div>
  )
}
