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
  const [activeQuiz, setActiveQuiz] = useState(null);
  const [quizResults, setQuizResults] = useState(null);
  
  // Player Refs
  const playerRef = useRef(null);
  const playerContainerRef = useRef(null);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const currentVideoIdRef = useRef(null); // Tiene traccia del video attuale per non ricaricarlo

  const pollIntervalRef = useRef(null);
  const messageIntervalRef = useRef(null);

  // Extract video ID helper
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

  // 1. Inizializza API YouTube una volta sola
  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
      
      window.onYouTubeIframeAPIReady = () => {
        setIsPlayerReady(true);
      };
    } else {
      setIsPlayerReady(true);
    }
  }, []);

  // 2. Gestione Logica Player (Creazione e Comandi)
  useEffect(() => {
    if (!isPlayerReady || !displayData?.current_performance) return;

    const perf = displayData.current_performance;
    const videoId = extractVideoId(perf.youtube_url);
    const status = perf.status; // live, paused, restarted, voting

    // SE C'È UN NUOVO VIDEO -> CREA O CARICA
    if (videoId && videoId !== currentVideoIdRef.current) {
      console.log("Loading new video:", videoId);
      currentVideoIdRef.current = videoId;

      if (playerRef.current) {
        playerRef.current.loadVideoById(videoId);
      } else {
        playerRef.current = new window.YT.Player('youtube-player', {
          height: '100%',
          width: '100%',
          videoId: videoId,
          playerVars: {
            autoplay: 1,
            controls: 0,
            modestbranding: 1,
            rel: 0,
            fs: 0
          },
          events: {
            onReady: (event) => {
              event.target.playVideo();
            }
          }
        });
      }
    }

    // GESTIONE COMANDI (Senza ricaricare)
    if (playerRef.current && typeof playerRef.current.getPlayerState === 'function') {
      if (status === 'paused') {
        playerRef.current.pauseVideo();
      } else if (status === 'live') {
        // Se era in pausa, riprendi. Se è nuovo, sta già andando.
        if (playerRef.current.getPlayerState() !== 1) { 
           playerRef.current.playVideo();
        }
      } else if (status === 'restarted') {
        playerRef.current.seekTo(0);
        playerRef.current.playVideo();
      }
    }

  }, [isPlayerReady, displayData?.current_performance]);

  // Caricamento Dati Iniziali
  const loadDisplayData = useCallback(async () => {
    try {
      const { data } = await api.getDisplayData(pubCode);
      // Aggiorniamo displayData ma facciamo attenzione a non triggerare re-render inutili del player
      setDisplayData(data);
      
      // Ticker logic
      const queueCount = data.queue?.length || 0;
      if (queueCount > 0) {
        const queueText = data.queue.slice(0, 5).map((s, i) => `${i + 1}. ${s.title} (${s.user_nickname})`).join(' • ');
        setTicker(queueText);
      } else {
        setTicker("Richiedi la tua canzone scansionando il QR code!");
      }
    } catch (error) {
      console.error(error);
    }
  }, [pubCode]);

  // Caricamento Messaggi
  const loadApprovedMessages = useCallback(async () => {
    if (!displayData?.pub?.id) return;
    try {
      const { data } = await supabase
        .from('messages')
        .select('*, participants(nickname)')
        .eq('event_id', displayData.pub.id)
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(5);
        
      if (data) setApprovedMessages(data.map(m => ({
        id: m.id, text: m.text, nickname: m.participants?.nickname
      })));
    } catch (e) { console.error(e); }
  }, [displayData?.pub?.id]);

  useEffect(() => {
    loadDisplayData();
    pollIntervalRef.current = setInterval(loadDisplayData, 3000);
    messageIntervalRef.current = setInterval(loadApprovedMessages, 5000);
    return () => {
      clearInterval(pollIntervalRef.current);
      clearInterval(messageIntervalRef.current);
    };
  }, [loadDisplayData, loadApprovedMessages]);

  // Realtime
  useEffect(() => {
    if (!displayData?.pub?.id) return;
    
    const channel = supabase
      .channel(`display_realtime`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'performances', filter: `event_id=eq.${displayData.pub.id}` }, 
        (payload) => {
           // Aggiorna SOLO la performance corrente nei dati locali per triggerare l'effetto del player
           setDisplayData(prev => ({...prev, current_performance: payload.new}));
        }
      )
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reactions', filter: `event_id=eq.${displayData.pub.id}` }, 
        (payload) => addFloatingReaction(payload.new.emoji, payload.new.nickname)
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quizzes', filter: `event_id=eq.${displayData.pub.id}` }, 
        async (payload) => {
           if (payload.new.status === 'active') { setActiveQuiz(payload.new); setQuizResults(null); }
           else if (payload.new.status === 'showing_results') {
             const res = await api.getQuizResults(payload.new.id);
             setQuizResults(res.data);
           } else if (payload.new.status === 'ended') {
             setTimeout(() => { setActiveQuiz(null); setQuizResults(null); }, 5000);
           }
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [displayData?.pub?.id]);

  const addFloatingReaction = (emoji, nickname) => {
    const id = Date.now() + Math.random();
    const left = Math.random() * 80 + 10;
    setFloatingReactions(prev => [...prev, { id, emoji, nickname, left }]);
    setTimeout(() => setFloatingReactions(prev => prev.filter(r => r.id !== id)), 3000);
  };

  const currentPerf = displayData?.current_performance;
  const queue = displayData?.queue || [];
  const leaderboard = displayData?.leaderboard || [];
  const joinUrl = `${window.location.origin}/join/${pubCode}`;

  return (
    <div className="min-h-screen bg-[#050505] text-white overflow-hidden relative font-sans">
      {/* Floating Reactions */}
      <div className="reactions-overlay pointer-events-none fixed inset-0 z-50">
        {floatingReactions.map(r => (
          <div key={r.id} className="absolute flex flex-col items-center animate-float-up" style={{ left: `${r.left}%`, bottom: '-50px' }}>
            <span className="text-6xl filter drop-shadow-lg">{r.emoji}</span>
            {r.nickname && (
              <span className="text-lg font-bold bg-black/60 px-3 py-1 rounded-full text-white mt-1 backdrop-blur-md border border-white/10">
                {r.nickname}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Messages Overlay */}
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

      {/* Grid Layout */}
      <div className="grid grid-cols-12 gap-6 p-6 h-screen">
        {/* Left: Player */}
        <div className="col-span-8 flex flex-col gap-6">
          <div className="glass rounded-2xl p-6 flex justify-between">
            <h1 className="text-4xl font-bold">{displayData?.pub?.name || "NeonPub"}</h1>
            {currentPerf?.status === 'voting' && <div className="bg-yellow-500 text-black px-4 py-1 rounded-full font-bold animate-pulse">VOTAZIONE APERTA</div>}
          </div>

          <div className="flex-1 glass rounded-2xl p-6 flex flex-col relative overflow-hidden bg-black">
            {currentPerf ? (
              <>
                {/* DIV PER YOUTUBE - NON RIMUOVERE ID */}
                <div id="youtube-player" className="w-full h-full absolute inset-0 rounded-2xl"></div>
                
                {/* Overlay Info */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/80 to-transparent p-8 pointer-events-none">
                  <h2 className="text-5xl font-bold mb-2">{currentPerf.song_title}</h2>
                  <div className="flex justify-between items-end">
                    <p className="text-3xl text-zinc-300">{currentPerf.song_artist}</p>
                    <div className="flex items-center gap-3 bg-fuchsia-600/90 px-6 py-2 rounded-full">
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

          <div className="glass rounded-2xl p-3 overflow-hidden bg-fuchsia-900/20">
            <div className="ticker-container"><div className="ticker-content text-fuchsia-200">{ticker}</div></div>
          </div>
        </div>

        {/* Right: Queue & Leaderboard */}
        <div className="col-span-4 flex flex-col gap-6">
          <div className="glass rounded-2xl p-6 text-center">
            <h3 className="text-2xl font-bold mb-4">Inquadra per Entrare</h3>
            <div className="bg-white p-4 rounded-xl inline-block"><QRCodeSVG value={joinUrl} size={150} /></div>
            <p className="text-xl mt-2 font-mono text-cyan-400">{pubCode}</p>
          </div>

          <div className="glass rounded-2xl p-6 flex-1 flex flex-col overflow-hidden">
            <h3 className="text-2xl font-bold mb-4 flex items-center gap-2 border-b border-white/10 pb-3">
              <Music className="text-fuchsia-400" /> Coda ({queue.length})
            </h3>
            <div className="space-y-3 overflow-y-auto flex-1 custom-scrollbar">
              {queue.map((song, idx) => (
                <div key={song.id} className="bg-white/5 rounded-xl p-3 flex items-center gap-3 border-l-4 border-fuchsia-500">
                  <span className="text-2xl font-bold text-fuchsia-400 w-8">{idx + 1}</span>
                  <div className="min-w-0">
                    <p className="font-bold truncate">{song.title}</p>
                    <p className="text-xs text-cyan-400 uppercase">{song.user_nickname}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass rounded-2xl p-6 h-1/4 flex flex-col">
            <h3 className="text-xl font-bold mb-2 text-yellow-500 flex gap-2"><Trophy className="w-5 h-5"/> Classifica</h3>
            <div className="space-y-2 overflow-y-auto custom-scrollbar">
              {leaderboard.map((p, idx) => (
                <div key={p.id} className="flex justify-between items-center p-2 rounded bg-white/5">
                  <span className="font-bold w-6">#{idx+1}</span>
                  <span className="truncate flex-1">{p.nickname}</span>
                  <span className="font-mono text-cyan-400">{p.score}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* QUIZ OVERLAYS */}
      {activeQuiz && !quizResults && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-12">
          <div className="glass rounded-3xl p-12 w-full max-w-4xl border-4 border-fuchsia-500 text-center animate-zoom-in">
            <h2 className="text-6xl font-bold mb-4 gradient-text">QUIZ TIME!</h2>
            <p className="text-4xl text-white mb-8">{activeQuiz.question}</p>
            <div className="grid grid-cols-2 gap-6">
              {activeQuiz.options.map((opt, i) => (
                <div key={i} className="bg-white/10 p-6 rounded-2xl text-3xl font-bold border-2 border-white/20">
                  <span className="text-fuchsia-400 mr-4">{String.fromCharCode(65+i)}.</span> {opt}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {quizResults && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-12">
          <div className="glass rounded-3xl p-12 w-full max-w-4xl border-4 border-green-500 text-center animate-zoom-in">
            <Trophy className="w-24 h-24 text-yellow-500 mx-auto mb-6" />
            <h2 className="text-6xl font-bold mb-8">RISULTATI</h2>
            <div className="bg-green-600/30 p-8 rounded-2xl mb-8 border-2 border-green-500">
              <p className="text-2xl text-green-200 uppercase mb-2">Risposta Corretta</p>
              <p className="text-5xl font-bold text-white">{quizResults.correct_option}</p>
            </div>
            <p className="text-2xl text-zinc-400">Vincitori: {quizResults.winners.join(', ') || "Nessuno"}</p>
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