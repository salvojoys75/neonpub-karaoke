import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '@/lib/supabase';
import api from '@/lib/api';
import { Music, Mic2, Star, Trophy, Users, MessageSquare, Clock, Disc, Zap } from 'lucide-react';

// IMPORT DEI COMPONENTI ESTERNI
import KaraokePlayer from '@/components/KaraokePlayer';
import QuizMediaFixed from '@/components/QuizMediaFixed';
import FloatingReactions from '@/components/FloatingReactions';

// ===========================================
// STILI CSS (Broadcast TV Look)
// ===========================================
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;800;900&family=JetBrains+Mono:wght@500&display=swap');
  
  :root {
    --glass-bg: rgba(15, 15, 20, 0.7);
    --glass-border: rgba(255, 255, 255, 0.1);
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

  /* Animazione Ticker Messaggi */
  @keyframes ticker { 
    0% { transform: translateX(100%); } 
    100% { transform: translateX(-100%); } 
  }
  .ticker-wrap { width: 100%; overflow: hidden; }
  .ticker-content { display: inline-block; white-space: nowrap; animation: ticker 25s linear infinite; }

  /* Sfondo Animato */
  @keyframes gradient-move {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }
  .animated-bg {
    background: linear-gradient(-45deg, #101010, #1a0b2e, #0f172a, #000);
    background-size: 400% 400%;
    animation: gradient-move 20s ease infinite;
  }
  
  .text-glow { text-shadow: 0 0 30px rgba(217,70,239, 0.6); }
`;

// ===========================================
// SOTTO-COMPONENTI UI
// ===========================================

const TopBar = ({ pubName, logoUrl, onlineCount, messages, isMuted }) => {
  const [currentMsgIndex, setCurrentMsgIndex] = React.useState(0);
  
  // Rotate messages every 5 seconds
  React.useEffect(() => {
    if (!messages || messages.length === 0) return;
    const interval = setInterval(() => {
      setCurrentMsgIndex(prev => (prev + 1) % messages.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [messages]);
  
  const currentMsg = messages && messages.length > 0 ? messages[currentMsgIndex] : null;
  
  return (
  <div className="absolute top-0 left-0 right-0 h-24 z-[100] flex items-center justify-between px-8 bg-gradient-to-b from-black/90 via-black/60 to-transparent">
      {/* LOGO & INFO */}
      <div className="flex items-center gap-5">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="w-16 h-16 rounded-xl border-2 border-white/20 shadow-lg object-cover bg-black" />
          ) : (
            <div className="w-16 h-16 rounded-xl bg-fuchsia-600 flex items-center justify-center border-2 border-white/20 shadow-lg font-black text-xl">NP</div>
          )}
          <div>
              <h1 className="text-3xl font-black text-white tracking-wider drop-shadow-md uppercase">{pubName || "NEONPUB"}</h1>
              <div className="flex items-center gap-3">
                  <span className="bg-red-600 px-2 py-0.5 rounded text-[10px] font-bold tracking-widest uppercase animate-pulse shadow-[0_0_10px_red]">LIVE</span>
                  {isMuted && <span className="text-white bg-red-900 px-2 py-0.5 rounded text-[10px] font-bold tracking-widest border border-red-500">AUDIO OFF</span>}
              </div>
          </div>
      </div>
      
      {/* TICKER MESSAGGI - UNO ALLA VOLTA */}
      <div className="flex-1 mx-16 h-14 glass-panel rounded-full flex items-center px-4 overflow-hidden relative">
          {currentMsg ? (
             <div className="w-full overflow-hidden">
                 <div 
                   key={currentMsgIndex}
                   className="flex items-center gap-3 animate-slide-left"
                 >
                     <MessageSquare className="w-5 h-5 text-fuchsia-400 shrink-0"/>
                     <span className="text-sm text-fuchsia-300 font-bold shrink-0">{currentMsg.nickname}:</span>
                     <span className="text-lg text-white font-medium">{currentMsg.text}</span>
                 </div>
             </div>
          ) : (
             <div className="ticker-wrap">
                 <div className="ticker-content text-white/40 text-sm font-medium uppercase tracking-widest flex items-center gap-8">
                     <span>🎵 Prenota la tua canzone</span>
                     <span>📸 Carica il tuo avatar</span>
                     <span>🏆 Scala la classifica</span>
                     <span>📱 Scansiona il QR Code</span>
                     <span>🎵 Prenota la tua canzone</span>
                     <span>📸 Carica il tuo avatar</span>
                     <span>🏆 Scala la classifica</span>
                     <span>📱 Scansiona il QR Code</span>
                 </div>
             </div>
          )}
      </div>

      {/* ONLINE COUNT */}
      <div className="flex flex-col items-end">
          <div className="glass-panel px-4 py-2 rounded-xl flex items-center gap-3">
              <Users className="w-5 h-5 text-fuchsia-400"/> 
              <span className="text-2xl font-mono font-bold">{onlineCount}</span>
          </div>
      </div>
      
      <style jsx>{`
        @keyframes slide-left {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .animate-slide-left {
          animation: slide-left 0.8s ease-out;
        }
      `}</style>
  </div>
);};

const Sidebar = ({ pubCode, queue, leaderboard }) => (
  <div className="absolute top-28 right-6 bottom-6 w-[350px] z-[90] flex flex-col gap-6">
      {/* QR CODE BOX */}
      <div className="glass-panel p-6 rounded-3xl flex flex-col items-center justify-center relative overflow-hidden">
          <div className="absolute inset-0 bg-fuchsia-600/10 blur-xl"></div>
          <div className="bg-white p-3 rounded-2xl mb-4 shadow-2xl relative z-10">
              <QRCodeSVG value={`${window.location.origin}/join/${pubCode}`} size={180} level="M" />
          </div>
          <div className="text-5xl font-black text-white tracking-widest font-mono drop-shadow-xl relative z-10">{pubCode}</div>
          <div className="text-xs text-white/60 uppercase mt-2 font-bold tracking-[0.2em] relative z-10">Scansiona per entrare</div>
      </div>
      
      {/* CODA */}
      <div className="glass-panel rounded-3xl flex flex-col overflow-hidden relative" style={{maxHeight: '45%'}}>
          <div className="p-5 border-b border-white/10 bg-black/40 backdrop-blur-md sticky top-0 z-10">
              <div className="flex items-center gap-2 text-fuchsia-400 font-black uppercase tracking-widest text-sm">
                  <Clock className="w-4 h-4"/> Prossimi Cantanti
              </div>
          </div>
          <div className="flex-1 p-4 space-y-3 overflow-y-auto custom-scrollbar">
              {queue.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-white/20 italic text-sm">
                      <Disc className="w-10 h-10 mb-4 opacity-30 animate-spin-slow"/>
                      Coda vuota...
                  </div>
              ) : (
                  queue.slice(0, 5).map((req, i) => (
                      <div key={i} className="bg-white/5 p-3 rounded-2xl border-l-4 border-fuchsia-600 flex items-center gap-4">
                          <div className="font-mono text-white/30 text-xl font-bold w-6">#{i+1}</div>
                          <img src={req.user_avatar} className="w-10 h-10 rounded-full bg-zinc-800 object-cover border border-white/10" alt="avatar" />
                          <div className="overflow-hidden">
                              <div className="text-white font-bold text-sm truncate">{req.user_nickname}</div>
                              <div className="text-white/50 text-xs truncate font-medium">{req.title}</div>
                          </div>
                      </div>
                  ))
              )}
          </div>
      </div>

      {/* CLASSIFICA */}
      <div className="glass-panel rounded-3xl flex flex-col overflow-hidden relative flex-1">
          <div className="p-5 border-b border-white/10 bg-black/40 backdrop-blur-md sticky top-0 z-10">
              <div className="flex items-center gap-2 text-yellow-400 font-black uppercase tracking-widest text-sm">
                  <Trophy className="w-4 h-4"/> Classifica Quiz
              </div>
          </div>
          <div className="flex-1 p-4 space-y-2 overflow-y-auto custom-scrollbar">
              {!leaderboard || leaderboard.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-white/20 italic text-sm">
                      <Trophy className="w-10 h-10 mb-4 opacity-30"/>
                      Nessun punteggio
                  </div>
              ) : (
                  leaderboard.slice(0, 10).map((player, i) => (
                      <div key={i} className={`p-2.5 rounded-xl flex items-center gap-3 ${
                          i === 0 ? 'bg-yellow-500/20 border border-yellow-500/30' :
                          i === 1 ? 'bg-zinc-400/10 border border-zinc-400/20' :
                          i === 2 ? 'bg-amber-700/10 border border-amber-700/20' :
                          'bg-white/5'
                      }`}>
                          <div className={`font-mono font-bold w-6 text-center ${
                              i === 0 ? 'text-yellow-400 text-lg' :
                              i === 1 ? 'text-zinc-300' :
                              i === 2 ? 'text-amber-600' :
                              'text-white/40 text-sm'
                          }`}>
                              {i+1}
                          </div>
                          <img src={player.avatar} className="w-8 h-8 rounded-full bg-zinc-800 object-cover border border-white/10" alt="avatar" />
                          <div className="flex-1 truncate">
                              <div className="text-white font-bold text-sm truncate">{player.nickname}</div>
                          </div>
                          <div className="font-mono text-cyan-400 font-bold text-sm">{player.score || 0}</div>
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
            {/* VIDEO PLAYER */}
            <div className="absolute inset-0 right-[380px] bg-black">
                <KaraokePlayer 
                    key={perf.id} 
                    url={perf.youtube_url}
                    status={perf.status}
                    volume={100}
                    isMuted={isMuted}
                    startedAt={perf.started_at}
                />
            </div>
            
            {/* LOWER THIRD (Banner Cantante) - RIDOTTO */}
            <div className="absolute bottom-8 left-8 right-[420px] z-[80] anim-entry">
                <div className="glass-panel p-4 rounded-xl border-l-8 border-fuchsia-500 relative overflow-hidden flex items-end gap-4 shadow-[0_0_50px_rgba(0,0,0,0.8)]">
                    
                    {/* Avatar Ridotto */}
                    <div className="relative">
                        <div className="absolute inset-0 bg-fuchsia-500 blur-xl opacity-50 rounded-full"></div>
                        <img src={perf.user_avatar} className="w-16 h-16 rounded-full border-2 border-white/20 object-cover relative z-10 bg-zinc-900 shadow-2xl" alt="Singer" />
                        <div className="absolute -bottom-1 -right-1 bg-red-600 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full z-20 border border-white/20">LIVE</div>
                    </div>

                    <div className="flex-1 pb-1">
                        <div className="flex items-center gap-2 mb-1">
                            <Mic2 className="w-4 h-4 text-fuchsia-400" />
                            <span className="text-lg font-bold text-white">{perf.user_nickname}</span>
                        </div>
                        <h1 className="text-3xl font-black text-white leading-none line-clamp-1 text-glow mb-0.5">{perf.song_title}</h1>
                        <h2 className="text-xl text-white/60 font-light uppercase tracking-wide">{perf.song_artist}</h2>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- MODALITÀ: VOTAZIONE ---
const VotingMode = ({ perf }) => (
    <div className="w-full h-full flex flex-col items-center justify-center relative overflow-hidden bg-black">
        <div className="absolute inset-0 bg-fuchsia-900/30 animate-pulse"></div>
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-30 mix-blend-overlay"></div>
        
        <div className="relative z-10 text-center animate-in zoom-in duration-500 mr-[350px]">
            <Star className="w-64 h-64 text-yellow-400 fill-yellow-400 mx-auto mb-8 animate-bounce drop-shadow-[0_0_80px_rgba(234,179,8,0.8)]" />
            <h1 className="text-[10rem] font-black text-white mb-4 uppercase italic transform -skew-x-6 text-glow leading-none">VOTA!</h1>
            <div className="glass-panel px-16 py-8 rounded-full inline-block mt-8 border-2 border-yellow-500/50">
                <p className="text-5xl text-white font-bold">Dai un voto a <span className="text-yellow-400 underline decoration-4 decoration-fuchsia-500">{perf.user_nickname}</span></p>
            </div>
        </div>
    </div>
);

// --- MODALITÀ: PUNTEGGIO ---
const ScoreMode = ({ perf }) => (
    <div className="w-full h-full flex flex-col items-center justify-center bg-black relative">
        <div className="absolute inset-0 bg-gradient-to-b from-black via-fuchsia-900/20 to-black"></div>
        <div className="relative z-10 mr-[350px] text-center">
            <Trophy className="w-48 h-48 text-yellow-500 mx-auto mb-6 drop-shadow-[0_0_50px_rgba(234,179,8,0.6)]" />
            <h2 className="text-5xl text-white/60 font-bold uppercase tracking-[0.2em] mb-4">Punteggio Finale</h2>
            <div className="text-[15rem] font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 to-yellow-600 leading-none drop-shadow-2xl scale-110">
                {perf.average_score?.toFixed(1) || "0.0"}
            </div>
            <p className="text-3xl text-white mt-12 font-bold bg-white/10 px-10 py-4 rounded-full backdrop-blur-md border border-white/20 inline-block">
                {perf.song_title}
            </p>
        </div>
    </div>
);

// --- MODALITÀ: QUIZ ---
const QuizMode = ({ quiz, result }) => (
    <div className="w-full h-full flex flex-col bg-[#080808] relative p-12 overflow-hidden">
        {/* Media Background (se c'è video/audio) */}
        <QuizMediaFixed mediaUrl={quiz.media_url} mediaType={quiz.media_type} isResult={!!result} />
        
        {/* Overlay scuro per leggerezza testo */}
        <div className="absolute inset-0 bg-black/70 z-10 pointer-events-none"></div>

        <div className="relative z-20 flex-1 flex flex-col items-center justify-center mr-[350px]">
            {/* Categoria Badge */}
            <div className="bg-fuchsia-600 text-white px-10 py-4 rounded-full font-black text-xl uppercase tracking-[0.3em] mb-12 shadow-[0_0_40px_rgba(217,70,239,0.6)] transform -rotate-2 border-2 border-white/20">
                {quiz.category || "QUIZ TIME"}
            </div>

            {result ? (
                // --- SCHERMATA RISULTATO CON VINCITORI ---
                <div className="w-full max-w-6xl animate-in zoom-in duration-500 flex flex-col items-center">
                    
                    <div className="bg-green-600/90 backdrop-blur-xl p-10 rounded-[3rem] mb-12 shadow-[0_0_100px_rgba(22,163,74,0.5)] border-4 border-green-400 text-center w-full">
                        <div className="text-white/70 uppercase font-bold tracking-widest text-sm mb-2">Risposta Corretta</div>
                        <span className="text-7xl font-black text-white leading-tight">{result.correct_option}</span>
                    </div>

                    <div className="w-full grid grid-cols-2 gap-10">
                        {/* LISTA VINCITORI (CHI HA INDOVINATO + VELOCE) */}
                        <div className="glass-panel p-8 rounded-3xl">
                            <h3 className="text-fuchsia-400 font-bold uppercase tracking-widest mb-6 flex items-center gap-2 text-xl">
                                <Zap className="w-6 h-6"/> I Più Veloci
                            </h3>
                            <div className="space-y-4">
                                {result.winners && result.winners.length > 0 ? (
                                    result.winners.map((w, i) => (
                                        <div key={i} className="flex items-center gap-4 bg-white/5 p-3 rounded-2xl border border-white/5">
                                            <div className="bg-yellow-500 text-black font-black w-8 h-8 rounded-lg flex items-center justify-center text-lg">{i+1}</div>
                                            <img src={w.avatar} className="w-10 h-10 rounded-full object-cover border border-white/20" alt="avt" />
                                            <span className="text-white font-bold text-xl truncate flex-1">{w.nickname}</span>
                                            <div className="text-green-400 font-mono font-bold text-lg">+{w.points}</div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-white/30 italic text-center py-4">Nessuno ha indovinato in tempo!</div>
                                )}
                            </div>
                        </div>

                        {/* STATISTICHE */}
                        <div className="flex flex-col gap-6">
                            <div className="glass-panel p-8 rounded-3xl flex-1 flex flex-col items-center justify-center border-l-8 border-green-500">
                                <div className="text-8xl font-black text-white mb-2">{result.correct_count}</div>
                                <div className="text-sm uppercase text-white/50 font-bold tracking-widest">Hanno Indovinato</div>
                            </div>
                            <div className="glass-panel p-8 rounded-3xl flex-1 flex flex-col items-center justify-center border-l-8 border-zinc-500">
                                <div className="text-8xl font-black text-white mb-2">{result.total_answers}</div>
                                <div className="text-sm uppercase text-white/50 font-bold tracking-widest">Risposte Totali</div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                // --- SCHERMATA DOMANDA ---
                <div className="w-full max-w-7xl text-center">
                    <h1 className="text-8xl font-black text-white leading-tight mb-20 drop-shadow-2xl">{quiz.question}</h1>
                    
                    {quiz.status === 'closed' ? (
                         <div className="bg-red-600 p-12 rounded-[3rem] inline-block animate-pulse shadow-[0_0_80px_rgba(220,38,38,0.8)] border-4 border-red-400">
                             <h2 className="text-6xl font-black text-white uppercase italic">TEMPO SCADUTO!</h2>
                         </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-8">
                            {quiz.options.map((opt, i) => (
                                <div key={i} className="glass-panel border-l-[12px] border-fuchsia-600 p-10 rounded-r-3xl flex items-center gap-8 text-left transform transition hover:scale-105 duration-300">
                                    <div className="w-24 h-24 bg-black/40 rounded-2xl flex items-center justify-center text-5xl font-black text-white shrink-0 font-mono shadow-inner border border-white/10">
                                        {String.fromCharCode(65+i)}
                                    </div>
                                    <div className="text-5xl font-bold text-white leading-tight">{opt}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    </div>
);

// --- MODALITÀ: IDLE (Attesa) ---
const IdleMode = ({ pub }) => (
    <div className="w-full h-full flex flex-col items-center justify-center animated-bg relative overflow-hidden">
        <div className="w-[1000px] h-[1000px] bg-fuchsia-600/10 rounded-full blur-[150px] absolute z-0 animate-pulse"></div>
        
        <div className="relative z-10 text-center mr-[350px]">
            {pub.logo_url ? (
                 <img src={pub.logo_url} className="w-80 h-80 rounded-[3rem] mb-12 mx-auto shadow-[0_0_80px_rgba(0,0,0,0.8)] border-4 border-white/10 object-cover bg-black" alt="logo" />
            ) : (
                 <div className="w-64 h-64 rounded-full bg-gradient-to-br from-zinc-800 to-black flex items-center justify-center mx-auto mb-10 border-4 border-white/10">
                    <Music className="w-32 h-32 text-white/20" />
                 </div>
            )}
            <h1 className="text-9xl font-black text-white tracking-tighter drop-shadow-2xl mb-8">{pub.name}</h1>
            <div className="glass-panel px-16 py-6 rounded-full inline-block border border-white/20">
                <span className="text-3xl text-white/90 font-bold uppercase tracking-[0.4em]">Benvenuti</span>
            </div>
        </div>
    </div>
);

// ===========================================
// COMPONENTE PRINCIPALE
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
                
                // Gestione Risultati Quiz
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
        const int = setInterval(load, 3000); // Fallback polling
        
        const ch = supabase.channel('tv_ctrl')
            .on('broadcast', {event: 'control'}, p => { if(p.payload.command === 'mute') setIsMuted(p.payload.value); })
            .on('postgres_changes', {event: 'INSERT', schema: 'public', table: 'reactions'}, p => setNewReaction(p.new))
            .on('postgres_changes', {event: '*', schema: 'public', table: 'performances'}, load)
            .on('postgres_changes', {event: '*', schema: 'public', table: 'quizzes'}, load)
            .subscribe();
            
        return () => { clearInterval(int); supabase.removeChannel(ch); };
    }, [pubCode, load]);

    if (!data) return (
        <div className="w-screen h-screen bg-black flex flex-col items-center justify-center">
             <div className="w-20 h-20 border-8 border-fuchsia-600 border-t-transparent rounded-full animate-spin mb-6"></div>
             <div className="text-white text-3xl font-black font-mono tracking-[0.5em] animate-pulse">CARICAMENTO...</div>
        </div>
    );

    const { pub, current_performance: perf, queue, active_quiz: quiz, latest_message: msg, leaderboard, approved_messages } = data;

    // Get last 5 approved messages for ticker
    const recentMessages = approved_messages ? approved_messages.slice(0, 5) : [];

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
        <div className="w-screen h-screen relative bg-black overflow-hidden">
            <style>{STYLES}</style>
            
            {/* Background Texture Overlay */}
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 pointer-events-none z-0"></div>

            {/* LIVELLI UI */}
            <TopBar pubName={pub.name} logoUrl={pub.logo_url} onlineCount={leaderboard?.length || 0} messages={recentMessages} isMuted={isMuted} />
            <FloatingReactions newReaction={newReaction} />
            
            <div className="w-full h-full pt-24 pb-0 relative z-10">
                {Content}
            </div>
            
            <Sidebar pubCode={pubCode} queue={queue} leaderboard={leaderboard} />
        </div>
    );
}