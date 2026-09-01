'use client'

import { useState } from 'react'
import { RefreshCw, RotateCw } from 'lucide-react'
import { syncML } from '@/app/actions'

export default function SyncButton() {
  const [loading, setLoading] = useState(false)
  const [started, setStarted] = useState(false)

  const handleSync = async () => {
    setLoading(true)
    try {
      const res = await syncML()
      if (res && 'error' in res && res.error) {
        alert('Erro ao iniciar a sincronização: ' + res.error)
      } else {
        setStarted(true)
      }
    } catch {
      alert('Erro ao iniciar a sincronização')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      {started && (
        <button
          onClick={() => window.location.reload()}
          className="flex items-center gap-1 text-xs font-semibold text-[#DE7100] hover:underline"
          title="Recarregar para ver os dados já sincronizados"
        >
          <RotateCw className="w-3.5 h-3.5" />
          Atualizar
        </button>
      )}
      <button
        onClick={handleSync}
        disabled={loading}
        className={`flex items-center gap-2 bg-[#DE7100] text-white px-4 py-2 rounded-full font-bold text-sm shadow-md transition-all ${
          loading ? 'opacity-70 cursor-not-allowed' : 'hover:scale-105 hover:shadow-lg'
        }`}
      >
        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        {loading ? 'Iniciando...' : 'Puxar Dados do ML'}
      </button>
    </div>
  )
}
