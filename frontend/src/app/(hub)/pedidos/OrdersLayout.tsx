'use client'

import { Package, Clock, User, DollarSign } from 'lucide-react'
import type { Order } from '@/lib/api'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

type Props = { orders: Order[] }

export default function OrdersLayout({ orders }: Props) {
  if (!orders.length) {
    return (
      <div className="text-center py-16 text-gray-400">
        <Package className="w-10 h-10 mx-auto mb-3 opacity-40" />
        <p className="text-sm">Nenhum pedido recebido</p>
      </div>
    )
  }

  return (
    <div className="space-y-3 pb-8">
      {orders.map((o) => (
        <div key={o.id} className="bg-white rounded-3xl p-5 shadow-sm">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="flex items-center gap-2 min-w-0">
              <User className="w-4 h-4 text-gray-400 shrink-0" />
              <span className="text-sm font-bold text-gray-900 truncate">
                {o.buyerName || 'Cliente'}
              </span>
            </div>
            <span className="shrink-0 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-green-100 text-green-600">
              {o.status}
            </span>
          </div>

          <div className="flex flex-col gap-2 mb-3">
            <div className="flex items-center gap-1.5">
              <Package className="w-4 h-4 text-orange-400 shrink-0" />
              <span className="text-sm text-gray-700 font-medium">{o.itemQuantity}x {o.itemTitle}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-emerald-500 shrink-0" />
              <span className="text-sm font-bold text-emerald-600">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: o.currency }).format(o.totalAmount || 0)}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <Clock className="w-3.5 h-3.5" />
              <span>Data: {formatDate(o.orderDate)}</span>
            </div>
            {o.shippingStatus && (
              <span className="text-xs font-semibold text-blue-500 uppercase">ENVIO: {o.shippingStatus}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
