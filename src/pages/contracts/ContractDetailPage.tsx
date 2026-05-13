import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  ArrowLeft, Edit, Plus, Trash2, MapPin,
  Wrench, Building, AlertTriangle, CheckCircle,
  PauseCircle, XCircle, TrendingUp, DollarSign,
  BarChart3, FileStack, Banknote
} from 'lucide-react'
import { useContract, useUpdateContractStatus } from '@/hooks/useContracts'
import { useAssets, useCreateAsset, useDeleteAsset } from '@/hooks/useAssets'
import { useCommitmentNotes } from '@/hooks/useCommitmentNotes'
import { useBudgetExecutions } from '@/hooks/useBudgetExecutions'
import { assetSchema, type AssetFormData } from '@/schemas/asset.schema'
import { useAuth } from '@/hooks/useAuth'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { Spinner } from '@/components/ui/Spinner'
import type { Contract } from '@/types'

const assetTypeOptions = [
  { value: 'equipment', label: 'Equipamento' },
  { value: 'location',  label: 'Localidade' },
  { value: 'building',  label: 'Edificação' },
]

const assetTypeIcon = { equipment: Wrench, location: MapPin, building: Building }

const statusTransitions: Record<Contract['status'], { next: Contract['status']; label: string; icon: React.ElementType; className: string }[]> = {
  active:     [
    { next: 'suspended',  label: 'Suspender', icon: PauseCircle, className: 'border border-yellow-200 bg-yellow-50 text-yellow-700 hover:bg-yellow-100' },
    { next: 'terminated', label: 'Encerrar',  icon: XCircle,     className: 'border border-red-200 bg-red-50 text-red-700 hover:bg-red-100' },
  ],
  suspended:  [
    { next: 'active',     label: 'Reativar',  icon: CheckCircle, className: 'border border-green-200 bg-green-50 text-green-700 hover:bg-green-100' },
    { next: 'terminated', label: 'Encerrar',  icon: XCircle,     className: 'border border-red-200 bg-red-50 text-red-700 hover:bg-red-100' },
  ],
  expired:    [{ next: 'terminated', label: 'Encerrar', icon: XCircle, className: 'border border-red-200 bg-red-50 text-red-700 hover:bg-red-100' }],
  terminated: [],
}

function fmt(v: number | null | undefined) {
  return (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function FinancialBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.min((value / total) * 100, 100) : 0
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-500">{label}</span>
        <span className="font-semibold text-metro-navy">{fmt(value)}</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-right text-[10px] text-gray-400 mt-0.5">{pct.toFixed(1)}% do valor global</p>
    </div>
  )
}

