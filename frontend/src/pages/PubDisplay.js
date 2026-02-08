import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { Mic2, Music, Trophy, Star, VolumeX } from "lucide-react";
import api from "@/lib/api";
import { supabase } from "@/lib/supabase";

export default function PubDisplay() {
  const { pubCode } = useParams();
  const [displayData, setDisplayData] = useState(null);
  const [floatingReactions, setFloatingReactions] = useState([]);
  const [flashMessages, setFlashMessages] = useState([]);
  const [ticker, setTicker] = useState("");
  
  // Quiz State
  const [activeQuiz, setActiveQuiz] = useState(null);
  const [quizResults, setQuizResults] = useState(null);
  const [quizStatus, setQuizStatus] = useState(null);
  
  // Player Refs
  const playerRef = useRef(null);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const currentVideoIdRef = useRef(null);
  const pollIntervalRef = useRef(null);

  const extractVideoId = (url) => {
    if (!url) return null;
    let videoId = null;
    const watchMatch = url.match(/[?&]v=([^&]+)/);
    if (watchMatch) videoId = watchMatch[1];
    const shortMatch = url.match(/youtu\.be\/([^?&]+)/);
    if (shortMatch) videoId = shortMatch[1];
    const embedMatch = url.match(/embed\/([^?&]+)/);
    if (embedMatch) videoId = embedMatch[1];
    return videoId;
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

  // --- LOGICA PLAYER LIVE (FIXATA) ---
  useEffect(() => {
    if (!isPlayerReady || !displayData?.current_performance) return;
    const perf = displayData.current_performance;
    const videoId = extractVideoId(perf.youtube_url);
    const status = perf.status;

    // 1. Gestione Stop in Votazione
    if (status === 'voting' || status === 'ended') {
        if (playerRef.current && typeof playerRef.current.stopVideo === 'function') {
            playerRef.current.stopVideo();
        }
        return; 
    }

    // 2. Caricamento Video
    if (videoId && videoId !== currentVideoIdRef.current) {
      currentVideoIdRef.current = videoId;
      if (playerRef.current) {
        playerRef.current.loadVideoById(videoId);
      } else {
        playerRef.current = new window.YT.Player('youtube-player', {
          height: '100%', width: '100%', videoId: videoId,
          playerVars: { autoplay: 1, controls: 0, modestbranding: 1, rel: 0, fs: 0 },
          events: { onReady: (e) => e.target.playVideo() }
        });
      }
    }

    // 3. Applicazione Effetti (Mute, Rewind, Play/Pause)
    if (playerRef.current && typeof playerRef.current.getPlayerState === 'function') {
      // Mute / Unmute
      if (perf.is_muted) playerRef.current.mute();
      else playerRef.current.unMute();

      // Stati
      if (status === 'paused') playerRef.current.pauseVideo();
      else if (status === 'live' && playerRef.current.getPlayerState() !== 1) playerRef.current.playVideo();
      else if (status === 'restarted') { 
          playerRef.current.seekTo(0); 
          playerRef.current.playVideo();
          // Reset status to live in local to prevent loop seeking, though DB update handles it mostly
      }
    }
  }, [isPlayerReady, displayData?.current_performance]); // Dipende da tutto l'oggetto perf

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
    } catch (error) { console.error(error); }
  }, [pubCode]);

  useEffect(() => {
    loadDisplayData();
    pollIntervalRef.current = setInterval(loadDisplayData, 2000); // Polling più veloce (2s)
    return () => clearInterval(pollIntervalRef.current);
  }, [loadDisplayData]);

  // Flash Messages
  const showFlashMessage = (msg) => {
    const id = Date.now();
    setFlashMessages(prev => [...prev, { ...msg, internalId: id }]);
    setTimeout(() => {
      setFlashMessages(prev => prev.filter(m => m.internalId !== id));
    }, 7000);
  };

  const addFloatingReaction = (emoji, nickname) => {
    const id = Date.now() + Math.random();
    const left = Math.random() * 80 + 10;
    setFloatingReactions(prev => [...prev, { id, emoji, nickname, left }]);
    setTimeout(() => setFloatingReactions(prev => prev.filter(r => r.id !== id)), 3000);
  };

  // Realtime Subscriptions
  useEffect(() => {
    if (!displayData?.pub?.id) return;
    const channel = supabase
      .channel(`display_realtime`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'performances', filter: `event_id=eq.${displayData.pub.id}` }, 
        (payload) => setDisplayData(prev => ({...prev, current_performance: payload.new}))
      )
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reactions', filter: `event_id=eq.${displayData.pub.id}` }, 
        (payload) => addFloatingReaction(payload.new.emoji, payload.new.nickname)
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `event_id=eq.${displayData.pub.id}` }, 
        async (payload) => {
          if (payload.new.status === 'approved') {
            const { data } = await supabase.from('participants').select('nickname').eq('id', payload.new.participant_id).single();
            showFlashMessage({ text: payload.new.text, nickname: data?.nickname || 'Utente' });
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
             setTimeout(() => { setActiveQuiz(null); setQuizResults(null); setQuizStatus(null); }, 5000);
           }
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [displayData?.pub?.id]);

  const currentPerf = displayData?.current_performance;
  const queue = displayData?.queue || [];
  const leaderboard = displayData?.leaderboard || [];
  const joinUrl = `${window.location.origin}/join/${pubCode}`;

  // Helper per Quiz Media
  const getQuizMediaId = (url) => {
      if(!url) return null;
      return extractVideoId(url);
  }

  return (
    <div className="h-screen bg-black text-white overflow-hidden flex flex-col font-sans">
      
      {/* Header */}
      <div className="h-16 bg-zinc-900 flex items-center px-6 border-b border-zinc-800 z-20 relative">
         <div className="font-bold text-xl mr-8 text-fuchsia-500">{displayData?.pub?.name || "Karaoke"}</div>
         <div className="flex-1 overflow-hidden relative h-full flex items-center">
            <div className="ticker-container w-full">
               <div className="ticker-content text-lg font-medium text-cyan-300">{ticker}</div>
            </div>
         </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        
        {/* Sinistra: STAGE */}
        <div className="flex-1 relative bg-black flex flex-col justify-center">
           
           {currentPerf && currentPerf.status === 'voting' ? (
              // VOTING SCREEN
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-gradient-to-t from-fuchsia-900/50 to-black animate-fade-in">
                 <h2 className="text-7xl font-black text-white mb-6 animate-pulse">VOTAZIONE APERTA</h2>
                 <p className="text-4xl text-zinc-300 mb-8">Vota dal tuo telefono!</p>
                 <div className="bg-white/10 p-12 rounded-full border-4 border-yellow-500 shadow-[0_0_80px_rgba(234,179,8,0.4)]">
                    <Star className="w-40 h-40 text-yellow-500 fill-yellow-500 animate-spin-slow" />
                 </div>
                 <div className="mt-12 text-center">
                    <p className="text-2xl text-zinc-400 mb-2">Cantante</p>
                    <p className="text-5xl font-bold text-white">{currentPerf.user_nickname}</p>
                 </div>
              </div>
           ) : (
              // VIDEO PLAYER
              <>
                 <div 
                    className={`absolute inset-0 w-full h-full z-0 transition-all duration-700 ${currentPerf?.is_blurred ? 'blur-3xl' : 'blur-0'}`}
                 >
                    <div id="youtube-player" className={`w-full h-full ${!currentPerf ? 'hidden' : ''}`}></div>
                 </div>
                 
                 {/* ICONA MUTE OVERLAY */}
                 {currentPerf?.is_muted && (
                     <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
                        <div className="bg-black/50 p-8 rounded-full border-4 border-red-500">
                           <VolumeX className="w-32 h-32 text-red-500" />
                        </div>
                     </div>
                 )}

                 {/* INFO CANZONE */}
                 {currentPerf && !currentPerf.is_blurred && (
                   <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/80 to-transparent p-12 z-10 pb-20">
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
              </>
           )}

           {/* Placeholder */}
           {!currentPerf && (
             <div className="flex flex-col items-center justify-center h-full z-10 bg-zinc-950/50">
                <h2 className="text-7xl font-bold mb-4 text-zinc-700">PALCO VUOTO</h2>
                <p className="text-3xl text-zinc-500">Inquadra il QR per richiedere una canzone</p>
             </div>
           )}
        </div>

        {/* Destra: Sidebar */}
        <div className="w-[350px] bg-zinc-900/90 border-l border-zinc-800 flex flex-col z-20 shadow-2xl">
           <div className="p-6 flex flex-col items-center bg-white/5 border-b border-white/10">
              <div className="bg-white p-3 rounded-xl mb-3"><QRCodeSVG value={joinUrl} size={180} /></div>
              <p className="font-mono text-2xl font-bold text-cyan-400 tracking-widest">{pubCode}</p>
           </div>
           <div className="flex-1 overflow-hidden flex flex-col p-4">
              <h3 className="text-lg font-bold text-fuchsia-400 mb-3 flex items-center gap-2"><Music className="w-5 h-5"/> In Coda</h3>
              <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar">
                 {queue.length === 0 ? <p className="text-zinc-600 text-center mt-10">Coda vuota</p> : queue.map((s, i) => (
                    <div key={s.id} className="bg-black/40 p-3 rounded-lg border-l-2 border-fuchsia-500">
                       <div className="font-bold text-white truncate">{s.title}</div>
                       <div className="text-xs text-zinc-400">{s.user_nickname}</div>
                    </div>
                 ))}
              </div>
           </div>
           <div className="h-1/3 border-t border-white/10 p-4 bg-black/20">
              <h3 className="text-lg font-bold text-yellow-500 mb-3 flex items-center gap-2"><Trophy className="w-5 h-5"/> Top 5</h3>
              <div className="space-y-2">
                 {leaderboard.map((p, i) => (
                    <div key={p.id} className="flex justify-between text-sm">
                       <span><span className="font-bold w-4 inline-block">{i+1}.</span> {p.nickname}</span>
                       <span className="text-cyan-400 font-mono">{p.score}</span>
                    </div>
                 ))}
              </div>
           </div>
        </div>
      </div>

      {/* MESSAGGI */}
      <div className="fixed top-20 left-0 right-0 z-50 flex flex-col items-center pointer-events-none gap-2">
        {flashMessages.map(msg => (
          <div key={msg.internalId} className="bg-black/70 backdrop-blur-md rounded-full px-8 py-3 border border-cyan-500/50 shadow-lg animate-fade-in-down flex items-center gap-4">
            <span className="text-cyan-400 font-bold uppercase text-sm">{msg.nickname}:</span>
            <span className="text-white font-medium text-2xl">{msg.text}</span>
          </div>
        ))}
      </div>

      {/* REAZIONI */}
      <div className="reactions-overlay pointer-events-none fixed inset-0 z-40">
        {floatingReactions.map(r => (
          <div key={r.id} className="absolute flex flex-col items-center animate-float-up" style={{ left: `${r.left}%`, bottom: '0' }}>
            <span className="text-5xl drop-shadow-md">{r.emoji}</span>
          </div>
        ))}
      </div>

      {/* QUIZ OVERLAY + AUDIO PLAYER */}
      {activeQuiz && !quizResults && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex flex-col items-center justify-center p-20 animate-fade-in">
           {/* AUDIO PLAYER NASCOSTO/VISIBILE PER IL QUIZ */}
           {activeQuiz.media_url && getQuizMediaId(activeQuiz.media_url) && (
              <div className="absolute top-10 right-10 opacity-50 hover:opacity-100">
                 <iframe 
                    width="300" 
                    height="200" 
                    src={`https://www.youtube.com/embed/${getQuizMediaId(activeQuiz.media_url)}?autoplay=1&controls=0`} 
                    title="Quiz Audio" 
                    className="rounded-xl pointer-events-none"
                    allow="autoplay"
                 ></iframe>
                 <p className="text-center text-xs mt-2 text-zinc-500">Audio Quiz</p>
              </div>
           )}

           <div className="max-w-5xl w-full text-center">
              <div className="mb-8">
                 <span className={`px-6 py-2 rounded-full text-xl font-bold uppercase tracking-widest ${
                    quizStatus === 'closed' ? 'bg-red-600 text-white' : 'bg-fuchsia-600 text-white animate-pulse'
                 }`}>
                    {quizStatus === 'closed' ? "TEMPO SCADUTO - ATTENDI I RISULTATI" : "QUIZ IN CORSO"}
                 </span>
              </div>
              <h2 className="text-7xl font-black text-white mb-12 leading-tight">{activeQuiz.question}</h2>
              <div className="grid grid-cols-2 gap-8">
                 {activeQuiz.options.map((opt, i) => (
                    <div key={i} className={`p-8 rounded-2xl text-4xl font-bold border-4 transition-all ${
                       quizStatus === 'closed' ? 'border-zinc-700 text-zinc-500 bg-zinc-900' : 'border-white/20 bg-white/5 text-white'
                    }`}>
                       <span className="text-fuchsia-500 mr-4">{String.fromCharCode(65+i)}.</span> {opt}
                    </div>
                 ))}
              </div>
           </div>
        </div>
      )}

      {/* QUIZ RISULTATI */}
      {quizResults && (
        <div className="fixed inset-0 z-[100] bg-gradient-to-br from-green-900 to-black flex flex-col items-center justify-center p-20 animate-zoom-in">
           <Trophy className="w-40 h-40 text-yellow-400 mb-8 animate-bounce" />
           <h2 className="text-8xl font-black text-white mb-4">RISPOSTA ESATTA!</h2>
           <div className="bg-white text-black px-12 py-6 rounded-3xl mb-12 shadow-[0_0_50px_rgba(255,255,255,0.3)]">
              <p className="text-6xl font-bold">{quizResults.correct_option}</p>
           </div>
           <div className="text-center">
              <p className="text-2xl text-green-300 uppercase tracking-widest mb-2">Vincitori del Round</p>
              <p className="text-3xl text-white font-medium max-w-4xl leading-relaxed">
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
        @keyframes floatUp { 0% { transform: translateY(0) scale(0.5); opacity: 0; } 10% { opacity: 1; } 100% { transform: translateY(-80vh) scale(1.5); opacity: 0; } }
        .animate-spin-slow { animation: spin 8s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; }
      `}</style>
    </div>
  );
}