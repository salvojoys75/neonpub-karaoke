import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { Mic2, Music, Trophy, Star, HelpCircle } from "lucide-react";
import api from "@/lib/api";

export default function PubDisplay() {
  const { pubCode } = useParams();
  const [displayData, setDisplayData] = useState(null);
  const [floatingReactions, setFloatingReactions] = useState([]);
  const [overlayMessages, setOverlayMessages] = useState([]);
  const [ticker, setTicker] = useState("");
  const [playerReady, setPlayerReady] = useState(false);
  const [currentVideoId, setCurrentVideoId] = useState(null);
  const [activeQuiz, setActiveQuiz] = useState(null);
  const [quizResult, setQuizResult] = useState(null);
  
  const playerRef = useRef(null);
  const pollIntervalRef = useRef(null);
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

    // Crea/ricrea solo se videoId cambia
    if (videoId && videoId !== currentVideoId) {
      console.log("Creating new YouTube player for:", videoId);
      setCurrentVideoId(videoId);

      // Distruggi vecchio player se esiste
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch (e) {
          console.log("Destroy error:", e);
        }
        playerRef.current = null;
      }

      try {
        playerRef.current = new window.YT.Player('youtube-player-container', {
          height: '100%',
          width: '100%',
          videoId: videoId,
          playerVars: {
            autoplay: 1,
            controls: 0,
            modestbranding: 1,
            rel: 0,
            showinfo: 0,
            iv_load_policy: 3,
            fs: 0,
          },
          events: {
            onReady: (event) => {
              console.log("Player ready - forcing play if live");
              if (displayData?.current_performance?.status === 'live') {
                event.target.playVideo();
              }
            },
            onStateChange: (event) => {
              console.log("Player state changed:", event.data);
            },
            onError: (event) => {
              console.error("YouTube Player Error:", event.data);
            },
          },
        });
      } catch (error) {
        console.error("Error creating YT player:", error);
      }
    }

    // Controlla stato attuale (pause/play) ogni volta che displayData cambia
    if (playerRef.current && currentVideoId && playerRef.current.getPlayerState) {
      const status = displayData?.current_performance?.status;

      try {
        if (status === 'paused') {
          playerRef.current.pauseVideo();
        } else if (status === 'live') {
          playerRef.current.playVideo();
          // Se vuoi audio → unmute qui (ma solo dopo interazione o se policy lo permette)
          // playerRef.current.unMute();  // ← prova solo se hai già interazione utente sul display
        }
      } catch (e) {
        console.log("Control error:", e);
      }
    }

    // Pulizia se non c'è più video
    if (!videoId && currentVideoId) {
      setCurrentVideoId(null);
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch (e) {}
        playerRef.current = null;
      }
    }
  }, [playerReady, displayData?.current_performance?.youtube_url, displayData?.current_performance?.status, currentVideoId]);

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

  // Polling
  useEffect(() => {
    loadDisplayData();
    pollIntervalRef.current = setInterval(loadDisplayData, 3000);
    
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [loadDisplayData]);

  // Add floating reaction
  const addFloatingReaction = (emoji) => {
    const id = Date.now() + Math.random();
    const left = Math.random() * 80 + 10;
    setFloatingReactions(prev => [...prev, { id, emoji, left }]);
    
    setTimeout(() => {
      setFloatingReactions(prev => prev.filter(r => r.id !== id));
    }, 3000);
  };

  // Show overlay message
  const showOverlayMessage = (message) => {
    const id = Date.now();
    setOverlayMessages(prev => [...prev, { id, text: message }]);
    
    setTimeout(() => {
      setOverlayMessages(prev => prev.filter(m => m.id !== id));
    }, 5000);
  };

  const currentPerf = displayData?.current_performance;
  const queue = displayData?.queue || [];
  const leaderboard = displayData?.leaderboard || [];
  const pubName = displayData?.pub?.name || "NeonPub Karaoke";

  const joinUrl = `${window.location.origin}/join/${pubCode}`;

  return (
    <div className="min-h-screen bg-[#050505] text-white overflow-hidden relative">
      {/* Floating Reactions */}
      <div className="reactions-overlay">
        {floatingReactions.map(r => (
          <div 
            key={r.id} 
            className="floating-reaction animate-float-up"
            style={{ left: `${r.left}%` }}
          >
            {r.emoji}
          </div>
        ))}
      </div>

      {/* Overlay Messages */}
      {overlayMessages.map(msg => (
        <div 
          key={msg.id}
          className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 animate-fade-in-scale"
        >
          <div className="glass rounded-3xl p-8 text-center border-2 border-cyan-500">
            <p className="text-4xl font-bold">{msg.text}</p>
          </div>
        </div>
      ))}

      {/* Main Content */}
      <div className="grid grid-cols-12 gap-6 p-6 h-screen">
        {/* Left Column - Performance/Queue */}
        <div className="col-span-8 flex flex-col gap-6">
          {/* Header */}
          <div className="glass rounded-2xl p-6">
            <h1 className="text-4xl font-bold mb-2">{pubName}</h1>
            <p className="text-zinc-400 text-xl">Codice: <span className="mono text-cyan-400">{pubCode}</span></p>
          </div>

          {/* Video Player / Current Performance */}
          <div className="flex-1 glass rounded-2xl p-6 flex flex-col">
            {currentPerf ? (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className={`w-4 h-4 rounded-full ${
                      currentPerf.status === 'live' ? 'bg-red-500 animate-pulse' :
                      currentPerf.status === 'paused' ? 'bg-yellow-500' :
                      'bg-green-500'
                    }`}></span>
                    <span className="text-lg font-medium uppercase">
                      {currentPerf.status === 'live' && '🔴 LIVE'}
                      {currentPerf.status === 'paused' && '⏸️ PAUSA'}
                      {currentPerf.status === 'voting' && '⭐ VOTAZIONE'}
                    </span>
                  </div>
                  
                  {currentPerf.vote_count > 0 && (
                    <div className="flex items-center gap-3 bg-yellow-500/20 px-6 py-3 rounded-full">
                      <Star className="w-8 h-8 text-yellow-500 fill-yellow-500" />
                      <span className="text-4xl font-bold">{(currentPerf.average_score || 0).toFixed(1)}</span>
                      <span className="text-zinc-400">({currentPerf.vote_count})</span>
                    </div>
                  )}
                </div>

                {/* YouTube Player */}
                <div className="flex-1 bg-black rounded-xl overflow-hidden mb-4 relative">
                  <div id="youtube-player-container" className="w-full h-full"></div>
                  {!currentVideoId && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Mic2 className="w-32 h-32 text-fuchsia-500/20" />
                    </div>
                  )}
                </div>

                {/* Song Info */}
                <div className="space-y-2">
                  <h2 className="text-3xl font-bold">{currentPerf.song_title}</h2>
                  <p className="text-2xl text-zinc-400">{currentPerf.song_artist}</p>
                  <p className="text-xl text-fuchsia-400">🎤 {currentPerf.user_nickname}</p>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center">
                <Mic2 className="w-32 h-32 text-fuchsia-500/20 mb-6" />
                <h2 className="text-4xl font-bold mb-4">Nessuna Esibizione</h2>
                <p className="text-2xl text-zinc-500">In attesa della prossima canzone...</p>
              </div>
            )}
          </div>

          {/* Ticker */}
          <div className="glass rounded-2xl p-4 overflow-hidden">
            <div className="ticker-container">
              <div className="ticker-content">
                {ticker} &nbsp;&nbsp;&nbsp; {ticker}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - QR + Queue + Leaderboard */}
        <div className="col-span-4 flex flex-col gap-6">
          {/* QR Code */}
          <div className="glass rounded-2xl p-6 text-center">
            <h3 className="text-2xl font-bold mb-4">Partecipa!</h3>
            <div className="bg-white p-6 rounded-xl inline-block">
              <QRCodeSVG 
                value={joinUrl}
                size={200}
                level="H"
                includeMargin={false}
              />
            </div>
            <p className="text-zinc-400 mt-4 text-lg">Scansiona per entrare</p>
          </div>

          {/* Queue */}
          <div className="glass rounded-2xl p-6 flex-1 flex flex-col">
            <h3 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <Music className="w-6 h-6 text-fuchsia-400" />
              Prossimi a Cantare
            </h3>
            {queue.length === 0 ? (
              <p className="text-zinc-500 text-center py-12">Nessuno in coda</p>
            ) : (
              <div className="space-y-3 overflow-y-auto flex-1">
                {queue.slice(0, 5).map((song, idx) => (
                  <div key={song.id} className="bg-white/5 rounded-xl p-4 flex items-center gap-3">
                    <span className="text-2xl font-bold text-fuchsia-400 w-8">{idx + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold truncate text-lg">{song.title}</p>
                      <p className="text-sm text-zinc-500 truncate">{song.artist}</p>
                      <p className="text-xs text-cyan-400 mt-1">{song.user_nickname}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Leaderboard */}
          <div className="glass rounded-2xl p-6">
            <h3 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <Trophy className="w-6 h-6 text-yellow-500" />
              Top 5
            </h3>
            {leaderboard.length === 0 ? (
              <p className="text-zinc-500 text-center py-8">Nessun punteggio</p>
            ) : (
              <div className="space-y-2">
                {leaderboard.map((player, idx) => (
                  <div key={player.id} className="flex items-center gap-3 bg-white/5 rounded-lg p-3">
                    <span className={`text-xl font-bold w-6 ${
                      idx === 0 ? 'text-yellow-500' :
                      idx === 1 ? 'text-zinc-400' :
                      idx === 2 ? 'text-amber-700' :
                      'text-zinc-600'
                    }`}>
                      {idx + 1}
                    </span>
                    <p className="flex-1 font-medium truncate">{player.nickname}</p>
                    <span className="text-lg font-bold text-cyan-400">{player.score}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quiz Overlay */}
      {activeQuiz && !quizResult && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-lg z-50 flex items-center justify-center p-12">
          <div className="glass rounded-3xl p-12 max-w-4xl w-full border-4 border-fuchsia-500">
            <div className="text-center mb-8">
              <HelpCircle className="w-20 h-20 text-fuchsia-400 mx-auto mb-4" />
              <h2 className="text-5xl font-bold mb-4 gradient-text">Quiz Time!</h2>
              <p className="text-2xl text-zinc-400">{activeQuiz.category_name || 'Quiz Musicale'}</p>
            </div>
            
            <div className="bg-white/5 rounded-2xl p-8 mb-8">
              <p className="text-3xl font-medium text-center">{activeQuiz.question}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {activeQuiz.options.map((option, idx) => (
                <div 
                  key={idx}
                  className="quiz-option bg-white/10 rounded-2xl p-6 border-2 border-white/20"
                >
                  <span className="text-2xl font-bold text-fuchsia-400 mr-3">
                    {String.fromCharCode(65 + idx)}.
                  </span>
                  <span className="text-2xl">{option}</span>
                </div>
              ))}
            </div>

            <p className="text-center text-2xl text-cyan-400 mt-8">
              {activeQuiz.points} punti in palio! Rispondi dall'app!
            </p>
          </div>
        </div>
      )}

      {/* Quiz Result Overlay */}
      {quizResult && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-lg z-50 flex items-center justify-center p-12">
          <div className="glass rounded-3xl p-12 max-w-4xl w-full border-4 border-green-500">
            <div className="text-center">
              <Trophy className="w-24 h-24 text-yellow-500 mx-auto mb-6" />
              <h2 className="text-6xl font-bold mb-8">Risultato Quiz</h2>
              
              <div className="bg-green-500/20 rounded-2xl p-8 mb-8 border-2 border-green-500">
                <p className="text-3xl mb-2">Risposta Corretta:</p>
                <p className="text-5xl font-bold text-green-400">{quizResult.correct_option}</p>
              </div>

              {quizResult.winners && quizResult.winners.length > 0 && (
                <div>
                  <p className="text-3xl mb-6">🎉 Vincitori:</p>
                  <div className="flex flex-wrap justify-center gap-4">
                    {quizResult.winners.map((winner, i) => (
                      <span 
                        key={i}
                        className="px-8 py-4 bg-yellow-500/20 text-yellow-400 rounded-full text-2xl font-bold border-2 border-yellow-500"
                      >
                        {winner}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-2xl text-zinc-400 mt-8">
                {quizResult.total_answers} risposte totali
              </p>
            </div>
          </div>
        </div>
      )}

      {/* CSS Animations */}
      <style jsx>{`
        .ticker-container {
          width: 100%;
          overflow: hidden;
        }

        .ticker-content {
          display: inline-block;
          white-space: nowrap;
          animation: ticker 30s linear infinite;
          font-size: 1.25rem;
          font-weight: 500;
        }

        @keyframes ticker {
          0% { transform: translateX(0%); }
          100% { transform: translateX(-50%); }
        }

        .reactions-overlay {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 40;
        }

        .floating-reaction {
          position: absolute;
          bottom: -50px;
          font-size: 3rem;
          animation: float-up 3s ease-out forwards;
        }

        @keyframes float-up {
          0% {
            bottom: -50px;
            opacity: 1;
            transform: translateY(0) scale(1);
          }
          100% {
            bottom: 100vh;
            opacity: 0;
            transform: translateY(-20px) scale(1.5);
          }
        }

        .animate-fade-in-scale {
          animation: fade-in-scale 0.5s ease-out;
        }

        @keyframes fade-in-scale {
          from {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.8);
          }
          to {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
        }

        .gradient-text {
          background: linear-gradient(135deg, #d946ef, #06b6d4);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .quiz-option {
          transition: all 0.3s ease;
        }

        .quiz-option:hover {
          transform: scale(1.02);
          border-color: rgba(217, 70, 239, 0.5);
        }
      `}</style>
    </div>
  );
}