import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { Mic2, Trophy, Star, MessageSquare, Power } from "lucide-react";
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
// KARAOKE LAYER (Z-INDEX 20)
// ===========================================
const KaraokeScreen = ({ performance, isVoting, voteResult, isVisible }) => {
    const playerRef = useRef(null);
    const prevStartedAt = useRef(performance?.started_at);

    useEffect(() => {
        if (!isVisible || !performance) {
             // Se diventiamo invisibili, stoppiamo il video per liberare l'audio per il Quiz
             if (playerRef.current && typeof playerRef.current.stopVideo === 'function') {
                 playerRef.current.stopVideo();
             }
             return;
        }

        const videoId = getYoutubeId(performance.youtube_url);
        if (!videoId) return;

        const onPlayerReady = (event) => {
            if (performance.status === 'live') {
                event.target.unMute();
                event.target.playVideo();
            }
        };

        // NOTA: Non carichiamo più lo script qui, lo fa il componente padre PubDisplay
        const initKaraoke = () => {
            if (!document.getElementById('karaoke-player')) return;
            
            // Se esiste già, aggiorna
            if (playerRef.current && playerRef.current.loadVideoById) {
                 const currentVideoData = playerRef.current.getVideoData();
                 if (currentVideoData && currentVideoData.video_id !== videoId) {
                     playerRef.current.loadVideoById(videoId);
                 }
                 if (performance.status === 'live') playerRef.current.playVideo();
                 else if (performance.status === 'paused') playerRef.current.pauseVideo();
                 
                 if (performance.started_at !== prevStartedAt.current) {
                      prevStartedAt.current = performance.started_at; 
                      playerRef.current.seekTo(0);
                      playerRef.current.playVideo();
                 }
            } else if (window.YT && window.YT.Player) {
                 // Crea nuovo
                 playerRef.current = new window.YT.Player('karaoke-player', {
                    videoId: videoId,
                    playerVars: { autoplay: 1, controls: 0, disablekb: 1, fs: 0, iv_load_policy: 3, modestbranding: 1, rel: 0, showinfo: 0, origin: window.location.origin },
                    events: { onReady: onPlayerReady }
                });
            }
        };

        // Polling leggero per attendere API o DOM
        const timer = setInterval(() => {
            if (window.YT && window.YT.Player) {
                initKaraoke();
                clearInterval(timer);
            }
        }, 100);

        return () => clearInterval(timer);

    }, [performance, isVoting, voteResult, isVisible]);

    // Render condizionale: Se non visibile, non renderizzare nulla (Unmount)
    // Questo risolve i conflitti Z-Index
    if (!isVisible) return null;

    return (
        <div className="absolute inset-0 bg-black flex flex-col justify-center overflow-hidden z-20 animate-fade-in">
            <div id="karaoke-player" className="absolute inset-0 w-full h-full z-0 pointer-events-none" />
            
            {!isVoting && !voteResult && (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/80 to-transparent p-12 z-10 pb-20">
                    <h2 className="text-6xl font-black text-white mb-2 drop-shadow-lg">{performance.song_title}</h2>
                    <div className="flex items-end gap-6">
                        <p className="text-4xl text-zinc-300 font-medium">{performance.song_artist}</p>
                        <div className="bg-fuchsia-600 px-6 py-2 rounded-full flex items-center gap-3 animate-pulse">
                            <Mic2 className="w-8 h-8" /><span className="text-2xl font-bold uppercase tracking-wider">{performance.user_nickname}</span>
                        </div>
                    </div>
                </div>
            )}
            {isVoting && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-zinc-900 animate-zoom-in">
                    <h2 className="text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-600 mb-8 animate-pulse drop-shadow-lg">VOTA ORA!</h2>
                    <div className="bg-white/10 p-16 rounded-full border-8 border-yellow-500 shadow-[0_0_100px_rgba(234,179,8,0.5)] animate-spin-slow"><Star className="w-48 h-48 text-yellow-500 fill-yellow-500" /></div>
                </div>
            )}
            {voteResult !== null && (
                <div className="absolute inset-0 z-25 flex flex-col items-center justify-center bg-black/95 animate-fade-in">
                    <h2 className="text-6xl text-white font-bold mb-8">MEDIA VOTO</h2>
                    <div className="flex items-center gap-6"><Star className="w-32 h-32 text-yellow-400 fill-yellow-400 animate-bounce" /><span className="text-[12rem] font-black text-white leading-none">{Number(voteResult).toFixed(1)}</span></div>
                </div>
            )}
        </div>
    );
};

