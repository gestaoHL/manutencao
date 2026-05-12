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
