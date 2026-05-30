import NotesPanel from '@/components/notes/NotesPanel'

export const metadata = {
  title: 'Notes',
}

export default function NotesPage() {
  return (
    <main className="mx-auto flex h-[100dvh] w-full max-w-2xl flex-col bg-white dark:bg-gray-900">
      <NotesPanel variant="standalone" />
    </main>
  )
}
