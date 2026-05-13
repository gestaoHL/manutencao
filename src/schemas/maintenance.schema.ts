import { z } from 'zod'

export const templateFieldSchema = z.object({
  id: z.string().min(1, 'ID obrigatório'),
  label: z.string().min(1, 'Rótulo obrigatório'),
  type: z.enum(['text', 'number', 'select', 'textarea', 'boolean']),
  required: z.boolean(),
  options: z.array(z.string()).optional(),
})

export const planSchema = z.object({
  asset_id: z.string().uuid().nullable().optional(),
  periodicity_id: z.string().uuid('Periodicidade obrigatória'),
  sistema_id: z.string().uuid().nullable().optional(),
  title: z.string().min(3, 'Título obrigatório'),
  plan_type: z.enum(['preventiva', 'irq']),
  frequency: z.string().nullable().optional(),
  form_url: z.string()
    .refine(v => !v || v.startsWith('/') || v.startsWith('http://') || v.startsWith('https://'), {
      message: 'Informe uma URL (https://...) ou um caminho relativo (/forms/...)',
    })
    .nullable().optional().or(z.literal('')),
  template_fields: z.array(templateFieldSchema),
})

export type PlanFormData = z.infer<typeof planSchema>

export const fieldSubmitSchema = z.object({
  plan_id: z.string().uuid(),
  asset_id: z.string().uuid(),
  plan_type: z.enum(['preventiva', 'irq']),
  os_number: z.string().min(1, 'Número da OS obrigatório'),
  psa_item: z.string().min(1, 'Item da PSA obrigatório'),
  form_data: z.record(z.string(), z.unknown()),
})

export type FieldSubmitData = z.infer<typeof fieldSubmitSchema>
