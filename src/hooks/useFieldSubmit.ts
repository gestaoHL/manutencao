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
