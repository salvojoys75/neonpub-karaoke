import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const WebSocketContext = createContext()

export function WebSocketProvider({ children }) {
  const [lastMessage, setLastMessage] = useState(null)
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    let channel = null;

    const connect = async () => {
      let eventId = null;

      // 1. Caso Partecipante (ha il token nel localStorage)
      const token = localStorage.getItem('neonpub_token');
      if (token) {
        try {
          const data = JSON.parse(atob(token));
          eventId = data.event_id;
        } catch (e) {
          console.error("Invalid token", e);
        }
      }

      // 2. Caso Admin (non ha token, ma ha sessione Supabase)
      if (!eventId) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          // Trova l'evento attivo per questo admin
          const { data: event } = await supabase
            .from('events')
            .select('id')
            .eq('owner_id', session.user.id)
            .eq('status', 'active')
            .single();
          
          if (event) {
            eventId = event.id;
          }
        }
      }

      // Se non abbiamo trovato un Event ID, non possiamo connetterci
      if (!eventId) return;

      setIsConnected(true);
      console.log("WebSocket connecting to event:", eventId);

      channel = supabase
        .channel(`event:${eventId}`)
        // ASCOLTO RICHIESTE CANZONI
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'song_requests', filter: `event_id=eq.${eventId}` }, 
          (payload) => setLastMessage({ type: 'new_request', data: payload.new }))
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'song_requests', filter: `event_id=eq.${eventId}` }, 
          (payload) => setLastMessage({ type: 'queue_updated', data: payload.new }))
        
        // ASCOLTO PERFORMANCE
        .on('postgres_changes', { event: '*', schema: 'public', table: 'performances', filter: `event_id=eq.${eventId}` }, 
          (payload) => {
            if (payload.new.status === 'live') setLastMessage({ type: 'performance_started', data: payload.new });
            else if (payload.new.status === 'voting') setLastMessage({ type: 'voting_opened', data: payload.new });
            else if (payload.new.status === 'ended') setLastMessage({ type: 'voting_closed', data: payload.new });
            else setLastMessage({ type: 'performance_updated', data: payload.new });
          })
        
        // ASCOLTO VOTI
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'votes' }, 
          (payload) => setLastMessage({ type: 'vote_received', data: payload.new }))
        
        // ASCOLTO REAZIONI
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reactions', filter: `event_id=eq.${eventId}` }, 
          (payload) => setLastMessage({ type: 'reaction', data: payload.new }))
        
        // ASCOLTO QUIZ
        .on('postgres_changes', { event: '*', schema: 'public', table: 'quizzes', filter: `event_id=eq.${eventId}` }, 
          (payload) => {
            if (payload.eventType === 'INSERT') setLastMessage({ type: 'quiz_started', data: payload.new })
            else if (payload.new.status === 'ended') setLastMessage({ type: 'quiz_ended', data: payload.new })
          })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            setIsConnected(true);
          } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
            setIsConnected(false);
          }
        });
    };

    connect();

    return () => {
      if (channel) supabase.removeChannel(channel);
      setIsConnected(false);
    }
  }, []); // Esegue solo al mount

  return (
    <WebSocketContext.Provider value={{ lastMessage, isConnected }}>
      {children}
    </WebSocketContext.Provider>
  )
}

export const useWebSocket = () => useContext(WebSocketContext)