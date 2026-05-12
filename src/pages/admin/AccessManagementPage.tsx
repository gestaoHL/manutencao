import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, X, Clock, Users } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import type { Profile } from '@/types'

async function fetchPendingProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

async function updateProfileStatus(id: string, status: 'approved' | 'rejected') {
  const { error } = await supabase.from('profiles').update({ status }).eq('id', id)
  if (error) throw error
}

export function AccessManagementPage() {
  const qc = useQueryClient()
  const [activeTab, setActiveTab] = useState<'pending' | 'all'>('pending')

  const { data: pending = [], isLoading } = useQuery({
    queryKey: ['profiles', 'pending'],
    queryFn: fetchPendingProfiles,
  })

  const { data: allProfiles = [], isLoading: loadingAll } = useQuery({
    queryKey: ['profiles', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles').select('*').order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as Profile[]
    },
    enabled: activeTab === 'all',
  })

  const mutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'approved' | 'rejected' }) =>
      updateProfileStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profiles'] })
    },
  })

  const roleLabel: Record<string, string> = {
    admin: 'Admin', gestor: 'Gestor', fiscalizacao: 'Fiscalização', contratada: 'Contratada',
  }

  const displayed = activeTab === 'pending' ? pending : allProfiles

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Users size={22} className="text-metro-orange" />
        <h1 className="text-xl font-bold text-metro-navy">Gestão de Acessos</h1>
        {pending.length > 0 && (
          <span className="bg-metro-orange text-white text-xs font-bold px-2 py-0.5 rounded-full">
            {pending.length}
          </span>
        )}
      </div>

      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setActiveTab('pending')}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
            activeTab === 'pending' ? 'bg-metro-navy text-white' : 'bg-white border border-gray-200 text-gray-600'
          }`}
        >
          Pendentes ({pending.length})
        </button>
        <button
          onClick={() => setActiveTab('all')}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
            activeTab === 'all' ? 'bg-metro-navy text-white' : 'bg-white border border-gray-200 text-gray-600'
          }`}
        >
          Todos
        </button>
      </div>

      {(isLoading || loadingAll) && <Spinner />}

      {!isLoading && displayed.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <Clock size={40} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm">Nenhum acesso pendente.</p>
        </div>
      )}

      <div className="space-y-3">
        {displayed.map(profile => (
          <Card key={profile.id} className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-metro-bg flex items-center justify-center font-bold text-metro-navy shrink-0">
              {profile.full_name?.charAt(0).toUpperCase() ?? '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-metro-navy text-sm truncate">{profile.full_name}</p>
              <p className="text-xs text-gray-500">
                {roleLabel[profile.role]} · {profile.company_name ?? 'Sem empresa'}
              </p>
              <p className="text-xs text-gray-400">
                {new Date(profile.created_at).toLocaleDateString('pt-BR')}
              </p>
            </div>
            <Badge status={profile.status} />
            {profile.status === 'pending' && (
              <div className="flex gap-2 shrink-0">
                <Button
                  size="sm"
                  onClick={() => mutation.mutate({ id: profile.id, status: 'approved' })}
                  loading={mutation.isPending}
                >
                  <Check size={14} />
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => mutation.mutate({ id: profile.id, status: 'rejected' })}
                  loading={mutation.isPending}
                >
                  <X size={14} />
                </Button>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  )
}
