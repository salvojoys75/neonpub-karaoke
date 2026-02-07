import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { Mic2, Music, Trophy, Star, MessageSquare } from "lucide-react";
import api from "@/lib/api";
import { supabase } from "@/lib/supabase";

export default function PubDisplay() {
  const { pubCode } = useParams();
  const [displayData, setDisplayData] = useState(null);
  
  const [floatingReactions, setFloatingReactions] = useState([]);
  const [flashMessages, setFlashMessages] = useState([]);
  const [ticker, setTicker] = useState("");
  
  const [activeQuiz, setActiveQuiz] = useState(null);
  const [quizResults, setQuizResults] = useState(null);
  const [quizStatus, setQuizStatus] = useState(null);
  const [voteResult, setVoteResult] = useState(null);
  
  const playerRef = useRef(null);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const currentVideoIdRef = useRef(null);
  const pollIntervalRef = useRef(null);

  const extractVideoId = (url) => {
    if (!url) return null;
    if (url.includes("results?search_query")) return null;
    let videoId = null;
    const watchMatch = url.match(/[?&]v=([^&]+)/);
    if (watchMatch) videoId = watchMatch[1];
    const shortMatch = url.match(/youtu\.be\/([^?&]+)/);
    if (shortMatch) videoId = shortMatch[1];
    const embedMatch = url.match(/embed\/([^?&]+)/);
    if (embedMatch) videoId = embedMatch[1];
    return videoId;
  };
const isEmbeddable = async (videoId) => {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
    );
    return res.ok;
  } catch {
    return false;
  }
};

  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
      window.onYouTubeIframeAPIReady = () => setIsPlayerReady(true);
    } else { setIsPlayerReady(true); }
  }, []);

  useEffect(() => {
    if (!isPlayerReady || !displayData?.current_performance) return;
    const perf = displayData.current_performance;
    const status = perf.status;

    if (status === 'voting' || status === 'ended') {
        if (playerRef.current && typeof playerRef.current.stopVideo === 'function') {
            playerRef.current.stopVideo();
        }
        return; 
    }

    const videoId = extractVideoId(perf.youtube_url);
if (!videoId) return;

isEmbeddable(videoId).then((ok) => {
  if (!ok) {
    window.open(
      `https://www.youtube.com/watch?v=${videoId}`,
      "_blank"
    );
    return;
  }

  if (videoId !== currentVideoIdRef.current) {
    currentVideoIdRef.current = videoId;

    if (playerRef.current) {
      playerRef.current.loadVideoById(videoId);
    } else {
      playerRef.current = new window.YT.Player("youtube-player", {
        height: "100%",
        width: "100%",
        videoId,
        playerVars: {
          autoplay: 1,
          controls: 0,
          modestbranding: 1,
          rel: 0,
          fs: 0
        },
        events: {
          onReady: (e) => e.target.playVideo()
        }
      });
    }
  }
});


    if (playerRef.current && typeof playerRef.current.getPlayerState === 'function') {
      if (status === 'paused') playerRef.current.pauseVideo();
      else if (status === 'live' && playerRef.current.getPlayerState() !== 1) playerRef.current.playVideo();
      else if (status === 'restarted') { playerRef.current.seekTo(0); playerRef.current.playVideo(); }
    }
  }, [isPlayerReady, displayData?.current_performance]);

  const loadDisplayData = useCallback(async () => {
    try {
      const { data } = await api.getDisplayData(pubCode);
      setDisplayData(data);
      
      const queueCount = data.queue?.length || 0;
      if (queueCount > 0) {
        const queueText = data.queue.slice(0, 5).map((s, i) => `${i + 1}. ${s.title} (${s.user_nickname})`).join(' • ');
        setTicker(queueText);
      } else {
        setTicker("Inquadra il QR Code per cantare!");
      }

      if (data.current_performance?.status === 'ended' && !voteResult) {
         setVoteResult(data.current_performance.average_score || 0);
         setTimeout(() => setVoteResult(null), 10000);
      }

    } catch (error) { console.error(error); }
  }, [pubCode, voteResult]);

  useEffect(() => {
    loadDisplayData();
    pollIntervalRef.current = setInterval(loadDisplayData, 5000);
    return () => clearInterval(pollIntervalRef.current);
  }, [loadDisplayData]);

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

  useEffect(() => {
    if (!displayData?.pub?.id) return;
    const channel = supabase
      .channel(`display_realtime`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'performances', filter: `event_id=eq.${displayData.pub.id}` }, 
        (payload) => {
             setDisplayData(prev => ({...prev, current_performance: payload.new}));
             if (payload.new.status === 'ended') {
                 setVoteResult(payload.new.average_score);
                 setTimeout(() => { loadDisplayData(); setVoteResult(null); }, 8000);
             }
        }
      )
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reactions', filter: `event_id=eq.${displayData.pub.id}` }, 
        (payload) => {
             if (!payload.new.emoji && payload.new.message) {
                 showFlashMessage({ text: payload.new.message, nickname: payload.new.nickname || "Regia" });
             } else {
                 addFloatingReaction(payload.new.emoji, payload.new.nickname);
             }
        }
      )
      // *** FIX MESSAGGI: ASCOLTO TUTTI GLI EVENTI (*) SU MESSAGES ***
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `event_id=eq.${displayData.pub.id}` }, 
        async (payload) => {
          // Se è un nuovo messaggio già approvato (Regia) O un aggiornamento ad approved (Utente)
          if (payload.new && payload.new.status === 'approved') {
            let nickname = "Utente";
            if (payload.new.participant_id) {
               const { data } = await supabase.from('participants').select('nickname').eq('id', payload.new.participant_id).single();
               if(data) nickname = data.nickname;
            } else {
               nickname = "Regia";
            }
            showFlashMessage({ text: payload.new.text, nickname: nickname });
          }
        }
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quizzes', filter: `event_id=eq.${displayData.pub.id}` }, 
        async (payload) => {
           setQuizStatus(payload.new.status);
           if (payload.new.status === 'active' || payload.new.status === 'closed') { 
             setActiveQuiz(payload.new); 
             setQuizResults(null); 
           } else if (payload.new.status === 'showing_results') {
             const res = await api.getQuizResults(payload.new.id);
             setQuizResults(res.data);
           } else if (payload.new.status === 'ended') {
             setTimeout(() => { setActiveQuiz(null); setQuizResults(null); setQuizStatus(null); loadDisplayData(); }, 5000);
           }
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [displayData?.pub?.id, loadDisplayData]);

  const currentPerf = displayData?.current_performance;
  const queue = displayData?.queue || [];
  const leaderboard = displayData?.leaderboard || [];
  const joinUrl = `${window.location.origin}/join/${pubCode}`;
  const isVoting = currentPerf?.status === 'voting';
  const isPerformanceActive = currentPerf && (currentPerf.status === 'live' || currentPerf.status === 'paused' || currentPerf.status === 'restarted');

  return (
    <div className="h-screen bg-black text-white overflow-hidden flex flex-col font-sans">
      <div className="h-16 bg-zinc-900 flex items-center px-6 border-b border-zinc-800 z-30 relative">
         <div className="font-bold text-xl mr-8 text-fuchsia-500">{displayData?.pub?.name || "Karaoke"}</div>
         <div className="flex-1 overflow-hidden relative h-full flex items-center">
            <div className="ticker-container w-full"><div className="ticker-content text-lg font-medium text-cyan-300">{ticker}</div></div>
         </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 relative bg-black flex flex-col justify-center overflow-hidden">
           <div id="youtube-player" className={`absolute inset-0 w-full h-full pointer-events-none z-0 ${isPerformanceActive ? 'opacity-100' : 'opacity-0'}`}></div>

           {isPerformanceActive && (
             <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/80 to-transparent p-12 z-10 pb-20 animate-fade-in">
                <h2 className="text-6xl font-black text-white mb-2 drop-shadow-lg">{currentPerf.song_title}</h2>
                <div className="flex items-end gap-6">
                   <p className="text-4xl text-zinc-300 font-medium">{currentPerf.song_artist}</p>
                   <div className="bg-fuchsia-600 px-6 py-2 rounded-full flex items-center gap-3 animate-pulse">
                      <Mic2 className="w-8 h-8" />
                      <span className="text-2xl font-bold uppercase tracking-wider">{currentPerf.user_nickname}</span>
                   </div>
                </div>
             </div>
           )}

           {isVoting && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-zinc-900 animate-zoom-in">
                 <div className="absolute inset-0 bg-[url('https://media.giphy.com/media/l41YcGT5ShJa0nCM0/giphy.gif')] opacity-10 bg-cover mix-blend-overlay"></div>
                 <h2 className="text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-600 mb-8 animate-pulse drop-shadow-lg">VOTA ORA!</h2>
                 <p className="text-4xl text-white mb-12 font-light">Prendi il tuo telefono e dai un voto!</p>
                 <div className="bg-white/10 p-16 rounded-full border-8 border-yellow-500 shadow-[0_0_100px_rgba(234,179,8,0.5)] animate-spin-slow"><Star className="w-48 h-48 text-yellow-500 fill-yellow-500" /></div>
                 <div className="mt-16 text-center z-30">
                    <p className="text-2xl text-zinc-500 mb-2 uppercase tracking-widest">Performance di</p>
                    <p className="text-6xl font-bold text-white">{currentPerf.user_nickname}</p>
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
                 <p className="text-zinc-500 text-2xl mt-8">Classifica Aggiornata!</p>
              </div>
           )}

           {!currentPerf && !activeQuiz && !voteResult && (
             <div className="flex flex-col items-center justify-center h-full z-10 bg-zinc-950">
                <h2 className="text-7xl font-bold mb-4 text-zinc-800">PALCO VUOTO</h2>
                <p className="text-3xl text-zinc-600">Inquadra il QR per richiedere una canzone</p>
             </div>
           )}
        </div>

        <div className="w-[350px] bg-zinc-900/95 border-l border-zinc-800 flex flex-col z-30 shadow-2xl relative">
           <div className="p-6 flex flex-col items-center bg-white/5 border-b border-white/10">
              <div className="bg-white p-3 rounded-xl mb-3 shadow-lg transform hover:scale-105 transition"><QRCodeSVG value={joinUrl} size={180} /></div>
              <p className="font-mono text-3xl font-bold text-cyan-400 tracking-widest drop-shadow">{pubCode}</p>
              <p className="text-xs text-zinc-500 uppercase mt-2">Scansiona per partecipare</p>
           </div>
           
           <div className="flex-1 overflow-hidden flex flex-col p-4">
              <h3 className="text-lg font-bold text-fuchsia-400 mb-4 flex items-center gap-2 uppercase tracking-wider"><Music className="w-5 h-5"/> Prossimi</h3>
              <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-2">
                 {queue.length === 0 ? <p className="text-center text-zinc-600 italic mt-10">Coda vuota...</p> : queue.map((s, i) => (
                    <div key={s.id} className="bg-black/40 p-3 rounded-lg border-l-4 border-fuchsia-600 hover:bg-white/5 transition">
                       <div className="font-bold text-white truncate text-lg">{s.title}</div>
                       <div className="flex justify-between items-center mt-1">
                          <span className="text-sm text-zinc-400 truncate max-w-[60%]">{s.artist}</span>
                          <span className="text-xs text-cyan-500 font-bold px-2 py-0.5 bg-cyan-900/20 rounded-full">{s.user_nickname}</span>
                       </div>
                    </div>
                 ))}
              </div>
           </div>

           <div className="h-[35%] border-t border-white/10 p-4 bg-gradient-to-b from-zinc-900 to-black">
              <h3 className="text-lg font-bold text-yellow-500 mb-4 flex items-center gap-2 uppercase tracking-wider"><Trophy className="w-5 h-5"/> Top Player</h3>
              <div className="space-y-2 overflow-y-auto custom-scrollbar h-full pb-4">
                 {leaderboard.map((p, i) => (
                    <div key={p.id} className={`flex justify-between items-center p-2 rounded ${i===0 ? 'bg-yellow-500/20 border border-yellow-500/30' : ''}`}>
                       <div className="flex items-center gap-3">
                          <span className={`font-bold w-6 h-6 flex items-center justify-center rounded-full text-xs ${i===0 ? 'bg-yellow-500 text-black' : i===1 ? 'bg-zinc-400 text-black' : i===2 ? 'bg-amber-700 text-white' : 'bg-zinc-800 text-zinc-400'}`}>{i+1}</span>
                          <span className={`font-medium ${i===0 ? 'text-white' : 'text-zinc-300'}`}>{p.nickname}</span>
                       </div>
                       <span className="text-cyan-400 font-mono font-bold">{p.score}</span>
                    </div>
                 ))}
              </div>
           </div>
        </div>
      </div>

      <div className="reactions-overlay pointer-events-none fixed inset-0 z-40 overflow-hidden">
        {floatingReactions.map(r => (
            <div key={r.id} className="absolute flex flex-col items-center animate-float-up" style={{ left: `${r.left}%`, bottom: '-50px' }}>
              <span className="text-7xl filter drop-shadow-2xl">{r.emoji}</span>
              <span className="text-xl text-white font-bold mt-1 bg-black/70 px-4 py-1 rounded-full border border-white/20 shadow-xl">{r.nickname}</span>
            </div>
        ))}
      </div>

      {flashMessages.length > 0 && (
        <div className="fixed top-24 left-8 z-[60] w-2/3 max-w-4xl flex flex-col gap-4">
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

      {activeQuiz && !quizResults && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center p-10 animate-fade-in">
           <div className="max-w-6xl w-full text-center">
              <div className="mb-12">
                 <span className={`px-8 py-3 rounded-full text-2xl font-bold uppercase tracking-widest shadow-lg ${quizStatus === 'closed' ? 'bg-red-600 text-white' : 'bg-fuchsia-600 text-white animate-pulse'}`}>
                    {quizStatus === 'closed' ? "TEMPO SCADUTO" : "QUIZ IN CORSO"}
                 </span>
              </div>
              <h2 className="text-7xl font-black text-white mb-16 leading-tight drop-shadow-2xl">{activeQuiz.question}</h2>
              <div className="grid grid-cols-2 gap-8">
                 {activeQuiz.options.map((opt, i) => (
                    <div key={i} className={`p-10 rounded-3xl text-4xl font-bold border-4 transition-all transform ${quizStatus === 'closed' ? 'border-zinc-800 text-zinc-600 bg-zinc-900 grayscale' : 'border-white/20 bg-white/5 text-white shadow-xl'}`}>
                       <span className="text-fuchsia-500 mr-6 inline-block scale-125">{String.fromCharCode(65+i)}.</span> {opt}
                    </div>
                 ))}
              </div>
           </div>
        </div>
      )}
      
      {quizResults && (
        <div className="fixed inset-0 z-[100] bg-gradient-to-br from-green-900 to-black flex flex-col items-center justify-center p-20 animate-zoom-in">
           <Trophy className="w-48 h-48 text-yellow-400 mb-10 animate-bounce drop-shadow-[0_0_50px_rgba(250,204,21,0.6)]" />
           <h2 className="text-8xl font-black text-white mb-6">RISPOSTA ESATTA!</h2>
           <div className="bg-white text-black px-16 py-8 rounded-[3rem] mb-12 shadow-[0_0_60px_rgba(255,255,255,0.4)] transform hover:scale-105 transition">
              <p className="text-7xl font-bold">{quizResults.correct_option}</p>
           </div>
           <div className="text-center bg-black/40 p-8 rounded-3xl backdrop-blur-md">
               <p className="text-2xl text-green-300 uppercase tracking-widest mb-4">Vincitori del Round</p>
               <p className="text-4xl text-white font-medium max-w-5xl leading-relaxed">
                 {quizResults.winners.length > 0 ? quizResults.winners.join(' • ') : "Nessuno ha indovinato!"}
               </p>
           </div>
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