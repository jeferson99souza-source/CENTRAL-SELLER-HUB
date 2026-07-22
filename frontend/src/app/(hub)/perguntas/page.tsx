import { Suspense } from 'react'
import { apiFetch, type Question } from '@/lib/api'
import QuestionsLayout from './QuestionsLayout'

async function QuestionsData() {
  try {
    const result = await apiFetch<unknown>('/questions?status=unanswered')
    const questions: Question[] = Array.isArray(result) ? result : []
    return <QuestionsLayout questions={questions} />
  } catch {
    return <QuestionsLayout questions={[]} />
  }
}

function Skeleton() {
  return (
    <div className="space-y-3">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="bg-white rounded-3xl p-5 shadow-sm animate-pulse">
          <div className="h-4 bg-gray-100 rounded w-1/4 mb-2" />
          <div className="h-3 bg-gray-100 rounded w-1/2 mb-2" />
          <div className="h-4 bg-gray-100 rounded w-3/4" />
        </div>
      ))}
    </div>
  )
}

export const dynamic = 'force-dynamic'

export default function PerguntasPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Perguntas</h2>
        <p className="text-sm text-[#5B657A] mt-1">Dúvidas pendentes nos seus anúncios</p>
      </div>
      <Suspense fallback={<Skeleton />}>
        <QuestionsData />
      </Suspense>
    </div>
  )
}
