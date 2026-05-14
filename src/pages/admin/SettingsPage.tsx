import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Trash2, Edit2, Cpu, MapPin, Clock, Building2, Layers, FileCode, Users } from 'lucide-react'
import { useEmployees, useCreateEmployee, useUpdateEmployee, useDeleteEmployee } from '@/hooks/useEmployees'
import type { Employee } from '@/hooks/useEmployees'
import { ExcelUpload } from '@/components/ui/ExcelUpload'
import { supabase } from '@/lib/supabase'
import {
  useCompanies, useCreateCompany, useUpdateCompany, useDeleteCompany,
  useEquipment, useCreateEquipment, useUpdateEquipment, useDeleteEquipment,
  useLocalities, useCreateLocality, useUpdateLocality, useDeleteLocality,
  usePeriodicities, useCreatePeriodicity, useUpdatePeriodicity, useDeletePeriodicity,
  useSistemas, useCreateSistema, useUpdateSistema, useDeleteSistema,
} from '@/hooks/useMasterData'
import {
  useFormsCatalog, useCreateFormEntry, useUpdateFormEntry, useDeleteFormEntry,
} from '@/hooks/useFormsCatalog'
import type { FormCatalogEntry } from '@/hooks/useFormsCatalog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { Spinner } from '@/components/ui/Spinner'
import type { Company, Equipment, Locality, Periodicity, Sistema } from '@/types'

// ─── Schemas ──────────────────────────────────────────────────────────────────

const companySchema = z.object({
  name:    z.string().min(2, 'Nome obrigatório'),
  cnpj:    z.string().optional(),
  contact: z.string().optional(),
  email:   z.string().email('E-mail inválido').optional().or(z.literal('')),
})
type CompanyForm = z.infer<typeof companySchema>

const equipmentSchema = z.object({
  name:        z.string().min(2, 'Nome obrigatório'),
  tag:         z.string().optional(),
  description: z.string().optional(),
  sistema_id:  z.string().uuid().optional().or(z.literal('')),
  locality_id: z.string().uuid().optional().or(z.literal('')),
})
type EquipmentForm = z.infer<typeof equipmentSchema>

const localitySchema = z.object({
  name:        z.string().min(2, 'Nome obrigatório'),
  description: z.string().optional(),
})
type LocalityForm = z.infer<typeof localitySchema>

const periodicitySchema = z.object({
  name:         z.string().min(2, 'Nome obrigatório'),
  interval_days: z.coerce.number().int().min(1, 'Informe os dias'),
})
type PeriodicityForm = z.infer<typeof periodicitySchema>

// ─── Shared row ───────────────────────────────────────────────────────────────

function ItemRow({ primary, secondary, onEdit, onDelete, deleting }: {
  primary: string; secondary?: string
  onEdit: () => void; onDelete: () => void; deleting?: boolean
}) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-metro-navy truncate">{primary}</p>
        {secondary && <p className="text-xs text-gray-400 truncate">{secondary}</p>}
      </div>
      <div className="flex gap-1.5 shrink-0">
        <button onClick={onEdit} className="p-1.5 rounded-lg text-gray-400 hover:text-metro-navy hover:bg-gray-100">
          <Edit2 size={14} />
        </button>
        <button onClick={onDelete} disabled={deleting}
          className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-40">
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}

// ─── Companies tab ────────────────────────────────────────────────────────────

