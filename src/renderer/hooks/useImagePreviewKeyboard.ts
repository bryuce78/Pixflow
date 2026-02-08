import { useEffect } from 'react'
import type { BatchImage } from '../types'

export function useImagePreviewKeyboard(
  previewImage: string | null,
  allCompletedImages: BatchImage[],
  setPreviewImage: (url: string | null) => void,
) {
  useEffect(() => {
    if (!previewImage || allCompletedImages.length === 0) return

    const handleKeyDown = (e: KeyboardEvent) => {
      const currentIndex = allCompletedImages.findIndex((img) => img.url === previewImage)

      if (e.key === 'ArrowLeft' && currentIndex > 0) {
        setPreviewImage(allCompletedImages[currentIndex - 1].url!)
      } else if (e.key === 'ArrowRight' && currentIndex < allCompletedImages.length - 1) {
        setPreviewImage(allCompletedImages[currentIndex + 1].url!)
      } else if (e.key === 'Escape') {
        setPreviewImage(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [previewImage, allCompletedImages, setPreviewImage])
}
