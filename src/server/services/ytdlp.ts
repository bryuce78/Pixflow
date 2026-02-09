import path from 'node:path'
import fs from 'node:fs/promises'
import { spawn } from 'node:child_process'
import puppeteer from 'puppeteer'

export interface YtDlpDownloadResult {
  videoPath: string
  title: string
  duration: number
  platform: string
}

/**
 * Download video from URL using yt-dlp binary
 * Supports: Facebook, Instagram, TikTok, YouTube, and 1000+ sites
 */
export async function downloadVideoWithYtDlp(
  url: string,
  outputDir: string,
): Promise<YtDlpDownloadResult> {
  const timestamp = Date.now()
  // Use restrictfilenames to avoid emoji/special chars in filename
  const sanitizedFilename = `ytdlp_${timestamp}.%(ext)s`
  const outputTemplate = path.join(outputDir, sanitizedFilename)

  console.log('[yt-dlp] Downloading video from:', url)

  return new Promise((resolve, reject) => {
    // Spawn yt-dlp process
    const ytdlp = spawn('yt-dlp', [
      url,
      '--output', outputTemplate,
      '--format', 'best[ext=mp4]/best',
      '--yes-playlist', // Allow playlists (Facebook Ads Library returns playlists)
      '--max-downloads', '1', // Only download first video from playlist
      '--cookies-from-browser', 'chrome', // Use Chrome cookies for authentication
      '--restrict-filenames', // Sanitize filenames (remove emoji, special chars)
      '--print', '%(title)s|%(duration)s|%(extractor)s', // Print metadata
    ])

    let stdout = ''
    let stderr = ''
    let metadata = { title: 'Downloaded Video', duration: 0, platform: 'unknown' }

    ytdlp.stdout.on('data', (data) => {
      const output = data.toString()
      stdout += output
      console.log('[yt-dlp]', output.trim())

      // Parse metadata from print output
      const metaMatch = output.match(/^([^|]+)\|([^|]+)\|([^|]+)$/m)
      if (metaMatch) {
        metadata = {
          title: metaMatch[1].trim(),
          duration: Number.parseFloat(metaMatch[2]) || 0,
          platform: metaMatch[3].trim(),
        }
      }
    })

    ytdlp.stderr.on('data', (data) => {
      stderr += data.toString()
      console.error('[yt-dlp]', data.toString().trim())
    })

    ytdlp.on('close', async (code) => {
      if (code !== 0) {
        reject(new Error(`yt-dlp failed with code ${code}: ${stderr || 'Unknown error'}`))
        return
      }

      try {
        // Find downloaded file (exact timestamp match)
        const files = await fs.readdir(outputDir)
        const downloadedFile = files.find(
          (f) => f.startsWith(`ytdlp_${timestamp}.`) && (f.endsWith('.mp4') || f.endsWith('.webm') || f.endsWith('.mkv')),
        )

        if (!downloadedFile) {
          console.error('[yt-dlp] Downloaded file not found. Files in output dir:', files.filter(f => f.startsWith('ytdlp_')).slice(0, 5))
          reject(new Error('Downloaded video file not found'))
          return
        }

        const videoPath = path.join(outputDir, downloadedFile)
        console.log('[yt-dlp] Download complete:', videoPath)

        resolve({
          videoPath,
          ...metadata,
        })
      } catch (error) {
        reject(error)
      }
    })

    ytdlp.on('error', (error) => {
      reject(new Error(`Failed to spawn yt-dlp: ${error.message}`))
    })
  })
}

/**
 * Extract direct video URL from Facebook Ads Library page using Puppeteer
 * Opens page in headless browser, waits for JavaScript to render, then extracts video URL
 */
export async function extractFacebookAdsVideoUrl(pageUrl: string): Promise<string> {
  console.log('[fb-ads] Launching headless browser for:', pageUrl)

  let browser = null
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })

    const page = await browser.newPage()

    // Set user agent to avoid bot detection
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')

    console.log('[fb-ads] Navigating to page...')
    await page.goto(pageUrl, { waitUntil: 'networkidle2', timeout: 30000 })

    console.log('[fb-ads] Page loaded, waiting for video element...')

    // Wait for video element or timeout after 10 seconds
    await page.waitForSelector('video', { timeout: 10000 }).catch(() => {
      console.log('[fb-ads] No video element found immediately, trying to extract from page content...')
    })

    // Extract video URL from page
    const videoUrl = await page.evaluate(() => {
      // Try to find video element
      const videoElement = document.querySelector('video')
      if (videoElement?.src && videoElement.src.startsWith('http')) {
        return videoElement.src
      }

      // Try to find video source element
      const sourceElement = document.querySelector('video source')
      if (sourceElement?.src && sourceElement.src.startsWith('http')) {
        return sourceElement.src
      }

      // Try to parse from page HTML
      const html = document.documentElement.innerHTML

      // Facebook uses &amp; in HTML, so we need to match that
      const match = html.match(/https:\/\/video[^\s"'<>]+\.mp4[^\s"'<>]*/)
      if (match) {
        let url = match[0]
        // Unescape HTML entities
        url = url.replace(/&amp;/g, '&')
        url = url.replace(/&#x([0-9A-Fa-f]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
        return url
      }

      return null
    })

    await browser.close()

    if (!videoUrl) {
      throw new Error('No video URL found in Facebook Ads page. The page may require login or the ad may have been removed.')
    }

    console.log('[fb-ads] Found video URL:', videoUrl.substring(0, 80) + '...')
    return videoUrl

  } catch (error) {
    if (browser) {
      await browser.close().catch(() => {})
    }
    throw new Error(`Failed to extract video from Facebook Ads Library: ${error instanceof Error ? error.message : 'Unknown error'}`)
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

/**
 * Check if URL is a Facebook Ads Library page
 */
export function isFacebookAdsLibraryUrl(url: string): boolean {
  return /facebook\.com\/ads\/library/i.test(url)
}
