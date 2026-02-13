import type { NextFunction, Request, Response } from 'express'
import { getOrCreateBypassUser, getUserById, verifyToken } from '../services/auth.js'
import { sendError } from '../utils/http.js'

export interface AuthRequest extends Request {
  user?: { id: number; email: string; name: string; role: string }
}

function isDevAuthBypassEnabled(): boolean {
  if (process.env.NODE_ENV !== 'development') return false
  const raw = process.env.PIXFLOW_AUTH_BYPASS?.trim().toLowerCase()
  return ['1', 'true', 'yes', 'on'].includes(raw || '')
}

function getAuthMode(): 'disabled' | 'token' {
  const raw = process.env.PIXFLOW_AUTH_MODE?.trim().toLowerCase()
  if (raw === 'token' || raw === 'jwt' || raw === 'strict') return 'token'
  return 'disabled'
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  if (getAuthMode() === 'disabled' || isDevAuthBypassEnabled()) {
    req.user = getOrCreateBypassUser()
    next()
    return
  }

  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    sendError(res, 401, 'Missing authorization header', 'AUTH_HEADER_MISSING')
    return
  }

  const payload = verifyToken(header.slice(7))
  if (!payload) {
    sendError(res, 401, 'Invalid or expired token', 'AUTH_TOKEN_INVALID')
    return
  }

  const user = getUserById(payload.userId)
  if (!user) {
    sendError(res, 401, 'User not found', 'AUTH_USER_NOT_FOUND')
    return
  }

  req.user = user
  next()
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  if (req.user?.role !== 'admin') {
    sendError(res, 403, 'Admin access required', 'ADMIN_REQUIRED')
    return
  }
  next()
}
