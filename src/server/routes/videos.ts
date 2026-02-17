import { createWriteStream } from 'node:fs'
import fs from 'node:fs/promises'
import http from 'node:http'
import https from 'node:https'
import path from 'node:path'
import express from 'express'
import rateLimit from 'express-rate-limit'
import multer from 'multer'
import { v4 as uuidv4 } from 'uuid'
import type { AuthRequest } from '../middleware/auth.js'
import { transcribeVideo } from '../services/wizper.js'
import {
  detectPlatform,
  downloadVideoWithYtDlp,
  extractFacebookAdsVideoUrl,
  isFacebookAdsLibraryUrl,
} from '../services/ytdlp.js'
import { sendError, sendSuccess } from '../utils/http.js'
import { buildJobOutputFileName, createJobOutputDir, toOutputUrl } from '../utils/outputPaths.js'

interface VideosRouterConfig {
  projectRoot: string
}

// Rate limiter for expensive transcription operations
const transcriptionLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 requests per minute
  message: 'Too many transcription requests. Please try again in a minute.',
  standardHeaders: true,
  legacyHeaders: false,
})

export function createVideosRouter(config: VideosRouterConfig) {
  const router = express.Router()
  const outputsDir = path.join(config.projectRoot, 'outputs')
  type UploadRequest = AuthRequest & { _uploadLayout?: ReturnType<typeof createJobOutputDir> }

  // Configure multer for video uploads
  const storage = multer.diskStorage({
    destination: async (req, _file, cb) => {
      const jobId = uuidv4()
      const layout = createJobOutputDir(outputsDir, 'videos', 'upload', jobId)
      ;(req as UploadRequest)._uploadLayout = layout
      await fs.mkdir(layout.outputDir, { recursive: true })
      cb(null, layout.outputDir)
    },
    filename: (req, file, cb) => {
      const layout = (req as UploadRequest)._uploadLayout
      const ext = path.extname(file.originalname).replace(/^\./, '').toLowerCase() || 'bin'
      const mode = layout?.mode || 'upload'
      const jobId = layout?.jobId || uuidv4()
      cb(null, buildJobOutputFileName(mode, jobId, ext))
    },
  })

  const upload = multer({
    storage,
    limits: {
      fileSize: 500 * 1024 * 1024, // 500MB max
    },
    fileFilter: (_req, file, cb) => {
      if (file.mimetype.startsWith('video/') || file.mimetype.startsWith('audio/')) {
        cb(null, true)
      } else {
        cb(new Error('Only video and audio files are allowed'))
      }
    },
  })

  function sanitizeOutputPath(userPath: string): string {
    const relative = decodeURIComponent(userPath.replace(/^\/+/, '').replace(/^outputs\//, ''))
    const absolutePath = path.resolve(outputsDir, relative)
    const resolvedOutputsDir = path.resolve(outputsDir)
    if (absolutePath !== resolvedOutputsDir && !absolutePath.startsWith(resolvedOutputsDir + path.sep)) {
      throw new Error('Invalid path: must be within outputs directory')
    }
    return absolutePath
  }

  async function listVideoFilesRecursively(rootDir: string): Promise<string[]> {
    const stack = [rootDir]
    const results: string[] = []

    while (stack.length > 0) {
      const current = stack.pop()
      if (!current) continue
      let entries: Array<import('node:fs').Dirent> = []
      try {
        entries = await fs.readdir(current, { withFileTypes: true })
      } catch {
        continue
      }

      for (const entry of entries) {
        const absolute = path.join(current, entry.name)
        if (entry.isDirectory()) {
          stack.push(absolute)
          continue
        }
        if (entry.isFile() && /\.mp4$/i.test(entry.name)) {
          results.push(absolute)
        }
      }
    }

    return results
  }

  /**
   * Download video from external URL to temp file
   */
  async function downloadVideoFromUrl(url: string, targetPath: string): Promise<string> {
    const userAgent =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    const maxRedirects = 5

    return new Promise((resolve, reject) => {
      const stream = createWriteStream(targetPath)
      let settled = false

      const complete = (fn: () => void) => {
        if (settled) return
        settled = true
        fn()
      }

      const cleanupAndReject = (error: Error) => {
        stream.destroy()
        fs.unlink(targetPath).catch(() => {})
        complete(() => reject(error))
      }

      stream.on('error', (err) => {
        cleanupAndReject(err instanceof Error ? err : new Error(String(err)))
      })

      const requestUrl = (targetUrl: string, redirectCount: number) => {
        const protocol = targetUrl.startsWith('https') ? https : http
        const request = protocol.get(
          targetUrl,
          {
            headers: {
              'user-agent': userAgent,
              accept: '*/*',
            },
          },
          (response) => {
            const status = response.statusCode ?? 0
            const location = response.headers.location

            if (location && (status === 301 || status === 302 || status === 303 || status === 307 || status === 308)) {
              if (redirectCount >= maxRedirects) {
                cleanupAndReject(new Error('Failed to download video: too many redirects'))
                return
              }

              const nextUrl = new URL(location, targetUrl).toString()
              response.resume()
              requestUrl(nextUrl, redirectCount + 1)
              return
            }

            if (status !== 200 && status !== 206) {
              response.resume()
              cleanupAndReject(new Error(`Failed to download video: HTTP ${status}`))
              return
            }

            response.pipe(stream, { end: false })
            response.on('end', () => {
              stream.end(() => complete(() => resolve(targetPath)))
            })
            response.on('error', (err) => {
              cleanupAndReject(err instanceof Error ? err : new Error(String(err)))
            })
          },
        )

        request.on('error', (err) => {
          cleanupAndReject(err instanceof Error ? err : new Error(String(err)))
        })
      }

      requestUrl(url, 0)
    })
  }

  async function normalizeDownloadedVideoPath(
    layout: ReturnType<typeof createJobOutputDir>,
    sourcePath: string,
  ): Promise<string> {
    const extension = path.extname(sourcePath).replace(/^\./, '').toLowerCase() || 'mp4'
    const targetPath = path.join(layout.outputDir, buildJobOutputFileName(layout.mode, layout.jobId, extension))
    if (sourcePath === targetPath) return sourcePath

    try {
      await fs.rename(sourcePath, targetPath)
      return targetPath
    } catch {
      const bytes = await fs.readFile(sourcePath)
      await fs.writeFile(targetPath, bytes)
      await fs.unlink(sourcePath).catch(() => {})
      return targetPath
    }
  }

  /**
   * GET /api/videos/list
   * List all video files in outputs directory
   */
  router.get('/list', async (_req, res) => {
    try {
      const files = await listVideoFilesRecursively(outputsDir)
      const videoFiles = await Promise.all(
        files.map(async (filePath) => {
          const stats = await fs.stat(filePath)
          const relative = path.relative(outputsDir, filePath).split(path.sep).join('/')
          return {
            filename: path.basename(filePath),
            relativePath: relative,
            url: toOutputUrl(outputsDir, filePath),
            size: stats.size,
            modifiedAt: stats.mtime.toISOString(),
          }
        }),
      )

      // Sort by modification time (newest first)
      videoFiles.sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime())

      sendSuccess(res, { videos: videoFiles })
    } catch (error) {
      console.error('[Videos] Failed to list videos:', error)
      sendError(res, 500, 'Failed to list videos', 'VIDEO_LIST_FAILED')
    }
  })

  /**
   * POST /api/videos/upload
   * Upload a video or audio file to outputs directory
   */
  router.post('/upload', upload.single('video'), async (req: AuthRequest, res) => {
    try {
      if (!req.file) {
        sendError(res, 400, 'No media file provided', 'MISSING_MEDIA_FILE')
        return
      }

      const uploadReq = req as UploadRequest
      const videoUrl = toOutputUrl(outputsDir, req.file.path)
      const outputDirUrl = uploadReq._uploadLayout?.outputDirUrl || videoUrl.split('/').slice(0, -1).join('/')

      console.log(`[Videos] Media uploaded: ${videoUrl}`)

      sendSuccess(res, {
        url: videoUrl,
        filename: path.basename(req.file.path),
        size: req.file.size,
        outputDir: outputDirUrl,
      })
    } catch (error) {
      console.error('[Videos] Upload failed:', error)
      sendError(
        res,
        500,
        'Video upload failed',
        'VIDEO_UPLOAD_FAILED',
        error instanceof Error ? error.message : undefined,
      )
    }
  })

  /**
   * POST /api/videos/transcribe
   * Extract audio from video and transcribe using fal-ai/wizper
   * Supports both local paths (/outputs/...) and external URLs (http://...)
   */
  router.post('/transcribe', transcriptionLimiter, async (req: AuthRequest, res) => {
    // Set long timeout for transcription (5 minutes)
    req.setTimeout(300_000)
    res.setTimeout(300_000)

    let tempDownloadPath: string | null = null

    try {
      const { videoUrl: rawVideoUrl } = req.body
      const clientRequestId = req.header('x-client-request-id')?.trim() || `server_${Date.now()}`

      // Validation
      if (!rawVideoUrl || typeof rawVideoUrl !== 'string') {
        sendError(res, 400, 'Video URL is required', 'MISSING_VIDEO_URL')
        return
      }

      // Trim whitespace from URL
      const videoUrl = rawVideoUrl.trim()

      if (!videoUrl) {
        sendError(res, 400, 'Video URL is required', 'MISSING_VIDEO_URL')
        return
      }

      console.log('[Videos] Transcribe request:', { clientRequestId, videoUrl })
      const transcribeLayout = createJobOutputDir(outputsDir, 'videos', 'transcribe', uuidv4())
      await fs.mkdir(transcribeLayout.outputDir, { recursive: true })
      const transcribeTargetPath = path.join(
        transcribeLayout.outputDir,
        buildJobOutputFileName(transcribeLayout.mode, transcribeLayout.jobId, 'mp4'),
      )

      let videoPath: string

      // Check if it's an external URL or local path
      const isExternalUrl = videoUrl.startsWith('http://') || videoUrl.startsWith('https://')

      if (isExternalUrl) {
        // Special handling for Facebook Ads Library
        if (isFacebookAdsLibraryUrl(videoUrl)) {
          console.log('[Videos] Detected Facebook Ads Library URL, downloading with yt-dlp...', { clientRequestId })
          try {
            const result = await downloadVideoWithYtDlp(videoUrl, transcribeLayout.outputDir)
            videoPath = await normalizeDownloadedVideoPath(transcribeLayout, result.videoPath)
            tempDownloadPath = videoPath
            console.log('[Videos] Facebook Ads yt-dlp download complete:', {
              clientRequestId,
              title: result.title,
              platform: result.platform,
              duration: result.duration,
              videoPath,
            })
          } catch (error) {
            console.error('[Videos] Facebook Ads yt-dlp download failed:', error)
            console.log('[Videos] Falling back to browser extraction for Facebook Ads...', { clientRequestId })
            try {
              const directVideoUrl = await extractFacebookAdsVideoUrl(videoUrl)
              console.log('[Videos] Extracted direct Facebook Ads video URL:', {
                clientRequestId,
                directVideoUrl: directVideoUrl.slice(0, 160),
              })

              videoPath = await downloadVideoFromUrl(directVideoUrl, transcribeTargetPath)
              tempDownloadPath = videoPath
              console.log('[Videos] Facebook Ads direct video download complete:', {
                clientRequestId,
                videoPath,
              })
            } catch (fallbackError) {
              console.error('[Videos] Facebook Ads fallback extraction failed:', fallbackError)
              const primaryMessage = error instanceof Error ? error.message : 'Unknown yt-dlp error'
              const fallbackMessage =
                fallbackError instanceof Error ? fallbackError.message : 'Unknown browser extraction error'
              throw new Error(
                `Failed to download Facebook Ads video. yt-dlp error: ${primaryMessage}. Fallback error: ${fallbackMessage}`,
              )
            }
          }
        }
        // Check if it's a platform video (Facebook, Instagram, TikTok, etc.)
        else {
          const platform = detectPlatform(videoUrl)

          if (platform) {
            // Use yt-dlp for platform videos
            console.log(`[Videos] Detected ${platform} video, using yt-dlp...`)
            try {
              const result = await downloadVideoWithYtDlp(videoUrl, transcribeLayout.outputDir)
              videoPath = await normalizeDownloadedVideoPath(transcribeLayout, result.videoPath)
              tempDownloadPath = videoPath
              console.log(`[Videos] yt-dlp download complete: ${result.title} (${result.platform})`)
            } catch (error) {
              console.error('[Videos] yt-dlp download failed:', error)
              throw new Error(
                `Failed to download ${platform} video: ${error instanceof Error ? error.message : 'Unknown error'}`,
              )
            }
          } else {
            // Direct URL download for non-platform videos
            console.log(`[Videos] Downloading video from direct URL: ${videoUrl}`)
            videoPath = await downloadVideoFromUrl(videoUrl, transcribeTargetPath)
            tempDownloadPath = videoPath
          }
        }
      } else {
        // Local path - validate it's from outputs directory
        if (!videoUrl.startsWith('/outputs/')) {
          sendError(res, 400, 'Invalid video URL: must be from outputs directory or external URL', 'INVALID_VIDEO_URL')
          return
        }

        // Sanitize and resolve path
        try {
          videoPath = sanitizeOutputPath(videoUrl)
        } catch (err) {
          sendError(
            res,
            400,
            'Invalid video path',
            'INVALID_VIDEO_PATH',
            err instanceof Error ? err.message : undefined,
          )
          return
        }

        // Check file exists
        try {
          await fs.access(videoPath)
        } catch {
          sendError(res, 404, 'Video file not found', 'VIDEO_NOT_FOUND')
          return
        }
      }

      console.log(`[Videos] Transcribing video: ${videoPath}`)

      // Transcribe video
      const result = await transcribeVideo(videoPath)

      console.log('[Videos] Transcription complete:', {
        transcriptChars: result.transcript.length,
        language: result.language,
        duration: result.duration,
        segmentCount: result.segments?.length || 0,
      })

      sendSuccess(res, {
        transcript: result.transcript,
        duration: result.duration,
        language: result.language,
        segments: result.segments,
        clientRequestId,
      })
    } catch (error) {
      console.error('[Videos] Transcription failed:', error)

      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      // Handle specific error types
      if (errorMessage.includes('No audio track') || errorMessage.includes('Stream not found')) {
        sendError(res, 400, 'Video has no audio track to transcribe', 'NO_AUDIO_TRACK')
      } else if (errorMessage.includes('timed out')) {
        sendError(res, 408, 'Transcription timed out. Try a shorter video.', 'TRANSCRIPTION_TIMEOUT')
      } else if (errorMessage.includes('FFmpeg not available')) {
        sendError(res, 500, 'Audio extraction failed. Contact support.', 'FFMPEG_UNAVAILABLE')
      } else if (errorMessage.includes('Failed to download video')) {
        sendError(res, 400, 'Failed to download video from URL', 'VIDEO_DOWNLOAD_FAILED', errorMessage)
      } else {
        sendError(res, 500, 'Transcription failed', 'TRANSCRIPTION_FAILED', errorMessage)
      }
    } finally {
      // Clean up temp downloaded file
      if (tempDownloadPath) {
        fs.unlink(tempDownloadPath).catch((err) => {
          console.error('[Videos] Failed to delete temp file:', err)
        })
      }
    }
  })

  return router
}
