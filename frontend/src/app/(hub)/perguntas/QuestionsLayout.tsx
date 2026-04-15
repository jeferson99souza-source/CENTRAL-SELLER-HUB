'use client'

import { useState } from 'react'
import { HelpCircle, Clock, User, Package, Send, X, Trash2, UserX, Sparkles, Loader2 } from 'lucide-react'
import type { Question } from '@/lib/api'
import { answerQuestion, dismissQuestion, blockBuyer, aiSuggestQuestion } from '@/app/actions'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

type Props = { questions: Question[] }

export default function QuestionsLayout({ questions: initial }: Props) {
  const [questions, setQuestions] = useState(initial)
  const [replying, setReplying] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [loading, setLoading] = useState(false)
  const [aiLoading, setAiLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const removeQuestion = (id: string) =>
    setQuestions((prev) => prev.filter((q) => q.id !== id))

  const handleReply = async (questionId: string) => {
    if (!replyText.trim()) return
    setLoading(true)
    setError(null)
    const res = await answerQuestion(questionId, replyText.trim())
    setLoading(false)
    if ('error' in res && res.error) {
      setError(res.error)
    } else {
      removeQuestion(questionId)
      setReplying(null)
      setReplyText('')
    }
  }

  const handleDismiss = async (questionId: string) => {
    const res = await dismissQuestion(questionId)
    if (!('error' in res)) removeQuestion(questionId)
  }

  const handleBlockBuyer = async (questionId: string) => {
    if (!confirm('Bloquear este comprador no Mercado Livre? Ele não poderá mais fazer perguntas nos seus anúncios.')) return
    const res = await blockBuyer(questionId)
    if (!('error' in res)) removeQuestion(questionId)
  }

  const handleAiSuggest = async (questionId: string) => {
    setAiLoading(questionId)
    setError(null)
    const res = await aiSuggestQuestion(questionId)
    setAiLoading(null)
    if ('suggestion' in res) {
      setReplying(questionId)
      setReplyText(res.suggestion ?? '')
    } else {
      setError('error' in res ? res.error : 'Erro ao gerar sugestão')
    }
  }

  if (!questions.length) {
    return (
      <div className="text-center py-16 text-gray-400">
        <HelpCircle className="w-10 h-10 mx-auto mb-3 opacity-40" />
        <p className="text-sm">Nenhuma pergunta pendente nos anúncios</p>
      </div>
    )
  }

  return (
    <div className="space-y-3 pb-8">
      {questions.map((q) => (
        <div key={q.id} className="bg-white rounded-3xl p-5 shadow-sm">

          {/* Header */}
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="flex items-center gap-2 min-w-0">
              <User className="w-4 h-4 text-gray-400 shrink-0" />
              <span className="text-sm font-bold text-gray-900 truncate">
                {q.buyerName || 'Cliente'}
              </span>
            </div>
            <div className="flex items-center gap-1">
              {/* Bloquear comprador */}
              <button
                onClick={() => handleBlockBuyer(q.id)}
                title="Bloquear comprador"
                className="p-1.5 rounded-xl text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors"
              >
                <UserX className="w-3.5 h-3.5" />
              </button>
              {/* Dispensar pergunta */}
              <button
                onClick={() => handleDismiss(q.id)}
                title="Dispensar pergunta"
                className="p-1.5 rounded-xl text-gray-300 hover:text-gray-500 hover:bg-gray-100 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <span className="shrink-0 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-orange-100 text-orange-600 ml-1">
                Pendente
              </span>
            </div>
          </div>

          {q.itemTitle && (
            <div className="flex items-center gap-1.5 mb-2">
              <Package className="w-3.5 h-3.5 text-orange-400 shrink-0" />
              <span className="text-xs text-gray-500 font-medium truncate">{q.itemTitle}</span>
            </div>
          )}

          <div className="mt-2 bg-gray-50/50 rounded-2xl p-4 border border-gray-100">
            <p className="text-sm text-gray-800 italic">"{q.text}"</p>
          </div>

          {/* Form de resposta inline */}
          {replying === q.id ? (
            <div className="mt-3 space-y-2">
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Digite sua resposta..."
                rows={3}
                className="w-full text-sm px-4 py-3 rounded-2xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
                autoFocus
              />
              {error && <p className="text-xs text-red-500 px-1">{error}</p>}
              <div className="flex gap-2">
                <button
                  onClick={() => handleReply(q.id)}
                  disabled={loading || !replyText.trim()}
                  className="flex-1 flex items-center justify-center gap-2 bg-[#DE7100] text-white font-bold py-2.5 rounded-2xl text-sm disabled:opacity-60 hover:bg-orange-600 transition-colors"
                >
                  <Send className="w-4 h-4" />
                  {loading ? 'Enviando...' : 'Enviar Resposta'}
                </button>
                <button
                  onClick={() => { setReplying(null); setReplyText(''); setError(null) }}
                  className="px-4 py-2.5 rounded-2xl border border-gray-200 text-gray-500 hover:bg-gray-50"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
              <div className="flex items-center gap-1 text-xs text-gray-400">
                <Clock className="w-3.5 h-3.5" />
                <span>SLA: {formatDate(q.slaDeadline)}</span>
              </div>
              <div className="flex items-center gap-2">
                {/* Botão IA */}
                <button
                  onClick={() => handleAiSuggest(q.id)}
                  disabled={aiLoading === q.id}
                  className="flex items-center gap-1.5 text-xs font-semibold text-purple-600 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-full transition-colors disabled:opacity-60"
                >
                  {aiLoading === q.id
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <Sparkles className="w-3.5 h-3.5" />}
                  Sugerir com IA
                </button>
                <button
                  onClick={() => { setReplying(q.id); setReplyText(''); setError(null) }}
                  className="text-xs font-bold text-[#DE7100] hover:underline uppercase"
                >
                  Responder
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
