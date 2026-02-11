import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '@/lib/supabase';
import api from '@/lib/api';
import { 
  Music, Trophy, Mic2, MessageSquare, Crown, Star, Sparkles, 
  Radio, VolumeX, User, Music2
} from 'lucide-react';

import QuizMediaFixed from '@/components/QuizMediaFixed';
import KaraokePlayer from '@/components/KaraokePlayer';
import FloatingReactions from '@/components/FloatingReactions';

// --- SIDEBAR VERTICALE (Destra) ---
const SidebarRight = ({ pub, code, leaderboard }) => (
  <div className="h-full w-80 bg-zinc-950 border-l border-white/10 flex flex-col items-center py-8 px-4 z-50 shadow-2xl relative">
      {/* Sfondo Noise sulla sidebar */}
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 pointer-events-none"></div>

      {/* 1. LOGO LOCALE */}
      <div className="mb-10 flex flex-col items-center w-full">
          {pub?.logo_url ? (
            <img src={pub.logo_url} className="w-32 h-32 rounded-full border-4 border-fuchsia-600 shadow-[0_0_30px_rgba(217,70,239,0.3)] object-cover mb-4 bg-black" />
          ) : (
            <div className="w-32 h-32 rounded-full bg-zinc-800 flex items-center justify-center border-4 border-white/10 mb-4 shadow-lg">
               <Music className="w-14 h-14 text-zinc-600"/>
            </div>
          )}
          <h1 className="text-xl font-black text-white text-center uppercase leading-tight drop-shadow-md">{pub?.name}</h1>
      </div>

      {/* 2. CLASSIFICA (Scrollabile) */}
      <div className="flex-1 w-full overflow-hidden flex flex-col mb-8 bg-white/5 rounded-xl p-2 border border-white/5">
          <div className="flex items-center gap-2 mb-3 justify-center pt-2">
             <Trophy className="w-4 h-4 text-yellow-500" />
             <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Top Players</h2>
          </div>
          <div className="flex-1 space-y-1 overflow-y-auto pr-1 custom-scrollbar">
              {leaderboard?.slice(0, 10).map((u, i) => (
                  <div key={i} className={`flex items-center p-2 rounded ${i===0?'bg-yellow-900/30 border border-yellow-500/30':'hover:bg-white/5'}`}>
                      <div className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold mr-3 
                          ${i===0?'bg-yellow-500 text-black':'bg-zinc-800 text-zinc-400'}`}>{i+1}</div>
                      <div className="flex-1 min-w-0">
                          <div className="text-xs font-bold text-white truncate">{u.nickname}</div>
                      </div>
                      <div className="text-xs font-mono text-fuchsia-400">{u.score}</div>
                  </div>
              ))}
          </div>
      </div>

      {/* 3. QR CODE BOX */}
      <div className="bg-white p-4 rounded-2xl shadow-[0_0_40px_rgba(255,255,255,0.1)] w-full flex flex-col items-center">
          <QRCodeSVG value={`${window.location.origin}/join/${code}`} size={160} level="M" />
          <div className="text-black font-black text-2xl mt-3 tracking-widest">{code}</div>
          <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mt-1">Scannerizza per giocare</div>
      </div>
  </div>
);

// --- BANNER ORIZZONTALE (Basso) ---
const BottomBanner = ({ current, queue }) => {
    // Escludiamo il cantante corrente dalla coda per non duplicarlo
    const nextSingers = queue ? queue.filter(q => q.id !== current?.song_request_id) : [];

    return (
        <div className="h-28 bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950 border-t border-white/10 flex items-center px-8 z-40 absolute bottom-0 left-0 right-80 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
            
            {/* SINISTRA: ORA IN ONDA */}
            <div className="flex-[2] flex items-center gap-6 border-r border-white/10 pr-8 h-full">
                <div className="w-16 h-16 bg-gradient-to-br from-fuchsia-600 to-purple-800 rounded-2xl flex items-center justify-center shadow-lg animate-pulse">
                    <Mic2 className="w-8 h-8 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-[9px] font-black bg-red-600 text-white px-2 py-0.5 rounded uppercase tracking-wider">On Stage</span>
                        <h3 className="text-2xl font-black text-white uppercase truncate">
                            {current?.user_nickname || "IN ATTESA..."}
                        </h3>
                    </div>
                    {current ? (
                        <div className="text-sm text-zinc-400 truncate w-full">
                            Cantando: <span className="text-white font-bold">{current.song_title}</span>
                        </div>
                    ) : (
                        <div className="text-xs text-zinc-500 uppercase tracking-widest">Nessuna esibizione in corso</div>
                    )}
                </div>
            </div>

            {/* DESTRA: PROSSIMI */}
            <div className="flex-[3] pl-8 h-full flex items-center overflow-hidden">
                <div className="mr-6 flex flex-col justify-center border-r border-white/5 pr-6 h-1/2">
                    <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Prossimi</span>
                    <span className="text-white text-sm font-bold uppercase tracking-widest">In Scaletta</span>
                </div>
                
                <div className="flex-1 flex gap-4 overflow-x-auto custom-scrollbar items-center py-2">
                    {nextSingers.length === 0 ? (
                        <span className="text-zinc-600 text-sm italic flex items-center gap-2">
                            <ListMusic className="w-4 h-4"/> La scaletta è vuota... richiedi una canzone!
                        </span>
                    ) : (
                        nextSingers.slice(0, 4).map((req, i) => (
                            <div key={i} className="bg-white/5 px-4 py-2 rounded-lg border border-white/5 flex flex-col justify-center min-w-[140px]">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-[10px] font-mono text-zinc-500">#{i+1}</span>
                                    <User className="w-3 h-3 text-zinc-600"/>
                                </div>
                                <div className="text-sm font-bold text-white truncate w-28">{req.user_nickname}</div>
                                <div className="text-[10px] text-zinc-400 truncate w-28">{req.title}</div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

// --- OVERLAY MESSAGGI (Sistema Auto-Distruzione) ---
const MessageOverlay = ({ message }) => {
    if (!message) return null;
    const isSystem = !message.participant_id;
    
    return (
        <div className="absolute top-10 left-10 z-[100] animate-in slide-in-from-left duration-500 fade-in">
            <div className={`backdrop-blur-xl border-l-8 p-6 rounded-r-2xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] max-w-2xl
               ${isSystem ? 'bg-cyan-950/90 border-cyan-400' : 'bg-fuchsia-950/90 border-fuchsia-500'}`}>
                <div className="flex items-center gap-3 mb-2">
                    <MessageSquare className={`w-5 h-5 ${isSystem ? 'text-cyan-300' : 'text-fuchsia-300'}`} />
                    <span className={`text-[10px] font-bold uppercase tracking-[0.2em] ${isSystem ? 'text-cyan-300' : 'text-fuchsia-300'}`}>
                        {message.participants?.nickname || (isSystem ? "COMUNICAZIONE REGIA" : "MESSAGGIO ANONIMO")}
                    </span>
                </div>
                <p className="text-3xl font-bold text-white leading-tight drop-shadow-md">{message.text}</p>
            </div>
        </div>
    );
};

// --- CONTENUTO PRINCIPALE ---
const MainContent = ({ data, quizResults, isMuted }) => {
    const { current_performance, active_quiz } = data;
    
    const showLeaderboard = active_quiz?.status === 'leaderboard';
    const showQuiz = active_quiz && ['active', 'closed', 'showing_results'].includes(active_quiz.status);
    const showKaraoke = current_performance && !showQuiz && !showLeaderboard;
    const isVoting = current_performance?.status === 'voting';
    const voteResult = current_performance?.status === 'ended' ? current_performance.average_score : null;

    return (
        <div className="absolute top-0 left-0 right-80 bottom-28 bg-black overflow-hidden">
            {/* LAYER MEDIA: I video stanno qui sotto */}
            
            {/* Quiz Media */}
            <div className={`absolute inset-0 transition-opacity duration-500 ${showQuiz ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}>
                <QuizMediaFixed 
                    mediaUrl={active_quiz?.media_url} mediaType={active_quiz?.media_type} 
                    isResult={active_quiz?.status === 'showing_results'} isMuted={isMuted}
                />
            </div>
            
            {/* Karaoke Media */}
            <div className={`absolute inset-0 transition-opacity duration-500 ${showKaraoke ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}>
                <KaraokePlayer 
                    url={current_performance?.youtube_url} status={current_performance?.status}
                    startedAt={current_performance?.started_at} isMuted={isMuted}
                />
            </div>

            {/* Fallback Background */}
            <div className={`absolute inset-0 bg-gradient-to-br from-zinc-900 to-black -z-10 ${(!showQuiz && !showKaraoke) ? 'opacity-100' : 'opacity-0'}`}>
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10"></div>
            </div>

            {/* LAYER UI CENTRALE */}
            <div className="absolute inset-0 z-20 flex flex-col justify-center items-center p-12">
                
                {/* QUIZ */}
                {showQuiz && (
                    <div className="w-full max-w-4xl text-center">
                        {active_quiz.status === 'showing_results' && quizResults ? (
                            <div className="animate-in zoom-in bg-black/90 p-10 rounded-[3rem] border border-white/20 shadow-2xl">
                                <h2 className="text-3xl text-zinc-400 mb-6 uppercase tracking-widest">Risposta Corretta</h2>
                                <div className="text-6xl font-black text-green-400 mb-8 drop-shadow-[0_0_15px_rgba(34,197,94,0.5)]">{quizResults.correct_option}</div>
                                <div className="grid grid-cols-2 gap-8 max-w-lg mx-auto">
                                    <div className="bg-white/5 p-4 rounded-xl"><div className="text-4xl font-bold text-white">{quizResults.correct_count}</div><div className="text-[10px] uppercase text-zinc-500">Indovinate</div></div>
                                    <div className="bg-white/5 p-4 rounded-xl"><div className="text-4xl font-bold text-zinc-500">{quizResults.total_answers}</div><div className="text-[10px] uppercase text-zinc-600">Totali</div></div>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="bg-black/80 backdrop-blur-xl p-8 rounded-3xl border border-white/10 mb-6 shadow-2xl relative">
                                    <h2 className="text-4xl md:text-5xl font-black text-white leading-tight">{active_quiz.question}</h2>
                                    <div className="absolute -top-4 -right-4 bg-yellow-500 text-black font-black px-4 py-2 rounded shadow-lg border-2 border-white rotate-3">
                                        {active_quiz.points} PT
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    {active_quiz.options.map((opt, i) => (
                                        <div key={i} className="bg-zinc-900/90 hover:bg-zinc-800 p-6 rounded-2xl border border-white/10 flex items-center gap-4 transition-all">
                                            <div className="w-10 h-10 bg-white/10 rounded flex items-center justify-center font-bold text-lg text-white">{['A','B','C','D'][i]}</div>
                                            <span className="text-xl font-bold text-white text-left">{opt}</span>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* KARAOKE OVERLAYS (Voto/Risultato) */}
                {showKaraoke && (
                    <>
                        {isVoting && (
                            <div className="bg-black/90 backdrop-blur-xl p-16 rounded-[3rem] border-2 border-yellow-500 text-center animate-in zoom-in shadow-[0_0_100px_rgba(234,179,8,0.3)]">
                                <Star className="w-24 h-24 text-yellow-500 mx-auto mb-4 animate-spin-slow"/>
                                <h2 className="text-7xl font-black text-white mb-2 uppercase italic">VOTA ORA!</h2>
                                <p className="text-2xl text-zinc-300 uppercase tracking-widest">{current_performance?.user_nickname}</p>
                            </div>
                        )}
                        {voteResult && (
                            <div className="bg-black/90 backdrop-blur-xl p-16 rounded-[3rem] border-2 border-fuchsia-500 text-center animate-in zoom-in shadow-[0_0_100px_rgba(217,70,239,0.3)]">
                                <Crown className="w-24 h-24 text-fuchsia-500 mx-auto mb-4 animate-bounce"/>
                                <div className="text-9xl font-black text-white mb-4 drop-shadow-xl">{voteResult.toFixed(1)}</div>
                                <p className="text-2xl text-zinc-400 uppercase tracking-[0.5em]">Punteggio</p>
                            </div>
                        )}
                    </>
                )}

                {/* IDLE */}
                {!showQuiz && !showKaraoke && !showLeaderboard && (
                    <div className="text-center opacity-40">
                         <Music2 className="w-24 h-24 mx-auto mb-4 text-zinc-500"/>
                         <h2 className="text-3xl font-bold text-zinc-500 uppercase tracking-widest">In attesa...</h2>
                    </div>
                )}
            </div>
        </div>
    );
};

// --- COMPONENTE ROOT ---
const PubDisplay = () => {
  const { pubCode } = useParams();
  const [data, setData] = useState(null);
  const [quizResults, setQuizResults] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [activeMessage, setActiveMessage] = useState(null);
  const [latestReaction, setLatestReaction] = useState(null);
  
  // Refs per evitare loop messaggi
  const lastMessageIdRef = useRef(null); 
  const messageTimerRef = useRef(null);
  const lastQuizIdRef = useRef(null);

  const loadData = useCallback(async () => {
    try {
      const res = await api.getDisplayData(pubCode);
      if (res.data) {
        setData(res.data);
        
        // QUIZ RESULTS Logic
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

        // MESSAGES Logic (Fix: mostra solo se ID diverso)
        if (res.data.latest_message) {
            const msg = res.data.latest_message;
            if (msg.id !== lastMessageIdRef.current) {
                setActiveMessage(msg);
                lastMessageIdRef.current = msg.id;
                
                // Clear precedente timer
                if (messageTimerRef.current) clearTimeout(messageTimerRef.current);
                
                // Set nuovo timer 7s
                messageTimerRef.current = setTimeout(() => {
                    setActiveMessage(null);
                }, 7000); 
            }
        }
      }
    } catch (e) { console.error(e); }
  }, [pubCode, quizResults]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 3000); 
    
    const channel = supabase.channel(`display_${pubCode}`)
        .on('broadcast', { event: 'control' }, (p) => { if (p.payload.command === 'mute') setIsMuted(p.payload.value); })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reactions' }, (p) => setLatestReaction({ emoji: p.new.emoji, nickname: p.new.nickname }))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'performances' }, loadData)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'quizzes' }, loadData)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, loadData)
        .subscribe();

    return () => { clearInterval(interval); supabase.removeChannel(channel); };
  }, [loadData, pubCode]);

  if (!data) return <div className="h-screen bg-black flex items-center justify-center text-white font-mono animate-pulse">CARICAMENTO...</div>;

  return (
    <div className="h-screen w-screen bg-black overflow-hidden font-sans select-none relative text-white flex">
       {/* 1. AREA PRINCIPALE (Video + Overlay) */}
       <MainContent data={data} quizResults={quizResults} isMuted={isMuted} />
       
       {/* 2. SIDEBAR DESTRA (Fissa) */}
       <SidebarRight pub={data.pub} code={pubCode} leaderboard={data.leaderboard} />

       {/* 3. BANNER SOTTO (Fisso) */}
       <BottomBanner current={data.current_performance} queue={data.queue} />

       {/* 4. NOTIFICHE EFFIMERE */}
       <MessageOverlay message={activeMessage} />
       <FloatingReactions newReaction={latestReaction} />
       {isMuted && <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[100] bg-red-600 text-white px-4 py-1 rounded-full font-bold animate-pulse shadow-lg"><VolumeX className="inline w-4 h-4 mr-2"/>AUDIO OFF</div>}
    </div>
  );
};

export default PubDisplay;