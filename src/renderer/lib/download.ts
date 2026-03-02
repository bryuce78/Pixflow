import { assetUrl } from './api'

export async function downloadVideo(url: string, filename: string): Promise<void> {
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
}

export async function downloadAsZip(items: { url: string; filename: string }[], zipFilename: string): Promise<void> {
  if (items.length === 0) return

  if (items.length === 1) {
    const res = await fetch(assetUrl(items[0].url))
    const blob = await res.blob()
    const blobUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = items[0].filename
    a.click()
    URL.revokeObjectURL(blobUrl)
    return
  }

  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()

  await Promise.all(
    items.map(async ({ url, filename }) => {
      const res = await fetch(assetUrl(url))
      const blob = await res.blob()
      zip.file(filename, blob)
    }),
  )

  const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
  const blobUrl = URL.createObjectURL(zipBlob)
  const a = document.createElement('a')
  a.href = blobUrl
  a.download = zipFilename
  a.click()
  URL.revokeObjectURL(blobUrl)
}
