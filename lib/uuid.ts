// Several API routes interpolate ids into PostgREST `.or(...)` filter strings,
// where an unvalidated value could smuggle in extra filter clauses. Always
// validate route/query ids with this before using them in a filter.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(value: string): boolean {
  return UUID_RE.test(value)
}
