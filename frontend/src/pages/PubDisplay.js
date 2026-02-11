import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '@/lib/supabase';
import api from '@/lib/api';
import { 
  Music, Trophy, Mic2, MessageSquare, Crown, Star, Sparkles, 
  Radio, Clock, Music2, PartyPopper
} from 'lucide-react';

// Import Componenti Separati
import QuizMediaFixed from '@/components/QuizMediaFixed';
import KaraokePlayer from '@/components/KaraokePlayer';
import FloatingReactions from '@/components/FloatingReactions';

// --- COMPONENTI UI STILE "X-FACTOR / TV SHOW" ---

const LogoDisplay = ({ url, name }) => (
  <div className="absolute top-8 left-8 z-50 flex items-center gap-6 animate-in slide-in-from-top duration-700">
    <div className="relative">
        <div className="absolute inset-0 bg-blue-500 blur-xl opacity-50 rounded-full animate-pulse"></div>
        {url ? (
          <img src={url} alt="Logo" className="relative w-24 h-24 rounded-full border-4 border-white/10 shadow-2xl object-cover" />
        ) : (
          <div className="relative w-24 h-24 bg-gradient-to-br from-indigo-600 to-blue-900 rounded-full flex items-center justify-center border-4 border-white/10 shadow-2xl">
            <Radio className="w-10 h-10 text-white" />
          </div>
        )}
    </div>
    <div>
      <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-blue-200 uppercase tracking-tighter drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]">
        {name}
      </h1>
      <div className="flex items-center gap-2 mt-1">
         <span className="w-3 h-3 bg-red-600 rounded-full animate-ping"/>
         <span className="text-sm text-red-500 font-bold tracking-[0.3em] uppercase">On Air</span>
      </div>
    </div>
  </div>
);

const JoinCard = ({ code }) => (
  <div className="absolute bottom-8 right-8 z-50 animate-in slide-in-from-right duration-700">
    <div className="bg-black/60 backdrop-blur-xl border border-white/10 p-6 rounded-3xl shadow-2xl flex items-center gap-6 relative overflow-hidden group">
      <div className="absolute inset-0 bg-gradient-to-r from-fuchsia-600/20 to-blue-600/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
      <div className="bg-white p-3 rounded-2xl shadow-inner relative z-10">
        <QRCodeSVG value={`${window.location.origin}/join/${code}`} size={100} level="H" />
      </div>
      <div className="text-left relative z-10">
        <div className="flex flex-col">
            <span className="text-blue-400 text-xs font-bold uppercase tracking-widest mb-1">Scannerizza per giocare</span>
            <span className="text-white text-5xl font-black tracking-tighter shadow-black drop-shadow-lg">{code}</span>
            <span className="text-white/50 text-xs font-mono mt-1">neonpub.com</span>
        </div>
      </div>
    </div>
  </div>
);

const MessageTicker = ({ message }) => {
  if (!message) return null;
  return (
    <div className="absolute bottom-10 left-10 right-[400px] z-40 animate-in slide-in-from-bottom duration-500">
       <div className="bg-gradient-to-r from-indigo-900/90 to-black/90 backdrop-blur-xl border-l-8 border-cyan-400 p-6 rounded-r-2xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] flex items-center gap-6 relative overflow-hidden">
          {/* Shine Effect */}
          <div className="absolute top-0 -left-[100%] w-[50%] h-full bg-gradient-to-r from-transparent via-white/10 to-transparent animate-[shimmer_2s_infinite]"></div>
          
          <div className="bg-cyan-500/20 p-3 rounded-full border border-cyan-500/50">
             <MessageSquare className="w-8 h-8 text-cyan-400" />
          </div>
          <div>
            <p className="text-cyan-400 text-sm font-bold uppercase tracking-widest mb-1 flex items-center gap-2">
                <span className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></span>
                Messaggio dalla Regia
            </p>
            <p className="text-white text-2xl font-medium leading-tight drop-shadow-md font-sans">{message.text}</p>
          </div>
       </div>
    </div>
  );
};

// --- MODALITÀ SCHERMO ---

