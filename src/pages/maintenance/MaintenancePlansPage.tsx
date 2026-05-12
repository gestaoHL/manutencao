import { useState } from 'react'
import { Plus, Wrench, Zap, Calendar, Trash2, Edit2 } from 'lucide-react'
import { usePlans, useCreatePlan, useUpdatePlan, useDeletePlan } from '@/hooks/usePlans'
import { useAssets } from '@/hooks/useAssets'
import { useAuth } from '@/hooks/useAuth'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { Modal } from '@/components/ui/Modal'
import { PlanFormModal } from './PlanFormModal'
import type { MaintenancePlan, PlanType } from '@/types'
import type { PlanFormData } from '@/schemas/maintenance.schema'

export function MaintenancePlansPage() {
  const { profile } = useAuth()
  const canEdit = profile?.role === 'admin' || profile?.role === 'gestor'

  const [typeFilter, setTypeFilter] = useState<PlanType | ''>('')
  const [showCreate, setShowCreate] = useState(false)
  const [editTarget, setEditTarget] = useState<MaintenancePlan | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<MaintenancePlan | null>(null)

  const { data: plans, isLoading } = usePlans(undefined, typeFilter || undefined)
  const { data: allAssets } = useAssets(undefined)
  const createPlan = useCreatePlan()
  const updatePlan = useUpdatePlan(editTarget?.id ?? '')
  const deletePlan = useDeletePlan()

  async function handleCreate(data: PlanFormData) {
    await createPlan.mutateAsync(data)
  }

  async function handleUpdate(data: PlanFormData) {
    await updatePlan.mutateAsync(data)
  }

  async function handleDelete() {
    if (!deleteTarget) return
    await deletePlan.mutateAsync(deleteTarget.id)
    setDeleteTarget(null)
  }

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-metro-navy">Planos de Manutenção</h1>
          <p className="text-sm text-gray-500">{(plans ?? []).length} planos cadastrados</p>
        </div>
        {canEdit && (
          <Button onClick={() => setShowCreate(true)} size="sm">
            <Plus size={16} /> Novo Plano
          </Button>
        )}
      </div>

      {/* Type filter */}
      <div className="flex gap-2 mb-4">
        {(['', 'preventiva', 'irq'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${
              typeFilter === t
                ? 'bg-metro-orange text-white'
                : 'bg-white text-gray-500 border border-gray-200'
            }`}
          >
            {t === '' ? 'Todos' : t === 'preventiva' ? 'Preventiva' : 'IRQ'}
          </button>
        ))}
      </div>

      {isLoading ? (
        <Spinner />
      ) : (plans ?? []).length === 0 ? (
        <Card className="p-8 text-center text-gray-400">
          <Wrench size={32} className="mx-auto mb-2 text-gray-300" />
          <p className="text-sm">Nenhum plano cadastrado.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {(plans ?? []).map(plan => (
            <Card key={plan.id} className="p-4">
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-xl ${
                  plan.plan_type === 'preventiva'
                    ? 'bg-metro-orange/10 text-metro-orange'
                    : 'bg-metro-navy/10 text-metro-navy'
                }`}>
                  {plan.plan_type === 'preventiva' ? <Wrench size={16} /> : <Zap size={16} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-metro-navy text-sm">{plan.title}</p>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      plan.plan_type === 'preventiva'
                        ? 'bg-orange-100 text-metro-orange'
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {plan.plan_type === 'preventiva' ? 'Preventiva' : 'IRQ'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{plan.asset?.name ?? '—'}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                    <span>Freq: {plan.frequency}</span>
                    {plan.next_due && (
                      <span className="flex items-center gap-1">
                        <Calendar size={10} />
                        {new Date(plan.next_due).toLocaleDateString('pt-BR')}
                      </span>
                    )}
                    <span>{plan.template_fields.length} campos</span>
                  </div>
                </div>
                {canEdit && (
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => setEditTarget(plan)} className="text-gray-400 hover:text-metro-navy">
                      <Edit2 size={15} />
                    </button>
                    <button onClick={() => setDeleteTarget(plan)} className="text-gray-400 hover:text-red-500">
                      <Trash2 size={15} />
                    </button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <PlanFormModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSubmit={handleCreate}
        assets={allAssets ?? []}
      />

      {editTarget && (
        <PlanFormModal
          open={!!editTarget}
          onClose={() => setEditTarget(null)}
          onSubmit={handleUpdate}
          assets={allAssets ?? []}
          initial={editTarget}
        />
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
