import { useEffect } from 'react'
import type { BatchProgress } from '../types'

export function useImagePreviewKeyboard(
  previewImage: string | null,
  batchProgress: BatchProgress | null,
  setPreviewImage: (url: string | null) => void,
) {
  useEffect(() => {
    if (!previewImage || !batchProgress) return

    const handleKeyDown = (e: KeyboardEvent) => {
      const completedImages = batchProgress.images.filter((img) => img.status === 'completed' && img.url)
      const currentIndex = completedImages.findIndex((img) => img.url === previewImage)

      if (e.key === 'ArrowLeft' && currentIndex > 0) {
        setPreviewImage(completedImages[currentIndex - 1].url!)
      } else if (e.key === 'ArrowRight' && currentIndex < completedImages.length - 1) {
        setPreviewImage(completedImages[currentIndex + 1].url!)
      } else if (e.key === 'Escape') {
        setPreviewImage(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [previewImage, batchProgress, setPreviewImage])
}
