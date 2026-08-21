'use client'

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="pt-BR">
      <body>
        <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'sans-serif' }}>
          <h2>Ocorreu um erro inesperado</h2>
          <button onClick={() => reset()} style={{ padding: '0.5rem 1rem', marginTop: '1rem' }}>
            Tentar novamente
          </button>
        </div>
      </body>
    </html>
  )
}
