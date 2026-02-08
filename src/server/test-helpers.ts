import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { closeDatabase, initDatabase } from './db/index.js'

export async function setupTestDb() {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'pixflow-test-'))
  initDatabase(tmpDir)
  return {
    tmpDir,
    async cleanup() {
      closeDatabase()
      await rm(tmpDir, { recursive: true, force: true })
    },
  }
}

export function mockResponse() {
  const res = {
    _status: 0,
    _json: null as unknown,
    status(code: number) {
      res._status = code
      return res
    },
    json(body: unknown) {
      res._json = body
      return res
    },
  }
  return res
}

export async function withEnv(overrides: Record<string, string | undefined>, fn: () => void | Promise<void>) {
  const saved: Record<string, string | undefined> = {}
  for (const key of Object.keys(overrides)) {
    saved[key] = process.env[key]
    if (overrides[key] === undefined) delete process.env[key]
    else process.env[key] = overrides[key]
  }
  try {
    await fn()
  } finally {
    for (const key of Object.keys(saved)) {
      if (saved[key] === undefined) delete process.env[key]
      else process.env[key] = saved[key]
    }
  }
}
