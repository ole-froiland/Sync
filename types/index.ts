export type Profile = {
  id: string
  email: string
  name: string
  first_name: string | null
  last_name: string | null
  username: string | null
  selected_avatar: string | null
  avatar_url: string | null
  role: string | null
  tools_used: string[] | null
  onboarding_completed: boolean
  created_at: string
}

export type Invite = {
  id: string
  email: string
  token: string
  accepted: boolean
  created_by: string
  created_at: string
}

export type Project = {
  id: string
  name: string
  description: string | null
  status: 'idea' | 'building' | 'live'
  tech_stack: string[] | null
  github_url: string | null
  demo_url: string | null
  created_by: string
  created_at: string
  member_count?: number
  task_count?: number
  members?: Profile[]
}

export type ProjectMember = {
  id: string
  project_id: string
  user_id: string
  role: string
  created_at: string
  profile?: Profile
}

export type Task = {
  id: string
  project_id: string
  title: string
  description: string | null
  status: 'todo' | 'in_progress' | 'done'
  assigned_to: string | null
  created_by: string
  created_at: string
  assignee?: Profile
}

export type Post = {
  id: string
  author_id: string
  title: string
  body: string
  type: 'update' | 'news' | 'question' | 'resource'
  source_url: string | null
  created_at: string
  author?: Profile
}

export type Message = {
  id: string
  project_id: string
  sender_id: string
  body: string
  created_at: string
  sender?: Profile
}

export type JoinRequest = {
  id: string
  project_id: string
  user_id: string
  status: 'pending' | 'accepted' | 'rejected'
  created_at: string
}

export type GitHubRepo = {
  id: number
  name: string
  full_name: string
  description: string | null
  html_url: string
  stargazers_count: number
  language: string | null
  owner: {
    login: string
    avatar_url: string
  }
}

export type GitHubUserRepo = {
  id: number
  name: string
  full_name: string
  description: string | null
  private: boolean
  visibility: string
  default_branch: string
  updated_at: string
  html_url: string
  language: string | null
  fork: boolean
  archived: boolean
}

export type NewsItem = {
  id: number
  title: string
  url: string | null
  by: string
  time: number
  score: number
  descendants?: number
}

export type ModelCost = {
  model: string
  cost: string
  tier: 'low' | 'mid' | 'high'
  input: number
  output: number
}
