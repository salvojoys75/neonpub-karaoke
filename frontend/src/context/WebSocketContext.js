import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const WebSocketContext = createContext()

export function WebSocketProvider({ children }) {
  const [lastMessage, setLastMessage] = useState(null)
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('neonpub_token')
    if (!token) return

    let eventId
    try {
      const data = JSON.parse(atob(token))
      eventId = data.event_id
    } catch {
      return
    }

    setIsConnected(true)

    const channel = supabase
      .channel(`event:${eventId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'song_requests', filter: `event_id=eq.${eventId}` }, 
        (payload) => setLastMessage({ type: 'queue_updated', data: payload.new }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'performances', filter: `event_id=eq.${eventId}` }, 
        (payload) => setLastMessage({ type: 'performance_updated', data: payload.new }))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reactions', filter: `event_id=eq.${eventId}` }, 
        (payload) => setLastMessage({ type: 'reaction', data: payload.new }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quizzes', filter: `event_id=eq.${eventId}` }, 
        (payload) => {
          if (payload.eventType === 'INSERT') setLastMessage({ type: 'quiz_started', data: payload.new })
          else if (payload.new.status === 'ended') setLastMessage({ type: 'quiz_ended', data: payload.new })
        })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
      setIsConnected(false)
    }
  }, [])

  return (
    <WebSocketContext.Provider value={{ lastMessage, isConnected }}>
      {children}
    </WebSocketContext.Provider>
  )
}

export const useWebSocket = () => useContext(WebSocketContext)