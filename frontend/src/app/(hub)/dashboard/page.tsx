import { Suspense } from 'react'
import Link from 'next/link'
import { apiFetch, type KPIs } from '@/lib/api'
import { AlertCircle, MessageSquare, ShoppingBag, Clock } from 'lucide-react'
import SyncButton from './SyncButton'
import DiagnoseButton from './DiagnoseButton'

async function KPICards() {
  const kpis = await apiFetch<KPIs>('/dashboard/kpis?period=30d')
  const ml = kpis.byMarketplace.find((m) => m.marketplace === 'mercadolivre')

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <Link href="/mensagens" className="bg-[#DE7100] rounded-3xl p-5 text-white shadow-md shadow-orange-500/20 hover:brightness-110 transition-all">
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare className="w-5 h-5 opacity-80" />
            <span className="text-xs font-semibold opacity-90 uppercase tracking-wider">Mensagens</span>
          </div>
          <p className="text-4xl font-bold leading-none">{kpis.totalMessages}</p>
          <p className="text-xs opacity-75 mt-1">Últimos 30 dias</p>
        </Link>

        <Link href="/reclamacoes" className="bg-white rounded-3xl p-5 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Reclamações</span>
          </div>
          <p className="text-4xl font-bold text-gray-900 leading-none">{kpis.totalComplaints}</p>
          <p className="text-xs text-gray-400 mt-1">Últimos 30 dias</p>
        </Link>

        <Link href="/reclamacoes?status=open" className="bg-white rounded-3xl p-5 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-5 h-5 text-red-400" />
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">SLA Vencido</span>
          </div>
          <p className="text-4xl font-bold text-red-500 leading-none">{kpis.complaintsSlaBreached}</p>
          <p className="text-xs text-gray-400 mt-1">Requer atenção</p>
        </Link>

        <Link href="/reclamacoes" className="bg-white rounded-3xl p-5 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center gap-2 mb-2">
            <ShoppingBag className="w-5 h-5 text-orange-400" />
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">ML Total</span>
          </div>
          <p className="text-4xl font-bold text-gray-900 leading-none">
            {(ml?.messages ?? 0) + (ml?.complaints ?? 0)}
          </p>
          <p className="text-xs text-gray-400 mt-1">Msgs + Reclam.</p>
        </Link>
      </div>

      <div className="bg-white rounded-3xl p-5 shadow-sm">
        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">Por Marketplace</h3>
        <div className="space-y-3">
          {kpis.byMarketplace.map((m) => (
            <div key={m.marketplace} className="flex items-center justify-between">
              <span className="text-sm font-semibold capitalize text-gray-700">{m.marketplace}</span>
              <div className="flex gap-4 text-sm text-gray-500">
                <span>{m.messages} msgs</span>
                <span>{m.complaints} reclam.</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function KPISkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="bg-white rounded-3xl p-5 shadow-sm animate-pulse">
          <div className="h-4 bg-gray-100 rounded w-2/3 mb-3" />
          <div className="h-10 bg-gray-100 rounded w-1/2" />
        </div>
      ))}
    </div>
  )
}

export const dynamic = 'force-dynamic'

export default function DashboardPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
          <p className="text-sm text-[#5B657A] mt-1">Resumo dos últimos 30 dias</p>
        </div>
        <div className="flex items-center gap-2">
          <DiagnoseButton />
          <SyncButton />
        </div>
      </div>
      <Suspense fallback={<KPISkeleton />}>
        <KPICards />
      </Suspense>
    </div>
  )
}
