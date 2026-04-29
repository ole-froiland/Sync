# Sync

Private, invite-only developer workspace for small teams. A minimal mix of Notion, Linear, GitHub and Slack — but simpler.

**Stack:** Next.js 16 · TypeScript · Tailwind CSS · Supabase (auth + DB + Realtime)

---

## Features

- **Dashboard** — shared feed (posts, news, resources), quick actions, AI news & model pricing placeholders
- **Projects** — list with status filter, project cards, create flow
- **Project detail** — Kanban board (To do / In progress / Done), member list, links, discussion chat
- **Chat** — project-based channels with real-time-ready message UI
- **People** — member directory with tools, projects, activity heatmap
- **Settings** — profile editor, tool selector
- **Auth** — Google OAuth via Supabase, invite-only gate, proxy-level protection

---

## Quick start (mock data — no Supabase needed)

```bash
npm install
npm run dev        # or: node node_modules/next/dist/bin/next dev
```

Open [http://localhost:3000](http://localhost:3000). The app runs fully with mock data when Supabase env vars are not set.

---

## Full setup with Supabase

### 1. Create a Supabase project

Go to [supabase.com](https://supabase.com) → New project.

### 2. Run the schema

In the Supabase SQL editor, paste and run the contents of `supabase/schema.sql`.

### 3. Enable Google OAuth

Supabase dashboard → Authentication → Providers → Google.  
Add your Google OAuth client ID and secret.  
Set the redirect URL to: `https://your-project.supabase.co/auth/v1/callback`

In Google Cloud Console, add these authorized redirect URIs:
- `https://your-project.supabase.co/auth/v1/callback`
- `http://localhost:3000/auth/callback` (for local dev)

### 4. Configure environment variables

Copy `.env.local` and fill in your values:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### 5. Run

```bash
npm run dev
```

---

## Folder structure

```
app/
  (app)/          # authenticated app routes
    dashboard/
    projects/
      [id]/
    chat/
    people/
    settings/
  api/            # server-side API routes
    posts/
    projects/
    messages/
    invites/
  auth/callback/  # Supabase OAuth callback
  login/          # public login page

components/
  ui/             # Button, Card, Badge, Avatar, Input, Modal, Select, Textarea
  layout/         # Sidebar, TopBar, AppShell
  dashboard/      # OnboardingCard, PostCard, QuickActions, modals
  projects/       # ProjectCard, KanbanBoard, CreateProjectModal

lib/
  supabase/       # browser + server clients
  mock-data.ts    # seed data for local development
  utils.ts        # cn(), formatDate(), initials(), constants

types/
  index.ts        # Profile, Project, Task, Post, Message, etc.

supabase/
  schema.sql      # full DB schema with RLS policies
```

---

## Future integrations

Marked with `TODO:` comments in the code:

| Feature | File | Notes |
|---------|------|-------|
| GitHub API | `dashboard/page.tsx` | Trending repos, user activity |
| AI news summaries | `dashboard/page.tsx` | NewsAPI + LLM summarization |
| Model pricing | `dashboard/page.tsx` | llm.report or OpenRouter API |
| Supabase Realtime chat | `chat/page.tsx` | Subscribe to messages table |
| Invite emails | `api/invites/route.ts` | Resend or SendGrid |
| Activity tracking | `people/page.tsx` | Log actions to events table |
| AI tool usage | `people/page.tsx` | GitHub Copilot, Claude APIs |

---

## Dev notes

- Run with `npm run dev` or `node node_modules/next/dist/bin/next dev` (Next.js 16 bin path quirk)
- Build: `node node_modules/next/dist/bin/next build`
- All pages work with mock data out of the box — just swap out `MOCK_USER_ID` and `mockProfiles[0]` once Supabase auth is live
