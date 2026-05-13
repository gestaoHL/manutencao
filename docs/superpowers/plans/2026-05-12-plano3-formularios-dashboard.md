# Plano 3 — Gerenciador de Formulários + Dashboard de Monitoramento

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Forms Manager (approval workflow with audit log: fiscalização approves/rejects, contratada edits and resubmits rejeitados) and the Monitoring Dashboard (KPIs + monthly chart + recent activity table).

**Architecture:** The Forms Manager at `/forms` lists all executions the current user can see (RLS-filtered), with a detail page at `/forms/:id` that shows the filled form data, audit history, and workflow actions. The workflow state machine (`pendente → em_analise → aprovado | rejeitado`) is enforced both in the UI and via Supabase RLS. The Dashboard at `/dashboard` queries aggregated data via TanStack Query and renders KPI cards + a Recharts bar chart. The `maintenance_history` audit log is written by a PostgreSQL trigger on `maintenance_executions`.

**Tech Stack:** React 18 + Vite + TypeScript, Tailwind CSS, TanStack Query v5, React Hook Form + Zod, Supabase (PostgreSQL + RLS), Recharts, lucide-react.

---

## File Map

**New files:**
- `src/hooks/useHistory.ts` — Query hook for `maintenance_history` audit log
- `src/hooks/useDashboard.ts` — Aggregation queries for KPIs and chart data
- `src/pages/forms/FormsListPage.tsx` — Filterable list of all executions (gestor/fiscalizacao/contratada)
- `src/pages/forms/FormDetailPage.tsx` — Detail view: form data, workflow actions, audit log
- `src/pages/dashboard/DashboardPage.tsx` — KPI cards + bar chart + recent activity table

**Modified files:**
- `src/router.tsx` — Add `/forms`, `/forms/:id`, `/dashboard` routes
- `src/types/index.ts` — Add `MaintenanceHistory` type
- `src/hooks/useExecutions.ts` — Add `useAllExecutions` (no planType filter, for forms list)

---

## SQL: Audit Log Setup (Manual Step — Run in Supabase SQL Editor)

```sql
-- Create maintenance_history table if not exists
CREATE TABLE IF NOT EXISTS maintenance_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID NOT NULL REFERENCES maintenance_executions(id) ON DELETE CASCADE,
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT
);

ALTER TABLE maintenance_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "history_select" ON maintenance_history;
CREATE POLICY "history_select" ON maintenance_history
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "history_insert" ON maintenance_history;
CREATE POLICY "history_insert" ON maintenance_history
  FOR INSERT WITH CHECK (true);

-- Trigger function: record status changes
CREATE OR REPLACE FUNCTION record_execution_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO maintenance_history (execution_id, changed_by, field_name, old_value, new_value)
    VALUES (NEW.id, auth.uid(), 'status', OLD.status, NEW.status);
  END IF;
  IF OLD.rejection_reason IS DISTINCT FROM NEW.rejection_reason AND NEW.rejection_reason IS NOT NULL THEN
    INSERT INTO maintenance_history (execution_id, changed_by, field_name, old_value, new_value)
    VALUES (NEW.id, auth.uid(), 'rejection_reason', OLD.rejection_reason, NEW.rejection_reason);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_execution_history ON maintenance_executions;
CREATE TRIGGER trg_execution_history
  AFTER UPDATE ON maintenance_executions
  FOR EACH ROW EXECUTE FUNCTION record_execution_status_change();
```

---

### Task 1: Add MaintenanceHistory type and useHistory/useDashboard hooks

**Files:**
- Modify: `src/types/index.ts`
- Create: `src/hooks/useHistory.ts`
- Create: `src/hooks/useDashboard.ts`
- Modify: `src/hooks/useExecutions.ts`

- [ ] **Step 1: Add MaintenanceHistory type**

Open `src/types/index.ts` and append at the end:

