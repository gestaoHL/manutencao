import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { MaintenanceHistory } from '@/types'

export function useExecutionHistory(executionId: string) {
  return useQuery({
    queryKey: ['history', executionId],
    queryFn: async (): Promise<MaintenanceHistory[]> => {
      const { data, error } = await supabase
        .from('maintenance_history')
        .select('*')
        .eq('execution_id', executionId)
        .order('changed_at', { ascending: false })
      if (error) throw error

      const rows = (data ?? []) as MaintenanceHistory[]
      if (rows.length === 0) return rows

      // Busca nomes dos usuários separadamente (sem depender de FK)
      const ids = [...new Set(rows.map(r => r.changed_by).filter(Boolean))] as string[]
      if (ids.length === 0) return rows

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .in('id', ids)

      const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]))

      return rows.map(r => ({
        ...r,
        changer: r.changed_by ? profileMap[r.changed_by] ?? null : null,
      }))
    },
    enabled: !!executionId,
  })
}
