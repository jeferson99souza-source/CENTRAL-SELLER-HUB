'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

const API_URL =
  process.env.API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'https://central-seller-hub-production-5be8.up.railway.app/api/v1';

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

export async function syncML() {
  const store = await cookies()
  const token = store.get('token')?.value

  if (!token) return { error: 'Não autorizado' }

  const res = await fetch(`${API_URL}/integration/mercadolivre/sync`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  })

  if (!res.ok) {
    return { error: 'Falha na sincronização' }
  }

  const body = await res.json()
  return { success: true, data: body.data }
}

export async function updateComplaintStage(id: string, stage: string) {
  const store = await cookies()
  const token = store.get('token')?.value
  if (!token) return { error: 'Não autorizado' }
  const res = await fetch(`${API_URL}/complaints/${id}/stage`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ stage }),
  })
  if (!res.ok) return { error: await res.text() }
  return { success: true }
}

export async function updateComplaintNotes(id: string, notes: string) {
  const store = await cookies()
  const token = store.get('token')?.value
  if (!token) return { error: 'Não autorizado' }
  const res = await fetch(`${API_URL}/complaints/${id}/notes`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ notes }),
  })
  if (!res.ok) return { error: await res.text() }
  return { success: true }
}

export async function dismissQuestion(questionId: string) {
  const store = await cookies()
  const token = store.get('token')?.value
  if (!token) return { error: 'Não autorizado' }
  const res = await fetch(`${API_URL}/questions/${questionId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return { error: await res.text() }
  return { success: true }
}

export async function blockBuyer(questionId: string) {
  const store = await cookies()
  const token = store.get('token')?.value
  if (!token) return { error: 'Não autorizado' }
  const res = await fetch(`${API_URL}/questions/${questionId}/block-buyer`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return { error: await res.text() }
  return { success: true }
}

export async function aiSuggestQuestion(questionId: string) {
  const store = await cookies()
  const token = store.get('token')?.value
  if (!token) return { error: 'Não autorizado' }
  const res = await fetch(`${API_URL}/questions/${questionId}/ai-suggest`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return { error: await res.text() }
  const body = await res.json()
  return { suggestion: body.suggestion as string }
}

export async function answerQuestion(questionId: string, text: string) {
  const store = await cookies()
  const token = store.get('token')?.value
  if (!token) return { error: 'Não autorizado' }

  const res = await fetch(`${API_URL}/questions/${questionId}/answer`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
  })

  if (!res.ok) {
    const body = await res.text()
    return { error: `Erro ao responder: ${body}` }
  }

  return { success: true }
}

export async function getCompanies() {
  const store = await cookies()
  const token = store.get('token')?.value
  if (!token) return { error: 'Não autorizado' }
  const res = await fetch(`${API_URL}/accounts/companies`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (!res.ok) return { error: `Erro ${res.status}` }
  const data = await res.json()
  return { companies: Array.isArray(data) ? data : (data?.data ?? []) }
}

export async function createCompany(formData: FormData) {
  const store = await cookies()
  const token = store.get('token')?.value
  if (!token) return { error: 'Não autorizado' }
  const body = {
    name: formData.get('name') as string,
    cnpj: formData.get('cnpj') as string,
    email: (formData.get('email') as string) || undefined,
    phone: (formData.get('phone') as string) || undefined,
  }
  const res = await fetch(`${API_URL}/accounts/companies`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const msg = err?.message ?? err?.error?.message ?? `Erro ${res.status}`
    return { error: Array.isArray(msg) ? msg.join(', ') : String(msg) }
  }
  return { success: true }
}

export async function getMLConnectUrl(companyId: string) {
  const store = await cookies()
  const token = store.get('token')?.value
  if (!token) return { error: 'Não autorizado' }
  const res = await fetch(`${API_URL}/integration/mercadolivre/connect?companyId=${companyId}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (!res.ok) return { error: 'Falha ao obter URL de autorização' }
  const body = await res.json()
  return { authUrl: body?.data?.authUrl as string }
}

export async function diagnoseML() {
  const store = await cookies()
  const token = store.get('token')?.value

  if (!token) return { error: 'Não autorizado' }

  const res = await fetch(`${API_URL}/integration/mercadolivre/diagnose`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })

  if (!res.ok) {
    const text = await res.text()
    return { error: `Erro ${res.status}: ${text}` }
  }

  const body = await res.json()
  return { data: body.data }
}
