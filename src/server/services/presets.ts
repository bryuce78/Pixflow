import { getDb } from '../db/index.js'

export interface Preset {
  id: number
  product_id: number | null
  user_id: number | null
  name: string
  description: string | null
  prompt: Record<string, unknown>
  is_builtin: number
  created_at: string
}

interface PresetRow {
  id: number
  product_id: number | null
  user_id: number | null
  name: string
  description: string | null
  prompt: string
  is_builtin: number
  created_at: string
}

function rowToPreset(row: PresetRow): Preset {
  let prompt: Record<string, unknown> = {}
  try { prompt = JSON.parse(row.prompt) } catch { /* corrupted row */ }
  return { ...row, prompt }
}

export function getPresets(productId: number | undefined, userId: number): Preset[] {
  const db = getDb()
  const conditions: string[] = []
  const params: unknown[] = []

  if (productId !== undefined) {
    conditions.push('(product_id = ? OR product_id IS NULL)')
    params.push(productId)
  }

  conditions.push('(is_builtin = 1 OR user_id = ?)')
  params.push(userId)

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const rows = db.prepare(`SELECT * FROM presets ${where} ORDER BY is_builtin DESC, created_at DESC`).all(...params) as PresetRow[]
  return rows.map(rowToPreset)
}

export function getPreset(id: number, userId: number): Preset | null {
  const db = getDb()
  const row = db.prepare(
    'SELECT * FROM presets WHERE id = ? AND (is_builtin = 1 OR user_id = ?)'
  ).get(id, userId) as PresetRow | undefined
  return row ? rowToPreset(row) : null
}

function getPresetInternal(id: number): Preset | null {
  const db = getDb()
  const row = db.prepare('SELECT * FROM presets WHERE id = ?').get(id) as PresetRow | undefined
  return row ? rowToPreset(row) : null
}

export function createPreset(
  userId: number,
  name: string,
  description: string | null,
  prompt: Record<string, unknown>,
  productId?: number,
): Preset {
  const db = getDb()
  const result = db.prepare(
    'INSERT INTO presets (user_id, name, description, prompt, product_id, is_builtin) VALUES (?, ?, ?, ?, ?, 0)'
  ).run(userId, name, description, JSON.stringify(prompt), productId ?? null)
  return getPresetInternal(result.lastInsertRowid as number)!
}

export function updatePreset(
  id: number,
  userId: number,
  updates: { name?: string; description?: string; prompt?: Record<string, unknown> },
): Preset | null {
  const db = getDb()
  const existing = db.prepare('SELECT * FROM presets WHERE id = ?').get(id) as PresetRow | undefined
  if (!existing || existing.is_builtin || existing.user_id !== userId) return null

  const sets: string[] = []
  const params: unknown[] = []

  if (updates.name !== undefined) { sets.push('name = ?'); params.push(updates.name) }
  if (updates.description !== undefined) { sets.push('description = ?'); params.push(updates.description) }
  if (updates.prompt !== undefined) { sets.push('prompt = ?'); params.push(JSON.stringify(updates.prompt)) }

  if (sets.length === 0) return getPresetInternal(id)

  params.push(id)
  db.prepare(`UPDATE presets SET ${sets.join(', ')} WHERE id = ?`).run(...params)
  return getPresetInternal(id)
}

export function deletePreset(id: number, userId: number): boolean {
  const db = getDb()
  const existing = db.prepare('SELECT * FROM presets WHERE id = ?').get(id) as PresetRow | undefined
  if (!existing || existing.is_builtin || existing.user_id !== userId) return false
  db.prepare('DELETE FROM presets WHERE id = ?').run(id)
  return true
}
