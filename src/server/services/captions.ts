import fs from 'node:fs/promises'
import path from 'node:path'
import { fal } from '@fal-ai/client'
import { ensureFalConfig } from './falConfig.js'
import { isMockProvidersEnabled, makeMockId, recordMockProviderSuccess, runWithRetries } from './providerRuntime.js'

const PRIMARY_MODEL_ID = 'fal-ai/workflow-utilities/auto-subtitle'
const FALLBACK_MODEL_ID = 'fal-ai/auto-caption'

const COLOR_MAP: Record<string, [number, number, number]> = {
  white: [255, 255, 255],
  black: [0, 0, 0],
  red: [255, 0, 0],
  green: [0, 128, 0],
  blue: [0, 0, 255],
  yellow: [255, 255, 0],
  orange: [255, 165, 0],
  purple: [128, 0, 128],
  pink: [255, 192, 203],
  brown: [165, 42, 42],
  gray: [128, 128, 128],
  cyan: [0, 255, 255],
  magenta: [255, 0, 255],
}

const BASE_COLOR_ENUM = Object.keys(COLOR_MAP)
const BACKGROUND_COLOR_ENUM = [...BASE_COLOR_ENUM, 'none', 'transparent']

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const parseHexColor = (input: string): [number, number, number] | null => {
  const normalized = input.replace('#', '').trim()
  if (normalized.length === 3) {
    const r = Number.parseInt(normalized[0] + normalized[0], 16)
    const g = Number.parseInt(normalized[1] + normalized[1], 16)
    const b = Number.parseInt(normalized[2] + normalized[2], 16)
    if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null
    return [r, g, b]
  }
  if (normalized.length !== 6) return null
  const r = Number.parseInt(normalized.slice(0, 2), 16)
  const g = Number.parseInt(normalized.slice(2, 4), 16)
  const b = Number.parseInt(normalized.slice(4, 6), 16)
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null
  return [r, g, b]
}

const nearestNamedColor = (rgb: [number, number, number]): string => {
  let best = 'white'
  let bestDist = Number.POSITIVE_INFINITY
  for (const [name, [r, g, b]] of Object.entries(COLOR_MAP)) {
    const dr = rgb[0] - r
    const dg = rgb[1] - g
    const db = rgb[2] - b
    const dist = dr * dr + dg * dg + db * db
    if (dist < bestDist) {
      bestDist = dist
      best = name
    }
  }
  return best
}

const normalizeColorEnum = (
  input: string | undefined,
  fallback: string,
  allowed: string[] = BASE_COLOR_ENUM,
): string => {
  if (!input) return fallback
  const value = input.trim().toLowerCase()
  if (allowed.includes(value)) return value
  const rgb = parseHexColor(value)
  if (rgb) return nearestNamedColor(rgb)
  return fallback
}

export interface AutoSubtitleInput {
  videoUrl: string
  language?: string
  fontName?: string
  fontSize?: number
  fontWeight?: 'normal' | 'bold' | 'black'
  fontColor?: string
  highlightColor?: string
  strokeWidth?: number
  strokeColor?: string
  backgroundColor?: string
  backgroundOpacity?: number
  position?: 'top' | 'center' | 'bottom'
  xOffset?: number
  yOffset?: number
  wordsPerSubtitle?: number
  enableAnimation?: boolean
}

function normalizeFontWeight(weight: AutoSubtitleInput['fontWeight']): 'normal' | 'bold' | undefined {
  if (!weight) return undefined
  return weight === 'normal' ? 'normal' : 'bold'
}

export interface AutoSubtitleResult {
  videoUrl: string
  transcription?: string
  subtitleCount?: number
  words?: unknown[]
  transcriptionMetadata?: unknown
  modelUsed?: string
}

async function uploadVideoToFal(filePath: string, contentType?: string): Promise<string> {
  ensureFalConfig()
  const buffer = await fs.readFile(filePath)
  const type = contentType || 'video/mp4'
  const blob = new Blob([buffer], { type })
  const file = new File([blob], path.basename(filePath), { type })
  const url = await fal.storage.upload(file)
  return url
}

function isModelUnavailable(error: unknown): boolean {
  const err = error as { status?: number; body?: { detail?: string } }
  if (err?.status !== 503) return false
  const detail = err?.body?.detail
  return typeof detail === 'string' && detail.toLowerCase().includes('not available')
}

function isValidationError(error: unknown): boolean {
  const err = error as { status?: number }
  return err?.status === 422
}

function logValidationError(error: unknown, payload: Record<string, unknown>) {
  const err = error as { body?: { detail?: unknown } }
  let detail = err?.body?.detail
  try {
    detail = JSON.stringify(detail)
  } catch {
    // ignore
  }
  console.error('[captions] auto-subtitle validation error', {
    detail,
    payload,
  })
}

function mapFallbackFont(fontName?: string): string {
  if (!fontName) return 'Standard'
  const normalized = fontName.toLowerCase()
  if (normalized.includes('arial')) return 'Arial'
  if (normalized.includes('georgia')) return 'Georgia'
  if (normalized.includes('garamond')) return 'Garamond'
  if (normalized.includes('times')) return 'Times New Roman'
  return 'Standard'
}

