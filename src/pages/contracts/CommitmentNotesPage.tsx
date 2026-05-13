import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Edit2, Trash2, FileStack, Search } from 'lucide-react'
import {
  useCommitmentNotes,
  useCreateCommitmentNote,
  useUpdateCommitmentNote,
  useDeleteCommitmentNote,
} from '@/hooks/useCommitmentNotes'
import { useBudgetExecutions } from '@/hooks/useBudgetExecutions'
import { useContracts } from '@/hooks/useContracts'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { Spinner } from '@/components/ui/Spinner'
import type { CommitmentNote } from '@/types'

const schema = z.object({
  contract_id:      z.string().uuid('Selecione o contrato'),
  numero:           z.string().min(1, 'Número obrigatório'),
  valor_empenhado:  z.coerce.number().min(0.01, 'Valor deve ser positivo'),
  data_empenho:     z.string().min(1, 'Data obrigatória'),
  descricao:        z.string().optional(),
})
type FormData = z.infer<typeof schema>

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export function CommitmentNotesPage() {
  const { profile } = useAuth()
  const canManage = profile?.role === 'admin' || profile?.role === 'gestor'

  const [contractFilter, setContractFilter] = useState('')
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<CommitmentNote | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CommitmentNote | null>(null)

  const { data: notes, isLoading } = useCommitmentNotes(contractFilter || undefined)
  const { data: executions = [] } = useBudgetExecutions(contractFilter || undefined)
  const { data: contracts = [] } = useContracts()

  // saldo remanescente por nota = valor_empenhado - total pago vinculado a essa nota
  const pagoPorNota = executions.reduce<Record<string, number>>((acc, e) => {
    if (e.commitment_note_id) {
      acc[e.commitment_note_id] = (acc[e.commitment_note_id] ?? 0) + e.valor_pago
    }
    return acc
  }, {})
  const create = useCreateCommitmentNote()
  const update = useUpdateCommitmentNote()
  const remove = useDeleteCommitmentNote()

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const contractOptions = contracts.map(c => ({ value: c.id, label: `${c.contract_number} — ${c.title}` }))

  const filtered = (notes ?? []).filter(n =>
    !search ||
    n.numero.toLowerCase().includes(search.toLowerCase()) ||
    (n.contract?.title ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (n.contract?.contract_number ?? '').toLowerCase().includes(search.toLowerCase())
  )

  const totalEmpenhado = filtered.reduce((s, n) => s + n.valor_empenhado, 0)

  function openCreate() {
    reset({ contract_id: contractFilter || '', numero: '', valor_empenhado: 0, data_empenho: '', descricao: '' })
    setEditing(null)
    setShowForm(true)
  }

  function openEdit(note: CommitmentNote) {
    reset({
      contract_id:     note.contract_id,
      numero:          note.numero,
      valor_empenhado: note.valor_empenhado,
      data_empenho:    note.data_empenho,
      descricao:       note.descricao ?? '',
    })
    setEditing(note)
    setShowForm(true)
  }

  async function onSubmit(data: FormData) {
    if (editing) await update.mutateAsync({ id: editing.id, ...data })
    else await create.mutateAsync(data)
    setShowForm(false)
  }

  async function handleDelete() {
    if (!deleteTarget) return
    await remove.mutateAsync(deleteTarget.id)
    setDeleteTarget(null)
  }

  return (
    <div className="h-full flex flex-col">
      {/* Page header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
            <FileStack size={18} className="text-blue-600" />
          </div>
          <div>
            <h1 className="text-base font-bold text-metro-navy leading-none">Notas de Empenho</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              {filtered.length} nota{filtered.length !== 1 ? 's' : ''} · Total: {fmt(totalEmpenhado)}
            </p>
          </div>
        </div>
        {canManage && (
          <Button size="sm" onClick={openCreate}>
            <Plus size={15} /> Nova Nota
          </Button>
        )}
      </div>

      {/* Filter bar */}
      <div className="bg-white border-b border-gray-100 px-6 py-2.5 flex items-center gap-3 shrink-0 flex-wrap">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            placeholder="Buscar por número ou contrato..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 pr-3 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-metro-orange bg-white w-64"
          />
        </div>
        <select
          value={contractFilter}
          onChange={e => setContractFilter(e.target.value)}
          className="pl-3 pr-8 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-metro-orange bg-white"
        >
          <option value="">Todos os contratos</option>
          {contracts.map(c => (
            <option key={c.id} value={c.id}>{c.contract_number} — {c.title}</option>
          ))}
        </select>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="flex justify-center pt-12"><Spinner /></div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <FileStack size={36} className="mx-auto mb-3 text-gray-200" />
            <p className="text-sm font-medium text-gray-400">Nenhuma nota de empenho cadastrada.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Nº Nota</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Contrato</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Data Empenho</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Valor Empenhado</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Saldo Remanescente</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Descrição</th>
                  {canManage && <th className="px-4 py-3 w-16" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(note => (
                  <tr key={note.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-metro-navy">{note.numero}</p>
                      <p className="text-xs text-gray-400 mt-0.5 md:hidden">{note.contract?.contract_number}</p>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <p className="font-medium text-gray-700 truncate max-w-[220px]">{note.contract?.title ?? '—'}</p>
                      <p className="text-xs text-gray-400">{note.contract?.contract_number}</p>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell text-gray-600">
                      {new Date(note.data_empenho).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-semibold text-blue-700">{fmt(note.valor_empenhado)}</span>
                    </td>
                    <td className="px-4 py-3 text-right hidden sm:table-cell">
                      {(() => {
                        const saldo = note.valor_empenhado - (pagoPorNota[note.id] ?? 0)
                        return (
                          <span className={`font-semibold ${saldo >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {fmt(saldo)}
                          </span>
                        )
                      })()}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-gray-500 text-xs max-w-[200px] truncate">
                      {note.descricao ?? '—'}
                    </td>
                    {canManage && (
                      <td className="px-4 py-3">
                        <div className="flex gap-1 justify-end">
                          <button onClick={() => openEdit(note)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-metro-navy hover:bg-gray-100 transition">
                            <Edit2 size={13} />
                          </button>
                          <button onClick={() => setDeleteTarget(note)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 border-t border-gray-200">
                  <td colSpan={3} className="px-4 py-3 text-xs font-bold text-metro-navy uppercase tracking-wide hidden sm:table-cell">
                    Total
                  </td>
                  <td colSpan={3} className="px-4 py-3 text-xs font-bold text-metro-navy uppercase tracking-wide sm:hidden">
                    Total
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-blue-700">
                    {fmt(totalEmpenhado)}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-green-600 hidden sm:table-cell">
                    {fmt(totalEmpenhado - executions.reduce((s, e) => s + e.valor_pago, 0))}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Form modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? 'Editar Nota de Empenho' : 'Nova Nota de Empenho'}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Select
            label="Contrato *"
            options={contractOptions}
            placeholder="Selecione o contrato"
            error={errors.contract_id?.message}
            {...register('contract_id')}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Número da Nota *"
              placeholder="Ex: 2025NE000123"
              error={errors.numero?.message}
              {...register('numero')}
            />
            <Input
              label="Data do Empenho *"
              type="date"
              error={errors.data_empenho?.message}
              {...register('data_empenho')}
            />
          </div>
          <Input
            label="Valor Empenhado (R$) *"
            type="number"
            step="0.01"
            min="0.01"
            placeholder="0,00"
            error={errors.valor_empenhado?.message}
            {...register('valor_empenhado')}
          />
          <div>
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1.5">Descrição</label>
            <textarea
              rows={2}
              placeholder="Descrição do empenho..."
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-metro-orange focus:ring-2 focus:ring-metro-orange/20 outline-none"
              {...register('descricao')}
            />
          </div>
          <div className="flex gap-3 pt-1">
            <Button type="button" variant="secondary" onClick={() => setShowForm(false)} className="flex-1">Cancelar</Button>
            <Button type="submit" loading={isSubmitting} className="flex-1">Salvar</Button>
          </div>
        </form>
      </Modal>

      {/* Delete modal */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Confirmar exclusão" size="sm">
        <p className="text-sm text-gray-600 mb-4">
          Excluir a nota <strong>{deleteTarget?.numero}</strong>? Esta ação não pode ser desfeita.
        </p>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => setDeleteTarget(null)} className="flex-1">Cancelar</Button>
          <Button variant="danger" loading={remove.isPending} onClick={handleDelete} className="flex-1">Excluir</Button>
        </div>
      </Modal>
    </div>
  )
}
