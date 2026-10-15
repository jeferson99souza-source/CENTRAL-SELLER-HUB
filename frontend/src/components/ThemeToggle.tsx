'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { CHAVE_TEMA } from './theme-script'

export default function ThemeToggle() {
  // Começa indefinido: o tema real só é conhecido no navegador, e assumir
  // "claro" aqui faria o ícone trocar sozinho depois de carregar.
  const [escuro, setEscuro] = useState<boolean | null>(null)

  useEffect(() => {
    setEscuro(document.documentElement.classList.contains('dark'))
  }, [])

  function alternar() {
    const novo = !document.documentElement.classList.contains('dark')
    document.documentElement.classList.toggle('dark', novo)
    try {
      localStorage.setItem(CHAVE_TEMA, novo ? 'escuro' : 'claro')
    } catch {
      // Navegador sem localStorage (aba privada em alguns casos): o tema
      // vale para esta sessão e não é lembrado. Melhor que travar o botão.
    }
    setEscuro(novo)
  }

  return (
    <button
      onClick={alternar}
      // aria-label fixo e title dinâmico: leitores de tela anunciam a ação,
      // e o mouse mostra para onde o clique leva.
      aria-label="Alternar modo noturno"
      title={escuro ? 'Mudar para modo claro' : 'Mudar para modo noturno'}
      className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold text-gray-400 hover:bg-gray-50 hover:text-gray-700 transition-colors"
    >
      {/* Antes de saber o tema, mostra a lua sem texto trocando */}
      {escuro ? (
        <Sun className="w-4 h-4 shrink-0" />
      ) : (
        <Moon className="w-4 h-4 shrink-0" />
      )}
      {escuro === null ? 'Tema' : escuro ? 'Modo claro' : 'Modo noturno'}
    </button>
  )
}
