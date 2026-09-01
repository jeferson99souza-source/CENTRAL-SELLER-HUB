'use client'

import { useState } from 'react'
import { Truck, Package, User, MapPin, Send, CheckCircle, RotateCcw, AlertTriangle, Clock, ChevronLeft, ChevronRight, Eye, EyeOff, Undo2 } from 'lucide-react'
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

type ColumnKey =
  | 'a_enviar'
  | 'transito'
  | 'entregue'
  | 'nao_entregue'
  | 'reclamacao'
  | 'nao_devolvido'

const COLUMNS: {
  key: ColumnKey
  label: string
  icon: typeof Package
  color: string
  head: string
}[] = [
  { key: 'a_enviar',      label: 'A enviar',      icon: Package,       color: 'text-gray-600',   head: 'bg-gray-100' },
  { key: 'transito',      label: 'Em trânsito',   icon: Send,          color: 'text-blue-600',   head: 'bg-blue-50' },
  { key: 'entregue',      label: 'Entregue',      icon: CheckCircle,   color: 'text-green-600',  head: 'bg-green-50' },
  { key: 'nao_entregue',  label: 'Não entregue',  icon: RotateCcw,     color: 'text-purple-600', head: 'bg-purple-50' },
  { key: 'reclamacao',    label: 'Reclamações',   icon: Undo2,         color: 'text-pink-600',   head: 'bg-pink-50' },
  { key: 'nao_devolvido', label: 'Não devolvido', icon: AlertTriangle, color: 'text-red-600',    head: 'bg-red-50' },
]

// Devolvido (chegou de volta) ou ainda a caminho?
function returnStatus(o: Order): 'devolvido' | 'a_caminho' {
  const rs = (o.returnStatus || '').toLowerCase()
  const s = (o.shippingStatus || '').toLowerCase()
  const sub = (o.shippingSubstatus || '').toLowerCase()
  if (
    o.returnedAt || rs === 'delivered' || rs === 'returned' ||
    s === 'returned' || sub.includes('returned')
  )
    return 'devolvido'
  return 'a_caminho'
}

function daysSince(iso: string | null): number | null {
  if (!iso) return null
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
}

function ReturnTag({ order }: { order: Order }) {
  const st = returnStatus(order)
  if (st === 'devolvido') {
    return (
      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-600 text-white">
        Devolvido
      </span>
    )
  }
  return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500 text-white">
      Devolução a caminho
    </span>
  )
}

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

  // Devolução aberta pelo comprador (reclamação/claim)
  const isClaimReturn = !!o.returnStartedAt || !!o.returnStatus || !!o.returnedAt
  // Envio que voltou pela transportadora (auto-retorno)
  const carrierReturn =
    s === 'not_delivered' || s === 'returning' || s === 'returned' ||
    sub.includes('return') || sub.includes('not_delivered')

  if (isClaimReturn) {
    if (returnStatus(o) === 'devolvido') return 'reclamacao' // com tag Devolvido
    const d = daysSince(o.returnStartedAt)
    if (d !== null && d > 7) return 'nao_devolvido'
    return 'reclamacao'
  }

  if (carrierReturn) {
    if (returnStatus(o) === 'devolvido') return 'nao_entregue'
    const d = daysSince(o.notDeliveredAt)
    if (d !== null && d > 7) return 'nao_devolvido'
    return 'nao_entregue'
  }

  if (s === 'delivered') return 'entregue'
  if (s === 'shipped') return 'transito'
  return 'a_enviar' // pending, handling, ready_to_ship, cancelled, sem info
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
    nao_entregue: 1,
    reclamacao: 1,
    nao_devolvido: 1,
  })
  const [showTitle, setShowTitle] = useState(true)

  if (!orders.length) {
    return (
      <div className="text-center py-16 text-gray-400">
        <Truck className="w-10 h-10 mx-auto mb-3 opacity-40" />
        <p className="text-sm">Nenhum envio encontrado</p>
        <p className="text-xs mt-1 opacity-60">Clique em &quot;Puxar Dados do ML&quot; no Dashboard</p>
      </div>
    )
  }

  // Mostra os últimos 30 dias (mais os que ainda estão em fluxo de devolução)
  const cutoff = Date.now() - 30 * 86400000
  const visible = orders.filter((o) => {
    const d = o.orderDate ? new Date(o.orderDate).getTime() : 0
    if (d >= cutoff) return true
    // sempre mantém quem está em devolução, mesmo mais antigo
    const s = (o.shippingStatus || '').toLowerCase()
    const sub = (o.shippingSubstatus || '').toLowerCase()
    return (
      !!o.returnStartedAt || !!o.returnStatus || !!o.returnedAt ||
      s === 'not_delivered' || s === 'returning' || s === 'returned' ||
      sub.includes('return')
    )
  })

  const grouped: Record<ColumnKey, Order[]> = {
    a_enviar: [],
    transito: [],
    entregue: [],
    nao_entregue: [],
    reclamacao: [],
    nao_devolvido: [],
  }
  for (const o of visible) grouped[bucket(o)].push(o)

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button
          onClick={() => setShowTitle((v) => !v)}
          className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-[#DE7100] transition-colors px-3 py-1.5 rounded-full bg-white border border-gray-100 shadow-sm"
        >
          {showTitle ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          {showTitle ? 'Ocultar produto' : 'Mostrar produto'}
        </button>
      </div>

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

                  {showTitle && o.itemTitle && (
                    <div className="flex items-start gap-1.5">
                      <Package className="w-3.5 h-3.5 text-orange-400 shrink-0 mt-0.5" />
                      <span className="text-xs text-gray-600 leading-snug line-clamp-2">
                        {o.itemQuantity ? `${o.itemQuantity}x ` : ''}{o.itemTitle}
                      </span>
                    </div>
                  )}
                  {!showTitle && o.itemTitle && (
                    <div className="flex items-center gap-1.5">
                      <Package className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                      <span className="text-xs text-gray-400 italic">
                        {o.itemQuantity ? `${o.itemQuantity}x ` : ''}produto oculto
                      </span>
                    </div>
                  )}

                  {(col.key === 'nao_entregue' || col.key === 'reclamacao' || col.key === 'nao_devolvido') && (
                    <div className="flex items-center justify-between gap-2">
                      <ReturnTag order={o} />
                      {(daysSince(o.returnStartedAt) ?? daysSince(o.notDeliveredAt)) !== null && (
                        <span className="flex items-center gap-1 text-[10px] text-gray-400 shrink-0">
                          <Clock className="w-3 h-3" />
                          {daysSince(o.returnStartedAt) ?? daysSince(o.notDeliveredAt)}d
                        </span>
                      )}
                    </div>
                  )}
                  {col.key === 'nao_devolvido' && (
                    <p className="text-[10px] text-red-500 font-medium leading-snug">
                      +7 dias sem devolução — abra um chamado no ML
                    </p>
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
    </div>
  )
}
