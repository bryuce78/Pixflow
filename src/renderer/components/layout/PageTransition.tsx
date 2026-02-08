import { AnimatePresence, motion } from 'framer-motion'
import type { ReactNode } from 'react'

interface PageTransitionProps {
  pageKey: string
  children: ReactNode
}

export function PageTransition({ pageKey, children }: PageTransitionProps) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pageKey}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.12 }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
