export interface FormEntry {
  filename: string
  label: string
  path: string
  plan_type: 'preventiva' | 'irq'
}

export const FORMS_CATALOG: FormEntry[] = [
  {
    filename: 'cubiculo-blindado-1kvcc.html',
    label: 'Cubículo Blindado 1kVcc',
    path: '/forms/preventiva/cubiculo-blindado-1kvcc.html',
    plan_type: 'preventiva',
  },
]

export function getFormsByPlanType(planType: string): FormEntry[] {
  return FORMS_CATALOG.filter(f => f.plan_type === planType)
}