```typescript
export interface MaintenanceHistory {
  id: string
  execution_id: string
  changed_by: string | null
  changed_at: string
  field_name: string
  old_value: string | null
  new_value: string | null
  changer?: { full_name: string | null; role: UserRole }
}
```

- [ ] **Step 2: Create useHistory hook**

Create `src/hooks/useHistory.ts`:

```typescript
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { MaintenanceHistory } from '@/types'

export function useExecutionHistory(executionId: string) {
  return useQuery({
    queryKey: ['history', executionId],
    queryFn: async (): Promise<MaintenanceHistory[]> => {
      const { data, error } = await supabase
        .from('maintenance_history')
        .select('*, changer:profiles!changed_by(full_name,role)')
        .eq('execution_id', executionId)
        .order('changed_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as MaintenanceHistory[]
    },
    enabled: !!executionId,
  })
}
```

- [ ] **Step 3: Create useDashboard hook**

Create `src/hooks/useDashboard.ts`:

```typescript
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface KPIs {
  totalOS: number
  preventivasDone: number
  irqPending: number
  conformanceRate: number
}

export interface MonthlyPoint {
  month: string
  preventiva: number
  irq: number
}

export function useKPIs() {
  return useQuery({
    queryKey: ['dashboard', 'kpis'],
    queryFn: async (): Promise<KPIs> => {
      const { data, error } = await supabase
        .from('maintenance_executions')
        .select('status, plan_type')
      if (error) throw error

      const rows = data ?? []
      const totalOS = rows.length
      const preventivasDone = rows.filter(r => r.plan_type === 'preventiva' && r.status === 'aprovado').length
      const irqPending = rows.filter(r => r.plan_type === 'irq' && r.status === 'pendente').length
      const approved = rows.filter(r => r.status === 'aprovado').length
      const conformanceRate = totalOS > 0 ? Math.round((approved / totalOS) * 100) : 0

      return { totalOS, preventivasDone, irqPending, conformanceRate }
    },
  })
}

export function useMonthlyChart() {
  return useQuery({
    queryKey: ['dashboard', 'monthly'],
    queryFn: async (): Promise<MonthlyPoint[]> => {
      const since = new Date()
      since.setMonth(since.getMonth() - 5)
      since.setDate(1)

      const { data, error } = await supabase
        .from('maintenance_executions')
        .select('plan_type, created_at')
        .gte('created_at', since.toISOString())
      if (error) throw error

      const map: Record<string, { preventiva: number; irq: number }> = {}
      for (const row of data ?? []) {
        const key = new Date(row.created_at).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
        if (!map[key]) map[key] = { preventiva: 0, irq: 0 }
        if (row.plan_type === 'preventiva') map[key].preventiva++
        else map[key].irq++
      }

      return Object.entries(map).map(([month, counts]) => ({ month, ...counts }))
    },
  })
}

export function useRecentActivity() {
  return useQuery({
    queryKey: ['dashboard', 'recent'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('maintenance_executions')
        .select('id, status, plan_type, os_number, created_at, plan:maintenance_plans(title), asset:assets(name)')
        .order('created_at', { ascending: false })
        .limit(10)
      if (error) throw error
      return data ?? []
    },
  })
}
```

- [ ] **Step 4: Add useAllExecutions to useExecutions.ts**

Open `src/hooks/useExecutions.ts` and append at the end of the file (after `useUpdateExecutionStatus`):

```typescript
export function useAllExecutions() {
  const { profile } = useAuth()

  return useQuery({
    queryKey: ['executions', 'all', profile?.id, profile?.role],
    queryFn: async (): Promise<MaintenanceExecution[]> => {
      let query = supabase
        .from('maintenance_executions')
        .select('*, plan:maintenance_plans(id,title,plan_type), asset:assets(id,name,location)')
        .order('created_at', { ascending: false })

      if (profile?.role === 'contratada') {
        const contractsRes = await supabase
          .from('contracts')
          .select('id')
          .eq('contractor_profile_id', profile.id)
        const contractIds = (contractsRes.data ?? []).map(c => c.id)
        if (contractIds.length === 0) return []

        const assetsRes = await supabase
          .from('assets')
          .select('id')
          .in('contract_id', contractIds)
        const ids = (assetsRes.data ?? []).map(a => a.id)
        if (ids.length === 0) return []
        query = query.in('asset_id', ids)
      }

      const { data, error } = await query
      if (error) throw error
      return (data ?? []) as MaintenanceExecution[]
    },
    enabled: !!profile,
  })
}
```

