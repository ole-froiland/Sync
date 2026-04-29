import type { Profile, Project, Post, Message, Task } from '@/types'

export const mockProfiles: Profile[] = [
  {
    id: 'user-1',
    email: 'alex@example.com',
    name: 'Alex Strand',
    avatar_url: null,
    role: 'Full-stack developer',
    tools_used: ['Claude', 'Cursor', 'GitHub', 'Figma'],
    created_at: '2024-01-10T10:00:00Z',
  },
  {
    id: 'user-2',
    email: 'mia@example.com',
    name: 'Mia Berg',
    avatar_url: null,
    role: 'Designer & frontend',
    tools_used: ['Figma', 'Claude', 'Cursor'],
    created_at: '2024-01-12T10:00:00Z',
  },
  {
    id: 'user-3',
    email: 'jonas@example.com',
    name: 'Jonas Lie',
    avatar_url: null,
    role: 'Backend engineer',
    tools_used: ['GitHub', 'Codex', 'Claude'],
    created_at: '2024-01-15T10:00:00Z',
  },
  {
    id: 'user-4',
    email: 'sara@example.com',
    name: 'Sara Dahl',
    avatar_url: null,
    role: 'Product & growth',
    tools_used: ['Figma', 'Claude', 'GitHub'],
    created_at: '2024-01-18T10:00:00Z',
  },
]

export const mockProjects: Project[] = [
  {
    id: 'proj-1',
    name: 'Sync',
    description: 'Private workspace for developers. The app you\'re looking at right now.',
    status: 'building',
    tech_stack: ['Next.js', 'TypeScript', 'Supabase', 'Tailwind'],
    github_url: 'https://github.com/ole-froiland/Sync',
    demo_url: null,
    created_by: 'user-1',
    created_at: '2024-02-01T10:00:00Z',
    member_count: 4,
    task_count: 8,
    members: mockProfiles,
  },
  {
    id: 'proj-2',
    name: 'DevPulse',
    description: 'AI-curated developer news feed with model pricing comparisons.',
    status: 'idea',
    tech_stack: ['React', 'Node.js', 'OpenAI API'],
    github_url: null,
    demo_url: null,
    created_by: 'user-2',
    created_at: '2024-02-10T10:00:00Z',
    member_count: 2,
    task_count: 3,
    members: [mockProfiles[1], mockProfiles[2]],
  },
  {
    id: 'proj-3',
    name: 'PortfolioKit',
    description: 'One-click portfolio generator for developers using GitHub data.',
    status: 'live',
    tech_stack: ['Next.js', 'GitHub API', 'Vercel'],
    github_url: 'https://github.com/example/portfoliokit',
    demo_url: 'https://portfoliokit.vercel.app',
    created_by: 'user-3',
    created_at: '2024-01-20T10:00:00Z',
    member_count: 3,
    task_count: 2,
    members: [mockProfiles[0], mockProfiles[2], mockProfiles[3]],
  },
]

export const mockPosts: Post[] = [
  {
    id: 'post-1',
    author_id: 'user-1',
    title: 'Claude 4 Opus is now available — pricing & benchmarks',
    body: 'Anthropic just dropped Claude 4 Opus. Context window expanded to 200k tokens, with significant improvements on coding benchmarks. Extended thinking mode is now faster and cheaper.',
    type: 'news',
    source_url: 'https://anthropic.com',
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    author: mockProfiles[0],
  },
  {
    id: 'post-2',
    author_id: 'user-2',
    title: 'Shipped: first version of the Sync dashboard',
    body: 'Got the core layout and dashboard working tonight. Feed, quick actions and sidebar all in. Next up: Projects page and Kanban board.',
    type: 'update',
    source_url: null,
    created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
    author: mockProfiles[1],
  },
  {
    id: 'post-3',
    author_id: 'user-3',
    title: 'GitHub now shows Copilot usage stats per repo',
    body: 'Useful for teams tracking AI tool adoption. Settings > Copilot > Analytics. Could be worth integrating into Sync for activity tracking.',
    type: 'resource',
    source_url: 'https://github.com',
    created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
    author: mockProfiles[2],
  },
  {
    id: 'post-4',
    author_id: 'user-4',
    title: 'Question: best approach for real-time with Supabase?',
    body: 'We need real-time chat in Sync. Supabase Realtime looks solid. Anyone tried it at scale? Is there a better option we should consider?',
    type: 'question',
    source_url: null,
    created_at: new Date(Date.now() - 3600000 * 30).toISOString(),
    author: mockProfiles[3],
  },
]

