import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { MaintenancePlan, PlanType } from '@/types'
import type { PlanFormData } from '@/schemas/maintenance.schema'

export function usePlans(assetId?: string, planType?: PlanType) {
  return useQuery({
    queryKey: ['plans', assetId, planType],
    queryFn: async (): Promise<MaintenancePlan[]> => {
      let query = supabase
        .from('maintenance_plans')
        .select(`
          *,
          asset:assets(id,name,type,location),
          periodicity:periodicities(id,name,interval_days),
          company:companies(id,name)
        `)
        .order('created_at', { ascending: false })

      if (assetId) query = query.eq('asset_id', assetId)
      if (planType) query = query.eq('plan_type', planType)

      const { data, error } = await query
      if (error) throw error
      return (data ?? []) as MaintenancePlan[]
    },
  })
}

export function usePlan(id: string) {
  return useQuery({
    queryKey: ['plans', id],
    queryFn: async (): Promise<MaintenancePlan> => {
      const { data, error } = await supabase
        .from('maintenance_plans')
        .select(`
          *,
          asset:assets(id,name,type,location),
          periodicity:periodicities(id,name,interval_days),
          company:companies(id,name)
        `)
        .eq('id', id)
        .single()
      if (error) throw error
      return data as MaintenancePlan
    },
    enabled: !!id,
  })
}

function sanitizePlan(data: PlanFormData) {
  return {
    title:          data.title,
    plan_type:      data.plan_type,
    periodicity_id: data.periodicity_id || null,
    asset_id:       data.asset_id       || null,
    company_id:     data.company_id     || null,
    sistema_id:     data.sistema_id     || null,
    frequency:      data.frequency      || null,
    form_url:       data.form_url       || null,
    template_fields: data.template_fields,
  }
}

export function useCreatePlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: PlanFormData) => {
      const { error } = await supabase.from('maintenance_plans').insert(sanitizePlan(data))
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plans'] }),
  })
}

export function useUpdatePlan(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: Partial<PlanFormData>) => {
      const { error } = await supabase.from('maintenance_plans').update(sanitizePlan(data as PlanFormData)).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plans'] }),
  })
}

export function useDeletePlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('maintenance_plans').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plans'] }),
  })
}

export function usePublicAssets() {
  return useQuery({
    queryKey: ['public-assets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('assets')
        .select('id, name, type, location, contract:contracts(id,title,contract_number)')
        .order('name')
      if (error) throw error
      return data ?? []
    },
  })
}