const KaraokeMode = ({ performance, isVoting, voteResult }) => (
  <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden">
    {/* PLAYER VIDEO SOTTOSTANTE GESTITO NEL COMPONENTE PRINCIPALE */}
    
    <div className="z-10 text-center w-full max-w-6xl px-4 mt-20">
      {isVoting ? (
        <div className="animate-in zoom-in duration-500 bg-black/60 backdrop-blur-xl p-16 rounded-[3rem] border-2 border-yellow-500/50 shadow-[0_0_150px_rgba(234,179,8,0.3)] relative overflow-hidden">
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
            <Star className="w-32 h-32 text-yellow-400 mx-auto mb-8 animate-[spin_4s_linear_infinite] drop-shadow-[0_0_30px_rgba(234,179,8,0.8)]" />
            <h2 className="text-8xl font-black text-white mb-6 uppercase italic tracking-tighter">Vota Ora!</h2>
            <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden mb-8 max-w-lg mx-auto">
                <div className="h-full bg-yellow-400 animate-[loading_10s_linear_forward] w-full origin-left"></div>
            </div>
            <p className="text-4xl text-yellow-200 font-bold uppercase">{performance?.user_nickname}</p>
        </div>
      ) : voteResult ? (
        <div className="animate-in zoom-in duration-500 bg-black/60 backdrop-blur-xl p-16 rounded-[3rem] border-2 border-fuchsia-500/50 shadow-[0_0_150px_rgba(217,70,239,0.3)]">
            <Crown className="w-32 h-32 text-fuchsia-400 mx-auto mb-6 animate-bounce drop-shadow-[0_0_30px_rgba(217,70,239,0.8)]" />
            <div className="text-3xl text-fuchsia-200 uppercase tracking-[0.5em] mb-4 font-bold">Punteggio Finale</div>
            <div className="text-[10rem] leading-none font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-fuchsia-500 drop-shadow-2xl">
              {voteResult.toFixed(1)}
            </div>
            <p className="text-5xl text-white font-bold mt-8 uppercase tracking-wider">{performance?.user_nickname}</p>
        </div>
      ) : (
        /* LIVE PERFORMANCE OVERLAY (Minimalista per lasciar vedere il video) */
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-full max-w-4xl animate-in slide-in-from-bottom duration-1000">
           {/* Banner Canzone stile MTV */}
           <div className="bg-black/80 backdrop-blur-md border-l-8 border-fuchsia-600 p-6 rounded-r-2xl shadow-2xl flex items-center gap-6">
               <div className="bg-fuchsia-600/20 p-4 rounded-full border border-fuchsia-500/30 animate-pulse">
                  <Mic2 className="w-10 h-10 text-fuchsia-500" />
               </div>
               <div className="flex-1 text-left">
                  <h2 className="text-5xl font-black text-white leading-none mb-2 uppercase drop-shadow-lg truncate">
                    {performance?.song_title}
                  </h2>
                  <p className="text-3xl text-fuchsia-300 font-bold uppercase tracking-widest truncate">
                    {performance?.song_artist}
                  </p>
               </div>
               <div className="text-right border-l border-white/20 pl-6">
                  <div className="text-xs text-white/50 uppercase tracking-widest mb-1">Cantante</div>
                  <div className="text-2xl font-bold text-white bg-fuchsia-600 px-4 py-1 rounded shadow-lg">
                      {performance?.user_nickname}
                  </div>
               </div>
           </div>
        </div>
      )}
    </div>
  </div>
);

