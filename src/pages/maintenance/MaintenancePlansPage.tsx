import { useState } from 'react'
import { Plus, Wrench, Zap, Calendar, Trash2, Edit2, Cpu, Clock, ClipboardCheck } from 'lucide-react'
import { usePlans, useCreatePlan, useUpdatePlan, useDeletePlan } from '@/hooks/usePlans'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { Modal } from '@/components/ui/Modal'
import { PlanFormModal } from './PlanFormModal'
import type { MaintenancePlan, PlanType } from '@/types'
import type { PlanFormData } from '@/schemas/maintenance.schema'

const TYPE_LABEL: Record<PlanType, { label: string; className: string }> = {
  preventiva: { label: 'Preventiva', className: 'bg-orange-50 text-metro-orange border border-orange-200' },
  irq:        { label: 'IRQ',        className: 'bg-blue-50 text-blue-700 border border-blue-200' },
}

export function MaintenancePlansPage() {
  const { profile } = useAuth()
  const canEdit = profile?.role === 'admin' || profile?.role === 'gestor'

  const [typeFilter, setTypeFilter] = useState<PlanType | ''>('')
  const [showCreate, setShowCreate] = useState(false)
  const [editTarget, setEditTarget] = useState<MaintenancePlan | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<MaintenancePlan | null>(null)

  const { data: plans, isLoading } = usePlans(undefined, typeFilter || undefined)
  const createPlan = useCreatePlan()
  const updatePlan = useUpdatePlan(editTarget?.id ?? '')
  const deletePlan = useDeletePlan()

  async function handleCreate(data: PlanFormData) { await createPlan.mutateAsync(data) }
  async function handleUpdate(data: PlanFormData) { await updatePlan.mutateAsync(data) }
  async function handleDelete() {
    if (!deleteTarget) return
    await deletePlan.mutateAsync(deleteTarget.id)
    setDeleteTarget(null)
  }

  return (
    <div className="h-full flex flex-col">
      {/* Page header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-metro-navy/10 flex items-center justify-center">
            <ClipboardCheck size={18} className="text-metro-navy" />
          </div>
          <div>
            <h1 className="text-base font-bold text-metro-navy leading-none">Planos de Manutenção</h1>
            <p className="text-xs text-gray-400 mt-0.5">{(plans ?? []).length} planos cadastrados</p>
          </div>
        </div>
        {canEdit && (
          <Button onClick={() => setShowCreate(true)} size="sm">
            <Plus size={15} /> Novo Plano
          </Button>
        )}
      </div>

      {/* Filter bar */}
      <div className="bg-white border-b border-gray-100 px-6 py-2.5 flex items-center gap-2 shrink-0">
        <span className="text-xs text-gray-400 mr-1">Tipo:</span>
        {(['', 'preventiva', 'irq'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition border ${
              typeFilter === t
                ? 'bg-metro-navy text-white border-metro-navy'
                : 'bg-white text-gray-500 border-gray-200 hover:border-metro-navy/40'
            }`}
          >
            {t === '' ? 'Todos' : t === 'preventiva' ? 'Preventiva' : 'IRQ'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="flex justify-center pt-12"><Spinner /></div>
        ) : (plans ?? []).length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <ClipboardCheck size={36} className="mx-auto mb-3 text-gray-200" />
            <p className="text-sm font-medium text-gray-400">Nenhum plano cadastrado</p>
            {canEdit && (
              <p className="text-xs text-gray-400 mt-1">
                Cadastre equipamentos e localidades em{' '}
                <a href="/admin/settings" className="text-metro-orange hover:underline">Configurações</a>{' '}
                antes de criar um plano.
              </p>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Plano</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Tipo</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Equipamento</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Periodicidade</th>
                  {canEdit && <th className="px-4 py-3 w-16" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(plans ?? []).map(plan => {
                  const typeInfo = TYPE_LABEL[plan.plan_type]
                  return (
                    <tr key={plan.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className={`p-1.5 rounded-lg ${plan.plan_type === 'preventiva' ? 'bg-orange-50' : 'bg-blue-50'}`}>
                            {plan.plan_type === 'preventiva'
                              ? <Wrench size={13} className="text-metro-orange" />
                              : <Zap size={13} className="text-blue-600" />
                            }
                          </div>
                          <div>
                            <p className="font-medium text-metro-navy">{plan.title}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold ${typeInfo.className}`}>
                          {typeInfo.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {plan.periodicity ? (
                          <span className="flex items-center gap-1.5 text-gray-700">
                            <Clock size={12} className="text-gray-400" />
                            {plan.periodicity.name}
                          </span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      {canEdit && (
                        <td className="px-4 py-3">
                          <div className="flex gap-1 justify-end">
                            <button
                              onClick={() => setEditTarget(plan)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-metro-navy hover:bg-gray-100 transition"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              onClick={() => setDeleteTarget(plan)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <PlanFormModal open={showCreate} onClose={() => setShowCreate(false)} onSubmit={handleCreate} />
      {editTarget && (
        <PlanFormModal open={!!editTarget} onClose={() => setEditTarget(null)} onSubmit={handleUpdate} initial={editTarget} />
      )}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Confirmar exclusão">
        <p className="text-sm text-gray-600 mb-4">
          Tem certeza que deseja excluir o plano <strong>{deleteTarget?.title}</strong>?
        </p>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => setDeleteTarget(null)} className="flex-1">Cancelar</Button>
          <Button variant="danger" onClick={handleDelete} loading={deletePlan.isPending} className="flex-1">Excluir</Button>
        </div>
      </Modal>
    </div>
  )
}
