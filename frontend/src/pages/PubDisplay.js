import { useState, useEffect, useCallback, useRef, memo } from "react";
import { useParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { Mic2, Trophy, Star, MessageSquare } from "lucide-react";
import api from "@/lib/api";
import { supabase } from "@/lib/supabase";
import QuizMediaFixed from "@/components/QuizMediaFixed";

// ===========================================
// UTILS & KARAOKE COMPONENT (INVARIATO)
// ===========================================
const getYoutubeId = (url) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
};

const KaraokeScreen = memo(({ performance, isVoting, voteResult }) => {
    const playerRef = useRef(null);
    useEffect(() => {
        if (!performance || isVoting || voteResult) return;
        const videoId = getYoutubeId(performance.youtube_url);
        if (!videoId) return;
        const onReady = (e) => {
             if (performance.status === 'live') e.target.playVideo();
             else if (performance.status === 'paused') e.target.pauseVideo();
        };
        if (!window.YT) { /* API handled externally */ }
        else if (!playerRef.current) {
            playerRef.current = new window.YT.Player('karaoke-player', {
                videoId, playerVars: { autoplay: 1, controls: 0, disablekb: 1, fs: 0, iv_load_policy: 3, modestbranding: 1, rel: 0, showinfo: 0, origin: window.location.origin },
                events: { onReady }
            });
        } else {
             const data = playerRef.current.getVideoData();
             if (data && data.video_id !== videoId) playerRef.current.loadVideoById(videoId);
             if (performance.status === 'live') playerRef.current.playVideo();
             else if (performance.status === 'paused') playerRef.current.pauseVideo();
        }
    }, [performance, isVoting, voteResult]);

    useEffect(() => {
        const el = document.getElementById('karaoke-player');
        if ((isVoting || voteResult) && playerRef.current?.pauseVideo) {
            playerRef.current.pauseVideo();
            if(el) el.style.visibility = 'hidden';
        } else if(el) el.style.visibility = 'visible';
    }, [isVoting, voteResult]);

    return (
        <div className="absolute inset-0 bg-black flex flex-col justify-center overflow-hidden">
            <div id="karaoke-player" className="absolute inset-0 w-full h-full z-0 pointer-events-none" />
            {!isVoting && !voteResult && (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/80 to-transparent p-12 z-10 pb-20 animate-fade-in">
                    <h2 className="text-6xl font-black text-white mb-2 drop-shadow-lg">{performance.song_title}</h2>
                    <div className="flex items-end gap-6"><p className="text-4xl text-zinc-300 font-medium">{performance.song_artist}</p><div className="bg-fuchsia-600 px-6 py-2 rounded-full flex items-center gap-3 animate-pulse"><Mic2 className="w-8 h-8" /><span className="text-2xl font-bold uppercase tracking-wider">{performance.user_nickname}</span></div></div>
                </div>
            )}
            {isVoting && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-zinc-900 animate-zoom-in">
                    <h2 className="text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-600 mb-8 animate-pulse drop-shadow-lg">VOTA ORA!</h2>
                    <div className="bg-white/10 p-16 rounded-full border-8 border-yellow-500 shadow-[0_0_100px_rgba(234,179,8,0.5)] animate-spin-slow"><Star className="w-48 h-48 text-yellow-500 fill-yellow-500" /></div>
                </div>
            )}
            {voteResult !== null && (
                <div className="absolute inset-0 z-25 flex flex-col items-center justify-center bg-black/95 animate-fade-in"><h2 className="text-6xl text-white font-bold mb-8">MEDIA VOTO</h2><div className="flex items-center gap-6"><Star className="w-32 h-32 text-yellow-400 fill-yellow-400 animate-bounce" /><span className="text-[12rem] font-black text-white leading-none">{Number(voteResult).toFixed(1)}</span></div></div>
            )}
        </div>
    );
}, (prev, next) => prev.performance?.id === next.performance?.id && prev.performance?.status === next.performance?.status && prev.isVoting === next.isVoting && prev.voteResult === next.voteResult);
KaraokeScreen.displayName = 'KaraokeScreen';

