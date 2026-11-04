import type { Play } from './types'

// Guarda las reproducciones ya parseadas en IndexedDB para no tener que
// volver a subir el archivo en cada recarga. Todo queda en el navegador.
const DB = 'ytmusic-stats'
const STORE = 'history'
const KEY = 'plays-v2' // subir la versión si cambia la forma de Play

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export interface Saved {
  plays: Play[]
  fileName: string
  savedAt: number
}

export async function savePlays(data: Saved): Promise<void> {
  try {
    const db = await open()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(data, KEY)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    /* sin persistencia: no es grave */
  }
}

export async function loadPlays(): Promise<Saved | null> {
  try {
    const db = await open()
    return await new Promise((resolve, reject) => {
      const req = db.transaction(STORE).objectStore(STORE).get(KEY)
      req.onsuccess = () => resolve((req.result as Saved) ?? null)
      req.onerror = () => reject(req.error)
    })
  } catch {
    return null
  }
}

export async function clearPlays(): Promise<void> {
  try {
    const db = await open()
    db.transaction(STORE, 'readwrite').objectStore(STORE).delete(KEY)
  } catch {
    /* noop */
  }
}
