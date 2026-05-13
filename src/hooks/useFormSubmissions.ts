import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface FormSubmission {
  id:           string
  execution_id: string
  form_key:     string | null
  form_data:    Record<string, unknown>
  submitted_at: string
}

export function useFormSubmissions(executionId: string | null | undefined) {
  return useQuery({
    queryKey: ['form_submissions', executionId],
    queryFn: async (): Promise<FormSubmission[]> => {
      const { data, error } = await supabase
        .from('form_submissions')
        .select('*')
        .eq('execution_id', executionId!)
        .order('submitted_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as FormSubmission[]
    },
    enabled: !!executionId,
  })
}

export function useFormSubmissionsByFormKey(formKey: string | null | undefined) {
  return useQuery({
    queryKey: ['form_submissions', 'by_form_key', formKey],
    queryFn: async (): Promise<FormSubmission[]> => {
      const { data, error } = await supabase
        .from('form_submissions')
        .select('*, execution:maintenance_executions(id,os_number,scheduled_date,locality:localities(name))')
        .eq('form_key', formKey!)
        .order('submitted_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as FormSubmission[]
    },
    enabled: !!formKey,
  })
}
