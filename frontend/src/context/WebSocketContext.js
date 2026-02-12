import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const WebSocketContext = createContext()

export function WebSocketProvider({ children }) {
  const [lastMessage, setLastMessage] = useState(null)
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    let eventId = null
    let isAdmin = false

    // PRIORITÀ 1: Controlla se è un UTENTE (partecipante)
    const userToken = localStorage.getItem('neonpub_token')
    if (userToken) {
      try {
        const data = JSON.parse(atob(userToken))
        eventId = data.event_id
        isAdmin = false
      } catch (e) {
        console.error('Invalid user token:', e)
      }
    }

    // PRIORITÀ 2: Controlla se è ADMIN (dashboard regia)
    if (!eventId) {
      const pubCode = localStorage.getItem('neonpub_pub_code')
      if (pubCode) {
        // Per admin, dobbiamo recuperare l'event_id dal pub_code
        const fetchEventId = async () => {
          const { data } = await supabase
            .from('events')
            .select('id')
            .eq('code', pubCode.toUpperCase())
            .single()
          
          if (data?.id) {
            eventId = data.id
            isAdmin = true
            setupChannel(data.id, true)
          }
        }
        fetchEventId()
        return // Esce e aspetta il fetch asincrono
      }
    }

    // Se abbiamo un eventId da token utente, setup immediato
    if (eventId) {
      setupChannel(eventId, isAdmin)
    }

    function setupChannel(evtId, isAdminMode) {
      setIsConnected(true)

      const channel = supabase
        .channel(`event:${evtId}`)
        
        // ===== SONG REQUESTS (Karaoke) =====
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'song_requests', 
          filter: `event_id=eq.${evtId}` 
        }, (payload) => {
          console.log('🎤 Song request updated:', payload)
          setLastMessage({ 
            type: 'queue_updated', 
            data: payload.new,
            eventType: payload.eventType 
          })
        })
        
        // ===== PERFORMANCES (Karaoke live) =====
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'performances', 
          filter: `event_id=eq.${evtId}` 
        }, (payload) => {
          console.log('🎵 Performance updated:', payload)
          setLastMessage({ 
            type: 'performance_updated', 
            data: payload.new,
            eventType: payload.eventType 
          })
        })
        
        // ===== REACTIONS (Emoji) =====
        .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'reactions', 
          filter: `event_id=eq.${evtId}` 
        }, (payload) => {
          console.log('😀 Reaction:', payload)
          setLastMessage({ 
            type: 'reaction', 
            data: payload.new 
          })
        })
        
        // ===== QUIZZES =====
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'quizzes', 
          filter: `event_id=eq.${evtId}` 
        }, (payload) => {
          console.log('❓ Quiz updated:', payload)
          if (payload.eventType === 'INSERT') {
            setLastMessage({ type: 'quiz_started', data: payload.new })
          } else if (payload.eventType === 'UPDATE') {
            if (payload.new.status === 'closed') {
              setLastMessage({ type: 'quiz_closed', data: payload.new })
            } else if (payload.new.status === 'showing_results') {
              setLastMessage({ type: 'quiz_results', data: payload.new })
            } else if (payload.new.status === 'leaderboard') {
              setLastMessage({ type: 'quiz_leaderboard', data: payload.new })
            } else if (payload.new.status === 'ended') {
              setLastMessage({ type: 'quiz_ended', data: payload.new })
            }
          }
        })
        
        // ===== QUIZ ANSWERS (per aggiornare contatori) =====
        .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'quiz_answers', 
          filter: `quiz_id=eq.${evtId}` // Nota: qui potrebbe servire filtro diverso
        }, (payload) => {
          console.log('✅ Quiz answer:', payload)
          setLastMessage({ 
            type: 'quiz_answer_submitted', 
            data: payload.new 
          })
        })
        
        // ===== MESSAGES (Chat/Moderazione) =====
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'messages', 
          filter: `event_id=eq.${evtId}` 
        }, (payload) => {
          console.log('💬 Message updated:', payload)
          if (payload.eventType === 'INSERT') {
            setLastMessage({ 
              type: 'message_received', 
              data: payload.new 
            })
          } else if (payload.eventType === 'UPDATE') {
            setLastMessage({ 
              type: 'message_updated', 
              data: payload.new 
            })
          } else if (payload.eventType === 'DELETE') {
            setLastMessage({ 
              type: 'message_deleted', 
              data: payload.old 
            })
          }
        })
        
        // ===== VOTES (Voti per performance) =====
        .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'votes', 
          filter: `performance_id=eq.${evtId}` // Nota: filtro per performance
        }, (payload) => {
          console.log('⭐ Vote submitted:', payload)
          setLastMessage({ 
            type: 'vote_submitted', 
            data: payload.new 
          })
        })
        
        // ===== PARTICIPANTS (per leaderboard) =====
        .on('postgres_changes', { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'participants', 
          filter: `event_id=eq.${evtId}` 
        }, (payload) => {
          console.log('👤 Participant updated:', payload)
          setLastMessage({ 
            type: 'participant_updated', 
            data: payload.new 
          })
        })
        
        // ===== EVENTS (per cambio modulo/stato) =====
        .on('postgres_changes', { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'events', 
          filter: `id=eq.${evtId}` 
        }, (payload) => {
          console.log('🎪 Event updated:', payload)
          setLastMessage({ 
            type: 'event_updated', 
            data: payload.new 
          })
        })

      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`✅ WebSocket subscribed to event ${evtId} (${isAdminMode ? 'ADMIN' : 'USER'})`)
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ WebSocket channel error')
          setIsConnected(false)
        } else if (status === 'TIMED_OUT') {
          console.error('⏱️ WebSocket timed out')
          setIsConnected(false)
        }
      })

      // Cleanup
      return () => {
        console.log('🔌 Disconnecting WebSocket')
        supabase.removeChannel(channel)
        setIsConnected(false)
      }
    }

  }, []) // Empty deps - runs once on mount

  return (
    <WebSocketContext.Provider value={{ lastMessage, isConnected }}>
      {children}
    </WebSocketContext.Provider>
  )
}

export const useWebSocket = () => useContext(WebSocketContext)