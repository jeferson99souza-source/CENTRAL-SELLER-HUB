import { Suspense } from 'react'
import { apiFetch, type Message } from '@/lib/api'
import MessagesLayout from './MessagesLayout'

async function MessagesData() {
  try {
    const result = await apiFetch<unknown>('/messaging/all')
    const messages: Message[] = Array.isArray(result) ? result : []
    return <MessagesLayout messages={messages} />
  } catch {
    return <MessagesLayout messages={[]} />
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

export default function MensagensPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Mensagens</h2>
        <p className="text-sm text-[#5B657A] mt-1">Pós-venda — pendentes primeiro</p>
      </div>
      <Suspense fallback={<Skeleton />}>
        <MessagesData />
      </Suspense>
    </div>
  )
}
