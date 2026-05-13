import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Edit2, Trash2, Banknote, Search } from 'lucide-react'
import {
  useBudgetExecutions,
  useCreateBudgetExecution,
  useUpdateBudgetExecution,
  useDeleteBudgetExecution,
} from '@/hooks/useBudgetExecutions'
import { useCommitmentNotes } from '@/hooks/useCommitmentNotes'
import { useContracts } from '@/hooks/useContracts'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { Spinner } from '@/components/ui/Spinner'
import type { BudgetExecution } from '@/types'

const schema = z.object({
  contract_id:        z.string().uuid('Selecione o contrato'),
  commitment_note_id: z.string().uuid().nullable().optional(),
  data_pagamento:     z.string().min(1, 'Data obrigatória'),
  valor_pago:         z.coerce.number().min(0.01, 'Valor deve ser positivo'),
  numero_op:          z.string().optional(),
  descricao:          z.string().optional(),
})
type FormData = z.infer<typeof schema>

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export function BudgetExecutionPage() {
  const { profile } = useAuth()
  const canManage = profile?.role === 'admin' || profile?.role === 'gestor'

  const [contractFilter, setContractFilter] = useState('')
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<BudgetExecution | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<BudgetExecution | null>(null)
  const [formContractId, setFormContractId] = useState('')

  const { data: executions, isLoading } = useBudgetExecutions(contractFilter || undefined)
  const { data: contracts = [] } = useContracts()
  const { data: allNotes = [] } = useCommitmentNotes(formContractId || undefined)
  const create = useCreateBudgetExecution()
  const update = useUpdateBudgetExecution()
  const remove = useDeleteBudgetExecution()

  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const watchedContractId = watch('contract_id')

  const contractOptions = contracts.map(c => ({ value: c.id, label: `${c.contract_number} — ${c.title}` }))
  const noteOptions = allNotes
    .filter(n => n.contract_id === (watchedContractId || formContractId))
    .map(n => ({ value: n.id, label: `${n.numero} — ${fmt(n.valor_empenhado)}` }))

  const filtered = (executions ?? []).filter(e =>
    !search ||
    (e.numero_op ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (e.contract?.title ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (e.commitment_note?.numero ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (e.descricao ?? '').toLowerCase().includes(search.toLowerCase())
  )

  const totalPago = filtered.reduce((s, e) => s + e.valor_pago, 0)

  function openCreate() {
    const cid = contractFilter || ''
    setFormContractId(cid)
    reset({ contract_id: cid, commitment_note_id: null, data_pagamento: '', valor_pago: 0, numero_op: '', descricao: '' })
    setEditing(null)
    setShowForm(true)
  }

  function openEdit(exec: BudgetExecution) {
    setFormContractId(exec.contract_id)
    reset({
      contract_id:        exec.contract_id,
      commitment_note_id: exec.commitment_note_id ?? null,
      data_pagamento:     exec.data_pagamento,
      valor_pago:         exec.valor_pago,
      numero_op:          exec.numero_op ?? '',
      descricao:          exec.descricao ?? '',
    })
    setEditing(exec)
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
          <div className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center">
            <Banknote size={18} className="text-green-600" />
          </div>
          <div>
            <h1 className="text-base font-bold text-metro-navy leading-none">Execução Orçamentária</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              {filtered.length} lançamento{filtered.length !== 1 ? 's' : ''} · Total pago: {fmt(totalPago)}
            </p>
          </div>
        </div>
        {canManage && (
          <Button size="sm" onClick={openCreate}>
            <Plus size={15} /> Novo Lançamento
          </Button>
        )}
      </div>

      {/* Filter bar */}
      <div className="bg-white border-b border-gray-100 px-6 py-2.5 flex items-center gap-3 shrink-0 flex-wrap">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            placeholder="Buscar por OP, contrato, nota..."
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
            <Banknote size={36} className="mx-auto mb-3 text-gray-200" />
            <p className="text-sm font-medium text-gray-400">Nenhum lançamento de execução orçamentária.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Ordem de Pagamento</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Contrato</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Nota de Empenho</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Data Pagamento</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Valor Pago</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Descrição</th>
                  {canManage && <th className="px-4 py-3 w-16" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(exec => (
                  <tr key={exec.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-metro-navy">{exec.numero_op ?? '—'}</p>
                      <p className="text-xs text-gray-400 mt-0.5 md:hidden">{exec.contract?.contract_number}</p>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <p className="font-medium text-gray-700 truncate max-w-[200px]">{exec.contract?.title ?? '—'}</p>
                      <p className="text-xs text-gray-400">{exec.contract?.contract_number}</p>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-gray-600">
                      {exec.commitment_note?.numero ?? <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell text-gray-600">
                      {new Date(exec.data_pagamento).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-semibold text-green-700">{fmt(exec.valor_pago)}</span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-gray-500 text-xs max-w-[200px] truncate">
                      {exec.descricao ?? '—'}
                    </td>
                    {canManage && (
                      <td className="px-4 py-3">
                        <div className="flex gap-1 justify-end">
                          <button onClick={() => openEdit(exec)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-metro-navy hover:bg-gray-100 transition">
                            <Edit2 size={13} />
                          </button>
                          <button onClick={() => setDeleteTarget(exec)}
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
                  <td colSpan={4} className="px-4 py-3 text-xs font-bold text-metro-navy uppercase tracking-wide">Total Pago</td>
                  <td className="px-4 py-3 text-right font-bold text-green-700">{fmt(totalPago)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Form modal */}
      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? 'Editar Lançamento' : 'Novo Lançamento de Execução'}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Select
            label="Contrato *"
            options={contractOptions}
            placeholder="Selecione o contrato"
            error={errors.contract_id?.message}
            {...register('contract_id', {
              onChange: e => {
                setFormContractId(e.target.value)
                setValue('commitment_note_id', null)
              },
            })}
          />

          <Select
            label="Nota de Empenho"
            options={noteOptions}
            placeholder="Selecione a nota (opcional)"
            {...register('commitment_note_id')}
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Nº Ordem de Pagamento"
              placeholder="Ex: 2025OP000456"
              {...register('numero_op')}
            />
            <Input
              label="Data do Pagamento *"
              type="date"
              error={errors.data_pagamento?.message}
              {...register('data_pagamento')}
            />
          </div>

          <Input
            label="Valor Pago (R$) *"
            type="number"
            step="0.01"
            min="0.01"
            placeholder="0,00"
            error={errors.valor_pago?.message}
            {...register('valor_pago')}
          />

          <div>
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1.5">Descrição</label>
            <textarea
              rows={2}
              placeholder="Descrição do pagamento..."
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
          Excluir o lançamento <strong>{deleteTarget?.numero_op ?? deleteTarget?.descricao}</strong>?
        </p>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => setDeleteTarget(null)} className="flex-1">Cancelar</Button>
          <Button variant="danger" loading={remove.isPending} onClick={handleDelete} className="flex-1">Excluir</Button>
        </div>
      </Modal>
    </div>
  )
}