export function ContractDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { data: contract, isLoading } = useContract(id ?? '')
  const { data: assets = [] } = useAssets(id ?? '')
  const { data: notes = [] } = useCommitmentNotes(id ?? '')
  const { data: executions = [] } = useBudgetExecutions(id ?? '')
  const statusMutation = useUpdateContractStatus(id ?? '')
  const createAsset = useCreateAsset(id ?? '')
  const deleteAsset = useDeleteAsset(id ?? '')
  const [addAssetOpen, setAddAssetOpen] = useState(false)
  const [confirmStatus, setConfirmStatus] = useState<Contract['status'] | null>(null)

  const canManage = profile?.role === 'admin' || profile?.role === 'gestor'

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<AssetFormData>({
    resolver: zodResolver(assetSchema),
    defaultValues: { type: 'equipment' },
  })

  const onAddAsset = async (data: AssetFormData) => {
    await createAsset.mutateAsync(data)
    reset()
    setAddAssetOpen(false)
  }

  if (isLoading) return <div className="flex justify-center pt-12"><Spinner /></div>
  if (!contract) return <div className="p-6 text-gray-500">Contrato não encontrado.</div>

  const transitions = statusTransitions[contract.status] ?? []
  const valorGlobal = contract.value ?? 0
  const totalEmpenhado = notes.reduce((s, n) => s + n.valor_empenhado, 0)
  const totalPago = executions.reduce((s, e) => s + e.valor_pago, 0)
  const saldoContratual = valorGlobal - totalEmpenhado

  return (
    <div className="h-full flex flex-col">
      {/* Page header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-3 shrink-0">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg text-gray-400 hover:text-metro-navy hover:bg-gray-100">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-base font-bold text-metro-navy leading-none truncate">{contract.title}</h1>
            <Badge status={contract.status} />
            <span className="text-xs text-gray-400 font-mono">#{contract.contract_number}</span>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">{contract.contractor?.company_name ?? contract.contractor?.full_name ?? '—'}</p>
        </div>
        {canManage && (
          <Link to={`/contracts/${id}/edit`}>
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-metro-navy hover:bg-gray-50 transition">
              <Edit size={13} /> Editar
            </button>
          </Link>
        )}
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto space-y-5">

          {/* Financial KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Valor Global', value: fmt(valorGlobal), icon: DollarSign, bg: 'bg-metro-navy', text: 'text-white' },
              { label: 'Total Empenhado', value: fmt(totalEmpenhado), icon: TrendingUp, bg: 'bg-metro-orange', text: 'text-white' },
              { label: 'Saldo Contratual', value: fmt(saldoContratual), icon: BarChart3,
                bg: saldoContratual >= 0 ? 'bg-green-600' : 'bg-red-600', text: 'text-white' },
              { label: 'Total Pago', value: fmt(totalPago), icon: DollarSign, bg: 'bg-blue-600', text: 'text-white' },
            ].map(kpi => (
              <div key={kpi.label} className={`${kpi.bg} rounded-xl p-4`}>
                <kpi.icon size={18} className={`${kpi.text} opacity-70 mb-2`} strokeWidth={1.8} />
                <p className={`text-lg font-bold leading-none ${kpi.text}`}>{kpi.value}</p>
                <p className={`text-xs font-medium opacity-70 mt-1 ${kpi.text}`}>{kpi.label}</p>
              </div>
            ))}
          </div>

          {/* Progress bars */}
          {valorGlobal > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
              <p className="text-xs font-bold text-metro-navy uppercase tracking-wider">Execução Financeira</p>
              <FinancialBar label="Empenhado" value={totalEmpenhado} total={valorGlobal} color="bg-metro-orange" />
              <FinancialBar label="Pago" value={totalPago} total={valorGlobal} color="bg-blue-500" />
              <FinancialBar label="Saldo" value={Math.max(saldoContratual, 0)} total={valorGlobal} color="bg-green-500" />
            </div>
          )}

          {/* Notas de Empenho resumo */}
          {notes.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 bg-gray-50">
                <div className="flex items-center gap-2.5">
                  <FileStack size={15} className="text-metro-navy" />
                  <p className="text-xs font-bold text-metro-navy uppercase tracking-wider">Notas de Empenho ({notes.length})</p>
                </div>
                <Link to="/empenhos" className="text-xs font-semibold text-metro-orange hover:text-orange-600">Ver todas</Link>
              </div>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-gray-50">
                  {notes.slice(0, 5).map(n => (
                    <tr key={n.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-medium text-metro-navy">{n.numero}</td>
                      <td className="px-4 py-2.5 text-gray-500 text-xs">{new Date(n.data_empenho).toLocaleDateString('pt-BR')}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-blue-700">{fmt(n.valor_empenhado)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Execuções resumo */}
          {executions.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 bg-gray-50">
                <div className="flex items-center gap-2.5">
                  <Banknote size={15} className="text-metro-navy" />
                  <p className="text-xs font-bold text-metro-navy uppercase tracking-wider">Pagamentos ({executions.length})</p>
                </div>
                <Link to="/execucao" className="text-xs font-semibold text-metro-orange hover:text-orange-600">Ver todos</Link>
              </div>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-gray-50">
                  {executions.slice(0, 5).map(e => (
                    <tr key={e.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-medium text-metro-navy">{e.numero_op ?? '—'}</td>
                      <td className="px-4 py-2.5 text-gray-500 text-xs">{new Date(e.data_pagamento).toLocaleDateString('pt-BR')}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-green-700">{fmt(e.valor_pago)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Info sections row */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* Objeto */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <p className="text-xs font-bold text-metro-navy uppercase tracking-wider mb-2">Objeto</p>
              <p className="text-sm text-gray-700">{contract.object}</p>
              {contract.notes && <p className="text-xs text-gray-400 mt-2 italic">{contract.notes}</p>}
            </div>

            {/* Vigência + SLA */}
            <div className="space-y-3">
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <p className="text-xs font-bold text-metro-navy uppercase tracking-wider mb-3">Vigência</p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-gray-400">Início</p>
                    <p className="font-medium text-metro-navy">{new Date(contract.start_date).toLocaleDateString('pt-BR')}</p>
                  </div>
                  {contract.end_date && (
                    <div>
                      <p className="text-xs text-gray-400">Término</p>
                      <p className="font-medium text-metro-navy">{new Date(contract.end_date).toLocaleDateString('pt-BR')}</p>
                    </div>
                  )}
                </div>
              </div>
              {(contract.sla_response_hours || contract.sla_completion_hours) && (
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <p className="text-xs font-bold text-metro-navy uppercase tracking-wider mb-3">SLA</p>
                  <div className="grid grid-cols-2 gap-3">
                    {contract.sla_response_hours && (
                      <div className="text-center bg-blue-50 rounded-lg p-3">
                        <p className="text-xs text-blue-600 font-medium">Resposta</p>
                        <p className="text-2xl font-black text-blue-700">{contract.sla_response_hours}h</p>
                      </div>
                    )}
                    {contract.sla_completion_hours && (
                      <div className="text-center bg-indigo-50 rounded-lg p-3">
                        <p className="text-xs text-indigo-600 font-medium">Conclusão</p>
                        <p className="text-2xl font-black text-indigo-700">{contract.sla_completion_hours}h</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Status control */}
          {canManage && transitions.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <p className="text-xs font-bold text-metro-navy uppercase tracking-wider mb-3">Controle de Status</p>
              <div className="flex gap-2 flex-wrap">
                {transitions.map(t => (
                  <button
                    key={t.next}
                    onClick={() => setConfirmStatus(t.next)}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition ${t.className}`}
                  >
                    <t.icon size={14} /> {t.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Assets */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 bg-gray-50">
              <p className="text-xs font-bold text-metro-navy uppercase tracking-wider">
                Ativos Vinculados ({assets.length})
              </p>
              {canManage && (
                <button onClick={() => setAddAssetOpen(true)}
                  className="flex items-center gap-1 text-xs font-semibold text-metro-orange hover:text-orange-600 transition">
                  <Plus size={13} /> Adicionar
                </button>
              )}
            </div>
            {assets.length === 0 ? (
              <div className="text-center py-8 text-gray-300">
                <Wrench size={28} className="mx-auto mb-2" />
                <p className="text-sm">Nenhum ativo vinculado.</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <tbody className="divide-y divide-gray-50">
                  {assets.map(asset => {
                    const Icon = assetTypeIcon[asset.type] ?? Wrench
                    return (
                      <tr key={asset.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                              <Icon size={15} className="text-metro-navy" />
                            </div>
                            <div>
                              <p className="font-medium text-metro-navy">{asset.name}</p>
                              <p className="text-xs text-gray-400 capitalize">
                                {asset.type === 'equipment' ? 'Equipamento' : asset.type === 'location' ? 'Localidade' : 'Edificação'}
                                {asset.location && ` · ${asset.location}`}
                              </p>
                            </div>
                          </div>
                        </td>
                        {canManage && (
                          <td className="px-4 py-3 text-right">
                            <button onClick={() => deleteAsset.mutate(asset.id)}
                              className="p-1.5 text-gray-300 hover:text-red-500 transition">
                              <Trash2 size={14} />
                            </button>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>

        </div>
      </div>

      {/* Modal: adicionar ativo */}
      <Modal open={addAssetOpen} onClose={() => setAddAssetOpen(false)} title="Adicionar Ativo">
        <form onSubmit={handleSubmit(onAddAsset)} className="space-y-4">
          <Input label="Nome *" error={errors.name?.message} {...register('name')} />
          <Select label="Tipo *" options={assetTypeOptions} error={errors.type?.message} {...register('type')} />
          <Input label="Localização" placeholder="Ex: Estação Central, Plataforma 2" {...register('location')} />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Descrição</label>
            <textarea rows={2}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-metro-orange outline-none"
              {...register('description')} />
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setAddAssetOpen(false)}>Cancelar</Button>
            <Button type="submit" className="flex-1" loading={isSubmitting}>Adicionar</Button>
          </div>
        </form>
      </Modal>

      {/* Modal: confirmar status */}
      <Modal open={confirmStatus !== null} onClose={() => setConfirmStatus(null)} title="Confirmar alteração de status" size="sm">
        <div className="text-center py-2">
          <AlertTriangle size={40} className="mx-auto text-yellow-500 mb-3" />
          <p className="text-sm text-gray-600 mb-4">
            Deseja realmente alterar o status para{' '}
            <strong className="text-metro-navy capitalize">{confirmStatus}</strong>?
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setConfirmStatus(null)}>Cancelar</Button>
            <Button className="flex-1"
              variant={confirmStatus === 'terminated' ? 'danger' : 'primary'}
              loading={statusMutation.isPending}
              onClick={async () => {
                if (confirmStatus) { await statusMutation.mutateAsync(confirmStatus); setConfirmStatus(null) }
              }}>
              Confirmar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
