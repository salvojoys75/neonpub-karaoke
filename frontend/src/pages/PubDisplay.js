import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '@/lib/supabase';
import api from '@/lib/api';
import { 
  Music, Trophy, Mic2, MessageSquare, Crown, Star, Sparkles, 
  Radio, VolumeX, User, Music2, ListMusic
} from 'lucide-react';

import QuizMediaFixed from '@/components/QuizMediaFixed';
import KaraokePlayer from '@/components/KaraokePlayer';
import FloatingReactions from '@/components/FloatingReactions';

// --- COMPONENTI LAYOUT ---

const SidebarRight = ({ pub, code, leaderboard }) => (
  <div className="h-full w-80 bg-zinc-900/90 border-l border-white/10 flex flex-col items-center py-6 px-4 z-50 backdrop-blur-md shadow-2xl">
      {/* 1. LOGO */}
      <div className="mb-8 flex flex-col items-center">
          {pub?.logo_url ? (
            <img src={pub.logo_url} className="w-32 h-32 rounded-full border-4 border-fuchsia-600 shadow-lg object-cover mb-4 bg-black" />
          ) : (
            <div className="w-32 h-32 rounded-full bg-zinc-800 flex items-center justify-center border-4 border-white/10 mb-4">
               <Music className="w-16 h-16 text-zinc-500"/>
            </div>
          )}
          <h1 className="text-xl font-black text-white text-center uppercase leading-tight">{pub?.name}</h1>
      </div>

      {/* 2. CLASSIFICA (Verticale Compatta) */}
      <div className="flex-1 w-full overflow-hidden flex flex-col">
          <div className="flex items-center gap-2 mb-4 justify-center">
             <Trophy className="w-5 h-5 text-yellow-500" />
             <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-widest">Top Players</h2>
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto pr-1 scrollbar-hide">
              {leaderboard?.slice(0, 8).map((u, i) => (
                  <div key={i} className={`flex items-center p-2 rounded ${i===0?'bg-yellow-900/30 border border-yellow-500/30':'bg-white/5'}`}>
                      <div className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold mr-3 
                          ${i===0?'bg-yellow-500 text-black':'bg-zinc-700 text-white'}`}>{i+1}</div>
                      <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold text-white truncate">{u.nickname}</div>
                      </div>
                      <div className="text-sm font-mono text-fuchsia-400">{u.score}</div>
                  </div>
              ))}
          </div>
      </div>

      {/* 3. QR CODE */}
      <div className="mt-6 bg-white p-3 rounded-xl shadow-lg w-full flex flex-col items-center">
          <QRCodeSVG value={`${window.location.origin}/join/${code}`} size={140} level="M" />
          <div className="text-black font-black text-xl mt-2 tracking-widest">{code}</div>
          <div className="text-[10px] text-zinc-600 uppercase">Scannerizza per giocare</div>
      </div>
  </div>
);

const BottomBanner = ({ current, queue }) => {
    // Prossimi cantanti (escludi quello corrente se c'è duplicazione, ma l'API dovrebbe gestirlo)
    const nextSingers = queue || [];

    return (
        <div className="h-24 bg-black/80 border-t border-white/10 flex items-center px-8 z-40 backdrop-blur-md absolute bottom-0 left-0 right-80">
            {/* ORA IN ONDA (Sinistra) */}
            <div className="flex-[2] flex items-center gap-6 border-r border-white/10 pr-6">
                <div className="w-16 h-16 bg-fuchsia-600 rounded-full flex items-center justify-center animate-pulse shadow-[0_0_20px_rgba(217,70,239,0.5)]">
                    <Mic2 className="w-8 h-8 text-white" />
                </div>
                <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-bold bg-red-600 text-white px-2 py-0.5 rounded uppercase">On Stage</span>
                        <h3 className="text-2xl font-bold text-white uppercase truncate max-w-[300px]">
                            {current?.user_nickname || "In Attesa..."}
                        </h3>
                    </div>
                    {current ? (
                        <div className="text-sm text-zinc-400 truncate max-w-[400px]">
                            <span className="text-white font-bold">{current.song_title}</span> • {current.song_artist}
                        </div>
                    ) : (
                        <div className="text-sm text-zinc-500">Nessuna esibizione in corso</div>
                    )}
                </div>
            </div>

            {/* PROSSIMI (Destra) */}
            <div className="flex-[3] pl-6 overflow-hidden flex items-center gap-4">
                <div className="text-zinc-500 text-xs font-bold uppercase tracking-widest w-16 leading-tight">Prossimi<br/>Cantanti</div>
                <div className="flex-1 flex gap-4 overflow-x-auto scrollbar-hide items-center">
                    {nextSingers.length === 0 ? (
                        <span className="text-zinc-600 text-sm italic">Scaletta vuota... richiedi una canzone!</span>
                    ) : (
                        nextSingers.slice(0, 3).map((req, i) => (
                            <div key={i} className="bg-zinc-800/80 px-4 py-2 rounded-lg border border-white/5 flex items-center gap-3 min-w-[200px]">
                                <span className="text-xs font-mono text-zinc-500">#{i+1}</span>
                                <div>
                                    <div className="text-sm font-bold text-white truncate w-32">{req.user_nickname}</div>
                                    <div className="text-[10px] text-zinc-400 truncate w-32">{req.title}</div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

const MessageOverlay = ({ message }) => {
    if (!message) return null;
    const isSystem = !message.participant_id;
    
    return (
        <div className="absolute top-8 left-8 z-[100] animate-in slide-in-from-left duration-500">
            <div className={`backdrop-blur-xl border-l-8 p-6 rounded-r-2xl shadow-2xl max-w-2xl
               ${isSystem ? 'bg-cyan-900/90 border-cyan-400' : 'bg-fuchsia-900/90 border-fuchsia-500'}`}>
                <div className="flex items-center gap-3 mb-2">
                    <MessageSquare className={`w-5 h-5 ${isSystem ? 'text-cyan-300' : 'text-fuchsia-300'}`} />
                    <span className={`text-xs font-bold uppercase tracking-widest ${isSystem ? 'text-cyan-300' : 'text-fuchsia-300'}`}>
                        {message.participants?.nickname || (isSystem ? "COMUNICAZIONE REGIA" : "ANONIMO")}
                    </span>
                </div>
                <p className="text-3xl font-bold text-white leading-tight drop-shadow-md">{message.text}</p>
            </div>
        </div>
    );
};

// --- SCENE PRINCIPALI ---

const MainArea = ({ data, quizResults, isMuted }) => {
    const { current_performance, active_quiz } = data;
    
    const showLeaderboard = active_quiz?.status === 'leaderboard';
    const showQuiz = active_quiz && ['active', 'closed', 'showing_results'].includes(active_quiz.status);
    const showKaraoke = current_performance && !showQuiz && !showLeaderboard;
    const isVoting = current_performance?.status === 'voting';
    const voteResult = current_performance?.status === 'ended' ? current_performance.average_score : null;

    return (
        <div className="flex-1 relative h-full bg-black overflow-hidden">
            {/* LAYER 1: VIDEO MEDIA */}
            <div className={`absolute inset-0 transition-opacity duration-500 ${showQuiz ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}>
                <QuizMediaFixed 
                    mediaUrl={active_quiz?.media_url} mediaType={active_quiz?.media_type} 
                    isResult={active_quiz?.status === 'showing_results'} isMuted={isMuted}
                />
            </div>
            <div className={`absolute inset-0 transition-opacity duration-500 ${showKaraoke ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}>
                <KaraokePlayer 
                    url={current_performance?.youtube_url} status={current_performance?.status}
                    startedAt={current_performance?.started_at} isMuted={isMuted}
                />
            </div>

            {/* LAYER 2: INTERFACCIA CENTRALE */}
            <div className="absolute inset-0 z-20 flex flex-col justify-center items-center p-12 pb-32">
                
                {/* QUIZ UI */}
                {showQuiz && (
                    <div className="w-full max-w-5xl text-center">
                        {active_quiz.status === 'showing_results' && quizResults ? (
                            <div className="animate-in zoom-in bg-black/90 p-12 rounded-[3rem] border border-white/20">
                                <h2 className="text-4xl text-zinc-400 mb-6 uppercase">La risposta è</h2>
                                <div className="text-7xl font-black text-green-400 mb-8">{quizResults.correct_option}</div>
                                <div className="flex justify-center gap-12 text-2xl">
                                    <div><b className="text-white">{quizResults.correct_count}</b> <span className="text-zinc-500 text-sm uppercase">Indovinate</span></div>
                                    <div><b className="text-zinc-500">{quizResults.total_answers}</b> <span className="text-zinc-600 text-sm uppercase">Totali</span></div>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="bg-black/80 backdrop-blur-xl p-8 rounded-3xl border border-white/10 mb-8 shadow-2xl">
                                    <h2 className="text-5xl font-black text-white leading-tight">{active_quiz.question}</h2>
                                    <div className="absolute -top-6 -right-6 bg-yellow-500 text-black font-black px-4 py-2 rounded rotate-6 shadow-lg border-2 border-white">
                                        {active_quiz.points} PUNTI
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    {active_quiz.options.map((opt, i) => (
                                        <div key={i} className="bg-zinc-900/90 p-6 rounded-2xl border border-white/10 flex items-center gap-4">
                                            <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center font-bold text-xl">{['A','B','C','D'][i]}</div>
                                            <span className="text-2xl font-bold">{opt}</span>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* KARAOKE UI */}
                {showKaraoke && (
                    <>
                        {isVoting && (
                            <div className="bg-black/80 backdrop-blur-xl p-16 rounded-[3rem] border-2 border-yellow-500 text-center animate-in zoom-in">
                                <Star className="w-24 h-24 text-yellow-500 mx-auto mb-4 animate-spin-slow"/>
                                <h2 className="text-6xl font-black mb-2">VOTA ORA!</h2>
                                <p className="text-3xl text-zinc-300 uppercase">{current_performance?.user_nickname}</p>
                            </div>
                        )}
                        {voteResult && (
                            <div className="bg-black/80 backdrop-blur-xl p-16 rounded-[3rem] border-2 border-fuchsia-500 text-center animate-in zoom-in">
                                <Crown className="w-24 h-24 text-fuchsia-500 mx-auto mb-4 animate-bounce"/>
                                <div className="text-9xl font-black text-white mb-4">{voteResult.toFixed(1)}</div>
                                <p className="text-2xl text-zinc-400 uppercase">Punteggio Finale</p>
                            </div>
                        )}
                    </>
                )}

                {/* ATTESA */}
                {!showQuiz && !showKaraoke && !showLeaderboard && (
                    <div className="text-center opacity-50">
                        <Music2 className="w-32 h-32 mx-auto mb-6 text-zinc-600"/>
                        <h2 className="text-4xl font-bold text-zinc-500">IN ATTESA DELLA PROSSIMA ATTIVITÀ...</h2>
                    </div>
                )}
            </div>
        </div>
    );
};

// --- COMPONENTE PRINCIPALE ---

const PubDisplay = () => {
  const { pubCode } = useParams();
  const [data, setData] = useState(null);
  const [quizResults, setQuizResults] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [activeMessage, setActiveMessage] = useState(null);
  const [latestReaction, setLatestReaction] = useState(null);
  
  // Ref per tracciare l'ID dell'ultimo messaggio mostrato per evitare loop
  const processedMessageIdRef = useRef(null);
  const messageTimeoutRef = useRef(null);
  const lastQuizIdRef = useRef(null);

  const loadData = useCallback(async () => {
    try {
      const res = await api.getDisplayData(pubCode);
      if (res.data) {
        setData(res.data);
        
        // Quiz Results Logic
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

        // Logic Messaggi (CORRETTA PER EVITARE LOOP)
        if (res.data.latest_message) {
            const msg = res.data.latest_message;
            // Mostra solo se l'ID è diverso dall'ultimo processato E non c'è già un messaggio attivo
            if (msg.id !== processedMessageIdRef.current) {
                setActiveMessage(msg);
                processedMessageIdRef.current = msg.id; // Segna come visto
                
                if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current);
                messageTimeoutRef.current = setTimeout(() => {
                    setActiveMessage(null); // Nascondi dopo 7 sec
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

  if (!data) return <div className="h-screen bg-black flex items-center justify-center text-white animate-pulse">CARICAMENTO...</div>;

  return (
    <div className="h-screen w-screen bg-black overflow-hidden font-sans select-none relative text-white flex">
       {/* ZONA CENTRALE (Video + Overlay) */}
       <MainArea data={data} quizResults={quizResults} isMuted={isMuted} />
       
       {/* SIDEBAR DESTRA (Fissa) */}
       <SidebarRight pub={data.pub} code={pubCode} leaderboard={data.leaderboard} />

       {/* BANNER SOTTO (Fisso) */}
       <BottomBanner current={data.current_performance} queue={data.queue} />

       {/* OVERLAY EFFIMERI */}
       <MessageOverlay message={activeMessage} />
       <FloatingReactions newReaction={latestReaction} />
       {isMuted && <div className="absolute top-4 right-[340px] z-[100] bg-red-600 text-white px-3 py-1 rounded font-bold animate-pulse"><VolumeX className="inline w-4 h-4 mr-1"/> MUTE</div>}
    </div>
  );
};

export default PubDisplay;