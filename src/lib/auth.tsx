import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { Profile } from './types'

type AuthCtx = {
  session: Session | null
  profile: Profile | null
  loading: boolean
  isEditor: boolean
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const Ctx = createContext<AuthCtx>(null!)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [sessionLoaded, setSessionLoaded] = useState(false)
  const [profileLoaded, setProfileLoaded] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setSessionLoaded(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  const loadProfile = useCallback(async (userId: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
    setProfile((data as Profile | null) ?? null)
    setProfileLoaded(true)
  }, [])

  const userId = session?.user?.id
  useEffect(() => {
    if (!userId) {
      setProfile(null)
      setProfileLoaded(true)
      return
    }
    setProfileLoaded(false)
    loadProfile(userId)
  }, [userId, loadProfile])

  const value: AuthCtx = {
    session,
    profile,
    loading: !sessionLoaded || (!!session && !profileLoaded),
    isEditor: profile?.role === 'editor',
    signOut: async () => {
      await supabase.auth.signOut()
      // next login should start on the dashboard, not whatever page was open
      history.replaceState(null, '', import.meta.env.BASE_URL)
    },
    refreshProfile: async () => {
      if (userId) await loadProfile(userId)
    },
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useAuth = () => useContext(Ctx)
