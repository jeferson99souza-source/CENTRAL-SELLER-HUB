'use client'

import { useState } from 'react'
import { MessageSquare, Clock, User, Package } from 'lucide-react'
import type { Message } from '@/lib/api'
import ConversationPanel from './ConversationPanel'

const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-orange-100 text-orange-600',
  read: 'bg-blue-100 text-blue-600',
  replied: 'bg-green-100 text-green-600',
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendente',
  read: 'Lida',
  replied: 'Respondida',
}

// Mapeamento de status de envio do ML → label + cor
const SHIPPING_MAP: Record<string, { label: string; color: string }> = {
  handling:       { label: '📦 Preparando',     color: 'bg-gray-100 text-gray-600' },
  ready_to_ship:  { label: '⚡ Enviar hoje',     color: 'bg-yellow-100 text-yellow-700' },
  shipped:        { label: '🚚 Enviado',         color: 'bg-blue-100 text-blue-600' },
  delivered:      { label: '✅ Entregue',        color: 'bg-green-100 text-green-700' },
  not_delivered:  { label: '❌ Não entregue',   color: 'bg-red-100 text-red-600' },
  returning:      { label: '↩️ Devolvendo',      color: 'bg-purple-100 text-purple-600' },
  returned:       { label: '↩️ Devolvido',       color: 'bg-purple-100 text-purple-600' },
  cancelled:      { label: '🚫 Cancelado',      color: 'bg-red-100 text-red-500' },
}

function ShippingBadge({ shippingStatus }: { shippingStatus: string | null }) {
  if (!shippingStatus) return null
  const info = SHIPPING_MAP[shippingStatus]
  if (!info) return null
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${info.color}`}>
      {info.label}
    </span>
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

type Props = { messages: Message[] }

export default function MessagesLayout({ messages }: Props) {
  const [selected, setSelected] = useState<Message | null>(null)

  if (!messages.length) {
    return (
      <div className="text-center py-16 text-gray-400">
        <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-40" />
        <p className="text-sm">Nenhuma mensagem encontrada</p>
        <p className="text-xs mt-1 opacity-60">Sincronize para puxar as mensagens do Mercado Livre</p>
      </div>
    )
  }

  return (
    <div className={`flex gap-4 ${selected ? 'h-[calc(100vh-180px)]' : ''}`}>
      {/* Lista */}
      <div className={`space-y-3 ${selected ? 'w-80 shrink-0 overflow-y-auto' : 'w-full'}`}>
        {messages.map((m) => (
          <button
            key={m.id}
            onClick={() => setSelected(m)}
            className={`w-full text-left bg-white rounded-3xl p-4 shadow-sm transition-all hover:shadow-md ${selected?.id === m.id ? 'ring-2 ring-[#DE7100]' : ''}`}
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 min-w-0 flex-wrap">
                <User className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <span className="text-sm font-bold text-gray-900 truncate">
                  {m.buyerName || 'Cliente'}
                </span>
                <ShippingBadge shippingStatus={m.shippingStatus} />
              </div>
              <span className={`shrink-0 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${STATUS_COLOR[m.status]}`}>
                {STATUS_LABEL[m.status]}
              </span>
            </div>

            {m.itemTitle && (
              <div className="flex items-center gap-1.5 mb-1.5">
                <Package className="w-3 h-3 text-orange-400 shrink-0" />
                <span className="text-xs text-gray-500 truncate">{m.itemTitle}</span>
              </div>
            )}

            <p className="text-xs text-gray-500 truncate mb-2">
              {m.content || <span className="italic text-gray-400">Notificação sem texto</span>}
            </p>

            <div className="flex items-center gap-1 text-[10px] text-gray-400">
              <Clock className="w-3 h-3" />
              <span>SLA: {formatDate(m.slaDeadline)}</span>
            </div>
          </button>
        ))}
      </div>

      {/* Painel de conversa */}
      {selected && (
        <div className="flex-1 min-w-0">
          <ConversationPanel
            selected={selected}
            onClose={() => setSelected(null)}
          />
        </div>
      )}
    </div>
  )
}
