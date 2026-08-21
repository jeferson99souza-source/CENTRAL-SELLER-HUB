import RegisterForm from './RegisterForm'

export const dynamic = 'force-dynamic'

export default function RegisterPage() {
  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-[#DE7100]">Central Seller Hub</h1>
          <p className="text-[#5B657A] text-sm">Crie seu acesso administrativo para unificar seus canais</p>
        </div>
        <div className="bg-white rounded-3xl p-7 shadow-sm border border-gray-100">
          <RegisterForm />
        </div>
      </div>
    </div>
  )
}
