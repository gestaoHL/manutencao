import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, X, Clock, Users, ShieldOff, Pencil } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { Modal } from '@/components/ui/Modal'
import { Select } from '@/components/ui/Select'
import { useCompanies } from '@/hooks/useMasterData'
import type { Profile, UserRole } from '@/types'

const ROLE_OPTIONS = [
  { value: 'admin',          label: 'Admin' },
  { value: 'gestor',         label: 'Gestor' },
  { value: 'fiscalizacao',   label: 'Fiscalização' },
  { value: 'contratada',     label: 'Contratada' },
  { value: 'operador_campo', label: 'Operador de Campo' },
]

const roleLabel: Record<string, string> = {
  admin: 'Admin', gestor: 'Gestor', fiscalizacao: 'Fiscalização',
  contratada: 'Contratada', operador_campo: 'Operador de Campo',
}

async function updateProfile(id: string, patch: { status?: string; role?: UserRole; company_id?: string | null }) {
  const { error } = await supabase.from('profiles').update(patch).eq('id', id)
  if (error) throw error
}

export function AccessManagementPage() {
  const qc = useQueryClient()
  const [activeTab, setActiveTab] = useState<'pending' | 'all'>('pending')
  const [editTarget, setEditTarget] = useState<Profile | null>(null)
  const [editRole, setEditRole] = useState<UserRole>('contratada')
  const [editCompanyId, setEditCompanyId] = useState<string>('')

  const { data: companies = [] } = useCompanies()

  const { data: pending = [], isLoading } = useQuery({
    queryKey: ['profiles', 'pending'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles').select('*, company:companies(id,name)').eq('status', 'pending').order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as Profile[]
    },
  })

  const { data: allProfiles = [], isLoading: loadingAll } = useQuery({
    queryKey: ['profiles', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles').select('*, company:companies(id,name)').order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as Profile[]
    },
    enabled: activeTab === 'all',
  })

  const mutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: { status?: string; role?: UserRole; company_id?: string | null } }) =>
      updateProfile(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profiles'] }),
  })

  function openEdit(profile: Profile) {
    setEditTarget(profile)
    setEditRole(profile.role)
    setEditCompanyId(profile.company_id ?? '')
  }

  function handleSaveEdit() {
    if (!editTarget) return
    mutation.mutate({
      id: editTarget.id,
      patch: { role: editRole, company_id: editCompanyId || null },
    }, {
      onSuccess: () => setEditTarget(null),
    })
  }

  const displayed = activeTab === 'pending' ? pending : allProfiles

  return (
    <div className="p-6 max-w-5xl">
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
          <p className="text-sm">Nenhum registro encontrado.</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {displayed.map(profile => (
          <Card key={profile.id} className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-metro-bg flex items-center justify-center font-bold text-metro-navy shrink-0">
              {profile.full_name?.charAt(0).toUpperCase() ?? '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-metro-navy text-sm truncate">{profile.full_name}</p>
              <p className="text-xs text-gray-500">
                {roleLabel[profile.role]} · {profile.company?.name ?? profile.company_name ?? 'Sem empresa vinculada'}
              </p>
              <p className="text-xs text-gray-400">
                {new Date(profile.created_at).toLocaleDateString('pt-BR')}
              </p>
            </div>

            <Badge status={profile.status} />

            <div className="flex gap-1.5 shrink-0">
              {/* Aprovar pendente */}
              {profile.status === 'pending' && (
                <Button
                  size="sm"
                  onClick={() => mutation.mutate({ id: profile.id, patch: { status: 'approved' } })}
                  loading={mutation.isPending}
                  title="Aprovar acesso"
                >
                  <Check size={14} />
                </Button>
              )}

              {/* Rejeitar pendente */}
              {profile.status === 'pending' && (
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => mutation.mutate({ id: profile.id, patch: { status: 'rejected' } })}
                  loading={mutation.isPending}
                  title="Rejeitar acesso"
                >
                  <X size={14} />
                </Button>
              )}

              {/* Revogar aprovado */}
              {profile.status === 'approved' && (
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => mutation.mutate({ id: profile.id, patch: { status: 'rejected' } })}
                  loading={mutation.isPending}
                  title="Revogar acesso"
                >
                  <ShieldOff size={14} />
                </Button>
              )}

              {/* Reativar rejeitado */}
              {profile.status === 'rejected' && (
                <Button
                  size="sm"
                  onClick={() => mutation.mutate({ id: profile.id, patch: { status: 'approved' } })}
                  loading={mutation.isPending}
                  title="Reativar acesso"
                >
                  <Check size={14} />
                </Button>
              )}

              {/* Editar perfil (sempre disponível) */}
              <Button
                size="sm"
                variant="secondary"
                onClick={() => openEdit(profile)}
                title="Alterar perfil"
              >
                <Pencil size={14} />
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {/* Modal editar perfil */}
      <Modal
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        title="Alterar Perfil do Usuário"
      >
        {editTarget && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-xl px-4 py-3">
              <p className="font-semibold text-metro-navy text-sm">{editTarget.full_name}</p>
              <p className="text-xs text-gray-500">{editTarget.company_name ?? 'Sem empresa'}</p>
            </div>

            <Select
              label="Perfil de acesso"
              options={ROLE_OPTIONS}
              value={editRole}
              onChange={e => setEditRole(e.target.value as UserRole)}
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Empresa vinculada</label>
              <select
                value={editCompanyId}
                onChange={e => setEditCompanyId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:border-metro-orange focus:ring-2 focus:ring-metro-orange/20"
              >
                <option value="">— Sem empresa vinculada —</option>
                {companies.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1">
                Usuários da empresa <strong>METRÔ-DF</strong> têm acesso a todas as OSs e IRQs.
              </p>
            </div>

            <div className="flex gap-3 pt-1">
              <Button variant="secondary" onClick={() => setEditTarget(null)} className="flex-1">
                Cancelar
              </Button>
              <Button onClick={handleSaveEdit} loading={mutation.isPending} className="flex-1">
                Salvar
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
