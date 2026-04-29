'use client'

import { createContext, useContext } from 'react'

export interface GitHubStatus {
  connected: boolean
  login: string | null
}

const GitHubContext = createContext<GitHubStatus>({ connected: false, login: null })

export function GitHubProvider({
  status,
  children,
}: {
  status: GitHubStatus
  children: React.ReactNode
}) {
  return <GitHubContext.Provider value={status}>{children}</GitHubContext.Provider>
}

export function useGitHub(): GitHubStatus {
  return useContext(GitHubContext)
}