function CompaniesTab() {
  const { data: items, isLoading } = useCompanies()
  const create = useCreateCompany()
  const update = useUpdateCompany()
  const remove = useDeleteCompany()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Company | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CompanyForm>({
    resolver: zodResolver(companySchema),
  })

  function openCreate() { reset({ name: '', cnpj: '', contact: '', email: '' }); setEditing(null); setShowForm(true) }
  function openEdit(item: Company) {
    reset({ name: item.name, cnpj: item.cnpj ?? '', contact: item.contact ?? '', email: item.email ?? '' })
    setEditing(item); setShowForm(true)
  }
  async function onSubmit(data: CompanyForm) {
    if (editing) await update.mutateAsync({ id: editing.id, ...data })
    else await create.mutateAsync(data)
    setShowForm(false)
  }
  async function handleDelete(id: string) {
    setDeletingId(id)
    try { await remove.mutateAsync(id) } finally { setDeletingId(null) }
  }

  async function handleExcelImport(rows: Record<string, string>[]) {
    let success = 0
    const errors: string[] = []
    for (const row of rows) {
      if (!row.name) { errors.push(`Linha ignorada: nome obrigatório`); continue }
      const { error } = await supabase.from('companies').insert({
        name: row.name,
        cnpj: row.cnpj || null,
        contact: row.contact || null,
        email: row.email || null,
      })
      if (error) errors.push(`"${row.name}": ${error.message}`)
      else success++
    }
    if (success > 0) create.reset?.()
    return { success, errors }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">{(items ?? []).length} empresas cadastradas</p>
        <Button size="sm" onClick={openCreate}><Plus size={14} /> Nova</Button>
      </div>
      {isLoading ? <Spinner /> : (items ?? []).length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">Nenhuma empresa cadastrada.</p>
      ) : (
        <div>
          {(items ?? []).map(item => (
            <ItemRow key={item.id}
              primary={item.name}
              secondary={[item.cnpj, item.contact].filter(Boolean).join(' · ') || undefined}
              onEdit={() => openEdit(item)}
              onDelete={() => handleDelete(item.id)}
              deleting={deletingId === item.id}
            />
          ))}
        </div>
      )}
      <ExcelUpload
        templateName="empresas"
        columns={[
          { key: 'name',    label: 'Nome',    required: true },
          { key: 'cnpj',    label: 'CNPJ' },
          { key: 'contact', label: 'Contato' },
          { key: 'email',   label: 'E-mail' },
        ]}
        onImport={handleExcelImport}
      />
      <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? 'Editar Empresa' : 'Nova Empresa'}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <Input label="Razão Social *" placeholder="Ex: Empresa ABC Ltda" error={errors.name?.message} {...register('name')} />
          <Input label="CNPJ" placeholder="00.000.000/0001-00" {...register('cnpj')} />
          <Input label="Contato" placeholder="Nome do responsável" {...register('contact')} />
          <Input label="E-mail" type="email" placeholder="contato@empresa.com.br" error={errors.email?.message} {...register('email')} />
          <div className="flex gap-3 pt-1">
            <Button type="button" variant="secondary" onClick={() => setShowForm(false)} className="flex-1">Cancelar</Button>
            <Button type="submit" loading={create.isPending || update.isPending} className="flex-1">Salvar</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

// ─── Equipment tab ────────────────────────────────────────────────────────────

