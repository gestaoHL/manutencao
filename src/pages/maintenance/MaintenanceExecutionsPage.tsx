import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Wrench, Search, Plus, ChevronRight } from 'lucide-react'
import { useExecutions } from '@/hooks/useExecutions'
import { useAuth } from '@/hooks/useAuth'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { NewExecutionModal } from './NewExecutionModal'
import type { ExecutionStatus, PlanType } from '@/types'

const STATUS_OPTIONS: { value: ExecutionStatus | ''; label: string }[] = [
  { value: '', label: 'Todos' },
  { value: 'pendente', label: 'Pendente' },
  { value: 'recebido', label: 'Recebido' },
  { value: 'em_analise', label: 'Em Análise' },
  { value: 'aprovado', label: 'Aprovado' },
  { value: 'rejeitado', label: 'Rejeitado' },
  { value: 'cancelado', label: 'Cancelado' },
]

interface Props {
  planType?: PlanType
}

export function MaintenanceExecutionsPage({ planType = 'preventiva' }: Props) {
  const navigate = useNavigate()
  const { data: executions, isLoading } = useExecutions(planType)
  const { profile } = useAuth()
  const canCreateOS = profile?.role === 'admin' || profile?.role === 'gestor'
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ExecutionStatus | ''>('')
  const [showNew, setShowNew] = useState(false)

  const filtered = (executions ?? []).filter(e => {
    const matchSearch =
      !search ||
      (e.os_number ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (e.locality?.name ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (e.plan?.title ?? '').toLowerCase().includes(search.toLowerCase())
    const matchStatus = !statusFilter || e.status === statusFilter
    return matchSearch && matchStatus
  })

  const typeLabel = planType === 'preventiva' ? 'Manutenção Preventiva' : 'IRQ'

  return (
    <div className="h-full flex flex-col">
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center">
            <Wrench size={18} className="text-metro-orange" />
          </div>
          <div>
            <h1 className="text-base font-bold text-metro-navy leading-none">{typeLabel}</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              {filtered.length} OS{filtered.length !== 1 ? 's' : ''} registrada{filtered.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        {canCreateOS && (
          <Button size="sm" onClick={() => setShowNew(true)}>
            <Plus size={14} /> Nova OS
          </Button>
        )}
      </div>

      <div className="bg-white border-b border-gray-100 px-6 py-2.5 flex items-center gap-3 shrink-0 flex-wrap">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            placeholder="Buscar OS, plano ou localidade..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 pr-3 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-metro-orange bg-white w-64"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-400">Status:</span>
          {STATUS_OPTIONS.map(o => (
            <button
              key={o.value}
              onClick={() => setStatusFilter(o.value)}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition border ${
                statusFilter === o.value
                  ? 'bg-metro-navy text-white border-metro-navy'
                  : 'bg-white text-gray-500 border-gray-200 hover:border-metro-navy/40'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="flex justify-center pt-12"><Spinner /></div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <Wrench size={36} className="mx-auto mb-3 text-gray-200" />
            <p className="text-sm font-medium text-gray-400">Nenhuma OS encontrada</p>
            <p className="text-xs text-gray-300 mt-1">Clique em "Nova OS" para gerar a primeira</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Plano / Equipamento</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Localidade</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Nº OS</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Data</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(exec => (
                  <tr
                    key={exec.id}
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => navigate(`/forms/${exec.id}`)}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-metro-navy">{exec.plan?.title ?? '—'}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {exec.equipment?.name ?? exec.asset?.name ?? '—'}
                      </p>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell text-gray-700">{exec.locality?.name ?? '—'}</td>
                    <td className="px-4 py-3 hidden sm:table-cell text-gray-700">{exec.os_number ?? '—'}</td>
                    <td className="px-4 py-3 hidden md:table-cell text-gray-500 text-xs">
                      {new Date(exec.scheduled_date).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-4 py-3"><Badge status={exec.status} /></td>
                    <td className="px-4 py-3 text-gray-300 hover:text-metro-navy">
                      <Link to={`/forms/${exec.id}`} onClick={e => e.stopPropagation()}>
                        <ChevronRight size={15} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <NewExecutionModal
        open={showNew}
        onClose={() => setShowNew(false)}
        planType={planType}
      />
    </div>
  )
}
