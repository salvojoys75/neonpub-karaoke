import { useState, useEffect, useCallback, useRef, memo } from "react";
import { useParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { Mic2, Trophy, Star, MessageSquare } from "lucide-react";
import api from "@/lib/api";
import { supabase } from "@/lib/supabase";
import QuizMediaFixed from "@/components/QuizMediaFixed";

// ===========================================
// UTILS
// ===========================================
const getYoutubeId = (url) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
};

// ===========================================
// COMPONENTE: KARAOKE SCREEN
// ===========================================
const KaraokeScreen = memo(({ performance, isVoting, voteResult }) => {
    const playerRef = useRef(null);
    const prevStartedAt = useRef(performance?.started_at);

    useEffect(() => {
        if (!performance || isVoting || voteResult) return;
        const videoId = getYoutubeId(performance.youtube_url);
        if (!videoId) return;

        const onPlayerReady = (event) => {
            if (performance.status === 'live') event.target.playVideo();
            else if (performance.status === 'paused') event.target.pauseVideo();
        };

        if (!window.YT) {
            const tag = document.createElement('script');
            tag.src = "https://www.youtube.com/iframe_api";
            const firstScriptTag = document.getElementsByTagName('script')[0];
            firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
            
            window.onYouTubeIframeAPIReady = () => {
                createPlayer(videoId, onPlayerReady);
            };
        } else if (!playerRef.current) {
             createPlayer(videoId, onPlayerReady);
        } else {
             const currentVideoData = playerRef.current.getVideoData();
             if (currentVideoData && currentVideoData.video_id !== videoId) {
                 playerRef.current.loadVideoById(videoId);
             }
             
             if (playerRef.current && typeof playerRef.current.playVideo === 'function') {
                 if (performance.status === 'live') playerRef.current.playVideo();
                 else if (performance.status === 'paused') playerRef.current.pauseVideo();

                 if (performance.started_at !== prevStartedAt.current) {
                      prevStartedAt.current = performance.started_at; 
                      playerRef.current.seekTo(0);
                      playerRef.current.playVideo();
                 }
             }
        }
    }, [performance, isVoting, voteResult]);

    const createPlayer = (videoId, onReady) => {
        playerRef.current = new window.YT.Player('karaoke-player', {
            videoId: videoId,
            playerVars: { 
                autoplay: 1, controls: 0, disablekb: 1, fs: 0, iv_load_policy: 3, 
                modestbranding: 1, rel: 0, showinfo: 0, origin: window.location.origin 
            },
            events: { onReady: onReady }
        });
    };

    useEffect(() => {
        const el = document.getElementById('karaoke-player');
        if ((isVoting || voteResult) && playerRef.current && typeof playerRef.current.pauseVideo === 'function') {
            playerRef.current.pauseVideo();
            if(el) el.style.visibility = 'hidden';
        } else {
            if(el) el.style.visibility = 'visible';
        }
    }, [isVoting, voteResult]);

    return (
        <div className="absolute inset-0 bg-black flex flex-col justify-center overflow-hidden">
            <div id="karaoke-player" className="absolute inset-0 w-full h-full z-0 pointer-events-none" />
            
            {!isVoting && !voteResult && (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/80 to-transparent p-12 z-10 pb-20 animate-fade-in">
                    <h2 className="text-6xl font-black text-white mb-2 drop-shadow-lg">{performance.song_title}</h2>
                    <div className="flex items-end gap-6">
                        <p className="text-4xl text-zinc-300 font-medium">{performance.song_artist}</p>
                        <div className="bg-fuchsia-600 px-6 py-2 rounded-full flex items-center gap-3 animate-pulse">
                            <Mic2 className="w-8 h-8" />
                            <span className="text-2xl font-bold uppercase tracking-wider">{performance.user_nickname}</span>
                        </div>
                    </div>
                </div>
            )}

            {isVoting && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-zinc-900 animate-zoom-in">
                    <h2 className="text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-600 mb-8 animate-pulse drop-shadow-lg">VOTA ORA!</h2>
                    <div className="bg-white/10 p-16 rounded-full border-8 border-yellow-500 shadow-[0_0_100px_rgba(234,179,8,0.5)] animate-spin-slow">
                        <Star className="w-48 h-48 text-yellow-500 fill-yellow-500" />
                    </div>
                </div>
            )}

            {voteResult !== null && (
                <div className="absolute inset-0 z-25 flex flex-col items-center justify-center bg-black/95 animate-fade-in">
                    <h2 className="text-6xl text-white font-bold mb-8">MEDIA VOTO</h2>
                    <div className="flex items-center gap-6">
                        <Star className="w-32 h-32 text-yellow-400 fill-yellow-400 animate-bounce" />
                        <span className="text-[12rem] font-black text-white leading-none">{Number(voteResult).toFixed(1)}</span>
                    </div>
                </div>
            )}
        </div>
    );
}, (prev, next) => {
    return (
        prev.performance?.id === next.performance?.id &&
        prev.performance?.status === next.performance?.status &&
        prev.performance?.started_at === next.performance?.started_at &&
        prev.isVoting === next.isVoting &&
        prev.voteResult === next.voteResult
    );
});

