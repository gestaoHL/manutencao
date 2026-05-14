import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface Employee {
  id: string
  company_id: string
  nome: string
  matricula: string
  funcao: string | null
  status: 'ativo' | 'inativo'
  created_at: string
  company?: { name: string }
}

export function useEmployees(companyId?: string) {
  return useQuery({
    queryKey: ['employees', companyId],
    queryFn: async (): Promise<Employee[]> => {
      let q = supabase
        .from('employees')
        .select('*, company:companies(name)')
        .order('nome')
      if (companyId) q = q.eq('company_id', companyId)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as Employee[]
    },
  })
}

export function useCreateEmployee() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { company_id: string; nome: string; matricula: string; funcao?: string; status: string }) => {
      const { error } = await supabase.from('employees').insert(payload)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employees'] }),
  })
}

export function useUpdateEmployee() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string; company_id: string; nome: string; matricula: string; funcao?: string; status: string }) => {
      const { error } = await supabase.from('employees').update(payload).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employees'] }),
  })
}

export function useDeleteEmployee() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('employees').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employees'] }),
  })
}
