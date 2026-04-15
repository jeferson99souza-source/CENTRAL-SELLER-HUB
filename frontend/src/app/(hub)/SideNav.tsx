'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutGrid, AlertCircle, MessageSquare, Package, HelpCircle } from 'lucide-react'

const navItems = [
  { href: '/dashboard', icon: LayoutGrid, label: 'Dashboard' },
  { href: '/pedidos', icon: Package, label: 'Pedidos' },
  { href: '/perguntas', icon: HelpCircle, label: 'Perguntas' },
  { href: '/reclamacoes', icon: AlertCircle, label: 'Reclamações' },
  { href: '/mensagens', icon: MessageSquare, label: 'Mensagens' },
]

export default function SideNav() {
  const pathname = usePathname()

  return (
    <nav className="flex flex-col gap-1 px-3 py-4 flex-1">
      {navItems.map(({ href, icon: Icon, label }) => {
        const active = pathname === href || pathname.startsWith(href + '/')
        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-colors ${
              active
                ? 'bg-[#DE7100] text-white shadow-md shadow-orange-200'
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
            }`}
          >
            <Icon className="w-4 h-4 shrink-0" strokeWidth={2} />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