function EquipmentTab() {
  const { data: items, isLoading } = useEquipment()
  const { data: sistemas } = useSistemas()
  const { data: localities } = useLocalities()
  const create = useCreateEquipment()
  const update = useUpdateEquipment()
  const remove = useDeleteEquipment()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Equipment | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const { register, handleSubmit, reset, formState: { errors } } = useForm<EquipmentForm>({
    resolver: zodResolver(equipmentSchema),
  })

  const sistemaOptions = [
    { value: '', label: 'Nenhum' },
    ...(sistemas ?? []).map(s => ({ value: s.id, label: s.name })),
  ]
  const localityOptions = [
    { value: '', label: 'Nenhuma' },
    ...(localities ?? []).map(l => ({ value: l.id, label: l.name })),
  ]

  function openCreate() {
    reset({ name: '', tag: '', description: '', sistema_id: '', locality_id: '' })
    setEditing(null); setShowForm(true)
  }
  function openEdit(item: Equipment) {
    reset({ name: item.name, tag: item.tag ?? '', description: item.description ?? '', sistema_id: item.sistema_id ?? '', locality_id: item.locality_id ?? '' })
    setEditing(item); setShowForm(true)
  }
  async function onSubmit(data: EquipmentForm) {
    const payload = { ...data, sistema_id: data.sistema_id || null, locality_id: data.locality_id || null }
    if (editing) await update.mutateAsync({ id: editing.id, ...payload })
    else await create.mutateAsync(payload)
    setShowForm(false)
  }
  async function handleDelete(id: string) {
    setDeletingId(id)
    try { await remove.mutateAsync(id) } finally { setDeletingId(null) }
  }

  async function handleExcelImport(rows: Record<string, string>[]) {
    let success = 0
    const errors: string[] = []
    for (const row of rows) {
      if (!row.name) { errors.push('Linha ignorada: nome obrigatório'); continue }
      const sistema = (sistemas ?? []).find(s => s.name.toLowerCase() === row.sistema?.toLowerCase())
      const locality = (localities ?? []).find(l => l.name.toLowerCase() === row.localidade?.toLowerCase())
      const { error } = await supabase.from('equipment').insert({
        name:        row.name,
        tag:         row.tag || null,
        description: row.description || null,
        sistema_id:  sistema?.id ?? null,
        locality_id: locality?.id ?? null,
      })
      if (error) errors.push(`"${row.name}": ${error.message}`)
      else success++
    }
    return { success, errors }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">{(items ?? []).length} equipamentos cadastrados</p>
        <Button size="sm" onClick={openCreate}><Plus size={14} /> Novo</Button>
      </div>
      {isLoading ? <Spinner /> : (items ?? []).length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">Nenhum equipamento cadastrado.</p>
      ) : (
        <div>
          {(items ?? []).map(item => (
            <ItemRow key={item.id}
              primary={item.name}
              secondary={[item.locality?.name, item.sistema?.name, item.tag].filter(Boolean).join(' · ') || undefined}
              onEdit={() => openEdit(item)}
              onDelete={() => handleDelete(item.id)}
              deleting={deletingId === item.id}
            />
          ))}
        </div>
      )}
      <ExcelUpload
        templateName="equipamentos"
        columns={[
          { key: 'name',        label: 'Nome',       required: true },
          { key: 'tag',         label: 'TAG' },
          { key: 'sistema',     label: 'Sistema' },
          { key: 'localidade',  label: 'Localidade' },
          { key: 'description', label: 'Descrição' },
        ]}
        onImport={handleExcelImport}
      />
      <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? 'Editar Equipamento' : 'Novo Equipamento'}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <Input label="Nome *" placeholder="Ex: Escada Rolante ER-01" error={errors.name?.message} {...register('name')} />
          <Input label="TAG / Código" placeholder="Ex: ER-01" {...register('tag')} />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Sistema" options={sistemaOptions} {...register('sistema_id')} />
            <Select label="Localidade" options={localityOptions} {...register('locality_id')} />
          </div>
          <Input label="Descrição" placeholder="Informações adicionais" {...register('description')} />
          <div className="flex gap-3 pt-1">
            <Button type="button" variant="secondary" onClick={() => setShowForm(false)} className="flex-1">Cancelar</Button>
            <Button type="submit" loading={create.isPending || update.isPending} className="flex-1">Salvar</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

// ─── Localities tab ───────────────────────────────────────────────────────────

function LocalitiesTab() {
  const { data: items, isLoading } = useLocalities()
  const create = useCreateLocality()
  const update = useUpdateLocality()
  const remove = useDeleteLocality()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Locality | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const { register, handleSubmit, reset, formState: { errors } } = useForm<LocalityForm>({
    resolver: zodResolver(localitySchema),
  })

  function openCreate() { reset({ name: '', description: '' }); setEditing(null); setShowForm(true) }
  function openEdit(item: Locality) {
    reset({ name: item.name, description: item.description ?? '' })
    setEditing(item); setShowForm(true)
  }
  async function onSubmit(data: LocalityForm) {
    if (editing) await update.mutateAsync({ id: editing.id, ...data })
    else await create.mutateAsync(data)
    setShowForm(false)
  }
  async function handleDelete(id: string) {
    setDeletingId(id)
    try { await remove.mutateAsync(id) } finally { setDeletingId(null) }
  }

  async function handleExcelImport(rows: Record<string, string>[]) {
    let success = 0
    const errors: string[] = []
    for (const row of rows) {
      if (!row.name) { errors.push('Linha ignorada: nome obrigatório'); continue }
      const { error } = await supabase.from('localities').insert({ name: row.name, description: row.description || null })
      if (error) errors.push(`"${row.name}": ${error.message}`)
      else success++
    }
    return { success, errors }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">{(items ?? []).length} localidades cadastradas</p>
        <Button size="sm" onClick={openCreate}><Plus size={14} /> Nova</Button>
      </div>
      {isLoading ? <Spinner /> : (items ?? []).length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">Nenhuma localidade cadastrada.</p>
      ) : (
        <div>
          {(items ?? []).map(item => (
            <ItemRow key={item.id}
              primary={item.name}
              secondary={item.description ?? undefined}
              onEdit={() => openEdit(item)}
              onDelete={() => handleDelete(item.id)}
              deleting={deletingId === item.id}
            />
          ))}
        </div>
      )}
      <ExcelUpload
        templateName="localidades"
        columns={[
          { key: 'name',        label: 'Nome',      required: true },
          { key: 'description', label: 'Descrição' },
        ]}
        onImport={handleExcelImport}
      />
      <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? 'Editar Localidade' : 'Nova Localidade'}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <Input label="Nome *" placeholder="Ex: Estação Central" error={errors.name?.message} {...register('name')} />
          <Input label="Descrição" placeholder="Informações adicionais" {...register('description')} />
          <div className="flex gap-3 pt-1">
            <Button type="button" variant="secondary" onClick={() => setShowForm(false)} className="flex-1">Cancelar</Button>
            <Button type="submit" loading={create.isPending || update.isPending} className="flex-1">Salvar</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

