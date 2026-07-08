import type { SupabaseClient, User } from '@supabase/supabase-js'
import type { SyncAssistantAction } from './types'

type ExecuteContext = {
  supabase: SupabaseClient
  user: User
}

export async function executeServerAssistantAction({ supabase, user }: ExecuteContext, action: SyncAssistantAction) {
  switch (action.kind) {
    case 'create_note': {
      const { data, error } = await supabase
        .from('notes')
        .insert({ title: action.title, user_id: user.id })
        .select('*')
        .single()
      if (error) throw error
      return { message: `Created note: ${action.title}`, data }
    }

    case 'complete_note': {
      const id = action.noteId || await findNoteIdByTitle(supabase, user.id, action.title)
      if (!id) throw new Error('Could not find that note.')
      const { error } = await supabase
        .from('notes')
        .update({ completed_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', user.id)
      if (error) throw error
      return { message: 'Completed note.', data: { id } }
    }

    case 'create_post': {
      const { data, error } = await supabase
        .from('posts')
        .insert({
          author_id: user.id,
          title: action.title,
          body: action.body,
          type: action.postType ?? 'update',
          source_url: action.sourceUrl ?? null,
        })
        .select('*')
        .single()
      if (error) throw error
      return { message: `Created post: ${action.title}`, data }
    }

    case 'create_project': {
      const { data, error } = await supabase
        .from('projects')
        .insert({
          name: action.name,
          description: action.description ?? null,
          status: action.status ?? 'idea',
          tech_stack: action.techStack ?? [],
          created_by: user.id,
        })
        .select('*')
        .single()
      if (error) throw error
      await supabase.from('project_members').insert({ project_id: data.id, user_id: user.id, role: 'owner' })
      return { message: `Created project: ${action.name}`, data }
    }

    case 'create_task': {
      const { data, error } = await supabase
        .from('tasks')
        .insert({
          project_id: action.projectId,
          title: action.title,
          description: action.description ?? null,
          status: action.status ?? 'todo',
          created_by: user.id,
        })
        .select('*')
        .single()
      if (error) throw error
      return { message: `Created task: ${action.title}`, data }
    }

    default:
      throw new Error('This action runs in the browser, not on the server.')
  }
}

async function findNoteIdByTitle(supabase: SupabaseClient, userId: string, title?: string) {
  if (!title) return null
  const { data } = await supabase
    .from('notes')
    .select('id')
    .eq('user_id', userId)
    .is('completed_at', null)
    .ilike('title', `%${title}%`)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data?.id ?? null
}
