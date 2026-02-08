import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { Mic2, Music, Trophy, Star, VolumeX } from "lucide-react";
import api from "@/lib/api";
import { supabase } from "@/lib/supabase";

export default function PubDisplay() {
  const { pubCode } = useParams();
  const [displayData, setDisplayData] = useState(null);
  
  // UI States
  const [floatingReactions, setFloatingReactions] = useState([]);
  const [flashMessages, setFlashMessages] = useState([]);
  const [ticker, setTicker] = useState("Inquadra il QR per cantare!");
  
  // Quiz
  const [activeQuiz, setActiveQuiz] = useState(null);
  const [quizResults, setQuizResults] = useState(null);
  const [quizStatus, setQuizStatus] = useState(null);
  
  // Player
  const playerRef = useRef(null);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const currentVideoIdRef = useRef(null);

  const extractVideoId = (url) => {
    if (!url) return null;
    const match = url.match(/[?&]v=([^&]+)/) || url.match(/youtu\.be\/([^?&]+)/) || url.match(/embed\/([^?&]+)/);
    return match ? match[1] : null;
  };

  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      document.body.appendChild(tag);
      window.onYouTubeIframeAPIReady = () => setIsPlayerReady(true);
    } else { setIsPlayerReady(true); }
  }, []);

  // --- PLAYER LOGIC (LIVE CONTROLS) ---
  useEffect(() => {
    if (!isPlayerReady || !displayData?.current_performance) return;
    const perf = displayData.current_performance;
    const videoId = extractVideoId(perf.youtube_url);
    
    // Stop se votazione
    if (perf.status === 'voting' || perf.status === 'ended') {
        playerRef.current?.stopVideo?.();
        return;
    }

    // Carica Video
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

    // Comandi Live (Mute, Pause, ecc.)
    if (playerRef.current?.getPlayerState) {
        perf.is_muted ? playerRef.current.mute() : playerRef.current.unMute();
        
        if (perf.status === 'paused') playerRef.current.pauseVideo();
        else if (perf.status === 'live' && playerRef.current.getPlayerState() !== 1) playerRef.current.playVideo();
        else if (perf.status === 'restarted') { 
            playerRef.current.seekTo(0); 
            playerRef.current.playVideo(); 
        }
    }
  }, [isPlayerReady, displayData?.current_performance]); 

  const loadDisplayData = useCallback(async () => {
    try {
      const { data } = await api.getDisplayData(pubCode);
      setDisplayData(data);
      if(data.queue?.length > 0) setTicker(data.queue.map(q => `${q.title} (${q.user_nickname})`).join(" • "));
    } catch (e) { console.error(e); }
  }, [pubCode]);

  useEffect(() => {
    loadDisplayData();
    const interval = setInterval(loadDisplayData, 3000);
    return () => clearInterval(interval);
  }, [loadDisplayData]);

  // --- REAZIONI E MESSAGGI (NOMI RIPRISTINATI) ---
  const addFloatingReaction = (emoji, nickname) => {
    const id = Date.now() + Math.random();
    setFloatingReactions(prev => [...prev, { id, emoji, nickname, left: Math.random() * 80 + 10 }]);
    setTimeout(() => setFloatingReactions(prev => prev.filter(r => r.id !== id)), 4000);
  };

  const showFlashMessage = (text, nickname) => {
    const id = Date.now();
    setFlashMessages(prev => [...prev, { id, text, nickname }]);
    setTimeout(() => setFlashMessages(prev => prev.filter(m => m.id !== id)), 8000);
  };

  useEffect(() => {
    if (!displayData?.pub?.id) return;
    const channel = supabase.channel('display_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'performances', filter: `event_id=eq.${displayData.pub.id}` }, 
        (payload) => setDisplayData(prev => ({...prev, current_performance: payload.new}))
      )
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reactions', filter: `event_id=eq.${displayData.pub.id}` }, 
        (payload) => addFloatingReaction(payload.new.emoji, payload.new.nickname) // QUI IL NICKNAME ARRIVA DALLA TABELLA
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `event_id=eq.${displayData.pub.id}` }, 
        async (payload) => {
           if(payload.new.status === 'approved') {
               let sender = "REGIA";
               if(payload.new.participant_id) {
                   const { data } = await supabase.from('participants').select('nickname').eq('id', payload.new.participant_id).single();
                   if(data) sender = data.nickname;
               }
               showFlashMessage(payload.new.text, sender);
           }
        }
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quizzes', filter: `event_id=eq.${displayData.pub.id}` }, 
        async (payload) => {
           setQuizStatus(payload.new.status);
           if(['active','closed'].includes(payload.new.status)) { setActiveQuiz(payload.new); setQuizResults(null); }
           if(payload.new.status === 'showing_results') {
               const res = await api.getQuizResults(payload.new.id);
               setQuizResults(res.data);
           }
           if(payload.new.status === 'ended') { setTimeout(() => { setActiveQuiz(null); setQuizResults(null); }, 5000); }
        }
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [displayData?.pub?.id]);

  const currentPerf = displayData?.current_performance;
  const joinUrl = `${window.location.origin}/join/${pubCode}`;

  return (
    <div className="h-screen bg-black text-white overflow-hidden flex flex-col font-sans">
      
      {/* Header */}
      <div className="h-16 bg-zinc-900 flex items-center px-6 border-b border-zinc-800 z-50 relative">
         <div className="font-bold text-xl mr-8 text-fuchsia-500">{displayData?.pub?.name || "NeonPub"}</div>
         <div className="flex-1 overflow-hidden relative"><div className="ticker-container w-full"><div className="ticker-content text-lg text-cyan-300">{ticker}</div></div></div>
      </div>

      <div className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 relative bg-black flex flex-col justify-center">
           
           {/* AUDIO PLAYER NASCOSTO PER QUIZ */}
           {activeQuiz?.media_url && extractVideoId(activeQuiz.media_url) && (
               <div className="absolute top-0 right-0 w-1 h-1 opacity-0 pointer-events-none">
                   <iframe src={`https://www.youtube.com/embed/${extractVideoId(activeQuiz.media_url)}?autoplay=1`} allow="autoplay"></iframe>
               </div>
           )}

           {/* VIDEO PLAYER CON SFOCATURA */}
           <div className={`absolute inset-0 w-full h-full transition-all duration-500 ${currentPerf?.is_blurred ? 'blur-xl' : ''}`}>
               <div id="youtube-player" className="w-full h-full"></div>
           </div>

           {/* ICONA MUTE */}
           {currentPerf?.is_muted && (
               <div className="absolute inset-0 flex items-center justify-center z-40 bg-black/20">
                   <VolumeX className="w-32 h-32 text-red-500 drop-shadow-lg" />
               </div>
           )}

           {/* INFO CANZONE */}
           {currentPerf && !currentPerf.is_blurred && (
             <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/80 to-transparent p-10 z-30 pb-20">
                <h2 className="text-6xl font-black mb-2">{currentPerf.song_title}</h2>
                <div className="flex items-end gap-6">
                   <p className="text-4xl text-zinc-300">{currentPerf.song_artist}</p>
                   <div className="bg-fuchsia-600 px-6 py-2 rounded-full flex gap-2 items-center"><Mic2/> <span className="text-2xl font-bold">{currentPerf.user_nickname}</span></div>
                </div>
             </div>
           )}

           {/* VOTAZIONE */}
           {currentPerf?.status === 'voting' && (
              <div className="absolute inset-0 z-50 bg-black flex flex-col items-center justify-center animate-fade-in">
                 <h2 className="text-8xl font-black text-yellow-500 mb-8 animate-pulse">VOTA ORA!</h2>
                 <Star className="w-48 h-48 text-yellow-500 animate-spin-slow" />
              </div>
           )}
        </div>

        {/* SIDEBAR */}
        <div className="w-[350px] bg-zinc-900/95 border-l border-zinc-800 flex flex-col z-40 shadow-2xl">
           <div className="p-6 flex flex-col items-center border-b border-white/10">
              <div className="bg-white p-3 rounded-xl mb-3"><QRCodeSVG value={joinUrl} size={160} /></div>
              <p className="font-mono text-2xl font-bold text-cyan-400">{pubCode}</p>
           </div>
           <div className="flex-1 p-4 overflow-hidden">
              <h3 className="text-lg font-bold text-fuchsia-400 mb-3"><Music className="inline w-5 h-5 mr-2"/> Coda</h3>
              <div className="space-y-3">{(displayData?.queue || []).map(s => (
                  <div key={s.id} className="bg-white/5 p-3 rounded border-l-4 border-fuchsia-500">
                      <div className="font-bold truncate">{s.title}</div>
                      <div className="text-xs text-zinc-400">{s.user_nickname}</div>
                  </div>
              ))}</div>
           </div>
           <div className="h-1/3 p-4 border-t border-white/10 bg-black/20">
              <h3 className="text-lg font-bold text-yellow-500 mb-3"><Trophy className="inline w-5 h-5 mr-2"/> Classifica</h3>
              {(displayData?.leaderboard || []).map((p,i) => (
                  <div key={i} className="flex justify-between text-sm py-1">
                      <span>#{i+1} {p.nickname}</span>
                      <span className="text-cyan-400 font-bold">{p.score}</span>
                  </div>
              ))}
           </div>
        </div>
      </div>

      {/* MESSAGGI */}
      <div className="fixed top-24 left-0 right-0 z-[60] flex flex-col items-center pointer-events-none gap-2">
        {flashMessages.map(msg => (
          <div key={msg.id} className="bg-black/80 backdrop-blur-md px-8 py-4 rounded-full border-2 border-cyan-500 shadow-2xl animate-bounce-in flex items-center gap-4">
             <span className="bg-cyan-500 text-black font-bold px-2 py-1 rounded text-xs uppercase">{msg.nickname}</span>
             <span className="text-2xl font-bold text-white">{msg.text}</span>
          </div>
        ))}
      </div>

      {/* REAZIONI */}
      <div className="reactions-overlay pointer-events-none fixed inset-0 z-50">
        {floatingReactions.map(r => (
          <div key={r.id} className="absolute flex flex-col items-center animate-float-up" style={{ left: `${r.left}%`, bottom: '-50px' }}>
            <span className="text-6xl filter drop-shadow-lg">{r.emoji}</span>
            {/* NOME SOTTO EMOJI */}
            <span className="text-lg font-bold bg-black/60 px-3 py-1 rounded-full text-white mt-1">{r.nickname}</span>
          </div>
        ))}
      </div>

      {/* QUIZ */}
      {activeQuiz && !quizResults && (
        <div className="fixed inset-0 bg-black/95 z-[100] flex flex-col items-center justify-center p-10 animate-fade-in">
           <h2 className="text-6xl font-bold text-center mb-10 leading-tight">{activeQuiz.question}</h2>
           {activeQuiz.media_url && <div className="text-cyan-400 animate-pulse mb-8 text-xl">🎵 ASCOLTA L'AUDIO 🎵</div>}
           <div className="grid grid-cols-2 gap-6 w-full max-w-5xl">
              {activeQuiz.options.map((o, i) => (
                  <div key={i} className="bg-white/10 p-8 rounded-2xl text-3xl font-bold border-2 border-white/20">
                      <span className="text-fuchsia-500 mr-4">{String.fromCharCode(65+i)}.</span> {o}
                  </div>
              ))}
           </div>
        </div>
      )}

      {quizResults && (
        <div className="fixed inset-0 bg-gradient-to-br from-green-900 to-black z-[100] flex flex-col items-center justify-center animate-zoom-in">
           <Trophy className="w-40 h-40 text-yellow-400 mb-6"/>
           <h2 className="text-7xl font-bold mb-4">RISPOSTA ESATTA!</h2>
           <div className="bg-white text-black px-12 py-6 rounded-full text-5xl font-bold mb-8">{quizResults.correct_option}</div>
           <div className="text-center text-zinc-300 text-xl">Vincitori: <br/><span className="text-white text-2xl font-bold">{quizResults.winners.join(', ')}</span></div>
        </div>
      )}

      <style jsx>{`
        .ticker-container { width: 100%; overflow: hidden; }
        .ticker-content { display: inline-block; white-space: nowrap; animation: ticker 25s linear infinite; }
        @keyframes ticker { 0% { transform: translateX(100%); } 100% { transform: translateX(-100%); } }
        .animate-float-up { animation: float-up 3s ease-out forwards; }
        @keyframes float-up { 0% { bottom: -50px; opacity: 1; } 100% { bottom: 80vh; opacity: 0; } }
        .animate-spin-slow { animation: spin 10s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}