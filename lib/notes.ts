import { createClient } from '@/lib/supabase/client'
import type { Note } from '@/types/notes'

export async function listActive(): Promise<Note[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .is('completed_at', null)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Note[]
}

export async function listCompleted(): Promise<Note[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Note[]
}

export async function createNote(title: string, userId: string): Promise<Note> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('notes')
    .insert({ title, user_id: userId })
    .select('*')
    .single()
  if (error) throw error
  return data as Note
}

export async function completeNote(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('notes')
    .update({ completed_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function removeNote(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('notes').delete().eq('id', id)
  if (error) throw error
}
