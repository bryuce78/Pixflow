import { AlertCircle, BarChart3, ExternalLink, Loader2, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { apiUrl, authFetch, getApiError, unwrapApiData } from '../../lib/api'
import { StepHeader } from '../asset-monster/StepHeader'
import { Button } from '../ui/Button'

interface CompetitorApp {
  id: string
  name: string
  adsLibraryUrl: string
}

interface WeeklyCreativeRow {
  title: string
  hook: string
  creative_angle: string
  format: string
  platform: string
  detected_date: string
  why_it_works: string
  source_url: string
}

interface WeeklyReport {
  app: string
  window: {
    label: string
    start_date: string
    end_date: string
  }
  executive_summary: string
  trend_signals: string[]
  creative_patterns: string[]
  top_creatives: WeeklyCreativeRow[]
  opportunities_next_week: string[]
  data_gaps: string[]
}

interface WeeklyReportResponse {
  app: CompetitorApp
  report: WeeklyReport
  grounding: {
    sourceCount: number
    sourceUrls: string[]
    model: string
  }
  generatedAt: string
}

type UnknownRecord = Record<string, unknown>

const FALLBACK_APPS: CompetitorApp[] = [
  {
    id: 'clone_ai',
    name: 'Clone AI',
    adsLibraryUrl:
      'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&is_targeted_country=false&media_type=all&search_type=page&sort_data[mode]=relevancy_monthly_grouped&sort_data[direction]=desc&view_all_page_id=116040404815178',
  },
]

function asRecord(value: unknown): UnknownRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as UnknownRecord
}

function toText(value: unknown, fallback = ''): string {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed || fallback
  }
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return fallback
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => toText(item)).filter(Boolean)
}

function isSafeHttpUrl(value: string): boolean {
  if (!value) return false
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

function sanitizeHttpUrl(value: unknown): string {
  const text = toText(value)
  return isSafeHttpUrl(text) ? text : ''
}

function normalizeApps(value: unknown): CompetitorApp[] {
  if (!Array.isArray(value)) return []
  return value
    .map((entry) => {
      const row = asRecord(entry)
      if (!row) return null
      const id = toText(row.id)
      const name = toText(row.name)
      const adsLibraryUrl = sanitizeHttpUrl(row.adsLibraryUrl)
      if (!id || !name || !adsLibraryUrl) return null
      return { id, name, adsLibraryUrl }
    })
    .filter((entry): entry is CompetitorApp => !!entry)
}

function normalizeCreativeRows(value: unknown): WeeklyCreativeRow[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      const row = asRecord(item)
      if (!row) return null
      return {
        title: toText(row.title, 'Untitled Creative'),
        hook: toText(row.hook),
        creative_angle: toText(row.creative_angle),
        format: toText(row.format),
        platform: toText(row.platform),
        detected_date: toText(row.detected_date, 'unknown'),
        why_it_works: toText(row.why_it_works),
        source_url: sanitizeHttpUrl(row.source_url),
      }
    })
    .filter((entry): entry is WeeklyCreativeRow => !!entry)
}

function normalizeWeeklyReportResponse(value: unknown, fallbackApp: CompetitorApp): WeeklyReportResponse | null {
  const root = asRecord(value)
  if (!root) return null
  const rawReport = asRecord(root.report)
  if (!rawReport) return null
  const rawWindow = asRecord(rawReport.window)
  const rawGrounding = asRecord(root.grounding)
  const rawApp = asRecord(root.app)

  const app: CompetitorApp = {
    id: toText(rawApp?.id, fallbackApp.id),
    name: toText(rawApp?.name, fallbackApp.name),
    adsLibraryUrl: sanitizeHttpUrl(rawApp?.adsLibraryUrl) || fallbackApp.adsLibraryUrl,
  }

  const report: WeeklyReport = {
    app: toText(rawReport.app, app.name),
    window: {
      label: toText(rawWindow?.label, 'Last 7 days'),
      start_date: toText(rawWindow?.start_date),
      end_date: toText(rawWindow?.end_date),
    },
    executive_summary: toText(rawReport.executive_summary),
    trend_signals: toStringArray(rawReport.trend_signals),
    creative_patterns: toStringArray(rawReport.creative_patterns),
    top_creatives: normalizeCreativeRows(rawReport.top_creatives),
    opportunities_next_week: toStringArray(rawReport.opportunities_next_week),
    data_gaps: toStringArray(rawReport.data_gaps),
  }

  return {
    app,
    report,
    grounding: {
      sourceCount:
        typeof rawGrounding?.sourceCount === 'number' && Number.isFinite(rawGrounding.sourceCount)
          ? rawGrounding.sourceCount
          : 0,
      sourceUrls: toStringArray(rawGrounding?.sourceUrls).filter(isSafeHttpUrl),
      model: toText(rawGrounding?.model),
    },
    generatedAt: toText(root.generatedAt),
  }
}

