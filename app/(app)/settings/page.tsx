'use client'

import TopBar from '@/components/layout/TopBar'
import SettingsPanel from '@/components/settings/SettingsPanel'

export default function SettingsPage() {
  return (
    <>
      <TopBar title="Settings" />
      <SettingsPanel className="flex-1 overflow-y-auto px-6 py-6" />
    </>
  )
}
