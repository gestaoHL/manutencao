export type UserRole = 'admin' | 'fiscalizacao' | 'contratada' | 'gestor' | 'operador_campo'
export type ProfileStatus = 'pending' | 'approved' | 'rejected'
export type ContractStatus = 'active' | 'suspended' | 'expired' | 'terminated'
export type AssetType = 'equipment' | 'location' | 'building'
export type ExecutionStatus = 'pendente' | 'recebido' | 'em_analise' | 'aprovado' | 'rejeitado' | 'cancelado'
export type PlanType = 'preventiva' | 'irq'

export interface Profile {
  id: string
  user_id: string
  role: UserRole
  full_name: string | null
  company_name: string | null
  company_id: string | null
  status: ProfileStatus
  created_at: string
  company?: Pick<Company, 'id' | 'name'>
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
  commitment_notes?: { valor_empenhado: number }[]
  budget_executions?: { valor_pago: number }[]
}

export interface ContractDocument {
  name: string
  url: string
}

export interface CommitmentNote {
  id: string
  contract_id: string
  numero: string
  valor_empenhado: number
  data_empenho: string
  descricao: string | null
  created_at: string
  contract?: Pick<Contract, 'id' | 'title' | 'contract_number'>
}

export interface BudgetExecution {
  id: string
  contract_id: string
  commitment_note_id: string | null
  data_pagamento: string
  valor_pago: number
  descricao: string | null
  numero_op: string | null
  created_at: string
  contract?: Pick<Contract, 'id' | 'title' | 'contract_number'>
  commitment_note?: Pick<CommitmentNote, 'id' | 'numero'>
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

export interface Company {
  id: string
  name: string
  cnpj: string | null
  contact: string | null
  email: string | null
  created_at: string
}

export interface Sistema {
  id: string
  name: string
  description: string | null
  created_at: string
}

export interface Equipment {
  id: string
  name: string
  tag: string | null
  description: string | null
  sistema_id: string | null
  locality_id: string | null
  created_at: string
  sistema?: Pick<Sistema, 'id' | 'name'>
  locality?: Pick<Locality, 'id' | 'name'>
}

export interface Locality {
  id: string
  name: string
  description: string | null
  created_at: string
}

export interface Periodicity {
  id: string
  name: string
  interval_days: number
  created_at: string
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
  asset_id: string | null
  periodicity_id: string | null
  company_id: string | null
  sistema_id: string | null
  title: string
  plan_type: PlanType
  frequency: string | null
  next_due: string | null
  template_fields: TemplateField[]
  form_url: string | null
  created_at: string
  asset?: Pick<Asset, 'id' | 'name' | 'type' | 'location'>
  periodicity?: Pick<Periodicity, 'id' | 'name' | 'interval_days'>
  company?: Pick<Company, 'id' | 'name'>
  sistema?: Pick<Sistema, 'id' | 'name'>
}

export interface MaintenanceExecution {
  id: string
  plan_id: string
  asset_id: string | null
  locality_id: string | null
  equipment_id: string | null
  plan_type: PlanType
  scheduled_date: string
  executed_date: string | null
  status: ExecutionStatus
  os_number: string | null
  psa_item: string | null
  notes: string | null
  internal_notes: string | null
  rejection_reason: string | null
  executed_by: string | null
  form_data: Record<string, unknown>
  created_at: string
  plan?: Pick<MaintenancePlan, 'id' | 'title' | 'plan_type' | 'form_url'> & { template_fields: TemplateField[] }
  locality?: Pick<Locality, 'id' | 'name'>
  asset?: Pick<Asset, 'id' | 'name' | 'location'>
  equipment?: Pick<Equipment, 'id' | 'name' | 'tag'>
}

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