async function runAutoCaptionFallback(input: AutoSubtitleInput): Promise<AutoSubtitleResult> {
  const payload: Record<string, unknown> = {
    video_url: input.videoUrl,
    txt_color: normalizeColorEnum(input.fontColor, 'white'),
    txt_font: mapFallbackFont(input.fontName),
    font_size: input.fontSize ?? 24,
    stroke_width: input.strokeWidth ?? 1,
    left_align: 'center',
    top_align: input.position ?? 'center',
  }

  const result = await runWithRetries(
    () =>
      fal.subscribe(FALLBACK_MODEL_ID, {
        input: payload,
        logs: true,
        onQueueUpdate: (update) => {
          if (update.status === 'IN_PROGRESS' && update.logs) {
            update.logs.forEach((log) => {
              console.log(`[fal.ai captions] ${log.message}`)
            })
          }
        },
      }),
    {
      pipeline: 'captions.auto_subtitle.provider',
      provider: 'fal',
      metadata: { model: FALLBACK_MODEL_ID, fallback: true },
    },
  )

  const data = result.data as { video_url?: string }

  return {
    videoUrl: data.video_url || '',
    modelUsed: FALLBACK_MODEL_ID,
  }
}

export async function runAutoSubtitle(input: AutoSubtitleInput): Promise<AutoSubtitleResult> {
  if (isMockProvidersEnabled()) {
    await recordMockProviderSuccess({
      pipeline: 'captions.auto_subtitle.provider',
      provider: 'fal',
      metadata: { mock: true },
    })
    return {
      videoUrl: `https://fal.mock/${makeMockId('caption')}.mp4`,
      transcription: 'Mock transcription for captions.',
      subtitleCount: 12,
    }
  }

  ensureFalConfig()

  const payload: Record<string, unknown> = {
    video_url: input.videoUrl,
  }
  if (input.language) payload.language = input.language
  if (input.fontName) payload.font_name = input.fontName
  if (input.fontSize) payload.font_size = input.fontSize
  const normalizedFontWeight = normalizeFontWeight(input.fontWeight)
  if (normalizedFontWeight) payload.font_weight = normalizedFontWeight
  if (input.fontColor) payload.font_color = normalizeColorEnum(input.fontColor, 'white')
  if (input.highlightColor) payload.highlight_color = normalizeColorEnum(input.highlightColor, 'purple')
  if (typeof input.strokeWidth === 'number') payload.stroke_width = input.strokeWidth
  if (input.strokeColor) payload.stroke_color = normalizeColorEnum(input.strokeColor, 'black')
  if (input.backgroundColor) {
    payload.background_color = normalizeColorEnum(input.backgroundColor, 'none', BACKGROUND_COLOR_ENUM)
  }
  if (typeof input.backgroundOpacity === 'number') {
    payload.background_opacity = clamp(input.backgroundOpacity, 0, 1)
  }
  if (input.position) payload.position = input.position
  if (typeof input.xOffset === 'number') payload.x_offset = input.xOffset
  if (typeof input.yOffset === 'number') payload.y_offset = input.yOffset
  if (typeof input.wordsPerSubtitle === 'number') payload.words_per_subtitle = input.wordsPerSubtitle
  if (typeof input.enableAnimation === 'boolean') payload.enable_animation = input.enableAnimation

  const runPrimary = async (
    primaryPayload: Record<string, unknown>,
    metadata: Record<string, unknown> = {},
  ): Promise<AutoSubtitleResult> => {
    const result = await runWithRetries(
      () =>
        fal.subscribe(PRIMARY_MODEL_ID, {
          input: primaryPayload,
          logs: true,
          onQueueUpdate: (update) => {
            if (update.status === 'IN_PROGRESS' && update.logs) {
              update.logs.forEach((log) => {
                console.log(`[fal.ai captions] ${log.message}`)
              })
            }
          },
        }),
      {
        pipeline: 'captions.auto_subtitle.provider',
        provider: 'fal',
        metadata: { model: PRIMARY_MODEL_ID, ...metadata },
        retries: 4,
        baseDelayMs: 800,
      },
    )

    const data = result.data as {
      video?: { url?: string }
      transcription?: string
      subtitle_count?: number
      words?: unknown[]
      transcription_metadata?: unknown
    }

    const videoUrl = data.video?.url || ''

    return {
      videoUrl,
      transcription: data.transcription,
      subtitleCount: data.subtitle_count,
      words: data.words,
      transcriptionMetadata: data.transcription_metadata,
      modelUsed: PRIMARY_MODEL_ID,
    }
  }

  try {
    const result = await runPrimary(payload)
    if (!result.videoUrl || result.videoUrl === input.videoUrl) {
      console.warn('[captions] primary output missing or matches input, falling back to auto-caption')
      return runAutoCaptionFallback(input)
    }
    return result
  } catch (error) {
    if (isModelUnavailable(error)) {
      console.warn('[captions] primary model unavailable, falling back to auto-caption')
      return runAutoCaptionFallback(input)
    }
    if (isValidationError(error)) {
      logValidationError(error, payload)
      const minimalPayload: Record<string, unknown> = { video_url: input.videoUrl }
      if (input.language) minimalPayload.language = input.language
      try {
        const minimalResult = await runPrimary(minimalPayload, { mode: 'minimal' })
        if (!minimalResult.videoUrl || minimalResult.videoUrl === input.videoUrl) {
          console.warn('[captions] minimal output missing or matches input, falling back to auto-caption')
          return runAutoCaptionFallback(input)
        }
        return minimalResult
      } catch (minimalError) {
        if (isValidationError(minimalError)) {
          logValidationError(minimalError, minimalPayload)
        }
        console.warn('[captions] validation failed, falling back to auto-caption')
        return runAutoCaptionFallback(input)
      }
    }
    const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()
    const cause = (error as { cause?: { code?: string } })?.cause
    if (message.includes('fetch') || message.includes('epipe') || cause?.code === 'EPIPE') {
      console.warn('[captions] primary model network error, falling back to auto-caption')
      return runAutoCaptionFallback(input)
    }
    throw error
  }
}

export async function uploadVideoFile(filePath: string, contentType?: string): Promise<string> {
  return uploadVideoToFal(filePath, contentType)
}
