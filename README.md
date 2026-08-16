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

### 3. Enable GitHub OAuth

Supabase dashboard → Authentication → Providers → GitHub.
Add your GitHub OAuth client ID and secret.
Set the redirect URL to: `https://your-project.supabase.co/auth/v1/callback`

In Supabase Authentication → URL Configuration, add these redirect URLs:
- `https://sync-co-op.netlify.app/auth/callback` (production)
- `http://localhost:3000/auth/callback` (local dev)

In GitHub Developer Settings, set the OAuth app callback URL to:
- `https://your-project.supabase.co/auth/v1/callback`

### 4. Configure environment variables

Copy `.env.local` and fill in your values:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
# Production: NEXT_PUBLIC_SITE_URL=https://sync-co-op.netlify.app
```

### 5. Run

```bash
npm run dev
```

### 6. Seed the Elias test user

Create or update a fake member account for login and People/follow testing:

```bash
npm run seed:test-user
```

This script touches only:

- `Elias Nilsen`
- `eliasn`
- `elias.test@syncapp.dev`
- `Test1234!`

It creates the Supabase auth user, confirms the email, and upserts the matching `profiles` row.

---

## Sync MCP for Claude and ChatGPT

MCP (Model Context Protocol) is a shared standard that lets AI clients use Sync as a set of
authenticated tools. The same remote endpoint works with Claude and compatible ChatGPT plans:

```text
https://your-sync-domain.example/api/mcp
```

The first version exposes:

- project and folder overview
- list/get/create projects
- list/create project folders and subfolders
- list/create project tasks

There are deliberately no delete tools. Every request uses the connected user's Supabase OAuth
token, so existing Row Level Security policies still decide what the user can read or change.

### 1. Enable Supabase OAuth 2.1

In the Supabase dashboard:

1. Open **Authentication → OAuth Server** and enable the OAuth 2.1 server.
2. Set **Authorization Path** to `/oauth/consent`.
3. Enable **Dynamic Client Registration** so MCP clients can register automatically.
4. Use an asymmetric JWT signing key (RS256 or ES256), which Supabase requires for the `openid`
   scope.
5. Confirm that the Supabase **Site URL** and `NEXT_PUBLIC_SITE_URL` both use the deployed Sync
   HTTPS origin.

The app serves OAuth protected-resource metadata at:

```text
https://your-sync-domain.example/.well-known/oauth-protected-resource
```

### 2. Deploy and test

Deploy Sync to a stable HTTPS URL, then test the endpoint with the official inspector:

```bash
npm run dev
npx @modelcontextprotocol/inspector
```

Choose **Streamable HTTP** and enter `http://localhost:3000/api/mcp` for local testing, or the
deployed endpoint for an end-to-end OAuth test.

### 3. Connect an AI client

- **Claude:** Settings → Connectors → Add custom connector → paste the `/api/mcp` URL.
- **ChatGPT:** enable developer mode for your workspace, create a custom MCP app, paste the
  `/api/mcp` URL, choose OAuth, and scan the tools.

Both clients redirect to Sync's consent page, where the user approves access before tools become
available.

Current setup references:

- [Supabase MCP authentication](https://supabase.com/docs/guides/auth/oauth-server/mcp-authentication)
- [Claude remote MCP connectors](https://support.anthropic.com/en/articles/11503834-building-custom-integrations-via-remote-mcp-servers)
- [OpenAI MCP server guide](https://developers.openai.com/plugins/build/mcp-server)

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
