'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

const API_URL = process.env.API_URL!

type LoginState = { error: string } | undefined

export async function login(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })

  if (!res.ok) {
    return { error: 'E-mail ou senha inválidos' }
  }

  const data = (await res.json()) as { accessToken: string }
  const store = await cookies()
  store.set('token', data.accessToken, {
    httpOnly: true,
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
    sameSite: 'lax',
  })

  redirect('/dashboard')
}

export async function logout() {
  const store = await cookies()
  store.delete('token')
  redirect('/login')
}
