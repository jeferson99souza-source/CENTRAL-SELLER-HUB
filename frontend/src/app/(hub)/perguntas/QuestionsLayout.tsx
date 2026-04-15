'use client'

import { HelpCircle, Clock, User, Package } from 'lucide-react'
import type { Question } from '@/lib/api'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

type Props = { questions: Question[] }

export default function QuestionsLayout({ questions }: Props) {
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
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="flex items-center gap-2 min-w-0">
              <User className="w-4 h-4 text-gray-400 shrink-0" />
              <span className="text-sm font-bold text-gray-900 truncate">
                {q.buyerName || 'Cliente'}
              </span>
            </div>
            <span className="shrink-0 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-orange-100 text-orange-600">
              Pendente
            </span>
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

          <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <Clock className="w-3.5 h-3.5" />
              <span>SLA Resposta: {formatDate(q.slaDeadline)}</span>
            </div>
            <button className="text-xs font-bold text-[#DE7100] hover:underline uppercase">
              Responder
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
