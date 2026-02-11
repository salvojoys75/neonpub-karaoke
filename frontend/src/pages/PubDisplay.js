import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '@/lib/supabase';
import api from '@/lib/api';
import { 
  Music, Trophy, Mic2, MessageSquare, Crown, Star, Sparkles, 
  Radio, VolumeX, User, Music2
} from 'lucide-react';

// Import Componenti
import QuizMediaFixed from '@/components/QuizMediaFixed';
import KaraokePlayer from '@/components/KaraokePlayer';
import FloatingReactions from '@/components/FloatingReactions';

// --- ELEMENTI UI ISOLATI (HUD) ---

const LogoHUD = ({ url, name }) => (
  <div className="absolute top-6 left-6 z-50 flex items-center gap-4 animate-in slide-in-from-top duration-700">
    <div className="relative group">
        <div className="absolute inset-0 bg-blue-500 blur-lg opacity-40 rounded-full group-hover:opacity-60 transition-opacity"></div>
        {url ? (
          <img src={url} alt="Logo" className="relative w-20 h-20 rounded-full border-2 border-white/20 shadow-2xl object-cover bg-black" />
        ) : (
          <div className="relative w-20 h-20 bg-zinc-900 rounded-full flex items-center justify-center border-2 border-white/10">
            <Radio className="w-8 h-8 text-white" />
          </div>
        )}
    </div>
    <div className="hidden md:block">
      <h1 className="text-2xl font-black text-white uppercase tracking-tighter drop-shadow-md leading-none">
        {name}
      </h1>
      <div className="flex items-center gap-2 mt-1">
         <div className="w-2 h-2 bg-red-600 rounded-full animate-ping"/>
         <span className="text-[10px] text-red-500 font-bold tracking-[0.2em] uppercase bg-red-950/30 px-2 py-0.5 rounded border border-red-900/50">Live</span>
      </div>
    </div>
  </div>
);

const QrHUD = ({ code }) => (
  <div className="absolute bottom-6 right-6 z-50 animate-in slide-in-from-right duration-700 origin-bottom-right">
    <div className="bg-black/80 backdrop-blur-md border border-white/10 p-3 rounded-2xl shadow-2xl flex flex-col items-center gap-2">
      <div className="bg-white p-2 rounded-xl">
        <QRCodeSVG value={`${window.location.origin}/join/${code}`} size={80} level="M" />
      </div>
      <div className="text-center">
        <div className="text-white font-black text-xl tracking-widest">{code}</div>
        <div className="text-[10px] text-zinc-400 uppercase tracking-wide">Scannerizza</div>
      </div>
    </div>
  </div>
);

const MessageTicker = ({ message }) => {
  if (!message) return null;
  
  // Determina se è Regia o Utente
  const isSystem = !message.participant_id;
  const authorName = message.participants?.nickname || (isSystem ? "REGIA" : "Anonimo");

  return (
    <div className="absolute bottom-8 left-8 right-[200px] z-40 animate-in slide-in-from-bottom duration-500">
       <div className={`backdrop-blur-xl border-l-4 p-4 rounded-r-xl shadow-2xl flex items-center gap-4 max-w-3xl
           ${isSystem ? 'bg-cyan-950/80 border-cyan-400' : 'bg-fuchsia-950/80 border-fuchsia-500'}`}>
          
          <div className={`p-2 rounded-full ${isSystem ? 'bg-cyan-500/20' : 'bg-fuchsia-500/20'}`}>
             <MessageSquare className={`w-6 h-6 ${isSystem ? 'text-cyan-400' : 'text-fuchsia-400'}`} />
          </div>
          
          <div className="flex-1 min-w-0">
            <p className={`text-[10px] font-bold uppercase tracking-widest mb-0.5 flex items-center gap-2 ${isSystem ? 'text-cyan-400' : 'text-fuchsia-400'}`}>
                {authorName}
                {!isSystem && <span className="text-[8px] bg-white/10 px-1 rounded text-white/60">APP</span>}
            </p>
            <p className="text-white text-lg font-medium leading-tight truncate drop-shadow-sm">{message.text}</p>
          </div>
       </div>
    </div>
  );
};

