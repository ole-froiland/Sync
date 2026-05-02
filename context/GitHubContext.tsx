'use client'

import { createContext, useContext, useState, useCallback } from 'react'

export interface GitHubStatus {
  connected: boolean
  login: string | null
}

interface GitHubContextValue extends GitHubStatus {
  refresh: () => Promise<void>
}

const GitHubContext = createContext<GitHubContextValue>({
  connected: false,
  login: null,
  refresh: async () => {},
})

export function GitHubProvider({
  status,
  children,
}: {
  status: GitHubStatus
  children: React.ReactNode
}) {
  const [current, setCurrent] = useState<GitHubStatus>(status)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/github/status')
      if (!res.ok) return
      const data = await res.json()
      setCurrent({ connected: data.connected ?? false, login: data.login ?? null })
    } catch {
      // ignore network errors — keep current state
    }
  }, [])

  return (
    <GitHubContext.Provider value={{ ...current, refresh }}>
      {children}
    </GitHubContext.Provider>
  )
}

export function useGitHub(): GitHubContextValue {
  return useContext(GitHubContext)
}
