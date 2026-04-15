'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'

const API_URL = process.env.API_URL!

type ReplyState = { error?: string; success?: boolean } | undefined

export async function replyToMessage(
  messageId: string,
  _prevState: ReplyState,
  formData: FormData,
): Promise<ReplyState> {
  const text = (formData.get('text') as string)?.trim()
  if (!text) return { error: 'Digite uma mensagem antes de enviar.' }

  const store = await cookies()
  const token = store.get('token')?.value
  if (!token) return { error: 'Sessão expirada. Faça login novamente.' }

  const res = await fetch(`${API_URL}/messaging/${messageId}/reply`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ text }),
  })

  if (!res.ok) {
    const body = await res.text()
    return { error: `Erro ao enviar: ${body}` }
  }

  revalidatePath('/mensagens')
  return { success: true }
}
