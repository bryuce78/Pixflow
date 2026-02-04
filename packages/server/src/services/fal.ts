import { fal } from '@fal-ai/client'
import fs from 'fs/promises'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'

let falConfigured = false

function ensureFalConfig() {
  if (!falConfigured) {
    fal.config({ credentials: process.env.FAL_API_KEY })
    falConfigured = true
  }
}

const MODEL_ID = 'fal-ai/nano-banana-pro/edit'

export interface GeneratedImage {
  id: string
  url: string
  localPath?: string
  promptIndex: number
  status: 'pending' | 'generating' | 'completed' | 'failed'
  error?: string
}

export interface BatchJob {
  id: string
  concept: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  totalImages: number
  completedImages: number
  images: GeneratedImage[]
  outputDir: string
  createdAt: Date
}

const activeJobs = new Map<string, BatchJob>()
const JOB_RETENTION_MS = 30 * 60 * 1000 // 30 minutes

function cleanupOldJobs() {
  const now = Date.now()
  for (const [jobId, job] of activeJobs) {
    const jobAge = now - job.createdAt.getTime()
    if (jobAge > JOB_RETENTION_MS && (job.status === 'completed' || job.status === 'failed')) {
      activeJobs.delete(jobId)
    }
  }
}

setInterval(cleanupOldJobs, 5 * 60 * 1000) // Run every 5 minutes

async function fileToDataUrl(filePath: string): Promise<string> {
  const buffer = await fs.readFile(filePath)
  const base64 = buffer.toString('base64')
  const ext = path.extname(filePath).toLowerCase()
  const mimeType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg'
  return `data:${mimeType};base64,${base64}`
}

export async function generateImage(
  referenceImagePaths: string | string[],
  prompt: string,
  options: { resolution?: string; aspectRatio?: string } = {}
): Promise<{ url: string; requestId: string }> {
  ensureFalConfig()

  const paths = Array.isArray(referenceImagePaths) ? referenceImagePaths : [referenceImagePaths]

  const imageUrls = await Promise.all(
    paths.map(async (p) => {
      if (p.startsWith('file://') || p.startsWith('/')) {
        const filePath = p.replace('file://', '')
        return fileToDataUrl(filePath)
      }
      return p
    })
  )

  const result = await fal.subscribe(MODEL_ID, {
    input: {
      prompt,
      image_urls: imageUrls,
      resolution: options.resolution || '2K',
      aspect_ratio: options.aspectRatio || '9:16',
      num_images: 1,
    },
    logs: true,
    onQueueUpdate: (update) => {
      if (update.status === 'IN_PROGRESS' && update.logs) {
        update.logs.forEach((log) => console.log(`[fal.ai] ${log.message}`))
      }
    },
  })

  const generatedUrl = result.data?.images?.[0]?.url
  if (!generatedUrl) {
    throw new Error('No image generated')
  }

  return { url: generatedUrl, requestId: result.requestId }
}

export async function downloadImage(url: string, outputPath: string): Promise<string> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Failed to download: ${response.status}`)

  const buffer = Buffer.from(await response.arrayBuffer())
  await fs.mkdir(path.dirname(outputPath), { recursive: true })
  await fs.writeFile(outputPath, buffer)

  return outputPath
}

export function createBatchJob(
  concept: string,
  promptCount: number,
  outputDir: string
): BatchJob {
  const job: BatchJob = {
    id: uuidv4(),
    concept,
    status: 'pending',
    totalImages: promptCount,
    completedImages: 0,
    images: Array.from({ length: promptCount }, (_, i) => ({
      id: uuidv4(),
      url: '',
      promptIndex: i,
      status: 'pending',
    })),
    outputDir,
    createdAt: new Date(),
  }
  activeJobs.set(job.id, job)
  return job
}

export function getJob(jobId: string): BatchJob | undefined {
  return activeJobs.get(jobId)
}

export async function generateBatch(
  jobId: string,
  referenceImageUrls: string | string[],
  prompts: string[],
  options: { resolution?: string; aspectRatio?: string; concurrency?: number } = {}
): Promise<void> {
  const job = activeJobs.get(jobId)
  if (!job) throw new Error('Job not found')

  job.status = 'in_progress'
  const concurrency = options.concurrency || 2

  const generateOne = async (index: number): Promise<void> => {
    const image = job.images[index]
    if (!image) return

    image.status = 'generating'

    try {
      const { url } = await generateImage(referenceImageUrls, prompts[index], {
        resolution: options.resolution,
        aspectRatio: options.aspectRatio,
      })

      image.url = url
      image.status = 'completed'

      const safeConcept = job.concept.toLowerCase().replace(/\.\./g, '').replace(/[<>:"/\\|?*]/g, '').replace(/\s+/g, '_').slice(0, 50)
      const fileName = `${safeConcept}_${String(index + 1).padStart(2, '0')}.png`
      const localPath = path.join(job.outputDir, fileName)

      try {
        await downloadImage(url, localPath)
        image.localPath = localPath
        console.log(`[Batch] Saved: ${fileName}`)
      } catch (downloadErr) {
        console.error(`[Batch] Download failed for ${fileName}:`, downloadErr)
      }

      job.completedImages++
    } catch (err) {
      image.status = 'failed'
      image.error = err instanceof Error ? err.message : 'Unknown error'
      console.error(`[Batch] Failed prompt ${index + 1}:`, err)
    }
  }

  const queue = [...Array(prompts.length).keys()]
  const workers = Array.from({ length: Math.min(concurrency, prompts.length) }, async () => {
    while (queue.length > 0) {
      const index = queue.shift()
      if (index !== undefined) {
        await generateOne(index)
      }
    }
  })

  await Promise.all(workers)

  job.status = job.images.every((img) => img.status === 'completed') ? 'completed' : 'failed'
}

export function formatPromptForFal(promptJson: Record<string, unknown>): string {
  const style = promptJson.style as string || ''
  const pose = promptJson.pose as Record<string, unknown> || {}
  const lighting = promptJson.lighting as Record<string, unknown> || {}
  const setDesign = promptJson.set_design as Record<string, unknown> || {}
  const outfit = promptJson.outfit as Record<string, unknown> || {}
  const hairstyle = promptJson.hairstyle as Record<string, unknown> || {}
  const makeup = promptJson.makeup as Record<string, unknown> || {}
  const effects = promptJson.effects as Record<string, unknown> || {}
  const camera = promptJson.camera as Record<string, unknown> || {}

  const parts = [
    style,
    `Pose: ${pose.framing || ''}, ${pose.body_position || ''}, ${(pose.expression as Record<string, unknown>)?.facial || ''}`,
    `Lighting: ${lighting.setup || ''}, ${lighting.mood || ''}`,
    `Background: ${setDesign.backdrop || ''}`,
    `Outfit: ${outfit.main || ''}, ${outfit.accessories || ''}`,
    `Hair: ${hairstyle.style || ''}`,
    `Makeup: ${makeup.style || ''}, ${makeup.eyes || ''}, ${makeup.lips || ''}`,
    `Camera: ${camera.lens || ''}, ${camera.angle || ''}`,
    `Effects: ${effects.color_grade || ''}, ${effects.grain || ''}`,
  ]

  return parts.filter(Boolean).join('. ').replace(/\s+/g, ' ').trim()
}