const MuteIndicator = () => (
    <div className="absolute top-6 right-6 z-[60] bg-red-600 text-white px-4 py-2 rounded-full font-bold flex items-center gap-2 animate-pulse shadow-lg">
        <VolumeX className="w-5 h-5" /> AUDIO OFF
    </div>
);

// --- SCENE / MODALITÀ ---

const KaraokeMode = ({ performance, isVoting, voteResult }) => (
  <div className="relative w-full h-full flex flex-col items-center justify-center">
    
    {/* Contenuto Video Overlay */}
    <div className="absolute inset-0 z-10 pointer-events-none flex flex-col justify-end pb-24 px-12">
      
      {isVoting ? (
        <div className="self-center animate-in zoom-in duration-500 bg-black/80 backdrop-blur-xl p-12 rounded-[2rem] border border-yellow-500/30 text-center shadow-2xl max-w-4xl">
            <Star className="w-20 h-20 text-yellow-400 mx-auto mb-6 animate-spin-slow" />
            <h2 className="text-6xl font-black text-white mb-2 uppercase italic">Vota Ora!</h2>
            <p className="text-2xl text-zinc-300 mb-8">Dai un punteggio all'esibizione</p>
            <div className="text-4xl text-yellow-400 font-bold uppercase tracking-wider border-t border-white/10 pt-6">
                {performance?.user_nickname}
            </div>
        </div>
      ) : voteResult ? (
        <div className="self-center animate-in zoom-in duration-500 bg-black/80 backdrop-blur-xl p-12 rounded-[2rem] border border-fuchsia-500/30 text-center shadow-2xl">
            <Crown className="w-20 h-20 text-fuchsia-400 mx-auto mb-4 animate-bounce" />
            <div className="text-xl text-fuchsia-200 uppercase tracking-widest mb-2">Punteggio</div>
            <div className="text-9xl font-black text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]">
              {voteResult.toFixed(1)}
            </div>
            <div className="mt-6 text-2xl font-bold text-zinc-400">{performance?.user_nickname}</div>
        </div>
      ) : (
        /* CARD CANTANTE - CHI C'È SUL PALCO ORA */
        <div className="animate-in slide-in-from-bottom duration-1000 flex items-end gap-6 w-full max-w-5xl mx-auto">
           {/* Cover / Icona */}
           <div className="w-32 h-32 bg-fuchsia-600 rounded-2xl flex items-center justify-center shadow-2xl border-2 border-white/20 shrink-0">
               <Mic2 className="w-16 h-16 text-white" />
           </div>
           
           {/* Info Testo */}
           <div className="flex-1 bg-black/70 backdrop-blur-md p-6 rounded-r-2xl rounded-tl-2xl border-l-4 border-fuchsia-500 shadow-2xl">
              <div className="flex items-center gap-3 mb-1">
                 <span className="bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider animate-pulse">On Stage</span>
                 <h3 className="text-3xl font-bold text-white uppercase tracking-wide">{performance?.user_nickname}</h3>
              </div>
              <div className="h-px w-full bg-white/10 my-2"></div>
              <div>
                  <h2 className="text-4xl font-black text-white leading-none mb-1 truncate">{performance?.song_title}</h2>
                  <p className="text-xl text-fuchsia-300 font-medium uppercase tracking-widest truncate">{performance?.song_artist}</p>
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
    <div className="relative w-full h-full flex items-center justify-center p-8 md:p-16">
      
      {/* Punteggio Quiz in alto a destra */}
      {!isResult && (
          <div className="absolute top-8 right-8 z-20 bg-yellow-500 text-black font-black px-6 py-3 rounded-lg shadow-[0_0_20px_rgba(234,179,8,0.5)] text-2xl border-2 border-white rotate-2">
            {quiz.points} PT
          </div>
      )}

      <div className="relative z-10 w-full max-w-6xl">
           {isResult && results ? (
             <div className="w-full text-center animate-in zoom-in duration-500">
                <div className="bg-black/90 backdrop-blur-xl p-12 rounded-[3rem] border border-white/10 shadow-2xl inline-block max-w-4xl">
                    <h2 className="text-3xl font-bold text-zinc-400 mb-8 uppercase tracking-[0.3em]">La risposta giusta è</h2>
                    
                    <div className="bg-green-600/20 border-2 border-green-500 p-8 rounded-2xl mb-10 relative overflow-hidden">
                       <p className="text-5xl font-black text-green-400 relative z-10">{results.correct_option}</p>
                    </div>

                    <div className="flex justify-center gap-12">
                       <div className="text-center">
                          <div className="text-5xl font-black text-white mb-1">{results.correct_count}</div>
                          <div className="text-xs text-zinc-500 uppercase tracking-widest font-bold">Indovinate</div>
                       </div>
                       <div className="w-px bg-white/10"></div>
                       <div className="text-center">
                          <div className="text-5xl font-black text-zinc-500 mb-1">{results.total_answers}</div>
                          <div className="text-xs text-zinc-600 uppercase tracking-widest font-bold">Totali</div>
                       </div>
                    </div>
                </div>
             </div>
           ) : (
             <div className="animate-in slide-in-from-bottom duration-700 mt-[10vh]"> {/* Spazio per il video background */}
                
                {/* Domanda */}
                <div className="bg-black/80 backdrop-blur-xl border border-white/10 p-8 rounded-3xl shadow-2xl mb-6 text-center">
                   <h2 className="text-4xl md:text-5xl font-black text-white leading-tight drop-shadow-lg">
                     {quiz.question}
                   </h2>
                </div>

                {/* Opzioni */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {quiz.options?.map((opt, i) => (
                    <div key={i} className="bg-zinc-900/90 hover:bg-zinc-800 border border-white/10 p-6 rounded-2xl flex items-center gap-6 transition-all duration-300 group">
                       <div className="w-12 h-12 rounded-lg bg-white/10 flex items-center justify-center text-2xl font-black text-white group-hover:bg-fuchsia-600 transition-colors">
                         {['A','B','C','D'][i]}
                       </div>
                       <span className="text-2xl text-white font-bold">{opt}</span>
                    </div>
                  ))}
                </div>
             </div>
           )}
      </div>
    </div>
  );
};

const LeaderboardMode = ({ leaderboard }) => (
  <div className="relative w-full h-full flex flex-col items-center justify-center bg-black">
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20" />
      <div className="z-10 w-full max-w-4xl p-4">
         <h2 className="text-6xl font-black text-white text-center mb-12 flex items-center justify-center gap-4 tracking-tighter">
            <Trophy className="w-16 h-16 text-yellow-500" />
            CLASSIFICA
         </h2>
         <div className="grid gap-3">
            {leaderboard?.slice(0, 5).map((user, i) => (
              <div key={i} 
                   className={`flex items-center gap-6 p-4 rounded-xl border transition-all animate-in slide-in-from-bottom
                   ${i===0 ? 'bg-yellow-900/40 border-yellow-500/50 scale-105' : 'bg-white/5 border-white/5'}`}
                   style={{ animationDelay: `${i * 100}ms` }}>
                  
                  <div className={`w-12 h-12 rounded flex items-center justify-center font-black text-2xl
                      ${i===0 ? 'bg-yellow-500 text-black' : 'bg-zinc-800 text-zinc-500'}`}>
                      {i+1}
                  </div>
                  
                  <div className="flex-1">
                     <div className="text-2xl font-bold text-white uppercase">{user.nickname}</div>
                  </div>
                  
                  <div className="text-4xl font-black text-white font-mono">
                    {user.score}
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
  const [isMuted, setIsMuted] = useState(false);
  
  // Stati per effetti
  const [activeMessage, setActiveMessage] = useState(null);
  const [latestReaction, setLatestReaction] = useState(null);
  
  const lastQuizIdRef = useRef(null);
  const messageTimeoutRef = useRef(null);

  // 1. CARICAMENTO DATI
  const loadData = useCallback(async () => {
    try {
      const res = await api.getDisplayData(pubCode);
      if (res.data) {
        setData(res.data);
        
        // Risultati Quiz
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

        // Messaggi a Tempo (FIXED LOGIC)
        if (res.data.latest_message) {
            // Se il messaggio è diverso da quello attualmente visualizzato
            if (!activeMessage || activeMessage.id !== res.data.latest_message.id) {
                setActiveMessage(res.data.latest_message);
                if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current);
                messageTimeoutRef.current = setTimeout(() => {
                    setActiveMessage(null);
                }, 15000); // 15 secondi
            }
        }
      }
    } catch (e) { console.error(e); }
  }, [pubCode, quizResults, activeMessage]);

  // 2. REALTIME
  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 3000); 
    
    // Canale Controllo (Mute)
    const controlChannel = supabase.channel(`display_control_${pubCode}`)
        .on('broadcast', { event: 'control' }, (payload) => {
            if (payload.payload.command === 'mute') setIsMuted(payload.payload.value);
        })
        .subscribe();

    // Canale Dati
    const dataChannel = supabase.channel('display_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'performances' }, loadData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quizzes' }, loadData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, loadData)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reactions' }, (payload) => {
          setLatestReaction({ emoji: payload.new.emoji, nickname: payload.new.nickname });
      })
      .subscribe();

    return () => { 
        clearInterval(interval); 
        supabase.removeChannel(controlChannel);
        supabase.removeChannel(dataChannel);
        if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current);
    };
  }, [loadData, pubCode]);

  if (!data) return <div className="h-screen bg-black flex items-center justify-center text-white font-mono animate-pulse">CARICAMENTO SYSTEM...</div>;

  const { pub, current_performance, active_quiz, leaderboard } = data;
  
  const showLeaderboard = active_quiz?.status === 'leaderboard';
  const showQuiz = active_quiz && ['active', 'closed', 'showing_results'].includes(active_quiz.status);
  const showKaraoke = current_performance && !showQuiz && !showLeaderboard;

  return (
    <div className="h-screen w-screen bg-black overflow-hidden font-sans select-none relative text-white">
       
       {/* 1. LAYER MEDIA (Z-INDEX 0) */}
       <div className={`absolute inset-0 transition-opacity duration-700 ${showQuiz ? 'opacity-100 z-0' : 'opacity-0 -z-10'}`}>
           <QuizMediaFixed 
               mediaUrl={active_quiz?.media_url} 
               mediaType={active_quiz?.media_type} 
               isResult={active_quiz?.status === 'showing_results'} 
               isMuted={isMuted}
           />
       </div>

       <div className={`absolute inset-0 transition-opacity duration-700 ${showKaraoke ? 'opacity-100 z-0' : 'opacity-0 -z-10'}`}>
           <KaraokePlayer 
               url={current_performance?.youtube_url}
               status={current_performance?.status}
               startedAt={current_performance?.started_at}
               isMuted={isMuted}
           />
       </div>

       {/* Sfondo Fallback */}
       <div className={`absolute inset-0 bg-gradient-to-br from-zinc-900 to-black transition-opacity duration-1000 -z-20 ${(!showQuiz && !showKaraoke) ? 'opacity-100' : 'opacity-0'}`}>
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10"></div>
       </div>

       {/* 2. LAYER HUD (Z-INDEX 50) - Sempre visibile sopra i video */}
       <LogoHUD url={pub?.logo_url} name={pub?.name} />
       <QrHUD code={pubCode} />
       <MessageTicker message={activeMessage} />
       <FloatingReactions newReaction={latestReaction} />
       {isMuted && <MuteIndicator />}

       {/* 3. LAYER CONTENUTO (Z-INDEX 10) - Interfaccia centrale */}
       <div className="absolute inset-0 z-10">
          {showLeaderboard ? (
             <LeaderboardMode leaderboard={leaderboard} />
          ) : showQuiz ? (
             <QuizMode quiz={active_quiz} results={quizResults} />
          ) : showKaraoke ? (
             <KaraokeMode 
                performance={current_performance} 
                isVoting={current_performance.status === 'voting'} 
                voteResult={current_performance.status === 'ended' ? current_performance.average_score : null}
             />
          ) : (
             /* IDLE / ATTESA */
             <div className="h-full flex flex-col items-center justify-center">
                 <img src={pub?.logo_url || "https://placehold.co/400x400/000/FFF?text=NEON"} alt="Event Logo" className="w-48 h-48 rounded-full shadow-[0_0_50px_rgba(255,255,255,0.2)] mb-8 border-4 border-zinc-800 object-cover animate-pulse" />
                 <h1 className="text-8xl font-black text-white tracking-tighter uppercase mb-4">{pub?.name}</h1>
                 <p className="text-2xl text-zinc-500 font-mono">In attesa del prossimo contenuto...</p>
             </div>
          )}
       </div>
    </div>
  );
};

export default PubDisplay;