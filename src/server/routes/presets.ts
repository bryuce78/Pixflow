import { Router } from 'express'
import { getDb } from '../db/index.js'
import { getPresets, getPreset, createPreset, updatePreset, deletePreset } from '../services/presets.js'
import type { AuthRequest } from '../middleware/auth.js'

const MAX_NAME_LENGTH = 200
const MAX_DESCRIPTION_LENGTH = 1000
const MAX_PROMPT_SIZE = 50_000

export function createPresetsRouter(): Router {
  const router = Router()

  router.get('/', (req: AuthRequest, res) => {
    const userId = req.user!.id
    let productId: number | undefined

    if (req.query.product) {
      const db = getDb()
      const row = db.prepare('SELECT id FROM products WHERE slug = ?').get(req.query.product) as { id: number } | undefined
      productId = row?.id
    }

    res.json({ presets: getPresets(productId, userId) })
  })

  router.get('/:id', (req: AuthRequest, res) => {
    const preset = getPreset(Number(req.params.id), req.user!.id)
    if (!preset) {
      res.status(404).json({ error: 'Preset not found' })
      return
    }
    res.json({ preset })
  })

  router.post('/', (req: AuthRequest, res) => {
    const { name, description, prompt, productId } = req.body

    if (!name || typeof name !== 'string' || name.length > MAX_NAME_LENGTH) {
      res.status(400).json({ error: `Name required (max ${MAX_NAME_LENGTH} chars)` })
      return
    }
    if (description && (typeof description !== 'string' || description.length > MAX_DESCRIPTION_LENGTH)) {
      res.status(400).json({ error: `Description max ${MAX_DESCRIPTION_LENGTH} chars` })
      return
    }
    if (!prompt || typeof prompt !== 'object' || Array.isArray(prompt)) {
      res.status(400).json({ error: 'Prompt must be a JSON object' })
      return
    }
    if (JSON.stringify(prompt).length > MAX_PROMPT_SIZE) {
      res.status(400).json({ error: 'Prompt too large' })
      return
    }

    const preset = createPreset(req.user!.id, name.trim(), description?.trim() ?? null, prompt, productId)
    res.status(201).json({ preset })
  })

  router.patch('/:id', (req: AuthRequest, res) => {
    const { name, description, prompt } = req.body
    const updates: { name?: string; description?: string; prompt?: Record<string, unknown> } = {}

    if (name !== undefined) {
      if (typeof name !== 'string' || name.length > MAX_NAME_LENGTH) {
        res.status(400).json({ error: `Name max ${MAX_NAME_LENGTH} chars` })
        return
      }
      updates.name = name.trim()
    }
    if (description !== undefined) {
      if (typeof description !== 'string' || description.length > MAX_DESCRIPTION_LENGTH) {
        res.status(400).json({ error: `Description max ${MAX_DESCRIPTION_LENGTH} chars` })
        return
      }
      updates.description = description.trim()
    }
    if (prompt !== undefined) {
      if (typeof prompt !== 'object' || Array.isArray(prompt) || !prompt) {
        res.status(400).json({ error: 'Prompt must be a JSON object' })
        return
      }
      if (JSON.stringify(prompt).length > MAX_PROMPT_SIZE) {
        res.status(400).json({ error: 'Prompt too large' })
        return
      }
      updates.prompt = prompt
    }

    const preset = updatePreset(Number(req.params.id), req.user!.id, updates)
    if (!preset) {
      res.status(404).json({ error: 'Preset not found or not editable' })
      return
    }
    res.json({ preset })
  })

  router.delete('/:id', (req: AuthRequest, res) => {
    if (!deletePreset(Number(req.params.id), req.user!.id)) {
      res.status(404).json({ error: 'Preset not found or not deletable' })
      return
    }
    res.json({ success: true })
  })

  return router
}
