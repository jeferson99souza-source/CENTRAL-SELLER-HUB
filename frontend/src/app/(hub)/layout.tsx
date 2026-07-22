import { User } from 'lucide-react'
import { logout } from '@/app/actions'
import SideNav from './SideNav'

export const dynamic = 'force-dynamic'

export default function HubLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F8F9FA] flex font-sans text-[#1A1A1A]">

      {/* Sidebar vertical esquerda */}
      <aside className="fixed left-0 top-0 h-screen w-52 bg-white border-r border-gray-100 flex flex-col z-50 shadow-sm">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-gray-100">
          <h1 className="text-base font-bold text-[#DE7100] leading-tight">Central Seller<br /><span className="text-gray-400 font-medium text-xs">HUB</span></h1>
        </div>

        {/* Nav items — componente cliente para active state */}
        <SideNav />

        {/* Logout */}
        <div className="px-4 pb-5 pt-2 border-t border-gray-100">
          <form action={logout}>
            <button
              type="submit"
              className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold text-gray-400 hover:bg-gray-50 hover:text-gray-700 transition-colors"
            >
              <User className="w-4 h-4 shrink-0" />
              Sair
            </button>
          </form>
        </div>
      </aside>

      {/* Conteúdo principal */}
      <div className="ml-52 flex-1 min-w-0">
        <main className="px-6 py-6">{children}</main>
      </div>

    </div>
  )
}
