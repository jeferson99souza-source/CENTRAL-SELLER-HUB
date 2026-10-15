'use client'

import { useState } from 'react'
import { HelpCircle, Clock, User, Package, Send, X, Trash2, UserX, Sparkles, Loader2 } from 'lucide-react'
import type { Question } from '@/lib/api'
import { answerQuestion, dismissQuestion, blockBuyer, aiSuggestQuestion, bulkDeleteOldQuestions } from '@/app/actions'
import {
  MarketplaceTag,
  MarketplaceFilter,
  useMarketplaceFilter,
} from '@/components/marketplace'

/** Corte do robô de exclusão: perguntas recebidas antes desta data */
const CUTOFF_ROBO = '2026-10-01'

/** Traduz os erros do Mercado Livre ao responder uma pergunta */
function friendlyError(raw: string): string {
  const r = (raw || '').toLowerCase()
  if (r.includes('not_active_item') || r.includes('item must be active'))
    return 'O anúncio está pausado ou encerrado — o Mercado Livre não permite responder perguntas dele. Reative o anúncio para responder, ou apague a pergunta.'
  if (r.includes('question_not_found') || r.includes('not_found'))
    return 'Esta pergunta não existe mais no Mercado Livre (já foi respondida ou excluída).'
  if (r.includes('already_answered') || r.includes('answered'))
    return 'Esta pergunta já foi respondida no Mercado Livre.'
  if (r.includes('expirou'))
    return 'Sua conexão com o Mercado Livre expirou. Vá em Contas e clique em "Reconectar".'
  if (r.includes('forbidden') || r.includes('403'))
    return 'O Mercado Livre não permitiu responder esta pergunta (403).'
  if (r.includes('blocked'))
    return 'O Mercado Livre bloqueou a resposta para esta pergunta.'
  return raw
}

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
  const [roboStatus, setRoboStatus] = useState<string | null>(null)
  const {
    filtro,
    setFiltro,
    disponiveis,
    filtrados: visiveis,
    contagem,
  } = useMarketplaceFilter(questions)

  const removeQuestion = (id: string) =>
    setQuestions((prev) => prev.filter((q) => q.id !== id))

  const handleReply = async (questionId: string) => {
    if (!replyText.trim()) return
    setLoading(true)
    setError(null)
    const res = await answerQuestion(questionId, replyText.trim())
    setLoading(false)
    if ('error' in res && res.error) {
      setError(friendlyError(res.error))
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

  async function handleRoboApagar() {
    setRoboStatus('Contando...')
    try {
      // 1) Prévia
      const preview = await bulkDeleteOldQuestions(CUTOFF_ROBO, false)
      if ('error' in preview && preview.error) {
        setRoboStatus(null)
        alert(preview.error)
        return
      }
      const total = 'total' in preview ? preview.total : 0
      if (!total) {
        setRoboStatus(null)
        alert('Não há perguntas anteriores a 01/10/2026 para apagar.')
        return
      }

      // 2) Confirmação dupla (ação irreversível e visível ao comprador)
      const ok = confirm(
        `APAGAR ${total} pergunta(s) NO MERCADO LIVRE?\n\n` +
          '• São perguntas recebidas antes de 01/10/2026\n' +
          '• Elas somem também para o comprador\n' +
          '• Esta ação NÃO pode ser desfeita\n\n' +
          'As perguntas recentes NÃO serão tocadas.',
      )
      if (!ok) {
        setRoboStatus(null)
        return
      }

      // 3) Processa em lotes até acabar
      let apagadas = 0
      let falhas = 0
      let restantes = total
      while (restantes > 0) {
        setRoboStatus(`Apagando... ${apagadas}/${total}`)
        const res = await bulkDeleteOldQuestions(CUTOFF_ROBO, true)
        if ('error' in res && res.error) {
          alert(`Parou com erro: ${res.error}\nApagadas até aqui: ${apagadas}`)
          break
        }
        const feitas = 'deleted' in res ? (res.deleted ?? 0) : 0
        apagadas += feitas
        falhas += 'failed' in res ? (res.failed ?? 0) : 0
        restantes = 'remaining' in res ? (res.remaining ?? 0) : 0
        if (feitas === 0) break // nada avançou — evita loop infinito
      }

      setRoboStatus(null)
      alert(
        `Robô concluído.\nApagadas: ${apagadas}\nFalhas: ${falhas}`,
      )
      window.location.reload()
    } catch {
      setRoboStatus(null)
      alert('Erro ao executar o robô.')
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
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <MarketplaceFilter
          filtro={filtro}
          setFiltro={setFiltro}
          disponiveis={disponiveis}
          contagem={contagem}
        />
        <button
          onClick={handleRoboApagar}
          disabled={!!roboStatus}
          className="ml-auto flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-red-600 transition-colors px-3 py-1.5 rounded-full bg-white border border-gray-100 shadow-sm disabled:opacity-60"
          title="Apaga NO MERCADO LIVRE as perguntas recebidas antes de 01/10/2026"
        >
          {roboStatus ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Trash2 className="w-3.5 h-3.5" />
          )}
          {roboStatus ?? 'Apagar perguntas antigas no ML'}
        </button>
      </div>

      {!visiveis.length && (
        <p className="text-sm text-gray-400 text-center py-10">
          Nenhuma pergunta deste marketplace.
        </p>
      )}

      {visiveis.map((q) => (
        <div key={q.id} className="bg-white rounded-3xl p-5 shadow-sm">

          {/* Header */}
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="flex items-center gap-2 min-w-0">
              <User className="w-4 h-4 text-gray-400 shrink-0" />
              <span className="text-sm font-bold text-gray-900 truncate">
                {q.buyerName || 'Cliente'}
              </span>
              <MarketplaceTag marketplace={q.marketplace} />
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
