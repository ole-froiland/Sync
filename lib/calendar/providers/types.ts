export type CalendarProvider = 'apple' | 'microsoft' | 'google'

export type ExternalEvent = {
  id: string // globally unique, e.g. "google:<eventId>"
  title: string
  start: string // ISO 8601
  end: string // ISO 8601
  allDay: boolean
  provider: CalendarProvider
  location?: string
}

export type CalendarConnectionRow = {
  id: string
  user_id: string
  provider: CalendarProvider
  provider_account_id: string | null
  provider_account_name: string | null
  provider_email: string | null
  access_token: string | null
  refresh_token: string | null
  token_type: string | null
  scope: string | null
  expires_at: string | null
  caldav_server_url: string | null
  caldav_username: string | null
  caldav_app_password: string | null
  status: string
}
