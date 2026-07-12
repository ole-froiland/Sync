export type CourseProvider = 'Anthropic' | 'GitHub' | 'Microsoft' | 'OpenAI'
export type CourseCredential = 'certificate' | 'achievement' | 'course'
export type CourseLevel = 'beginner' | 'intermediate' | 'all-levels'

export interface LearningCourse {
  id: string
  provider: CourseProvider
  title: string
  description: { en: string; no: string }
  url: string
  credential: CourseCredential
  level: CourseLevel
}

export const LEARNING_COURSES: LearningCourse[] = [
  {
    id: 'anthropic-claude-code',
    provider: 'Anthropic',
    title: 'Claude Code in Action',
    description: {
      en: 'Learn the complete Claude Code workflow through practical, hands-on exercises.',
      no: 'Lær hele arbeidsflyten i Claude Code gjennom praktiske oppgaver.',
    },
    url: 'https://anthropic.skilljar.com/claude-code-in-action',
    credential: 'certificate',
    level: 'intermediate',
  },
  {
    id: 'anthropic-mcp',
    provider: 'Anthropic',
    title: 'Introduction to Model Context Protocol',
    description: {
      en: 'Build an MCP server and client, connect tools, and complete the final assessment.',
      no: 'Bygg en MCP-server og klient, koble til verktøy og fullfør sluttprøven.',
    },
    url: 'https://anthropic.skilljar.com/introduction-to-model-context-protocol',
    credential: 'certificate',
    level: 'intermediate',
  },
  {
    id: 'anthropic-api',
    provider: 'Anthropic',
    title: 'Claude with the Anthropic API',
    description: {
      en: 'Learn prompting, tool use, retrieval, multimodal inputs, and production API patterns.',
      no: 'Lær prompting, verktøybruk, søk, multimodale inndata og API-mønstre for produksjon.',
    },
    url: 'https://anthropic.skilljar.com/claude-with-the-anthropic-api',
    credential: 'certificate',
    level: 'intermediate',
  },
  {
    id: 'github-introduction',
    provider: 'GitHub',
    title: 'Introduction to GitHub',
    description: {
      en: 'Practice repositories, branches, commits, and pull requests in a real GitHub workflow.',
      no: 'Øv på repoer, grener, commits og pull requests i en ekte GitHub-arbeidsflyt.',
    },
    url: 'https://github.com/skills/introduction-to-github',
    credential: 'course',
    level: 'beginner',
  },
  {
    id: 'github-copilot',
    provider: 'GitHub',
    title: 'Getting Started with GitHub Copilot',
    description: {
      en: 'Learn how to use GitHub Copilot suggestions and chat inside your development workflow.',
      no: 'Lær å bruke forslag og chat fra GitHub Copilot i utviklingsarbeidet ditt.',
    },
    url: 'https://github.com/skills/getting-started-with-github-copilot',
    credential: 'course',
    level: 'beginner',
  },
  {
    id: 'microsoft-vscode-remote',
    provider: 'Microsoft',
    title: 'Remote Development with Visual Studio Code',
    description: {
      en: 'A six-module Microsoft Learn path for SSH, containers, WSL, and remote repositories.',
      no: 'Et Microsoft Learn-løp med seks moduler om SSH, containere, WSL og eksterne repoer.',
    },
    url: 'https://learn.microsoft.com/en-us/training/paths/remote-development-vs-code/',
    credential: 'achievement',
    level: 'beginner',
  },
  {
    id: 'openai-academy',
    provider: 'OpenAI',
    title: 'OpenAI Academy Courses',
    description: {
      en: 'Follow structured courses in AI foundations, applied AI, agents, and workflows.',
      no: 'Følg strukturerte kurs i AI-grunnlag, praktisk AI, agenter og arbeidsflyter.',
    },
    url: 'https://academy.openai.com/pages/courses',
    credential: 'certificate',
    level: 'all-levels',
  },
]
