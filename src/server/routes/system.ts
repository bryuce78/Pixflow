import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { Router } from 'express'
import { sendError, sendSuccess } from '../utils/http.js'

const ALLOWED_ROOTS = ['outputs', 'uploads', 'avatars', 'avatars_generated', 'avatars_uploads'] as const

function isPathInside(parent: string, child: string): boolean {
  const rel = path.relative(parent, child)
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))
}

function normalizeRequestedPath(input: unknown): string {
  if (typeof input !== 'string') return ''
  const trimmed = input.trim()
  if (!trimmed) return ''

  if (trimmed.startsWith('file://')) {
    try {
      return path.normalize(new URL(trimmed).pathname)
    } catch {
      return ''
    }
  }

  return path.normalize(trimmed)
}

function resolveAllowedFolderPath(projectRoot: string, requestedPath: string): string | null {
  const normalized = normalizeRequestedPath(requestedPath)
  if (!normalized) return null

  let candidate = path.isAbsolute(normalized)
    ? normalized
    : normalized.startsWith('/')
      ? path.resolve(projectRoot, `.${normalized}`)
      : path.resolve(projectRoot, normalized)

  if (!fs.existsSync(candidate)) return null

  const stat = fs.statSync(candidate)
  if (stat.isFile()) {
    candidate = path.dirname(candidate)
  }

  if (!fs.existsSync(candidate) || !fs.statSync(candidate).isDirectory()) {
    return null
  }

  const resolvedCandidate = fs.realpathSync(candidate)
  const allowedRoots = ALLOWED_ROOTS.map((dir) => path.resolve(projectRoot, dir))
    .filter((root) => fs.existsSync(root))
    .map((root) => fs.realpathSync(root))

  if (!allowedRoots.some((root) => isPathInside(root, resolvedCandidate))) {
    return null
  }

  return resolvedCandidate
}

function openFolderInOs(folderPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    let command = 'xdg-open'
    let args = [folderPath]

    if (process.platform === 'darwin') {
      command = 'open'
      args = [folderPath]
    } else if (process.platform === 'win32') {
      command = 'cmd'
      args = ['/c', 'start', '', folderPath]
    }

    const child = spawn(command, args, {
      detached: true,
      stdio: 'ignore',
    })

    child.once('error', (error) => reject(error))
    child.once('spawn', () => {
      child.unref()
      resolve()
    })
  })
}

export function createSystemRouter({ projectRoot }: { projectRoot: string }): Router {
  const router = Router()

  router.post('/open-folder', async (req, res) => {
    const requestedPath = req.body?.path
    if (typeof requestedPath !== 'string' || !requestedPath.trim()) {
      sendError(res, 400, 'Path is required', 'INVALID_PATH')
      return
    }

    const folderPath = resolveAllowedFolderPath(projectRoot, requestedPath)
    if (!folderPath) {
      sendError(
        res,
        400,
        'Folder path is invalid or not allowed',
        'INVALID_FOLDER_PATH',
        'Only local folders inside outputs/uploads/avatars are allowed.',
      )
      return
    }

    try {
      await openFolderInOs(folderPath)
      sendSuccess(res, { path: folderPath })
    } catch (error) {
      sendError(
        res,
        500,
        'Failed to open folder',
        'FOLDER_OPEN_FAILED',
        error instanceof Error ? error.message : 'Unknown open-folder error',
      )
    }
  })

  return router
}
