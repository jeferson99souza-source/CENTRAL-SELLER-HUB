'use client'

import { useActionState, useTransition } from 'react'
import Link from 'next/link'
import { login, demoLogin } from '@/app/actions'
import { Sparkles, ArrowRight } from 'lucide-react'

export default function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined)
  const [demoPending, startDemoTransition] = useTransition()

  const handleDemoAccess = () => {
    startDemoTransition(async () => {
      await demoLogin()
    })
  }

  return (
    <div className="space-y-5">
      {/* Botão de Acesso Rápido / Demonstração */}
      <button
        type="button"
        onClick={handleDemoAccess}
        disabled={demoPending || pending}
        className="w-full flex items-center justify-center gap-2 bg-amber-500/10 border-2 border-[#DE7100]/30 text-[#DE7100] font-bold py-3 px-4 rounded-2xl text-sm hover:bg-[#DE7100] hover:text-white transition-all shadow-sm group disabled:opacity-50"
      >
        <Sparkles className="w-4 h-4 text-[#DE7100] group-hover:text-white transition-colors" />
        <span>{demoPending ? 'Carregando painel...' : '⚡ Acesso Rápido / Demonstração (1 Clique)'}</span>
      </button>

      <div className="relative flex items-center justify-center">
        <div className="border-t border-gray-200 w-full" />
        <span className="bg-white px-3 text-xs font-semibold uppercase text-gray-400 absolute">
          ou entrar com conta
        </span>
      </div>

      <form action={action} className="space-y-4">
        {state?.error && (
          <p className="text-red-500 text-sm text-center bg-red-50 p-2.5 rounded-xl border border-red-100">{state.error}</p>
        )}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            E-mail
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            defaultValue="admin@centralseller.com"
            className="w-full px-4 py-3 rounded-2xl border border-gray-200 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            placeholder="seu@email.com"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
            Senha
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            defaultValue="admin123"
            className="w-full px-4 py-3 rounded-2xl border border-gray-200 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            placeholder="••••••••"
          />
        </div>
        <button
          type="submit"
          disabled={pending || demoPending}
          className="w-full bg-[#DE7100] text-white font-bold py-3.5 rounded-2xl text-sm tracking-wide shadow-md shadow-orange-500/30 hover:bg-orange-600 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
        >
          <span>{pending ? 'Entrando...' : 'Entrar na Conta'}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </form>

      <div className="pt-2 text-center border-t border-gray-100">
        <p className="text-sm text-gray-500">
          Não tem uma conta?{' '}
          <Link
            href="/register"
            className="font-bold text-[#DE7100] hover:underline"
          >
            Cadastre-se grátis
          </Link>
        </p>
      </div>
    </div>
  )
}

