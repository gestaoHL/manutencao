import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface FormCatalogEntry {
  id:             string
  filename:       string
  label:          string
  path:           string
  plan_type:      'preventiva' | 'irq'
  sistema_id:     string | null
  periodicity_id: string | null
  sistema?:       { id: string; name: string } | null
  periodicity?:   { id: string; name: string } | null
}

const QK = 'forms_catalog'

export function useFormsCatalog() {
  return useQuery({
    queryKey: [QK],
    queryFn: async (): Promise<FormCatalogEntry[]> => {
      const { data, error } = await supabase
        .from('forms_catalog')
        .select('*, sistema:sistemas(id,name), periodicity:periodicities(id,name)')
        .order('plan_type')
        .order('label')
      if (error) throw error
      return (data ?? []) as FormCatalogEntry[]
    },
  })
}

export function useFormsCatalogByType(planType: string) {
  return useQuery({
    queryKey: [QK, planType],
    queryFn: async (): Promise<FormCatalogEntry[]> => {
      const { data, error } = await supabase
        .from('forms_catalog')
        .select('*, sistema:sistemas(id,name), periodicity:periodicities(id,name)')
        .eq('plan_type', planType)
        .order('label')
      if (error) throw error
      return (data ?? []) as FormCatalogEntry[]
    },
    enabled: !!planType,
  })
}

type CreatePayload = Omit<FormCatalogEntry, 'id' | 'sistema' | 'periodicity'>

export function useCreateFormEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreatePayload) => {
      const { error } = await supabase.from('forms_catalog').insert(payload)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK] }),
  })
}

export function useUpdateFormEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, sistema, periodicity, ...payload }: FormCatalogEntry) => {
      const { error } = await supabase.from('forms_catalog').update(payload).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK] }),
  })
}

export function useDeleteFormEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('forms_catalog').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK] }),
  })
}
