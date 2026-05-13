import { Link } from 'react-router-dom'
import {
  FileText, Wrench, Zap, ClipboardList, BarChart2, Users,
  Clock, Settings, ClipboardCheck, FileStack, Banknote, ChevronRight
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useKPIs } from '@/hooks/useDashboard'
import type { UserRole } from '@/types'

interface ActionCard {
  to: string
  label: string
  description: string
  icon: React.ElementType
  accent: string
}

const cardsByRole: Record<UserRole, ActionCard[]> = {
  admin: [
    { to: '/admin/access',           label: 'Gestão de Acesso',   description: 'Aprovar e gerenciar usuários',  icon: Users,          accent: 'bg-metro-orange' },
    { to: '/contracts',              label: 'Contratos',          description: 'Gerir contratos ativos',        icon: FileText,       accent: 'bg-metro-navy' },
    { to: '/maintenance/executions', label: 'Preventiva',         description: 'Ordens de serviço preventivas', icon: Wrench,         accent: 'bg-green-600' },
    { to: '/irq',                    label: 'IRQ',                description: 'Inspeções e requalificações',   icon: Zap,            accent: 'bg-blue-600' },
    { to: '/dashboard',              label: 'Dashboard',          description: 'Indicadores e gráficos',        icon: BarChart2,      accent: 'bg-purple-600' },
    { to: '/admin/settings',         label: 'Configurações',      description: 'Equipamentos e períodos',       icon: Settings,       accent: 'bg-gray-600' },
  ],
  gestor: [
    { to: '/contracts',              label: 'Contratos',          description: 'Gerir contratos ativos',        icon: FileText,       accent: 'bg-metro-orange' },
    { to: '/maintenance/executions', label: 'Preventiva',         description: 'Ordens de serviço preventivas', icon: Wrench,         accent: 'bg-metro-navy' },
    { to: '/irq',                    label: 'IRQ',                description: 'Inspeções e requalificações',   icon: Zap,            accent: 'bg-blue-600' },
    { to: '/empenhos',               label: 'Notas de Empenho',   description: 'Controle de empenhos',          icon: FileStack,      accent: 'bg-green-600' },
    { to: '/execucao',               label: 'Execução Orçam.',    description: 'Acompanhar execução',           icon: Banknote,       accent: 'bg-purple-600' },
    { to: '/dashboard',              label: 'Dashboard',          description: 'Indicadores e gráficos',        icon: BarChart2,      accent: 'bg-gray-600' },
  ],
  fiscalizacao: [
    { to: '/maintenance/executions', label: 'Preventiva',         description: 'Ordens de serviço preventivas', icon: Wrench,         accent: 'bg-metro-orange' },
    { to: '/irq',                    label: 'IRQ',                description: 'Inspeções e requalificações',   icon: Zap,            accent: 'bg-metro-navy' },
    { to: '/maintenance',            label: 'Planos',             description: 'Planos de manutenção',          icon: ClipboardCheck, accent: 'bg-green-600' },
    { to: '/dashboard',              label: 'Dashboard',          description: 'Indicadores e gráficos',        icon: BarChart2,      accent: 'bg-blue-600' },
  ],
  contratada: [
    { to: '/maintenance/executions', label: 'Preventiva',         description: 'Acompanhar OSs preventivas',    icon: Wrench,         accent: 'bg-metro-orange' },
    { to: '/irq',                    label: 'IRQ',                description: 'Acompanhar IRQs',               icon: Zap,            accent: 'bg-metro-navy' },
    { to: '/contracts',              label: 'Contratos',          description: 'Meus contratos',                icon: FileText,       accent: 'bg-green-600' },
    { to: '/maintenance',            label: 'Planos',             description: 'Planos de manutenção',          icon: ClipboardCheck, accent: 'bg-blue-600' },
  ],
  operador_campo: [
    { to: '/field/pending',          label: 'OSs Pendentes',      description: 'Formulários para preencher',    icon: ClipboardList,  accent: 'bg-metro-orange' },
  ],
}

export function HomePage() {
  const { profile } = useAuth()
  const { data: kpis } = useKPIs()
  if (!profile) return null

  const cards = cardsByRole[profile.role] ?? []
  const today = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
  const showKPIs = ['admin', 'gestor', 'fiscalizacao'].includes(profile.role) && kpis

  return (
    <div className="p-6 max-w-7xl">
      {/* Greeting */}
      <div className="mb-6">
        <p className="text-xs text-gray-400 uppercase tracking-wide capitalize">{today}</p>
        <h1 className="text-2xl font-bold text-metro-navy mt-0.5">
          Olá, {profile.full_name?.split(' ')[0] ?? 'Usuário'} 👋
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {profile.company?.name ?? profile.company_name ?? 'Metrô-DF'}
        </p>
      </div>

      {/* KPI strip */}
      {showKPIs && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Total de OS',           value: kpis.totalOS,              color: 'bg-metro-navy' },
            { label: 'Preventivas aprovadas', value: kpis.preventivasDone,      color: 'bg-green-600' },
            { label: 'IRQs pendentes',        value: kpis.irqPending,           color: 'bg-blue-600' },
            { label: 'Taxa de conformidade',  value: `${kpis.conformanceRate}%`, color: 'bg-metro-orange' },
          ].map(k => (
            <div key={k.label} className={`${k.color} rounded-xl p-4 text-white`}>
              <p className="text-2xl font-bold leading-none">{k.value}</p>
              <p className="text-xs opacity-75 mt-1 leading-tight">{k.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Action cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {cards.map(card => (
          <Link
            key={card.to}
            to={card.to}
            className="group bg-white border border-gray-200 rounded-2xl p-5 flex flex-col gap-4 shadow-sm hover:shadow-md hover:border-gray-300 transition-all"
          >
            <div className={`w-10 h-10 ${card.accent} rounded-xl flex items-center justify-center shrink-0`}>
              <card.icon size={20} className="text-white" strokeWidth={1.8} />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-metro-navy text-sm leading-snug">{card.label}</p>
              <p className="text-xs text-gray-400 mt-0.5 leading-snug">{card.description}</p>
            </div>
            <div className="flex items-center justify-end">
              <ChevronRight size={14} className="text-gray-300 group-hover:text-metro-orange transition-colors" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
