import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check for participant session (localStorage)
    const participantToken = localStorage.getItem('neonpub_token')
    const participantUser = localStorage.getItem('neonpub_user')
    
    if (participantToken && participantUser) {
      try {
        setUser(JSON.parse(participantUser))
        setIsAuthenticated(true)
        setIsAdmin(false)
        setLoading(false)
        return
      } catch (e) {
        localStorage.removeItem('neonpub_token')
        localStorage.removeItem('neonpub_user')
      }
    }

    // Check Supabase session (admin)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user)
        setIsAuthenticated(true)
        checkAdmin(session.user.id)
      }
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user)
        setIsAuthenticated(true)
        checkAdmin(session.user.id)
      } else {
        // Only clear if not participant
        if (!localStorage.getItem('neonpub_token')) {
          setUser(null)
          setIsAuthenticated(false)
          setIsAdmin(false)
        }
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const checkAdmin = async (userId) => {
    const { data } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single()
    
    setIsAdmin(data?.role === 'admin')
  }

  const login = async (token, userData) => {
    // Participant login (join pub)
    localStorage.setItem('neonpub_token', token)
    localStorage.setItem('neonpub_user', JSON.stringify(userData))
    setUser(userData)
    setIsAuthenticated(true)
    setIsAdmin(false)
  }

  const logout = async () => {
    // Check if admin
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      await supabase.auth.signOut()
    }
    
    localStorage.removeItem('neonpub_token')
    localStorage.removeItem('neonpub_user')
    localStorage.removeItem('neonpub_pub_code')
    
    setUser(null)
    setIsAuthenticated(false)
    setIsAdmin(false)
  }

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, isAdmin, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