- [ ] **Step 5: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/types/index.ts src/hooks/useHistory.ts src/hooks/useDashboard.ts src/hooks/useExecutions.ts
git commit -m "feat: add history/dashboard hooks and MaintenanceHistory type"
```

---

### Task 2: Forms List Page

**Files:**
- Create: `src/pages/forms/FormsListPage.tsx`

- [ ] **Step 1: Create FormsListPage**

Create `src/pages/forms/FormsListPage.tsx`:

```tsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, Filter, ClipboardList } from 'lucide-react'
import { useAllExecutions } from '@/hooks/useExecutions'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import type { ExecutionStatus, PlanType } from '@/types'

const STATUS_OPTIONS: { value: ExecutionStatus | ''; label: string }[] = [
  { value: '', label: 'Todos os status' },
  { value: 'pendente', label: 'Pendente' },
  { value: 'em_analise', label: 'Em Análise' },
  { value: 'aprovado', label: 'Aprovado' },
  { value: 'rejeitado', label: 'Rejeitado' },
]

const TYPE_OPTIONS: { value: PlanType | ''; label: string }[] = [
  { value: '', label: 'Todos os tipos' },
  { value: 'preventiva', label: 'Preventiva' },
  { value: 'irq', label: 'IRQ' },
]

export function FormsListPage() {
  const { data: executions, isLoading } = useAllExecutions()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ExecutionStatus | ''>('')
  const [typeFilter, setTypeFilter] = useState<PlanType | ''>('')

  const filtered = (executions ?? []).filter(e => {
    const matchSearch =
      !search ||
      (e.os_number ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (e.asset?.name ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (e.plan?.title ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (e.psa_item ?? '').toLowerCase().includes(search.toLowerCase())
    const matchStatus = !statusFilter || e.status === statusFilter
    const matchType = !typeFilter || e.plan_type === typeFilter
    return matchSearch && matchStatus && matchType
  })

  const statusCounts = {
    pendente: (executions ?? []).filter(e => e.status === 'pendente').length,
    em_analise: (executions ?? []).filter(e => e.status === 'em_analise').length,
    rejeitado: (executions ?? []).filter(e => e.status === 'rejeitado').length,
  }

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-metro-navy">Gerenciador de Formulários</h1>
        <p className="text-sm text-gray-500">{filtered.length} formulários</p>
      </div>

      {/* Summary chips */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {statusCounts.pendente > 0 && (
          <button
            onClick={() => setStatusFilter(statusFilter === 'pendente' ? '' : 'pendente')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition ${statusFilter === 'pendente' ? 'bg-yellow-400 text-yellow-900' : 'bg-yellow-100 text-yellow-800'}`}
          >
            {statusCounts.pendente} pendentes
          </button>
        )}
        {statusCounts.em_analise > 0 && (
          <button
            onClick={() => setStatusFilter(statusFilter === 'em_analise' ? '' : 'em_analise')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition ${statusFilter === 'em_analise' ? 'bg-blue-400 text-white' : 'bg-blue-100 text-blue-800'}`}
          >
            {statusCounts.em_analise} em análise
          </button>
        )}
        {statusCounts.rejeitado > 0 && (
          <button
            onClick={() => setStatusFilter(statusFilter === 'rejeitado' ? '' : 'rejeitado')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition ${statusFilter === 'rejeitado' ? 'bg-red-400 text-white' : 'bg-red-100 text-red-800'}`}
          >
            {statusCounts.rejeitado} rejeitados
          </button>
        )}
      </div>

      {/* Search + filters */}
      <div className="flex gap-2 mb-3 flex-wrap">
        <div className="relative flex-1 min-w-40">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            placeholder="Buscar OS, ativo, plano ou PSA..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-metro-orange bg-white"
          />
        </div>
        <div className="relative">
          <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as ExecutionStatus | '')}
            className="pl-8 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-metro-orange bg-white appearance-none"
          >
            {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="relative">
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value as PlanType | '')}
            className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-metro-orange bg-white appearance-none"
          >
            {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {isLoading ? (
        <Spinner />
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center text-gray-400">
          <ClipboardList size={32} className="mx-auto mb-2 text-gray-300" />
          <p className="text-sm">Nenhum formulário encontrado.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(exec => (
            <Link key={exec.id} to={`/forms/${exec.id}`}>
              <Card className="p-3 hover:border-metro-orange transition-colors cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className={`w-1.5 h-12 rounded-full shrink-0 ${
                    exec.status === 'pendente' ? 'bg-yellow-400' :
                    exec.status === 'em_analise' ? 'bg-blue-400' :
                    exec.status === 'aprovado' ? 'bg-green-500' :
                    'bg-red-400'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-metro-navy text-sm truncate">{exec.plan?.title ?? '—'}</p>
                      <Badge status={exec.status} />
                      <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${exec.plan_type === 'preventiva' ? 'bg-orange-100 text-metro-orange' : 'bg-blue-100 text-blue-700'}`}>
                        {exec.plan_type === 'preventiva' ? 'Prev.' : 'IRQ'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
                      <span>{exec.asset?.name ?? '—'}</span>
                      <span>OS: {exec.os_number ?? '—'}</span>
                      <span>{new Date(exec.created_at).toLocaleDateString('pt-BR')}</span>
                    </div>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/pages/forms/FormsListPage.tsx
git commit -m "feat: forms list page with status/type filters and summary chips"
```

---

### Task 3: Form Detail Page with workflow actions and audit log

**Files:**
- Create: `src/pages/forms/FormDetailPage.tsx`

- [ ] **Step 1: Create FormDetailPage**

Create `src/pages/forms/FormDetailPage.tsx`:

```tsx
import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  ChevronLeft, CheckCircle, XCircle, Clock, Eye,
  ChevronDown, ChevronUp, User
} from 'lucide-react'
import { useExecution, useUpdateExecutionStatus } from '@/hooks/useExecutions'
import { useExecutionHistory } from '@/hooks/useHistory'
import { useAuth } from '@/hooks/useAuth'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'

const rejectSchema = z.object({
  rejection_reason: z.string().min(10, 'Descreva o motivo (mínimo 10 caracteres)'),
})
type RejectForm = z.infer<typeof rejectSchema>

const FIELD_LABELS: Record<string, string> = {
  status: 'Status',
  rejection_reason: 'Motivo de Rejeição',
}

const STATUS_PT: Record<string, string> = {
  pendente: 'Pendente',
  em_analise: 'Em Análise',
  aprovado: 'Aprovado',
  rejeitado: 'Rejeitado',
}

export function FormDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [showHistory, setShowHistory] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  const { data: exec, isLoading } = useExecution(id ?? '')
  const { data: history } = useExecutionHistory(id ?? '')
  const updateStatus = useUpdateExecutionStatus()

  const { register, handleSubmit, reset, formState: { errors } } = useForm<RejectForm>({
    resolver: zodResolver(rejectSchema),
  })

  if (isLoading) return <div className="min-h-screen bg-metro-bg flex items-center justify-center"><Spinner /></div>
  if (!exec) return <div className="p-4 text-center text-gray-500">Formulário não encontrado.</div>

  const isFiscalizacao = profile?.role === 'fiscalizacao'
  const isContratada = profile?.role === 'contratada'

  async function handleStartAnalysis() {
    if (exec?.status !== 'pendente') return
    setActionLoading(true)
    try {
      await updateStatus.mutateAsync({ id: exec.id, status: 'em_analise' })
    } finally {
      setActionLoading(false)
    }
  }

  async function handleApprove() {
    if (!exec) return
    setActionLoading(true)
    try {
      await updateStatus.mutateAsync({ id: exec.id, status: 'aprovado' })
    } finally {
      setActionLoading(false)
    }
  }

  async function handleReject(data: RejectForm) {
    if (!exec) return
    setActionLoading(true)
    try {
      await updateStatus.mutateAsync({
        id: exec.id,
        status: 'rejeitado',
        rejection_reason: data.rejection_reason,
      })
      setShowRejectModal(false)
      reset()
    } finally {
      setActionLoading(false)
    }
  }

  async function handleResubmit() {
    if (!exec) return
    setActionLoading(true)
    try {
      await updateStatus.mutateAsync({ id: exec.id, status: 'pendente' })
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-metro-bg pb-8">
      {/* Header */}
      <div className="bg-metro-navy px-4 pt-4 pb-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-white/70 hover:text-white">
            <ChevronLeft size={22} />
          </button>
          <div className="flex-1">
            <p className="text-white font-semibold text-sm truncate">{exec.plan?.title ?? '—'}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge status={exec.status} />
              <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${exec.plan_type === 'preventiva' ? 'bg-orange-200 text-metro-orange' : 'bg-blue-200 text-blue-700'}`}>
                {exec.plan_type === 'preventiva' ? 'Preventiva' : 'IRQ'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 max-w-2xl mx-auto space-y-4">

        {/* Identification */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs font-bold text-metro-navy uppercase tracking-wide mb-3">Identificação</p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-gray-400">Ativo</p>
              <p className="font-medium text-metro-navy">{exec.asset?.name ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Localidade</p>
              <p className="font-medium text-metro-navy">{exec.asset?.location ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Número da OS</p>
              <p className="font-medium text-metro-navy">{exec.os_number ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Item da PSA</p>
              <p className="font-medium text-metro-navy">{exec.psa_item ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Submetido em</p>
              <p className="font-medium text-metro-navy">{new Date(exec.created_at).toLocaleString('pt-BR')}</p>
            </div>
          </div>
        </div>

        {/* Form data */}
        {Object.keys(exec.form_data).length > 0 && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <p className="text-xs font-bold text-metro-navy uppercase tracking-wide mb-3">Dados do Formulário</p>
            <div className="space-y-3">
              {Object.entries(exec.form_data).map(([key, value]) => (
                <div key={key} className="border-b border-gray-50 pb-2 last:border-0">
                  <p className="text-xs text-gray-400">{key}</p>
                  <p className="text-sm font-medium text-metro-navy">
                    {typeof value === 'boolean'
                      ? (value ? 'Sim ✓' : 'Não ✗')
                      : String(value ?? '—')}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Rejection reason */}
        {exec.rejection_reason && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
            <p className="text-xs font-bold text-red-700 uppercase tracking-wide mb-1">Motivo da Rejeição</p>
            <p className="text-sm text-red-800">{exec.rejection_reason}</p>
          </div>
        )}

        {/* Workflow actions */}
        {isFiscalizacao && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <p className="text-xs font-bold text-metro-navy uppercase tracking-wide mb-3">Ações de Fiscalização</p>
            <div className="flex gap-3">
              {exec.status === 'pendente' && (
                <Button
                  variant="secondary"
                  onClick={handleStartAnalysis}
                  loading={actionLoading}
                  className="flex-1"
                >
                  <Eye size={15} /> Iniciar Análise
                </Button>
              )}
              {(exec.status === 'em_analise' || exec.status === 'pendente') && (
                <>
                  <Button
                    onClick={handleApprove}
                    loading={actionLoading}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle size={15} /> Aprovar
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => setShowRejectModal(true)}
                    loading={actionLoading}
                    className="flex-1"
                  >
                    <XCircle size={15} /> Rejeitar
                  </Button>
                </>
              )}
              {exec.status === 'aprovado' && (
                <div className="flex items-center gap-2 text-green-600 text-sm font-medium">
                  <CheckCircle size={16} /> Formulário aprovado
                </div>
              )}
              {exec.status === 'rejeitado' && (
                <div className="flex items-center gap-2 text-red-500 text-sm font-medium">
                  <XCircle size={16} /> Aguardando correção da contratada
                </div>
              )}
            </div>
          </div>
        )}

        {isContratada && exec.status === 'rejeitado' && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <p className="text-xs font-bold text-metro-navy uppercase tracking-wide mb-3">Ação da Contratada</p>
            <p className="text-sm text-gray-500 mb-3">
              Corrija os problemas indicados no motivo de rejeição e reenvie para análise.
            </p>
            <Button onClick={handleResubmit} loading={actionLoading} className="w-full">
              <Clock size={15} /> Reenviar para Análise
            </Button>
          </div>
        )}

        {/* Audit log */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <button
            className="w-full flex items-center justify-between p-4"
            onClick={() => setShowHistory(!showHistory)}
          >
            <p className="text-xs font-bold text-metro-navy uppercase tracking-wide">
              Histórico de Alterações {history?.length ? `(${history.length})` : ''}
            </p>
            {showHistory ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
          </button>
          {showHistory && (
            <div className="border-t border-gray-100">
              {!history || history.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">Nenhuma alteração registrada.</p>
              ) : (
                <div className="divide-y divide-gray-50">
                  {history.map(entry => (
                    <div key={entry.id} className="px-4 py-3 flex items-start gap-3">
                      <div className="w-7 h-7 bg-metro-navy/10 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                        <User size={13} className="text-metro-navy" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-400">
                          {new Date(entry.changed_at).toLocaleString('pt-BR')}
                          {entry.changer?.full_name ? ` · ${entry.changer.full_name}` : ''}
                        </p>
                        <p className="text-sm text-metro-navy mt-0.5">
                          <span className="font-medium">{FIELD_LABELS[entry.field_name] ?? entry.field_name}:</span>{' '}
                          <span className="text-gray-400 line-through text-xs">{STATUS_PT[entry.old_value ?? ''] ?? entry.old_value ?? '—'}</span>
                          {' → '}
                          <span className="font-semibold">{STATUS_PT[entry.new_value ?? ''] ?? entry.new_value ?? '—'}</span>
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Reject modal */}
      <Modal open={showRejectModal} onClose={() => { setShowRejectModal(false); reset() }} title="Rejeitar Formulário">
        <form onSubmit={handleSubmit(handleReject)} className="space-y-4">
          <p className="text-sm text-gray-500">
            Descreva claramente o motivo da rejeição para que a contratada possa fazer as correções necessárias.
          </p>
          <div>
            <label className="block text-xs font-semibold text-metro-navy mb-1">Motivo da Rejeição *</label>
            <textarea
              {...register('rejection_reason')}
              rows={4}
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-metro-orange resize-none"
              placeholder="Descreva o motivo da rejeição..."
            />
            {errors.rejection_reason && <p className="text-xs text-red-500 mt-1">{errors.rejection_reason.message}</p>}
          </div>
          <div className="flex gap-3">
            <Button type="button" variant="secondary" onClick={() => { setShowRejectModal(false); reset() }} className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" variant="danger" loading={actionLoading} className="flex-1">
              Confirmar Rejeição
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/pages/forms/FormDetailPage.tsx
git commit -m "feat: form detail page with workflow actions and audit log"
```

---

### Task 4: Install Recharts and build Dashboard Page

**Files:**
- Create: `src/pages/dashboard/DashboardPage.tsx`

- [ ] **Step 1: Install Recharts**

```bash
cd "C:\Users\Herbert G L J\Desktop\Projetos HTML\metro-manutencao"
npm install recharts
```

Expected: recharts added to package.json.

- [ ] **Step 2: Create DashboardPage**

Create `src/pages/dashboard/DashboardPage.tsx`:

```tsx
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer
} from 'recharts'
import { TrendingUp, Wrench, Zap, CheckSquare } from 'lucide-react'
import { useKPIs, useMonthlyChart, useRecentActivity } from '@/hooks/useDashboard'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'

interface KPICardProps {
  label: string
  value: number | string
  icon: React.ElementType
  color: 'orange' | 'navy' | 'green' | 'blue'
}

function KPICard({ label, value, icon: Icon, color }: KPICardProps) {
  const colorMap = {
    orange: 'bg-metro-orange text-white',
    navy:   'bg-metro-navy text-white',
    green:  'bg-green-600 text-white',
    blue:   'bg-blue-600 text-white',
  }
  return (
    <div className={`rounded-2xl p-4 shadow-sm ${colorMap[color]}`}>
      <Icon size={22} strokeWidth={1.8} className="opacity-80 mb-2" />
      <p className="text-2xl font-bold leading-none">{value}</p>
      <p className="text-xs font-medium opacity-80 mt-1 leading-tight">{label}</p>
    </div>
  )
}

export function DashboardPage() {
  const { data: kpis, isLoading: loadingKPIs } = useKPIs()
  const { data: monthly, isLoading: loadingChart } = useMonthlyChart()
  const { data: recent, isLoading: loadingRecent } = useRecentActivity()

  return (
    <div className="p-4 max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-metro-navy">Dashboard</h1>
        <p className="text-sm text-gray-500">Visão geral das manutenções</p>
      </div>

      {/* KPI cards */}
      {loadingKPIs ? (
        <Spinner />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <KPICard
            label="Total de OS"
            value={kpis?.totalOS ?? 0}
            icon={TrendingUp}
            color="navy"
          />
          <KPICard
            label="Preventivas Aprovadas"
            value={kpis?.preventivasDone ?? 0}
            icon={Wrench}
            color="orange"
          />
          <KPICard
            label="IRQs Pendentes"
            value={kpis?.irqPending ?? 0}
            icon={Zap}
            color="blue"
          />
          <KPICard
            label="Taxa de Conformidade"
            value={`${kpis?.conformanceRate ?? 0}%`}
            icon={CheckSquare}
            color="green"
          />
        </div>
      )}

      {/* Monthly chart */}
      <Card className="p-4">
        <p className="text-xs font-bold text-metro-navy uppercase tracking-wide mb-4">
          Últimos 6 Meses — Registros por Tipo
        </p>
        {loadingChart ? (
          <Spinner />
        ) : !monthly || monthly.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">Sem dados para o período.</p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthly} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#6B7280' }} />
              <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ borderRadius: 8, fontSize: 12, border: '1px solid #e5e7eb' }}
                labelStyle={{ fontWeight: 700, color: '#1A2B4A' }}
              />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="preventiva" name="Preventiva" fill="#F47920" radius={[4, 4, 0, 0]} />
              <Bar dataKey="irq" name="IRQ" fill="#1A2B4A" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* Recent activity */}
      <Card className="p-4">
        <p className="text-xs font-bold text-metro-navy uppercase tracking-wide mb-3">
          Atividade Recente
        </p>
        {loadingRecent ? (
          <Spinner />
        ) : !recent || recent.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">Nenhuma atividade recente.</p>
        ) : (
          <div className="space-y-2">
            {recent.map(item => (
              <div key={item.id} className="flex items-center gap-3 py-1.5 border-b border-gray-50 last:border-0">
                <div className={`w-1.5 h-8 rounded-full shrink-0 ${
                  item.status === 'pendente' ? 'bg-yellow-400' :
                  item.status === 'em_analise' ? 'bg-blue-400' :
                  item.status === 'aprovado' ? 'bg-green-500' :
                  'bg-red-400'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-metro-navy truncate">
                    {(item.plan as { title?: string } | null)?.title ?? '—'}
                  </p>
                  <p className="text-xs text-gray-400">
                    {(item.asset as { name?: string } | null)?.name ?? '—'} · OS: {item.os_number ?? '—'}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <Badge status={item.status} />
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(item.created_at).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/pages/dashboard/DashboardPage.tsx package.json package-lock.json
git commit -m "feat: dashboard page with KPI cards and monthly bar chart"
```

---

### Task 5: Wire routes and final build

**Files:**
- Modify: `src/router.tsx`

- [ ] **Step 1: Update router**

Replace `src/router.tsx`:

```tsx
import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { AppShell } from '@/components/layout/AppShell'
import { Spinner } from '@/components/ui/Spinner'
import { LoginPage } from '@/pages/auth/LoginPage'
import { RegisterPage } from '@/pages/auth/RegisterPage'
import { HomePage } from '@/pages/home/HomePage'
import { AccessManagementPage } from '@/pages/admin/AccessManagementPage'
import { ContractsListPage } from '@/pages/contracts/ContractsListPage'
import { ContractDetailPage } from '@/pages/contracts/ContractDetailPage'
import { ContractFormPage } from '@/pages/contracts/ContractFormPage'
import { MaintenancePlansPage } from '@/pages/maintenance/MaintenancePlansPage'
import { MaintenanceExecutionsPage } from '@/pages/maintenance/MaintenanceExecutionsPage'
import { IRQExecutionsPage } from '@/pages/irq/IRQExecutionsPage'
import { FieldSelectPage } from '@/pages/field/FieldSelectPage'
import { FieldFormPage } from '@/pages/field/FieldFormPage'
import { FieldSuccessPage } from '@/pages/field/FieldSuccessPage'
import { FormsListPage } from '@/pages/forms/FormsListPage'
import { FormDetailPage } from '@/pages/forms/FormDetailPage'
import { DashboardPage } from '@/pages/dashboard/DashboardPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import type { UserRole } from '@/types'

function RequireAuth({ roles }: { roles?: UserRole[] }) {
  const { profile, loading } = useAuth()
  if (loading) return <Spinner />
  if (!profile) return <Navigate to="/login" replace />
  if (profile.status !== 'approved') return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center max-w-sm">
        <div className="text-5xl mb-4">⏳</div>
        <h2 className="font-bold text-metro-navy text-xl mb-2">Acesso Pendente</h2>
        <p className="text-gray-500 text-sm">Seu cadastro está aguardando aprovação do administrador.</p>
      </div>
    </div>
  )
  if (roles && !roles.includes(profile.role)) return <Navigate to="/" replace />
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  )
}

export const router = createBrowserRouter([
  { path: '/login',    element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },

  // Public field operator routes (no auth required)
  { path: '/field/select',       element: <FieldSelectPage /> },
  { path: '/field/form/:planId', element: <FieldFormPage /> },
  { path: '/field/success',      element: <FieldSuccessPage /> },

  {
    element: <RequireAuth />,
    children: [
      { path: '/',                           element: <HomePage /> },
      { path: '/contracts',                  element: <ContractsListPage /> },
      { path: '/contracts/new',              element: <ContractFormPage /> },
      { path: '/contracts/:id',              element: <ContractDetailPage /> },
      { path: '/contracts/:id/edit',         element: <ContractFormPage /> },
      { path: '/maintenance',                element: <MaintenancePlansPage /> },
      { path: '/maintenance/executions',     element: <MaintenanceExecutionsPage /> },
      { path: '/irq',                        element: <IRQExecutionsPage /> },
      { path: '/forms',                      element: <FormsListPage /> },
      { path: '/forms/:id',                  element: <FormDetailPage /> },
      { path: '/dashboard',                  element: <DashboardPage /> },
      {
        element: <RequireAuth roles={['admin']} />,
        children: [
          { path: '/admin/access', element: <AccessManagementPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
])
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Build**

```bash
npm run build
```

Expected: Build succeeds. Chunk size warning is acceptable.

- [ ] **Step 4: Commit**

```bash
git add src/router.tsx
git commit -m "feat: wire forms and dashboard routes — Plan 3 complete"
```
