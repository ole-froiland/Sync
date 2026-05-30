import NotesPanel from '@/components/notes/NotesPanel'

export const metadata = {
  title: 'Notes',
}

export default function NotesPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col min-h-0 bg-white dark:bg-gray-900">
      <NotesPanel variant="standalone" />
    </main>
  )
}
