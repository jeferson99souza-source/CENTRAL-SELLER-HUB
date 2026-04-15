'use client'

import { useActionState, useRef } from 'react'
import { replyToMessage } from './actions'
import { Send } from 'lucide-react'

type Props = { messageId: string }

export default function ReplyForm({ messageId }: Props) {
  const formRef = useRef<HTMLFormElement>(null)
  const replyAction = replyToMessage.bind(null, messageId)
  const [state, action, pending] = useActionState(replyAction, undefined)

  return (
    <form
      ref={formRef}
      action={async (fd) => {
        await action(fd)
        formRef.current?.reset()
      }}
      className="mt-3 pt-3 border-t border-gray-100 space-y-2"
    >
      {state?.error && (
        <p className="text-xs text-red-500">{state.error}</p>
      )}
      {state?.success && (
        <p className="text-xs text-green-600">Mensagem enviada!</p>
      )}
      <div className="flex gap-2">
        <input
          name="text"
          required
          placeholder="Digite sua resposta..."
          className="flex-1 text-sm px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-400"
        />
        <button
          type="submit"
          disabled={pending}
          className="bg-[#DE7100] text-white px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-1.5 hover:bg-orange-600 transition-colors disabled:opacity-60"
        >
          <Send className="w-4 h-4" />
          {pending ? '...' : 'Enviar'}
        </button>
      </div>
    </form>
  )
}
