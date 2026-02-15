import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  subscribeMock,
  uploadMock,
  readFileMock,
  ensureFalConfigMock,
  isMockProvidersEnabledMock,
  runWithRetriesMock,
  recordMockProviderSuccessMock,
} = vi.hoisted(() => ({
  subscribeMock: vi.fn(),
  uploadMock: vi.fn(),
  readFileMock: vi.fn(),
  ensureFalConfigMock: vi.fn(),
  isMockProvidersEnabledMock: vi.fn(),
  runWithRetriesMock: vi.fn(),
  recordMockProviderSuccessMock: vi.fn(),
}))

vi.mock('@fal-ai/client', () => ({
  fal: {
    storage: {
      upload: uploadMock,
    },
    subscribe: subscribeMock,
  },
}))

vi.mock('node:fs/promises', () => ({
  default: {
    readFile: readFileMock,
    unlink: vi.fn(),
  },
}))

vi.mock('./falConfig.js', () => ({
  ensureFalConfig: ensureFalConfigMock,
}))

vi.mock('./providerRuntime.js', () => ({
  isMockProvidersEnabled: isMockProvidersEnabledMock,
  runWithRetries: runWithRetriesMock,
  recordMockProviderSuccess: recordMockProviderSuccessMock,
}))

import { transcribeAudio } from './wizper.js'

beforeEach(() => {
  vi.clearAllMocks()
  readFileMock.mockResolvedValue(Buffer.from('audio-bytes'))
  uploadMock.mockResolvedValue('https://fal.storage/audio.mp3')
  isMockProvidersEnabledMock.mockReturnValue(false)
  runWithRetriesMock.mockImplementation(async (work: () => Promise<unknown>) => await work())
})

describe('transcribeAudio', () => {
  it('uses minimal compatible payload by default', async () => {
    subscribeMock.mockResolvedValue({
      data: {
        text: 'Merhaba dunya',
        duration: 7.2,
        languages: ['tr'],
      },
    })

    const result = await transcribeAudio('/tmp/source-audio.mp3')

    expect(ensureFalConfigMock).toHaveBeenCalledTimes(1)
    expect(uploadMock).toHaveBeenCalledTimes(1)
    expect(runWithRetriesMock).toHaveBeenCalledTimes(1)
    expect(subscribeMock).toHaveBeenCalledWith(
      'fal-ai/wizper',
      expect.objectContaining({
        input: expect.objectContaining({
          audio_url: 'https://fal.storage/audio.mp3',
          task: 'transcribe',
        }),
      }),
    )
    const subscribeInput = subscribeMock.mock.calls[0]?.[1]?.input as Record<string, unknown>
    expect(subscribeInput.language).toBeNull()
    expect(subscribeInput.chunk_level).toBeUndefined()
    expect(result).toEqual({
      transcript: 'Merhaba dunya',
      duration: 7.2,
      language: 'tr',
    })
  })

  it('falls back to segment payload on validation errors', async () => {
    subscribeMock
      .mockRejectedValueOnce({
        status: 422,
        body: { detail: [{ loc: ['body', 'task'], msg: 'invalid' }] },
      })
      .mockResolvedValueOnce({
        data: {
          text: 'Fallback transcript',
          duration: 5.1,
          languages: ['en'],
        },
      })

    const result = await transcribeAudio('/tmp/source-audio.mp3')

    expect(subscribeMock).toHaveBeenCalledTimes(2)
    expect(subscribeMock).toHaveBeenNthCalledWith(
      2,
      'fal-ai/wizper',
      expect.objectContaining({
        input: expect.objectContaining({
          audio_url: 'https://fal.storage/audio.mp3',
          task: 'transcribe',
          chunk_level: 'segment',
        }),
      }),
    )

    expect(result).toEqual({
      transcript: 'Fallback transcript',
      duration: 5.1,
      language: 'en',
    })
  })

  it('returns mock transcript in mock-provider mode', async () => {
    isMockProvidersEnabledMock.mockReturnValue(true)

    const result = await transcribeAudio('/tmp/source-audio.mp3')

    expect(recordMockProviderSuccessMock).toHaveBeenCalledTimes(1)
    expect(subscribeMock).not.toHaveBeenCalled()
    expect(result).toEqual({
      transcript: 'Mock transcript for testing purposes.',
      duration: 30,
      language: 'en',
    })
  })
})
