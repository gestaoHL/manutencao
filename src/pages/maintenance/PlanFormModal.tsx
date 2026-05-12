import { useEffect, useState } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, Trash2 } from 'lucide-react'
import { planSchema, type PlanFormData } from '@/schemas/maintenance.schema'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import type { Asset, MaintenancePlan } from '@/types'

interface Props {
  open: boolean
  onClose: () => void
  onSubmit: (data: PlanFormData) => Promise<void>
  assets: Asset[]
  initial?: MaintenancePlan
}

const FIELD_TYPE_OPTIONS = [
  { value: 'text', label: 'Texto' },
  { value: 'number', label: 'Número' },
  { value: 'textarea', label: 'Área de texto' },
  { value: 'select', label: 'Seleção' },
  { value: 'boolean', label: 'Sim/Não' },
]

export function PlanFormModal({ open, onClose, onSubmit, assets, initial }: Props) {
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const { register, handleSubmit, control, reset, watch, formState: { errors } } = useForm<PlanFormData>({
    resolver: zodResolver(planSchema),
    defaultValues: initial ?? {
      asset_id: '',
      title: '',
      plan_type: 'preventiva',
      frequency: '',
      next_due: null,
      template_fields: [],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'template_fields' })
  const watchedFields = watch('template_fields')

  useEffect(() => {
    if (open) {
      reset(initial ?? {
        asset_id: '',
        title: '',
        plan_type: 'preventiva',
        frequency: '',
        next_due: null,
        template_fields: [],
      })
      setServerError(null)
    }
  }, [open, initial, reset])

  async function onFormSubmit(data: PlanFormData) {
    setSaving(true)
    setServerError(null)
    try {
      await onSubmit(data)
      onClose()
    } catch (e) {
      setServerError(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  const assetOptions = assets.map(a => ({ value: a.id, label: a.name }))

  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Editar Plano' : 'Novo Plano'} size="lg">
      <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
        <Select
          label="Ativo *"
          options={assetOptions}
          placeholder="Selecione o ativo"
          error={errors.asset_id?.message}
          {...register('asset_id')}
        />
        <Input
          label="Título *"
          placeholder="Ex: Inspeção mensal de escadas rolantes"
          error={errors.title?.message}
          {...register('title')}
        />
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Tipo *"
            options={[{ value: 'preventiva', label: 'Preventiva' }, { value: 'irq', label: 'IRQ' }]}
            error={errors.plan_type?.message}
            {...register('plan_type')}
          />
          <Input
            label="Frequência *"
            placeholder="Ex: Mensal, Semanal"
            error={errors.frequency?.message}
            {...register('frequency')}
          />
        </div>
        <Input
          label="Próxima execução"
          type="date"
          {...register('next_due')}
        />

        {/* Template fields */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-metro-navy uppercase tracking-wide">Campos do Formulário</p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => append({ id: crypto.randomUUID(), label: '', type: 'text', required: false })}
            >
              <Plus size={14} /> Adicionar campo
            </Button>
          </div>
          <div className="space-y-3">
            {fields.map((field, idx) => (
              <div key={field.id} className="bg-gray-50 rounded-xl p-3 border border-gray-100 space-y-2">
                <div className="flex items-start gap-2">
                  <div className="flex-1 space-y-2">
                    <Input
                      label="Rótulo *"
                      placeholder="Ex: Temperatura do motor"
                      error={errors.template_fields?.[idx]?.label?.message}
                      {...register(`template_fields.${idx}.label`)}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <Select
                        label="Tipo"
                        options={FIELD_TYPE_OPTIONS}
                        {...register(`template_fields.${idx}.type`)}
                      />
                      <div className="flex items-center gap-2 pt-5">
                        <input
                          type="checkbox"
                          id={`req-${idx}`}
                          {...register(`template_fields.${idx}.required`)}
                          className="accent-metro-orange"
                        />
                        <label htmlFor={`req-${idx}`} className="text-sm text-metro-navy">Obrigatório</label>
                      </div>
                    </div>
                    {watchedFields?.[idx]?.type === 'select' && (
                      <Input
                        label="Opções (separadas por vírgula)"
                        placeholder="Bom, Regular, Ruim"
                        {...register(`template_fields.${idx}.options.0`)}
                      />
                    )}
                  </div>
                  <button type="button" onClick={() => remove(idx)} className="mt-5 text-red-400 hover:text-red-600">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {serverError && <p className="text-sm text-red-500">{serverError}</p>}

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">Cancelar</Button>
          <Button type="submit" loading={saving} className="flex-1">
            {initial ? 'Salvar' : 'Criar Plano'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
