'use client'

import { createContext, useContext } from 'react'
import type { Profile } from '@/types'

const UserContext = createContext<Profile | null>(null)

export function UserProvider({ profile, children }: { profile: Profile | null; children: React.ReactNode }) {
  return <UserContext.Provider value={profile}>{children}</UserContext.Provider>
}

export function useUser(): Profile | null {
  return useContext(UserContext)
}
