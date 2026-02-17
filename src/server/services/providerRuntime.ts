import { randomUUID } from 'node:crypto'
import { recordPipelineEvent } from './telemetry.js'

interface RetryOptions {
  pipeline: string
  provider: 'openai' | 'fal' | 'hedra' | 'kling'
  userId?: number
  retries?: number
  baseDelayMs?: number
  metadata?: Record<string, unknown>
}

const MOCK_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7Z0yQAAAAASUVORK5CYII='
const MOCK_MP4_BASE64 =
  'AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAPUbW9vdgAAAGxtdmhkAAAAAAAAAAAAAAAAAAAD6AAAAggAAQAAAQAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAv90cmFrAAAAXHRraGQAAAADAAAAAAAAAAAAAAABAAAAAAAAAggAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAABAAAAAQAAAAAAAkZWR0cwAAABxlbHN0AAAAAAAAAAEAAAIIAAAEAAABAAAAAAJ3bWRpYQAAACBtZGhkAAAAAAAAAAAAAAAAAAAyAAAAGgBVxAAAAAAALWhkbHIAAAAAAAAAAHZpZGUAAAAAAAAAAAAAAABWaWRlb0hhbmRsZXIAAAACIm1pbmYAAAAUdm1oZAAAAAEAAAAAAAAAAAAAACRkaW5mAAAAHGRyZWYAAAAAAAAAAQAAAAx1cmwgAAAAAQAAAeJzdGJsAAAAvnN0c2QAAAAAAAAAAQAAAK5hdmMxAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAABAAEABIAAAASAAAAAAAAAABFUxhdmM2Mi4xMS4xMDAgbGlieDI2NAAAAAAAAAAAAAAAGP//AAAANGF2Y0MBZAAK/+EAF2dkAAqs2V7ARAAAAwAEAAADAMg8SJZYAQAGaOvjyyLA/fj4AAAAABBwYXNwAAAAAQAAAAEAAAAUYnRydAAAAAAAADQ5AAAAAAAAABhzdHRzAAAAAAAAAAEAAAANAAACAAAAABRzdHNzAAAAAAAAAAEAAAABAAAAeGN0dHMAAAAAAAAADQAAAAEAAAQAAAAAAQAACgAAAAABAAAEAAAAAAEAAAAAAAAAAQAAAgAAAAABAAAKAAAAAAEAAAQAAAAAAQAAAAAAAAABAAACAAAAAAEAAAoAAAAAAQAABAAAAAABAAAAAAAAAAEAAAIAAAAAHHN0c2MAAAAAAAAAAQAAAAEAAAANAAAAAQAAAEhzdHN6AAAAAAAAAAAAAAANAAACxQAAAAwAAAAMAAAADAAAAAwAAAASAAAADgAAAAwAAAAMAAAAEgAAAA4AAAAMAAAADAAAABRzdGNvAAAAAAAAAAEAAAQEAAAAYXVkdGEAAABZbWV0YQAAAAAAAAAhaGRscgAAAAAAAAAAbWRpcmFwcGwAAAAAAAAAAAAAAAAsaWxzdAAAACSpdG9vAAAAHGRhdGEAAAABAAAAAExhdmY2Mi4zLjEwMAAAAAhmcmVlAAADbW1kYXQAAAKuBgX//6rcRem95tlIt5Ys2CDZI+7veDI2NCAtIGNvcmUgMTY1IHIzMjIyIGIzNTYwNWEgLSBILjI2NC9NUEVHLTQgQVZDIGNvZGVjIC0gQ29weWxlZnQgMjAwMy0yMDI1IC0gaHR0cDovL3d3dy52aWRlb2xhbi5vcmcveDI2NC5odG1sIC0gb3B0aW9uczogY2FiYWM9MSByZWY9MyBkZWJsb2NrPTE6MDowIGFuYWx5c2U9MHgzOjB4MTEzIG1lPWhleCBzdWJtZT03IHBzeT0xIHBzeV9yZD0xLjAwOjAuMDAgbWl4ZWRfcmVmPTEgbWVfcmFuZ2U9MTYgY2hyb21hX21lPTEgdHJlbGxpcz0xIDh4OGRjdD0xIGNxbT0wIGRlYWR6b25lPTIxLDExIGZhc3RfcHNraXA9MSBjaHJvbWFfcXBfb2Zmc2V0PS0yIHRocmVhZHM9MSBsb29rYWhlYWRfdGhyZWFkcz0xIHNsaWNlZF90aHJlYWRzPTAgbnI9MCBkZWNpbWF0ZT0xIGludGVybGFjZWQ9MCBibHVyYXlfY29tcGF0PTAgY29uc3RyYWluZWRfaW50cmE9MCBiZnJhbWVzPTMgYl9weXJhbWlkPTIgYl9hZGFwdD0xIGJfYmlhcz0wIGRpcmVjdD0xIHdlaWdodGI9MSBvcGVuX2dvcD0wIHdlaWdodHA9MiBrZXlpbnQ9MjUwIGtleWludF9taW49MjUgc2NlbmVjdXQ9NDAgaW50cmFfcmVmcmVzaD0wIHJjX2xvb2thaGVhZD00MCByYz1jcmYgbWJ0cmVlPTEgY3JmPTIzLjAgcWNvbXA9MC42MCBxcG1pbj0wIHFwbWF4PTY5IHFwc3RlcD00IGlwX3JhdGlvPTEuNDAgYXE9MToxLjAwAIAAAAAPZYiEADv//vdOvwKbVMJhAAAACEGaJGxDf/7gAAAACEGeQniF/8GBAAAACAGeYXRCv8SAAAAACAGeY2pCv8SBAAAADkGaaEmoQWiZTAhn//7hAAAACkGehkURLC//wYEAAAAIAZ6ldEK/xIEAAAAIAZ6nakK/xIAAAAAOQZqsSahBbJlMCFf//sAAAAAKQZ7KRRUsL//BgQAAAAgBnul0Qr/EgAAAAAgBnutqQr/EgA=='

