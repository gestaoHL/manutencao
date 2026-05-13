import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'
import type { MaintenanceExecution, PlanType, ExecutionStatus } from '@/types'

const METRO_DF_NAME = 'METRÔ-DF'

function isMetroDF(profile: { company?: { name: string } | null } | null) {
  return !profile?.company || profile.company.name === METRO_DF_NAME
}

export function useExecutions(planType?: PlanType) {
  const { profile } = useAuth()

  return useQuery({
    queryKey: ['executions', planType, profile?.id, profile?.role, profile?.company_id],
    queryFn: async (): Promise<MaintenanceExecution[]> => {
      let query = supabase
        .from('maintenance_executions')
        .select('*, plan:maintenance_plans(id,title,plan_type,template_fields,form_url,company_id), locality:localities(id,name), asset:assets(id,name,location), equipment:equipment(id,name,tag)')
        .order('created_at', { ascending: false })

      if (planType) query = query.eq('plan_type', planType)

      // Filtra por empresa do usuário, exceto METRÔ-DF que vê tudo
      if (!isMetroDF(profile) && profile?.company_id) {
        query = query.eq('plan.company_id', profile.company_id)
      }

      const { data, error } = await query
      if (error) throw error
      return (data ?? []) as MaintenanceExecution[]
    },
    enabled: !!profile,
  })
}

export function useExecution(id: string) {
  return useQuery({
    queryKey: ['executions', id],
    queryFn: async (): Promise<MaintenanceExecution> => {
      const { data, error } = await supabase
        .from('maintenance_executions')
        .select('*, plan:maintenance_plans(id,title,plan_type,template_fields), locality:localities(id,name), asset:assets(id,name,location), equipment:equipment(id,name,tag)')
        .eq('id', id)
        .single()
      if (error) throw error
      return data as MaintenanceExecution
    },
    enabled: !!id,
  })
}

export function useSubmitExecution() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: {
      plan_id: string
      company_id: string
      equipment_id: string
      asset_id?: string | null
      locality_id: string
      plan_type: PlanType
      os_number: string
      psa_item: string
      scheduled_date: string
      form_data: Record<string, unknown>
    }) => {
      const { error } = await supabase.from('maintenance_executions').insert({
        ...data,
        status: 'pendente',
      })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['executions'] }),
  })
}

export function useCreateDraftExecution() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: {
      plan_id: string
      company_id: string
      equipment_id: string
      locality_id: string
      plan_type: PlanType
      os_number: string
      psa_item: string
      scheduled_date: string
    }): Promise<string> => {
      const { data: row, error } = await supabase
        .from('maintenance_executions')
        .insert({ ...data, status: 'pendente', form_data: {} })
        .select('id')
        .single()
      if (error) throw error
      return row.id as string
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['executions'] }),
  })
}

export function useSubmitExecutionForm() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, form_data }: { id: string; form_data: Record<string, unknown> }) => {
      const { error } = await supabase
        .from('maintenance_executions')
        .update({ form_data, status: 'em_analise' })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['executions'] }),
  })
}

export function useUpdateExecutionStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, status, rejection_reason, internal_notes }: { id: string; status: ExecutionStatus; rejection_reason?: string; internal_notes?: string }) => {
      const { error } = await supabase
        .from('maintenance_executions')
        .update({ status, ...(rejection_reason ? { rejection_reason } : {}), ...(internal_notes !== undefined ? { internal_notes } : {}) })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['executions'] }),
  })
}

export function usePublicPendingExecutions() {
  return useQuery({
    queryKey: ['executions', 'public', 'pendente'],
    queryFn: async (): Promise<MaintenanceExecution[]> => {
      const { data, error } = await supabase
        .from('maintenance_executions')
        .select('*, plan:maintenance_plans(id,title,plan_type,template_fields,form_url), locality:localities(id,name), equipment:equipment(id,name,tag)')
        .eq('status', 'pendente')
        .order('scheduled_date', { ascending: true })
      if (error) throw error
      return (data ?? []) as MaintenanceExecution[]
    },
  })
}

export function useAllExecutions() {
  const { profile } = useAuth()

  return useQuery({
    queryKey: ['executions', 'all', profile?.id, profile?.role],
    queryFn: async (): Promise<MaintenanceExecution[]> => {
      let query = supabase
        .from('maintenance_executions')
        .select('*, plan:maintenance_plans(id,title,plan_type,template_fields), locality:localities(id,name), asset:assets(id,name,location), equipment:equipment(id,name,tag)')
        .order('created_at', { ascending: false })

      const { data, error } = await query
      if (error) throw error
      return (data ?? []) as MaintenanceExecution[]
    },
    enabled: !!profile,
  })
}
