import Link from 'next/link'
import { LayoutGrid, AlertCircle, MessageSquare, User } from 'lucide-react'
import { logout } from '@/app/actions'

const navItems = [
  { href: '/dashboard', icon: LayoutGrid, label: 'Dashboard' },
  { href: '/reclamacoes', icon: AlertCircle, label: 'Reclamações' },
  { href: '/mensagens', icon: MessageSquare, label: 'Mensagens' },
]

export default function HubLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-24 font-sans text-[#1A1A1A]">
      <header className="px-6 py-5 flex items-center justify-between border-b border-gray-100 bg-white">
        <h1 className="text-xl font-bold text-[#DE7100]">Central Seller Hub</h1>
        <form action={logout}>
          <button type="submit" className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors">
            <User className="w-5 h-5 text-gray-600" />
          </button>
        </form>
      </header>

      <main className="px-6 py-6">{children}</main>

      <nav className="fixed bottom-0 w-full bg-white border-t border-gray-200/50 pb-safe pt-2 px-6 flex justify-around items-center z-50">
        {navItems.map(({ href, icon: Icon, label }) => (
          <Link
            key={href}
            href={href}
            className="flex flex-col items-center gap-1 p-2 text-[#9BA5B7] hover:text-[#DE7100] transition-colors"
          >
            <Icon className="w-6 h-6" strokeWidth={2} />
            <span className="text-[10px] font-semibold tracking-wide">{label}</span>
          </Link>
        ))}
      </nav>
    </div>
  )
}
