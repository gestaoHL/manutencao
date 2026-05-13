import { useEffect, useState } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, Trash2, FileText, ChevronDown, X } from 'lucide-react'
import { planSchema, type PlanFormData } from '@/schemas/maintenance.schema'
import { usePeriodicities, useSistemas } from '@/hooks/useMasterData'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { useFormsCatalogByType } from '@/hooks/useFormsCatalog'
import type { MaintenancePlan } from '@/types'

interface Props {
  open: boolean
  onClose: () => void
  onSubmit: (data: PlanFormData) => Promise<void>
  initial?: MaintenancePlan
}

const FIELD_TYPE_OPTIONS = [
  { value: 'text',     label: 'Texto' },
  { value: 'number',   label: 'Número' },
  { value: 'textarea', label: 'Área de texto' },
  { value: 'select',   label: 'Seleção' },
  { value: 'boolean',  label: 'Sim/Não' },
]

export function PlanFormModal({ open, onClose, onSubmit, initial }: Props) {
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [showFormPicker, setShowFormPicker] = useState(false)

  const { data: periodicities } = usePeriodicities()
  const { data: sistemas } = useSistemas()

  const defaultValues: PlanFormData = {
    asset_id: null,
    periodicity_id: '',
    sistema_id: null,
    title: '',
    plan_type: 'preventiva',
    frequency: null,
    form_url: null,
    template_fields: [],
  }

  const { register, handleSubmit, control, reset, watch, setValue, formState: { errors } } = useForm<PlanFormData>({
    resolver: zodResolver(planSchema),
    defaultValues: initial
      ? {
          asset_id: initial.asset_id ?? null,
          periodicity_id: initial.periodicity_id ?? '',
          sistema_id: initial.sistema_id ?? null,
          title: initial.title,
          plan_type: initial.plan_type,
          frequency: initial.frequency ?? null,
          form_url: initial.form_url ?? null,
          template_fields: initial.template_fields,
        }
      : defaultValues,
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'template_fields' })
  const watchedFields = watch('template_fields')
  const planType = watch('plan_type')
  const { data: availableForms = [] } = useFormsCatalogByType(planType)

  useEffect(() => {
    if (open) {
      setShowFormPicker(false)
      reset(
        initial
          ? {
              asset_id: initial.asset_id ?? null,
              periodicity_id: initial.periodicity_id ?? '',
              sistema_id: initial.sistema_id ?? null,
              title: initial.title,
              plan_type: initial.plan_type,
              frequency: initial.frequency ?? null,
              form_url: initial.form_url ?? null,
              template_fields: initial.template_fields,
            }
          : defaultValues,
      )
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

  const periodicityOptions = (periodicities ?? []).map(p => ({ value: p.id, label: `${p.name} (${p.interval_days}d)` }))
  const sistemaOptions = (sistemas ?? []).map(s => ({ value: s.id, label: s.name }))

  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Editar Plano' : 'Novo Plano de Manutenção'} size="lg">
      <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">

        <Input
          label="Título do Plano *"
          placeholder="Ex: Inspeção de escada rolante"
          error={errors.title?.message}
          {...register('title')}
        />

        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Tipo *"
            options={[
              { value: 'preventiva', label: 'Preventiva' },
              { value: 'irq',        label: 'IRQ' },
            ]}
            error={errors.plan_type?.message}
            {...register('plan_type', {
              onChange: () => { setValue('form_url', null); setShowFormPicker(false) },
            })}
          />
          <Select
            label="Periodicidade *"
            options={periodicityOptions}
            placeholder="Selecione"
            error={errors.periodicity_id?.message}
            {...register('periodicity_id')}
          />
        </div>

        <Select
          label="Sistema"
          options={sistemaOptions}
          placeholder="Selecione o sistema (opcional)"
          {...register('sistema_id')}
        />

        {/* Form file picker */}
        <div>
          <p className="text-xs font-semibold text-gray-700 mb-1">Formulário vinculado</p>
          {watch('form_url') ? (
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2.5">
              <FileText size={14} className="text-blue-500 shrink-0" />
              <span className="flex-1 text-sm text-blue-800 font-medium truncate">
                {availableForms.find(f => f.path === watch('form_url'))?.label ?? watch('form_url')}
              </span>
              <button
                type="button"
                onClick={() => { setValue('form_url', ''); setShowFormPicker(false) }}
                className="text-blue-400 hover:text-blue-600"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowFormPicker(v => !v)}
              className="w-full flex items-center justify-between gap-2 border border-dashed border-gray-300 rounded-xl px-3 py-2.5 text-sm text-gray-400 hover:border-metro-orange hover:text-metro-orange transition"
            >
              <span className="flex items-center gap-2">
                <FileText size={14} />
                Selecionar formulário (opcional)
              </span>
              <ChevronDown size={14} className={showFormPicker ? 'rotate-180' : ''} />
            </button>
          )}
          {showFormPicker && !watch('form_url') && (
            <div className="mt-1 border border-gray-200 rounded-xl overflow-hidden shadow-sm">
              {availableForms.length === 0 ? (
                <p className="text-xs text-gray-400 px-3 py-3 text-center">Nenhum formulário cadastrado para este tipo de plano</p>
              ) : availableForms.map(f => (
                <button
                  key={f.path}
                  type="button"
                  onClick={() => { setValue('form_url', f.path); setShowFormPicker(false) }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-metro-orange/5 transition text-left border-b border-gray-100 last:border-0"
                >
                  <FileText size={14} className="text-metro-orange shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-metro-navy">{f.label}</p>
                    <p className="text-xs text-gray-400 font-mono">{f.path}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
          {errors.form_url && <p className="text-xs text-red-500 mt-1">{errors.form_url.message}</p>}
        </div>

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
            {initial ? 'Salvar alterações' : 'Criar Plano'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
