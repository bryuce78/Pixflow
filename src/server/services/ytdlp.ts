import ytDlp from '@distube/yt-dlp'
import path from 'node:path'
import fs from 'node:fs/promises'

export interface YtDlpDownloadResult {
  videoPath: string
  title: string
  duration: number
  platform: string
}

/**
 * Download video from URL using yt-dlp
 * Supports: Facebook, Instagram, TikTok, YouTube, and 1000+ sites
 */
export async function downloadVideoWithYtDlp(
  url: string,
  outputDir: string,
): Promise<YtDlpDownloadResult> {
  const timestamp = Date.now()
  const outputTemplate = path.join(outputDir, `ytdlp_${timestamp}_%(title)s.%(ext)s`)

  console.log('[yt-dlp] Downloading video from:', url)

  try {
    // Download video with yt-dlp
    const result = await ytDlp.exec(url, {
      output: outputTemplate,
      format: 'best[ext=mp4]/best', // Prefer MP4, fallback to best quality
      noPlaylist: true, // Only download single video, not playlist
      noWarnings: true,
      quiet: false,
      printJson: true, // Get metadata as JSON
    })

    // Parse metadata from output
    let metadata: any = {}
    try {
      const jsonMatch = result.stdout.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        metadata = JSON.parse(jsonMatch[0])
      }
    } catch {
      console.warn('[yt-dlp] Failed to parse metadata')
    }

    // Find downloaded file
    const files = await fs.readdir(outputDir)
    const downloadedFile = files.find(
      (f) => f.startsWith(`ytdlp_${timestamp}_`) && (f.endsWith('.mp4') || f.endsWith('.webm')),
    )

    if (!downloadedFile) {
      throw new Error('Downloaded video file not found')
    }

    const videoPath = path.join(outputDir, downloadedFile)

    console.log('[yt-dlp] Download complete:', videoPath)

    return {
      videoPath,
      title: metadata.title || 'Downloaded Video',
      duration: metadata.duration || 0,
      platform: metadata.extractor || 'unknown',
    }
  } catch (error) {
    console.error('[yt-dlp] Download failed:', error)
    throw new Error(`Failed to download video: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Check if URL is supported by yt-dlp
 * Returns platform name if supported, null otherwise
 */
export function detectPlatform(url: string): string | null {
  const platforms = [
    { pattern: /facebook\.com|fb\.watch/i, name: 'Facebook' },
    { pattern: /instagram\.com/i, name: 'Instagram' },
    { pattern: /tiktok\.com/i, name: 'TikTok' },
    { pattern: /youtube\.com|youtu\.be/i, name: 'YouTube' },
    { pattern: /twitter\.com|x\.com/i, name: 'Twitter/X' },
    { pattern: /vimeo\.com/i, name: 'Vimeo' },
    { pattern: /dailymotion\.com/i, name: 'Dailymotion' },
  ]

  for (const { pattern, name } of platforms) {
    if (pattern.test(url)) {
      return name
    }
  }

  return null
}
