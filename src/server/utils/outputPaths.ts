import path from 'node:path'

function sanitizeSegment(input: string, fallback: string): string {
  const cleaned = String(input || '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
  return cleaned || fallback
}

export function normalizeJobId(input: string): string {
  return sanitizeSegment(input, 'job') || 'job'
}

export function createJobOutputDir(
  outputsRoot: string,
  category: string,
  mode: string,
  jobId: string,
): {
  category: string
  mode: string
  jobId: string
  outputDir: string
  outputDirUrl: string
} {
  const safeCategory = sanitizeSegment(category, 'general')
  const safeMode = sanitizeSegment(mode, 'run')
  const safeJobId = normalizeJobId(jobId)
  const outputDir = path.join(outputsRoot, safeCategory, safeMode, safeJobId)
  const outputDirUrl = `/outputs/${safeCategory}/${safeMode}/${safeJobId}`

  return {
    category: safeCategory,
    mode: safeMode,
    jobId: safeJobId,
    outputDir,
    outputDirUrl,
  }
}

export function buildJobOutputFileName(mode: string, jobId: string, extension: string, index?: number): string {
  const safeMode = sanitizeSegment(mode, 'output')
  const safeJobId = normalizeJobId(jobId)
  const safeExt = sanitizeSegment(extension.replace(/^\./, ''), 'bin')
  const suffix = Number.isFinite(index) ? `_${String(index).padStart(2, '0')}` : ''
  return `${safeMode}_${safeJobId}${suffix}.${safeExt}`
}

export function toOutputUrl(outputsRoot: string, absolutePath: string): string {
  const relative = path.relative(outputsRoot, absolutePath).split(path.sep).join('/')
  return `/outputs/${relative}`
}
