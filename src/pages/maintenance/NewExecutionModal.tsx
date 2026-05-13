import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Copy, Check, ExternalLink } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { usePlans } from '@/hooks/usePlans'
import { useLocalities, useCompanies } from '@/hooks/useMasterData'
import { useSubmitExecution, useCreateDraftExecution } from '@/hooks/useExecutions'
import type { MaintenancePlan, PlanType, TemplateField } from '@/types'
import { useEquipment } from '@/hooks/useMasterData'

const headerSchema = z.object({
  plan_id:        z.string().uuid('Selecione um plano'),
  company_id:     z.string().uuid('Empresa responsável obrigatória'),
  equipment_id:   z.string().uuid('Equipamento obrigatório'),
  locality_id:    z.string().uuid('Localidade obrigatória'),
  os_number:      z.string().min(1, 'Nº da OS obrigatório'),
  psa_item:       z.string().min(1, 'Item PSA obrigatório'),
  scheduled_date: z.string().min(1, 'Data obrigatória'),
})
type HeaderForm = z.infer<typeof headerSchema>

interface Props {
  open: boolean
  onClose: () => void
  planType: PlanType
}

function DynamicField({ field, value, onChange }: {
  field: TemplateField
  value: unknown
  onChange: (v: unknown) => void
}) {
  if (field.type === 'boolean') {
    return (
      <div className="flex items-center gap-3 py-2 border-b border-gray-50">
        <span className="flex-1 text-sm text-metro-navy">{field.label}</span>
        <div className="flex gap-2">
          {['Sim', 'Não', 'N/A'].map(opt => (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold border transition ${
                value === opt
                  ? opt === 'Sim' ? 'bg-green-500 text-white border-green-500'
                  : opt === 'Não' ? 'bg-red-500 text-white border-red-500'
                  : 'bg-gray-400 text-white border-gray-400'
                  : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>
    )
  }

  if (field.type === 'textarea') {
    return (
      <div className="py-2 border-b border-gray-50">
        <label className="block text-sm text-metro-navy mb-1">{field.label}</label>
        <textarea
          value={String(value ?? '')}
          onChange={e => onChange(e.target.value)}
          rows={3}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-metro-orange resize-none"
        />
      </div>
    )
  }

  if (field.type === 'select') {
    return (
      <div className="py-2 border-b border-gray-50">
        <label className="block text-sm text-metro-navy mb-1">{field.label}</label>
        <select
          value={String(value ?? '')}
          onChange={e => onChange(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-metro-orange bg-white"
        >
          <option value="">Selecione</option>
          {(field.options ?? []).map(o => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      </div>
    )
  }

  return (
    <div className="py-2 border-b border-gray-50">
      <label className="block text-sm text-metro-navy mb-1">{field.label}</label>
      <input
        type={field.type === 'number' ? 'number' : 'text'}
        value={String(value ?? '')}
        onChange={e => onChange(field.type === 'number' ? Number(e.target.value) : e.target.value)}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-metro-orange"
      />
    </div>
  )
}

export function NewExecutionModal({ open, onClose, planType }: Props) {
  const [step, setStep] = useState<'header' | 'form' | 'link'>('header')
  const [selectedPlan, setSelectedPlan] = useState<MaintenancePlan | null>(null)
  const [formData, setFormData] = useState<Record<string, unknown>>({})
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [generatedLink, setGeneratedLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const { data: plans } = usePlans(undefined, planType)
  const { data: localities } = useLocalities()
  const { data: companies } = useCompanies()
  const { data: equipmentList } = useEquipment()
  const submit = useSubmitExecution()
  const createDraft = useCreateDraftExecution()

  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm<HeaderForm>({
    resolver: zodResolver(headerSchema),
    defaultValues: { plan_id: '', company_id: '', equipment_id: '', locality_id: '', os_number: '', psa_item: '', scheduled_date: '' },
  })

  const watchedPlanId = watch('plan_id')

  useEffect(() => {
    if (!open) { setStep('header'); setSelectedPlan(null); setFormData({}); setServerError(null); setGeneratedLink(null); setCopied(false); reset() }
  }, [open, reset])

  useEffect(() => {
    const plan = (plans ?? []).find(p => p.id === watchedPlanId) ?? null
    setSelectedPlan(plan)
  }, [watchedPlanId, plans])

  const planOptions = (plans ?? []).map(p => ({ value: p.id, label: p.title }))
  const companyOptions = (companies ?? []).map(c => ({ value: c.id, label: c.name }))
  const localityOptions = (localities ?? []).map(l => ({ value: l.id, label: l.name }))
  const equipmentOptions = (equipmentList ?? []).map(e => ({ value: e.id, label: e.tag ? `${e.name} (${e.tag})` : e.name }))

  async function onHeaderValid(data: HeaderForm) {
    if (selectedPlan?.form_url) {
      setSaving(true)
      setServerError(null)
      try {
        const executionId = await createDraft.mutateAsync({
          plan_id:        data.plan_id,
          company_id:     data.company_id,
          equipment_id:   data.equipment_id,
          locality_id:    data.locality_id,
          plan_type:      planType,
          os_number:      data.os_number,
          psa_item:       data.psa_item,
          scheduled_date: data.scheduled_date,
        })
        const base = selectedPlan.form_url!.startsWith('/')
          ? window.location.origin + selectedPlan.form_url
          : selectedPlan.form_url!
        const link = `${base}?id=${executionId}`
        setGeneratedLink(link)
        setStep('link')
        window.open(link, '_blank', 'noopener,noreferrer')
      } catch (e) {
        setServerError(e instanceof Error ? e.message : 'Erro ao criar OS')
      } finally {
        setSaving(false)
      }
      return
    }
    setStep('form')
    const initial: Record<string, unknown> = {}
    for (const f of selectedPlan?.template_fields ?? []) initial[f.id] = ''
    setFormData(prev => ({ ...initial, ...prev }))
    void data
  }

  async function handleFinalSubmit() {
    setSaving(true)
    setServerError(null)
    const values = watch()
    try {
      await submit.mutateAsync({
        plan_id:        values.plan_id,
        company_id:     values.company_id,
        equipment_id:   values.equipment_id,
        locality_id:    values.locality_id,
        plan_type:      planType,
        os_number:      values.os_number,
        psa_item:       values.psa_item,
        scheduled_date: values.scheduled_date,
        form_data:      formData,
      })
      onClose()
    } catch (e) {
      setServerError(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  const typeLabel = planType === 'preventiva' ? 'Preventiva' : 'IRQ'

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Nova OS ${typeLabel}`}
      size="lg"
    >
      {step === 'link' && generatedLink ? (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-800">
            <p className="font-semibold mb-1">OS criada com sucesso!</p>
            <p className="text-xs text-green-700">O formulário foi aberto em uma nova aba. A OS também está disponível na tela de pendentes para o operador de campo.</p>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Link direto do formulário</p>
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
              <ExternalLink size={14} className="text-gray-400 flex-shrink-0" />
              <span className="flex-1 text-xs text-gray-600 truncate font-mono">{generatedLink}</span>
              <button
                type="button"
                onClick={() => { navigator.clipboard.writeText(generatedLink!); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
                className="flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-gray-200 text-xs font-semibold text-gray-600 hover:border-metro-orange hover:text-metro-orange transition"
              >
                {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                {copied ? 'Copiado!' : 'Copiar'}
              </button>
            </div>
          </div>

          <p className="text-xs text-gray-400">
            O operador pode acessar a OS em <strong>/field/pending</strong> ou pelo link direto acima. Após o envio, a OS aparecerá com status <strong>Em análise</strong>.
          </p>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1">Fechar</Button>
            <Button
              type="button"
              onClick={() => window.open(generatedLink, '_blank', 'noopener,noreferrer')}
              className="flex-1"
            >
              <ExternalLink size={14} /> Reabrir formulário
            </Button>
          </div>
        </div>
      ) : step === 'header' ? (
        <form onSubmit={handleSubmit(onHeaderValid)} className="space-y-4">
          <Select
            label="Plano de Manutenção *"
            options={planOptions}
            placeholder="Selecione o plano"
            error={errors.plan_id?.message}
            {...register('plan_id')}
          />

          <Select
            label="Empresa Responsável *"
            options={companyOptions}
            placeholder="Selecione a empresa"
            error={errors.company_id?.message}
            {...register('company_id')}
          />

          <Select
            label="Equipamento *"
            options={equipmentOptions}
            placeholder="Selecione o equipamento"
            error={errors.equipment_id?.message}
            {...register('equipment_id')}
          />

          {selectedPlan && (
            <div className="bg-blue-50 rounded-xl px-4 py-3 text-sm text-blue-800 space-y-0.5">
              {selectedPlan.periodicity && (
                <p><span className="font-semibold">Periodicidade:</span> {selectedPlan.periodicity.name}</p>
              )}
              <p><span className="font-semibold">Campos no formulário:</span> {selectedPlan.template_fields?.length ?? 0}</p>
            </div>
          )}

          <Select
            label="Localidade *"
            options={localityOptions}
            placeholder="Selecione a localidade"
            error={errors.locality_id?.message}
            {...register('locality_id')}
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Nº da OS *"
              placeholder="Ex: OS-2024-001"
              error={errors.os_number?.message}
              {...register('os_number')}
            />
            <Input
              label="Item PSA *"
              placeholder="Ex: 3.1.2"
              error={errors.psa_item?.message}
              {...register('psa_item')}
            />
          </div>

          <Input
            label="Data Programada *"
            type="date"
            error={errors.scheduled_date?.message}
            {...register('scheduled_date')}
          />

          {serverError && <p className="text-sm text-red-500">{serverError}</p>}

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1">Cancelar</Button>
            <Button type="submit" loading={saving} className="flex-1">
              {selectedPlan?.form_url
                ? 'Criar OS e abrir formulário'
                : selectedPlan
                  ? `Preencher formulário (${selectedPlan.template_fields?.length ?? 0} campos)`
                  : 'Próximo'}
            </Button>
          </div>
        </form>
      ) : (
        <div className="space-y-4">
          <div className="bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-700">
            <p className="font-semibold text-metro-navy">{selectedPlan?.title}</p>
          </div>

          <div className="max-h-[50vh] overflow-y-auto space-y-0 pr-1">
            {(selectedPlan?.template_fields ?? []).map(field => (
              <DynamicField
                key={field.id}
                field={field}
                value={formData[field.id]}
                onChange={v => setFormData(prev => ({ ...prev, [field.id]: v }))}
              />
            ))}
          </div>

          {serverError && <p className="text-sm text-red-500">{serverError}</p>}

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setStep('header')} className="flex-1">Voltar</Button>
            <Button type="button" loading={saving} onClick={handleFinalSubmit} className="flex-1">
              Enviar OS
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
