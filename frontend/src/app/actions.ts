'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

const API_URL =
  process.env.API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'https://central-seller-hub-production-c6ae.up.railway.app/api/v1';

type LoginState = { error: string } | undefined

async function parseApiError(res: Response, fallback: string): Promise<string> {
  const errData = await res.json().catch(() => ({}))
  const msg = errData?.error?.message || errData?.message
  if (Array.isArray(msg)) return msg[0] || fallback
  return msg || fallback
}

function networkError(err: unknown): string {
  return err instanceof Error ? err.message : 'Não foi possível conectar ao servidor'
}

export async function login(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = (formData.get('email') as string)?.trim()
  const password = formData.get('password') as string

  if (!email || !password) {
    return { error: 'E-mail e senha são obrigatórios' }
  }

  let tokenToSet: string | null = null

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 3500)

    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    if (res.ok) {
      const data = (await res.json()) as { accessToken: string }
      tokenToSet = data.accessToken
    } else {
      return { error: await parseApiError(res, 'E-mail ou senha inválidos') }
    }
  } catch (err) {
    return { error: networkError(err) }
  }

  if (tokenToSet) {
    const store = await cookies()
    store.set('token', tokenToSet, {
      httpOnly: true,
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
      sameSite: 'lax',
    })
    redirect('/dashboard')
  }

  return { error: 'Não foi possível realizar o login' }
}

export async function registerUser(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const name = (formData.get('name') as string)?.trim()
  const email = (formData.get('email') as string)?.trim()
  const password = formData.get('password') as string

  if (!email || !password || !name) {
    return { error: 'Preencha todos os campos obrigatórios' }
  }

  if (password.length < 8) {
    return { error: 'A senha deve ter no mínimo 8 caracteres' }
  }

  let tokenToSet: string | null = null

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 3500)

    const res = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    if (res.ok) {
      const data = (await res.json()) as { accessToken: string }
      tokenToSet = data.accessToken
    } else {
      return { error: await parseApiError(res, 'Dados de cadastro inválidos') }
    }
  } catch (err) {
    return { error: networkError(err) }
  }

  if (tokenToSet) {
    const store = await cookies()
    store.set('token', tokenToSet, {
      httpOnly: true,
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
      sameSite: 'lax',
    })
    redirect('/dashboard')
  }

  return { error: 'Não foi possível realizar o cadastro' }
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

  try {
    const res = await fetch(`${API_URL}/integration/mercadolivre/sync`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    })

    if (res.ok) {
      const body = await res.json()
      return { success: true, data: body.data }
    }
    return { error: await parseApiError(res, 'Não foi possível sincronizar com o Mercado Livre') }
  } catch (err) {
    return { error: networkError(err) }
  }
}

export async function updateComplaintStage(id: string, stage: string) {
  const store = await cookies()
  const token = store.get('token')?.value
  if (!token) return { error: 'Não autorizado' }
  try {
    const res = await fetch(`${API_URL}/complaints/${id}/stage`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage }),
    })
    if (res.ok) return { success: true }
    return { error: await parseApiError(res, 'Não foi possível atualizar a reclamação') }
  } catch (err) {
    return { error: networkError(err) }
  }
}

export async function updateComplaintNotes(id: string, notes: string) {
  const store = await cookies()
  const token = store.get('token')?.value
  if (!token) return { error: 'Não autorizado' }
  try {
    const res = await fetch(`${API_URL}/complaints/${id}/notes`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes }),
    })
    if (res.ok) return { success: true }
    return { error: await parseApiError(res, 'Não foi possível salvar as anotações') }
  } catch (err) {
    return { error: networkError(err) }
  }
}

