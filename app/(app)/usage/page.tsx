import TopBar from '@/components/layout/TopBar'
import UsageView from '@/components/usage/UsageView'

export const metadata = {
  title: 'Usage',
}

export default function UsagePage() {
  return (
    <>
      <TopBar title="Usage" />
      <div className="flex-1 overflow-y-auto px-6 py-8">
        <UsageView />
      </div>
    </>
  )
}
