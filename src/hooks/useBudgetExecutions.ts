import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { BudgetExecution } from '@/types'

export function useBudgetExecutions(contractId?: string) {
  return useQuery({
    queryKey: ['budget_executions', contractId],
    queryFn: async (): Promise<BudgetExecution[]> => {
      let query = supabase
        .from('budget_executions')
        .select('*, contract:contracts(id,title,contract_number), commitment_note:commitment_notes(id,numero)')
        .order('data_pagamento', { ascending: false })
      if (contractId) query = query.eq('contract_id', contractId)
      const { data, error } = await query
      if (error) throw error
      return (data ?? []) as BudgetExecution[]
    },
  })
}

export function useCreateBudgetExecution() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      contract_id: string
      commitment_note_id?: string | null
      data_pagamento: string
      valor_pago: number
      descricao?: string
      numero_op?: string
    }) => {
      const { error } = await supabase.from('budget_executions').insert(payload)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['budget_executions'] }),
  })
}

export function useUpdateBudgetExecution() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: {
      id: string
      contract_id: string
      commitment_note_id?: string | null
      data_pagamento: string
      valor_pago: number
      descricao?: string
      numero_op?: string
    }) => {
      const { error } = await supabase.from('budget_executions').update(payload).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['budget_executions'] }),
  })
}

export function useDeleteBudgetExecution() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('budget_executions').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['budget_executions'] }),
  })
}
