// Pure list operations for local calendar blocks. Generic over { id, start } so
// they don't depend on the page's CalendarEvent type.

export function upsertEvent<T extends { id: string; start: string }>(
  events: T[],
  event: T,
): T[] {
  const exists = events.some((e) => e.id === event.id)
  const next = exists
    ? events.map((e) => (e.id === event.id ? event : e))
    : [...events, event]
  return next.sort((a, b) => +new Date(a.start) - +new Date(b.start))
}

export function removeEvent<T extends { id: string }>(events: T[], id: string): T[] {
  return events.filter((e) => e.id !== id)
}
