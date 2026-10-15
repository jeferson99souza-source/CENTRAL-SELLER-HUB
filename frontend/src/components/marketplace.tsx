'use client'

import { useMemo, useState } from 'react'

/**
 * Identidade visual de cada marketplace, definida em UM lugar só.
 *
 * Antes isso estava duplicado nas telas de Mensagens e Envios; com um terceiro
 * lugar precisando do mesmo selo, virou componente compartilhado.
 */
const MARKETPLACE_INFO: Record<
  string,
  { curto: string; nome: string; selo: string; botao: string }
> = {
  mercadolivre: {
    curto: 'ML',
    nome: 'Mercado Livre',
    selo: 'bg-yellow-100 text-yellow-700',
    botao: 'bg-yellow-400 text-yellow-900',
  },
  shopee: {
    curto: 'SHOPEE',
    nome: 'Shopee',
    selo: 'bg-orange-100 text-orange-700',
    botao: 'bg-[#EE4D2D] text-white',
  },
  amazon: {
    curto: 'AMAZON',
    nome: 'Amazon',
    selo: 'bg-blue-100 text-blue-700',
    botao: 'bg-blue-500 text-white',
  },
}

/** Nome completo do marketplace, para textos. */
export function marketplaceNome(marketplace: string | null | undefined): string {
  if (!marketplace) return 'Marketplace'
  return MARKETPLACE_INFO[marketplace]?.nome ?? marketplace
}

/** Selo curto de origem (ML / SHOPEE / AMAZON). */
export function MarketplaceTag({
  marketplace,
}: {
  marketplace: string | null | undefined
}) {
  if (!marketplace) return null
  const info = MARKETPLACE_INFO[marketplace]
  if (!info) return null
  return (
    <span
      className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded ${info.selo}`}
      title={info.nome}
    >
      {info.curto}
    </span>
  )
}

export const TODOS = 'todos'

/**
 * Estado e lógica do filtro por marketplace.
 *
 * `disponiveis` lista só os marketplaces que REALMENTE aparecem nos dados —
 * assim quem usa apenas o Mercado Livre nunca vê o filtro na tela.
 */
export function useMarketplaceFilter<
  T extends { marketplace?: string | null },
>(itens: T[]) {
  const [filtro, setFiltro] = useState<string>(TODOS)

  const disponiveis = useMemo(() => {
    const encontrados = new Set<string>()
    for (const item of itens) {
      if (item.marketplace) encontrados.add(item.marketplace)
    }
    // Ordem fixa para o filtro não trocar de lugar entre carregamentos
    return ['mercadolivre', 'shopee', 'amazon'].filter((m) =>
      encontrados.has(m),
    )
  }, [itens])

  // Se o marketplace selecionado deixou de existir nos dados, volta para Todos
  const filtroValido =
    filtro === TODOS || disponiveis.includes(filtro) ? filtro : TODOS

  const filtrados = useMemo(
    () =>
      filtroValido === TODOS
        ? itens
        : itens.filter((item) => item.marketplace === filtroValido),
    [itens, filtroValido],
  )

  return {
    filtro: filtroValido,
    setFiltro,
    disponiveis,
    filtrados,
    /** Contagem por marketplace, para mostrar no botão. */
    contagem: (marketplace: string) =>
      marketplace === TODOS
        ? itens.length
        : itens.filter((i) => i.marketplace === marketplace).length,
  }
}

/**
 * Botões "Todos / ML / Shopee".
 *
 * Não renderiza nada quando só existe um marketplace nos dados: filtro que não
 * filtra nada é só poluição na tela.
 */
export function MarketplaceFilter({
  filtro,
  setFiltro,
  disponiveis,
  contagem,
}: {
  filtro: string
  setFiltro: (f: string) => void
  disponiveis: string[]
  contagem: (marketplace: string) => number
}) {
  if (disponiveis.length < 2) return null

  const opcoes = [TODOS, ...disponiveis]

  return (
    <div className="flex items-center gap-1 bg-white border border-gray-100 shadow-sm rounded-full p-1">
      {opcoes.map((opcao) => {
        const ativo = filtro === opcao
        const info = opcao === TODOS ? null : MARKETPLACE_INFO[opcao]
        const rotulo = opcao === TODOS ? 'Todos' : (info?.nome ?? opcao)
        return (
          <button
            key={opcao}
            onClick={() => setFiltro(opcao)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${
              ativo
                ? (info?.botao ?? 'bg-[#DE7100] text-white')
                : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            {rotulo}
            <span className={`ml-1.5 ${ativo ? 'opacity-80' : 'opacity-50'}`}>
              {contagem(opcao)}
            </span>
          </button>
        )
      })}
    </div>
  )
}
