'use client'

import Modal from '@/components/ui/Modal'
import SettingsPanel from './SettingsPanel'

interface SettingsModalProps {
  open: boolean
  onClose: () => void
}

export default function SettingsModal({ open, onClose }: SettingsModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="Innstillinger" className="max-w-3xl">
      <SettingsPanel historyPath={null} className="max-w-none" />
    </Modal>
  )
}
