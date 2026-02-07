import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { Mic2, Music, Trophy, Star, HelpCircle } from "lucide-react";
import api from "@/lib/api";
import { supabase } from "@/lib/supabase";

export default function PubDisplay() {
  const { pubCode } = useParams();
  const [displayData, setDisplayData] = useState(null);
  const [floatingReactions, setFloatingReactions] = useState([]);
  const [approvedMessages, setApprovedMessages] = useState([]);
  const [ticker, setTicker] = useState("");
  const [playerReady, setPlayerReady] = useState(false);
  const [currentVideoId, setCurrentVideoId] = useState(null);
  const [activeQuiz, setActiveQuiz] = useState(null);
  const [quizResults, setQuizResults] = useState(null);
  
  const playerRef = useRef(null);
  const pollIntervalRef = useRef(null);
  const messageIntervalRef = useRef(null);
  const lastQuizIdRef = useRef(null);

  // Extract video ID from YouTube URL
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

  // Load YouTube IFrame API
  useEffect(() => {
    if (window.YT && window.YT.Player) {
      setPlayerReady(true);
      return;
    }

    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

    window.onYouTubeIframeAPIReady = () => {
      console.log("YouTube IFrame API Ready");
      setPlayerReady(true);
    };

    return () => {
      window.onYouTubeIframeAPIReady = null;
    };
  }, []);

  // Create/Update YouTube Player
  useEffect(() => {
    if (!playerReady) return;
    
    const videoId = displayData?.current_performance?.youtube_url 
      ? extractVideoId(displayData.current_performance.youtube_url)
      : null;

    if (videoId && videoId !== currentVideoId) {
      console.log("Creating YouTube player for video:", videoId);
      setCurrentVideoId(videoId);

      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch (e) {
          console.log("Error destroying player:", e);
        }
      }

      try {
        playerRef.current = new window.YT.Player('youtube-player-container', {
          height: '100%',
          width: '100%',
          videoId: videoId,
          playerVars: {
            autoplay: 1,
            controls: 0, // Nascondi controlli per stile pro
            modestbranding: 1,
            rel: 0,
            fs: 0,
            iv_load_policy: 3
          },
          events: {
            onReady: (event) => {
              if (displayData?.current_performance?.status === 'live') {
                event.target.playVideo();
              }
            }
          }
        });
      } catch (error) {
        console.error("Error creating player:", error);
      }
    }

    // Pulisci se non c'è video
    if (!videoId && currentVideoId) {
      setCurrentVideoId(null);
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
          playerRef.current = null;
        } catch (e) {}
      }
    }
  }, [playerReady, displayData?.current_performance, currentVideoId]);

  // Load display data
  const loadDisplayData = useCallback(async () => {
    try {
      const { data } = await api.getDisplayData(pubCode);
      setDisplayData(data);
      
      // Update ticker
      const queueCount = data.queue?.length || 0;
      if (queueCount > 0) {
        const queueText = data.queue
          .slice(0, 5)
          .map((s, i) => `${i + 1}. ${s.title} - ${s.artist} (${s.user_nickname})`)
          .join('  •  ');
        setTicker(queueText);
      } else {
        setTicker("🎤 Richiedi la tua canzone scansionando il QR code!");
      }
    } catch (error) {
      console.error("Error loading display data:", error);
    }
  }, [pubCode]);

  // Load approved messages
  const loadApprovedMessages = useCallback(async () => {
    try {
      const { data: event } = await supabase.from('events').select('id').eq('code', pubCode.toUpperCase()).single();
      if (!event) return;

      const { data: messages } = await supabase
        .from('messages')
        .select('*, participants(nickname)')
        .eq('event_id', event.id)
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(5);

      // Show specifically the new ones or cycle through them
      if (messages && messages.length > 0) {
         setApprovedMessages(messages.map(m => ({
             id: m.id, 
             text: m.text, 
             nickname: m.participants?.nickname 
         })));
      }
    } catch (error) {
      console.error("Error loading messages:", error);
    }
  }, [pubCode]);

  // Polling
  useEffect(() => {
    loadDisplayData();
    loadApprovedMessages();
    
    pollIntervalRef.current = setInterval(loadDisplayData, 3000);
    messageIntervalRef.current = setInterval(loadApprovedMessages, 10000);
    
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (messageIntervalRef.current) clearInterval(messageIntervalRef.current);
    };
  }, [loadDisplayData, loadApprovedMessages]);

  // Realtime subscriptions
  useEffect(() => {
    if (!pubCode) return;

    const setupRealtime = async () => {
      const { data: event } = await supabase.from('events').select('id').eq('code', pubCode.toUpperCase()).single();
      if (!event) return;

      const channel = supabase
        .channel(`display:${event.id}`)
        // PERFORMANCE STATUS (Play, Pause, Restart)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'performances', filter: `event_id=eq.${event.id}` }, 
          (payload) => {
             const status = payload.new.status;
             // Aggiorna stato locale per UI
             setDisplayData(prev => prev ? ({...prev, current_performance: payload.new}) : null);

             if (playerRef.current && typeof playerRef.current.playVideo === 'function') {
                if (status === 'paused') {
                    playerRef.current.pauseVideo();
                } else if (status === 'live') {
                    playerRef.current.playVideo();
                } else if (status === 'restarted') {
                    // --- FUNZIONE RIAVVOLGI ---
                    playerRef.current.seekTo(0);
                    playerRef.current.playVideo();
                }
             }
          }
        )
        // REACTIONS (Con Nickname)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reactions', filter: `event_id=eq.${event.id}` }, 
          (payload) => {
            // payload.new.nickname è stato aggiunto nel DB nel passo SQL
            addFloatingReaction(payload.new.emoji, payload.new.nickname);
          }
        )
        // QUIZ
        .on('postgres_changes', { event: '*', schema: 'public', table: 'quizzes', filter: `event_id=eq.${event.id}` }, 
          async (payload) => {
            const quiz = payload.new;
            if (payload.eventType === 'INSERT' && quiz.status === 'active') {
              setActiveQuiz(quiz);
              setQuizResults(null);
            } else if (quiz.status === 'showing_results') {
              const { data } = await api.getQuizResults(quiz.id);
              setQuizResults(data);
              setActiveQuiz(quiz);
            } else if (quiz.status === 'ended') {
              setTimeout(() => { setActiveQuiz(null); setQuizResults(null); }, 5000);
            }
          }
        )
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    };

    setupRealtime();
  }, [pubCode]);

  // Add floating reaction with Nickname
  const addFloatingReaction = (emoji, nickname) => {
    const id = Date.now() + Math.random();
    const left = Math.random() * 80 + 10;
    setFloatingReactions(prev => [...prev, { id, emoji, nickname, left }]);
    
    setTimeout(() => {
      setFloatingReactions(prev => prev.filter(r => r.id !== id));
    }, 3000);
  };

  const currentPerf = displayData?.current_performance;
  const queue = displayData?.queue || [];
  const leaderboard = displayData?.leaderboard || [];
  const pubName = displayData?.pub?.name || "NeonPub Karaoke";
  const joinUrl = `${window.location.origin}/join/${pubCode}`;

  return (
    <div className="min-h-screen bg-[#050505] text-white overflow-hidden relative font-sans">
      {/* Floating Reactions */}
      <div className="reactions-overlay pointer-events-none fixed inset-0 z-50">
        {floatingReactions.map(r => (
          <div key={r.id} className="absolute flex flex-col items-center animate-float-up" style={{ left: `${r.left}%`, bottom: '-50px' }}>
            <span className="text-6xl filter drop-shadow-lg">{r.emoji}</span>
            {r.nickname && (
              <span className="text-lg font-bold bg-black/60 px-3 py-1 rounded-full text-white mt-1 backdrop-blur-md border border-white/10 shadow-lg">
                {r.nickname}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Approved Messages Overlay */}
      {approvedMessages.length > 0 && (
        <div className="fixed top-24 right-8 z-40 space-y-3 max-w-md">
          {approvedMessages.map(msg => (
            <div key={msg.id} className="glass rounded-2xl p-4 border-l-4 border-cyan-500 animate-fade-in-scale shadow-2xl">
              <p className="text-sm text-cyan-400 mb-1 font-bold">💬 {msg.nickname}</p>
              <p className="text-xl font-medium">{msg.text}</p>
            </div>
          ))}
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-12 gap-6 p-6 h-screen">
        {/* Left Column */}
        <div className="col-span-8 flex flex-col gap-6">
          {/* Header */}
          <div className="glass rounded-2xl p-6 flex justify-between items-center">
            <div>
              <h1 className="text-4xl font-bold mb-1">{pubName}</h1>
              <p className="text-zinc-400 text-xl">Codice: <span className="mono text-cyan-400 font-bold">{pubCode}</span></p>
            </div>
            {currentPerf?.status === 'voting' && (
               <div className="bg-yellow-500 text-black px-6 py-2 rounded-full font-bold text-xl animate-pulse">
                 VOTAZIONE APERTA!
               </div>
            )}
          </div>

          {/* Video Player */}
          <div className="flex-1 glass rounded-2xl p-6 flex flex-col relative overflow-hidden bg-black">
            {currentPerf ? (
              <>
                <div id="youtube-player-container" className="w-full h-full absolute inset-0 rounded-2xl"></div>
                {/* Overlay Info sempre visibile in basso */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/80 to-transparent p-8 pointer-events-none">
                  <h2 className="text-5xl font-bold mb-2 text-white drop-shadow-md">{currentPerf.song_title}</h2>
                  <div className="flex justify-between items-end">
                    <p className="text-3xl text-zinc-300">{currentPerf.song_artist}</p>
                    <div className="flex items-center gap-3 bg-fuchsia-600/90 px-6 py-2 rounded-full shadow-lg backdrop-blur-md">
                      <Mic2 className="w-8 h-8" />
                      <span className="text-3xl font-bold">{currentPerf.user_nickname}</span>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center">
                <Mic2 className="w-32 h-32 text-fuchsia-500/20 mb-6" />
                <h2 className="text-4xl font-bold mb-4">Palco Vuoto</h2>
                <p className="text-2xl text-zinc-500">Prenotati ora!</p>
              </div>
            )}
          </div>

          {/* Ticker */}
          <div className="glass rounded-2xl p-3 overflow-hidden bg-fuchsia-900/20 border border-fuchsia-500/30">
            <div className="ticker-container">
              <div className="ticker-content text-fuchsia-200">
                {ticker} &nbsp;&nbsp;&nbsp; {ticker}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="col-span-4 flex flex-col gap-6">
          {/* QR Code */}
          <div className="glass rounded-2xl p-6 text-center">
            <h3 className="text-2xl font-bold mb-4">Inquadra per Entrare</h3>
            <div className="bg-white p-4 rounded-xl inline-block">
              <QRCodeSVG value={joinUrl} size={180} />
            </div>
          </div>

          {/* Queue */}
          <div className="glass rounded-2xl p-6 flex-1 flex flex-col overflow-hidden">
            <h3 className="text-2xl font-bold mb-4 flex items-center gap-2 border-b border-white/10 pb-3">
              <Music className="w-6 h-6 text-fuchsia-400" /> Prossimi
            </h3>
            <div className="space-y-3 overflow-y-auto flex-1 custom-scrollbar">
              {queue.map((song, idx) => (
                <div key={song.id} className="bg-white/5 rounded-xl p-4 flex items-center gap-3 border-l-4 border-fuchsia-500">
                  <span className="text-2xl font-bold text-fuchsia-400 w-8">{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold truncate text-lg">{song.title}</p>
                    <p className="text-sm text-zinc-400 truncate">{song.artist}</p>
                    <p className="text-xs text-cyan-400 mt-1 uppercase font-bold">{song.user_nickname}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Leaderboard */}
          <div className="glass rounded-2xl p-6 h-1/4 flex flex-col">
            <h3 className="text-xl font-bold mb-2 flex items-center gap-2 text-yellow-500">
              <Trophy className="w-5 h-5" /> Top Quiz
            </h3>
            <div className="space-y-2 overflow-y-auto custom-scrollbar">
              {leaderboard.map((player, idx) => (
                <div key={player.id} className="flex justify-between items-center p-2 rounded bg-white/5">
                  <span className="font-bold w-6">#{idx + 1}</span>
                  <span className="truncate flex-1">{player.nickname}</span>
                  <span className="font-mono text-cyan-400">{player.score}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* QUIZ OVERLAYS (Identici a prima) */}
      {activeQuiz && !quizResults && activeQuiz.status === 'active' && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-lg z-50 flex items-center justify-center p-12">
          <div className="glass rounded-3xl p-12 max-w-4xl w-full border-4 border-fuchsia-500 animate-zoom-in">
            <div className="text-center mb-8">
              <HelpCircle className="w-24 h-24 text-fuchsia-400 mx-auto mb-4 animate-bounce" />
              <h2 className="text-6xl font-bold mb-4 gradient-text">QUIZ TIME!</h2>
              <p className="text-3xl text-white">{activeQuiz.question}</p>
            </div>
            <div className="grid grid-cols-2 gap-6">
              {activeQuiz.options.map((opt, i) => (
                <div key={i} className="bg-white/10 p-6 rounded-2xl border-2 border-white/20">
                  <span className="text-3xl font-bold text-fuchsia-400 mr-4">{String.fromCharCode(65+i)}.</span>
                  <span className="text-3xl">{opt}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {quizResults && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-lg z-50 flex items-center justify-center p-12">
          <div className="glass rounded-3xl p-12 max-w-4xl w-full border-4 border-green-500 animate-zoom-in">
            <div className="text-center">
              <Trophy className="w-24 h-24 text-yellow-500 mx-auto mb-6" />
              <h2 className="text-6xl font-bold mb-8">RISULTATI</h2>
              <div className="bg-green-600/30 p-8 rounded-2xl mb-8 border-2 border-green-500">
                <p className="text-2xl text-green-200 uppercase mb-2">Risposta Corretta</p>
                <p className="text-5xl font-bold text-white">{quizResults.correct_option}</p>
              </div>
              <p className="text-2xl text-zinc-400">Vincitori: {quizResults.winners.join(', ') || "Nessuno"}</p>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .ticker-container { width: 100%; overflow: hidden; }
        .ticker-content { display: inline-block; white-space: nowrap; animation: ticker 25s linear infinite; font-size: 1.5rem; font-weight: 600; }
        @keyframes ticker { 0% { transform: translateX(0%); } 100% { transform: translateX(-50%); } }
        .reactions-overlay { pointer-events: none; z-index: 100; }
        .animate-float-up { animation: float-up 3s ease-out forwards; }
        @keyframes float-up { 0% { bottom: -50px; opacity: 1; transform: scale(0.5); } 50% { opacity: 1; transform: scale(1.2); } 100% { bottom: 80vh; opacity: 0; transform: scale(1.5); } }
        .animate-zoom-in { animation: zoomIn 0.5s ease-out; }
        @keyframes zoomIn { from { transform: scale(0.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }
      `}</style>
    </div>
  );
}