export function isMockProvidersEnabled(): boolean {
  const raw = process.env.PIXFLOW_MOCK_PROVIDERS
  if (!raw) return false
  return ['1', 'true', 'yes', 'on'].includes(raw.trim().toLowerCase())
}

export function makeMockDataUrl(mimeType: string, content: string): string {
  const b64 = Buffer.from(content, 'utf8').toString('base64')
  return `data:${mimeType};base64,${b64}`
}

export function makeMockMp4DataUrl(): string {
  return `data:video/mp4;base64,${MOCK_MP4_BASE64}`
}

export function makeMockPngDataUrl(): string {
  return `data:image/png;base64,${MOCK_PNG_BASE64}`
}

export function makeMockId(prefix: string): string {
  return `mock-${prefix}-${randomUUID()}`
}

export function classifyProviderFailure(error: unknown): 'timeout' | 'rate_limit' | 'network' | 'provider' {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()
  if (message.includes('timeout') || message.includes('timed out') || message.includes('abort')) return 'timeout'
  if (message.includes('429') || message.includes('rate limit')) return 'rate_limit'
  if (message.includes('fetch') || message.includes('network') || message.includes('econn')) return 'network'
  return 'provider'
}

export async function runWithRetries<T>(work: () => Promise<T>, options: RetryOptions): Promise<T> {
  const retries = Math.max(0, options.retries ?? 2)
  const baseDelayMs = Math.max(100, options.baseDelayMs ?? 400)

  let lastError: unknown
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      const result = await work()
      await recordPipelineEvent({
        pipeline: options.pipeline,
        status: 'success',
        userId: options.userId,
        metadata: {
          provider: options.provider,
          attempt,
          retries,
          recovered: attempt > 1,
          ...options.metadata,
        },
      })
      return result
    } catch (error) {
      lastError = error
      const failureType = classifyProviderFailure(error)
      await recordPipelineEvent({
        pipeline: options.pipeline,
        status: 'error',
        userId: options.userId,
        metadata: {
          provider: options.provider,
          attempt,
          retries,
          failureType,
          ...options.metadata,
        },
        error: error instanceof Error ? error.message : String(error),
      })

      if (attempt > retries) break
      await new Promise((resolve) => setTimeout(resolve, baseDelayMs * attempt))
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}

export async function recordMockProviderSuccess(input: {
  pipeline: string
  provider: 'openai' | 'fal' | 'hedra' | 'kling'
  userId?: number
  metadata?: Record<string, unknown>
}): Promise<void> {
  await recordPipelineEvent({
    pipeline: input.pipeline,
    status: 'success',
    userId: input.userId,
    metadata: {
      provider: input.provider,
      mock: true,
      attempt: 1,
      retries: 0,
      recovered: false,
      ...input.metadata,
    },
  })
}