const QuizMode = ({ quiz, results }) => {
  const isResult = quiz.status === 'showing_results' || quiz.status === 'leaderboard';
  
  return (
    <div className="relative w-full h-full">
      {/* MEDIA PLAYER (QUIZ) SOTTOSTANTE GESTITO NEL COMPONENTE PRINCIPALE */}

      {/* OVERLAY UI */}
      <div className="absolute inset-0 z-20 flex flex-col p-8 md:p-16">
        
        {!isResult && (
          <div className="flex justify-between items-start animate-in slide-in-from-top duration-500">
             <div className="bg-black/80 backdrop-blur-xl px-8 py-3 rounded-full border-2 border-indigo-500 shadow-[0_0_30px_rgba(99,102,241,0.4)]">
                <span className="text-indigo-400 font-black uppercase tracking-widest text-lg flex items-center gap-3">
                  <Sparkles className="w-6 h-6 animate-spin-slow" /> {quiz.category || 'Quiz Time'}
                </span>
             </div>
             <div className="bg-gradient-to-r from-yellow-600 to-yellow-400 text-black font-black px-6 py-3 rounded-xl shadow-lg rotate-2 transform border-2 border-white/20 text-2xl">
                {quiz.points} PUNTI
             </div>
          </div>
        )}

        <div className="flex-1 flex flex-col justify-end pb-24">
           {isResult && results ? (
             <div className="self-center w-full max-w-5xl text-center animate-in zoom-in duration-500">
                <div className="bg-black/70 backdrop-blur-xl p-10 rounded-[3rem] border border-white/10 shadow-2xl">
                    <h2 className="text-4xl font-bold text-white/60 mb-6 uppercase tracking-[0.5em]">Risposta Corretta</h2>
                    
                    <div className="bg-green-600 p-8 rounded-2xl shadow-[0_0_60px_rgba(22,163,74,0.6)] mb-10 transform scale-110 border-4 border-green-400 relative overflow-hidden">
                       <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
                       <p className="text-6xl font-black text-white relative z-10">{results.correct_option}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-8 max-w-3xl mx-auto">
                       <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                          <div className="text-6xl font-black text-green-400 mb-2">{results.correct_count}</div>
                          <div className="text-sm text-white/60 uppercase tracking-widest font-bold">Indovinate</div>
                       </div>
                       <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                          <div className="text-6xl font-black text-white mb-2">{results.total_answers}</div>
                          <div className="text-sm text-white/60 uppercase tracking-widest font-bold">Risposte Totali</div>
                       </div>
                    </div>
                </div>
             </div>
           ) : (
             <div className="w-full max-w-6xl mx-auto animate-in slide-in-from-bottom duration-700">
                <div className="bg-black/80 backdrop-blur-2xl border-2 border-white/10 p-10 rounded-[2rem] shadow-2xl mb-8 relative overflow-hidden">
                   <div className="absolute top-0 left-0 w-4 h-full bg-gradient-to-b from-indigo-500 to-fuchsia-500" />
                   <h2 className="text-5xl md:text-6xl font-black text-white leading-tight drop-shadow-md">
                     {quiz.question}
                   </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {quiz.options?.map((opt, i) => (
                    <div key={i} className="bg-gradient-to-r from-gray-900 to-black backdrop-blur-md border border-white/20 p-6 rounded-2xl flex items-center gap-6 group relative overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:border-fuchsia-500/50">
                       <div className="absolute inset-0 bg-fuchsia-600/0 group-hover:bg-fuchsia-600/10 transition-colors"></div>
                       <div className="w-16 h-16 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-3xl font-black text-white group-hover:bg-fuchsia-600 group-hover:text-white transition-colors shadow-lg">
                         {['A','B','C','D'][i]}
                       </div>
                       <span className="text-3xl text-white font-bold shadow-black drop-shadow-sm">{opt}</span>
                    </div>
                  ))}
                </div>
             </div>
           )}
        </div>
      </div>
    </div>
  );
};

