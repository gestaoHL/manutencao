import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { z } from 'zod'
import { contractSchema, type ContractFormData } from '@/schemas/contract.schema'
import { useCreateContract, useUpdateContract, useContract } from '@/hooks/useContracts'
import { supabase } from '@/lib/supabase'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import type { Profile } from '@/types'

const statusOptions = [
  { value: 'active',     label: 'Ativo' },
  { value: 'suspended',  label: 'Suspenso' },
  { value: 'expired',    label: 'Expirado' },
  { value: 'terminated', label: 'Encerrado' },
]

export function ContractFormPage() {
  const { id } = useParams<{ id: string }>()
  const isEdit = !!id
  const navigate = useNavigate()

  const { data: existing, isLoading: loadingExisting } = useContract(id ?? '')
  const createMutation = useCreateContract()
  const updateMutation = useUpdateContract(id ?? '')

  const { data: contractors = [] } = useQuery({
    queryKey: ['profiles', 'contratada'],
    queryFn: async (): Promise<Profile[]> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, company_name, role, status, user_id, created_at')
        .eq('role', 'contratada')
        .eq('status', 'approved')
      if (error) throw error
      return data ?? []
    },
  })

  const contractorOptions = contractors.map(p => ({
    value: p.id,
    label: p.company_name ?? p.full_name ?? p.id,
  }))

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<z.input<typeof contractSchema>, unknown, ContractFormData>({
    resolver: zodResolver(contractSchema),
    defaultValues: { status: 'active' },
  })

  useEffect(() => {
    if (existing) {
      reset({
        title:                 existing.title,
        contract_number:       existing.contract_number,
        object:                existing.object,
        contractor_profile_id: existing.contractor_profile_id,
        value:                 existing.value,
        start_date:            existing.start_date,
        end_date:              existing.end_date ?? '',
        status:                existing.status,
        sla_response_hours:    existing.sla_response_hours,
        sla_completion_hours:  existing.sla_completion_hours,
        notes:                 existing.notes ?? '',
      })
    }
  }, [existing, reset])

  const onSubmit = async (data: ContractFormData) => {
    if (isEdit) {
      await updateMutation.mutateAsync(data)
    } else {
      await createMutation.mutateAsync(data)
    }
    navigate('/contracts')
  }

  if (isEdit && loadingExisting) return <Spinner />

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-metro-navy mb-5 transition">
        <ArrowLeft size={16} /> Voltar
      </button>

      <h1 className="text-xl font-bold text-metro-navy mb-6">
        {isEdit ? 'Editar Contrato' : 'Novo Contrato'}
      </h1>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <h2 className="text-sm font-semibold text-metro-navy uppercase tracking-wide">Dados Gerais</h2>
          <Input label="Título do Contrato *" error={errors.title?.message} {...register('title')} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Número do Contrato *" error={errors.contract_number?.message} {...register('contract_number')} />
            <Select label="Status *" options={statusOptions} error={errors.status?.message} {...register('status')} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Objeto do Contrato *</label>
            <textarea
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-metro-orange focus:ring-2 focus:ring-metro-orange/20 outline-none"
              {...register('object')}
            />
            {errors.object && <span className="text-xs text-red-500">{errors.object.message}</span>}
          </div>
          <Select
            label="Contratada *"
            options={contractorOptions}
            placeholder="Selecione a empresa contratada"
            error={errors.contractor_profile_id?.message}
            {...register('contractor_profile_id')}
          />
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <h2 className="text-sm font-semibold text-metro-navy uppercase tracking-wide">Vigência e Valor</h2>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Data de Início *" type="date" error={errors.start_date?.message} {...register('start_date')} />
            <Input label="Data de Término" type="date" {...register('end_date')} />
          </div>
          <Input
            label="Valor do Contrato (R$)"
            type="number"
            step="0.01"
            min="0"
            placeholder="0,00"
            error={errors.value?.message}
            {...register('value')}
          />
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <h2 className="text-sm font-semibold text-metro-navy uppercase tracking-wide">SLA — Nível de Serviço</h2>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Prazo de Resposta (horas)"
              type="number"
              min="1"
              placeholder="Ex: 4"
              error={errors.sla_response_hours?.message}
              {...register('sla_response_hours')}
            />
            <Input
              label="Prazo de Conclusão (horas)"
              type="number"
              min="1"
              placeholder="Ex: 48"
              error={errors.sla_completion_hours?.message}
              {...register('sla_completion_hours')}
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <h2 className="text-sm font-semibold text-metro-navy uppercase tracking-wide">Observações</h2>
          <textarea
            rows={3}
            placeholder="Observações adicionais, referências, links de documentos..."
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-metro-orange focus:ring-2 focus:ring-metro-orange/20 outline-none"
            {...register('notes')}
          />
        </div>

        <div className="flex gap-3 pb-6">
          <Button type="button" variant="ghost" className="flex-1" onClick={() => navigate(-1)}>Cancelar</Button>
          <Button type="submit" className="flex-1" loading={isSubmitting}>
            {isEdit ? 'Salvar Alterações' : 'Criar Contrato'}
          </Button>
        </div>
      </form>
    </div>
  )
}