// ─── Periodicities tab ────────────────────────────────────────────────────────

function PeriodicitiesTab() {
  const { data: items, isLoading } = usePeriodicities()
  const create = useCreatePeriodicity()
  const update = useUpdatePeriodicity()
  const remove = useDeletePeriodicity()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Periodicity | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const { register, handleSubmit, reset, formState: { errors } } = useForm<PeriodicityForm>({
    resolver: zodResolver(periodicitySchema),
  })

  function openCreate() { reset({ name: '', interval_days: 30 }); setEditing(null); setShowForm(true) }
  function openEdit(item: Periodicity) {
    reset({ name: item.name, interval_days: item.interval_days })
    setEditing(item); setShowForm(true)
  }
  async function onSubmit(data: PeriodicityForm) {
    if (editing) await update.mutateAsync({ id: editing.id, ...data })
    else await create.mutateAsync(data)
    setShowForm(false)
  }
  async function handleDelete(id: string) {
    setDeletingId(id)
    try { await remove.mutateAsync(id) } finally { setDeletingId(null) }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-gray-400">{(items ?? []).length} periodicidades cadastradas</p>
        <Button size="sm" onClick={openCreate}><Plus size={14} /> Nova</Button>
      </div>
      {isLoading ? <Spinner /> : (items ?? []).length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">Nenhuma periodicidade cadastrada.</p>
      ) : (
        <div>
          {(items ?? []).map(item => (
            <ItemRow key={item.id}
              primary={item.name}
              secondary={`${item.interval_days} dia${item.interval_days !== 1 ? 's' : ''}`}
              onEdit={() => openEdit(item)}
              onDelete={() => handleDelete(item.id)}
              deleting={deletingId === item.id}
            />
          ))}
        </div>
      )}
      <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? 'Editar Periodicidade' : 'Nova Periodicidade'}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <Input label="Nome *" placeholder="Ex: Trimestral" error={errors.name?.message} {...register('name')} />
          <Input label="Intervalo em dias *" type="number" placeholder="Ex: 90"
            error={errors.interval_days?.message} {...register('interval_days')} />
          <div className="flex gap-3 pt-1">
            <Button type="button" variant="secondary" onClick={() => setShowForm(false)} className="flex-1">Cancelar</Button>
            <Button type="submit" loading={create.isPending || update.isPending} className="flex-1">Salvar</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

// ─── Sistemas tab ─────────────────────────────────────────────────────────────

const sistemaSchema = z.object({
  name:        z.string().min(2, 'Nome obrigatório'),
  description: z.string().optional(),
})
type SistemaForm = z.infer<typeof sistemaSchema>

function SistemasTab() {
  const { data: items, isLoading } = useSistemas()
  const create = useCreateSistema()
  const update = useUpdateSistema()
  const remove = useDeleteSistema()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Sistema | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const { register, handleSubmit, reset, formState: { errors } } = useForm<SistemaForm>({
    resolver: zodResolver(sistemaSchema),
  })

  function openCreate() { reset({ name: '', description: '' }); setEditing(null); setShowForm(true) }
  function openEdit(item: Sistema) {
    reset({ name: item.name, description: item.description ?? '' })
    setEditing(item); setShowForm(true)
  }
  async function onSubmit(data: SistemaForm) {
    if (editing) await update.mutateAsync({ id: editing.id, ...data })
    else await create.mutateAsync(data)
    setShowForm(false)
  }
  async function handleDelete(id: string) {
    setDeletingId(id)
    try { await remove.mutateAsync(id) } finally { setDeletingId(null) }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-gray-400">{(items ?? []).length} sistemas cadastrados</p>
        <Button size="sm" onClick={openCreate}><Plus size={14} /> Novo</Button>
      </div>
      {isLoading ? <Spinner /> : (items ?? []).length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">Nenhum sistema cadastrado.</p>
      ) : (
        <div>
          {(items ?? []).map(item => (
            <ItemRow key={item.id}
              primary={item.name}
              secondary={item.description ?? undefined}
              onEdit={() => openEdit(item)}
              onDelete={() => handleDelete(item.id)}
              deleting={deletingId === item.id}
            />
          ))}
        </div>
      )}
      <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? 'Editar Sistema' : 'Novo Sistema'}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <Input label="Nome *" placeholder="Ex: Sistema de Energia" error={errors.name?.message} {...register('name')} />
          <Input label="Descrição" placeholder="Ex: Alimentação 1KVCC, subestações..." {...register('description')} />
          <div className="flex gap-3 pt-1">
            <Button type="button" variant="secondary" onClick={() => setShowForm(false)} className="flex-1">Cancelar</Button>
            <Button type="submit" loading={create.isPending || update.isPending} className="flex-1">Salvar</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

