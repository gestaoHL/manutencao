import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, FileText, Calendar, DollarSign, TrendingDown } from 'lucide-react'
import { useContracts } from '@/hooks/useContracts'
import { useAuth } from '@/hooks/useAuth'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'

const statusOptions = [
  { value: '', label: 'Todos' },
  { value: 'active',     label: 'Ativos' },
  { value: 'suspended',  label: 'Suspensos' },
  { value: 'expired',    label: 'Expirados' },
  { value: 'terminated', label: 'Encerrados' },
]

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export function ContractsListPage() {
  const { profile } = useAuth()
  const { data: contracts = [], isLoading } = useContracts()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const canCreate = profile?.role === 'admin' || profile?.role === 'gestor'

  const filtered = contracts.filter(c => {
    const matchSearch = !search ||
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      (c.contract_number ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (c.contractor?.company_name ?? '').toLowerCase().includes(search.toLowerCase())
    const matchStatus = !statusFilter || c.status === statusFilter
    return matchSearch && matchStatus
  })

  return (
    <div className="p-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <FileText size={22} className="text-metro-orange" />
          <h1 className="text-xl font-bold text-metro-navy">Contratos</h1>
          <span className="bg-metro-bg text-gray-500 text-xs font-semibold px-2 py-0.5 rounded-full">
            {filtered.length}
          </span>
        </div>
        {canCreate && (
          <Link to="/contracts/new">
            <Button size="sm"><Plus size={16} /> Novo Contrato</Button>
          </Link>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-2 mb-5">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por título, número ou empresa..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-metro-orange bg-white"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-metro-orange bg-white"
        >
          {statusOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {isLoading && <Spinner />}

      {!isLoading && filtered.length === 0 && (
        <div className="text-center py-20 text-gray-400">
          <FileText size={40} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">Nenhum contrato encontrado.</p>
        </div>
      )}

      {/* Table */}
      {!isLoading && filtered.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <th className="text-left px-5 py-3">Contrato</th>
                <th className="text-left px-5 py-3 hidden md:table-cell">Contratada</th>
                <th className="text-left px-5 py-3 hidden lg:table-cell">Vigência</th>
                <th className="text-right px-5 py-3 hidden xl:table-cell">Valor Global</th>
                <th className="text-right px-5 py-3 hidden xl:table-cell">Saldo Contratual</th>
                <th className="text-right px-5 py-3 hidden xl:table-cell">Saldo Empenho</th>
                <th className="text-center px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(contract => {
                const valorGlobal     = contract.value ?? 0
                const totalEmpenhado  = (contract.commitment_notes ?? []).reduce((s, n) => s + n.valor_empenhado, 0)
                const totalPago       = (contract.budget_executions ?? []).reduce((s, e) => s + e.valor_pago, 0)
                const saldoContratual = valorGlobal - totalEmpenhado
                const saldoEmpenho    = totalEmpenhado - totalPago

                return (
                  <Link key={contract.id} to={`/contracts/${contract.id}`} className="contents">
                    <tr className="hover:bg-gray-50 transition cursor-pointer group">
                      <td className="px-5 py-3.5">
                        <p className="font-semibold text-metro-navy group-hover:text-metro-orange transition truncate max-w-[220px]">
                          {contract.title}
                        </p>
                        <p className="text-xs text-gray-400 font-mono mt-0.5">#{contract.contract_number}</p>
                        <p className="text-xs text-gray-400 truncate max-w-[220px] mt-0.5 md:hidden">
                          {contract.contractor?.company_name ?? contract.contractor?.full_name ?? '—'}
                        </p>
                      </td>
                      <td className="px-5 py-3.5 hidden md:table-cell">
                        <p className="text-gray-700 text-xs truncate max-w-[180px]">
                          {contract.contractor?.company_name ?? contract.contractor?.full_name ?? '—'}
                        </p>
                        {contract.sla_response_hours && (
                          <p className="text-xs text-blue-500 mt-0.5">SLA {contract.sla_response_hours}h</p>
                        )}
                      </td>
                      <td className="px-5 py-3.5 hidden lg:table-cell whitespace-nowrap">
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <Calendar size={11} />
                          {new Date(contract.start_date).toLocaleDateString('pt-BR')}
                        </div>
                        {contract.end_date && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            até {new Date(contract.end_date).toLocaleDateString('pt-BR')}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-3.5 hidden xl:table-cell text-right">
                        {valorGlobal > 0
                          ? <span className="font-semibold text-metro-navy text-xs">{fmt(valorGlobal)}</span>
                          : <span className="text-gray-300 text-xs">—</span>
                        }
                      </td>
                      <td className="px-5 py-3.5 hidden xl:table-cell text-right">
                        {totalEmpenhado > 0
                          ? <span className={`font-semibold text-xs ${saldoContratual >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {fmt(saldoContratual)}
                            </span>
                          : <span className="text-gray-300 text-xs">—</span>
                        }
                      </td>
                      <td className="px-5 py-3.5 hidden xl:table-cell text-right">
                        {totalEmpenhado > 0
                          ? <span className={`font-semibold text-xs ${saldoEmpenho >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                              {fmt(saldoEmpenho)}
                            </span>
                          : <span className="text-gray-300 text-xs">—</span>
                        }
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <Badge status={contract.status} />
                      </td>
                    </tr>
                  </Link>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
