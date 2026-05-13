import { NavLink } from 'react-router-dom'
import {
  Home, FileText, Wrench, Zap,
  BarChart2, Users, Settings, ClipboardCheck,
  FileStack, Banknote, LineChart
} from 'lucide-react'
import { clsx } from 'clsx'
import { useAuth } from '@/hooks/useAuth'
import type { UserRole } from '@/types'

interface NavItem {
  to: string
  label: string
  icon: React.ElementType
  roles: UserRole[]
  end?: boolean
}

interface NavGroup {
  label: string
  items: NavItem[]
}

const navGroups: NavGroup[] = [
  {
    label: 'Principal',
    items: [
      { to: '/',          label: 'Início',    icon: Home,      roles: ['admin','gestor','fiscalizacao','contratada'], end: true },
      { to: '/dashboard', label: 'Dashboard', icon: BarChart2, roles: ['admin','gestor','fiscalizacao'] },
    ],
  },
  {
    label: 'Contratos',
    items: [
      { to: '/contracts', label: 'Contratos',          icon: FileText,   roles: ['admin','gestor','contratada'] },
      { to: '/empenhos',  label: 'Notas de Empenho',   icon: FileStack,  roles: ['admin','gestor'] },
      { to: '/execucao',  label: 'Execução Orçam.',    icon: Banknote,   roles: ['admin','gestor'] },
    ],
  },
  {
    label: 'Manutenção',
    items: [
      { to: '/maintenance',            label: 'Planos',     icon: ClipboardCheck, roles: ['admin','gestor','fiscalizacao','contratada'], end: true },
      { to: '/maintenance/executions', label: 'Preventiva', icon: Wrench,         roles: ['admin','gestor','fiscalizacao','contratada'] },
      { to: '/irq',                    label: 'IRQ',        icon: Zap,            roles: ['admin','gestor','fiscalizacao','contratada'] },
      { to: '/reports',                label: 'Relatórios', icon: LineChart,      roles: ['admin','gestor','fiscalizacao'] },
    ],
  },
  {
    label: 'Administração',
    items: [
      { to: '/admin/access',   label: 'Gestão de Acesso', icon: Users,    roles: ['admin'] },
      { to: '/admin/settings', label: 'Configurações',    icon: Settings, roles: ['admin'] },
    ],
  },
]

export function Sidebar() {
  const { profile } = useAuth()

  return (
    <aside className="w-56 bg-metro-navy flex flex-col shrink-0 h-full overflow-y-auto border-r border-white/5">
      {/* Brand */}
      <div className="px-4 py-5 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-metro-orange flex items-center justify-center font-black text-white text-base shrink-0">
            M
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-none">Metrô-DF</p>
            <p className="text-white/40 text-[10px] mt-0.5 leading-none">Manutenção</p>
          </div>
        </div>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 px-3 py-4 space-y-5">
        {navGroups.map(group => {
          const visible = group.items.filter(item =>
            profile?.role && item.roles.includes(profile.role)
          )
          if (visible.length === 0) return null
          return (
            <div key={group.label}>
              <p className="text-white/30 text-[10px] font-bold uppercase tracking-widest px-2 mb-1.5">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {visible.map(item => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      clsx(
                        'flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-all relative',
                        isActive
                          ? 'bg-white/10 text-white'
                          : 'text-white/55 hover:bg-white/5 hover:text-white/90',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && (
                          <span className="absolute left-0 top-1 bottom-1 w-0.5 rounded-r-full bg-metro-orange" />
                        )}
                        <item.icon size={15} strokeWidth={isActive ? 2.2 : 1.8} className={isActive ? 'text-metro-orange' : ''} />
                        <span className={isActive ? 'text-white' : ''}>{item.label}</span>
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          )
        })}
      </nav>

      {/* User footer */}
      {profile && (
        <div className="px-4 py-3 border-t border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-metro-orange/20 flex items-center justify-center shrink-0">
              <span className="text-metro-orange text-xs font-bold">
                {(profile.full_name ?? 'U').charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-white text-xs font-medium truncate">{profile.full_name ?? 'Usuário'}</p>
              <p className="text-white/40 text-[10px] capitalize">{profile.role}</p>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}
