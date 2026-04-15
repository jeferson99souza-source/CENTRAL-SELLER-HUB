import { Suspense } from 'react'
import { apiFetch, type Order } from '@/lib/api'
import OrdersLayout from './OrdersLayout'

async function OrdersData() {
  try {
    const result = await apiFetch<unknown>('/orders')
    const orders: Order[] = Array.isArray(result) ? result : []
    return <OrdersLayout orders={orders} />
  } catch {
    return <OrdersLayout orders={[]} />
  }
}

function Skeleton() {
  return (
    <div className="space-y-3">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="bg-white rounded-3xl p-5 shadow-sm animate-pulse">
          <div className="h-4 bg-gray-100 rounded w-1/4 mb-2" />
          <div className="h-3 bg-gray-100 rounded w-1/2 mb-2" />
          <div className="h-4 bg-gray-100 rounded w-3/4" />
        </div>
      ))}
    </div>
  )
}

export default function PedidosPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Pedidos</h2>
        <p className="text-sm text-[#5B657A] mt-1">Últimas vendas aprovadas</p>
      </div>
      <Suspense fallback={<Skeleton />}>
        <OrdersData />
      </Suspense>
    </div>
  )
}
