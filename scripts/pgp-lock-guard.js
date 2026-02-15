#!/usr/bin/env node
/* eslint-disable no-console */
const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = process.cwd()
const LOCK_FILE = path.join(ROOT, 'docs/ops/pgp-lock.json')

const PROTECTED_FILES = [
  'src/server/routes/prompts.ts',
  'src/server/routes/videos.ts',
  'src/server/services/promptGenerator.ts',
  'src/server/services/research.ts',
  'src/server/services/ytdlp.ts',
  'src/server/services/wizper.ts',
  'src/server/utils/prompts.ts',
  'docs/PIPELINE.md',
]

const REQUIRED_UNLOCK_TOKEN = 'I_HAVE_EXPLICIT_USER_APPROVAL_FROM_PIXERY'

function sha256File(filePath) {
  const absolutePath = path.join(ROOT, filePath)
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Protected file is missing: ${filePath}`)
  }
  const content = fs.readFileSync(absolutePath)
  return crypto.createHash('sha256').update(content).digest('hex')
}

function buildFingerprint() {
  const files = PROTECTED_FILES.map((filePath) => ({
    path: filePath,
    sha256: sha256File(filePath),
  }))

  return {
    schema: 1,
    generatedAt: new Date().toISOString(),
    protectedFiles: files,
  }
}

function readLockFile() {
  if (!fs.existsSync(LOCK_FILE)) {
    throw new Error(`PGP lock file not found: ${path.relative(ROOT, LOCK_FILE)}`)
  }
  return JSON.parse(fs.readFileSync(LOCK_FILE, 'utf8'))
}

function compare(current, locked) {
  const lockedByPath = new Map(
    (Array.isArray(locked.protectedFiles) ? locked.protectedFiles : []).map((entry) => [entry.path, entry.sha256]),
  )

  const diffs = []
  for (const entry of current.protectedFiles) {
    const lockedHash = lockedByPath.get(entry.path)
    if (!lockedHash) {
      diffs.push({
        path: entry.path,
        reason: 'missing_in_lock',
      })
      continue
    }
    if (lockedHash !== entry.sha256) {
      diffs.push({
        path: entry.path,
        reason: 'hash_mismatch',
        expected: lockedHash,
        actual: entry.sha256,
      })
    }
    lockedByPath.delete(entry.path)
  }

  for (const [pathKey] of lockedByPath.entries()) {
    diffs.push({
      path: pathKey,
      reason: 'extra_in_lock',
    })
  }

  return diffs
}

function printDiffs(diffs) {
  console.error('\nPGP lock check failed. Protected pipeline files changed.\n')
  for (const diff of diffs) {
    if (diff.reason === 'hash_mismatch') {
      console.error(`- ${diff.path}: modified`)
      continue
    }
    if (diff.reason === 'missing_in_lock') {
      console.error(`- ${diff.path}: not present in lock file`)
      continue
    }
    if (diff.reason === 'extra_in_lock') {
      console.error(`- ${diff.path}: lock entry has no protected file mapping`)
    }
  }
  console.error('\nTo intentionally update PGP lock:')
  console.error(
    '  PIXFLOW_PGP_UNLOCK=I_HAVE_EXPLICIT_USER_APPROVAL_FROM_PIXERY PIXFLOW_PGP_UNLOCK_NOTE="<reason>" npm run pgp:lock:update',
  )
  console.error('')
}

function ensureUnlockAuthorized() {
  const token = process.env.PIXFLOW_PGP_UNLOCK || ''
  const note = (process.env.PIXFLOW_PGP_UNLOCK_NOTE || '').trim()

  if (token !== REQUIRED_UNLOCK_TOKEN) {
    throw new Error(
      'Missing or invalid PIXFLOW_PGP_UNLOCK token. PGP lock update is blocked until explicit user approval is provided.',
    )
  }

  if (note.length < 8) {
    throw new Error('PIXFLOW_PGP_UNLOCK_NOTE is required (min 8 chars) to explain why PGP is being changed.')
  }

  return note
}

function writeLockFile(payload) {
  const dir = path.dirname(LOCK_FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(LOCK_FILE, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
}

function runCheck() {
  const current = buildFingerprint()
  const locked = readLockFile()
  const diffs = compare(current, locked)
  if (diffs.length > 0) {
    printDiffs(diffs)
    process.exit(1)
  }
  console.log('PGP lock check passed.')
}

function runUpdate() {
  const note = ensureUnlockAuthorized()
  const lockPayload = buildFingerprint()
  lockPayload.unlockNote = note
  writeLockFile(lockPayload)
  console.log(`PGP lock file updated: ${path.relative(ROOT, LOCK_FILE)}`)
}

function main() {
  const mode = process.argv[2] || 'check'
  if (mode === 'check') {
    runCheck()
    return
  }
  if (mode === 'update') {
    runUpdate()
    return
  }

  console.error('Usage: node scripts/pgp-lock-guard.js [check|update]')
  process.exit(2)
}

main()
