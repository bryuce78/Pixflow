import { describe, expect, it } from 'vitest'
import { isSafeHttpUrl, normalizeWeeklyReportPayload } from './competitorReport.js'

const FALLBACK_REPORT = {
  app: 'Clone AI',
  window: {
    label: 'Last 7 days',
    start_date: '2026-02-08',
    end_date: '2026-02-15',
  },
  executive_summary: 'Fallback summary',
  trend_signals: [],
  creative_patterns: [],
  top_creatives: [],
  opportunities_next_week: [],
  data_gaps: [],
}

describe('isSafeHttpUrl', () => {
  it('accepts only http/https urls', () => {
    expect(isSafeHttpUrl('https://example.com')).toBe(true)
    expect(isSafeHttpUrl('http://example.com/path')).toBe(true)
    expect(isSafeHttpUrl('javascript:alert(1)')).toBe(false)
    expect(isSafeHttpUrl('data:text/html;base64,abcd')).toBe(false)
    expect(isSafeHttpUrl('')).toBe(false)
  })
})

describe('normalizeWeeklyReportPayload', () => {
  it('normalizes malformed fields into safe defaults', () => {
    const normalized = normalizeWeeklyReportPayload(
      {
        app: 123,
        executive_summary: 456,
        trend_signals: 'not-an-array',
        creative_patterns: null,
        top_creatives: 'bad-shape',
        opportunities_next_week: { no: true },
        data_gaps: 99,
      },
      FALLBACK_REPORT,
    )

    expect(normalized.app).toBe('123')
    expect(normalized.executive_summary).toBe('456')
    expect(normalized.trend_signals).toEqual([])
    expect(normalized.creative_patterns).toEqual([])
    expect(normalized.top_creatives).toEqual([])
    expect(normalized.opportunities_next_week).toEqual([])
    expect(normalized.window.start_date).toBe('2026-02-08')
    expect(normalized.window.end_date).toBe('2026-02-15')
  })

  it('keeps only creatives within the configured 7-day window', () => {
    const normalized = normalizeWeeklyReportPayload(
      {
        top_creatives: [
          {
            title: 'Inside Start',
            detected_date: '2026-02-08',
            source_url: 'https://example.com/a',
          },
          {
            title: 'Inside End',
            detected_date: '2026-02-15',
            source_url: 'https://example.com/b',
          },
          {
            title: 'Too Old',
            detected_date: '2026-02-01',
            source_url: 'https://example.com/c',
          },
          {
            title: 'Unknown Date',
            detected_date: 'unknown',
            source_url: 'https://example.com/d',
          },
        ],
      },
      FALLBACK_REPORT,
    )

    expect(normalized.top_creatives.map((row) => row.title)).toEqual(['Inside Start', 'Inside End'])
    expect(normalized.data_gaps.some((item) => item.includes('outside the last 7-day window'))).toBe(true)
    expect(normalized.data_gaps.some((item) => item.includes('missing or invalid detected_date'))).toBe(true)
  })

  it('strips unsafe source urls from creative rows', () => {
    const normalized = normalizeWeeklyReportPayload(
      {
        top_creatives: [
          {
            title: 'Unsafe Url',
            detected_date: '2026-02-10',
            source_url: 'javascript:alert(1)',
          },
        ],
      },
      FALLBACK_REPORT,
    )

    expect(normalized.top_creatives).toHaveLength(1)
    expect(normalized.top_creatives[0].source_url).toBe('')
  })
})
