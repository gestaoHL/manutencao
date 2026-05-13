import { LogOut, Bell, Monitor, Smartphone } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useViewMode } from '@/hooks/useViewMode'

const ROLE_LABEL: Record<string, string> = {
  admin: 'Administrador',
  gestor: 'Gestor',
  fiscalizacao: 'Fiscalização',
  contratada: 'Contratada',
  operador_campo: 'Operador de Campo',
}

export function Header() {
  const { profile, signOut } = useAuth()
  const { isDesktop, toggle } = useViewMode()

  return (
    <header className="bg-white border-b border-gray-200 h-12 flex items-center justify-between px-4 shrink-0 z-30">
      <div className="flex items-center gap-2 sm:hidden">
        <div className="w-6 h-6 rounded-md bg-metro-orange flex items-center justify-center font-black text-white text-xs">M</div>
        <span className="font-bold text-metro-navy text-sm">Metrô-DF</span>
      </div>
      <div className="hidden sm:block" />

      <div className="flex items-center gap-0.5 ml-auto">
        <button onClick={toggle} title={isDesktop ? 'Modo mobile' : 'Modo desktop'}
          className="p-2 rounded-lg text-gray-400 hover:text-metro-navy hover:bg-gray-100 transition">
          {isDesktop ? <Monitor size={15} /> : <Smartphone size={15} />}
        </button>
        <button className="p-2 rounded-lg text-gray-400 hover:text-metro-navy hover:bg-gray-100 transition">
          <Bell size={15} />
        </button>
        <div className="w-px h-5 bg-gray-200 mx-1" />
        <div className="flex items-center gap-2 pl-1">
          <div className="w-6 h-6 rounded-full bg-metro-navy flex items-center justify-center shrink-0">
            <span className="text-white text-[10px] font-bold">
              {(profile?.full_name ?? 'U').charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="hidden sm:block">
            <p className="text-xs font-semibold text-metro-navy leading-none">{profile?.full_name ?? 'Usuário'}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">{ROLE_LABEL[profile?.role ?? ''] ?? profile?.role}</p>
          </div>
          <button onClick={signOut} title="Sair"
            className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition">
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </header>
  )
}
