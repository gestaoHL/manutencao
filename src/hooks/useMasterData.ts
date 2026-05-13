import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Company, Equipment, Locality, Periodicity, Sistema } from '@/types'

// ─── Companies ────────────────────────────────────────────────────────────────

export function useCompanies() {
  return useQuery({
    queryKey: ['companies'],
    queryFn: async (): Promise<Company[]> => {
      const { data, error } = await supabase.from('companies').select('*').order('name')
      if (error) throw error
      return (data ?? []) as Company[]
    },
  })
}

export function useCreateCompany() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { name: string; cnpj?: string; contact?: string; email?: string }) => {
      const { error } = await supabase.from('companies').insert(payload)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['companies'] }),
  })
}

export function useUpdateCompany() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string; name: string; cnpj?: string; contact?: string; email?: string }) => {
      const { error } = await supabase.from('companies').update(payload).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['companies'] }),
  })
}

export function useDeleteCompany() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('companies').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['companies'] }),
  })
}

// ─── Equipment ────────────────────────────────────────────────────────────────

type EquipmentPayload = { name: string; tag?: string; description?: string; sistema_id?: string | null; locality_id?: string | null }

export function useEquipment() {
  return useQuery({
    queryKey: ['equipment'],
    queryFn: async (): Promise<Equipment[]> => {
      const { data, error } = await supabase
        .from('equipment')
        .select('*, sistema:sistemas(id,name), locality:localities(id,name)')
        .order('name')
      if (error) throw error
      return (data ?? []) as Equipment[]
    },
  })
}

export function useCreateEquipment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: EquipmentPayload) => {
      const { error } = await supabase.from('equipment').insert(payload)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['equipment'] }),
  })
}

export function useUpdateEquipment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string } & EquipmentPayload) => {
      const { error } = await supabase.from('equipment').update(payload).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['equipment'] }),
  })
}

export function useDeleteEquipment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('equipment').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['equipment'] }),
  })
}

// ─── Localities ───────────────────────────────────────────────────────────────

export function useLocalities() {
  return useQuery({
    queryKey: ['localities'],
    queryFn: async (): Promise<Locality[]> => {
      const { data, error } = await supabase
        .from('localities')
        .select('*')
        .order('name')
      if (error) throw error
      return (data ?? []) as Locality[]
    },
  })
}

export function useCreateLocality() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { name: string; description?: string }) => {
      const { error } = await supabase.from('localities').insert(payload)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['localities'] }),
  })
}

export function useUpdateLocality() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string; name: string; description?: string }) => {
      const { error } = await supabase.from('localities').update(payload).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['localities'] }),
  })
}

export function useDeleteLocality() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('localities').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['localities'] }),
  })
}

// ─── Periodicities ────────────────────────────────────────────────────────────

export function usePeriodicities() {
  return useQuery({
    queryKey: ['periodicities'],
    queryFn: async (): Promise<Periodicity[]> => {
      const { data, error } = await supabase
        .from('periodicities')
        .select('*')
        .order('interval_days')
      if (error) throw error
      return (data ?? []) as Periodicity[]
    },
  })
}

export function useCreatePeriodicity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { name: string; interval_days: number }) => {
      const { error } = await supabase.from('periodicities').insert(payload)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['periodicities'] }),
  })
}

export function useUpdatePeriodicity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string; name: string; interval_days: number }) => {
      const { error } = await supabase.from('periodicities').update(payload).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['periodicities'] }),
  })
}

export function useDeletePeriodicity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('periodicities').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['periodicities'] }),
  })
}

// ─── Sistemas ─────────────────────────────────────────────────────────────────

export function useSistemas() {
  return useQuery({
    queryKey: ['sistemas'],
    queryFn: async (): Promise<Sistema[]> => {
      const { data, error } = await supabase.from('sistemas').select('*').order('name')
      if (error) throw error
      return (data ?? []) as Sistema[]
    },
  })
}

export function useCreateSistema() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { name: string; description?: string }) => {
      const { error } = await supabase.from('sistemas').insert(payload)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sistemas'] }),
  })
}

export function useUpdateSistema() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string; name: string; description?: string }) => {
      const { error } = await supabase.from('sistemas').update(payload).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sistemas'] }),
  })
}

export function useDeleteSistema() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('sistemas').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sistemas'] }),
  })
}
