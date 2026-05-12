import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  ArrowLeft, Edit, Plus, Trash2, MapPin,
  Wrench, Building, AlertTriangle, CheckCircle,
  PauseCircle, XCircle
} from 'lucide-react'
import { useContract, useUpdateContractStatus } from '@/hooks/useContracts'
import { useAssets, useCreateAsset, useDeleteAsset } from '@/hooks/useAssets'
import { assetSchema, type AssetFormData } from '@/schemas/asset.schema'
import { useAuth } from '@/hooks/useAuth'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
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

const assetTypeIcon = {
  equipment: Wrench,
  location: MapPin,
  building: Building,
}

const statusTransitions: Record<Contract['status'], { next: Contract['status']; label: string; icon: React.ElementType; color: string }[]> = {
  active:     [{ next: 'suspended', label: 'Suspender', icon: PauseCircle, color: 'bg-yellow-500 text-white' },
               { next: 'terminated',label: 'Encerrar',   icon: XCircle,     color: 'bg-red-600 text-white' }],
  suspended:  [{ next: 'active',    label: 'Reativar',  icon: CheckCircle, color: 'bg-green-600 text-white' },
               { next: 'terminated',label: 'Encerrar',   icon: XCircle,     color: 'bg-red-600 text-white' }],
  expired:    [{ next: 'terminated',label: 'Encerrar',   icon: XCircle,     color: 'bg-red-600 text-white' }],
  terminated: [],
}

export function ContractDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { data: contract, isLoading } = useContract(id ?? '')
  const { data: assets = [] } = useAssets(id ?? '')
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

  if (isLoading) return <Spinner />
  if (!contract) return <div className="p-4">Contrato não encontrado.</div>

  const transitions = statusTransitions[contract.status] ?? []

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-metro-navy mb-4 transition">
        <ArrowLeft size={16} /> Contratos
      </button>

      {/* Header */}
      <div className="bg-metro-navy text-white rounded-2xl p-5 mb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <Badge status={contract.status} />
              <span className="text-white/50 text-xs font-mono">#{contract.contract_number}</span>
            </div>
            <h1 className="font-bold text-lg leading-tight">{contract.title}</h1>
            <p className="text-white/70 text-sm mt-1">
              {contract.contractor?.company_name ?? contract.contractor?.full_name ?? '—'}
            </p>
          </div>
          {canManage && (
            <Link to={`/contracts/${id}/edit`}>
              <button className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition">
                <Edit size={16} />
              </button>
            </Link>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 mt-4">
          <div>
            <p className="text-white/50 text-xs">Início</p>
            <p className="font-medium text-sm">{new Date(contract.start_date).toLocaleDateString('pt-BR')}</p>
          </div>
          {contract.end_date && (
            <div>
              <p className="text-white/50 text-xs">Término</p>
              <p className="font-medium text-sm">{new Date(contract.end_date).toLocaleDateString('pt-BR')}</p>
            </div>
          )}
          {contract.value != null && (
            <div className="col-span-2">
              <p className="text-white/50 text-xs">Valor</p>
              <p className="font-bold text-metro-orange text-base">
                {contract.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Objeto */}
      <Card className="mb-4">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Objeto</h2>
        <p className="text-sm text-gray-700">{contract.object}</p>
        {contract.notes && <p className="text-xs text-gray-400 mt-2 italic">{contract.notes}</p>}
      </Card>

      {/* SLA */}
      {(contract.sla_response_hours || contract.sla_completion_hours) && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          {contract.sla_response_hours && (
            <div className="bg-blue-50 rounded-xl p-3 text-center">
              <p className="text-xs text-blue-600 font-medium">SLA Resposta</p>
              <p className="text-2xl font-black text-blue-700">{contract.sla_response_hours}h</p>
            </div>
          )}
          {contract.sla_completion_hours && (
            <div className="bg-indigo-50 rounded-xl p-3 text-center">
              <p className="text-xs text-indigo-600 font-medium">SLA Conclusão</p>
              <p className="text-2xl font-black text-indigo-700">{contract.sla_completion_hours}h</p>
            </div>
          )}
        </div>
      )}

      {/* Controle de status */}
      {canManage && transitions.length > 0 && (
        <Card className="mb-4">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Controle de Status</h2>
          <div className="flex gap-2 flex-wrap">
            {transitions.map(t => (
              <button
                key={t.next}
                onClick={() => setConfirmStatus(t.next)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${t.color}`}
              >
                <t.icon size={14} /> {t.label}
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* Ativos */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-metro-navy">Ativos Vinculados ({assets.length})</h2>
          {canManage && (
            <Button size="sm" variant="ghost" onClick={() => setAddAssetOpen(true)}>
              <Plus size={14} /> Adicionar
            </Button>
          )}
        </div>

        {assets.length === 0 && (
          <div className="text-center py-8 text-gray-300 border-2 border-dashed border-gray-200 rounded-2xl">
            <Wrench size={32} className="mx-auto mb-2" />
            <p className="text-sm">Nenhum ativo vinculado.</p>
          </div>
        )}

        <div className="space-y-2">
          {assets.map(asset => {
            const Icon = assetTypeIcon[asset.type] ?? Wrench
            return (
              <Card key={asset.id} className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-metro-bg flex items-center justify-center shrink-0">
                  <Icon size={18} className="text-metro-navy" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-metro-navy truncate">{asset.name}</p>
                  <p className="text-xs text-gray-400 capitalize">
                    {asset.type === 'equipment' ? 'Equipamento' : asset.type === 'location' ? 'Localidade' : 'Edificação'}
                    {asset.location && ` · ${asset.location}`}
                  </p>
                  {asset.description && <p className="text-xs text-gray-400 truncate">{asset.description}</p>}
                </div>
                {canManage && (
                  <button
                    onClick={() => deleteAsset.mutate(asset.id)}
                    className="p-1.5 text-gray-300 hover:text-red-500 transition shrink-0"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </Card>
            )
          })}
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
            <textarea
              rows={2}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-metro-orange outline-none"
              {...register('description')}
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="ghost" className="flex-1" onClick={() => setAddAssetOpen(false)}>Cancelar</Button>
            <Button type="submit" className="flex-1" loading={isSubmitting}>Adicionar</Button>
          </div>
        </form>
      </Modal>

      {/* Modal: confirmar status */}
      <Modal
        open={confirmStatus !== null}
        onClose={() => setConfirmStatus(null)}
        title="Confirmar alteração de status"
        size="sm"
      >
        <div className="text-center py-2">
          <AlertTriangle size={40} className="mx-auto text-yellow-500 mb-3" />
          <p className="text-sm text-gray-600 mb-4">
            Deseja realmente alterar o status do contrato para{' '}
            <strong className="text-metro-navy capitalize">{confirmStatus}</strong>?
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" className="flex-1" onClick={() => setConfirmStatus(null)}>Cancelar</Button>
            <Button
              className="flex-1"
              variant={confirmStatus === 'terminated' ? 'danger' : 'primary'}
              loading={statusMutation.isPending}
              onClick={async () => {
                if (confirmStatus) {
                  await statusMutation.mutateAsync(confirmStatus)
                  setConfirmStatus(null)
                }
              }}
            >
              Confirmar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
