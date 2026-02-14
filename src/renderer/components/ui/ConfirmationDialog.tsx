import { Button } from './Button'
import { Modal } from './Modal'

interface ConfirmationDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  dangerous?: boolean
}

export function ConfirmationDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  dangerous = true,
}: ConfirmationDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p className="text-sm text-surface-500 mb-5">{description}</p>
      <div className="flex justify-end gap-3">
        <Button variant="ghost" size="sm" onClick={onClose}>
          {cancelLabel}
        </Button>
        <Button
          variant={dangerous ? 'danger' : 'primary'}
          size="sm"
          onClick={() => {
            onConfirm()
            onClose()
          }}
        >
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}
