import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'
import type { Contract } from '@/types'
import type { ContractFormData } from '@/schemas/contract.schema'

export function useContracts() {
  const { profile } = useAuth()

  return useQuery({
    queryKey: ['contracts', profile?.id, profile?.role],
    queryFn: async (): Promise<Contract[]> => {
      let query = supabase
        .from('contracts')
        .select('*, contractor:profiles!contractor_profile_id(id,full_name,company_name), commitment_notes(valor_empenhado), budget_executions(valor_pago)')
        .order('created_at', { ascending: false })

      if (profile?.role === 'contratada') {
        query = query.eq('contractor_profile_id', profile.id)
      }

      const { data, error } = await query
      if (error) throw error
      return (data ?? []) as Contract[]
    },
    enabled: !!profile,
  })
}

export function useContract(id: string) {
  return useQuery({
    queryKey: ['contracts', id],
    queryFn: async (): Promise<Contract> => {
      const { data, error } = await supabase
        .from('contracts')
        .select('*, contractor:profiles!contractor_profile_id(id,full_name,company_name), assets(*)')
        .eq('id', id)
        .single()
      if (error) throw error
      return data as Contract
    },
    enabled: !!id,
  })
}

export function useCreateContract() {
  const qc = useQueryClient()
  const { profile } = useAuth()
  return useMutation({
    mutationFn: async (data: ContractFormData) => {
      const { error } = await supabase.from('contracts').insert({
        ...data,
        created_by: profile?.id,
      })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contracts'] }),
  })
}

export function useUpdateContract(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: Partial<ContractFormData>) => {
      const { error } = await supabase.from('contracts').update(data).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contracts'] }),
  })
}

export function useUpdateContractStatus(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (status: Contract['status']) => {
      const { error } = await supabase.from('contracts').update({ status }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contracts'] }),
  })
}