export default function CompetitorReportPage() {
  const [apps, setApps] = useState<CompetitorApp[]>(FALLBACK_APPS)
  const [selectedAppId, setSelectedAppId] = useState<string>(FALLBACK_APPS[0]?.id || 'clone_ai')
  const [loadingApps, setLoadingApps] = useState(false)
  const [loadingReport, setLoadingReport] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [reportData, setReportData] = useState<WeeklyReportResponse | null>(null)

  useEffect(() => {
    let cancelled = false
    const loadApps = async () => {
      setLoadingApps(true)
      try {
        const res = await authFetch(apiUrl('/api/competitor-report/apps'))
        if (!res.ok) throw new Error(`Failed to load apps (${res.status})`)
        const raw = await res.json().catch(() => ({}))
        const data = unwrapApiData<{ apps?: unknown }>(raw)
        const normalizedApps = normalizeApps(data.apps)
        if (!cancelled && normalizedApps.length > 0) {
          setApps(normalizedApps)
          setSelectedAppId((previous) =>
            normalizedApps.some((app) => app.id === previous) ? previous : normalizedApps[0].id,
          )
        }
      } catch {
        // Keep fallback.
      } finally {
        if (!cancelled) setLoadingApps(false)
      }
    }

    void loadApps()
    return () => {
      cancelled = true
    }
  }, [])

  const selectedApp = useMemo(
    () => apps.find((entry) => entry.id === selectedAppId) || apps[0] || FALLBACK_APPS[0],
    [apps, selectedAppId],
  )

  const handleGenerateReport = async () => {
    if (!selectedApp) return
    setLoadingReport(true)
    setErrorMessage('')

    try {
      const res = await authFetch(apiUrl('/api/competitor-report/weekly'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appId: selectedApp.id }),
      })

      if (!res.ok) {
        const raw = await res.json().catch(() => ({}))
        throw new Error(getApiError(raw, `Failed to generate report (${res.status})`))
      }

      const raw = await res.json().catch(() => ({}))
      const data = unwrapApiData<unknown>(raw)
      const normalized = normalizeWeeklyReportResponse(data, selectedApp)
      if (!normalized) throw new Error('Invalid competitor report response')
      setReportData(normalized)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to generate competitor report')
    } finally {
      setLoadingReport(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-[360px_minmax(0,1fr)] gap-6">
        <div className="space-y-4">
          <div className="bg-surface-50 rounded-lg p-4 space-y-4">
            <StepHeader stepNumber={1} title="App Selection" />
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-surface-400 uppercase tracking-wider">App</span>
              <div className="relative">
                <select
                  value={selectedAppId}
                  onChange={(e) => setSelectedAppId(e.target.value)}
                  disabled={loadingApps || loadingReport}
                  className="w-full rounded-lg border border-surface-200 bg-surface-0 px-3 py-2 text-sm text-surface-700 focus:outline-none focus:ring-2 focus:ring-brand-500/60"
                >
                  {apps.map((app) => (
                    <option key={app.id} value={app.id}>
                      {app.name}
                    </option>
                  ))}
                </select>
              </div>
            </label>
            {selectedApp?.adsLibraryUrl && isSafeHttpUrl(selectedApp.adsLibraryUrl) && (
              <a
                href={selectedApp.adsLibraryUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-brand-500 hover:underline"
              >
                Open Ads Library
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>

          <Button
            variant="lime"
            className="w-full"
            size="lg"
            loading={loadingReport}
            icon={loadingReport ? undefined : <Sparkles className="w-4 h-4" />}
            disabled={loadingReport || !selectedApp}
            onClick={handleGenerateReport}
          >
            {loadingReport ? 'Generating report...' : 'Generate Report'}
          </Button>
        </div>

        <div className="bg-surface-50 rounded-lg p-4">
          <StepHeader stepNumber={2} title="Last 7 Days Competitor Creative Summary" />

          {errorMessage && (
            <div className="mb-4 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {loadingReport && (
            <div className="rounded-lg border border-surface-200 bg-surface-0 px-4 py-6 text-sm text-surface-500 flex items-center gap-3">
              <Loader2 className="w-4 h-4 animate-spin text-brand-500" />
              Gathering last-week creatives...
            </div>
          )}

          {!loadingReport && !reportData && !errorMessage && (
            <div className="rounded-lg border border-surface-200 bg-surface-0 px-4 py-8 text-sm text-surface-400 flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Select app and generate report.
            </div>
          )}

          {!loadingReport && reportData && (
            <div className="space-y-4">
              <div className="rounded-lg border border-surface-200 bg-surface-0 p-3">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <p className="text-xs uppercase tracking-wider text-surface-400">{reportData.report.window.label}</p>
                  <p className="text-xs text-surface-400">
                    {reportData.report.window.start_date} - {reportData.report.window.end_date}
                  </p>
                </div>
                <p className="text-sm text-surface-700">{reportData.report.executive_summary}</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="rounded-lg border border-surface-200 bg-surface-0 p-3">
                  <p className="text-xs uppercase tracking-wider text-surface-400 mb-2">Trend Signals</p>
                  <ul className="space-y-1 text-sm text-surface-700">
                    {reportData.report.trend_signals.length === 0 && (
                      <li className="text-surface-400">No signal yet.</li>
                    )}
                    {reportData.report.trend_signals.map((item) => (
                      <li key={item}>- {item}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-lg border border-surface-200 bg-surface-0 p-3">
                  <p className="text-xs uppercase tracking-wider text-surface-400 mb-2">Creative Patterns</p>
                  <ul className="space-y-1 text-sm text-surface-700">
                    {reportData.report.creative_patterns.length === 0 && (
                      <li className="text-surface-400">No pattern yet.</li>
                    )}
                    {reportData.report.creative_patterns.map((item) => (
                      <li key={item}>- {item}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="rounded-lg border border-surface-200 bg-surface-0 p-3 space-y-3">
                <p className="text-xs uppercase tracking-wider text-surface-400">Top Creatives</p>
                {reportData.report.top_creatives.length === 0 && (
                  <p className="text-sm text-surface-400">No rows found.</p>
                )}
                {reportData.report.top_creatives.map((creative, idx) => (
                  <div
                    key={`${creative.source_url}-${idx}`}
                    className="rounded-md border border-surface-200 p-3 space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-surface-800">
                        {creative.title || `Creative #${idx + 1}`}
                      </p>
                      <span className="text-xs text-surface-400">{creative.detected_date || 'unknown'}</span>
                    </div>
                    <p className="text-xs text-brand-500">Hook: {creative.hook}</p>
                    <p className="text-xs text-surface-500">
                      {creative.platform} · {creative.format}
                    </p>
                    <p className="text-sm text-surface-700">{creative.creative_angle}</p>
                    <p className="text-xs text-surface-500">{creative.why_it_works}</p>
                    {creative.source_url && (
                      <a
                        href={creative.source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-brand-500 hover:underline"
                      >
                        Source
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                ))}
              </div>

              <div className="rounded-lg border border-surface-200 bg-surface-0 p-3">
                <p className="text-xs uppercase tracking-wider text-surface-400 mb-2">Opportunities Next Week</p>
                <ul className="space-y-1 text-sm text-surface-700">
                  {reportData.report.opportunities_next_week.length === 0 && (
                    <li className="text-surface-400">No opportunity suggested.</li>
                  )}
                  {reportData.report.opportunities_next_week.map((item) => (
                    <li key={item}>- {item}</li>
                  ))}
                </ul>
              </div>
              {reportData.report.data_gaps.length > 0 && (
                <div className="rounded-lg border border-warning/30 bg-warning/10 p-3">
                  <p className="text-xs uppercase tracking-wider text-warning mb-2">Data Gaps</p>
                  <ul className="space-y-1 text-sm text-surface-700">
                    {reportData.report.data_gaps.map((item) => (
                      <li key={item}>- {item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
