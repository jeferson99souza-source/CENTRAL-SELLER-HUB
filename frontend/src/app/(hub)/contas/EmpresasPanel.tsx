'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import { Building2, Plus, CheckCircle, XCircle, AlertCircle, X, Loader2, RefreshCw, ShoppingCart, Package } from 'lucide-react'
import { createCompany, getMLConnectUrl } from '@/app/actions'
import { type Company } from '@/lib/api'

type Props = {
  companies: Company[]
  mlConnected?: string
  mlError?: string
}

const ML_LOGO = (
  <span className="font-bold text-[11px] text-yellow-500 leading-none">ML</span>
)

function MarketplaceBadge({
  label,
  logo,
  account,
  onConnect,
  connecting,
  comingSoon,
}: {
  label: string
  logo: React.ReactNode
  account?: Company['marketplaceAccounts'][0]
  onConnect?: () => void
  connecting?: boolean
  comingSoon?: boolean
}) {
  const connected = !!account

  return (
    <div className={`flex flex-col gap-1.5 p-3 rounded-2xl border text-xs ${
      connected
        ? 'border-green-200 bg-green-50'
        : comingSoon
        ? 'border-gray-100 bg-gray-50'
        : 'border-orange-100 bg-orange-50'
    }`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-6 rounded-full bg-white border border-gray-100 flex items-center justify-center shadow-sm">
            {logo}
          </div>
          <span className="font-semibold text-gray-700">{label}</span>
        </div>
        {connected && <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0" />}
        {!connected && !comingSoon && <XCircle className="w-3.5 h-3.5 text-gray-300 shrink-0" />}
      </div>

      {connected && (
        <div className="pl-0.5">
          <p className="font-semibold text-gray-800 truncate">{account.sellerName}</p>
          {account.lastSyncAt && (
            <p className="text-gray-400 mt-0.5">
              Sync: {new Date(account.lastSyncAt).toLocaleDateString('pt-BR')}
            </p>
          )}
        </div>
      )}

      {!comingSoon && (
        <button
          onClick={onConnect}
          disabled={connecting}
          className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl text-[11px] font-semibold transition-colors ${
            connected
              ? 'bg-white border border-green-200 text-green-700 hover:bg-green-100'
              : 'bg-[#DE7100] text-white hover:bg-orange-600'
          } disabled:opacity-60`}
        >
          {connecting ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : connected ? (
            <><RefreshCw className="w-3 h-3" /> Reconectar</>
          ) : (
            <><Plus className="w-3 h-3" /> Conectar</>
          )}
        </button>
      )}

      {comingSoon && (
        <p className="text-gray-400 text-center font-medium py-0.5">Em breve</p>
      )}
    </div>
  )
}

function NovaEmpresaModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const formRef = useRef<HTMLFormElement>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const res = await createCompany(fd)
      if ('error' in res && res.error) {
        setError(res.error)
      } else {
        onCreated()
        onClose()
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4 bg-black/40">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-gray-900">Nova Empresa</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form ref={formRef} onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Nome da empresa *</label>
            <input
              name="name"
              required
              placeholder="Ex: Empresa Exemplo Ltda"
              className="w-full border border-gray-200 rounded-2xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-400"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">CNPJ *</label>
            <input
              name="cnpj"
              required
              placeholder="00.000.000/0001-00"
              className="w-full border border-gray-200 rounded-2xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-400"
            />
            <p className="text-[11px] text-gray-400 mt-1">Formato: 00.000.000/0000-00</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">E-mail</label>
            <input
              name="email"
              type="email"
              placeholder="contato@empresa.com"
              className="w-full border border-gray-200 rounded-2xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-400"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Telefone</label>
            <input
              name="phone"
              placeholder="(11) 99999-9999"
              className="w-full border border-gray-200 rounded-2xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-400"
            />
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="w-full bg-[#DE7100] text-white font-semibold py-3 rounded-2xl text-sm hover:bg-orange-600 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {isPending ? 'Salvando...' : 'Criar Empresa'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function EmpresasPanel({ companies: initial, mlConnected, mlError }: Props) {
  const [companies, setCompanies] = useState<Company[]>(initial)
  const [showModal, setShowModal] = useState(false)
  const [connectingId, setConnectingId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  useEffect(() => {
    if (mlConnected) {
      setToast({ type: 'success', message: `Mercado Livre conectado: ${mlConnected}` })
      // Remove query params from URL sem reload
      window.history.replaceState({}, '', '/contas')
    } else if (mlError) {
      setToast({ type: 'error', message: `Erro ao conectar ML: ${mlError}` })
      window.history.replaceState({}, '', '/contas')
    }
  }, [mlConnected, mlError])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 6000)
    return () => clearTimeout(t)
  }, [toast])

  async function handleConnectML(companyId: string) {
    setConnectingId(companyId)
    const res = await getMLConnectUrl(companyId)
    setConnectingId(null)
    if ('error' in res && res.error) {
      setToast({ type: 'error', message: res.error })
      return
    }
    if (res.authUrl) {
      window.location.href = res.authUrl
    }
  }

  async function refreshCompanies() {
    const res = await fetch('/api/companies-refresh').catch(() => null)
    // Reload page para buscar dados frescos
    window.location.reload()
  }

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 flex items-start gap-3 px-4 py-3 rounded-2xl shadow-lg max-w-sm text-sm font-medium transition-all ${
          toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.type === 'success'
            ? <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
            : <XCircle className="w-4 h-4 shrink-0 mt-0.5" />}
          <span>{toast.message}</span>
          <button onClick={() => setToast(null)} className="ml-2 opacity-70 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Empresas</h2>
          <p className="text-sm text-gray-400 mt-1">Gerencie seus CNPJs e conexões com marketplaces</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-[#DE7100] text-white font-semibold px-4 py-2.5 rounded-2xl text-sm hover:bg-orange-600 transition-colors shadow-md shadow-orange-200"
        >
          <Plus className="w-4 h-4" />
          Nova Empresa
        </button>
      </div>

      {/* Empty state */}
      {companies.length === 0 && (
        <div className="bg-white rounded-3xl p-10 shadow-sm flex flex-col items-center gap-4 text-center">
          <div className="w-14 h-14 rounded-full bg-orange-50 flex items-center justify-center">
            <Building2 className="w-7 h-7 text-[#DE7100]" />
          </div>
          <div>
            <p className="font-bold text-gray-800">Nenhuma empresa cadastrada</p>
            <p className="text-sm text-gray-400 mt-1">Crie uma empresa para começar a conectar seus marketplaces</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-[#DE7100] text-white font-semibold px-5 py-2.5 rounded-2xl text-sm hover:bg-orange-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Criar primeira empresa
          </button>
        </div>
      )}

      {/* Company cards */}
      <div className="space-y-4">
        {companies.map((company) => {
          const mlAccount = company.marketplaceAccounts?.find((a) => a.marketplace === 'mercadolivre' && a.isActive)
          const shopeeAccount = company.marketplaceAccounts?.find((a) => a.marketplace === 'shopee' && a.isActive)
          const amazonAccount = company.marketplaceAccounts?.find((a) => a.marketplace === 'amazon' && a.isActive)

          return (
            <div key={company.id} className="bg-white rounded-3xl shadow-sm p-6 space-y-4">
              {/* Company header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-orange-50 flex items-center justify-center shrink-0">
                    <Building2 className="w-5 h-5 text-[#DE7100]" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-base">{company.name}</h3>
                    <p className="text-xs text-gray-400 font-mono mt-0.5">{company.cnpj}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  {company.marketplaceAccounts?.filter((a) => a.isActive).length ?? 0} conectado(s)
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-gray-50" />

              {/* Marketplaces */}
              <div className="grid grid-cols-3 gap-3">
                <MarketplaceBadge
                  label="Mercado Livre"
                  logo={ML_LOGO}
                  account={mlAccount}
                  connecting={connectingId === company.id + '_ml'}
                  onConnect={() => {
                    setConnectingId(company.id + '_ml')
                    handleConnectML(company.id)
                  }}
                />
                <MarketplaceBadge
                  label="Shopee"
                  logo={<ShoppingCart className="w-3.5 h-3.5 text-orange-500" />}
                  account={shopeeAccount}
                  comingSoon
                />
                <MarketplaceBadge
                  label="Amazon"
                  logo={<Package className="w-3.5 h-3.5 text-blue-500" />}
                  account={amazonAccount}
                  comingSoon
                />
              </div>

              {/* Info extra */}
              {(company.email || company.phone) && (
                <div className="flex gap-4 text-xs text-gray-400 pt-1">
                  {company.email && <span>{company.email}</span>}
                  {company.phone && <span>{company.phone}</span>}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Modal nova empresa */}
      {showModal && (
        <NovaEmpresaModal
          onClose={() => setShowModal(false)}
          onCreated={() => window.location.reload()}
        />
      )}
    </div>
  )
}