// ===========================================
// QUIZ OVERLAY TEXT (Z-INDEX 30)
// ===========================================
const QuizOverlay = ({ quiz, quizResults, leaderboard, isVisible }) => {
    if (!isVisible) return null;

    if (quiz.status === 'leaderboard') {
        return (
            <div className="absolute inset-0 bg-zinc-900 z-50 flex flex-col p-8 overflow-hidden animate-fade-in">
                <div className="text-center mb-6"><h1 className="text-6xl font-black text-yellow-500 uppercase drop-shadow-[0_0_15px_rgba(234,179,8,0.5)]">CLASSIFICA GENERALE</h1></div>
                <div className="flex-1 overflow-y-auto grid grid-cols-2 gap-x-12 gap-y-4 px-12 content-start custom-scrollbar">
                    {leaderboard.map((p, i) => (
                        <div key={p.id} className={`flex items-center p-4 rounded-xl text-3xl font-bold ${i<3 ? 'scale-105 bg-gradient-to-r from-yellow-600/30 to-transparent border border-yellow-500/50' : 'bg-white/5'}`}>
                            <span className={`w-16 h-16 flex items-center justify-center rounded-full mr-6 text-2xl border-4 ${i===0 ? 'bg-yellow-500 text-black border-yellow-300' : 'bg-zinc-800 text-zinc-500 border-zinc-600'}`}>{i+1}</span>
                            <span className="flex-1 truncate text-white">{p.nickname}</span><span className="text-yellow-400 font-mono">{p.score}</span>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (quizResults) {
        return (
            <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/80 backdrop-blur-xl animate-fade-in">
                <div className="bg-black/60 p-12 rounded-[3rem] border border-white/20 text-center max-w-5xl w-full shadow-2xl">
                    <Trophy className="w-40 h-40 text-yellow-400 mx-auto mb-8 animate-bounce" />
                    <h2 className="text-6xl font-black text-white mb-6">RISPOSTA ESATTA</h2>
                    <div className="bg-green-600 text-white px-16 py-8 rounded-3xl mb-12 transform scale-110 shadow-[0_0_50px_rgba(22,163,74,0.5)]"><p className="text-7xl font-bold">{quizResults.correct_option}</p></div>
                    <p className="text-4xl text-white font-medium leading-relaxed">{quizResults.winners.length > 0 ? quizResults.winners.slice(0, 5).join(' • ') : "Nessuno ha indovinato!"}</p>
                </div>
            </div>
        );
    }

    // Se c'è un media attivo, mostriamo il testo in overlay trasparente
    const hasMedia = quiz.media_type === 'video' || quiz.media_type === 'audio' || (quiz.media_url && quiz.media_url.length > 5);

    if (hasMedia) {
        return (
            <div className="absolute inset-0 z-30 flex flex-col justify-between pointer-events-none">
                <div className="bg-black/80 backdrop-blur-md p-6 border-b border-white/10 animate-slide-down">
                    <div className="flex justify-between items-center mb-2">
                        <span className={`px-4 py-1 rounded text-xl font-bold uppercase tracking-widest ${quiz.status === 'closed' ? 'bg-red-600' : 'bg-fuchsia-600 animate-pulse'}`}>{quiz.status === 'closed' ? "STOP TELEVOTO" : "IN ONDA"}</span>
                        <span className="text-zinc-400 text-xl font-mono">{quiz.category}</span>
                    </div>
                    <h2 className="text-5xl font-black text-white leading-tight text-center drop-shadow-xl">{quiz.question}</h2>
                </div>
                {/* Visualizzazione opzioni in basso */}
                <div className="bg-gradient-to-t from-black via-black/90 to-transparent p-8 pb-12 animate-slide-up">
                    <div className="grid grid-cols-4 gap-6 max-w-[95%] mx-auto">
                        {quiz.options.map((opt, i) => (
                            <div key={i} className={`p-6 rounded-2xl text-3xl font-bold border-2 text-center ${quiz.status === 'closed' ? 'border-zinc-700 bg-zinc-900/80 text-zinc-500' : 'border-white/30 bg-black/60 text-white shadow-lg'}`}>
                                <span className="text-fuchsia-500 block text-xl mb-1">{String.fromCharCode(65+i)}</span>{opt}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    // Se NON c'è media, sfondo colorato pieno
    return (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center p-10 bg-gradient-to-b from-purple-900/90 to-black/90">
             <div className="w-full max-w-6xl text-center animate-zoom-in">
                <div className="mb-8"><span className={`px-12 py-4 rounded-full text-4xl font-black uppercase tracking-widest shadow-[0_0_30px_rgba(217,70,239,0.6)] ${quiz.status === 'closed' ? 'bg-red-600 text-white' : 'bg-fuchsia-600 text-white animate-pulse'}`}>{quiz.status === 'closed' ? "STOP AL TELEVOTO!" : "QUIZ IN ONDA"}</span></div>
                <h2 className="text-7xl font-black text-white mb-16 leading-tight drop-shadow-2xl bg-black/40 p-6 rounded-3xl backdrop-blur-sm border border-white/10">{quiz.question}</h2>
                <div className="grid grid-cols-2 gap-8">{quiz.options.map((opt, i) => (<div key={i} className={`p-8 rounded-3xl text-5xl font-bold border-4 ${quiz.status === 'closed' ? 'border-zinc-700 text-zinc-500 bg-black/60' : 'border-white/20 bg-white/10 text-white shadow-xl'}`}><span className="text-fuchsia-500 mr-4">{String.fromCharCode(65+i)}.</span> {opt}</div>))}</div>
            </div>
        </div>
    );
}

// ===========================================
// MAIN COMPONENT
// ===========================================
export default function PubDisplay() {
  const { pubCode } = useParams();
  const [hasInteracted, setHasInteracted] = useState(false);
  const [displayData, setDisplayData] = useState(null);
  const [ticker, setTicker] = useState("");
  const [floatingReactions, setFloatingReactions] = useState([]);
  const [flashMessages, setFlashMessages] = useState([]);
  const [quizResults, setQuizResults] = useState(null);
  const [voteResult, setVoteResult] = useState(null);

  // --- GLOBAL YOUTUBE API LOADER ---
  // Carichiamo l'API una volta sola a livello di App per evitare conflitti tra i componenti
  useEffect(() => {
    if (hasInteracted && !window.YT) {
        const tag = document.createElement('script');
        tag.src = "https://www.youtube.com/iframe_api";
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    }
  }, [hasInteracted]);

  const loadDisplayData = useCallback(async () => {
    try {
      const { data } = await api.getDisplayData(pubCode);
      if(!data) return;
      
      // FIX: Aggiorniamo lo stato solo se i dati critici sono cambiati per evitare re-render del video
      setDisplayData(prev => {
          if (!prev) return data;
          // Controlli profondi su oggetti che causano re-render
          const activeQuizChanged = prev.active_quiz?.id !== data.active_quiz?.id || prev.active_quiz?.status !== data.active_quiz?.status;
          const perfChanged = prev.current_performance?.id !== data.current_performance?.id || prev.current_performance?.status !== data.current_performance?.status;
          
          if (!activeQuizChanged && !perfChanged && prev.queue?.length === data.queue?.length) {
              return prev; // Ritorna l'oggetto precedente per mantenere la stabilità
          }
          return data;
      });

      if (data.queue?.length > 0) setTicker(data.queue.slice(0, 5).map((s, i) => `${i + 1}. ${s.title} (${s.user_nickname})`).join(' • '));
      else setTicker("Inquadra il QR Code per cantare!");
      
      if (data.current_performance?.status === 'ended' && !voteResult && data.current_performance.average_score > 0) {
         setVoteResult(data.current_performance.average_score);
         setTimeout(() => setVoteResult(null), 10000);
      }
    } catch (error) { console.error(error); }
  }, [pubCode, voteResult]);

  useEffect(() => {
    if(hasInteracted) {
        loadDisplayData();
        const interval = setInterval(loadDisplayData, 5000);
        return () => clearInterval(interval);
    }
  }, [hasInteracted, loadDisplayData]);

  useEffect(() => {
    if (!hasInteracted || !displayData?.pub?.id) return;
    
    // Channel Controlli (Mute, etc)
    const controlChannel = supabase.channel(`display_control_${pubCode}`)
        .on('broadcast', { event: 'control' }, (payload) => {
             ['karaoke-player', 'quiz-fixed-player'].forEach(pid => {
                 const player = window.YT?.get && window.YT.get(pid);
                 if (player && typeof player.mute === 'function') { if(payload.payload.value) player.mute(); else player.unMute(); }
             });
        }).subscribe();

    // Channel Realtime DB
    const channel = supabase.channel(`display_realtime`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'performances', filter: `event_id=eq.${displayData.pub.id}` }, 
            (payload) => {
                setDisplayData(prev => ({ ...prev, current_performance: payload.new }));
                if (payload.new.status === 'voting' || payload.new.status === 'ended') loadDisplayData();
            }
        )
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reactions', filter: `event_id=eq.${displayData.pub.id}` }, 
            (payload) => addFloatingReaction(payload.new.emoji, payload.new.nickname)
        )
        .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `event_id=eq.${displayData.pub.id}` }, 
            async (payload) => { if(payload.new.status === 'approved') showFlashMessage({ text: payload.new.text, nickname: 'Regia' }); }
        )
        .on('postgres_changes', { event: '*', schema: 'public', table: 'quizzes', filter: `event_id=eq.${displayData.pub.id}` }, 
            async (payload) => {
                const updatedQuiz = payload.new;
                setDisplayData(prev => {
                    // Evita re-render inutili se i dati sono identici
                    if (prev.active_quiz?.id === updatedQuiz.id && prev.active_quiz?.status === updatedQuiz.status) return prev;
                    return { ...prev, active_quiz: updatedQuiz };
                });
                
                if (updatedQuiz.status === 'active' || updatedQuiz.status === 'closed') { 
                    setQuizResults(null); 
                } else if (updatedQuiz.status === 'showing_results') {
                    const res = await api.getQuizResults(updatedQuiz.id); 
                    setQuizResults(res.data);
                } else if (updatedQuiz.status === 'ended') {
                    setTimeout(() => { setDisplayData(prev => ({ ...prev, active_quiz: null })); setQuizResults(null); }, 5000);
                }
            }
        ).subscribe();
    return () => { supabase.removeChannel(channel); supabase.removeChannel(controlChannel); }
  }, [hasInteracted, displayData?.pub?.id, pubCode]);

  const showFlashMessage = (msg) => {
    const id = Date.now();
    setFlashMessages(prev => [...prev, { ...msg, internalId: id }]);
    setTimeout(() => setFlashMessages(prev => prev.filter(m => m.internalId !== id)), 10000);
  };
  const addFloatingReaction = (emoji, nickname) => {
    const id = Date.now() + Math.random();
    setFloatingReactions(prev => [...prev, { id, emoji, nickname, left: Math.random()*80+10 }]);
    setTimeout(() => setFloatingReactions(prev => prev.filter(r => r.id !== id)), 4000);
  };

  if (!hasInteracted) {
      return (
          <div className="h-screen w-screen bg-black flex flex-col items-center justify-center z-[9999]">
              <div className="text-center space-y-8 animate-pulse">
                  <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-fuchsia-600">NEONPUB DISPLAY</h1>
                  <p className="text-zinc-400 text-xl">Clicca per abilitare Audio & Video</p>
                  <button onClick={() => setHasInteracted(true)} className="px-12 py-6 bg-white text-black text-3xl font-bold rounded-full hover:scale-110 transition shadow-[0_0_50px_rgba(255,255,255,0.5)] flex items-center gap-4 mx-auto"><Power className="w-8 h-8"/> AVVIA SISTEMA</button>
              </div>
          </div>
      );
  }

  // --- LOGICA DI VISUALIZZAZIONE PRIORITARIA ---
  const activeQuiz = displayData?.active_quiz;
  const currentPerf = displayData?.current_performance;
  const joinUrl = `${window.location.origin}/join/${pubCode}`;

  // Se il QUIZ è Attivo (o mostra risultati), esso vince su tutto.
  // Anche se il DB dice che c'è una performance "live" (magari non ancora stoppata bene),
  // se c'è un quiz attivo lo mostriamo.
  const isQuizVisible = activeQuiz && activeQuiz.status !== 'ended';

  // Il Karaoke è visibile SOLO se NON c'è un quiz attivo e la performance è valida
  const isKaraokeActive = !isQuizVisible && currentPerf && (currentPerf.status === 'live' || currentPerf.status === 'paused' || currentPerf.status === 'voting' || voteResult);
  
  return (
    <div className="h-screen bg-black text-white overflow-hidden flex flex-col font-sans">
      <div className="h-16 bg-zinc-900 flex items-center px-6 border-b border-zinc-800 z-50 relative shadow-xl">
         <div className="font-bold text-xl mr-8 text-fuchsia-500">{displayData?.pub?.name || "NEONPUB"}</div>
         <div className="flex-1 overflow-hidden relative h-full flex items-center"><div className="ticker-container w-full"><div className="ticker-content text-lg font-medium text-cyan-300">{ticker}</div></div></div>
      </div>
      
      <div className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 relative bg-black flex flex-col justify-center overflow-hidden">
           
           {/* 1. QUIZ MEDIA LAYER (z-index 0) */}
           {/* Passiamo direttamente i dati. La logica di visibilità è interna al memo. */}
           <QuizMediaFixed 
                mediaUrl={activeQuiz?.media_url} 
                mediaType={activeQuiz?.media_type} 
                isVisible={isQuizVisible}
           />
           
           {/* 2. QUIZ TEXT LAYER (z-index 30/40/50) */}
           <QuizOverlay 
                quiz={activeQuiz} 
                quizResults={quizResults} 
                leaderboard={displayData?.leaderboard || []} 
                isVisible={isQuizVisible}
           />

           {/* 3. KARAOKE LAYER (z-index 20) */}
           {/* Questo viene smontato se isKaraokeActive è false per evitare conflitti audio/video */}
           <KaraokeScreen 
                performance={currentPerf} 
                isVoting={currentPerf?.status === 'voting'} 
                voteResult={voteResult}
                isVisible={isKaraokeActive}
           />

        </div>
        
        {/* SIDEBAR - Nascosta se c'è classifica full screen */}
        {!(activeQuiz && activeQuiz.status === 'leaderboard') && (
            <div className="w-[350px] bg-zinc-900/95 border-l border-zinc-800 flex flex-col z-30 shadow-2xl relative">
                <div className="p-6 flex flex-col items-center bg-white/5 border-b border-white/10">
                    <div className="bg-white p-3 rounded-xl mb-3 shadow-lg transform hover:scale-105 transition"><QRCodeSVG value={joinUrl} size={150} /></div>
                    <p className="font-mono text-3xl font-bold text-cyan-400 tracking-widest drop-shadow">{pubCode}</p>
                </div>
                <div className="flex-1 overflow-hidden flex flex-col p-8 items-center justify-center text-center space-y-6">
                    {displayData?.pub?.logo_url ? (<img src={displayData.pub.logo_url} alt="Logo" className="w-40 h-40 object-contain drop-shadow-2xl"/>) : (<div className="w-40 h-40 bg-zinc-800 rounded-full flex items-center justify-center text-zinc-600 text-4xl font-bold border-4 border-zinc-700">LOGO</div>)}
                    <div className="mt-2"><h2 className="text-3xl font-black text-white uppercase tracking-wider">{displayData?.pub?.name || "NEONPUB"}</h2></div>
                </div>
                <div className="h-[35%] border-t border-white/10 p-4 bg-gradient-to-b from-zinc-900 to-black">
                     <h3 className="text-lg font-bold text-yellow-500 mb-4 flex items-center gap-2 uppercase tracking-wider"><Trophy className="w-5 h-5"/> Top Player</h3>
                     <div className="space-y-2 overflow-y-auto custom-scrollbar h-full pb-4">{(displayData?.leaderboard || []).slice(0, 5).map((p, i) => (<div key={p.id} className="flex justify-between items-center p-2 rounded bg-white/5"><span className="text-zinc-300">{i+1}. {p.nickname}</span><span className="text-cyan-400 font-bold">{p.score}</span></div>))}</div>
                </div>
            </div>
        )}
      </div>
      <div className="reactions-overlay pointer-events-none fixed inset-0 z-[100] overflow-hidden">{floatingReactions.map(r => (<div key={r.id} className="absolute flex flex-col items-center animate-float-up" style={{ left: `${r.left}%`, bottom: '-50px' }}><span className="text-7xl filter drop-shadow-2xl">{r.emoji}</span></div>))}</div>
      {flashMessages.length > 0 && (<div className="fixed top-24 left-8 z-[110] w-2/3 max-w-4xl flex flex-col gap-4">{flashMessages.map(msg => (<div key={msg.internalId} className="bg-black/90 backdrop-blur-xl border-l-8 border-cyan-500 text-white p-6 rounded-r-2xl shadow-2xl animate-slide-in-left"><p className="text-4xl font-bold">{msg.text}</p></div>))}</div>)}
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
        .animate-slide-down { animation: slideDown 0.6s ease-out; }
        @keyframes slideDown { from { transform: translateY(-100%); } to { transform: translateY(0); } }
        .animate-slide-up { animation: slideUp 0.6s ease-out; }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #444; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
      `}</style>
    </div>
  );
}