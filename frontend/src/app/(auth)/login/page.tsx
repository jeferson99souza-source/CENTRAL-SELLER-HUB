import LoginForm from './LoginForm'

export const dynamic = 'force-dynamic'

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-[#DE7100]">Central Seller Hub</h1>
          <p className="text-[#5B657A] text-sm">Gerencie todos os seus marketplaces em um único lugar</p>
        </div>
        <div className="bg-white rounded-3xl p-6 shadow-sm">
          <LoginForm />
        </div>
      </div>
    </div>
  )
}
