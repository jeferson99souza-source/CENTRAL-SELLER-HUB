'use client'

import { Truck, Package, User, MapPin, Send, CheckCircle, RotateCcw } from 'lucide-react'
import type { Order } from '@/lib/api'

// Tipo de logística do ML → tag FULL / FLEX / COLETA
const LOGISTIC_MAP: Record<string, { label: string; color: string }> = {
  fulfillment:   { label: 'FULL',   color: 'bg-green-600 text-white' },
  self_service:  { label: 'FLEX',   color: 'bg-blue-600 text-white' },
  cross_docking: { label: 'COLETA', color: 'bg-amber-500 text-white' },
  drop_off:      { label: 'COLETA', color: 'bg-amber-500 text-white' },
  xd_drop_off:   { label: 'COLETA', color: 'bg-amber-500 text-white' },
}

function LogisticBadge({ type }: { type: string | null }) {
  if (!type) return null
  const info = LOGISTIC_MAP[type]
  if (!info) return null
  return (
    <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${info.color}`}>
      {info.label}
    </span>
  )
}

type ColumnKey = 'a_enviar' | 'transito' | 'entregue' | 'devolucao'

const COLUMNS: {
  key: ColumnKey
  label: string
  icon: typeof Package
  color: string
  head: string
}[] = [
  { key: 'a_enviar',  label: 'A enviar',    icon: Package,     color: 'text-gray-600',   head: 'bg-gray-100' },
  { key: 'transito',  label: 'Em trânsito', icon: Send,        color: 'text-blue-600',   head: 'bg-blue-50' },
  { key: 'entregue',  label: 'Entregue',    icon: CheckCircle, color: 'text-green-600',  head: 'bg-green-50' },
  { key: 'devolucao', label: 'Devolução',   icon: RotateCcw,   color: 'text-purple-600', head: 'bg-purple-50' },
]

const SHIPPING_LABEL: Record<string, string> = {
  pending:       'Pendente',
  handling:      'Preparando',
  ready_to_ship: 'Pronto p/ enviar',
  shipped:       'Enviado',
  delivered:     'Entregue',
  not_delivered: 'Não entregue',
  returning:     'Em devolução',
  returned:      'Devolvido',
  cancelled:     'Cancelado',
}

function bucket(o: Order): ColumnKey {
  const s = (o.shippingStatus || '').toLowerCase()
  const sub = (o.shippingSubstatus || '').toLowerCase()
  if (sub.includes('return') || s === 'returning' || s === 'returned') return 'devolucao'
  if (s === 'not_delivered' || s === 'cancelled') return 'devolucao'
  if (s === 'delivered') return 'entregue'
  if (s === 'shipped') return 'transito'
  return 'a_enviar' // pending, handling, ready_to_ship, sem info
}

export default function EnviosLayout({ orders }: { orders: Order[] }) {
  if (!orders.length) {
    return (
      <div className="text-center py-16 text-gray-400">
        <Truck className="w-10 h-10 mx-auto mb-3 opacity-40" />
        <p className="text-sm">Nenhum envio encontrado</p>
        <p className="text-xs mt-1 opacity-60">Clique em &quot;Puxar Dados do ML&quot; no Dashboard</p>
      </div>
    )
  }

  const grouped: Record<ColumnKey, Order[]> = {
    a_enviar: [],
    transito: [],
    entregue: [],
    devolucao: [],
  }
  for (const o of orders) grouped[bucket(o)].push(o)

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {COLUMNS.map((col) => {
        const items = grouped[col.key]
        const Icon = col.icon
        return (
          <div key={col.key} className="w-72 shrink-0">
            <div className={`flex items-center justify-between gap-2 px-4 py-3 rounded-2xl ${col.head} mb-3`}>
              <div className={`flex items-center gap-2 font-bold text-sm ${col.color}`}>
                <Icon className="w-4 h-4" />
                {col.label}
              </div>
              <span className={`text-xs font-bold ${col.color}`}>{items.length}</span>
            </div>

            <div className="space-y-3">
              {items.length === 0 && (
                <p className="text-xs text-gray-300 text-center py-6">Vazio</p>
              )}
              {items.map((o) => (
                <div key={o.id} className="bg-white rounded-2xl p-4 shadow-sm space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <User className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span className="text-sm font-bold text-gray-900 truncate">
                        {o.buyerName || 'Cliente'}
                      </span>
                    </div>
                    <LogisticBadge type={o.logisticType} />
                  </div>

                  {o.itemTitle && (
                    <div className="flex items-start gap-1.5">
                      <Package className="w-3.5 h-3.5 text-orange-400 shrink-0 mt-0.5" />
                      <span className="text-xs text-gray-600 leading-snug line-clamp-2">
                        {o.itemQuantity ? `${o.itemQuantity}x ` : ''}{o.itemTitle}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span className="text-[10px] font-semibold text-gray-500 uppercase truncate">
                      {SHIPPING_LABEL[(o.shippingStatus || '').toLowerCase()] || o.shippingStatus || '—'}
                    </span>
                    {o.trackingNumber && (
                      <span className="flex items-center gap-1 text-[10px] text-gray-400 shrink-0">
                        <MapPin className="w-3 h-3" />
                        {o.trackingNumber}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