const LeaderboardMode = ({ leaderboard }) => (
  <div className="relative w-full h-full flex flex-col items-center justify-center bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-900 via-black to-black">
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20" />
      <div className="z-10 w-full max-w-5xl p-4">
         <h2 className="text-7xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 to-yellow-600 text-center mb-12 flex items-center justify-center gap-6 drop-shadow-[0_4px_20px_rgba(234,179,8,0.5)]">
            <Trophy className="w-20 h-20 text-yellow-500" />
            CLASSIFICA
         </h2>
         <div className="grid gap-4">
            {leaderboard?.slice(0, 5).map((user, i) => (
              <div key={i} 
                   className={`flex items-center gap-6 p-6 rounded-2xl border transition-all duration-500 animate-in slide-in-from-bottom
                   ${i===0 ? 'bg-gradient-to-r from-yellow-900/80 to-black border-yellow-500/50 shadow-[0_0_40px_rgba(234,179,8,0.2)] scale-105' : 
                     i===1 ? 'bg-gradient-to-r from-gray-800 to-black border-gray-500/50' : 
                     i===2 ? 'bg-gradient-to-r from-orange-900/60 to-black border-orange-500/50' : 
                     'bg-white/5 border-white/5'}`}
                   style={{ animationDelay: `${i * 150}ms` }}>
                  
                  <div className={`w-16 h-16 rounded-xl flex items-center justify-center font-black text-3xl rotate-3 shadow-lg
                      ${i===0 ? 'bg-yellow-500 text-black' : 
                        i===1 ? 'bg-gray-400 text-black' : 
                        i===2 ? 'bg-orange-600 text-white' : 'bg-white/10 text-white'}`}>
                      {i+1}
                  </div>
                  
                  <div className="flex-1">
                     <div className="text-3xl font-black text-white uppercase tracking-tight">{user.nickname}</div>
                     {i===0 && <div className="text-yellow-400 text-xs font-bold uppercase tracking-[0.3em]">Attuale Campione</div>}
                  </div>
                  
                  <div className="text-5xl font-black text-white font-mono tracking-tighter">
                    {user.score} <span className="text-lg text-white/50 align-top">PT</span>
                  </div>
              </div>
            ))}
         </div>
      </div>
  </div>
);

// --- MAIN CONTAINER ---

