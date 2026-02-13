import fs from 'node:fs/promises'
import path from 'node:path'
import express from 'express'
import rateLimit from 'express-rate-limit'
import multer from 'multer'
import { runAutoSubtitle, uploadVideoFile } from '../services/captions.js'
import { sendError, sendSuccess } from '../utils/http.js'

interface CaptionsRouterConfig {
  projectRoot: string
}

function formatValidationDetail(detail: unknown): string | undefined {
  if (!detail) return undefined
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    const parts = detail
      .map((entry) => {
        if (!entry || typeof entry !== 'object') return null
        const e = entry as { loc?: unknown; msg?: unknown; type?: unknown }
        const loc = Array.isArray(e.loc) ? e.loc.join('.') : typeof e.loc === 'string' ? e.loc : ''
        const msg = typeof e.msg === 'string' ? e.msg : ''
        const type = typeof e.type === 'string' ? e.type : ''
        const head = loc ? `validation.${loc}` : 'validation'
        const tail = msg || type
        return tail ? `${head}: ${tail}` : head
      })
      .filter(Boolean)
    return parts.length ? parts.join(' | ') : undefined
  }
  return undefined
}

const captionsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    sendError(res, 429, 'Too many requests, please try again later', 'RATE_LIMITED')
  },
})

export function createCaptionsRouter(config: CaptionsRouterConfig): express.Router {
  const { projectRoot } = config
  const uploadsDir = path.join(projectRoot, 'uploads')

  const router = express.Router()

  const upload = multer({
    storage: multer.diskStorage({
      destination: async (_req, _file, cb) => {
        await fs.mkdir(uploadsDir, { recursive: true })
        cb(null, uploadsDir)
      },
      filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase()
        cb(null, `caption_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`)
      },
    }),
    limits: { fileSize: 200 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (file.mimetype.startsWith('video/')) {
        cb(null, true)
      } else {
        cb(new Error('Invalid file type. Video files only.'))
      }
    },
  })

  router.post('/auto-subtitle', captionsLimiter, upload.single('video'), async (req, res) => {
    let localPath: string | null = null
    try {
      const { videoUrl } = req.body as { videoUrl?: string }
      const file = req.file
      if (!videoUrl && !file) {
        sendError(res, 400, 'Video URL or file is required', 'MISSING_VIDEO')
        return
      }

      let finalVideoUrl = videoUrl
      if (file) {
        localPath = file.path
        finalVideoUrl = await uploadVideoFile(localPath, file.mimetype)
      }

      console.log('[captions] auto-subtitle request', {
        hasFile: Boolean(file),
        hasUrl: Boolean(videoUrl),
        fileType: file?.mimetype,
        urlPreview: finalVideoUrl ? finalVideoUrl.slice(0, 80) : null,
      })

      const input = {
        videoUrl: finalVideoUrl!,
        language: req.body.language || undefined,
        fontName: req.body.fontName || undefined,
        fontSize: req.body.fontSize ? Number(req.body.fontSize) : undefined,
        fontWeight: req.body.fontWeight || undefined,
        fontColor: req.body.fontColor || undefined,
        highlightColor: req.body.highlightColor || undefined,
        strokeWidth: req.body.strokeWidth ? Number(req.body.strokeWidth) : undefined,
        strokeColor: req.body.strokeColor || undefined,
        backgroundColor: req.body.backgroundColor || undefined,
        backgroundOpacity: req.body.backgroundOpacity ? Number(req.body.backgroundOpacity) : undefined,
        position: req.body.position || undefined,
        xOffset:
          req.body.xOffset !== undefined && req.body.xOffset !== '' ? Number(req.body.xOffset) : undefined,
        yOffset:
          req.body.yOffset !== undefined && req.body.yOffset !== '' ? Number(req.body.yOffset) : undefined,
        wordsPerSubtitle: req.body.wordsPerSubtitle ? Number(req.body.wordsPerSubtitle) : undefined,
        enableAnimation:
          typeof req.body.enableAnimation === 'string'
            ? ['1', 'true', 'yes', 'on'].includes(req.body.enableAnimation.toLowerCase())
            : undefined,
      }

      const result = await runAutoSubtitle(input)
      if (!result.videoUrl) {
        sendError(res, 500, 'Captioned video URL missing from provider', 'CAPTION_OUTPUT_MISSING')
        return
      }

      console.log('[captions] auto-subtitle success', {
        outputUrlPreview: result.videoUrl.slice(0, 80),
        subtitleCount: result.subtitleCount,
      })

      sendSuccess(res, result)
    } catch (err) {
      const errorBody = (err as { body?: { detail?: unknown } })?.body
      const validationDetails = formatValidationDetail(errorBody?.detail)
      console.error('[captions] auto-subtitle failed', err)
      if (errorBody?.detail) {
        try {
          console.error('[captions] auto-subtitle error detail', JSON.stringify(errorBody.detail))
        } catch {
          console.error('[captions] auto-subtitle error detail', errorBody.detail)
        }
      } else if (errorBody) {
        try {
          console.error('[captions] auto-subtitle error body', JSON.stringify(errorBody))
        } catch {
          console.error('[captions] auto-subtitle error body', errorBody)
        }
      }
      sendError(
        res,
        500,
        'Failed to generate captions',
        'CAPTIONS_FAILED',
        validationDetails || (err instanceof Error ? err.message : 'Unknown error'),
      )
    } finally {
      if (localPath) {
        await fs.unlink(localPath).catch(() => {})
      }
    }
  })

  return router
}
