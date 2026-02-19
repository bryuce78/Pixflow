import type { ReactElement } from 'react'
import { cloneElement, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

interface TooltipProps {
  content: string
  children: ReactElement
  side?: 'top' | 'bottom' | 'left' | 'right'
  delay?: number
  enabled?: boolean
}

interface Position {
  top: number
  left: number
}

function getPosition(rect: DOMRect, side: NonNullable<TooltipProps['side']>): Position {
  const GAP = 6
  switch (side) {
    case 'top':
      return { top: rect.top - GAP, left: rect.left + rect.width / 2 }
    case 'bottom':
      return { top: rect.bottom + GAP, left: rect.left + rect.width / 2 }
    case 'left':
      return { top: rect.top + rect.height / 2, left: rect.left - GAP }
    case 'right':
      return { top: rect.top + rect.height / 2, left: rect.right + GAP }
  }
}

const TRANSFORM: Record<NonNullable<TooltipProps['side']>, string> = {
  top: 'translate(-50%, -100%)',
  bottom: 'translate(-50%, 0)',
  left: 'translate(-100%, -50%)',
  right: 'translate(0, -50%)',
}

export function Tooltip({ content, children, side = 'top', delay = 500, enabled = true }: TooltipProps) {
  const [visible, setVisible] = useState(false)
  const [pos, setPos] = useState<Position>({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const show = () => {
    if (!enabled) return
    timerRef.current = setTimeout(() => {
      if (triggerRef.current) {
        setPos(getPosition(triggerRef.current.getBoundingClientRect(), side))
        setVisible(true)
      }
    }, delay)
  }

  const hide = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setVisible(false)
  }

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    },
    [],
  )

  const child = cloneElement(children, {
    ref: triggerRef,
    onMouseEnter: show,
    onMouseLeave: hide,
    onFocus: show,
    onBlur: hide,
  })

  return (
    <>
      {child}
      {visible &&
        createPortal(
          <span
            role="tooltip"
            style={{ position: 'fixed', top: pos.top, left: pos.left, transform: TRANSFORM[side], zIndex: 55 }}
            className="pointer-events-none whitespace-nowrap rounded bg-surface-900 border border-surface-700/50 px-2 py-1 text-xs text-surface-0 shadow-md"
          >
            {content}
          </span>,
          document.body,
        )}
    </>
  )
}
