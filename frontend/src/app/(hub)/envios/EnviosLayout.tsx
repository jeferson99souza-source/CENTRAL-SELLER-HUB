'use client'

import { useState } from 'react'
import { Truck, Package, User, MapPin, Send, CheckCircle, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react'
import type { Order } from '@/lib/api'

const PAGE_SIZE = 12

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

function Pager({
  page,
  total,
  onChange,
  color,
}: {
  page: number
  total: number
  onChange: (p: number) => void
  color: string
}) {
  if (total <= 1) return null
  // Janela de páginas ao redor da atual
  const nums: number[] = []
  const start = Math.max(1, page - 1)
  const end = Math.min(total, start + 2)
  for (let i = start; i <= end; i++) nums.push(i)

  return (
    <div className="flex items-center justify-center gap-1 pt-3">
      <button
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      {start > 1 && (
        <>
          <button onClick={() => onChange(1)} className="text-xs w-6 h-6 rounded-lg text-gray-500 hover:bg-gray-100">1</button>
          {start > 2 && <span className="text-xs text-gray-300">…</span>}
        </>
      )}
      {nums.map((n) => (
        <button
          key={n}
          onClick={() => onChange(n)}
          className={`text-xs w-6 h-6 rounded-lg font-semibold ${n === page ? `${color} bg-gray-100` : 'text-gray-500 hover:bg-gray-100'}`}
        >
          {n}
        </button>
      ))}
      {end < total && (
        <>
          {end < total - 1 && <span className="text-xs text-gray-300">…</span>}
          <button onClick={() => onChange(total)} className="text-xs w-6 h-6 rounded-lg text-gray-500 hover:bg-gray-100">{total}</button>
        </>
      )}
      <button
        onClick={() => onChange(page + 1)}
        disabled={page >= total}
        className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  )
}

export default function EnviosLayout({ orders }: { orders: Order[] }) {
  const [pages, setPages] = useState<Record<ColumnKey, number>>({
    a_enviar: 1,
    transito: 1,
    entregue: 1,
    devolucao: 1,
  })

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
        const all = grouped[col.key]
        const totalPages = Math.max(1, Math.ceil(all.length / PAGE_SIZE))
        const page = Math.min(pages[col.key], totalPages)
        const items = all.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
        const Icon = col.icon
        return (
          <div key={col.key} className="w-72 shrink-0">
            <div className={`flex items-center justify-between gap-2 px-4 py-3 rounded-2xl ${col.head} mb-3`}>
              <div className={`flex items-center gap-2 font-bold text-sm ${col.color}`}>
                <Icon className="w-4 h-4" />
                {col.label}
              </div>
              <span className={`text-xs font-bold ${col.color}`}>{all.length}</span>
            </div>

            <div className="space-y-3">
              {all.length === 0 && (
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

            <Pager
              page={page}
              total={totalPages}
              color={col.color}
              onChange={(p) => setPages((prev) => ({ ...prev, [col.key]: p }))}
            />
          </div>
        )
      })}
    </div>
  )
}
