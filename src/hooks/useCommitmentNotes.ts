import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { CommitmentNote } from '@/types'

export function useCommitmentNotes(contractId?: string) {
  return useQuery({
    queryKey: ['commitment_notes', contractId],
    queryFn: async (): Promise<CommitmentNote[]> => {
      let query = supabase
        .from('commitment_notes')
        .select('*, contract:contracts(id,title,contract_number)')
        .order('data_empenho', { ascending: false })
      if (contractId) query = query.eq('contract_id', contractId)
      const { data, error } = await query
      if (error) throw error
      return (data ?? []) as CommitmentNote[]
    },
  })
}

export function useCreateCommitmentNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      contract_id: string
      numero: string
      valor_empenhado: number
      data_empenho: string
      descricao?: string
    }) => {
      const { error } = await supabase.from('commitment_notes').insert(payload)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['commitment_notes'] }),
  })
}

export function useUpdateCommitmentNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: {
      id: string
      contract_id: string
      numero: string
      valor_empenhado: number
      data_empenho: string
      descricao?: string
    }) => {
      const { error } = await supabase.from('commitment_notes').update(payload).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['commitment_notes'] }),
  })
}

export function useDeleteCommitmentNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('commitment_notes').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['commitment_notes'] }),
  })
}
