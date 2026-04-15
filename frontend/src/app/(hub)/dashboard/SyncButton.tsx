'use client'

import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { syncML } from '@/app/actions'

export default function SyncButton() {
  const [loading, setLoading] = useState(false)

  const handleSync = async () => {
    setLoading(true)
    try {
      await syncML()
      // Recarrega a página para puxar os novos números do ML
      window.location.reload()
    } catch (e) {
      alert('Erro na sincronização')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleSync}
      disabled={loading}
      className={`flex items-center gap-2 bg-[#DE7100] text-white px-4 py-2 rounded-full font-bold text-sm shadow-md transition-all ${
        loading ? 'opacity-70 cursor-not-allowed' : 'hover:scale-105 hover:shadow-lg'
      }`}
    >
      <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
      {loading ? 'Sincronizando...' : 'Puxar Dados do ML'}
    </button>
  )
}
