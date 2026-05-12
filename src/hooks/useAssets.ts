import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Asset } from '@/types'
import type { AssetFormData } from '@/schemas/asset.schema'

export function useAssets(contractId: string | undefined) {
  return useQuery({
    queryKey: ['assets', contractId],
    queryFn: async (): Promise<Asset[]> => {
      let query = supabase
        .from('assets')
        .select('*, contract:contracts(id,title,contract_number)')
        .order('name')
      if (contractId) query = query.eq('contract_id', contractId)
      const { data, error } = await query
      if (error) throw error
      return (data ?? []) as Asset[]
    },
  })
}

export function useCreateAsset(contractId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: AssetFormData) => {
      const { error } = await supabase.from('assets').insert({ ...data, contract_id: contractId })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assets', contractId] }),
  })
}

export function useDeleteAsset(contractId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (assetId: string) => {
      const { error } = await supabase.from('assets').delete().eq('id', assetId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assets', contractId] }),
  })
}
