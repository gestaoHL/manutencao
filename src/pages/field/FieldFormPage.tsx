import { useState } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ChevronLeft, Wifi, WifiOff } from 'lucide-react'
import { usePlan } from '@/hooks/usePlans'
import { useFieldSubmit } from '@/hooks/useFieldSubmit'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import type { TemplateField } from '@/types'

const headerSchema = z.object({
  os_number: z.string().min(1, 'Número da OS obrigatório'),
  psa_item: z.string().min(1, 'Item da PSA obrigatório'),
})
type HeaderData = z.infer<typeof headerSchema>

function DynamicField({ field, value, onChange, error }: {
  field: TemplateField
  value: unknown
  onChange: (v: unknown) => void
  error?: string
}) {
  const base = 'w-full rounded-xl border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-metro-orange bg-white'
  const borderClass = error ? 'border-red-400' : 'border-gray-200'

  if (field.type === 'boolean') {
    return (
      <div className="flex items-center gap-3 py-1">
        <input
          type="checkbox"
          id={field.id}
          checked={!!value}
          onChange={e => onChange(e.target.checked)}
          className="w-5 h-5 accent-metro-orange"
        />
        <label htmlFor={field.id} className="text-sm text-metro-navy font-medium">
          {field.label}{field.required && ' *'}
        </label>
        {error && <span className="text-xs text-red-500">{error}</span>}
      </div>
    )
  }

  if (field.type === 'select' && field.options) {
    return (
      <div>
        <label className="block text-xs font-semibold text-metro-navy mb-1">
          {field.label}{field.required && ' *'}
        </label>
        <select
          value={(value as string) ?? ''}
          onChange={e => onChange(e.target.value)}
          className={`${base} ${borderClass}`}
        >
          <option value="">Selecione...</option>
          {field.options.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      </div>
    )
  }

  if (field.type === 'textarea') {
    return (
      <div>
        <label className="block text-xs font-semibold text-metro-navy mb-1">
          {field.label}{field.required && ' *'}
        </label>
        <textarea
          value={(value as string) ?? ''}
          onChange={e => onChange(e.target.value)}
          rows={3}
          className={`${base} ${borderClass} resize-none`}
        />
        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      </div>
    )
  }

  return (
    <div>
      <label className="block text-xs font-semibold text-metro-navy mb-1">
        {field.label}{field.required && ' *'}
      </label>
      <input
        type={field.type === 'number' ? 'number' : 'text'}
        value={(value as string) ?? ''}
        onChange={e => onChange(field.type === 'number' ? Number(e.target.value) : e.target.value)}
        className={`${base} ${borderClass}`}
      />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}

export function FieldFormPage() {
  const { planId } = useParams<{ planId: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const assetId = searchParams.get('asset') ?? ''
  const planType = (searchParams.get('type') ?? 'preventiva') as 'preventiva' | 'irq'
  const isOnline = navigator.onLine

  const { data: plan, isLoading } = usePlan(planId ?? '')
  const { submit, submitting } = useFieldSubmit()

  const { register, handleSubmit, formState: { errors } } = useForm<HeaderData>({
    resolver: zodResolver(headerSchema),
  })

  const [fieldValues, setFieldValues] = useState<Record<string, unknown>>({})
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  function setField(id: string, value: unknown) {
    setFieldValues(prev => ({ ...prev, [id]: value }))
    setFieldErrors(prev => { const n = { ...prev }; delete n[id]; return n })
  }

  async function onSubmit(header: HeaderData) {
    const fields = plan?.template_fields ?? []
    const newErrors: Record<string, string> = {}

    for (const f of fields) {
      const val = fieldValues[f.id]
      if (f.required && (val === undefined || val === '' || val === null)) {
        newErrors[f.id] = 'Campo obrigatório'
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setFieldErrors(newErrors)
      return
    }

    const result = await submit({
      plan_id: planId!,
      asset_id: assetId,
      plan_type: planType,
      os_number: header.os_number,
      psa_item: header.psa_item,
      form_data: fieldValues,
    })

    navigate('/field/success', { state: { mode: result } })
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-metro-bg flex items-center justify-center">
        <Spinner />
      </div>
    )
  }
  if (!plan) {
    return <div className="p-4 text-center text-gray-500">Plano não encontrado.</div>
  }

  return (
    <div className="min-h-screen bg-metro-bg pb-24">
      {/* Header */}
      <div className="bg-metro-navy px-4 pt-4 pb-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-white/70 hover:text-white">
            <ChevronLeft size={22} />
          </button>
          <div className="flex-1">
            <p className="text-white font-semibold text-sm">{plan.title}</p>
            <p className="text-white/50 text-xs capitalize">{planType}</p>
          </div>
          {isOnline
            ? <Wifi size={16} className="text-green-400" />
            : <WifiOff size={16} className="text-red-400" />
          }
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="p-4 max-w-lg mx-auto space-y-4">
        {/* OS + PSA */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3">
          <p className="text-xs font-bold text-metro-navy uppercase tracking-wide">Identificação</p>
          <Input
            label="Número da OS *"
            placeholder="Ex: OS-2024-001"
            error={errors.os_number?.message}
            {...register('os_number')}
          />
          <Input
            label="Item da PSA *"
            placeholder="Ex: 3.2.1"
            error={errors.psa_item?.message}
            {...register('psa_item')}
          />
        </div>

        {/* Dynamic fields */}
        {plan.template_fields.length > 0 && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-4">
            <p className="text-xs font-bold text-metro-navy uppercase tracking-wide">Checklist</p>
            {plan.template_fields.map(field => (
              <DynamicField
                key={field.id}
                field={field}
                value={fieldValues[field.id]}
                onChange={v => setField(field.id, v)}
                error={fieldErrors[field.id]}
              />
            ))}
          </div>
        )}

        {/* Submit */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100">
          <Button type="submit" loading={submitting} className="w-full">
            {isOnline ? 'Enviar' : 'Salvar (offline)'}
          </Button>
        </div>
      </form>
    </div>
  )
}
