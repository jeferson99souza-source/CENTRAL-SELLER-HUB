'use client'

import { useState } from 'react'
import { Stethoscope, X, CheckCircle, XCircle, AlertTriangle } from 'lucide-react'
import { diagnoseML } from '@/app/actions'

type DiagnoseResult = {
  ok: boolean
  message?: string
  totalAccounts?: number
  tip?: string
  accounts?: {
    accountId: string
    sellerId: string
    sellerName: string
    tokenExpired: boolean
    minutesUntilExpiry: number | null
    lastSyncAt: string | null
    tokenTest: { ok: boolean; nickname?: string; sellerId?: string; error?: string }
    unread?: { count: number | null; raw?: string }
    claims?: { count: number | null; raw?: string }
  }[]
}

export default function DiagnoseButton() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<DiagnoseResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  const handleDiagnose = async () => {
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await diagnoseML()
      if ('error' in res && res.error) {
        setError(res.error)
      } else if ('data' in res) {
        setResult(res.data as DiagnoseResult)
      }
    } catch (e) {
      setError('Erro ao executar diagnóstico')
    } finally {
      setLoading(false)
      setOpen(true)
    }
  }

  return (
    <>
      <button
        onClick={handleDiagnose}
        disabled={loading}
        className="flex items-center gap-1.5 bg-white border border-gray-200 text-gray-600 px-3 py-2 rounded-full text-sm font-medium shadow-sm transition-all hover:border-orange-300 hover:text-orange-600 disabled:opacity-60"
      >
        <Stethoscope className={`w-4 h-4 ${loading ? 'animate-pulse' : ''}`} />
        {loading ? 'Verificando...' : 'Diagnosticar ML'}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4 bg-black/40">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Stethoscope className="w-5 h-5 text-orange-500" />
                Diagnóstico Mercado Livre
              </h3>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-2xl p-4">
                <XCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {result && !result.totalAccounts && (
              <div className="flex items-start gap-2 bg-yellow-50 border border-yellow-200 rounded-2xl p-4">
                <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5 shrink-0" />
                <p className="text-sm text-yellow-800">
                  {result.message ?? 'Nenhuma conta ML encontrada. Conecte uma conta primeiro.'}
                </p>
              </div>
            )}

            {result?.accounts?.map((acc) => (
              <div
                key={acc.accountId}
                className={`rounded-2xl border p-4 space-y-2 ${acc.tokenTest.ok ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}
              >
                <div className="flex items-center gap-2">
                  {acc.tokenTest.ok
                    ? <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
                    : <XCircle className="w-5 h-5 text-red-500 shrink-0" />}
                  <span className="font-semibold text-sm text-gray-900">
                    {acc.sellerName || acc.tokenTest.nickname || `Seller ${acc.sellerId}`}
                  </span>
                </div>

                <div className="text-xs space-y-1 pl-7 text-gray-600">
                  {acc.tokenTest.ok ? (
                    <>
                      <p>✅ Token válido — API respondeu OK</p>
                      {acc.minutesUntilExpiry !== null && (
                        <p>⏱ Expira em {acc.minutesUntilExpiry > 0 ? `${acc.minutesUntilExpiry} min` : 'agora (será renovado automaticamente)'}</p>
                      )}
                      {acc.lastSyncAt && (
                        <p>🔄 Último sync: {new Date(acc.lastSyncAt).toLocaleString('pt-BR')}</p>
                      )}
                      {!acc.lastSyncAt && (
                        <p className="text-orange-600">⚠️ Nenhum sync ainda — clique em "Puxar Dados do ML"</p>
                      )}
                      {acc.unread && (
                        <p>
                          📨 Mensagens que o ML libera:{' '}
                          <strong>{acc.unread.count ?? '—'}</strong>
                          {acc.unread.count === 0 && ' (nenhuma acessível via API)'}
                        </p>
                      )}
                      {acc.unread?.raw && (
                        <p className="text-[10px] text-gray-400 break-all">
                          resposta ML: {acc.unread.raw}
                        </p>
                      )}
                      {acc.claims && (
                        <p>
                          🧾 Reclamações/devoluções que o ML retorna:{' '}
                          <strong>{acc.claims.count ?? '—'}</strong>
                        </p>
                      )}
                      {acc.claims?.raw && (
                        <p className="text-[10px] text-gray-400 break-all">
                          claims: {acc.claims.raw}
                        </p>
                      )}
                    </>
                  ) : (
                    <>
                      <p className="text-red-700">❌ {acc.tokenTest.error}</p>
                      <p className="text-red-600">Reconecte a conta: vá em Contas → Mercado Livre → Conectar</p>
                    </>
                  )}
                </div>
              </div>
            ))}

            {result?.tip && (
              <p className="text-xs text-gray-500 text-center">{result.tip}</p>
            )}

            <button
              onClick={() => setOpen(false)}
              className="w-full bg-gray-100 text-gray-700 font-semibold py-2.5 rounded-2xl text-sm hover:bg-gray-200 transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </>
  )
}