// ===========================================
// COMPONENTE: QUIZ UI (UI ONLY)
// ===========================================
const QuizUI = memo(({ quiz, quizResults, leaderboard }) => {
    const isLeaderboard = quiz.status === 'leaderboard';
    const isResultsMode = quiz.status === 'showing_results';
    
    // 🔥 FIX: Nascondi testo SOLO se sta suonando il video E non siamo in nessuna modalità di overlay (classifica/risultati)
    // Usiamo lo STATO DEL QUIZ per decidere, non la presenza dei dati results/leaderboard.
    const isOverlayMode = isLeaderboard || isResultsMode;
    const isCinemaMode = quiz.media_type === 'video' && quiz.media_state === 'playing' && !isOverlayMode;

    return (
        <div className={`absolute inset-0 z-10 w-full h-full flex flex-col items-center justify-center transition-all duration-500 ${isLeaderboard ? 'bg-zinc-900' : ''}`}>
            
            {/* CLASSIFICA */}
            {isLeaderboard && (
                <div className="absolute inset-0 flex flex-col p-8 overflow-hidden animate-fade-in z-50">
                    <div className="text-center mb-6"><h1 className="text-6xl font-black text-yellow-500 uppercase drop-shadow-[0_0_15px_rgba(234,179,8,0.5)]">CLASSIFICA GENERALE</h1></div>
                    <div className="flex-1 overflow-y-auto grid grid-cols-2 gap-x-12 gap-y-4 px-12 content-start custom-scrollbar">
                        {leaderboard.map((p, i) => (
                            <div key={p.id} className={`flex items-center p-4 rounded-xl text-3xl font-bold transform transition-all ${i<3 ? 'scale-105 bg-gradient-to-r from-yellow-600/30 to-transparent border border-yellow-500/50' : 'bg-white/5'}`}>
                                <span className={`w-16 h-16 flex items-center justify-center rounded-full mr-6 text-2xl border-4 ${i===0 ? 'bg-yellow-500 text-black border-yellow-300' : i===1 ? 'bg-zinc-400 text-black border-zinc-200' : i===2 ? 'bg-amber-700 text-white border-amber-500' : 'bg-zinc-800 text-zinc-500 border-zinc-600'}`}>{i+1}</span>
                                <span className="flex-1 truncate text-white">{p.nickname}</span><span className="text-yellow-400 font-mono">{p.score}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* DOMANDA O RISULTATI */}
            {!isLeaderboard && (
                // 🔥 FIX: Se cinema mode, usa opacity-0 invece di return null. Così la struttura esiste sempre.
                <div className={`w-full max-w-6xl text-center p-8 transition-opacity duration-500 ${isCinemaMode ? 'opacity-0' : 'opacity-100'}`}>
                    
                    {!isResultsMode ? (
                        // DOMANDA
                        <div className="animate-zoom-in">
                            <div className="mb-8"><span className={`px-12 py-4 rounded-full text-4xl font-black uppercase tracking-widest shadow-[0_0_30px_rgba(217,70,239,0.6)] ${quiz.status === 'closed' ? 'bg-red-600 text-white' : 'bg-fuchsia-600 text-white animate-pulse'}`}>{quiz.status === 'closed' ? "STOP AL TELEVOTO!" : "QUIZ IN ONDA"}</span></div>
                            <div className="bg-black/70 backdrop-blur-md p-10 rounded-[3rem] border border-white/10 shadow-2xl">
                                <h2 className="text-7xl font-black text-white mb-12 leading-tight drop-shadow-2xl">{quiz.question}</h2>
                                <div className="grid grid-cols-2 gap-8">{quiz.options.map((opt, i) => (<div key={i} className={`p-8 rounded-3xl text-5xl font-bold border-4 transition-all transform ${quiz.status === 'closed' ? 'border-zinc-700 text-zinc-500 bg-zinc-900/50' : 'border-white/20 bg-white/10 text-white shadow-xl'}`}><span className="text-fuchsia-500 mr-4">{String.fromCharCode(65+i)}.</span> {opt}</div>))}</div>
                            </div>
                        </div>
                    ) : (
                        // RISULTATI (Mostra anche se quizResults è null, magari con un loader o layout vuoto, per evitare flash)
                        <div className="animate-zoom-in">
                            <div className="mb-8"><h1 className="text-6xl font-black text-yellow-500 uppercase mb-6 drop-shadow-[0_0_15px_rgba(234,179,8,0.5)]">RISULTATI</h1></div>
                            <div className="bg-black/70 backdrop-blur-md p-10 rounded-[3rem] border border-white/10 shadow-2xl">
                                <h2 className="text-5xl font-black text-white mb-12 leading-tight">{quiz.question}</h2>
                                <div className="grid grid-cols-2 gap-8 mb-12">
                                    {quiz.options.map((opt, i) => {
                                        // Gestione sicura se quizResults non è ancora arrivato
                                        const isCorrect = i === quiz.correct_answer;
                                        const votes = quizResults?.find(r => r.answer === i)?.count || 0;
                                        const totalVotes = quizResults?.reduce((sum, r) => sum + r.count, 0) || 0;
                                        const percentage = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
                                        return (<div key={i} className={`relative p-8 rounded-3xl text-4xl font-bold border-4 ${isCorrect ? 'border-green-500 bg-green-500/20' : 'border-zinc-700 bg-zinc-900/50'}`}><div className="flex items-center justify-between mb-4"><div className="flex items-center gap-4"><span className={isCorrect ? 'text-green-400' : 'text-zinc-500'}>{String.fromCharCode(65+i)}.</span><span className={isCorrect ? 'text-white' : 'text-zinc-500'}>{opt}</span></div>{isCorrect && <span className="text-6xl">✓</span>}</div><div className="flex items-center gap-4 text-3xl"><span className={isCorrect ? 'text-green-400 font-mono' : 'text-zinc-400 font-mono'}>{percentage}%</span><span className={isCorrect ? 'text-green-300' : 'text-zinc-500'}>({votes} voti)</span></div></div>);
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
});
QuizUI.displayName = 'QuizUI';

// ===========================================
// MAIN
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
      if (data.queue?.length > 0) setTicker(data.queue.slice(0, 5).map((s, i) => `${i + 1}. ${s.title} (${s.user_nickname})`).join(' • '));
      else setTicker("Inquadra il QR Code per cantare!");
      if (data.current_performance?.status === 'ended' && !voteResult && data.current_performance.average_score > 0) {
         setVoteResult(data.current_performance.average_score);
         setTimeout(() => setVoteResult(null), 10000);
      }
    } catch (e) { console.error(e); }
  }, [pubCode, voteResult]);

  useEffect(() => {
    loadDisplayData();
    const interval = setInterval(loadDisplayData, 3000);
    return () => clearInterval(interval);
  }, [loadDisplayData]);

  useEffect(() => {
      if (!displayData?.pub?.id) return;
      const ch = supabase.channel(`display_realtime`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'performances', filter: `event_id=eq.${displayData.pub.id}` }, p => {
            setDisplayData(prev => ({ ...prev, current_performance: p.new }));
            if (p.new.status === 'voting' || p.new.status === 'ended') loadDisplayData();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'quizzes', filter: `event_id=eq.${displayData.pub.id}` }, async p => {
            const updated = p.new;
            setDisplayData(prev => {
                const current = prev.active_quiz;
                if (current && current.id === updated.id && current.status === updated.status && current.media_state === updated.media_state && current.media_url === updated.media_url) return prev; 
                return { ...prev, active_quiz: updated };
            });
            if (updated.status === 'showing_results') {
                const res = await api.getQuizResults(updated.id); setQuizResults(res.data);
            } else if (updated.status === 'active' || updated.status === 'closed') { setQuizResults(null); }
            else if (updated.status === 'ended') { setTimeout(() => { setDisplayData(prev => ({ ...prev, active_quiz: null })); setQuizResults(null); }, 5000); }
        })
        // Altre subscription (messages, reactions, participants, song_requests) mantenute uguali...
        .subscribe();
      return () => { supabase.removeChannel(ch); };
  }, [displayData?.pub?.id]);

  const currentPerf = displayData?.current_performance;
  const activeQuiz = displayData?.active_quiz;
  const joinUrl = `${window.location.origin}/join/${pubCode}`;
  
  const showQuiz = activeQuiz && activeQuiz.status !== 'ended';
  const showKaraoke = !showQuiz && currentPerf && (currentPerf.status === 'live' || currentPerf.status === 'paused' || currentPerf.status === 'restarted' || currentPerf.status === 'voting' || voteResult);
  const showWaiting = !showQuiz && !showKaraoke;
  
  // 🔥 FIX LOGICA VISIBILITA' MEDIA
  // Il media deve essere "visibile" (opacity 100) solo se siamo in modalità domanda (active/closed) e NON risultati/classifica.
  // Anche qui usiamo lo STATO, non i dati.
  const isOverlayMode = activeQuiz?.status === 'leaderboard' || activeQuiz?.status === 'showing_results';

  return (
    <div className="h-screen bg-black text-white overflow-hidden flex flex-col font-sans">
      <div className="h-16 bg-zinc-900 flex items-center px-6 border-b border-zinc-800 z-[100] relative shadow-xl">
         <div className="font-bold text-xl mr-8 text-fuchsia-500">{displayData?.pub?.name || "NEONPUB"}</div>
         <div className="flex-1 overflow-hidden relative h-full flex items-center"><div className="ticker-container w-full"><div className="ticker-content text-lg font-medium text-cyan-300">{ticker}</div></div></div>
      </div>
      <div className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 relative bg-black flex flex-col justify-center overflow-hidden">
           
           {/* LAYER 0: MEDIA (Sempre montato) */}
           <div className={`absolute inset-0 transition-opacity duration-500 ${showQuiz ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
                {activeQuiz && (
                    <QuizMediaFixed 
                        mediaUrl={activeQuiz.media_url} 
                        mediaType={activeQuiz.media_type} 
                        mediaState={activeQuiz.media_state}
                        // isResult=true significa "Nascondi video, mostra sfondo". 
                        // Lo mettiamo a true se siamo in classifica o risultati.
                        isResult={isOverlayMode} 
                    />
                )}
           </div>

           {/* LAYER 1: UI */}
           <div className={`absolute inset-0 transition-opacity duration-500 ${showQuiz ? 'opacity-100 z-20' : 'opacity-0 z-0 pointer-events-none'}`}>
               {activeQuiz && <QuizUI quiz={activeQuiz} quizResults={quizResults} leaderboard={displayData?.leaderboard || []} />}
           </div>

           {/* LAYER 2: KARAOKE */}
           <div className={`absolute inset-0 transition-opacity duration-500 ${showKaraoke ? 'opacity-100 z-30' : 'opacity-0 z-0 pointer-events-none'}`}>
               {currentPerf && (<KaraokeScreen performance={currentPerf} isVoting={currentPerf.status === 'voting'} voteResult={voteResult} />)}
           </div>

           {/* LAYER 3: WAITING */}
           <div className={`absolute inset-0 transition-opacity duration-500 ${showWaiting ? 'opacity-100 z-40' : 'opacity-0 z-0 pointer-events-none'}`}>
               <div className="flex flex-col items-center justify-center h-full bg-zinc-950 animate-fade-in relative">
                   <h2 className="text-7xl font-bold mb-8 text-white">PROSSIMO CANTANTE... TU?</h2>
                   <div className="bg-white p-6 rounded-3xl shadow-[0_0_50px_rgba(255,255,255,0.2)]"><QRCodeSVG value={joinUrl} size={300} /></div>
                   <p className="text-4xl text-zinc-400 mt-8 font-mono tracking-widest">{pubCode}</p>
               </div>
           </div>
        </div>
        {!isOverlayMode && (
            <div className="w-[350px] bg-zinc-900/95 border-l border-zinc-800 flex flex-col z-[60] shadow-2xl relative">
                {/* ... Sidebar invariata ... */}
                <div className="p-6 flex flex-col items-center bg-white/5 border-b border-white/10"><div className="bg-white p-3 rounded-xl mb-3 shadow-lg transform hover:scale-105 transition"><QRCodeSVG value={joinUrl} size={150} /></div><p className="font-mono text-3xl font-bold text-cyan-400 tracking-widest drop-shadow">{pubCode}</p></div>
                <div className="h-[35%] border-t border-white/10 p-4 bg-gradient-to-b from-zinc-900 to-black"><h3 className="text-lg font-bold text-yellow-500 mb-4 flex items-center gap-2 uppercase tracking-wider"><Trophy className="w-5 h-5"/> Top Player</h3><div className="space-y-2 overflow-y-auto custom-scrollbar h-full pb-4">{(displayData?.leaderboard || []).slice(0, 5).map((p, i) => (<div key={p.id} className={`flex justify-between items-center p-2 rounded ${i===0 ? 'bg-yellow-500/20 border border-yellow-500/30' : ''}`}><div className="flex items-center gap-3"><span className={`font-bold w-6 h-6 flex items-center justify-center rounded-full text-xs ${i===0 ? 'bg-yellow-500 text-black' : 'bg-zinc-800 text-zinc-400'}`}>{i+1}</span><span className={`font-medium ${i===0 ? 'text-white' : 'text-zinc-300'}`}>{p.nickname}</span></div><span className="text-cyan-400 font-mono font-bold">{p.score}</span></div>))}</div></div>
            </div>
        )}
      </div>
      {/* OVERLAYS... */}
      <style jsx>{`.ticker-container { width: 100%; overflow: hidden; } .ticker-content { display: inline-block; white-space: nowrap; animation: ticker 30s linear infinite; } @keyframes ticker { 0% { transform: translateX(100%); } 100% { transform: translateX(-100%); } } .animate-float-up { animation: floatUp 4s ease-out forwards; } @keyframes floatUp { 0% { transform: translateY(0) scale(0.5); opacity: 0; } 10% { opacity: 1; } 90% { opacity: 1; } 100% { transform: translateY(-80vh) scale(1.5); opacity: 0; } } .animate-spin-slow { animation: spin 8s linear infinite; } @keyframes spin { 100% { transform: rotate(360deg); } } .animate-slide-in-left { animation: slideInLeft 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275); } @keyframes slideInLeft { from { transform: translateX(-100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } } .animate-zoom-in { animation: zoomIn 0.4s ease-out; } @keyframes zoomIn { from { transform: scale(0.8); opacity: 0; } to { transform: scale(1); opacity: 1; } } .animate-fade-in { animation: fadeIn 0.5s ease-out; } @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } } .custom-scrollbar::-webkit-scrollbar { width: 6px; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #444; border-radius: 10px; } .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }`}</style>
    </div>
  );
}