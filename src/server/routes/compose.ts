import path from 'node:path'
import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import multer from 'multer'
import type { AuthRequest } from '../middleware/auth.js'
import { type ComposeBlendMode, type ComposeLayerInput, runComposeExport } from '../services/compose.js'
import { sendError, sendSuccess } from '../utils/http.js'
import { createJobOutputDir } from '../utils/outputPaths.js'

interface ComposeRouterConfig {
  projectRoot: string
}

const VALID_BLEND_MODES = new Set<ComposeBlendMode>(['normal', 'screen', 'multiply', 'overlay', 'darken', 'lighten'])
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
  'video/webm',
  'video/quicktime',
])
const MAX_FILE_SIZE = 200 * 1024 * 1024
const JOB_RETENTION_MS = 2 * 60 * 60 * 1000

interface ComposeJob {
  jobId: string
  status: 'running' | 'completed' | 'failed'
  progress: { completed: number; total: number; message: string }
  outputUrl: string
  error: string
  createdAt: number
}

const composeExportJobs = new Map<string, ComposeJob>()

function pruneOldJobs() {
  const cutoff = Date.now() - JOB_RETENTION_MS
  for (const [id, job] of composeExportJobs) {
    if (job.createdAt < cutoff) composeExportJobs.delete(id)
  }
}

export function createComposeRouter(config: ComposeRouterConfig): Router {
  const { projectRoot } = config
  const router = Router()
  const uploadsDir = path.join(projectRoot, 'uploads')
  const outputsRoot = path.join(projectRoot, 'outputs')

  const exportLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 3,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
      sendError(res, 429, 'Too many compose export requests, please wait before trying again', 'RATE_LIMITED')
    },
  })

  const storage = multer.diskStorage({
    destination: async (_req, _file, cb) => {
      const { mkdir } = await import('node:fs/promises')
      await mkdir(uploadsDir, { recursive: true })
      cb(null, uploadsDir)
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase()
      cb(null, `compose_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`)
    },
  })

  const upload = multer({
    storage,
    limits: { fileSize: MAX_FILE_SIZE },
    fileFilter: (_req, file, cb) => {
      if (ALLOWED_MIME_TYPES.has(file.mimetype)) cb(null, true)
      else
        cb(
          new Error(`Invalid file type: ${file.mimetype}. Accepted: images (jpeg/png/webp) and videos (mp4/webm/mov).`),
        )
    },
  })

  router.post('/upload', upload.single('file'), (req: AuthRequest, res) => {
    if (!req.file) {
      sendError(res, 400, 'No file uploaded')
      return
    }

    const mediaType = req.file.mimetype.startsWith('video/') ? 'video' : 'image'
    sendSuccess(res, {
      fileUrl: `/uploads/${req.file.filename}`,
      mediaType,
    })
  })

  router.post('/export', exportLimiter, async (req: AuthRequest, res) => {
    pruneOldJobs()

    const { layers, width, height, fps, compositionLength } = req.body as {
      layers: ComposeLayerInput[]
      width: number
      height: number
      fps: number
      compositionLength?: number
    }

    if (!Array.isArray(layers) || layers.length === 0) {
      sendError(res, 400, 'At least one layer is required')
      return
    }

    if (compositionLength !== undefined) {
      if (typeof compositionLength !== 'number' || !Number.isFinite(compositionLength) || compositionLength <= 0) {
        sendError(res, 400, 'Composition length must be a positive number')
        return
      }
    }

    for (const layer of layers) {
      if (!layer.mediaUrl || typeof layer.mediaUrl !== 'string') {
        sendError(res, 400, 'Each layer must have a mediaUrl')
        return
      }
      if (!layer.mediaUrl.startsWith('/uploads/') && !layer.mediaUrl.startsWith('/outputs/')) {
        sendError(res, 400, `Invalid mediaUrl: ${layer.mediaUrl}`)
        return
      }
      if (typeof layer.duration !== 'number' || layer.duration <= 0) {
        sendError(res, 400, 'Each layer must have a positive duration')
        return
      }
      if (layer.blendMode && !VALID_BLEND_MODES.has(layer.blendMode)) {
        sendError(res, 400, `Invalid blend mode: ${layer.blendMode}`)
        return
      }
    }

    const jobId = `compose_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const { outputDir, outputDirUrl } = createJobOutputDir(outputsRoot, 'compose', 'export', jobId)
    const outputFile = `composed_${jobId}.mp4`

    const job: ComposeJob = {
      jobId,
      status: 'running',
      progress: { completed: 0, total: 1, message: 'Building filter graph...' },
      outputUrl: '',
      error: '',
      createdAt: Date.now(),
    }
    composeExportJobs.set(jobId, job)

    sendSuccess(res, { jobId })

    void (async () => {
      try {
        job.progress.message = 'Rendering composition...'

        const normalizedLayers: ComposeLayerInput[] = layers.map((l) => ({
          mediaUrl: l.mediaUrl,
          mediaType: l.mediaType || 'image',
          startTime: l.startTime || 0,
          duration: l.duration,
          blendMode: l.blendMode || 'normal',
          opacity: l.opacity ?? 1,
        }))

        await runComposeExport({
          layers: normalizedLayers,
          width: width || 1080,
          height: height || 1920,
          fps: fps || 30,
          compositionLength,
          outputDir,
          outputFile,
          projectRoot,
        })

        job.status = 'completed'
        job.progress = { completed: 1, total: 1, message: 'Done' }
        job.outputUrl = `${outputDirUrl}/${outputFile}`
        console.log(`[compose] Job ${jobId} completed: ${job.outputUrl}`)
      } catch (err) {
        job.status = 'failed'
        job.error = err instanceof Error ? err.message : 'Compose export failed'
        console.error(`[compose] Job ${jobId} failed:`, job.error)
      }
    })()
  })

  router.get('/export-status/:jobId', (req: AuthRequest, res) => {
    const job = composeExportJobs.get(req.params.jobId)
    if (!job) {
      sendError(res, 404, 'Job not found')
      return
    }
    sendSuccess(res, {
      jobId: job.jobId,
      status: job.status,
      progress: job.progress,
      outputUrl: job.outputUrl,
      error: job.error,
    })
  })

  return router
}