const PubDisplay = () => {
  const { pubCode } = useParams();
  const [data, setData] = useState(null);
  const [quizResults, setQuizResults] = useState(null);
  
  // Stati per effetti
  const [activeMessage, setActiveMessage] = useState(null);
  const [latestReaction, setLatestReaction] = useState(null);
  
  // Refs
  const lastQuizIdRef = useRef(null);
  const messageTimeoutRef = useRef(null);

  // 1. CARICAMENTO DATI
  const loadData = useCallback(async () => {
    try {
      const res = await api.getDisplayData(pubCode);
      if (res.data) {
        setData(res.data);
        
        // Logica Risultati Quiz (Se serve caricare statistiche)
        const q = res.data.active_quiz;
        if (q && (q.status === 'showing_results' || q.status === 'leaderboard')) {
            if (lastQuizIdRef.current !== q.id || !quizResults) {
                const r = await api.getQuizResults(q.id);
                setQuizResults(r.data);
                lastQuizIdRef.current = q.id;
            }
        } else if (q && q.status === 'active') {
            setQuizResults(null); 
        }

        // Logica Messaggi a Tempo
        // Se c'è un messaggio "nuovo" (diverso dall'ultimo mostrato o se non stiamo mostrando nulla)
        if (res.data.latest_message && res.data.latest_message.text !== activeMessage?.text) {
             setActiveMessage(res.data.latest_message);
             // Resetta timer spegnimento
             if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current);
             messageTimeoutRef.current = setTimeout(() => {
                 setActiveMessage(null);
             }, 15000); // 15 secondi di visibilità
        }
      }
    } catch (e) { console.error(e); }
  }, [pubCode, quizResults, activeMessage]);

  // 2. REALTIME & POLLING
  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 3000); // Polling backup
    
    // Setup Realtime
    const ch = supabase.channel('display_updates')
      // Ascolta cambi nel DB
      .on('postgres_changes', { event: '*', schema: 'public', table: 'performances' }, loadData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quizzes' }, loadData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, loadData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, loadData)
      // Ascolta REAZIONI/EMOJI (Insert diretti nella tabella reactions)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reactions' }, (payload) => {
          setLatestReaction({
              emoji: payload.new.emoji,
              nickname: payload.new.nickname
          });
      })
      .subscribe();

    return () => { 
        clearInterval(interval); 
        supabase.removeChannel(ch);
        if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current);
    };
  }, [loadData]); // Dipendenza da loadData (che è in useCallback)

  if (!data) return (
      <div className="h-screen bg-black flex flex-col items-center justify-center text-white">
          <div className="w-16 h-16 border-4 border-fuchsia-600 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="font-mono text-fuchsia-500 animate-pulse">RICERCA SEGNALE SATELLITARE...</p>
      </div>
  );

  const { pub, current_performance, active_quiz, leaderboard } = data;
  
  // DETERMINA STATO VISUALE
  const showLeaderboard = active_quiz?.status === 'leaderboard';
  const showQuiz = active_quiz && ['active', 'closed', 'showing_results'].includes(active_quiz.status);
  const showKaraoke = current_performance && !showQuiz && !showLeaderboard;

  return (
    <div className="h-screen w-screen bg-black overflow-hidden font-sans select-none relative text-white">
       
       {/* 1. LAYER SFONDO & MEDIA (Non si smontano mai per evitare riavvii) */}
       
       {/* Player Quiz (rimane montato ma nascosto se non serve, gestisce il suo stato interno) */}
       <div className={`absolute inset-0 transition-opacity duration-1000 ${showQuiz ? 'opacity-100 z-0' : 'opacity-0 -z-10'}`}>
           <QuizMediaFixed 
               mediaUrl={active_quiz?.media_url} 
               mediaType={active_quiz?.media_type} 
               isResult={active_quiz?.status === 'showing_results'} 
           />
       </div>

       {/* Player Karaoke (nuovo componente dedicato) */}
       <div className={`absolute inset-0 transition-opacity duration-1000 ${showKaraoke ? 'opacity-100 z-0' : 'opacity-0 -z-10'}`}>
           <KaraokePlayer 
               url={current_performance?.youtube_url}
               status={current_performance?.status}
           />
       </div>

       {/* Sfondo Default (se nessun media attivo) */}
       <div className={`absolute inset-0 bg-gradient-to-br from-indigo-900 via-black to-black transition-opacity duration-1000 -z-20 ${(!showQuiz && !showKaraoke) ? 'opacity-100' : 'opacity-0'}`}>
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10"></div>
       </div>


       {/* 2. LAYER INTERFACCIA (Overlay) */}
       
       <LogoDisplay url={pub?.logo_url} name={pub?.name} />
       <JoinCard code={pubCode} />
       
       {/* Messaggi a comparsa (gestiti con stato locale e timer) */}
       <MessageTicker message={activeMessage} />
       
       {/* Reazioni Flottanti */}
       <FloatingReactions newReaction={latestReaction} />

       <div className="absolute inset-0 z-10 pointer-events-none">
          {showLeaderboard ? (
             <div className="w-full h-full pointer-events-auto">
                <LeaderboardMode leaderboard={leaderboard} />
             </div>
          ) : showQuiz ? (
             <div className="w-full h-full pointer-events-auto">
                <QuizMode quiz={active_quiz} results={quizResults} />
             </div>
          ) : showKaraoke ? (
             <div className="w-full h-full pointer-events-auto">
                <KaraokeMode 
                    performance={current_performance} 
                    isVoting={current_performance.status === 'voting'} 
                    voteResult={current_performance.status === 'ended' ? current_performance.average_score : null}
                />
             </div>
          ) : (
             // SCREEN DI ATTESA
             <div className="h-full flex flex-col items-center justify-center relative pointer-events-auto">
                <div className="z-10 text-center animate-in zoom-in duration-1000">
                    <div className="relative inline-block">
                        <div className="absolute inset-0 bg-fuchsia-500 blur-2xl opacity-40 animate-pulse"></div>
                        <img src={pub?.logo_url || "https://placehold.co/400x400/1a1a1a/FFF?text=NEON"} alt="Logo" className="relative w-64 h-64 mx-auto rounded-full mb-10 shadow-2xl border-4 border-white/20 object-cover" />
                    </div>
                    <h1 className="text-9xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-400 mb-6 tracking-tighter uppercase drop-shadow-2xl">
                        {pub?.name}
                    </h1>
                    <div className="inline-flex items-center gap-4 bg-white/5 border border-white/10 px-8 py-3 rounded-full backdrop-blur-md">
                        <Music className="w-6 h-6 text-fuchsia-400 animate-bounce" />
                        <span className="text-2xl text-white font-bold uppercase tracking-[0.3em]">Benvenuti allo Show</span>
                    </div>
                </div>
             </div>
          )}
       </div>
    </div>
  );
};

export default PubDisplay;