import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Download, FileJson, X } from 'lucide-react'
import { useImagePreviewKeyboard } from '../../hooks/useImagePreviewKeyboard'
import { assetUrl, authFetch } from '../../lib/api'
import { useGenerationStore } from '../../stores/generationStore'
import { useNavigationStore } from '../../stores/navigationStore'
import { usePromptStore } from '../../stores/promptStore'

export function ImagePreviewOverlay() {
  const previewImage = useGenerationStore((s) => s.previewImage)
  const batchProgress = useGenerationStore((s) => s.batchProgress)
  const setPreviewImage = useGenerationStore((s) => s.setPreviewImage)

  const completedBatches = useGenerationStore((s) => s.completedBatches)

  const allCompletedImages = [
    ...(batchProgress?.images.filter((img) => img.status === 'completed' && img.url) ?? []),
    ...completedBatches.flatMap((entry) => entry.batch.images.filter((img) => img.status === 'completed' && img.url)),
  ]

  useImagePreviewKeyboard(previewImage, allCompletedImages, setPreviewImage)

  const currentIndex = previewImage ? allCompletedImages.findIndex((img) => img.url === previewImage) : -1

  const sendToImageToPrompt = async (imageUrl: string) => {
    try {
      const res = await authFetch(assetUrl(imageUrl))
      const blob = await res.blob()
      const filename = imageUrl.split('/').pop() || 'generated-image.png'
      const file = new File([blob], filename, { type: blob.type })

      setPreviewImage(null)
      usePromptStore.getState().addAnalyzeFiles([file])
      useNavigationStore.getState().navigate('prompts', { promptMode: 'image' })
    } catch {
      console.error('Failed to load image for analysis')
    }
  }

  return (
    <AnimatePresence>
      {previewImage && (
        <motion.div
          role="presentation"
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 cursor-pointer"
          onClick={() => setPreviewImage(null)}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          {currentIndex > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setPreviewImage(allCompletedImages[currentIndex - 1].url!)
              }}
              className="absolute left-4 bg-black/50 hover:bg-black/70 rounded-full p-3 transition-colors z-10"
            >
              <ChevronLeft className="w-8 h-8" />
            </button>
          )}

          <motion.div
            className="relative"
            onClick={(e) => e.stopPropagation()}
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
          >
            <img
              src={assetUrl(previewImage)}
              alt="Preview"
              className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
            />
            <div className="absolute top-4 right-4 flex items-center gap-2">
              <button
                type="button"
                className="bg-success hover:bg-success-hover rounded-full p-2 transition-colors text-white"
                title="Download image"
                onClick={async (e) => {
                  e.stopPropagation()
                  const res = await fetch(assetUrl(previewImage))
                  const blob = await res.blob()
                  const blobUrl = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = blobUrl
                  a.download = previewImage.split('/').pop() || 'image.jpg'
                  document.body.appendChild(a)
                  a.click()
                  document.body.removeChild(a)
                  URL.revokeObjectURL(blobUrl)
                }}
              >
                <Download className="w-6 h-6" />
              </button>
              <button
                type="button"
                onClick={() => sendToImageToPrompt(previewImage)}
                className="bg-brand-600 hover:bg-brand-500 rounded-full p-2 transition-colors text-white"
                title="Extract prompt from image"
              >
                <FileJson className="w-6 h-6" />
              </button>
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="bg-black/50 hover:bg-black/70 rounded-full p-2 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            {currentIndex >= 0 ? (
              <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-sm text-surface-500 bg-black/50 px-3 py-1 rounded">
                {currentIndex + 1} / {allCompletedImages.length}
              </p>
            ) : (
              <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-sm text-surface-500 bg-black/50 px-3 py-1 rounded">
                Click anywhere to close
              </p>
            )}
          </motion.div>

          {currentIndex >= 0 && currentIndex < allCompletedImages.length - 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setPreviewImage(allCompletedImages[currentIndex + 1].url!)
              }}
              className="absolute right-4 bg-black/50 hover:bg-black/70 rounded-full p-3 transition-colors z-10"
            >
              <ChevronRight className="w-8 h-8" />
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
