'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { registerUser } from '@/app/actions'
import { UserPlus, ArrowLeft } from 'lucide-react'

export default function RegisterForm() {
  const [state, action, pending] = useActionState(registerUser, undefined)

  return (
    <form action={action} className="space-y-4">
      {state?.error && (
        <p className="text-red-500 text-sm text-center bg-red-50 p-2.5 rounded-xl border border-red-100">{state.error}</p>
      )}

      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
          Nome Completo
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          autoComplete="name"
          placeholder="Seu Nome ou Administrador"
          className="w-full px-4 py-3 rounded-2xl border border-gray-200 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
        />
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
          E-mail Corporativo
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="seu@empresa.com.br"
          className="w-full px-4 py-3 rounded-2xl border border-gray-200 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
          Senha de Acesso
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="new-password"
          placeholder="Mínimo 6 caracteres"
          className="w-full px-4 py-3 rounded-2xl border border-gray-200 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full bg-[#DE7100] text-white font-bold py-3.5 rounded-2xl text-sm tracking-wide shadow-md shadow-orange-500/30 hover:bg-orange-600 transition-colors disabled:opacity-60 flex items-center justify-center gap-2 mt-2"
      >
        <UserPlus className="w-4 h-4" />
        <span>{pending ? 'Criando Conta...' : 'Criar Conta e Acessar'}</span>
      </button>

      <div className="pt-3 text-center border-t border-gray-100">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-[#DE7100] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Já tem conta? Fazer login</span>
        </Link>
      </div>
    </form>
  )
}