export const mockTasks: Task[] = [
  { id: 't-1', project_id: 'proj-1', title: 'Set up Supabase schema', description: null, status: 'done', assigned_to: 'user-1', created_by: 'user-1', created_at: '2024-02-01T10:00:00Z', assignee: mockProfiles[0] },
  { id: 't-2', project_id: 'proj-1', title: 'Build auth flow with Google login', description: null, status: 'done', assigned_to: 'user-1', created_by: 'user-1', created_at: '2024-02-02T10:00:00Z', assignee: mockProfiles[0] },
  { id: 't-3', project_id: 'proj-1', title: 'Dashboard layout and feed', description: null, status: 'in_progress', assigned_to: 'user-2', created_by: 'user-1', created_at: '2024-02-03T10:00:00Z', assignee: mockProfiles[1] },
  { id: 't-4', project_id: 'proj-1', title: 'Projects page with Kanban', description: null, status: 'in_progress', assigned_to: 'user-1', created_by: 'user-1', created_at: '2024-02-04T10:00:00Z', assignee: mockProfiles[0] },
  { id: 't-5', project_id: 'proj-1', title: 'Chat with Supabase Realtime', description: null, status: 'todo', assigned_to: 'user-3', created_by: 'user-1', created_at: '2024-02-05T10:00:00Z', assignee: mockProfiles[2] },
  { id: 't-6', project_id: 'proj-1', title: 'People directory page', description: null, status: 'todo', assigned_to: 'user-2', created_by: 'user-1', created_at: '2024-02-06T10:00:00Z', assignee: mockProfiles[1] },
  { id: 't-7', project_id: 'proj-1', title: 'Invite system', description: null, status: 'todo', assigned_to: null, created_by: 'user-1', created_at: '2024-02-07T10:00:00Z' },
  { id: 't-8', project_id: 'proj-1', title: 'Mobile responsive polish', description: null, status: 'todo', assigned_to: null, created_by: 'user-1', created_at: '2024-02-08T10:00:00Z' },
]

export const mockMessages: Message[] = [
  { id: 'm-1', project_id: 'proj-1', sender_id: 'user-1', body: 'Just pushed the sidebar component. Looks pretty clean with the indigo accents.', created_at: new Date(Date.now() - 3600000 * 3).toISOString(), sender: mockProfiles[0] },
  { id: 'm-2', project_id: 'proj-1', sender_id: 'user-2', body: 'Nice! I made some tweaks to the card spacing. Check the latest commit.', created_at: new Date(Date.now() - 3600000 * 2.5).toISOString(), sender: mockProfiles[1] },
  { id: 'm-3', project_id: 'proj-1', sender_id: 'user-3', body: 'Should we wire up the Supabase Realtime for chat first or finish the Kanban?', created_at: new Date(Date.now() - 3600000 * 1.5).toISOString(), sender: mockProfiles[2] },
  { id: 'm-4', project_id: 'proj-1', sender_id: 'user-1', body: 'Kanban first — we need it for the demo. Then Realtime.', created_at: new Date(Date.now() - 3600000 * 1).toISOString(), sender: mockProfiles[0] },
  { id: 'm-5', project_id: 'proj-1', sender_id: 'user-4', body: 'Agreed. Also — should we add a "request access" flow for the invite page?', created_at: new Date(Date.now() - 1800000).toISOString(), sender: mockProfiles[3] },
]

// Future integration points:
// - GitHub API: fetch trending repos, user activity, PR status
// - AI news: NewsAPI or RSS feeds with LLM summaries
// - Model pricing: fetch from LLM pricing APIs (e.g., llm.report)
// - Activity tracking: log user actions to a separate events table
// - AI tool usage: aggregate from GitHub Copilot, Claude usage APIs
