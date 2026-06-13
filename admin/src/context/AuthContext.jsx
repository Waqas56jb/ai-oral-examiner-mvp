import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [admin, setAdmin] = useState(null) // admin_users row (null = not an admin)
  const [loading, setLoading] = useState(true)

  const loadAdmin = useCallback(async (userId) => {
    if (!userId) {
      setAdmin(null)
      return
    }
    const { data } = await supabase.from('admin_users').select('*').eq('id', userId).maybeSingle()
    setAdmin(data || null)
  }, [])

  useEffect(() => {
    let active = true
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return
      setSession(data.session)
      await loadAdmin(data.session?.user?.id)
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange(async (_e, sess) => {
      setSession(sess)
      await loadAdmin(sess?.user?.id)
    })
    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [loadAdmin])

  const signIn = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: error.message }
    // verify admin
    const { data: adminRow } = await supabase.from('admin_users').select('*').eq('id', data.user.id).maybeSingle()
    if (!adminRow) {
      await supabase.auth.signOut()
      return { error: 'This account is not an administrator.' }
    }
    setAdmin(adminRow)
    return {}
  }, [])

  const resetPassword = useCallback(async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/login',
    })
    return error ? { error: error.message } : {}
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setAdmin(null)
    setSession(null)
  }, [])

  return (
    <AuthContext.Provider value={{ session, admin, loading, signIn, resetPassword, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
