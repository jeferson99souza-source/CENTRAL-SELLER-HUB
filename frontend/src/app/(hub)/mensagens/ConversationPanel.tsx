'use client'

import { useState, useEffect, useRef } from 'react'
import { Send, ShoppingBag, X, Truck } from 'lucide-react'
import type { Message } from '@/lib/api'
import { LogisticBadge } from './MessagesLayout'

const SHIPPING_MAP: Record<string, { label: string; color: string }> = {
  handling:       { label: '📦 Preparando',   color: 'bg-gray-100 text-gray-600' },
  ready_to_ship:  { label: '⚡ Enviar hoje',   color: 'bg-yellow-100 text-yellow-700' },
  shipped:        { label: '🚚 Enviado',       color: 'bg-blue-100 text-blue-700' },
  delivered:      { label: '✅ Entregue',      color: 'bg-green-100 text-green-700' },
  not_delivered:  { label: '❌ Não entregue', color: 'bg-red-100 text-red-600' },
  returning:      { label: '↩️ Devolvendo',    color: 'bg-purple-100 text-purple-600' },
  returned:       { label: '↩️ Devolvido',     color: 'bg-purple-100 text-purple-600' },
  cancelled:      { label: '🚫 Cancelado',    color: 'bg-red-100 text-red-500' },
}

function ShippingBadge({ status }: { status: string }) {
  const info = SHIPPING_MAP[status]
  if (!info) return <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 flex items-center gap-1"><Truck className="w-3 h-3" />{status}</span>
  return <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${info.color}`}>{info.label}</span>
}

type Props = {
  selected: Message
  onClose: () => void
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function formatDay(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

export default function ConversationPanel({ selected, onClose }: Props) {
  const [thread, setThread] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setLoading(true)
    setThread([])
    setError('')
    setSuccess(false)

    fetch(`/api/thread/${selected.packId}`)
      .then((r) => r.json())
      .then((data) => setThread(Array.isArray(data) ? data : [selected]))
      .catch(() => setThread([selected]))
      .finally(() => setLoading(false))
  }, [selected.packId, selected])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [thread])

  async function handleSend() {
    if (!text.trim()) return
    setSending(true)
    setError('')
    setSuccess(false)

    const res = await fetch(`/api/reply/${selected.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text.trim() }),
    })

    setSending(false)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      // body.error é {code, message, details, path, timestamp} — extrair mensagem legível
      const errObj = body?.error
      const errMsg: string =
        errObj?.details?.message   // detalhe do ML (ex: "ML 403: …")
        ?? errObj?.message         // mensagem principal
        ?? body?.message           // fallback NestJS padrão
        ?? `Erro ${res.status}`
      setError(String(errMsg))
    } else {
      setSuccess(true)
      setText('')
      // Recarrega o thread
      fetch(`/api/thread/${selected.packId}`)
        .then((r) => r.json())
        .then((data) => setThread(Array.isArray(data) ? data : thread))
        .catch(() => {})
    }
  }

  return (
    <div className="flex flex-col h-full bg-white rounded-3xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-bold text-gray-900 truncate">{selected.buyerName || 'Cliente'}</p>
            <LogisticBadge logisticType={selected.logisticType} />
            {selected.shippingStatus && (
              <ShippingBadge status={selected.shippingStatus} />
            )}
          </div>
          {selected.itemTitle && (
            <div className="flex items-center gap-1.5 mt-1">
              <ShoppingBag className="w-3.5 h-3.5 text-orange-400 shrink-0" />
              <p className="text-xs text-gray-500 truncate">{selected.itemTitle}</p>
            </div>
          )}
          <p className="text-xs text-gray-400 mt-0.5">Pedido #{selected.orderId}</p>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-gray-100 transition-colors shrink-0">
          <X className="w-5 h-5 text-gray-400" />
        </button>
      </div>

      {/* Thread */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-[#F8F9FA]">
        {loading && (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {!loading && thread.map((msg) => {
          const isVendedor = msg.sender === 'vendedor'
          return (
            <div key={msg.id} className={`flex ${isVendedor ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[78%] rounded-2xl px-4 py-2.5 ${isVendedor ? 'bg-[#DE7100] text-white' : 'bg-white text-gray-800 shadow-sm'}`}>
                {msg.content
                  ? <p className="text-sm leading-relaxed">{msg.content}</p>
                  : <p className={`text-sm italic ${isVendedor ? 'opacity-75' : 'text-gray-400'}`}>Notificação sem texto</p>
                }
                <p className={`text-[10px] mt-1 text-right ${isVendedor ? 'opacity-70' : 'text-gray-400'}`}>
                  {formatDay(msg.createdAt)} {formatTime(msg.createdAt)}
                </p>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Reply input — sempre visível */}
      <div className="px-4 py-3 border-t border-gray-100 bg-white space-y-2">
        {error && <p className="text-xs text-red-500 px-1">{error}</p>}
        {success && <p className="text-xs text-green-600 px-1">Mensagem enviada!</p>}
        <div className="flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Digite sua resposta..."
            className="flex-1 text-sm px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
          <button
            onClick={handleSend}
            disabled={sending || !text.trim()}
            className="bg-[#DE7100] text-white px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-1.5 hover:bg-orange-600 transition-colors disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            {sending ? '...' : 'Enviar'}
          </button>
        </div>
      </div>
    </div>
  )
}