KaraokeScreen.displayName = 'KaraokeScreen';

// ===========================================
// COMPONENTE: QUIZ SCREEN (FIXED STRUCTURE)
// ===========================================
const QuizScreen = memo(({ quiz, quizResults, leaderboard }) => {
    
    // Stato: Leaderboard, Risultati o Domanda
    const isLeaderboard = quiz.status === 'leaderboard';
    const isResults = !!quizResults;
    // Cinema mode: Se video playing e NON siamo in classifica o risultati, nascondi il testo
    const isCinemaMode = quiz.media_type === 'video' && quiz.media_state === 'playing' && !isResults && !isLeaderboard;

    return (
        <div className="absolute inset-0 bg-black z-40 flex flex-col items-center justify-center overflow-hidden">
            
            {/* LAYER 0: MEDIA PLAYER (Sempre presente, mai smontato) */}
            <div className="absolute inset-0 z-0">
                <QuizMediaFixed 
                    mediaUrl={quiz.media_url} 
                    mediaType={quiz.media_type} 
                    // Nascondi video (ma non smontare) se siamo in leaderboard o results
                    isResult={isResults || isLeaderboard} 
                    mediaState={quiz.media_state} 
                />
            </div>

            {/* LAYER 1: CONTENT (Domanda o Classifica) */}
            <div className={`absolute inset-0 z-10 w-full h-full transition-colors duration-500 ${isLeaderboard ? 'bg-zinc-900' : 'bg-transparent'}`}>
                
                {/* A: CLASSIFICA */}
                {isLeaderboard && (
                    <div className="absolute inset-0 flex flex-col p-8 overflow-hidden animate-fade-in z-50">
                        <div className="text-center mb-6">
                            <h1 className="text-6xl font-black text-yellow-500 uppercase drop-shadow-[0_0_15px_rgba(234,179,8,0.5)]">CLASSIFICA GENERALE</h1>
                        </div>
                        <div className="flex-1 overflow-y-auto grid grid-cols-2 gap-x-12 gap-y-4 px-12 content-start custom-scrollbar">
                            {leaderboard.map((p, i) => (
                                <div key={p.id} className={`flex items-center p-4 rounded-xl text-3xl font-bold transform transition-all ${i<3 ? 'scale-105 bg-gradient-to-r from-yellow-600/30 to-transparent border border-yellow-500/50' : 'bg-white/5'}`}>
                                    <span className={`w-16 h-16 flex items-center justify-center rounded-full mr-6 text-2xl border-4 ${i===0 ? 'bg-yellow-500 text-black border-yellow-300' : i===1 ? 'bg-zinc-400 text-black border-zinc-200' : i===2 ? 'bg-amber-700 text-white border-amber-500' : 'bg-zinc-800 text-zinc-500 border-zinc-600'}`}>
                                        {i+1}
                                    </span>
                                    <span className="flex-1 truncate text-white">{p.nickname}</span>
                                    <span className="text-yellow-400 font-mono">{p.score}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* B: DOMANDA / RISULTATI */}
                {!isLeaderboard && (
                    <div className={`w-full h-full flex items-center justify-center transition-all duration-700 ease-in-out ${isCinemaMode ? 'opacity-0 translate-y-20 pointer-events-none' : 'opacity-100 translate-y-0'}`}>
                        <div className="w-full max-w-6xl text-center p-8">
                            {!isResults ? (
                                <div className="animate-zoom-in">
                                    <div className="mb-8">
                                         <span className={`px-12 py-4 rounded-full text-4xl font-black uppercase tracking-widest shadow-[0_0_30px_rgba(217,70,239,0.6)] ${quiz.status === 'closed' ? 'bg-red-600 text-white' : 'bg-fuchsia-600 text-white animate-pulse'}`}>
                                            {quiz.status === 'closed' ? "STOP AL TELEVOTO!" : "QUIZ IN ONDA"}
                                         </span>
                                    </div>
                                    
                                    <div className="bg-black/70 backdrop-blur-md p-10 rounded-[3rem] border border-white/10 shadow-2xl">
                                        <h2 className="text-7xl font-black text-white mb-12 leading-tight drop-shadow-2xl">
                                            {quiz.question}
                                        </h2>
                                        <div className="grid grid-cols-2 gap-8">
                                            {quiz.options.map((opt, i) => (
                                                <div key={i} className={`p-8 rounded-3xl text-5xl font-bold border-4 transition-all transform ${quiz.status === 'closed' ? 'border-zinc-700 text-zinc-500 bg-zinc-900/50' : 'border-white/20 bg-white/10 text-white shadow-xl'}`}>
                                                    <span className="text-fuchsia-500 mr-4">{String.fromCharCode(65+i)}.</span> {opt}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="animate-zoom-in">
                                    <div className="mb-8">
                                        <h1 className="text-6xl font-black text-yellow-500 uppercase mb-6 drop-shadow-[0_0_15px_rgba(234,179,8,0.5)]">RISULTATI</h1>
                                    </div>
                                    
                                    <div className="bg-black/70 backdrop-blur-md p-10 rounded-[3rem] border border-white/10 shadow-2xl">
                                        <h2 className="text-5xl font-black text-white mb-12 leading-tight">{quiz.question}</h2>
                                        
                                        <div className="grid grid-cols-2 gap-8 mb-12">
                                            {quiz.options.map((opt, i) => {
                                                const isCorrect = i === quiz.correct_answer;
                                                const votes = quizResults.find(r => r.answer === i)?.count || 0;
                                                const totalVotes = quizResults.reduce((sum, r) => sum + r.count, 0);
                                                const percentage = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
                                                
                                                return (
                                                    <div key={i} className={`relative p-8 rounded-3xl text-4xl font-bold border-4 ${isCorrect ? 'border-green-500 bg-green-500/20' : 'border-zinc-700 bg-zinc-900/50'}`}>
                                                        <div className="flex items-center justify-between mb-4">
                                                            <div className="flex items-center gap-4">
                                                                <span className={isCorrect ? 'text-green-400' : 'text-zinc-500'}>{String.fromCharCode(65+i)}.</span>
                                                                <span className={isCorrect ? 'text-white' : 'text-zinc-500'}>{opt}</span>
                                                            </div>
                                                            {isCorrect && <span className="text-6xl">✓</span>}
                                                        </div>
                                                        <div className="flex items-center gap-4 text-3xl">
                                                            <span className={isCorrect ? 'text-green-400 font-mono' : 'text-zinc-400 font-mono'}>{percentage}%</span>
                                                            <span className={isCorrect ? 'text-green-300' : 'text-zinc-500'}>({votes} {votes === 1 ? 'voto' : 'voti'})</span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
});

QuizScreen.displayName = 'QuizScreen';

// ===========================================
// COMPONENTE PRINCIPALE: PUB DISPLAY
// ===========================================
export default function PubDisplay() {
  const { pubCode } = useParams();
  const [displayData, setDisplayData] = useState(null);
  const [ticker, setTicker] = useState("");
  
  const [floatingReactions, setFloatingReactions] = useState([]);
  const [flashMessages, setFlashMessages] = useState([]);
  
  const [quizResults, setQuizResults] = useState(null);
  const [voteResult, setVoteResult] = useState(null);

  const loadDisplayData = useCallback(async () => {
    try {
      const { data } = await api.getDisplayData(pubCode);
      setDisplayData(data);
      
      if (data.queue?.length > 0) {
        setTicker(data.queue.slice(0, 5).map((s, i) => `${i + 1}. ${s.title} (${s.user_nickname})`).join(' • '));
      } else {
        setTicker("Inquadra il QR Code per cantare!");
      }

      if (data.current_performance?.status === 'ended' && !voteResult && data.current_performance.average_score > 0) {
         setVoteResult(data.current_performance.average_score);
         setTimeout(() => setVoteResult(null), 10000);
      }
    } catch (error) { console.error(error); }
  }, [pubCode, voteResult]);

  useEffect(() => {
    loadDisplayData();
    const interval = setInterval(loadDisplayData, 3000);
    return () => clearInterval(interval);
  }, [loadDisplayData]);

  useEffect(() => {
    if (!displayData?.pub?.id) return;
    
    // MUTE GLOBAL
    const controlChannel = supabase.channel(`display_control_${pubCode}`)
        .on('broadcast', { event: 'control' }, (payload) => {
            if(payload.payload.command === 'mute') {
                const ytKaraoke = window.YT?.get && window.YT.get('karaoke-player');
                if (ytKaraoke && typeof ytKaraoke.mute === 'function') {
                    if (payload.payload.value) ytKaraoke.mute(); else ytKaraoke.unMute();
                }
                const ytQuiz = window.YT?.get && window.YT.get('quiz-fixed-player');
                // Nota: Per il quiz, essendo gestito da QuizMediaFixed, 
                // l'evento potrebbe essere gestito internamente se necessario,
                // ma per ora il focus è sul karaoke.
            }
        })
        .subscribe();

    const channel = supabase.channel(`display_realtime`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'performances', filter: `event_id=eq.${displayData.pub.id}` }, 
            (payload) => {
                setDisplayData(prev => ({ ...prev, current_performance: payload.new }));
                if (payload.new.status === 'voting' || payload.new.status === 'ended') {
                    loadDisplayData();
                }
            }
        )
        .on('postgres_changes', { event: '*', schema: 'public', table: 'song_requests', filter: `event_id=eq.${displayData.pub.id}` },
            async (payload) => {
                const { data: queueData } = await supabase
                    .from('song_requests')
                    .select('*, participants(nickname)')
                    .eq('event_id', displayData.pub.id)
                    .eq('status', 'queued')
                    .limit(10);
                
                const queue = queueData?.map(q => ({...q, user_nickname: q.participants?.nickname})) || [];
                setDisplayData(prev => ({ ...prev, queue }));
                
                if (queue.length > 0) {
                    setTicker(queue.slice(0, 5).map((s, i) => `${i + 1}. ${s.title} (${s.user_nickname})`).join(' • '));
                } else {
                    setTicker("Inquadra il QR Code per cantare!");
                }
            }
        )
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reactions', filter: `event_id=eq.${displayData.pub.id}` }, 
            (payload) => addFloatingReaction(payload.new.emoji, payload.new.nickname)
        )
        .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `event_id=eq.${displayData.pub.id}` }, 
            async (payload) => {
                 if(payload.new.status === 'approved') {
                     let nick = "Regia";
                     if(payload.new.participant_id) {
                         const { data } = await supabase.from('participants').select('nickname').eq('id', payload.new.participant_id).single();
                         if(data) nick = data.nickname;
                     }
                     showFlashMessage({ text: payload.new.text, nickname: nick });
                 }
            }
        )
        .on('postgres_changes', { event: '*', schema: 'public', table: 'participants', filter: `event_id=eq.${displayData.pub.id}` },
            async (payload) => {
                const { data: lbData } = await supabase
                    .from('participants')
                    .select('id, nickname, score')
                    .eq('event_id', displayData.pub.id)
                    .order('score', { ascending: false })
                    .limit(20);
                setDisplayData(prev => ({ ...prev, leaderboard: lbData || [] }));
            }
        )
        .on('postgres_changes', { event: '*', schema: 'public', table: 'quizzes', filter: `event_id=eq.${displayData.pub.id}` }, 
            async (payload) => {
                const updatedQuiz = payload.new;
                
                // OPTIMIZATION: Solo aggiornamenti reali
                setDisplayData(prev => {
                    const current = prev.active_quiz;
                    if (!current) return { ...prev, active_quiz: updatedQuiz };
                    
                    const relevantFieldsChanged = (
                        current.status !== updatedQuiz.status ||
                        current.media_state !== updatedQuiz.media_state ||
                        current.media_url !== updatedQuiz.media_url ||
                        current.question !== updatedQuiz.question
                    );
                    
                    if (!relevantFieldsChanged) return prev;
                    return { ...prev, active_quiz: updatedQuiz };
                });
                
                if (updatedQuiz.status === 'active' || updatedQuiz.status === 'closed') { 
                    setQuizResults(null); 
                } else if (updatedQuiz.status === 'showing_results') {
                    const res = await api.getQuizResults(updatedQuiz.id); 
                    setQuizResults(res.data);
                } else if (updatedQuiz.status === 'ended') {
                    setTimeout(() => { 
                        setDisplayData(prev => ({ ...prev, active_quiz: null })); 
                        setQuizResults(null); 
                    }, 5000);
                }
            }
        )
        .subscribe();

    return () => {
        supabase.removeChannel(channel);
        supabase.removeChannel(controlChannel);
    }
  }, [displayData?.pub?.id, pubCode, loadDisplayData]);

  const showFlashMessage = (msg) => {
    const id = Date.now();
    setFlashMessages(prev => [...prev, { ...msg, internalId: id }]);
    setTimeout(() => setFlashMessages(prev => prev.filter(m => m.internalId !== id)), 10000);
  };

  const addFloatingReaction = (emoji, nickname) => {
    const id = Date.now() + Math.random();
    const left = Math.random() * 80 + 10;
    setFloatingReactions(prev => [...prev, { id, emoji, nickname, left }]);
    setTimeout(() => setFloatingReactions(prev => prev.filter(r => r.id !== id)), 4000);
  };

  const currentPerf = displayData?.current_performance;
  const activeQuiz = displayData?.active_quiz;
  const joinUrl = `${window.location.origin}/join/${pubCode}`;
  
  // VISIBILITY LOGIC
  const showQuiz = activeQuiz && activeQuiz.status !== 'ended';
  const isLeaderboardMode = activeQuiz && activeQuiz.status === 'leaderboard';
  const showKaraoke = !showQuiz && currentPerf && (currentPerf.status === 'live' || currentPerf.status === 'paused' || currentPerf.status === 'restarted' || currentPerf.status === 'voting' || voteResult);
  const showWaiting = !showQuiz && !showKaraoke;

  return (
    <div className="h-screen bg-black text-white overflow-hidden flex flex-col font-sans">
      
      {/* HEADER */}
      <div className="h-16 bg-zinc-900 flex items-center px-6 border-b border-zinc-800 z-[100] relative shadow-xl">
         <div className="font-bold text-xl mr-8 text-fuchsia-500">{displayData?.pub?.name || "NEONPUB"}</div>
         <div className="flex-1 overflow-hidden relative h-full flex items-center">
            <div className="ticker-container w-full"><div className="ticker-content text-lg font-medium text-cyan-300">{ticker}</div></div>
         </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 relative bg-black flex flex-col justify-center overflow-hidden">
           
           {/* 1. QUIZ (Z-INDEX 50 when active) */}
           <div className={`absolute inset-0 transition-opacity duration-500 ${
               showQuiz 
                   ? 'opacity-100 z-50 pointer-events-auto' 
                   : 'opacity-0 z-0 pointer-events-none'
           }`}>
               {activeQuiz && (
                   <QuizScreen 
                       quiz={activeQuiz} 
                       quizResults={quizResults} 
                       leaderboard={displayData?.leaderboard || []} 
                   />
               )}
           </div>

           {/* 2. KARAOKE (Z-INDEX 40 when active) */}
           <div className={`absolute inset-0 transition-opacity duration-500 ${
               showKaraoke 
                   ? 'opacity-100 z-40 pointer-events-auto' 
                   : 'opacity-0 z-0 pointer-events-none'
           }`}>
               {currentPerf && (
                   <KaraokeScreen 
                       performance={currentPerf} 
                       isVoting={currentPerf.status === 'voting'} 
                       voteResult={voteResult} 
                   />
               )}
           </div>

           {/* 3. WAITING (Z-INDEX 30 when active) */}
           <div className={`absolute inset-0 transition-opacity duration-500 ${
               showWaiting 
                   ? 'opacity-100 z-30 pointer-events-auto' 
                   : 'opacity-0 z-0 pointer-events-none'
           }`}>
               <div className="flex flex-col items-center justify-center h-full bg-zinc-950 animate-fade-in relative">
                   <h2 className="text-7xl font-bold mb-8 text-white">PROSSIMO CANTANTE... TU?</h2>
                   <div className="bg-white p-6 rounded-3xl shadow-[0_0_50px_rgba(255,255,255,0.2)]">
                       <QRCodeSVG value={joinUrl} size={300} />
                   </div>
                   <p className="text-4xl text-zinc-400 mt-8 font-mono tracking-widest">{pubCode}</p>
               </div>
           </div>

        </div>

        {/* SIDEBAR - Hide if Quiz Leaderboard is active (needs full width) */}
        {!isLeaderboardMode && (
            <div className="w-[350px] bg-zinc-900/95 border-l border-zinc-800 flex flex-col z-[60] shadow-2xl relative">
                <div className="p-6 flex flex-col items-center bg-white/5 border-b border-white/10">
                    <div className="bg-white p-3 rounded-xl mb-3 shadow-lg transform hover:scale-105 transition"><QRCodeSVG value={joinUrl} size={150} /></div>
                    <p className="font-mono text-3xl font-bold text-cyan-400 tracking-widest drop-shadow">{pubCode}</p>
                </div>
                
                <div className="flex-1 overflow-hidden flex flex-col p-8 items-center justify-center text-center space-y-6">
                    {displayData?.pub?.logo_url ? (
                        <img src={displayData.pub.logo_url} alt="Logo" className="w-40 h-40 object-contain drop-shadow-2xl"/>
                    ) : (
                        <div className="w-40 h-40 bg-zinc-800 rounded-full flex items-center justify-center text-zinc-600 text-4xl font-bold border-4 border-zinc-700">LOGO</div>
                    )}
                    <div className="mt-2">
                        <h2 className="text-3xl font-black text-white uppercase tracking-wider">{displayData?.pub?.name || "NEONPUB"}</h2>
                    </div>
                </div>

                <div className="h-[35%] border-t border-white/10 p-4 bg-gradient-to-b from-zinc-900 to-black">
                    <h3 className="text-lg font-bold text-yellow-500 mb-4 flex items-center gap-2 uppercase tracking-wider"><Trophy className="w-5 h-5"/> Top Player</h3>
                    <div className="space-y-2 overflow-y-auto custom-scrollbar h-full pb-4">
                        {(displayData?.leaderboard || []).slice(0, 5).map((p, i) => (
                            <div key={p.id} className={`flex justify-between items-center p-2 rounded ${i===0 ? 'bg-yellow-500/20 border border-yellow-500/30' : ''}`}>
                                <div className="flex items-center gap-3">
                                    <span className={`font-bold w-6 h-6 flex items-center justify-center rounded-full text-xs ${i===0 ? 'bg-yellow-500 text-black' : 'bg-zinc-800 text-zinc-400'}`}>{i+1}</span>
                                    <span className={`font-medium ${i===0 ? 'text-white' : 'text-zinc-300'}`}>{p.nickname}</span>
                                </div>
                                <span className="text-cyan-400 font-mono font-bold">{p.score}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )}
      </div>

      {/* OVERLAYS */}
      <div className="reactions-overlay pointer-events-none fixed inset-0 z-[100] overflow-hidden">
        {floatingReactions.map(r => (
            <div key={r.id} className="absolute flex flex-col items-center animate-float-up" style={{ left: `${r.left}%`, bottom: '-50px' }}>
              <span className="text-7xl filter drop-shadow-2xl">{r.emoji}</span>
              <span className="text-xl text-white font-bold mt-1 bg-black/70 px-4 py-1 rounded-full border border-white/20 shadow-xl">{r.nickname}</span>
            </div>
        ))}
      </div>

      {flashMessages.length > 0 && (
        <div className="fixed top-24 left-8 z-[110] w-2/3 max-w-4xl flex flex-col gap-4 pointer-events-none">
          {flashMessages.map(msg => (
            <div key={msg.internalId} className="bg-black/90 backdrop-blur-xl border-l-8 border-cyan-500 text-white p-6 rounded-r-2xl shadow-2xl animate-slide-in-left flex items-start gap-6">
              <div className="bg-cyan-500/20 p-4 rounded-full"><MessageSquare className="w-10 h-10 text-cyan-400" /></div>
              <div>
                <p className="text-sm text-cyan-400 font-bold uppercase tracking-widest mb-1">{msg.nickname === 'Regia' ? '📢 MESSAGGIO DALLA REGIA' : `Messaggio da ${msg.nickname}`}</p>
                <p className="text-4xl font-bold leading-tight">{msg.text}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <style jsx>{`
        .ticker-container { width: 100%; overflow: hidden; }
        .ticker-content { display: inline-block; white-space: nowrap; animation: ticker 30s linear infinite; }
        @keyframes ticker { 0% { transform: translateX(100%); } 100% { transform: translateX(-100%); } }
        .animate-float-up { animation: floatUp 4s ease-out forwards; }
        @keyframes floatUp { 0% { transform: translateY(0) scale(0.5); opacity: 0; } 10% { opacity: 1; } 90% { opacity: 1; } 100% { transform: translateY(-80vh) scale(1.5); opacity: 0; } }
        .animate-spin-slow { animation: spin 8s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
        .animate-slide-in-left { animation: slideInLeft 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
        @keyframes slideInLeft { from { transform: translateX(-100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        .animate-zoom-in { animation: zoomIn 0.4s ease-out; }
        @keyframes zoomIn { from { transform: scale(0.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .animate-fade-in { animation: fadeIn 0.5s ease-out; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #444; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
      `}</style>
    </div>
  );
}