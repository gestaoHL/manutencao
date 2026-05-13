import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface FormFieldMeta {
  key:     string
  label:   string
  section: string
  type:    string
  unit:    string | null
  ref:     string | null
}

export interface FormMetadata {
  form_key:   string
  title:      string
  fields:     FormFieldMeta[]
  updated_at: string
}

export function useFormMetadata(formKey: string | null | undefined) {
  return useQuery({
    queryKey: ['form_metadata', formKey],
    queryFn: async (): Promise<FormMetadata | null> => {
      if (!formKey) return null
      const { data, error } = await supabase
        .from('form_field_metadata')
        .select('*')
        .eq('form_key', formKey)
        .single()
      if (error) return null
      return data as FormMetadata
    },
    enabled: !!formKey,
    staleTime: 1000 * 60 * 60, // metadados raramente mudam — cache 1h
  })
}

/** Extrai o form_key a partir do form_url do plano (ex: "/forms/cubiculo-blindado-1kvcc.html" → "cubiculo-blindado-1kvcc") */
export function formKeyFromUrl(formUrl: string | null | undefined): string | null {
  if (!formUrl) return null
  const filename = formUrl.split('/').pop() ?? ''
  return filename.replace(/\.html?$/, '') || null
}
