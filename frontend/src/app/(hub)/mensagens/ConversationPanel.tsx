'use client'

import { useState, useEffect, useRef } from 'react'
import { Send, ShoppingBag, X } from 'lucide-react'
import type { Message } from '@/lib/api'

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
      setError(body?.message ?? 'Erro ao enviar mensagem.')
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
          <p className="font-bold text-gray-900 truncate">{selected.buyerName || 'Cliente'}</p>
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

      {/* Reply input */}
      {selected.status !== 'replied' && (
        <div className="px-4 py-3 border-t border-gray-100 bg-white space-y-2">
          {error && <p className="text-xs text-red-500">{error}</p>}
          {success && <p className="text-xs text-green-600">Mensagem enviada com sucesso!</p>}
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
      )}
    </div>
  )
}
