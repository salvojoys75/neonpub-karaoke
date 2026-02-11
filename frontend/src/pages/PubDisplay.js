import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '@/lib/supabase';
import api from '@/lib/api';
import { Music, Mic2, Star, Trophy, Users, MessageSquare, Clock, Disc } from 'lucide-react';

// IMPORT DEI COMPONENTI ESTERNI (Assicurati che i percorsi siano corretti)
import KaraokePlayer from '@/components/KaraokePlayer';
import QuizMediaFixed from '@/components/QuizMediaFixed';
import FloatingReactions from '@/components/FloatingReactions';

// ===========================================
// STILI CSS AVANZATI (Broadcast TV Look)
// ===========================================
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;800;900&family=JetBrains+Mono:wght@500&display=swap');
  
  :root {
    --glass-bg: rgba(15, 15, 20, 0.6);
    --glass-border: rgba(255, 255, 255, 0.1);
    --neon-accent: #d946ef; /* Fuchsia-500 */
    --neon-secondary: #0ea5e9; /* Sky-500 */
  }

  body { 
    background: #000; 
    overflow: hidden; 
    font-family: 'Montserrat', sans-serif; 
    color: white; 
  }
  
  .glass-panel {
    background: var(--glass-bg);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid var(--glass-border);
    box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.5);
  }

  /* Animazione Ticker (Scorrimento Messaggi) */
  @keyframes ticker { 
    0% { transform: translateX(100%); } 
    100% { transform: translateX(-100%); } 
  }
  .ticker-wrap { width: 100%; overflow: hidden; }
  .ticker-content { display: inline-block; white-space: nowrap; animation: ticker 25s linear infinite; }

  /* Animazione Sfondo Idle */
  @keyframes gradient-move {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }
  .animated-bg {
    background: linear-gradient(-45deg, #1e1e24, #2a1b3d, #0f172a, #000);
    background-size: 400% 400%;
    animation: gradient-move 15s ease infinite;
  }
  
  .text-glow { text-shadow: 0 0 20px rgba(217,70,239, 0.5); }
`;

// ===========================================
// SOTTO-COMPONENTI UI
// ===========================================

const TopBar = ({ pubName, logoUrl, onlineCount, msg, isMuted }) => (
  <div className="absolute top-0 left-0 right-0 h-24 z-[100] flex items-center justify-between px-8 bg-gradient-to-b from-black/90 to-transparent">
      {/* LOGO & NOME LOCALE */}
      <div className="flex items-center gap-5">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="w-16 h-16 rounded-xl border-2 border-white/20 shadow-lg object-cover" />
          ) : (
            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-fuchsia-600 to-purple-800 flex items-center justify-center border-2 border-white/20">
               <Music className="w-8 h-8 text-white" />
            </div>
          )}
          <div>
              <h1 className="text-3xl font-black text-white tracking-wider drop-shadow-md uppercase">{pubName || "NEONPUB"}</h1>
              <div className="flex items-center gap-3">
                  <span className="bg-red-600 px-2 py-0.5 rounded text-[10px] font-bold tracking-widest uppercase animate-pulse">LIVE</span>
                  {isMuted && <span className="text-red-400 text-xs font-bold uppercase tracking-wider bg-red-900/30 px-2 py-0.5 rounded">AUDIO MUTO</span>}
              </div>
          </div>
      </div>
      
      {/* MESSAGGI TICKER (Centrale) */}
      <div className="flex-1 mx-16 h-12 glass-panel rounded-full flex items-center px-4 overflow-hidden relative">
          {msg ? (
             <div className="flex items-center gap-3 text-fuchsia-300 font-bold w-full">
                 <MessageSquare className="w-5 h-5 shrink-0 text-fuchsia-500"/>
                 <span className="text-lg text-white truncate animate-in slide-in-from-bottom">{msg.text}</span>
             </div>
          ) : (
             <div className="ticker-wrap">
                 <div className="ticker-content text-white/40 text-sm font-medium uppercase tracking-widest">
                     Prenota la tua canzone scansionando il QR Code • Divertimento assicurato • NeonPub OS v2.0
                 </div>
             </div>
          )}
      </div>

      {/* ONLINE COUNT */}
      <div className="flex flex-col items-end">
          <div className="flex items-center gap-2 text-white/80">
              <Users className="w-5 h-5"/> 
              <span className="text-2xl font-mono font-bold">{onlineCount}</span>
          </div>
          <span className="text-[10px] text-white/40 uppercase tracking-widest">Partecipanti</span>
      </div>
  </div>
);

const Sidebar = ({ pubCode, queue }) => (
  <div className="absolute top-24 right-0 bottom-0 w-[350px] z-[90] flex flex-col p-4 gap-4">
      {/* QR CODE BOX */}
      <div className="glass-panel p-6 rounded-2xl flex flex-col items-center justify-center transform transition hover:scale-105 duration-500">
          <div className="bg-white p-2 rounded-xl mb-3 shadow-[0_0_30px_rgba(255,255,255,0.2)]">
              <QRCodeSVG value={`${window.location.origin}/join/${pubCode}`} size={160} level="M" />
          </div>
          <div className="text-4xl font-black text-white tracking-widest font-mono">{pubCode}</div>
          <div className="text-xs text-white/50 uppercase mt-1 font-bold tracking-wider">Scansiona per partecipare</div>
      </div>
      
      {/* QUEUE */}
      <div className="glass-panel rounded-2xl flex-1 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-white/10 bg-black/20 backdrop-blur-md sticky top-0 z-10">
              <div className="flex items-center gap-2 text-fuchsia-400 font-bold uppercase tracking-widest text-sm">
                  <Clock className="w-4 h-4"/> Prossimi Cantanti
              </div>
          </div>
          <div className="flex-1 p-3 space-y-2 overflow-y-auto">
              {queue.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-white/20 italic text-sm">
                      <Disc className="w-8 h-8 mb-2 opacity-50"/>
                      Coda vuota...
                  </div>
              ) : (
                  queue.map((req, i) => (
                      <div key={i} className="bg-white/5 p-3 rounded-xl border-l-4 border-fuchsia-600 flex items-center gap-3">
                          <div className="font-mono text-white/30 text-lg font-bold w-6">#{i+1}</div>
                          <div className="overflow-hidden">
                              <div className="text-white font-bold text-sm truncate">{req.user_nickname}</div>
                              <div className="text-white/50 text-xs truncate font-medium">{req.title}</div>
                          </div>
                      </div>
                  ))
              )}
          </div>
      </div>
  </div>
);

// --- MODALITÀ: KARAOKE ---
const KaraokeMode = ({ perf, isMuted }) => {
    return (
        <div className="w-full h-full relative">
            {/* VIDEO PLAYER (Componente Dedicato) */}
            <KaraokePlayer 
                key={perf.id} // Forza il refresh se cambia canzone
                url={perf.youtube_url}
                status={perf.status}
                volume={100}
                isMuted={isMuted}
                startedAt={perf.started_at}
            />
            
            {/* LOWER THIRD (Grafica Canzone) */}
            <div className="absolute bottom-10 left-10 right-[400px] z-[80] anim-entry">
                <div className="glass-panel p-8 rounded-3xl border-l-8 border-fuchsia-500 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <Mic2 className="w-32 h-32 text-white" />
                    </div>
                    
                    <div className="relative z-10 flex items-end gap-6">
                        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-zinc-800 to-black border-2 border-white/20 flex items-center justify-center shadow-2xl">
                             <span className="text-4xl font-bold text-white">{perf.user_nickname.substring(0,2).toUpperCase()}</span>
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center gap-3 mb-1">
                                <span className="text-xs font-bold text-fuchsia-400 uppercase tracking-widest bg-fuchsia-900/30 px-2 py-1 rounded">Now Singing</span>
                                <span className="text-2xl font-bold text-white">{perf.user_nickname}</span>
                            </div>
                            <h1 className="text-5xl font-black text-white leading-tight line-clamp-1 text-glow">{perf.song_title}</h1>
                            <h2 className="text-2xl text-white/70 font-light uppercase tracking-wide">{perf.song_artist}</h2>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- MODALITÀ: VOTAZIONE ---
const VotingMode = ({ perf }) => (
    <div className="w-full h-full flex flex-col items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-30 mix-blend-overlay"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-fuchsia-900/40 to-black"></div>
        
        <div className="relative z-10 text-center animate-in zoom-in duration-500">
            <Star className="w-48 h-48 text-yellow-400 fill-yellow-400 mx-auto mb-8 animate-bounce drop-shadow-[0_0_50px_rgba(234,179,8,0.6)]" />
            <h1 className="text-9xl font-black text-white mb-6 uppercase italic transform -skew-x-6 text-glow">VOTA ORA!</h1>
            <div className="glass-panel px-12 py-6 rounded-full inline-block">
                <p className="text-4xl text-white">Dai un voto a <strong className="text-fuchsia-400">{perf.user_nickname}</strong></p>
            </div>
        </div>
    </div>
);

// --- MODALITÀ: PUNTEGGIO ---
const ScoreMode = ({ perf }) => (
    <div className="w-full h-full flex flex-col items-center justify-center bg-black relative">
        <div className="absolute inset-0 bg-gradient-to-b from-black via-fuchsia-900/20 to-black"></div>
        <Trophy className="w-40 h-40 text-yellow-500 mb-6 relative z-10 animate-pulse" />
        <h2 className="text-4xl text-white/60 font-bold uppercase tracking-widest relative z-10">Punteggio Finale</h2>
        <div className="text-[12rem] font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 to-yellow-600 leading-none relative z-10 drop-shadow-2xl scale-110">
            {perf.average_score?.toFixed(1) || "0.0"}
        </div>
        <p className="text-2xl text-white mt-8 font-bold bg-white/10 px-6 py-2 rounded-full backdrop-blur-md relative z-10 border border-white/10">
            {perf.song_title}
        </p>
    </div>
);

// --- MODALITÀ: QUIZ ---
const QuizMode = ({ quiz, result }) => (
    <div className="w-full h-full flex flex-col bg-[#050505] relative p-12 overflow-hidden">
        {/* Usiamo QuizMediaFixed per eventuale sfondo multimediale */}
        <QuizMediaFixed mediaUrl={quiz.media_url} mediaType={quiz.media_type} isResult={!!result} />
        
        {/* Overlay gradiente per leggibilità */}
        <div className="absolute inset-0 bg-black/60 z-10 pointer-events-none"></div>

        <div className="relative z-20 flex-1 flex flex-col items-center justify-center mr-[300px]"> {/* Margin right per sidebar */}
            <div className="bg-fuchsia-600 text-white px-8 py-3 rounded-full font-black uppercase tracking-[0.3em] mb-12 shadow-[0_0_30px_rgba(217,70,239,0.5)] transform -rotate-2">
                {quiz.category || "QUIZ TIME"}
            </div>

            {result ? (
                <div className="text-center w-full max-w-5xl animate-in zoom-in duration-500">
                    <h3 className="text-3xl text-white/50 uppercase font-bold mb-6 tracking-widest">La risposta esatta era</h3>
                    <div className="bg-green-600/90 backdrop-blur-xl p-12 rounded-[3rem] mb-12 shadow-[0_0_80px_rgba(22,163,74,0.5)] border-4 border-green-400">
                        <span className="text-7xl font-black text-white">{result.correct_option}</span>
                    </div>
                    <div className="flex justify-center gap-10">
                        <div className="glass-panel p-8 rounded-2xl w-56 text-center">
                            <div className="text-5xl font-bold text-white mb-2">{result.correct_count}</div>
                            <div className="text-xs uppercase text-white/40 font-bold">Indovinato</div>
                        </div>
                        <div className="glass-panel p-8 rounded-2xl w-56 text-center">
                            <div className="text-5xl font-bold text-white mb-2">{result.total_answers}</div>
                            <div className="text-xs uppercase text-white/40 font-bold">Risposte Totali</div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="w-full max-w-6xl text-center">
                    <h1 className="text-7xl font-black text-white leading-tight mb-16 drop-shadow-2xl">{quiz.question}</h1>
                    
                    {quiz.status === 'closed' ? (
                         <div className="bg-red-600 p-10 rounded-3xl inline-block animate-pulse shadow-[0_0_50px_rgba(220,38,38,0.6)]">
                             <h2 className="text-5xl font-bold text-white uppercase italic">TEMPO SCADUTO!</h2>
                         </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-8">
                            {quiz.options.map((opt, i) => (
                                <div key={i} className="glass-panel border-l-8 border-fuchsia-600 p-8 rounded-r-2xl flex items-center gap-6 text-left transform transition hover:scale-105 duration-300">
                                    <div className="w-20 h-20 bg-black/40 rounded-xl flex items-center justify-center text-4xl font-bold text-white shrink-0 font-mono shadow-inner">
                                        {String.fromCharCode(65+i)}
                                    </div>
                                    <div className="text-4xl font-bold text-white leading-tight">{opt}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    </div>
);

// --- MODALITÀ: IDLE (In Attesa) ---
const IdleMode = ({ pub }) => (
    <div className="w-full h-full flex flex-col items-center justify-center animated-bg relative overflow-hidden">
        <div className="w-[800px] h-[800px] bg-fuchsia-600/10 rounded-full blur-[120px] absolute z-0 animate-pulse"></div>
        
        <div className="relative z-10 text-center mr-[300px]">
            {pub.logo_url ? (
                 <img src={pub.logo_url} className="w-72 h-72 rounded-[3rem] mb-10 mx-auto shadow-[0_0_60px_rgba(0,0,0,0.6)] border-4 border-white/10 object-cover" />
            ) : (
                 <Music className="w-64 h-64 text-white/10 mx-auto mb-10" />
            )}
            <h1 className="text-8xl font-black text-white tracking-tighter drop-shadow-2xl mb-6">{pub.name}</h1>
            <div className="glass-panel px-12 py-4 rounded-full inline-block">
                <span className="text-2xl text-white/80 font-bold uppercase tracking-[0.5em]">Benvenuti</span>
            </div>
        </div>
    </div>
);


// ===========================================
// MAIN COMPONENT
// ===========================================
export default function PubDisplay() {
    const { pubCode } = useParams();
    const [data, setData] = useState(null);
    const [isMuted, setIsMuted] = useState(false);
    const [quizResult, setQuizResult] = useState(null);
    const [newReaction, setNewReaction] = useState(null);

    // Caricamento Dati
    const load = useCallback(async () => {
        try {
            const res = await api.getDisplayData(pubCode);
            if(res.data) {
                setData(res.data);
                
                // Se c'è un quiz in fase di risultati, carichiamo i dettagli
                const q = res.data.active_quiz;
                if(q && (q.status === 'showing_results' || q.status === 'leaderboard')) {
                    const r = await api.getQuizResults(q.id);
                    setQuizResult(r.data);
                } else {
                    setQuizResult(null);
                }
            }
        } catch(e) { console.error(e); }
    }, [pubCode]);

    // Setup Polling e Realtime
    useEffect(() => {
        load();
        const int = setInterval(load, 3000); // Poll database ogni 3s (fallback)
        
        // Supabase Realtime per comandi istantanei
        const ch = supabase.channel('tv_ctrl')
            .on('broadcast', {event: 'control'}, p => { if(p.payload.command === 'mute') setIsMuted(p.payload.value); })
            .on('postgres_changes', {event: 'INSERT', schema: 'public', table: 'reactions'}, p => setNewReaction(p.new))
            .on('postgres_changes', {event: '*', schema: 'public', table: 'performances'}, load)
            .subscribe();
            
        return () => { clearInterval(int); supabase.removeChannel(ch); };
    }, [pubCode, load]);

    if (!data) return (
        <div className="w-screen h-screen bg-black flex flex-col items-center justify-center">
             <div className="w-16 h-16 border-4 border-fuchsia-500 border-t-transparent rounded-full animate-spin mb-4"></div>
             <div className="text-fuchsia-500 text-2xl font-bold font-mono tracking-widest animate-pulse">CARICAMENTO SISTEMA...</div>
        </div>
    );

    const { pub, current_performance: perf, queue, active_quiz: quiz, latest_message: msg, leaderboard } = data;

    // Macchina a Stati per decidere cosa mostrare
    const isQuiz = quiz && ['active', 'closed', 'showing_results'].includes(quiz.status);
    const isKaraoke = !isQuiz && perf && ['live', 'paused'].includes(perf.status);
    const isVoting = !isQuiz && perf && perf.status === 'voting';
    const isScore = !isQuiz && perf && perf.status === 'ended';
    
    let Content = null;
    if (isQuiz) Content = <QuizMode quiz={quiz} result={quizResult} />;
    else if (isVoting) Content = <VotingMode perf={perf} />;
    else if (isScore) Content = <ScoreMode perf={perf} />;
    else if (isKaraoke) Content = <KaraokeMode perf={perf} isMuted={isMuted} />;
    else Content = <IdleMode pub={pub} />;

    return (
        <div className="w-screen h-screen relative bg-black">
            <style>{STYLES}</style>
            
            {/* Background Texture Overlay */}
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 pointer-events-none z-0"></div>

            {/* LIVELLI UI */}
            <TopBar pubName={pub.name} logoUrl={pub.logo_url} onlineCount={leaderboard?.length || 0} msg={msg} isMuted={isMuted} />
            <FloatingReactions newReaction={newReaction} />
            
            <div className="w-full h-full pt-24 pb-0 relative z-10">
                {Content}
            </div>
            
            <Sidebar pubCode={pubCode} queue={queue} />
        </div>
    );
}