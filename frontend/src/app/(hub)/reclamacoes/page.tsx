import { Suspense } from 'react'
import { apiFetch, type Complaint } from '@/lib/api'
import { AlertCircle, Clock, User, Package } from 'lucide-react'

const STATUS_LABEL: Record<string, string> = {
  open: 'Aberta',
  pending: 'Pendente',
  closed: 'Encerrada',
}

const STATUS_COLOR: Record<string, string> = {
  open: 'bg-red-100 text-red-600',
  pending: 'bg-yellow-100 text-yellow-700',
  closed: 'bg-green-100 text-green-600',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

async function ComplaintsList() {
  const complaints = await apiFetch<Complaint[]>('/complaints')

  if (!complaints.length) {
    return (
      <div className="text-center py-16 text-gray-400">
        <AlertCircle className="w-10 h-10 mx-auto mb-3 opacity-40" />
        <p className="text-sm">Nenhuma reclamação encontrada</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {complaints.map((c) => (
        <div key={c.id} className="bg-white rounded-3xl p-5 shadow-sm space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{c.marketplace}</p>
              {c.buyerName && (
                <div className="flex items-center gap-1.5 mb-1">
                  <User className="w-3 h-3 text-gray-400 shrink-0" />
                  <span className="text-sm font-bold text-gray-900 truncate">{c.buyerName}</span>
                </div>
              )}
              {c.itemTitle && (
                <div className="flex items-center gap-1.5 mb-1">
                  <Package className="w-3 h-3 text-orange-400 shrink-0" />
                  <span className="text-xs text-gray-600 truncate">{c.itemTitle}</span>
                </div>
              )}
              <p className="text-sm text-gray-700 truncate">{c.reason}</p>
              <p className="text-xs text-gray-400 mt-0.5">ID: {c.externalId}</p>
            </div>
            <span className={`shrink-0 text-[10px] font-bold uppercase px-2.5 py-1 rounded-full ${STATUS_COLOR[c.status] ?? 'bg-gray-100 text-gray-500'}`}>
              {STATUS_LABEL[c.status] ?? c.status}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-400 border-t border-gray-50 pt-2">
            <Clock className="w-3.5 h-3.5" />
            <span>SLA: {formatDate(c.slaDeadline)}</span>
            <span className="mx-1">·</span>
            <span>Criada: {formatDate(c.createdAt)}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

function ListSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="bg-white rounded-3xl p-5 shadow-sm animate-pulse">
          <div className="h-4 bg-gray-100 rounded w-1/3 mb-2" />
          <div className="h-4 bg-gray-100 rounded w-2/3" />
        </div>
      ))}
    </div>
  )
}

export default function ReclamacoesPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Reclamações</h2>
        <p className="text-sm text-[#5B657A] mt-1">Mercado Livre</p>
      </div>
      <Suspense fallback={<ListSkeleton />}>
        <ComplaintsList />
      </Suspense>
    </div>
  )
}
