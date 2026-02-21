import { Trash2 } from 'lucide-react'
import { useCallback } from 'react'
import { useComposeStore } from '../../stores/composeStore'
import { DropZone } from '../ui/DropZone'

const ACCEPT = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'video/mp4': ['.mp4'],
  'video/webm': ['.webm'],
  'video/quicktime': ['.mov'],
}

function AssetCard({
  asset,
  onAdd,
  onRemove,
  onDragStart,
}: {
  asset: { id: string; name: string; mediaUrl: string; mediaType: 'image' | 'video' }
  onAdd: () => void
  onRemove: () => void
  onDragStart: (e: React.DragEvent) => void
}) {
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: asset grid is mouse-driven
    // biome-ignore lint/a11y/noStaticElementInteractions: asset card handles click-to-add
    <div
      draggable
      onDragStart={onDragStart}
      className="group relative rounded-lg overflow-hidden bg-surface-100 cursor-pointer aspect-square"
      onClick={onAdd}
      title={`${asset.name} — click to add as layer`}
    >
      {asset.mediaType === 'image' ? (
        <img src={asset.mediaUrl} alt="" className="w-full h-full object-cover" />
      ) : (
        <video src={asset.mediaUrl} className="w-full h-full object-cover" muted preload="auto" playsInline />
      )}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onRemove()
        }}
        className="absolute top-1 right-1 p-1 rounded bg-black/50 text-white opacity-0 group-hover:opacity-100 transition"
      >
        <Trash2 className="w-3 h-3" />
      </button>
      <div className="absolute bottom-0 inset-x-0 bg-black/60 px-1 py-0.5">
        <span className="text-[10px] text-white truncate block">{asset.name}</span>
      </div>
    </div>
  )
}

export function AssetsPanel() {
  const assets = useComposeStore((s) => s.assets)
  const addAsset = useComposeStore((s) => s.addAsset)
  const addLayerFromAsset = useComposeStore((s) => s.addLayerFromAsset)
  const removeAsset = useComposeStore((s) => s.removeAsset)

  const handleDrop = useCallback(
    (files: File[]) => {
      for (const file of files) void addAsset(file)
    },
    [addAsset],
  )

  const handleDragStart = useCallback((e: React.DragEvent, assetId: string) => {
    e.dataTransfer.setData('application/x-compose-asset', assetId)
    e.dataTransfer.effectAllowed = 'copy'
  }, [])

  return (
    <div className="space-y-3">
      <DropZone accept={ACCEPT} onDrop={handleDrop}>
        <p className="text-sm text-surface-400">Drop images or videos here, or click to browse</p>
      </DropZone>

      {assets.length > 0 && (
        <div className="grid grid-cols-10 gap-1">
          {assets.map((asset) => (
            <AssetCard
              key={asset.id}
              asset={asset}
              onAdd={() => addLayerFromAsset(asset.id)}
              onRemove={() => removeAsset(asset.id)}
              onDragStart={(e) => handleDragStart(e, asset.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
