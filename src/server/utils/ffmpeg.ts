import { spawn } from 'node:child_process'
import ffmpegStatic from 'ffmpeg-static'

const DEFAULT_FFMPEG_PATH = '/opt/homebrew/bin/ffmpeg'

export function runFfmpeg(args: string[]): Promise<void> {
  const configured = process.env.FFMPEG_PATH?.trim()
  const candidates = [configured, DEFAULT_FFMPEG_PATH, ffmpegStatic || undefined, 'ffmpeg']
    .filter((candidate): candidate is string => Boolean(candidate))
    .filter((candidate, index, list) => list.indexOf(candidate) === index)

  const runWithBinary = (binary: string): Promise<void> =>
    new Promise((resolve, reject) => {
      const proc = spawn(binary, args)
      let stderr = ''
      proc.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString()
      })
      proc.on('close', (code) => {
        if (code === 0) resolve()
        else reject(new Error(`ffmpeg failed (binary=${binary}, code ${code}): ${stderr || 'unknown error'}`))
      })
      proc.on('error', (error: Error) => {
        reject(new Error(`ffmpeg spawn failed (binary=${binary}): ${error.message}`))
      })
    })

  return candidates
    .reduce<Promise<void>>(
      (chain, binary) => chain.catch(() => runWithBinary(binary)),
      Promise.reject(new Error('ffmpeg execution not started')),
    )
    .catch((error) => {
      throw error instanceof Error ? error : new Error('ffmpeg execution failed')
    })
}
