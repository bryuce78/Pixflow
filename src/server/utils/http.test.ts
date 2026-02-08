import { describe, expect, it } from 'vitest'
import { mockResponse } from '../test-helpers.js'
import { sendError, sendSuccess } from './http.js'

describe('sendSuccess', () => {
  it('sets status 200 and wraps payload in envelope', () => {
    const res = mockResponse()
    sendSuccess(res as never, { key: 'value' })
    expect(res._status).toBe(200)
    expect(res._json).toEqual({ success: true, data: { key: 'value' } })
  })

  it('accepts custom status code', () => {
    const res = mockResponse()
    sendSuccess(res as never, { id: 1 }, 201)
    expect(res._status).toBe(201)
    expect(res._json).toEqual({ success: true, data: { id: 1 } })
  })

  it('defaults to empty object when no payload given', () => {
    const res = mockResponse()
    sendSuccess(res as never)
    expect(res._status).toBe(200)
    expect(res._json).toEqual({ success: true, data: {} })
  })
})

describe('sendError', () => {
  it('sets status and returns error envelope', () => {
    const res = mockResponse()
    sendError(res as never, 400, 'Bad request', 'VALIDATION_ERROR')
    expect(res._status).toBe(400)
    expect(res._json).toEqual({ success: false, error: 'Bad request', code: 'VALIDATION_ERROR' })
  })

  it('includes details field when provided', () => {
    const res = mockResponse()
    sendError(res as never, 500, 'Server error', 'INTERNAL', 'Stack trace here')
    expect(res._json).toEqual({
      success: false,
      error: 'Server error',
      code: 'INTERNAL',
      details: 'Stack trace here',
    })
  })

  it('omits details field when not provided', () => {
    const res = mockResponse()
    sendError(res as never, 404, 'Not found')
    expect(res._json).not.toHaveProperty('details')
  })

  it('uses default code REQUEST_FAILED when code not specified', () => {
    const res = mockResponse()
    sendError(res as never, 422, 'Invalid input')
    expect(res._json).toEqual({ success: false, error: 'Invalid input', code: 'REQUEST_FAILED' })
  })
})
