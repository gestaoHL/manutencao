# Plano 2 — Manutenção Preventiva + IRQ + Formulários de Campo

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Preventive Maintenance and IRQ modules — maintenance plan management (admin/gestor), field form submission by unauthenticated operators (asset selection → OS/PSA → dynamic form → submit), and the submission workflow including offline-first storage with auto-sync via IndexedDB.

**Architecture:** Admin/gestor create `maintenance_plans` linked to assets. Field operators (no login) access public routes `/field/*`, select an asset + plan, fill in their OS number + PSA item, then complete a dynamic JSON-based form. Submissions go into `maintenance_executions` with status `pendente`. Offline submissions are stored in IndexedDB using `idb` and replayed when connectivity returns. Authenticated views (`/maintenance`, `/irq`) list executions with filters for privileged roles.

**Tech Stack:** React 18 + Vite + TypeScript, Tailwind CSS, TanStack Query v5, React Hook Form + Zod, Supabase (PostgreSQL + RLS), `idb` (IndexedDB wrapper), React Router v6, lucide-react.

---

## File Map

**New files to create:**
- `src/types/index.ts` — Modify: add `PlanType`, `IRQExecution`, extend `MaintenancePlan` and `MaintenanceExecution`
- `src/schemas/maintenance.schema.ts` — Zod schemas for plan creation and field form submission
- `src/hooks/usePlans.ts` — CRUD hooks for maintenance plans
- `src/hooks/useExecutions.ts` — Hooks for listing/filtering maintenance executions
- `src/hooks/useFieldSubmit.ts` — Offline-first submit hook (IndexedDB + sync)
- `src/lib/offlineStore.ts` — IndexedDB wrapper using `idb` for pending submissions
- `src/pages/maintenance/MaintenancePlansPage.tsx` — Admin/gestor: list + create maintenance plans
- `src/pages/maintenance/PlanFormModal.tsx` — Modal form for creating/editing a plan
- `src/pages/maintenance/MaintenanceExecutionsPage.tsx` — Authenticated: list of preventiva executions with filters
- `src/pages/irq/IRQExecutionsPage.tsx` — Authenticated: list of IRQ executions with filters
- `src/pages/field/FieldSelectPage.tsx` — Public: select asset + plan type (preventiva or IRQ)
- `src/pages/field/FieldFormPage.tsx` — Public: fill OS + PSA + dynamic form + submit
- `src/pages/field/FieldSuccessPage.tsx` — Public: confirmation after submission
- `src/router.tsx` — Modify: add new routes for /maintenance, /irq, /field/*

**Modified files:**
- `src/types/index.ts` — Add `PlanType = 'preventiva' | 'irq'`, extend `MaintenancePlan` with `plan_type` and `template_fields`, extend `MaintenanceExecution` with `os_number`, `psa_item`, `plan_type`, `asset_id`

---

## SQL Migration (Manual Step — Run in Supabase SQL Editor)

Before starting implementation, run this migration in the Supabase SQL Editor:

```sql
-- Add plan_type and template to maintenance_plans
ALTER TABLE maintenance_plans
  ADD COLUMN IF NOT EXISTS plan_type TEXT NOT NULL DEFAULT 'preventiva' CHECK (plan_type IN ('preventiva', 'irq')),
  ADD COLUMN IF NOT EXISTS template_fields JSONB NOT NULL DEFAULT '[]';

-- Add os_number, psa_item, plan_type, asset_id to maintenance_executions
ALTER TABLE maintenance_executions
  ADD COLUMN IF NOT EXISTS os_number TEXT,
  ADD COLUMN IF NOT EXISTS psa_item TEXT,
  ADD COLUMN IF NOT EXISTS plan_type TEXT NOT NULL DEFAULT 'preventiva' CHECK (plan_type IN ('preventiva', 'irq')),
  ADD COLUMN IF NOT EXISTS asset_id UUID REFERENCES assets(id);

-- Update status CHECK constraint
ALTER TABLE maintenance_executions DROP CONSTRAINT IF EXISTS maintenance_executions_status_check;
ALTER TABLE maintenance_executions ADD CONSTRAINT maintenance_executions_status_check
  CHECK (status IN ('pendente', 'em_analise', 'aprovado', 'rejeitado'));

-- RLS: public insert for field operators (no auth)
ALTER TABLE maintenance_executions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "field_insert" ON maintenance_executions;
CREATE POLICY "field_insert" ON maintenance_executions
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "auth_select" ON maintenance_executions;
CREATE POLICY "auth_select" ON maintenance_executions
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "contractor_update_rejected" ON maintenance_executions;
CREATE POLICY "contractor_update_rejected" ON maintenance_executions
  FOR UPDATE USING (
    auth.role() = 'authenticated'
    AND status = 'rejeitado'
    AND asset_id IN (
      SELECT a.id FROM assets a
      JOIN contracts c ON c.id = a.contract_id
      WHERE c.contractor_profile_id = (
        SELECT id FROM profiles WHERE user_id = auth.uid()
      )
    )
  );

-- RLS for maintenance_plans: authenticated read, admin/gestor write
ALTER TABLE maintenance_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "plans_select" ON maintenance_plans;
CREATE POLICY "plans_select" ON maintenance_plans
  FOR SELECT USING (auth.role() = 'authenticated' OR true);

DROP POLICY IF EXISTS "plans_insert" ON maintenance_plans;
CREATE POLICY "plans_insert" ON maintenance_plans
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid() AND role IN ('admin', 'gestor')
    )
  );

DROP POLICY IF EXISTS "plans_update" ON maintenance_plans;
CREATE POLICY "plans_update" ON maintenance_plans
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid() AND role IN ('admin', 'gestor')
    )
  );

DROP POLICY IF EXISTS "plans_delete" ON maintenance_plans;
CREATE POLICY "plans_delete" ON maintenance_plans
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
```

---

### Task 1: Update types and install `idb`

**Files:**
- Modify: `src/types/index.ts`
- Create: `src/lib/offlineStore.ts`

- [ ] **Step 1: Install idb**

```bash
cd "C:\Users\Herbert G L J\Desktop\Projetos HTML\metro-manutencao"
npm install idb
```

Expected: idb appears in package.json dependencies.

- [ ] **Step 2: Update types**

Replace the content of `src/types/index.ts`:

```typescript
export type UserRole = 'admin' | 'fiscalizacao' | 'contratada' | 'gestor'
export type ProfileStatus = 'pending' | 'approved' | 'rejected'
export type ContractStatus = 'active' | 'suspended' | 'expired' | 'terminated'
export type AssetType = 'equipment' | 'location' | 'building'
export type ExecutionStatus = 'pendente' | 'em_analise' | 'aprovado' | 'rejeitado'
export type PlanType = 'preventiva' | 'irq'

export interface Profile {
  id: string
  user_id: string
  role: UserRole
  full_name: string | null
  company_name: string | null
  status: ProfileStatus
  created_at: string
}

export interface Contract {
  id: string
  contractor_profile_id: string
  title: string
  contract_number: string
  object: string
  value: number | null
  start_date: string
  end_date: string | null
  status: ContractStatus
  sla_response_hours: number | null
  sla_completion_hours: number | null
  documents: ContractDocument[]
  notes: string | null
  created_by: string
  created_at: string
  contractor?: Pick<Profile, 'id' | 'full_name' | 'company_name'>
  assets?: Asset[]
}

export interface ContractDocument {
  name: string
  url: string
}

export interface Asset {
  id: string
  contract_id: string
  name: string
  type: AssetType
  description: string | null
  location: string | null
  created_at: string
  contract?: Pick<Contract, 'id' | 'title' | 'contract_number'>
}

export interface TemplateField {
  id: string
  label: string
  type: 'text' | 'number' | 'select' | 'textarea' | 'boolean'
  required: boolean
  options?: string[]
}

export interface MaintenancePlan {
  id: string
  asset_id: string
  title: string
  plan_type: PlanType
  frequency: string
  next_due: string | null
  template_fields: TemplateField[]
  created_at: string
  asset?: Pick<Asset, 'id' | 'name' | 'type' | 'location'>
}

export interface MaintenanceExecution {
  id: string
  plan_id: string
  asset_id: string | null
  plan_type: PlanType
  scheduled_date: string
  executed_date: string | null
  status: ExecutionStatus
  os_number: string | null
  psa_item: string | null
  notes: string | null
  rejection_reason: string | null
  executed_by: string | null
  form_data: Record<string, unknown>
  created_at: string
  plan?: Pick<MaintenancePlan, 'id' | 'title' | 'plan_type'>
  asset?: Pick<Asset, 'id' | 'name' | 'location'>
}

export interface OfflinePendingSubmission {
  localId: string
  plan_id: string
  asset_id: string
  plan_type: PlanType
  os_number: string
  psa_item: string
  form_data: Record<string, unknown>
  created_at: string
  synced: boolean
}
```

- [ ] **Step 3: Create offline store**

Create `src/lib/offlineStore.ts`:

```typescript
import { openDB, type DBSchema, type IDBPDatabase } from 'idb'

interface MetroDB extends DBSchema {
  pending_submissions: {
    key: string
    value: {
      localId: string
      plan_id: string
      asset_id: string
      plan_type: string
      os_number: string
      psa_item: string
      form_data: Record<string, unknown>
      created_at: string
      synced: boolean
    }
  }
}

let dbPromise: Promise<IDBPDatabase<MetroDB>> | null = null

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<MetroDB>('metro-manutencao', 1, {
      upgrade(db) {
        db.createObjectStore('pending_submissions', { keyPath: 'localId' })
      },
    })
  }
  return dbPromise
}

export async function savePendingSubmission(
  submission: Omit<MetroDB['pending_submissions']['value'], 'localId' | 'synced'>
): Promise<string> {
  const db = await getDB()
  const localId = crypto.randomUUID()
  await db.put('pending_submissions', { ...submission, localId, synced: false })
  return localId
}

export async function getPendingSubmissions() {
  const db = await getDB()
  const all = await db.getAll('pending_submissions')
  return all.filter(s => !s.synced)
}

export async function markSynced(localId: string) {
  const db = await getDB()
  const item = await db.get('pending_submissions', localId)
  if (item) {
    await db.put('pending_submissions', { ...item, synced: true })
  }
}

export async function deleteSynced() {
  const db = await getDB()
  const all = await db.getAll('pending_submissions')
  const synced = all.filter(s => s.synced)
  for (const s of synced) {
    await db.delete('pending_submissions', s.localId)
  }
}
```

- [ ] **Step 4: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/types/index.ts src/lib/offlineStore.ts package.json package-lock.json
git commit -m "feat: add PlanType, TemplateField types and IndexedDB offline store"
```

---

### Task 2: Maintenance plan Zod schemas and CRUD hooks

**Files:**
- Create: `src/schemas/maintenance.schema.ts`
- Create: `src/hooks/usePlans.ts`
- Create: `src/hooks/useExecutions.ts`

- [ ] **Step 1: Create maintenance schemas**

Create `src/schemas/maintenance.schema.ts`:

```typescript
import { z } from 'zod'

export const templateFieldSchema = z.object({
  id: z.string().min(1, 'ID obrigatório'),
  label: z.string().min(1, 'Rótulo obrigatório'),
  type: z.enum(['text', 'number', 'select', 'textarea', 'boolean']),
  required: z.boolean(),
  options: z.array(z.string()).optional(),
})

export const planSchema = z.object({
  asset_id: z.string().uuid('Ativo obrigatório'),
  title: z.string().min(3, 'Título obrigatório'),
  plan_type: z.enum(['preventiva', 'irq']),
  frequency: z.string().min(1, 'Frequência obrigatória'),
  next_due: z.string().nullable().optional(),
  template_fields: z.array(templateFieldSchema).default([]),
})

export type PlanFormData = z.infer<typeof planSchema>

export const fieldSubmitSchema = z.object({
  plan_id: z.string().uuid(),
  asset_id: z.string().uuid(),
  plan_type: z.enum(['preventiva', 'irq']),
  os_number: z.string().min(1, 'Número da OS obrigatório'),
  psa_item: z.string().min(1, 'Item da PSA obrigatório'),
  form_data: z.record(z.unknown()),
})

export type FieldSubmitData = z.infer<typeof fieldSubmitSchema>
```

- [ ] **Step 2: Create usePlans hook**

Create `src/hooks/usePlans.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { MaintenancePlan, PlanType } from '@/types'
import type { PlanFormData } from '@/schemas/maintenance.schema'

export function usePlans(assetId?: string, planType?: PlanType) {
  return useQuery({
    queryKey: ['plans', assetId, planType],
    queryFn: async (): Promise<MaintenancePlan[]> => {
      let query = supabase
        .from('maintenance_plans')
        .select('*, asset:assets(id,name,type,location)')
        .order('created_at', { ascending: false })

      if (assetId) query = query.eq('asset_id', assetId)
      if (planType) query = query.eq('plan_type', planType)

      const { data, error } = await query
      if (error) throw error
      return (data ?? []) as MaintenancePlan[]
    },
  })
}

export function usePlan(id: string) {
  return useQuery({
    queryKey: ['plans', id],
    queryFn: async (): Promise<MaintenancePlan> => {
      const { data, error } = await supabase
        .from('maintenance_plans')
        .select('*, asset:assets(id,name,type,location)')
        .eq('id', id)
        .single()
      if (error) throw error
      return data as MaintenancePlan
    },
    enabled: !!id,
  })
}

export function useCreatePlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: PlanFormData) => {
      const { error } = await supabase.from('maintenance_plans').insert(data)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plans'] }),
  })
}

export function useUpdatePlan(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: Partial<PlanFormData>) => {
      const { error } = await supabase.from('maintenance_plans').update(data).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plans'] }),
  })
}

export function useDeletePlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('maintenance_plans').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plans'] }),
  })
}

export function usePublicAssets() {
  return useQuery({
    queryKey: ['public-assets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('assets')
        .select('id, name, type, location, contract:contracts(id,title,contract_number)')
        .order('name')
      if (error) throw error
      return data ?? []
    },
  })
}
```

- [ ] **Step 3: Create useExecutions hook**

Create `src/hooks/useExecutions.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'
import type { MaintenanceExecution, PlanType, ExecutionStatus } from '@/types'

export function useExecutions(planType?: PlanType) {
  const { profile } = useAuth()

  return useQuery({
    queryKey: ['executions', planType, profile?.id, profile?.role],
    queryFn: async (): Promise<MaintenanceExecution[]> => {
      let query = supabase
        .from('maintenance_executions')
        .select('*, plan:maintenance_plans(id,title,plan_type), asset:assets(id,name,location)')
        .order('created_at', { ascending: false })

      if (planType) query = query.eq('plan_type', planType)

      if (profile?.role === 'contratada') {
        const { data: assetIds } = await supabase
          .from('assets')
          .select('id')
          .in(
            'contract_id',
            (await supabase
              .from('contracts')
              .select('id')
              .eq('contractor_profile_id', profile.id)
              .then(r => (r.data ?? []).map(c => c.id)))
          )
        const ids = (assetIds ?? []).map(a => a.id)
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

export function useExecution(id: string) {
  return useQuery({
    queryKey: ['executions', id],
    queryFn: async (): Promise<MaintenanceExecution> => {
      const { data, error } = await supabase
        .from('maintenance_executions')
        .select('*, plan:maintenance_plans(id,title,plan_type), asset:assets(id,name,location)')
        .eq('id', id)
        .single()
      if (error) throw error
      return data as MaintenanceExecution
    },
    enabled: !!id,
  })
}

export function useSubmitExecution() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: {
      plan_id: string
      asset_id: string
      plan_type: PlanType
      os_number: string
      psa_item: string
      form_data: Record<string, unknown>
    }) => {
      const { error } = await supabase.from('maintenance_executions').insert({
        ...data,
        status: 'pendente',
        scheduled_date: new Date().toISOString(),
      })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['executions'] }),
  })
}

export function useUpdateExecutionStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, status, rejection_reason }: { id: string; status: ExecutionStatus; rejection_reason?: string }) => {
      const { error } = await supabase
        .from('maintenance_executions')
        .update({ status, ...(rejection_reason ? { rejection_reason } : {}) })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['executions'] }),
  })
}
```

- [ ] **Step 4: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/schemas/maintenance.schema.ts src/hooks/usePlans.ts src/hooks/useExecutions.ts
git commit -m "feat: maintenance schemas and plan/execution hooks"
```

---

### Task 3: Offline-first field submit hook

**Files:**
- Create: `src/hooks/useFieldSubmit.ts`

- [ ] **Step 1: Create useFieldSubmit hook**

Create `src/hooks/useFieldSubmit.ts`:

```typescript
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import {
  savePendingSubmission,
  getPendingSubmissions,
  markSynced,
  deleteSynced,
} from '@/lib/offlineStore'
import type { FieldSubmitData } from '@/schemas/maintenance.schema'

async function syncPendingToSupabase() {
  const pending = await getPendingSubmissions()
  for (const item of pending) {
    const { error } = await supabase.from('maintenance_executions').insert({
      plan_id: item.plan_id,
      asset_id: item.asset_id,
      plan_type: item.plan_type,
      os_number: item.os_number,
      psa_item: item.psa_item,
      form_data: item.form_data,
      status: 'pendente',
      scheduled_date: item.created_at,
    })
    if (!error) {
      await markSynced(item.localId)
    }
  }
  await deleteSynced()
}

export function useFieldSubmit() {
  const [submitting, setSubmitting] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)

  const refreshPendingCount = useCallback(async () => {
    const items = await getPendingSubmissions()
    setPendingCount(items.length)
  }, [])

  useEffect(() => {
    refreshPendingCount()

    function handleOnline() {
      syncPendingToSupabase().then(refreshPendingCount)
    }

    window.addEventListener('online', handleOnline)
    if (navigator.onLine) handleOnline()

    return () => window.removeEventListener('online', handleOnline)
  }, [refreshPendingCount])

  async function submit(data: FieldSubmitData): Promise<'online' | 'offline'> {
    setSubmitting(true)
    try {
      if (navigator.onLine) {
        const { error } = await supabase.from('maintenance_executions').insert({
          plan_id: data.plan_id,
          asset_id: data.asset_id,
          plan_type: data.plan_type,
          os_number: data.os_number,
          psa_item: data.psa_item,
          form_data: data.form_data,
          status: 'pendente',
          scheduled_date: new Date().toISOString(),
        })
        if (error) throw error
        return 'online'
      } else {
        await savePendingSubmission({
          plan_id: data.plan_id,
          asset_id: data.asset_id,
          plan_type: data.plan_type,
          os_number: data.os_number,
          psa_item: data.psa_item,
          form_data: data.form_data,
          created_at: new Date().toISOString(),
        })
        await refreshPendingCount()
        return 'offline'
      }
    } finally {
      setSubmitting(false)
    }
  }

  return { submit, submitting, pendingCount }
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useFieldSubmit.ts
git commit -m "feat: offline-first field submit hook with IndexedDB sync"
```

---

### Task 4: Field operator pages — asset/plan selection

**Files:**
- Create: `src/pages/field/FieldSelectPage.tsx`

- [ ] **Step 1: Create FieldSelectPage**

Create `src/pages/field/FieldSelectPage.tsx`:

```tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Wrench, Zap, MapPin, ChevronRight, Wifi, WifiOff } from 'lucide-react'
import { usePublicAssets } from '@/hooks/usePlans'
import { usePlans } from '@/hooks/usePlans'
import { Spinner } from '@/components/ui/Spinner'
import type { PlanType } from '@/types'

export function FieldSelectPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<'type' | 'asset' | 'plan'>('type')
  const [planType, setPlanType] = useState<PlanType>('preventiva')
  const [selectedAssetId, setSelectedAssetId] = useState<string>('')
  const [assetSearch, setAssetSearch] = useState('')
  const isOnline = navigator.onLine

  const { data: assets, isLoading: loadingAssets } = usePublicAssets()
  const { data: plans, isLoading: loadingPlans } = usePlans(
    step === 'plan' ? selectedAssetId : undefined,
    step === 'plan' ? planType : undefined
  )

  const filteredAssets = (assets ?? []).filter(a =>
    a.name.toLowerCase().includes(assetSearch.toLowerCase()) ||
    (a.location ?? '').toLowerCase().includes(assetSearch.toLowerCase())
  )

  function selectType(type: PlanType) {
    setPlanType(type)
    setStep('asset')
  }

  function selectAsset(assetId: string) {
    setSelectedAssetId(assetId)
    setStep('plan')
  }

  function selectPlan(planId: string) {
    navigate(`/field/form/${planId}?asset=${selectedAssetId}&type=${planType}`)
  }

  const assetTypeIcon = { equipment: '⚙️', location: '📍', building: '🏢' }

  return (
    <div className="min-h-screen bg-metro-bg">
      {/* Header */}
      <div className="bg-metro-navy px-4 pt-safe pb-4">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 bg-metro-orange rounded-full flex items-center justify-center text-white font-bold text-sm">M</div>
          <span className="text-white font-semibold">Metrô Manutenção</span>
          <div className="ml-auto">
            {isOnline
              ? <Wifi size={16} className="text-green-400" />
              : <WifiOff size={16} className="text-red-400" />
            }
          </div>
        </div>
        <p className="text-white/60 text-xs mt-2">
          {step === 'type' && 'Selecione o tipo de registro'}
          {step === 'asset' && 'Selecione o ativo'}
          {step === 'plan' && 'Selecione o plano'}
        </p>
        {/* Breadcrumb */}
        <div className="flex items-center gap-1 mt-2 text-xs text-white/50">
          <button onClick={() => setStep('type')} className={step !== 'type' ? 'text-white/80' : 'text-metro-orange font-semibold'}>Tipo</button>
          <ChevronRight size={12} />
          <button
            onClick={() => step === 'plan' && setStep('asset')}
            className={step === 'asset' ? 'text-metro-orange font-semibold' : step === 'plan' ? 'text-white/80' : ''}
          >Ativo</button>
          <ChevronRight size={12} />
          <span className={step === 'plan' ? 'text-metro-orange font-semibold' : ''}>Plano</span>
        </div>
      </div>

      <div className="p-4 max-w-lg mx-auto">

        {/* Step: type selection */}
        {step === 'type' && (
          <div className="grid grid-cols-2 gap-3 mt-2">
            <button
              onClick={() => selectType('preventiva')}
              className="bg-metro-orange text-white rounded-2xl p-5 flex flex-col items-center gap-3 shadow active:scale-95 transition"
            >
              <Wrench size={32} strokeWidth={1.5} />
              <span className="font-semibold text-sm">Preventiva</span>
            </button>
            <button
              onClick={() => selectType('irq')}
              className="bg-metro-navy text-white rounded-2xl p-5 flex flex-col items-center gap-3 shadow active:scale-95 transition"
            >
              <Zap size={32} strokeWidth={1.5} />
              <span className="font-semibold text-sm">IRQ</span>
            </button>
          </div>
        )}

        {/* Step: asset selection */}
        {step === 'asset' && (
          <div>
            <input
              type="search"
              placeholder="Buscar ativo ou localidade..."
              value={assetSearch}
              onChange={e => setAssetSearch(e.target.value)}
              className="w-full mb-3 px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-metro-orange bg-white"
            />
            {loadingAssets ? (
              <Spinner />
            ) : filteredAssets.length === 0 ? (
              <p className="text-center text-gray-400 text-sm mt-8">Nenhum ativo encontrado.</p>
            ) : (
              <div className="space-y-2">
                {filteredAssets.map(asset => (
                  <button
                    key={asset.id}
                    onClick={() => selectAsset(asset.id)}
                    className="w-full bg-white rounded-xl p-3 flex items-center gap-3 border border-gray-100 shadow-sm hover:border-metro-orange transition text-left"
                  >
                    <span className="text-xl">{assetTypeIcon[asset.type as keyof typeof assetTypeIcon] ?? '⚙️'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-metro-navy text-sm truncate">{asset.name}</p>
                      {asset.location && (
                        <p className="text-xs text-gray-400 flex items-center gap-1">
                          <MapPin size={10} /> {asset.location}
                        </p>
                      )}
                    </div>
                    <ChevronRight size={16} className="text-gray-300 shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step: plan selection */}
        {step === 'plan' && (
          <div>
            {loadingPlans ? (
              <Spinner />
            ) : (plans ?? []).length === 0 ? (
              <div className="text-center mt-8">
                <p className="text-gray-500 text-sm">Nenhum plano de {planType === 'preventiva' ? 'preventiva' : 'IRQ'} disponível para este ativo.</p>
                <button onClick={() => setStep('asset')} className="mt-4 text-metro-orange text-sm font-medium">← Voltar</button>
              </div>
            ) : (
              <div className="space-y-2">
                {(plans ?? []).map(plan => (
                  <button
                    key={plan.id}
                    onClick={() => selectPlan(plan.id)}
                    className="w-full bg-white rounded-xl p-4 flex items-center gap-3 border border-gray-100 shadow-sm hover:border-metro-orange transition text-left"
                  >
                    <div className="flex-1">
                      <p className="font-semibold text-metro-navy text-sm">{plan.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">Frequência: {plan.frequency}</p>
                    </div>
                    <ChevronRight size={16} className="text-gray-300 shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
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
git add src/pages/field/FieldSelectPage.tsx
git commit -m "feat: field operator asset/plan selection page"
```

---

### Task 5: Field form page with dynamic fields and offline submit

**Files:**
- Create: `src/pages/field/FieldFormPage.tsx`
- Create: `src/pages/field/FieldSuccessPage.tsx`

- [ ] **Step 1: Create FieldFormPage**

Create `src/pages/field/FieldFormPage.tsx`:

```tsx
import { useState } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ChevronLeft, Wifi, WifiOff } from 'lucide-react'
import { usePlan } from '@/hooks/usePlans'
import { useFieldSubmit } from '@/hooks/useFieldSubmit'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import type { TemplateField } from '@/types'

const headerSchema = z.object({
  os_number: z.string().min(1, 'Número da OS obrigatório'),
  psa_item: z.string().min(1, 'Item da PSA obrigatório'),
})
type HeaderData = z.infer<typeof headerSchema>

function DynamicField({ field, value, onChange, error }: {
  field: TemplateField
  value: unknown
  onChange: (v: unknown) => void
  error?: string
}) {
  const base = 'w-full rounded-xl border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-metro-orange'
  const borderClass = error ? 'border-red-400' : 'border-gray-200'

  if (field.type === 'boolean') {
    return (
      <div className="flex items-center gap-3 py-1">
        <input
          type="checkbox"
          id={field.id}
          checked={!!value}
          onChange={e => onChange(e.target.checked)}
          className="w-5 h-5 accent-metro-orange"
        />
        <label htmlFor={field.id} className="text-sm text-metro-navy font-medium">{field.label}{field.required && ' *'}</label>
        {error && <span className="text-xs text-red-500">{error}</span>}
      </div>
    )
  }

  if (field.type === 'select' && field.options) {
    return (
      <div>
        <label className="block text-xs font-semibold text-metro-navy mb-1">{field.label}{field.required && ' *'}</label>
        <select
          value={(value as string) ?? ''}
          onChange={e => onChange(e.target.value)}
          className={`${base} ${borderClass} bg-white`}
        >
          <option value="">Selecione...</option>
          {field.options.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      </div>
    )
  }

  if (field.type === 'textarea') {
    return (
      <div>
        <label className="block text-xs font-semibold text-metro-navy mb-1">{field.label}{field.required && ' *'}</label>
        <textarea
          value={(value as string) ?? ''}
          onChange={e => onChange(e.target.value)}
          rows={3}
          className={`${base} ${borderClass} resize-none`}
        />
        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      </div>
    )
  }

  return (
    <div>
      <label className="block text-xs font-semibold text-metro-navy mb-1">{field.label}{field.required && ' *'}</label>
      <input
        type={field.type === 'number' ? 'number' : 'text'}
        value={(value as string) ?? ''}
        onChange={e => onChange(field.type === 'number' ? Number(e.target.value) : e.target.value)}
        className={`${base} ${borderClass} bg-white`}
      />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}

export function FieldFormPage() {
  const { planId } = useParams<{ planId: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const assetId = searchParams.get('asset') ?? ''
  const planType = (searchParams.get('type') ?? 'preventiva') as 'preventiva' | 'irq'
  const isOnline = navigator.onLine

  const { data: plan, isLoading } = usePlan(planId ?? '')
  const { submit, submitting } = useFieldSubmit()

  const { register, handleSubmit, formState: { errors } } = useForm<HeaderData>({
    resolver: zodResolver(headerSchema),
  })

  const [fieldValues, setFieldValues] = useState<Record<string, unknown>>({})
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  function setField(id: string, value: unknown) {
    setFieldValues(prev => ({ ...prev, [id]: value }))
    setFieldErrors(prev => { const n = { ...prev }; delete n[id]; return n })
  }

  async function onSubmit(header: HeaderData) {
    const fields = plan?.template_fields ?? []
    const newErrors: Record<string, string> = {}

    for (const f of fields) {
      const val = fieldValues[f.id]
      if (f.required && (val === undefined || val === '' || val === null)) {
        newErrors[f.id] = 'Campo obrigatório'
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setFieldErrors(newErrors)
      return
    }

    const result = await submit({
      plan_id: planId!,
      asset_id: assetId,
      plan_type: planType,
      os_number: header.os_number,
      psa_item: header.psa_item,
      form_data: fieldValues,
    })

    navigate('/field/success', { state: { mode: result } })
  }

  if (isLoading) return <div className="min-h-screen bg-metro-bg flex items-center justify-center"><Spinner /></div>
  if (!plan) return <div className="p-4 text-center text-gray-500">Plano não encontrado.</div>

  return (
    <div className="min-h-screen bg-metro-bg pb-24">
      {/* Header */}
      <div className="bg-metro-navy px-4 pt-safe pb-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-white/70 hover:text-white">
            <ChevronLeft size={22} />
          </button>
          <div className="flex-1">
            <p className="text-white font-semibold text-sm">{plan.title}</p>
            <p className="text-white/50 text-xs capitalize">{planType}</p>
          </div>
          {isOnline
            ? <Wifi size={16} className="text-green-400" />
            : <WifiOff size={16} className="text-red-400" />
          }
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="p-4 max-w-lg mx-auto space-y-4">
        {/* OS + PSA */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3">
          <p className="text-xs font-bold text-metro-navy uppercase tracking-wide">Identificação</p>
          <Input
            label="Número da OS *"
            placeholder="Ex: OS-2024-001"
            error={errors.os_number?.message}
            {...register('os_number')}
          />
          <Input
            label="Item da PSA *"
            placeholder="Ex: 3.2.1"
            error={errors.psa_item?.message}
            {...register('psa_item')}
          />
        </div>

        {/* Dynamic fields */}
        {plan.template_fields.length > 0 && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-4">
            <p className="text-xs font-bold text-metro-navy uppercase tracking-wide">Checklist</p>
            {plan.template_fields.map(field => (
              <DynamicField
                key={field.id}
                field={field}
                value={fieldValues[field.id]}
                onChange={v => setField(field.id, v)}
                error={fieldErrors[field.id]}
              />
            ))}
          </div>
        )}

        {/* Submit */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100">
          <Button type="submit" loading={submitting} className="w-full">
            {isOnline ? 'Enviar' : 'Salvar (offline)'}
          </Button>
        </div>
      </form>
    </div>
  )
}
```

- [ ] **Step 2: Create FieldSuccessPage**

Create `src/pages/field/FieldSuccessPage.tsx`:

```tsx
import { useLocation, Link } from 'react-router-dom'
import { CheckCircle, WifiOff } from 'lucide-react'

export function FieldSuccessPage() {
  const location = useLocation()
  const mode = (location.state as { mode?: string })?.mode ?? 'online'

  return (
    <div className="min-h-screen bg-metro-bg flex flex-col items-center justify-center p-6 text-center">
      <div className="bg-white rounded-3xl p-8 shadow-sm max-w-sm w-full border border-gray-100">
        {mode === 'offline' ? (
          <>
            <WifiOff size={48} className="text-metro-orange mx-auto mb-4" />
            <h2 className="text-xl font-bold text-metro-navy mb-2">Salvo offline</h2>
            <p className="text-sm text-gray-500">
              Formulário salvo localmente. Será enviado automaticamente quando você conectar à internet.
            </p>
          </>
        ) : (
          <>
            <CheckCircle size={48} className="text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-metro-navy mb-2">Enviado com sucesso!</h2>
            <p className="text-sm text-gray-500">
              Formulário submetido. Aguardando revisão da fiscalização.
            </p>
          </>
        )}
        <Link
          to="/field/select"
          className="mt-6 block w-full bg-metro-orange text-white font-semibold py-3 rounded-xl text-sm"
        >
          Novo registro
        </Link>
      </div>
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
git add src/pages/field/FieldFormPage.tsx src/pages/field/FieldSuccessPage.tsx
git commit -m "feat: field form page with dynamic fields and offline-first submit"
```

---

### Task 6: Maintenance plans management page (admin/gestor)

**Files:**
- Create: `src/pages/maintenance/MaintenancePlansPage.tsx`
- Create: `src/pages/maintenance/PlanFormModal.tsx`

- [ ] **Step 1: Create PlanFormModal**

Create `src/pages/maintenance/PlanFormModal.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, Trash2 } from 'lucide-react'
import { planSchema, type PlanFormData } from '@/schemas/maintenance.schema'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import type { Asset, MaintenancePlan } from '@/types'

interface Props {
  open: boolean
  onClose: () => void
  onSubmit: (data: PlanFormData) => Promise<void>
  assets: Asset[]
  initial?: MaintenancePlan
}

const FIELD_TYPE_OPTIONS = [
  { value: 'text', label: 'Texto' },
  { value: 'number', label: 'Número' },
  { value: 'textarea', label: 'Área de texto' },
  { value: 'select', label: 'Seleção' },
  { value: 'boolean', label: 'Sim/Não' },
]

export function PlanFormModal({ open, onClose, onSubmit, assets, initial }: Props) {
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const { register, handleSubmit, control, reset, watch, formState: { errors } } = useForm<PlanFormData>({
    resolver: zodResolver(planSchema),
    defaultValues: initial ?? {
      asset_id: '',
      title: '',
      plan_type: 'preventiva',
      frequency: '',
      next_due: null,
      template_fields: [],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'template_fields' })
  const watchedFields = watch('template_fields')

  useEffect(() => {
    if (open) {
      reset(initial ?? {
        asset_id: '',
        title: '',
        plan_type: 'preventiva',
        frequency: '',
        next_due: null,
        template_fields: [],
      })
      setServerError(null)
    }
  }, [open, initial, reset])

  async function onFormSubmit(data: PlanFormData) {
    setSaving(true)
    setServerError(null)
    try {
      await onSubmit(data)
      onClose()
    } catch (e) {
      setServerError(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  const assetOptions = assets.map(a => ({ value: a.id, label: a.name }))

  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Editar Plano' : 'Novo Plano'} size="lg">
      <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
        <Select
          label="Ativo *"
          options={assetOptions}
          placeholder="Selecione o ativo"
          error={errors.asset_id?.message}
          {...register('asset_id')}
        />
        <Input
          label="Título *"
          placeholder="Ex: Inspeção mensal de escadas rolantes"
          error={errors.title?.message}
          {...register('title')}
        />
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Tipo *"
            options={[{ value: 'preventiva', label: 'Preventiva' }, { value: 'irq', label: 'IRQ' }]}
            error={errors.plan_type?.message}
            {...register('plan_type')}
          />
          <Input
            label="Frequência *"
            placeholder="Ex: Mensal, Semanal"
            error={errors.frequency?.message}
            {...register('frequency')}
          />
        </div>
        <Input
          label="Próxima execução"
          type="date"
          {...register('next_due')}
        />

        {/* Template fields */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-metro-navy uppercase tracking-wide">Campos do Formulário</p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => append({ id: crypto.randomUUID(), label: '', type: 'text', required: false })}
            >
              <Plus size={14} /> Adicionar campo
            </Button>
          </div>
          <div className="space-y-3">
            {fields.map((field, idx) => (
              <div key={field.id} className="bg-gray-50 rounded-xl p-3 border border-gray-100 space-y-2">
                <div className="flex items-start gap-2">
                  <div className="flex-1 space-y-2">
                    <Input
                      label="Rótulo *"
                      placeholder="Ex: Temperatura do motor"
                      error={errors.template_fields?.[idx]?.label?.message}
                      {...register(`template_fields.${idx}.label`)}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <Select
                        label="Tipo"
                        options={FIELD_TYPE_OPTIONS}
                        {...register(`template_fields.${idx}.type`)}
                      />
                      <div className="flex items-center gap-2 pt-5">
                        <input
                          type="checkbox"
                          id={`req-${idx}`}
                          {...register(`template_fields.${idx}.required`)}
                          className="accent-metro-orange"
                        />
                        <label htmlFor={`req-${idx}`} className="text-sm text-metro-navy">Obrigatório</label>
                      </div>
                    </div>
                    {watchedFields?.[idx]?.type === 'select' && (
                      <Input
                        label="Opções (separadas por vírgula)"
                        placeholder="Bom, Regular, Ruim"
                        {...register(`template_fields.${idx}.options.0`)}
                      />
                    )}
                  </div>
                  <button type="button" onClick={() => remove(idx)} className="mt-5 text-red-400 hover:text-red-600">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {serverError && <p className="text-sm text-red-500">{serverError}</p>}

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">Cancelar</Button>
          <Button type="submit" loading={saving} className="flex-1">
            {initial ? 'Salvar' : 'Criar Plano'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
```

- [ ] **Step 2: Create MaintenancePlansPage**

Create `src/pages/maintenance/MaintenancePlansPage.tsx`:

```tsx
import { useState } from 'react'
import { Plus, Wrench, Zap, Calendar, Trash2, Edit2 } from 'lucide-react'
import { usePlans, useCreatePlan, useUpdatePlan, useDeletePlan } from '@/hooks/usePlans'
import { useAssets } from '@/hooks/useAssets'
import { useAuth } from '@/hooks/useAuth'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { Modal } from '@/components/ui/Modal'
import { PlanFormModal } from './PlanFormModal'
import type { MaintenancePlan, PlanType } from '@/types'
import type { PlanFormData } from '@/schemas/maintenance.schema'

export function MaintenancePlansPage() {
  const { profile } = useAuth()
  const canEdit = profile?.role === 'admin' || profile?.role === 'gestor'

  const [typeFilter, setTypeFilter] = useState<PlanType | ''>('')
  const [showCreate, setShowCreate] = useState(false)
  const [editTarget, setEditTarget] = useState<MaintenancePlan | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<MaintenancePlan | null>(null)

  const { data: plans, isLoading } = usePlans(undefined, typeFilter || undefined)
  const { data: allAssets } = useAssets(undefined)
  const createPlan = useCreatePlan()
  const updatePlan = useUpdatePlan(editTarget?.id ?? '')
  const deletePlan = useDeletePlan()

  async function handleCreate(data: PlanFormData) {
    await createPlan.mutateAsync(data)
  }

  async function handleUpdate(data: PlanFormData) {
    await updatePlan.mutateAsync(data)
  }

  async function handleDelete() {
    if (!deleteTarget) return
    await deletePlan.mutateAsync(deleteTarget.id)
    setDeleteTarget(null)
  }

  const planTypeIcon = { preventiva: <Wrench size={16} />, irq: <Zap size={16} /> }

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-metro-navy">Planos de Manutenção</h1>
          <p className="text-sm text-gray-500">{(plans ?? []).length} planos cadastrados</p>
        </div>
        {canEdit && (
          <Button onClick={() => setShowCreate(true)} size="sm">
            <Plus size={16} /> Novo Plano
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4">
        {(['', 'preventiva', 'irq'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${typeFilter === t ? 'bg-metro-orange text-white' : 'bg-white text-gray-500 border border-gray-200'}`}
          >
            {t === '' ? 'Todos' : t === 'preventiva' ? 'Preventiva' : 'IRQ'}
          </button>
        ))}
      </div>

      {isLoading ? (
        <Spinner />
      ) : (plans ?? []).length === 0 ? (
        <Card className="p-8 text-center text-gray-400">
          <Wrench size={32} className="mx-auto mb-2 text-gray-300" />
          <p className="text-sm">Nenhum plano cadastrado.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {(plans ?? []).map(plan => (
            <Card key={plan.id} className="p-4">
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-xl ${plan.plan_type === 'preventiva' ? 'bg-metro-orange/10 text-metro-orange' : 'bg-metro-navy/10 text-metro-navy'}`}>
                  {planTypeIcon[plan.plan_type]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-metro-navy text-sm">{plan.title}</p>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${plan.plan_type === 'preventiva' ? 'bg-orange-100 text-metro-orange' : 'bg-blue-100 text-blue-700'}`}>
                      {plan.plan_type === 'preventiva' ? 'Preventiva' : 'IRQ'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{plan.asset?.name ?? '—'}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                    <span>Freq: {plan.frequency}</span>
                    {plan.next_due && (
                      <span className="flex items-center gap-1">
                        <Calendar size={10} />
                        {new Date(plan.next_due).toLocaleDateString('pt-BR')}
                      </span>
                    )}
                    <span>{plan.template_fields.length} campos</span>
                  </div>
                </div>
                {canEdit && (
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => setEditTarget(plan)} className="text-gray-400 hover:text-metro-navy">
                      <Edit2 size={15} />
                    </button>
                    <button onClick={() => setDeleteTarget(plan)} className="text-gray-400 hover:text-red-500">
                      <Trash2 size={15} />
                    </button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <PlanFormModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSubmit={handleCreate}
        assets={allAssets ?? []}
      />

      {editTarget && (
        <PlanFormModal
          open={!!editTarget}
          onClose={() => setEditTarget(null)}
          onSubmit={handleUpdate}
          assets={allAssets ?? []}
          initial={editTarget}
        />
      )}

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Confirmar exclusão">
        <p className="text-sm text-gray-600 mb-4">
          Tem certeza que deseja excluir o plano <strong>{deleteTarget?.title}</strong>?
        </p>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => setDeleteTarget(null)} className="flex-1">Cancelar</Button>
          <Button variant="danger" onClick={handleDelete} loading={deletePlan.isPending} className="flex-1">Excluir</Button>
        </div>
      </Modal>
    </div>
  )
}
```

- [ ] **Step 3: Fix useAssets to accept undefined contractId**

Open `src/hooks/useAssets.ts`. The current signature is `useAssets(contractId: string)`. We need to also allow `undefined` so `MaintenancePlansPage` can fetch all assets. Replace the file:

```typescript
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
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('assets').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assets', contractId] }),
  })
}
```

- [ ] **Step 4: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/pages/maintenance/MaintenancePlansPage.tsx src/pages/maintenance/PlanFormModal.tsx src/hooks/useAssets.ts
git commit -m "feat: maintenance plans management page with create/edit/delete"
```

---

### Task 7: Authenticated execution list pages (Preventiva and IRQ)

**Files:**
- Create: `src/pages/maintenance/MaintenanceExecutionsPage.tsx`
- Create: `src/pages/irq/IRQExecutionsPage.tsx`

- [ ] **Step 1: Create MaintenanceExecutionsPage**

Create `src/pages/maintenance/MaintenanceExecutionsPage.tsx`:

```tsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ClipboardList, Search, Filter } from 'lucide-react'
import { useExecutions } from '@/hooks/useExecutions'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import type { ExecutionStatus } from '@/types'

const STATUS_OPTIONS: { value: ExecutionStatus | ''; label: string }[] = [
  { value: '', label: 'Todos' },
  { value: 'pendente', label: 'Pendente' },
  { value: 'em_analise', label: 'Em Análise' },
  { value: 'aprovado', label: 'Aprovado' },
  { value: 'rejeitado', label: 'Rejeitado' },
]

export function MaintenanceExecutionsPage() {
  const { data: executions, isLoading } = useExecutions('preventiva')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ExecutionStatus | ''>('')

  const filtered = (executions ?? []).filter(e => {
    const matchSearch =
      !search ||
      (e.os_number ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (e.asset?.name ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (e.plan?.title ?? '').toLowerCase().includes(search.toLowerCase())
    const matchStatus = !statusFilter || e.status === statusFilter
    return matchSearch && matchStatus
  })

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-metro-navy">Manutenção Preventiva</h1>
        <p className="text-sm text-gray-500">{filtered.length} registros</p>
      </div>

      {/* Search + filter */}
      <div className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            placeholder="Buscar OS, ativo ou plano..."
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
      </div>

      {isLoading ? (
        <Spinner />
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center text-gray-400">
          <ClipboardList size={32} className="mx-auto mb-2 text-gray-300" />
          <p className="text-sm">Nenhum registro encontrado.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(exec => (
            <Link key={exec.id} to={`/forms/${exec.id}`}>
              <Card className="p-4 hover:border-metro-orange transition-colors cursor-pointer">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-metro-navy text-sm truncate">{exec.plan?.title ?? '—'}</p>
                      <Badge status={exec.status} />
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{exec.asset?.name ?? '—'}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                      <span>OS: {exec.os_number ?? '—'}</span>
                      <span>PSA: {exec.psa_item ?? '—'}</span>
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

- [ ] **Step 2: Create IRQExecutionsPage**

Create `src/pages/irq/IRQExecutionsPage.tsx`:

```tsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Zap, Search, Filter } from 'lucide-react'
import { useExecutions } from '@/hooks/useExecutions'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import type { ExecutionStatus } from '@/types'

const STATUS_OPTIONS: { value: ExecutionStatus | ''; label: string }[] = [
  { value: '', label: 'Todos' },
  { value: 'pendente', label: 'Pendente' },
  { value: 'em_analise', label: 'Em Análise' },
  { value: 'aprovado', label: 'Aprovado' },
  { value: 'rejeitado', label: 'Rejeitado' },
]

export function IRQExecutionsPage() {
  const { data: executions, isLoading } = useExecutions('irq')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ExecutionStatus | ''>('')

  const filtered = (executions ?? []).filter(e => {
    const matchSearch =
      !search ||
      (e.os_number ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (e.asset?.name ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (e.plan?.title ?? '').toLowerCase().includes(search.toLowerCase())
    const matchStatus = !statusFilter || e.status === statusFilter
    return matchSearch && matchStatus
  })

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-metro-navy">IRQ — Inspeção/Intervenção Rápida</h1>
        <p className="text-sm text-gray-500">{filtered.length} registros</p>
      </div>

      <div className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            placeholder="Buscar OS, ativo ou plano..."
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
      </div>

      {isLoading ? (
        <Spinner />
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center text-gray-400">
          <Zap size={32} className="mx-auto mb-2 text-gray-300" />
          <p className="text-sm">Nenhum registro de IRQ encontrado.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(exec => (
            <Link key={exec.id} to={`/forms/${exec.id}`}>
              <Card className="p-4 hover:border-metro-orange transition-colors cursor-pointer">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-metro-navy text-sm truncate">{exec.plan?.title ?? '—'}</p>
                    <Badge status={exec.status} />
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{exec.asset?.name ?? '—'}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                    <span>OS: {exec.os_number ?? '—'}</span>
                    <span>PSA: {exec.psa_item ?? '—'}</span>
                    <span>{new Date(exec.created_at).toLocaleDateString('pt-BR')}</span>
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

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/pages/maintenance/MaintenanceExecutionsPage.tsx src/pages/irq/IRQExecutionsPage.tsx
git commit -m "feat: preventiva and IRQ execution list pages"
```

---

### Task 8: Wire new routes into router and verify build

**Files:**
- Modify: `src/router.tsx`

- [ ] **Step 1: Update router**

Replace `src/router.tsx` with:

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
      { path: '/',                    element: <HomePage /> },
      { path: '/contracts',           element: <ContractsListPage /> },
      { path: '/contracts/new',       element: <ContractFormPage /> },
      { path: '/contracts/:id',       element: <ContractDetailPage /> },
      { path: '/contracts/:id/edit',  element: <ContractFormPage /> },
      { path: '/maintenance',         element: <MaintenancePlansPage /> },
      { path: '/maintenance/executions', element: <MaintenanceExecutionsPage /> },
      { path: '/irq',                 element: <IRQExecutionsPage /> },
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

- [ ] **Step 2: Update Sidebar nav item for /maintenance**

Open `src/components/layout/Sidebar.tsx`. The `/maintenance` entry currently points to the plans page. That's correct. No change needed.

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Build**

```bash
npm run build
```

Expected: Build succeeds with no errors. Warnings about chunk size are acceptable.

- [ ] **Step 5: Commit**

```bash
git add src/router.tsx
git commit -m "feat: wire maintenance, IRQ, and field routes into router"
```

---

## Post-Implementation Checklist

- [ ] SQL migration has been run in Supabase SQL Editor (see migration block at top of plan)
- [ ] `.env.local` has real Supabase URL and anon key
- [ ] `npm run dev` starts without errors
- [ ] Field operator flow: `/field/select` → select type → select asset → select plan → fill form → submit → success
- [ ] Offline mode: disable network in DevTools → fill form → submit → see "Salvo offline" → re-enable network → form syncs
- [ ] Admin: create a maintenance plan at `/maintenance`
- [ ] Authenticated user: view preventiva list at `/maintenance/executions`, IRQ list at `/irq`
