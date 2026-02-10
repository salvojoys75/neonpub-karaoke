import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { Mic2, Trophy, Star, MessageSquare, Music, Film, Clock } from "lucide-react";
import api from "@/lib/api";
import { supabase } from "@/lib/supabase";

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
const KaraokeScreen = ({ performance, isVoting, voteResult }) => {
    const playerRef = useRef(null);
    const prevStatus = useRef(performance?.status);

    useEffect(() => {
        if (!performance || isVoting || voteResult) return;
        const videoId = getYoutubeId(performance.youtube_url);
        if (!videoId) return;

        const onPlayerReady = (event) => {
            if (performance.status === 'live') event.target.playVideo();
            else event.target.pauseVideo();
        };

        if (!window.YT) return;

        if (!playerRef.current) {
            playerRef.current = new window.YT.Player('karaoke-player', {
                videoId: videoId,
                playerVars: { autoplay: 1, controls: 0, disablekb: 1, fs: 0, iv_load_policy: 3, modestbranding: 1, rel: 0, showinfo: 0 },
                events: { onReady: onPlayerReady }
            });
        } else {
             const currentData = playerRef.current.getVideoData();
             if(currentData && currentData.video_id !== videoId) {
                 playerRef.current.loadVideoById(videoId);
             }
             if (performance.status !== prevStatus.current) {
                 if (performance.status === 'live') playerRef.current.playVideo();
                 else if (performance.status === 'paused') playerRef.current.pauseVideo();
                 prevStatus.current = performance.status;
             }
        }
    }, [performance, isVoting, voteResult]);

    // Nascondi player visivamente durante il voto
    useEffect(() => {
        const el = document.getElementById('karaoke-player');
        if (el) el.style.visibility = (isVoting || voteResult) ? 'hidden' : 'visible';
        if ((isVoting || voteResult) && playerRef.current?.pauseVideo) playerRef.current.pauseVideo();
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
};

// ===========================================
// COMPONENTE: QUIZ GAME SHOW (Fix Restart)
// ===========================================
const QuizGameShow = ({ quiz, quizResults, leaderboard }) => {
    const playerRef = useRef(null);
    const currentVideoId = useRef(null);
    
    // Stati derivati per la UI
    const isLeaderboard = quiz.status === 'leaderboard';
    const isResult = quiz.status === 'showing_results';
    const isQuestion = quiz.status === 'active' || quiz.status === 'closed';

    // 1. GESTIONE PLAYER (Unico e Persistente)
    useEffect(() => {
        // Logica per mettere in pausa se siamo in classifica (opzionale)
        if (isLeaderboard && playerRef.current?.pauseVideo) {
             playerRef.current.pauseVideo();
             return;
        }

        const videoId = getYoutubeId(quiz.media_url);
        
        // Se non c'è video, puliamo
        if (!videoId) {
             if(playerRef.current) { 
                 try { playerRef.current.destroy(); } catch(e){}
                 playerRef.current = null; 
             }
             currentVideoId.current = null;
             return;
        }

        // Se il video è lo stesso, gestiamo solo play/pause senza ricaricare
        if (currentVideoId.current === videoId && playerRef.current && typeof playerRef.current.playVideo === 'function') {
             if (quiz.status === 'active') playerRef.current.playVideo();
             return;
        }

        // Caricamento Nuovo Video
        currentVideoId.current = videoId;
        const onReady = (event) => {
            event.target.setVolume(100);
            event.target.unMute();
            if (quiz.status === 'active') event.target.playVideo();
        };

        if (!window.YT) return;

        // Creazione Player o Load
        if (!playerRef.current) {
             playerRef.current = new window.YT.Player('quiz-fixed-player', {
                videoId: videoId,
                playerVars: { autoplay: 1, controls: 0, disablekb: 1, fs: 0, iv_load_policy: 3, modestbranding: 1, rel: 0, showinfo: 0, loop: 1 },
                events: { onReady }
            });
        } else {
            playerRef.current.loadVideoById(videoId);
        }

    }, [quiz.media_url, quiz.status, isLeaderboard]);

    // Check media types
    const hasVideo = quiz.media_type === 'video' && getYoutubeId(quiz.media_url);
    const hasAudio = quiz.media_type === 'audio';

    return (
        <div className="absolute inset-0 bg-black overflow-hidden font-sans">
            
            {/* --- LAYER 0: MEDIA PLAYER (Sempre presente nel DOM) --- */}
            <div className={`absolute inset-0 z-0 transition-opacity duration-1000 ${hasVideo && !isLeaderboard ? 'opacity-100' : 'opacity-0'}`}>
                <div id="quiz-fixed-player" className="w-full h-full pointer-events-none scale-110" />
                <div className="absolute inset-0 bg-black/50" />
            </div>

            {/* --- LAYER 0.5: AUDIO VISUALIZER --- */}
            {hasAudio && !isLeaderboard && (
                <div className="absolute inset-0 z-0 flex items-center justify-center animate-pulse opacity-40">
                    <Music className="w-96 h-96 text-fuchsia-600" />
                </div>
            )}

            {/* --- LAYER 1: DOMANDA (Overlay) --- */}
            <div className={`absolute inset-0 z-10 flex flex-col items-center justify-center p-8 transition-all duration-500 ${isQuestion ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'}`}>
                 <div className="mb-8">
                     <span className={`px-10 py-3 rounded-full text-3xl font-black uppercase tracking-widest shadow-xl ${quiz.status === 'closed' ? 'bg-red-600 text-white' : 'bg-fuchsia-600 text-white animate-pulse'}`}>
                        {quiz.status === 'closed' ? "STOP AL TELEVOTO" : "IN ONDA"}
                     </span>
                </div>
                
                <div className="w-full max-w-6xl text-center mb-12">
                    <h2 className="text-7xl font-black text-white leading-tight drop-shadow-2xl bg-black/40 backdrop-blur-md p-8 rounded-3xl border border-white/10">
                        {quiz.question}
                    </h2>
                </div>

                <div className="grid grid-cols-2 gap-8 w-full max-w-6xl">
                    {quiz.options.map((opt, i) => (
                        <div key={i} className={`
                            relative p-8 rounded-2xl text-5xl font-bold border-4 transition-all duration-300 transform
                            ${quiz.status === 'closed' ? 'bg-zinc-800 border-zinc-600 text-zinc-500 scale-95' : 'bg-white/10 border-white/20 text-white shadow-lg hover:scale-105'}
                        `}>
                            <span className="text-fuchsia-500 mr-4">{String.fromCharCode(65+i)}.</span> {opt}
                        </div>
                    ))}
                </div>
            </div>

            {/* --- LAYER 2: RISULTATO (Overlay) --- */}
            <div className={`absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/80 backdrop-blur-xl transition-all duration-500 ${isResult ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-full pointer-events-none'}`}>
                {quizResults && (
                    <div className="bg-gradient-to-br from-zinc-900 to-black border-4 border-green-500 p-16 rounded-[3rem] text-center shadow-[0_0_100px_rgba(34,197,94,0.4)] max-w-5xl w-full animate-zoom-in">
                        <Trophy className="w-32 h-32 text-yellow-400 mx-auto mb-6 animate-bounce" />
                        <h3 className="text-3xl text-zinc-400 uppercase tracking-widest mb-4">La risposta esatta è</h3>
                        <div className="bg-green-600 text-white text-7xl font-black py-8 px-12 rounded-3xl mb-10 shadow-2xl transform scale-105">
                            {quizResults.correct_option}
                        </div>
                        <div className="grid grid-cols-3 gap-8 text-center border-t border-white/10 pt-8">
                            <div><div className="text-5xl font-bold text-white">{quizResults.total_answers}</div><div className="text-sm text-zinc-500 uppercase mt-2">Risposte</div></div>
                            <div><div className="text-5xl font-bold text-green-400">{quizResults.correct_count}</div><div className="text-sm text-zinc-500 uppercase mt-2">Esatte</div></div>
                            <div><div className="text-5xl font-bold text-fuchsia-400">{quizResults.points}</div><div className="text-sm text-zinc-500 uppercase mt-2">Punti</div></div>
                        </div>
                        {quizResults.winners.length > 0 && (
                            <div className="mt-8 pt-6 border-t border-white/10">
                                <p className="text-green-300 font-bold uppercase text-sm mb-2">I più veloci</p>
                                <p className="text-3xl text-white font-medium truncate">{quizResults.winners.slice(0, 3).join(' • ')}</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* --- LAYER 3: CLASSIFICA (Overlay) --- */}
            <div className={`absolute inset-0 z-30 bg-zinc-900 flex flex-col p-8 transition-transform duration-700 ${isLeaderboard ? 'translate-y-0' : '-translate-y-full'}`}>
                 <div className="text-center mb-8">
                    <h1 className="text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-600 drop-shadow-sm">CLASSIFICA</h1>
                </div>
                <div className="flex-1 overflow-hidden grid grid-cols-2 gap-x-16 gap-y-4 px-16 content-start custom-scrollbar overflow-y-auto">
                    {leaderboard.map((p, i) => (
                        <div key={p.id} className={`flex items-center p-4 rounded-xl text-4xl font-bold transition-all ${i<3 ? 'bg-gradient-to-r from-yellow-900/40 to-transparent border-l-8 border-yellow-500 pl-6' : 'bg-white/5 border-l-4 border-zinc-600'}`}>
                            <span className={`w-16 text-right mr-8 ${i===0?'text-yellow-400':i===1?'text-zinc-300':i===2?'text-amber-600':'text-zinc-500'}`}>#{i+1}</span>
                            <span className="flex-1 truncate text-white">{p.nickname}</span>
                            <span className="text-yellow-500 font-mono">{p.score}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

// ===========================================
// MAIN COMPONENT
// ===========================================
export default function PubDisplay() {
  const { pubCode } = useParams();
  const [displayData, setDisplayData] = useState(null);
  const [ticker, setTicker] = useState("");
  const [flashMessages, setFlashMessages] = useState([]);
  const [floatingReactions, setFloatingReactions] = useState([]);
  const [quizResults, setQuizResults] = useState(null);
  const [voteResult, setVoteResult] = useState(null);

  // Load YouTube API once
  useEffect(() => {
      if (!window.YT) {
          const tag = document.createElement('script');
          tag.src = "https://www.youtube.com/iframe_api";
          const firstScriptTag = document.getElementsByTagName('script')[0];
          firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
      }
  }, []);

  const loadDisplayData = useCallback(async () => {
    try {
      const { data } = await api.getDisplayData(pubCode);
      if(!data) return;

      setDisplayData(data);
      
      // Ticker
      if (data.queue?.length > 0) {
        setTicker(data.queue.slice(0, 5).map((s, i) => `${i + 1}. ${s.title} (${s.user_nickname})`).join(' • '));
      } else {
        setTicker("Inquadra il QR Code per cantare!");
      }

      // Vote Result Auto-Show
      if (data.current_performance?.status === 'ended' && !voteResult && data.current_performance.average_score > 0) {
         setVoteResult(data.current_performance.average_score);
         setTimeout(() => setVoteResult(null), 10000);
      }
    } catch (error) { console.error(error); }
  }, [pubCode, voteResult]);

  // Realtime Subscriptions
  useEffect(() => {
    loadDisplayData();
    const interval = setInterval(loadDisplayData, 5000);

    const channel = supabase.channel(`display_realtime`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'performances', filter: `event_id=eq.${displayData?.pub?.id}` }, 
            (payload) => {
                setDisplayData(prev => prev ? ({ ...prev, current_performance: payload.new }) : null);
                if (payload.new.status === 'voting' || payload.new.status === 'ended') loadDisplayData();
            }
        )
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reactions', filter: `event_id=eq.${displayData?.pub?.id}` }, 
            (payload) => addReaction(payload.new.emoji, payload.new.nickname)
        )
        .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `event_id=eq.${displayData?.pub?.id}` }, 
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
        .on('postgres_changes', { event: '*', schema: 'public', table: 'quizzes', filter: `event_id=eq.${displayData?.pub?.id}` }, 
            async (payload) => {
                const updatedQuiz = payload.new;
                setDisplayData(prev => {
                     if(!prev) return null;
                     if(updatedQuiz.status === 'ended') {
                         setTimeout(() => { 
                             setDisplayData(curr => ({ ...curr, active_quiz: null })); 
                             setQuizResults(null); 
                         }, 5000);
                         return { ...prev, active_quiz: updatedQuiz };
                     }
                     return { ...prev, active_quiz: updatedQuiz };
                });

                if (updatedQuiz.status === 'active' || updatedQuiz.status === 'closed') { setQuizResults(null); }
                else if (updatedQuiz.status === 'showing_results' || updatedQuiz.status === 'leaderboard') {
                    const res = await api.getQuizResults(updatedQuiz.id); 
                    setQuizResults(res.data);
                }
            }
        )
        .subscribe();

    return () => { clearInterval(interval); supabase.removeChannel(channel); };
  }, [displayData?.pub?.id, pubCode]);

  // Helpers
  const showFlashMessage = (msg) => {
    const id = Date.now();
    setFlashMessages(prev => [...prev, { ...msg, internalId: id }]);
    setTimeout(() => setFlashMessages(prev => prev.filter(m => m.internalId !== id)), 10000);
  };

  const addReaction = (emoji, nickname) => {
    const id = Date.now() + Math.random();
    setFloatingReactions(prev => [...prev, { id, emoji, nickname, left: Math.random() * 80 + 10 }]);
    setTimeout(() => setFloatingReactions(prev => prev.filter(r => r.id !== id)), 4000);
  };

  // RENDER LOGIC
  const currentPerf = displayData?.current_performance;
  const activeQuiz = displayData?.active_quiz;
  const joinUrl = `${window.location.origin}/join/${pubCode}`;
  
  let ScreenComponent = null;
  const isQuizMode = activeQuiz && activeQuiz.status !== 'ended';
  const isKaraokeMode = !isQuizMode && currentPerf && (currentPerf.status === 'live' || currentPerf.status === 'paused' || currentPerf.status === 'voting' || voteResult);

  // Sidebar visibility check
  const showSidebar = !isQuizMode || (activeQuiz && activeQuiz.status !== 'leaderboard');

  return (
    <div className="h-screen bg-black text-white overflow-hidden flex flex-col font-sans">
      
      {/* HEADER */}
      <div className="h-16 bg-zinc-900 flex items-center px-6 border-b border-zinc-800 z-50 shadow-xl relative">
         <div className="font-bold text-xl mr-8 text-fuchsia-500">{displayData?.pub?.name || "NEONPUB"}</div>
         <div className="flex-1 overflow-hidden"><div className="ticker-container"><div className="ticker-content text-lg font-medium text-cyan-300">{ticker}</div></div></div>
      </div>

      <div className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 relative bg-black flex flex-col justify-center overflow-hidden">
           
           {!isQuizMode && !isKaraokeMode && (
             <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-zinc-950 animate-fade-in">
                <h2 className="text-7xl font-bold mb-8 text-white">PROSSIMO CANTANTE... TU?</h2>
                <div className="bg-white p-6 rounded-3xl shadow-[0_0_50px_rgba(255,255,255,0.2)]">
                    <QRCodeSVG value={joinUrl} size={300} />
                </div>
                <p className="text-4xl text-zinc-400 mt-8 font-mono tracking-widest">{pubCode}</p>
             </div>
           )}

           {isKaraokeMode && (
               <KaraokeScreen performance={currentPerf} isVoting={currentPerf.status === 'voting'} voteResult={voteResult} />
           )}

           {isQuizMode && (
               <QuizGameShow quiz={activeQuiz} quizResults={quizResults} leaderboard={displayData?.leaderboard || []} />
           )}

        </div>

        {/* SIDEBAR */}
        {showSidebar && (
            <div className="w-[350px] bg-zinc-900/95 border-l border-zinc-800 flex flex-col z-40 shadow-2xl relative transition-all duration-500">
                <div className="p-6 flex flex-col items-center bg-white/5 border-b border-white/10">
                    <div className="bg-white p-3 rounded-xl mb-3 shadow-lg transform hover:scale-105 transition"><QRCodeSVG value={joinUrl} size={150} /></div>
                    <p className="font-mono text-3xl font-bold text-cyan-400 tracking-widest drop-shadow">{pubCode}</p>
                </div>
                <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-4">
                     {displayData?.pub?.logo_url ? <img src={displayData.pub.logo_url} className="w-40 h-40 object-contain drop-shadow-2xl"/> : <div className="w-32 h-32 bg-zinc-800 rounded-full flex items-center justify-center border-4 border-zinc-700">LOGO</div>}
                </div>
                <div className="h-[35%] border-t border-white/10 p-4 bg-gradient-to-b from-zinc-900 to-black">
                    <h3 className="text-lg font-bold text-yellow-500 mb-4 flex items-center gap-2 uppercase tracking-wider"><Trophy className="w-5 h-5"/> Top Player</h3>
                    <div className="space-y-2 overflow-y-auto custom-scrollbar h-full pb-4">
                        {(displayData?.leaderboard || []).slice(0, 5).map((p, i) => (
                            <div key={p.id} className={`flex justify-between items-center p-2 rounded ${i===0 ? 'bg-yellow-500/20 border border-yellow-500/30' : ''}`}>
                                <div className="flex items-center gap-2"><span className={`font-bold w-5 h-5 flex items-center justify-center rounded-full text-xs ${i===0 ? 'bg-yellow-500 text-black' : 'bg-zinc-800 text-zinc-400'}`}>{i+1}</span><span className={`text-sm ${i===0?'text-white':'text-zinc-300'}`}>{p.nickname}</span></div>
                                <span className="text-cyan-400 font-mono font-bold text-sm">{p.score}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )}
      </div>

      {/* OVERLAY: REAZIONI */}
      <div className="pointer-events-none fixed inset-0 z-[100] overflow-hidden">
        {floatingReactions.map(r => (
            <div key={r.id} className="absolute flex flex-col items-center animate-float-up" style={{ left: `${r.left}%`, bottom: '-50px' }}>
              <span className="text-7xl filter drop-shadow-2xl">{r.emoji}</span>
              <span className="text-xl text-white font-bold mt-1 bg-black/70 px-4 py-1 rounded-full border border-white/20 shadow-xl">{r.nickname}</span>
            </div>
        ))}
      </div>

      {/* OVERLAY: MESSAGGI REGIA */}
      {flashMessages.length > 0 && (
        <div className="fixed top-24 left-8 z-[110] w-2/3 max-w-4xl flex flex-col gap-4">
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