// ─── Forms catalog tab ────────────────────────────────────────────────────────

function toSlug(name: string) {
  return name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

const formEntrySchema = z.object({
  label:          z.string().min(2, 'Nome obrigatório'),
  filename:       z.string().min(5, 'Nome do arquivo obrigatório').regex(/\.html?$/, 'Deve terminar em .html'),
  plan_type:      z.enum(['preventiva', 'irq']),
  sistema_id:     z.string().uuid().optional().or(z.literal('')),
  periodicity_id: z.string().uuid().optional().or(z.literal('')),
})
type FormEntryForm = z.infer<typeof formEntrySchema>

const PLAN_TYPE_OPTIONS = [
  { value: 'preventiva', label: 'Preventiva' },
  { value: 'irq',        label: 'IRQ' },
]

function FormsCatalogTab() {
  const { data: items, isLoading } = useFormsCatalog()
  const { data: sistemas }         = useSistemas()
  const { data: periodicities }    = usePeriodicities()
  const create = useCreateFormEntry()
  const update = useUpdateFormEntry()
  const remove = useDeleteFormEntry()
  const [showForm, setShowForm]     = useState(false)
  const [editing, setEditing]       = useState<FormCatalogEntry | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<FormEntryForm>({
    resolver: zodResolver(formEntrySchema),
    defaultValues: { plan_type: 'preventiva', sistema_id: '', periodicity_id: '' },
  })

  const watchedType          = watch('plan_type')
  const watchedFilename      = watch('filename') ?? ''
  const watchedSistemaId     = watch('sistema_id') ?? ''
  const watchedPeriodicityId = watch('periodicity_id') ?? ''

  const sistemaSlug     = (sistemas ?? []).find(s => s.id === watchedSistemaId)?.name ?? ''
  const periodicitySlug = (periodicities ?? []).find(p => p.id === watchedPeriodicityId)?.name ?? ''

  const derivedPath = watchedFilename
    ? [
        '/forms',
        watchedType,
        sistemaSlug     ? toSlug(sistemaSlug)     : null,
        periodicitySlug ? toSlug(periodicitySlug) : null,
        watchedFilename.replace(/^\/+/, ''),
      ].filter(Boolean).join('/')
    : ''

  const sistemaOptions     = [{ value: '', label: 'Nenhum' }, ...(sistemas ?? []).map(s => ({ value: s.id, label: s.name }))]
  const periodicityOptions = [{ value: '', label: 'Nenhuma' }, ...(periodicities ?? []).map(p => ({ value: p.id, label: p.name }))]

  function openCreate() {
    reset({ label: '', filename: '', plan_type: 'preventiva', sistema_id: '', periodicity_id: '' })
    setEditing(null); setShowForm(true)
  }
  function openEdit(item: FormCatalogEntry) {
    reset({ label: item.label, filename: item.filename, plan_type: item.plan_type, sistema_id: item.sistema_id ?? '', periodicity_id: item.periodicity_id ?? '' })
    setEditing(item); setShowForm(true)
  }
  async function onSubmit(data: FormEntryForm) {
    const sName = (sistemas ?? []).find(s => s.id === data.sistema_id)?.name ?? ''
    const pName = (periodicities ?? []).find(p => p.id === data.periodicity_id)?.name ?? ''
    const path = [
      '/forms',
      data.plan_type,
      sName ? toSlug(sName) : null,
      pName ? toSlug(pName) : null,
      data.filename.replace(/^\/+/, ''),
    ].filter(Boolean).join('/')
    const payload = {
      label:          data.label,
      filename:       data.filename,
      plan_type:      data.plan_type,
      sistema_id:     data.sistema_id || null,
      periodicity_id: data.periodicity_id || null,
      path,
    }
    if (editing) await update.mutateAsync({ id: editing.id, ...payload } as FormCatalogEntry)
    else await create.mutateAsync(payload)
    setShowForm(false)
  }
  async function handleDelete(id: string) {
    setDeletingId(id)
    try { await remove.mutateAsync(id) } finally { setDeletingId(null) }
  }

  const byType = (type: string) => (items ?? []).filter(f => f.plan_type === type)

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-gray-400">{(items ?? []).length} formulários cadastrados</p>
        <Button size="sm" onClick={openCreate}><Plus size={14} /> Novo</Button>
      </div>

      {isLoading ? <Spinner /> : (
        <div className="space-y-4">
          {(['preventiva', 'irq'] as const).map(type => (
            <div key={type}>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">
                {type === 'preventiva' ? 'Preventiva' : 'IRQ'}
              </p>
              {byType(type).length === 0 ? (
                <p className="text-xs text-gray-300 py-2 pl-1">Nenhum formulário cadastrado.</p>
              ) : byType(type).map(item => (
                <ItemRow key={item.id}
                  primary={item.label}
                  secondary={item.path}
                  onEdit={() => openEdit(item)}
                  onDelete={() => handleDelete(item.id)}
                  deleting={deletingId === item.id}
                />
              ))}
            </div>
          ))}
        </div>
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)}
        title={editing ? 'Editar Formulário' : 'Novo Formulário'}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <Input label="Nome de exibição *" placeholder="Ex: Cubículo Blindado 1kVcc"
            error={errors.label?.message} {...register('label')} />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Tipo de plano *" options={PLAN_TYPE_OPTIONS} {...register('plan_type')} />
            <Select label="Sistema" options={sistemaOptions} {...register('sistema_id')} />
          </div>
          <Select label="Periodicidade" options={periodicityOptions} {...register('periodicity_id')} />
          <Input label="Nome do arquivo *" placeholder="Ex: cubiculo-blindado-1kvcc.html"
            error={errors.filename?.message} {...register('filename')} />
          {derivedPath && (
            <p className="text-xs text-gray-400 font-mono bg-gray-50 rounded-lg px-3 py-2 break-all">
              Caminho: <strong>{derivedPath}</strong>
            </p>
          )}
          <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
            O arquivo HTML deve ser colocado manualmente no caminho indicado dentro de{' '}
            <code>public/</code> antes de ser utilizado.
          </p>
          <div className="flex gap-3 pt-1">
            <Button type="button" variant="secondary" onClick={() => setShowForm(false)} className="flex-1">Cancelar</Button>
            <Button type="submit" loading={create.isPending || update.isPending} className="flex-1">Salvar</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

// ─── Employees tab ────────────────────────────────────────────────────────────

const employeeSchema = z.object({
  company_id: z.string().uuid('Selecione a empresa'),
  nome:       z.string().min(2, 'Nome obrigatório'),
  matricula:  z.string().min(1, 'Matrícula obrigatória'),
  funcao:     z.string().optional(),
  status:     z.enum(['ativo', 'inativo']),
})
type EmployeeForm = z.infer<typeof employeeSchema>

function EmployeesTab() {
  const { data: companies = [] } = useCompanies()
  const [companyFilter, setCompanyFilter] = useState('')
  const { data: employees = [], isLoading } = useEmployees(companyFilter || undefined)
  const createEmployee = useCreateEmployee()
  const updateEmployee = useUpdateEmployee()
  const deleteEmployee = useDeleteEmployee()

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Employee | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const companyOptions = companies.map(c => ({ value: c.id, label: c.name }))
  const statusOptions = [
    { value: 'ativo',   label: 'Ativo' },
    { value: 'inativo', label: 'Inativo' },
  ]

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<EmployeeForm>({
    resolver: zodResolver(employeeSchema),
    defaultValues: { status: 'ativo' },
  })

  function openCreate() { reset({ status: 'ativo', company_id: companyFilter || '' }); setEditing(null); setShowForm(true) }
  function openEdit(e: Employee) {
    reset({ company_id: e.company_id, nome: e.nome, matricula: e.matricula, funcao: e.funcao ?? '', status: e.status })
    setEditing(e)
    setShowForm(true)
  }

  async function onSubmit(data: EmployeeForm) {
    if (editing) await updateEmployee.mutateAsync({ id: editing.id, ...data })
    else await createEmployee.mutateAsync(data)
    setShowForm(false)
  }

  async function onDelete(id: string) {
    setDeletingId(id)
    await deleteEmployee.mutateAsync(id)
    setDeletingId(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-metro-navy uppercase tracking-wide">Empregados da Contratada</p>
        <Button size="sm" onClick={openCreate}><Plus size={13} /> Novo</Button>
      </div>

      <Select
        label="Filtrar por empresa"
        options={[{ value: '', label: 'Todas as empresas' }, ...companyOptions]}
        {...{ value: companyFilter, onChange: (e: React.ChangeEvent<HTMLSelectElement>) => setCompanyFilter(e.target.value) }}
      />

      {isLoading ? <Spinner /> : employees.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">Nenhum empregado cadastrado.</p>
      ) : (
        <div className="divide-y divide-gray-50">
          {employees.map(emp => (
            <ItemRow
              key={emp.id}
              primary={`${emp.nome} — ${emp.matricula}`}
              secondary={`${emp.company?.name ?? ''}${emp.funcao ? ` · ${emp.funcao}` : ''} · ${emp.status === 'ativo' ? '✅ Ativo' : '🔴 Inativo'}`}
              onEdit={() => openEdit(emp)}
              onDelete={() => onDelete(emp.id)}
              deleting={deletingId === emp.id}
            />
          ))}
        </div>
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? 'Editar Empregado' : 'Novo Empregado'}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <Select label="Empresa *" options={companyOptions} placeholder="Selecione" error={errors.company_id?.message} {...register('company_id')} />
          <Input label="Nome completo *" error={errors.nome?.message} {...register('nome')} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Matrícula *" placeholder="Ex: 0012345" error={errors.matricula?.message} {...register('matricula')} />
            <Input label="Função" placeholder="Ex: Eletricista" {...register('funcao')} />
          </div>
          <Select label="Status" options={statusOptions} {...register('status')} />
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setShowForm(false)} className="flex-1">Cancelar</Button>
            <Button type="submit" loading={isSubmitting} className="flex-1">{editing ? 'Salvar' : 'Cadastrar'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

type Tab = 'companies' | 'equipment' | 'localities' | 'periodicities' | 'sistemas' | 'forms' | 'employees'

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'companies',     label: 'Empresas',       icon: Building2 },
  { id: 'equipment',     label: 'Equipamentos',   icon: Cpu },
  { id: 'localities',    label: 'Localidades',    icon: MapPin },
  { id: 'periodicities', label: 'Periodicidades', icon: Clock },
  { id: 'sistemas',      label: 'Sistemas',       icon: Layers },
  { id: 'forms',         label: 'Formulários',    icon: FileCode },
  { id: 'employees',     label: 'Empregados',     icon: Users },
]

export function SettingsPage() {
  const [active, setActive] = useState<Tab>('companies')

  return (
    <div className="h-full flex flex-col">
      <div className="bg-white border-b border-gray-200 px-6 py-4 shrink-0">
        <h1 className="text-base font-bold text-metro-navy leading-none">Configurações</h1>
        <p className="text-xs text-gray-400 mt-0.5">Cadastro de dados mestres do sistema</p>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {/* Tab bar */}
        <div className="flex gap-2 mb-5">
          {TABS.map(tab => {
            const Icon = tab.icon
            const isActive = tab.id === active
            return (
              <button
                key={tab.id}
                onClick={() => setActive(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-semibold transition-all ${
                  isActive
                    ? 'bg-metro-navy text-white border-metro-navy shadow-sm'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-metro-navy/40'
                }`}
              >
                <Icon size={15} strokeWidth={isActive ? 2.2 : 1.8} />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Tab content */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 max-w-2xl">
          {active === 'companies'     && <CompaniesTab />}
          {active === 'equipment'     && <EquipmentTab />}
          {active === 'localities'    && <LocalitiesTab />}
          {active === 'periodicities' && <PeriodicitiesTab />}
          {active === 'sistemas'      && <SistemasTab />}
          {active === 'forms'         && <FormsCatalogTab />}
          {active === 'employees'     && <EmployeesTab />}
        </div>
      </div>
    </div>
  )
}