export async function dismissQuestion(questionId: string) {
  const store = await cookies()
  const token = store.get('token')?.value
  if (!token) return { error: 'Não autorizado' }
  try {
    const res = await fetch(`${API_URL}/questions/${questionId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) return { success: true }
    return { error: await parseApiError(res, 'Não foi possível descartar a pergunta') }
  } catch (err) {
    return { error: networkError(err) }
  }
}

export async function blockBuyer(questionId: string) {
  const store = await cookies()
  const token = store.get('token')?.value
  if (!token) return { error: 'Não autorizado' }
  try {
    const res = await fetch(`${API_URL}/questions/${questionId}/block-buyer`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) return { success: true }
    return { error: await parseApiError(res, 'Não foi possível bloquear o comprador') }
  } catch (err) {
    return { error: networkError(err) }
  }
}

export async function aiSuggestQuestion(questionId: string) {
  const store = await cookies()
  const token = store.get('token')?.value
  if (!token) return { error: 'Não autorizado' }
  try {
    const res = await fetch(`${API_URL}/questions/${questionId}/ai-suggest`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) {
      const body = await res.json()
      return { suggestion: body.suggestion as string }
    }
    return { error: await parseApiError(res, 'Não foi possível gerar a sugestão') }
  } catch (err) {
    return { error: networkError(err) }
  }
}

export async function answerQuestion(questionId: string, text: string) {
  const store = await cookies()
  const token = store.get('token')?.value
  if (!token) return { error: 'Não autorizado' }

  try {
    const res = await fetch(`${API_URL}/questions/${questionId}/answer`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    })

    if (res.ok) {
      return { success: true }
    }
    return { error: await parseApiError(res, 'Não foi possível enviar a resposta') }
  } catch (err) {
    return { error: networkError(err) }
  }
}

export async function getCompanies() {
  const store = await cookies()
  const token = store.get('token')?.value
  if (!token) return { error: 'Não autorizado' }

  try {
    const res = await fetch(`${API_URL}/accounts/companies`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    if (res.ok) {
      const data = await res.json()
      const apiCompanies = Array.isArray(data) ? data : (data?.data ?? [])
      return { companies: apiCompanies }
    }
    return { error: await parseApiError(res, 'Não foi possível carregar as empresas') }
  } catch (err) {
    return { error: networkError(err) }
  }
}

export async function createCompany(formData: FormData) {
  const store = await cookies()
  const token = store.get('token')?.value
  if (!token) return { error: 'Não autorizado' }

  const name = (formData.get('name') as string)?.trim()
  const cnpj = (formData.get('cnpj') as string)?.trim()
  const email = (formData.get('email') as string) || null
  const phone = (formData.get('phone') as string) || null

  if (!name || !cnpj) {
    return { error: 'Nome e CNPJ da empresa são obrigatórios' }
  }

  try {
    const res = await fetch(`${API_URL}/accounts/companies`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, cnpj, email, phone }),
    })
    if (res.ok) {
      const data = await res.json()
      const company = data?.data ?? data
      return { success: true, company }
    }
    return { error: await parseApiError(res, 'Não foi possível criar a empresa') }
  } catch (err) {
    return { error: networkError(err) }
  }
}

export async function getMLConnectUrl(companyId: string) {
  const store = await cookies()
  const token = store.get('token')?.value
  if (!token) return { error: 'Não autorizado' }
  try {
    const res = await fetch(`${API_URL}/integration/mercadolivre/connect?companyId=${companyId}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    if (res.ok) {
      const body = await res.json()
      if (body?.data?.authUrl) {
        return { authUrl: body.data.authUrl as string }
      }
      return { error: 'Resposta inválida do servidor ao gerar o link de conexão' }
    }
    return { error: await parseApiError(res, 'Não foi possível gerar o link de conexão') }
  } catch (err) {
    return { error: networkError(err) }
  }
}

export async function diagnoseML() {
  const store = await cookies()
  const token = store.get('token')?.value

  if (!token) return { error: 'Não autorizado' }

  try {
    const res = await fetch(`${API_URL}/integration/mercadolivre/diagnose`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })

    if (res.ok) {
      const body = await res.json()
      return { data: body.data }
    }
    return { error: await parseApiError(res, 'Não foi possível diagnosticar a integração') }
  } catch (err) {
    return { error: networkError(err) }
  }
}
