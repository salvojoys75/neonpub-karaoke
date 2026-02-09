import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { Mic2, Trophy, Star, MessageSquare, Music2, Film, Crown } from "lucide-react";
import api from "@/lib/api";
import { supabase } from "@/lib/supabase";

export default function PubDisplay() {
  const { pubCode } = useParams();
  const [displayData, setDisplayData] = useState(null);
  
  // Stati Grafici
  const [floatingReactions, setFloatingReactions] = useState([]);
  const [flashMessages, setFlashMessages] = useState([]);
  const [ticker, setTicker] = useState("");
  
  // Stati Quiz
  const [activeQuiz, setActiveQuiz] = useState(null);
  const [quizResults, setQuizResults] = useState(null);
  const [quizStatus, setQuizStatus] = useState(null);
  const [quizLeaderboard, setQuizLeaderboard] = useState([]); // Nuova classifica live
  
  // Stati Karaoke
  const [voteResult, setVoteResult] = useState(null);
  const playerRef = useRef(null);
  const quizPlayerRef = useRef(null); // Player separato per i Quiz
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const currentVideoIdRef = useRef(null);
  const pollIntervalRef = useRef(null);

  // --- HELPER YOUTUBE ---
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

  // --- PLAYER KARAOKE (Sfondo) ---
  useEffect(() => {
    if (!isPlayerReady || !displayData?.current_performance) return;
    const perf = displayData.current_performance;
    
    // Se c'è un quiz attivo VIDEO, fermiamo il player karaoke per non accavallare l'audio
    if (activeQuiz && activeQuiz.media_type === 'video') {
        if (playerRef.current?.pauseVideo) playerRef.current.pauseVideo();
        return;
    }

    const videoId = extractVideoId(perf.youtube_url);
    if (!videoId) return;

    if (videoId !== currentVideoIdRef.current) {
        currentVideoIdRef.current = videoId;
        if (playerRef.current) {
            playerRef.current.loadVideoById(videoId);
        } else {
            playerRef.current = new window.YT.Player("youtube-player", {
                height: "100%", width: "100%", videoId,
                playerVars: { autoplay: 1, controls: 0, modestbranding: 1, rel: 0, fs: 0 },
                events: { onReady: (e) => e.target.playVideo() }
            });
        }
    }
  }, [isPlayerReady, displayData?.current_performance, activeQuiz]);

  // --- CARICAMENTO DATI ---
  const loadDisplayData = useCallback(async () => {
    try {
      const { data } = await api.getDisplayData(pubCode);
      setDisplayData(data);
      
      // Gestione Ticker
      const queueCount = data.queue?.length || 0;
      if (queueCount > 0) {
        setTicker(data.queue.slice(0, 5).map((s, i) => `${i + 1}. ${s.title} (${s.user_nickname})`).join(' • '));
      } else {
        setTicker("Inquadra il QR Code per cantare o giocare!");
      }

      // Risultato Voto Karaoke
      if (data.current_performance?.status === 'ended' && !voteResult && data.current_performance.average_score > 0) {
         setVoteResult(data.current_performance.average_score);
         setTimeout(() => setVoteResult(null), 10000);
      }

    } catch (error) { console.error(error); }
  }, [pubCode, voteResult]);

  useEffect(() => {
    loadDisplayData();
    pollIntervalRef.current = setInterval(loadDisplayData, 5000);
    return () => clearInterval(pollIntervalRef.current);
  }, [loadDisplayData]);

  // --- REALTIME LISTENER ---
  useEffect(() => {
    if (!displayData?.pub?.id) return;
    
    // 1. Canale Controllo (Mute, etc)
    const controlChannel = supabase.channel(`display_control_${pubCode}`)
        .on('broadcast', { event: 'control' }, (payload) => {
            if(payload.payload.command === 'mute') {
                if(playerRef.current?.mute) { payload.payload.value ? playerRef.current.mute() : playerRef.current.unMute(); }
            }
        }).subscribe();

    const channel = supabase.channel(`display_realtime`);

    // 2. Karaoke Updates
    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'performances', filter: `event_id=eq.${displayData.pub.id}` }, 
        (payload) => {
            setDisplayData(prev => ({ ...prev, current_performance: payload.new }));
            if (payload.new.status === 'voting' || payload.new.status === 'ended') loadDisplayData();
        }
    );

    // 3. Reactions & Messaggi
    channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reactions', filter: `event_id=eq.${displayData.pub.id}` }, (payload) => addFloatingReaction(payload.new.emoji, payload.new.nickname));
    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `event_id=eq.${displayData.pub.id}` }, 
        async (payload) => {
            if (payload.new && payload.new.status === 'approved') {
                let nickname = "Regia";
                if (payload.new.participant_id) {
                    const { data } = await supabase.from('participants').select('nickname').eq('id', payload.new.participant_id).single();
                    if(data) nickname = data.nickname;
                }
                showFlashMessage({ text: payload.new.text, nickname });
            }
        }
    );

    // 4. QUIZ UPDATES (Core Logic)
    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'quizzes', filter: `event_id=eq.${displayData.pub.id}` }, 
        async (payload) => {
            setQuizStatus(payload.new.status);
            
            if (payload.new.status === 'active') { 
                setActiveQuiz(payload.new); setQuizResults(null); setQuizLeaderboard([]);
            } 
            else if (payload.new.status === 'closed') {
                setActiveQuiz(payload.new);
            }
            else if (payload.new.status === 'showing_results') {
                const res = await api.getQuizResults(payload.new.id); 
                setQuizResults(res.data);
            } 
            else if (payload.new.status === 'leaderboard') {
                // Recupera classifica fresca
                const lb = await api.getLeaderboard();
                setQuizLeaderboard(lb.data || []);
            }
            else if (payload.new.status === 'ended') {
                setTimeout(() => { setActiveQuiz(null); setQuizResults(null); setQuizStatus(null); setQuizLeaderboard([]); loadDisplayData(); }, 3000);
            }
        }
    );

    channel.subscribe();
    return () => { supabase.removeChannel(channel); supabase.removeChannel(controlChannel); }
  }, [displayData?.pub?.id, pubCode, loadDisplayData]);


  // --- HELPERS UI ---
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
  const joinUrl = `${window.location.origin}/join/${pubCode}`;
  
  // Condizioni Render
  const isKaraokeActive = currentPerf && ['live','paused','restarted'].includes(currentPerf.status) && !activeQuiz;
  const isVideoQuiz = activeQuiz && activeQuiz.media_type === 'video' && activeQuiz.media_url;
  const isAudioQuiz = activeQuiz && activeQuiz.media_type === 'audio' && activeQuiz.media_url;

  return (
    <div className="h-screen bg-black text-white overflow-hidden flex flex-col font-sans">
      
      {/* HEADER */}
      <div className="h-16 bg-zinc-900 flex items-center px-6 border-b border-zinc-800 z-30 relative">
         <div className="font-bold text-xl mr-8 text-fuchsia-500">{displayData?.pub?.name || "Karaoke"}</div>
         <div className="flex-1 overflow-hidden relative h-full flex items-center">
            <div className="ticker-container w-full"><div className="ticker-content text-lg font-medium text-cyan-300">{ticker}</div></div>
         </div>
      </div>

      <div className="flex-1 flex overflow-hidden relative">
        
        {/* --- MAIN AREA --- */}
        <div className="flex-1 relative bg-black flex flex-col justify-center overflow-hidden">
           
           {/* 1. PLAYER KARAOKE (Sfondo) */}
           <div id="youtube-player" className={`absolute inset-0 w-full h-full pointer-events-none z-0 ${isKaraokeActive ? 'opacity-100' : 'opacity-20'}`}></div>

           {/* 2. OVERLAY KARAOKE */}
           {isKaraokeActive && (
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

           {/* 3. OVERLAY QUIZ (DOMANDE E MEDIA) */}
           {activeQuiz && !quizResults && quizStatus !== 'leaderboard' && (
              <div className="fixed inset-0 z-[50] bg-black/90 flex flex-col items-center justify-center p-8 animate-fade-in">
                 
                 {/* PLAYER VIDEO QUIZ */}
                 {isVideoQuiz && (
                    <div className="absolute inset-0 z-0">
                        <iframe 
                            src={activeQuiz.media_url.replace("watch?v=", "embed/") + "?autoplay=1&controls=0&modestbranding=1&rel=0&showinfo=0"}
                            className="w-full h-full pointer-events-none"
                            allow="autoplay; encrypted-media"
                            title="Quiz Video"
                        />
                        {/* Overlay scuro sopra il video per leggere il testo */}
                        <div className="absolute inset-0 bg-black/60"></div>
                    </div>
                 )}

                 {/* PLAYER AUDIO QUIZ (Invisibile ma attivo) */}
                 {isAudioQuiz && (
                    <audio src={activeQuiz.media_url} autoPlay />
                 )}

                 <div className="relative z-10 max-w-6xl w-full text-center">
                    <div className="mb-8">
                        <span className={`px-6 py-2 rounded-full text-xl font-bold uppercase tracking-widest shadow-lg flex items-center justify-center gap-2 w-fit mx-auto ${quizStatus === 'closed' ? 'bg-red-600' : 'bg-fuchsia-600 animate-pulse'}`}>
                            {isAudioQuiz && <Music2 className="w-6 h-6"/>}
                            {isVideoQuiz && <Film className="w-6 h-6"/>}
                            {quizStatus === 'closed' ? "TEMPO SCADUTO" : activeQuiz.category}
                        </span>
                    </div>
                    
                    <h2 className="text-6xl font-black text-white mb-12 leading-tight drop-shadow-2xl">{activeQuiz.question}</h2>
                    
                    <div className="grid grid-cols-2 gap-6">
                        {activeQuiz.options.map((opt, i) => (
                            <div key={i} className={`p-8 rounded-2xl text-3xl font-bold border-4 transition-all ${quizStatus === 'closed' ? 'border-zinc-800 text-zinc-500 bg-zinc-900/80 grayscale' : 'border-white/20 bg-white/10 text-white shadow-xl backdrop-blur-sm'}`}>
                                <span className="text-fuchsia-500 mr-4 inline-block">{String.fromCharCode(65+i)}.</span> {opt}
                            </div>
                        ))}
                    </div>
                 </div>
              </div>
           )}

           {/* 4. OVERLAY CLASSIFICA (LEADERBOARD) */}
           {quizStatus === 'leaderboard' && (
               <div className="fixed inset-0 z-[60] bg-[url('https://media.giphy.com/media/26tOZ42Mg6pbTUPHW/giphy.gif')] bg-cover bg-center flex flex-col items-center justify-center p-10 animate-zoom-in">
                   <div className="absolute inset-0 bg-black/80 backdrop-blur-sm"></div>
                   <div className="relative z-10 w-full max-w-4xl">
                       <h2 className="text-7xl font-black text-center text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-amber-600 mb-12 drop-shadow-lg flex items-center justify-center gap-4">
                           <Crown className="w-20 h-20 text-yellow-400 fill-yellow-400 animate-bounce" />
                           CLASSIFICA
                       </h2>
                       <div className="space-y-4">
                           {quizLeaderboard.slice(0, 5).map((p, i) => (
                               <div key={p.id} className="flex items-center justify-between bg-white/10 border border-white/20 p-6 rounded-2xl transform transition-all hover:scale-105">
                                   <div className="flex items-center gap-6">
                                       <div className={`w-16 h-16 rounded-full flex items-center justify-center text-3xl font-bold ${i===0 ? 'bg-yellow-500 text-black shadow-[0_0_20px_rgba(234,179,8,0.8)]' : i===1 ? 'bg-gray-300 text-black' : i===2 ? 'bg-amber-700 text-white' : 'bg-zinc-700 text-zinc-400'}`}>
                                           {i+1}
                                       </div>
                                       <span className="text-4xl font-bold text-white">{p.nickname}</span>
                                   </div>
                                   <span className="text-5xl font-mono font-black text-cyan-400">{p.score}</span>
                               </div>
                           ))}
                       </div>
                   </div>
               </div>
           )}
           
           {/* 5. OVERLAY RISULTATO VOTO KARAOKE */}
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

        {/* --- SIDEBAR --- */}
        <div className="w-[350px] bg-zinc-900/95 border-l border-zinc-800 flex flex-col z-30 shadow-2xl relative">
           <div className="p-6 flex flex-col items-center bg-white/5 border-b border-white/10">
              <div className="bg-white p-3 rounded-xl mb-3 shadow-lg"><QRCodeSVG value={joinUrl} size={180} /></div>
              <p className="font-mono text-3xl font-bold text-cyan-400 tracking-widest drop-shadow">{pubCode}</p>
           </div>
           
           <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
               {displayData?.pub?.logo_url ? (
                   <img src={displayData.pub.logo_url} alt="Logo" className="w-40 h-40 object-contain drop-shadow-2xl mb-4"/>
               ) : (
                   <div className="w-32 h-32 bg-zinc-800 rounded-full flex items-center justify-center text-zinc-600 font-bold border-4 border-zinc-700 mb-4">LOGO</div>
               )}
               <h2 className="text-2xl font-black text-white uppercase">{displayData?.pub?.name || "NEONPUB"}</h2>
           </div>

           {/* SIDEBAR MINI LEADERBOARD (Sempre visibile se non c'è quiz leaderboard full screen) */}
           {quizStatus !== 'leaderboard' && (
               <div className="h-[35%] border-t border-white/10 p-4 bg-gradient-to-b from-zinc-900 to-black">
                  <h3 className="text-lg font-bold text-yellow-500 mb-4 flex items-center gap-2 uppercase"><Trophy className="w-5 h-5"/> Top Player</h3>
                  <div className="space-y-2 overflow-y-auto custom-scrollbar h-full pb-4">
                     {(displayData?.leaderboard || []).map((p, i) => (
                        <div key={p.id} className={`flex justify-between items-center p-2 rounded ${i===0 ? 'bg-yellow-500/20 border border-yellow-500/30' : ''}`}>
                           <span className={`font-bold w-6 h-6 flex items-center justify-center rounded-full text-xs ${i===0 ? 'bg-yellow-500 text-black' : 'bg-zinc-800 text-zinc-400'}`}>{i+1}</span>
                           <span className="font-medium text-white truncate w-32">{p.nickname}</span>
                           <span className="text-cyan-400 font-mono font-bold">{p.score}</span>
                        </div>
                     ))}
                  </div>
               </div>
           )}
        </div>
      </div>

      {/* MESSAGGI FLASH E REAZIONI */}
      <div className="reactions-overlay pointer-events-none fixed inset-0 z-40 overflow-hidden">
        {floatingReactions.map(r => (
            <div key={r.id} className="absolute flex flex-col items-center animate-float-up" style={{ left: `${r.left}%`, bottom: '-50px' }}>
              <span className="text-7xl filter drop-shadow-2xl">{r.emoji}</span>
              <span className="text-xl text-white font-bold mt-1 bg-black/70 px-4 py-1 rounded-full">{r.nickname}</span>
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

      {/* RISULTATO QUIZ (Overlay Finale) */}
      {quizResults && quizStatus !== 'leaderboard' && (
        <div className="fixed inset-0 z-[100] bg-gradient-to-br from-green-900 to-black flex flex-col items-center justify-center p-20 animate-zoom-in">
           <Trophy className="w-48 h-48 text-yellow-400 mb-10 animate-bounce" />
           <h2 className="text-8xl font-black text-white mb-6">RISPOSTA ESATTA!</h2>
           <div className="bg-white text-black px-16 py-8 rounded-[3rem] mb-12 shadow-2xl transform hover:scale-105 transition">
              <p className="text-7xl font-bold">{quizResults.correct_option}</p>
           </div>
           <div className="text-center bg-black/40 p-8 rounded-3xl backdrop-blur-md">
               <p className="text-2xl text-green-300 uppercase tracking-widest mb-4">Vincitori del Round</p>
               <p className="text-4xl text-white font-medium max-w-5xl leading-relaxed">
                 {quizResults.winners.length > 0 ? quizResults.winners.slice(0, 8).join(' • ') + (quizResults.winners.length > 8 ? '...' : '') : "Nessuno ha indovinato!"}
               </p>
           </div>
        </div>
      )}

      <style jsx>{`
        .ticker-container { width: 100%; overflow: hidden; }
        .ticker-content { display: inline-block; white-space: nowrap; animation: ticker 30s linear infinite; }
        @keyframes ticker { 0% { transform: translateX(100%); } 100% { transform: translateX(-100%); } }
        .animate-float-up { animation: floatUp 4s ease-out forwards; }
        @keyframes floatUp { 0% { transform: translateY(0) scale(0.5); opacity: 0; } 100% { transform: translateY(-80vh) scale(1.5); opacity: 0; } }
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