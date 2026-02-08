import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { withEnv } from '../test-helpers.js'

let tmpDir: string
const originalTelemetryDir = process.env.PIXFLOW_TELEMETRY_DIR
const originalTelemetryEnabled = process.env.PIXFLOW_TELEMETRY_ENABLED

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pixflow-telemetry-test-'))
  process.env.PIXFLOW_TELEMETRY_DIR = tmpDir
  process.env.PIXFLOW_TELEMETRY_ENABLED = 'true'
})

afterAll(async () => {
  if (originalTelemetryDir === undefined) delete process.env.PIXFLOW_TELEMETRY_DIR
  else process.env.PIXFLOW_TELEMETRY_DIR = originalTelemetryDir
  if (originalTelemetryEnabled === undefined) delete process.env.PIXFLOW_TELEMETRY_ENABLED
  else process.env.PIXFLOW_TELEMETRY_ENABLED = originalTelemetryEnabled
  await fs.rm(tmpDir, { recursive: true, force: true })
})

async function readEvents(): Promise<Record<string, unknown>[]> {
  const filePath = path.join(tmpDir, 'pipeline-events.jsonl')
  try {
    const raw = await fs.readFile(filePath, 'utf8')
    return raw
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as Record<string, unknown>)
  } catch {
    return []
  }
}

async function clearEvents(): Promise<void> {
  const filePath = path.join(tmpDir, 'pipeline-events.jsonl')
  try {
    await fs.unlink(filePath)
  } catch {
    /* noop */
  }
}

describe('recordPipelineEvent', () => {
  beforeEach(async () => {
    await clearEvents()
  })

  it('writes a JSONL line with id, timestamp, pipeline, status', async () => {
    const { recordPipelineEvent } = await import('./telemetry.js')
    await recordPipelineEvent({ pipeline: 'test.write', status: 'success' })
    const events = await readEvents()
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ pipeline: 'test.write', status: 'success' })
    expect(events[0]).toHaveProperty('id')
    expect(events[0]).toHaveProperty('timestamp')
  })

  it('each line is valid JSON', async () => {
    const { recordPipelineEvent } = await import('./telemetry.js')
    await recordPipelineEvent({ pipeline: 'a', status: 'start' })
    await recordPipelineEvent({ pipeline: 'b', status: 'error', error: 'oops' })
    const events = await readEvents()
    expect(events).toHaveLength(2)
    expect(events[1]).toMatchObject({ pipeline: 'b', status: 'error', error: 'oops' })
  })

  it('does nothing when telemetry is disabled', async () => {
    const { recordPipelineEvent } = await import('./telemetry.js')
    await withEnv({ PIXFLOW_TELEMETRY_ENABLED: 'false' }, async () => {
      await recordPipelineEvent({ pipeline: 'disabled', status: 'success' })
    })
    const events = await readEvents()
    expect(events).toHaveLength(0)
  })

  it('does not throw on write failure', async () => {
    const { recordPipelineEvent } = await import('./telemetry.js')
    await withEnv({ PIXFLOW_TELEMETRY_DIR: '/nonexistent/read-only-path/deep' }, async () => {
      await expect(recordPipelineEvent({ pipeline: 'fail', status: 'error' })).resolves.toBeUndefined()
    })
  })
})

describe('createPipelineSpan', () => {
  beforeEach(async () => {
    await clearEvents()
  })

  it('records start event and success event with durationMs', async () => {
    const { createPipelineSpan } = await import('./telemetry.js')
    const span = createPipelineSpan({ pipeline: 'span.test' })
    await new Promise((r) => setTimeout(r, 10))
    span.success({ extra: 'data' })
    await new Promise((r) => setTimeout(r, 50))
    const events = await readEvents()
    const startEvt = events.find((e) => e.status === 'start')
    const successEvt = events.find((e) => e.status === 'success')
    expect(startEvt).toBeDefined()
    expect(successEvt).toBeDefined()
    expect(successEvt!.durationMs).toBeGreaterThan(0)
    expect((successEvt!.metadata as Record<string, unknown>)?.extra).toBe('data')
  })

  it('records error event with error message', async () => {
    const { createPipelineSpan } = await import('./telemetry.js')
    const span = createPipelineSpan({ pipeline: 'span.err' })
    span.error(new Error('something broke'))
    await new Promise((r) => setTimeout(r, 50))
    const events = await readEvents()
    const errEvt = events.find((e) => e.status === 'error')
    expect(errEvt).toBeDefined()
    expect(errEvt!.error).toBe('something broke')
    expect(errEvt!.durationMs).toBeGreaterThanOrEqual(0)
  })
})
