import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '@/lib/supabase';
import api from '@/lib/api';
import { Users, Mic2, Trophy, Volume2 } from 'lucide-react';

import KaraokePlayer from '@/components/KaraokePlayer';
import QuizMediaFixed from '@/components/QuizMediaFixed';
import FloatingReactions from '@/components/FloatingReactions';

// Stili per rendere l'interfaccia "premium"
const DISPLAY_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;700;900&display=swap');
  .display-root { font-family: 'Outfit', sans-serif; background: #000; color: white; }
  .glass-panel { background: rgba(0, 0, 0, 0.4); backdrop-filter: blur(15px); border: 1px solid rgba(255, 255, 255, 0.1); }
  .text-glow { text-shadow: 0 0 20px rgba(217, 70, 239, 0.8); }
  .animate-float { animation: floating 3s ease-in-out infinite; }
  @keyframes floating { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
`;

export default function PubDisplay() {
  const { code } = useParams();
  const [state, setState] = useState({
    pub: null,
    currentPerformance: null,
    activeQuiz: null,
    newReaction: null,
  });

  // Caricamento iniziale e Sincronizzazione Realtime
  useEffect(() => {
    const init = async () => {
      const res = await api.getDisplayData(code);
      if (res.data) {
        setState(prev => ({
          ...prev,
          pub: res.data.pub,
          currentPerformance: res.data.current_performance,
          activeQuiz: res.data.active_quiz
        }));
      }
    };
    init();

    const channel = supabase.channel(`pub_main_${code}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events', filter: `code=eq.${code?.toUpperCase()}` }, 
        p => setState(s => ({ ...s, pub: p.new })))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'performances' }, 
        p => setState(s => ({ ...s, currentPerformance: p.new })))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quizzes' }, 
        p => setState(s => ({ ...s, activeQuiz: p.new })))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reactions' }, 
        p => setState(s => ({ ...s, newReaction: p.new })))
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [code]);

  // Gestione visibilità intelligente per evitare crash
  const view = useMemo(() => {
    const isQuiz = state.activeQuiz && ['active', 'showing_results'].includes(state.activeQuiz.status);
    const isKaraoke = state.currentPerformance && ['live', 'voting'].includes(state.currentPerformance.status);
    return {
      showQuiz: isQuiz,
      showKaraoke: isKaraoke,
      isVoting: state.currentPerformance?.status === 'voting' && !isQuiz
    };
  }, [state.activeQuiz, state.currentPerformance]);

  if (!state.pub) return <div className="h-screen bg-black" />;

  return (
    <div className="display-root fixed inset-0 overflow-hidden select-none">
      <style>{DISPLAY_STYLES}</style>

      {/* 1. LAYER KARAOKE (Sempre presente, così YouTube non crasha) */}
      <div className={`absolute inset-0 transition-all duration-1000 ${
        view.showKaraoke ? 'opacity-100 scale-100' : 'opacity-0 scale-110 pointer-events-none'
      } ${view.isVoting ? 'blur-2xl opacity-40 scale-90' : ''}`}>
        {state.currentPerformance && (
          <KaraokePlayer 
            url={state.currentPerformance.song_url}
            status={state.currentPerformance.status}
            startedAt={state.currentPerformance.started_at}
          />
        )}
      </div>

      {/* 2. LAYER QUIZ (Copre il karaoke se attivo) */}
      <div className={`absolute inset-0 z-20 transition-opacity duration-700 ${
        view.showQuiz ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}>
        {state.activeQuiz && (
          <QuizMediaFixed 
            mediaUrl={state.activeQuiz.media_url} 
            mediaType={state.activeQuiz.media_type}
          />
        )}
      </div>

      {/* 3. OVERLAY VOTAZIONE (Interfaccia Accattivante) */}
      {view.isVoting && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/20 backdrop-blur-sm animate-in fade-in duration-500">
          <div className="glass-panel p-16 rounded-[4rem] text-center border-fuchsia-500/30 shadow-[0_0_100px_rgba(192,38,211,0.2)]">
            <div className="bg-fuchsia-600 px-6 py-1 rounded-full text-xs font-black tracking-widest mb-6 animate-pulse uppercase">Sistema di Voto Attivo</div>
            <h2 className="text-9xl font-black italic tracking-tighter text-glow mb-4 uppercase">VOTA ORA!</h2>
            <p className="text-3xl font-light opacity-80 uppercase tracking-[0.2em]">Dai un voto alla performance dal tuo telefono</p>
          </div>
        </div>
      )}

      {/* 4. ELEMENTI FISSI (QR Code e Info Pub) */}
      <div className="absolute inset-0 z-40 pointer-events-none">
        <FloatingReactions newReaction={state.newReaction} />
        
        <div className="absolute top-10 left-10 pointer-events-auto">
          <div className="glass-panel px-8 py-4 rounded-3xl flex items-center gap-4 border-white/5 shadow-2xl">
             <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse shadow-[0_0_10px_green]" />
             <h1 className="text-2xl font-bold uppercase tracking-tighter italic">{state.pub.name}</h1>
          </div>
        </div>

        <div className="absolute bottom-12 right-12 pointer-events-auto">
           <div className="bg-white p-5 rounded-[2.5rem] shadow-2xl transition-transform hover:scale-105 rotate-2">
             <QRCodeSVG value={`${window.location.origin}/join/${code}`} size={180} />
             <p className="text-black text-center mt-3 font-black text-[10px] tracking-tighter">SCANSIONA E GIOCA</p>
           </div>
        </div>
      </div>
    </div>
  );
}