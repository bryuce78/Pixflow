import { beforeEach, describe, expect, it, vi } from 'vitest'
import { withEnv } from '../test-helpers.js'

vi.mock('./telemetry.js', () => ({
  recordPipelineEvent: vi.fn(async () => {}),
}))

import {
  classifyProviderFailure,
  isMockProvidersEnabled,
  makeMockDataUrl,
  makeMockId,
  makeMockPngDataUrl,
  recordMockProviderSuccess,
  runWithRetries,
} from './providerRuntime.js'
import { recordPipelineEvent } from './telemetry.js'

const mockedRecord = vi.mocked(recordPipelineEvent)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('isMockProvidersEnabled', () => {
  it('returns false when env var is unset', async () => {
    await withEnv({ PIXFLOW_MOCK_PROVIDERS: undefined }, () => {
      expect(isMockProvidersEnabled()).toBe(false)
    })
  })

  it('returns true for truthy values', async () => {
    for (const val of ['1', 'true', 'yes', 'on', ' TRUE ', ' On ']) {
      await withEnv({ PIXFLOW_MOCK_PROVIDERS: val }, () => {
        expect(isMockProvidersEnabled()).toBe(true)
      })
    }
  })

  it('returns false for falsy values', async () => {
    for (const val of ['0', 'false', 'no', 'off', 'random']) {
      await withEnv({ PIXFLOW_MOCK_PROVIDERS: val }, () => {
        expect(isMockProvidersEnabled()).toBe(false)
      })
    }
  })
})

describe('makeMockDataUrl', () => {
  it('encodes content as base64 data URL', () => {
    const result = makeMockDataUrl('text/plain', 'hello')
    expect(result).toBe(`data:text/plain;base64,${Buffer.from('hello').toString('base64')}`)
  })

  it('handles empty content', () => {
    const result = makeMockDataUrl('text/plain', '')
    expect(result).toBe('data:text/plain;base64,')
  })
})

describe('makeMockPngDataUrl', () => {
  it('returns a data:image/png;base64 URL', () => {
    expect(makeMockPngDataUrl()).toMatch(/^data:image\/png;base64,.+/)
  })
})

describe('makeMockId', () => {
  it('returns string matching mock-{prefix}-{uuid} pattern', () => {
    expect(makeMockId('test')).toMatch(/^mock-test-[0-9a-f]{8}-[0-9a-f]{4}-/)
  })

  it('produces unique values', () => {
    expect(makeMockId('a')).not.toBe(makeMockId('a'))
  })
})

describe('classifyProviderFailure', () => {
  it('returns timeout for timeout-related messages', () => {
    expect(classifyProviderFailure(new Error('Request timeout'))).toBe('timeout')
    expect(classifyProviderFailure(new Error('timed out after 30s'))).toBe('timeout')
    expect(classifyProviderFailure(new Error('abort signal'))).toBe('timeout')
  })

  it('returns rate_limit for 429 or rate limit messages', () => {
    expect(classifyProviderFailure(new Error('Status 429: Too Many Requests'))).toBe('rate_limit')
    expect(classifyProviderFailure(new Error('Rate limit exceeded'))).toBe('rate_limit')
  })

  it('returns network for fetch/network errors', () => {
    expect(classifyProviderFailure(new Error('fetch failed'))).toBe('network')
    expect(classifyProviderFailure(new Error('network error'))).toBe('network')
    expect(classifyProviderFailure(new Error('ECONNREFUSED'))).toBe('network')
  })

  it('returns provider for unrecognized errors', () => {
    expect(classifyProviderFailure(new Error('Internal server error'))).toBe('provider')
  })

  it('handles non-Error input', () => {
    expect(classifyProviderFailure('timeout string')).toBe('timeout')
    expect(classifyProviderFailure(42)).toBe('provider')
    expect(classifyProviderFailure(null)).toBe('provider')
  })
})

describe('runWithRetries', () => {
  it('returns result on first successful attempt', async () => {
    const result = await runWithRetries(() => Promise.resolve('ok'), {
      pipeline: 'test',
      provider: 'openai',
      baseDelayMs: 100,
    })
    expect(result).toBe('ok')
    expect(mockedRecord).toHaveBeenCalledTimes(1)
    expect(mockedRecord).toHaveBeenCalledWith(expect.objectContaining({ status: 'success' }))
  })

  it('retries on failure and succeeds on second attempt', async () => {
    let calls = 0
    const work = () => {
      calls++
      if (calls === 1) return Promise.reject(new Error('fail'))
      return Promise.resolve('recovered')
    }

    const result = await runWithRetries(work, {
      pipeline: 'test',
      provider: 'fal',
      baseDelayMs: 100,
    })

    expect(result).toBe('recovered')
    expect(mockedRecord).toHaveBeenCalledWith(expect.objectContaining({ status: 'error' }))
    expect(mockedRecord).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'success', metadata: expect.objectContaining({ recovered: true }) }),
    )
  })

  it('exhausts all retries then throws', async () => {
    const work = () => Promise.reject(new Error('always fails'))

    await expect(
      runWithRetries(work, { pipeline: 'test', provider: 'hedra', retries: 1, baseDelayMs: 100 }),
    ).rejects.toThrow('always fails')
    const errorCalls = mockedRecord.mock.calls.filter((c) => (c[0] as { status: string }).status === 'error')
    expect(errorCalls).toHaveLength(2)
  })

  it('respects retries: 0 (no retries)', async () => {
    const work = () => Promise.reject(new Error('instant fail'))

    await expect(runWithRetries(work, { pipeline: 'test', provider: 'kling', retries: 0 })).rejects.toThrow(
      'instant fail',
    )
    expect(mockedRecord).toHaveBeenCalledTimes(1)
  })

  it('records provider and attempt metadata', async () => {
    await runWithRetries(() => Promise.resolve(1), {
      pipeline: 'gen.batch',
      provider: 'fal',
      metadata: { custom: true },
    })
    expect(mockedRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        pipeline: 'gen.batch',
        metadata: expect.objectContaining({ provider: 'fal', attempt: 1, custom: true }),
      }),
    )
  })
})

describe('recordMockProviderSuccess', () => {
  it('records event with mock: true metadata', async () => {
    await recordMockProviderSuccess({ pipeline: 'test.mock', provider: 'openai' })
    expect(mockedRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        pipeline: 'test.mock',
        status: 'success',
        metadata: expect.objectContaining({ provider: 'openai', mock: true, attempt: 1, retries: 0, recovered: false }),
      }),
    )
  })
})
