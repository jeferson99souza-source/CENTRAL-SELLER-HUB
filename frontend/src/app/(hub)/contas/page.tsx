import { getCompanies } from '@/app/actions'
import EmpresasPanel from './EmpresasPanel'

export const dynamic = 'force-dynamic'

export default async function ContasPage({
  searchParams,
}: {
  searchParams: Promise<{ mlConnected?: string; mlError?: string }>
}) {
  const params = await searchParams
  const result = await getCompanies()
  const companies = 'companies' in result ? result.companies : []

  return (
    <EmpresasPanel
      companies={companies}
      mlConnected={params.mlConnected}
      mlError={params.mlError}
    />
  )
}
