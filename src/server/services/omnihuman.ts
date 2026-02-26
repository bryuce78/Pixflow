import { execFile } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fal } from '@fal-ai/client'
import { ensureFalConfig } from './falConfig.js'
import {
  isMockProvidersEnabled,
  makeMockId,
  makeMockMp4DataUrl,
  recordMockProviderSuccess,
  runWithRetries,
} from './providerRuntime.js'

const MODEL_ID = 'fal-ai/bytedance/omnihuman/v1.5'
const MAX_AUDIO_DURATION_SECS = 30
const SUPPORTED_AUDIO_EXTS = new Set(['.wav', '.mp3'])

export interface OmniHumanResult {
  videoUrl: string
  requestId: string
}

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase()
  const mimeTypes: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.m4a': 'audio/mp4',
    '.ogg': 'audio/ogg',
    '.aac': 'audio/aac',
  }
  return mimeTypes[ext] || 'application/octet-stream'
}

function getAudioDuration(audioPath: string): Promise<number | null> {
  return new Promise((resolve) => {
    execFile(
      'ffprobe',
      ['-i', audioPath, '-show_entries', 'format=duration', '-v', 'quiet', '-of', 'csv=p=0'],
      { timeout: 10_000 },
      (error, stdout) => {
        if (error) {
          console.log(`[OmniHuman] ffprobe failed (${error.message}), skipping duration check`)
          resolve(null)
          return
        }
        const parsed = Number.parseFloat(stdout.trim())
        resolve(Number.isFinite(parsed) ? parsed : null)
      },
    )
  })
}

function convertToMp3(inputPath: string): Promise<string> {
  const outputPath = inputPath.replace(/\.[^.]+$/, '_converted.mp3')
  return new Promise((resolve, reject) => {
    execFile(
      'ffmpeg',
      ['-y', '-i', inputPath, '-vn', '-acodec', 'libmp3lame', '-b:a', '192k', outputPath],
      { timeout: 30_000 },
      (error) => {
        if (error) reject(new Error(`FFmpeg audio conversion failed: ${error.message}`))
        else resolve(outputPath)
      },
    )
  })
}

async function uploadToFal(filePath: string): Promise<string> {
  const buffer = await fs.readFile(filePath)
  const type = getMimeType(filePath)
  const blob = new Blob([buffer], { type })
  const file = new File([blob], path.basename(filePath), { type })
  return fal.storage.upload(file)
}

export async function createOmniHumanVideo(imagePath: string, audioPath: string): Promise<OmniHumanResult> {
  if (isMockProvidersEnabled()) {
    await recordMockProviderSuccess({
      pipeline: 'avatars.lipsync.provider',
      provider: 'omnihuman',
      metadata: {},
    })
    return { videoUrl: makeMockMp4DataUrl(), requestId: makeMockId('omnihuman') }
  }

  ensureFalConfig()

  const duration = await getAudioDuration(audioPath)
  if (duration !== null && duration > MAX_AUDIO_DURATION_SECS) {
    throw new Error(`Audio duration ${duration.toFixed(1)}s exceeds OmniHuman maximum of ${MAX_AUDIO_DURATION_SECS}s`)
  }

  console.log(`[OmniHuman] Image: ${imagePath}`)
  console.log(`[OmniHuman] Audio: ${audioPath}${duration !== null ? ` (${duration.toFixed(1)}s)` : ''}`)

  let audioForUpload = audioPath
  const ext = path.extname(audioPath).toLowerCase()
  if (!SUPPORTED_AUDIO_EXTS.has(ext)) {
    console.log(`[OmniHuman] Converting ${ext} to .mp3 (OmniHuman only supports .wav/.mp3)`)
    audioForUpload = await convertToMp3(audioPath)
  }

  let imageUrl: string
  let audioUrl: string
  try {
    ;[imageUrl, audioUrl] = await runWithRetries(
      () => Promise.all([uploadToFal(imagePath), uploadToFal(audioForUpload)]),
      {
        pipeline: 'avatars.lipsync.provider',
        provider: 'omnihuman',
        metadata: { step: 'upload' },
      },
    )
  } finally {
    if (audioForUpload !== audioPath) await fs.unlink(audioForUpload).catch(() => {})
  }

  let result: Awaited<ReturnType<typeof fal.subscribe>>
  try {
    result = await runWithRetries(
      () =>
        fal.subscribe(MODEL_ID, {
          input: {
            image_url: imageUrl,
            audio_url: audioUrl,
          },
          logs: true,
          onQueueUpdate: (update) => {
            if (update.status === 'IN_PROGRESS' && update.logs) {
              // biome-ignore lint/suspicious/useIterableCallbackReturn: side-effect logging
              update.logs.forEach((log) => console.log(`[OmniHuman] ${log.message}`))
            }
          },
        }),
      {
        pipeline: 'avatars.lipsync.provider',
        provider: 'omnihuman',
        metadata: { step: 'generate' },
      },
    )
  } catch (err: unknown) {
    const body = (err as { body?: unknown })?.body
    if (body) console.error('[OmniHuman] FAL error body:', JSON.stringify(body, null, 2))
    throw err
  }

  const videoUrl = result.data?.video?.url
  if (!videoUrl) {
    throw new Error('OmniHuman returned no video URL')
  }

  console.log(`[OmniHuman] Video generated: ${videoUrl}`)
  return { videoUrl, requestId: result.requestId }
}
