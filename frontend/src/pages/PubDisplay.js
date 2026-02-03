import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { Mic2, Music, Trophy, Star, HelpCircle } from "lucide-react";

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
  
  const wsRef = useRef(null);
  const playerRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  const lastQuizIdRef = useRef(null);


  const API_URL = process.env.REACT_APP_BACKEND_URL;

  // Extract video ID from YouTube URL
  const extractVideoId = (url) => {
    if (!url) return null;
    
    // Search URL - not a valid video
    if (url.includes("results?search_query")) return null;
    
    let videoId = null;
    
    // Standard watch URL: youtube.com/watch?v=VIDEO_ID
    const watchMatch = url.match(/[?&]v=([^&]+)/);
    if (watchMatch) videoId = watchMatch[1];
    
    // Short URL: youtu.be/VIDEO_ID
    const shortMatch = url.match(/youtu\.be\/([^?&]+)/);
    if (shortMatch) videoId = shortMatch[1];
    
    // Embed URL: youtube.com/embed/VIDEO_ID
    const embedMatch = url.match(/embed\/([^?&]+)/);
    if (embedMatch) videoId = embedMatch[1];
    
    return videoId;
  };

  // Load YouTube IFrame API
  useEffect(() => {
    // Check if API is already loaded
    if (window.YT && window.YT.Player) {
      setPlayerReady(true);
      return;
    }

    // Load the API
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

    // Setup callback for when API is ready
    window.onYouTubeIframeAPIReady = () => {
      console.log("YouTube IFrame API Ready");
      setPlayerReady(true);
    };

    return () => {
      window.onYouTubeIframeAPIReady = null;
    };
  }, []);

  // Create/Update YouTube Player when video changes
  useEffect(() => {
    if (!playerReady) return;
    
    const videoId = displayData?.current_performance?.youtube_url 
      ? extractVideoId(displayData.current_performance.youtube_url)
      : null;

    // If video ID changed, create new player
    if (videoId && videoId !== currentVideoId) {
      console.log("Creating YouTube player for video:", videoId);
      setCurrentVideoId(videoId);

      // Destroy old player if exists
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch (e) {
          console.log("Error destroying player:", e);
        }
      }

      // Create new player
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
            fs: 0
          },
          events: {
            onReady: (event) => {
              console.log("YouTube Player Ready");
              event.target.playVideo();
            },
            onStateChange: (event) => {
              console.log("Player state changed:", event.data);
            },
            onError: (event) => {
              console.error("YouTube Player Error:", event.data);
            }
          }
        });
      } catch (e) {
        console.error("Error creating YouTube player:", e);
      }
    } else if (!videoId && currentVideoId) {
      // No video, destroy player
      setCurrentVideoId(null);
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
          playerRef.current = null;
        } catch (e) {
          console.log("Error destroying player:", e);
        }
      }
    }
  }, [playerReady, displayData?.current_performance?.youtube_url, currentVideoId]);

  // YouTube Player Controls
  const controlYouTube = useCallback((command) => {
    if (!playerRef.current) {
      console.log("No player available for command:", command);
      return;
    }

    try {
      switch (command) {
        case 'play':
          console.log("Playing video");
          playerRef.current.playVideo();
          break;
        case 'pause':
          console.log("Pausing video");
          playerRef.current.pauseVideo();
          break;
        case 'stop':
          console.log("Stopping video");
          playerRef.current.stopVideo();
          break;
        case 'restart':
          console.log("Restarting video");
          playerRef.current.seekTo(0, true);
          playerRef.current.playVideo();
          break;
        default:
          console.log("Unknown command:", command);
      }
    } catch (e) {
      console.error("Error controlling YouTube player:", e);
    }
  }, []);

  // Load display data
  const loadData = useCallback(async () => {
    if (!pubCode) return;
    try {
      const response = await fetch(`${API_URL}/api/display/data?pub_code=${pubCode}`);
      if (response.ok) {
        const data = await response.json();
        setDisplayData(data);
        updateTicker(data);
      }
    } catch (error) {
      console.error("Error loading display data:", error);
    }
  }, [pubCode, API_URL]);

  const updateTicker = (data) => {
    const messages = [];
    
    if (data.current_performance) {
      if (data.current_performance.status === "live") {
        messages.push(`🎤 ORA SUL PALCO: ${data.current_performance.user_nickname} canta "${data.current_performance.song_title}"`);
      } else if (data.current_performance.status === "voting") {
        messages.push(`⭐ VOTA ORA! ${data.current_performance.user_nickname} - "${data.current_performance.song_title}"`);
      } else if (data.current_performance.status === "paused") {
        messages.push(`⏸️ IN PAUSA: ${data.current_performance.song_title}`);
      }
    }
    
    if (data.queue && data.queue.length > 0) {
      const next = data.queue[0];
      messages.push(`⏭️ PROSSIMO: ${next.user_nickname} - "${next.title}"`);
    }
    
    if (data.leaderboard && data.leaderboard.length > 0) {
      messages.push(`🏆 TOP: ${data.leaderboard[0].nickname} (${data.leaderboard[0].score || 0} pts)`);
    }
    
    messages.push(`📱 Scansiona il QR per partecipare! Codice: ${pubCode}`);
    
    setTicker(messages.join("     •     "));
  };

  // WebSocket connection
  useEffect(() => {
    if (!pubCode) return;

    const connectWS = () => {
      const wsUrl = API_URL?.replace("https://", "wss://").replace("http://", "ws://");
      const fullUrl = `${wsUrl}/api/ws/${pubCode}`;
      
      console.log("Display connecting to WebSocket:", fullUrl);
      
      const ws = new WebSocket(fullUrl);

      ws.onopen = () => {
        console.log("Display WebSocket connected!");
        const pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send("ping");
          }
        }, 25000);
        ws.pingInterval = pingInterval;
      };

      ws.onmessage = (event) => {
        if (event.data === "pong") return;
        try {
          const message = JSON.parse(event.data);
          console.log("Display received:", message.type);
          handleWSMessage(message);
        } catch (e) {
          console.error("WS message parse error:", e);
        }
      };

      ws.onclose = () => {
        console.log("Display WebSocket closed, reconnecting...");
        if (ws.pingInterval) clearInterval(ws.pingInterval);
        reconnectTimeoutRef.current = setTimeout(connectWS, 3000);
      };

      ws.onerror = (error) => {
        console.error("Display WebSocket error:", error);
      };

      wsRef.current = ws;
    };

    connectWS();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        if (wsRef.current.pingInterval) clearInterval(wsRef.current.pingInterval);
        wsRef.current.close();
      }
    };
  }, [pubCode, API_URL]);

  const handleWSMessage = useCallback((message) => {
    console.log("Handling message:", message.type);
    
    switch (message.type) {
      case "reaction":
        addFloatingReaction(message.data.emoji, message.data.user_nickname);
        break;
        
      case "effect":
        if (message.data.effect_type === "emoji_burst") {
          for (let i = 0; i < 20; i++) {
            setTimeout(() => addFloatingReaction(message.data.data.emoji), i * 80);
          }
        }
        break;
        
      case "message_approved":
        showOverlayMessage(message.data);
        break;
        
      case "performance_paused":
        controlYouTube('pause');
        loadData();
        break;
        
      case "performance_resumed":
        controlYouTube('play');
        loadData();
        break;
        
      case "performance_restarted":
        controlYouTube('restart');
        loadData();
        break;
        
      case "performance_started":
        loadData();
        // Player will be created when displayData updates
        break;
        
      case "voting_started":
      case "voting_opened":
        controlYouTube('pause'); // Pause video when voting starts
        loadData();
        break;
        
      case "voting_closed":
      case "vote_received":
      case "queue_updated":
      case "new_request":
      case "no_more_songs":
        loadData();
        break;
      
  case "quiz_started": {
  const quizId = message.data?.id;

  if (!quizId) return;

  // 🔒 BLOCCA QUIZ DUPLICATI
  if (lastQuizIdRef.current === quizId) {
    console.log("Duplicate quiz ignored on display:", quizId);
    return;
  }

  lastQuizIdRef.current = quizId;

  console.log("Quiz started on display:", quizId);
  setActiveQuiz(message.data);
  setQuizResult(null);
  break;
}

        
      case "quiz_ended":
        console.log("Quiz ended on display:", message.data);
        setQuizResult(message.data);
        // Keep showing result for 8 seconds then clear
        setTimeout(() => {
          setActiveQuiz(null);
          setQuizResult(null);
          lastQuizIdRef.current = null;
        }, 8000);
        loadData();
        break;
        
      case "quiz_session_ended":
        console.log("Quiz session ended:", message.data);
        setQuizResult({
          ...message.data,
          message: "🏆 Quiz Terminato!"
        });
        setTimeout(() => {
          setActiveQuiz(null);
          setQuizResult(null);
          lastQuizIdRef.current = null;

        }, 10000);
        loadData();
        break;
        
      default:
        break;
    }
  }, [controlYouTube, loadData]);

  const addFloatingReaction = (emoji, nickname = "") => {
    const id = Date.now() + Math.random();
    const left = Math.random() * 60 + 20;
    const bottom = Math.random() * 20 + 10;
    
    setFloatingReactions(prev => [...prev, { id, emoji, nickname, left, bottom }]);
    
    setTimeout(() => {
      setFloatingReactions(prev => prev.filter(r => r.id !== id));
    }, 3000);
  };

  const showOverlayMessage = (msgData) => {
    // Prevent duplicate messages by checking if message with same id already exists
    setOverlayMessages(prev => {
      const exists = prev.some(m => m.id === msgData.id);
      if (exists) return prev;
      
      const displayId = Date.now();
      const newMsg = { ...msgData, displayId };
      
      // Auto-remove after 8 seconds
      setTimeout(() => {
        setOverlayMessages(p => p.filter(m => m.displayId !== displayId));
      }, 8000);
      
      return [...prev, newMsg];
    });
  };

  // Initial load and polling
  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, [loadData]);

  // QR URL includes the pub code for direct join
  const joinUrl = `${window.location.origin}/join/${pubCode}`;
  const currentPerf = displayData?.current_performance;
  const hasVideo = currentPerf?.youtube_url && extractVideoId(currentPerf.youtube_url);

  return (
    <div className="h-screen w-screen bg-black overflow-hidden grid grid-cols-12 grid-rows-12">
      {/* Main Video Area */}
      <div className="col-span-9 row-span-10 bg-black relative flex items-center justify-center">
        {currentPerf ? (
          <>
            {/* YouTube Player Container */}
            {hasVideo ? (
              <div id="youtube-player-container" className="absolute inset-0 w-full h-full" />
            ) : (
              <div className="text-center px-8">
                <div className="mb-8">
                  <span className={`inline-flex items-center gap-2 px-6 py-3 rounded-full text-xl ${
                    currentPerf.status === "live" 
                      ? "bg-red-500/20 text-red-400" 
                      : currentPerf.status === "paused"
                      ? "bg-yellow-500/20 text-yellow-400"
                      : "bg-green-500/20 text-green-400"
                  }`}>
                    <span className={`w-4 h-4 rounded-full ${
                      currentPerf.status === "live" 
                        ? "bg-red-500 animate-pulse" 
                        : currentPerf.status === "paused"
                        ? "bg-yellow-500"
                        : "bg-green-500"
                    }`}></span>
                    {currentPerf.status === "live" && "LIVE"}
                    {currentPerf.status === "paused" && "PAUSA"}
                    {currentPerf.status === "voting" && "VOTAZIONE"}
                  </span>
                </div>
                <h1 className="text-6xl font-black mb-4 gradient-text">
                  {currentPerf.song_title}
                </h1>
                <p className="text-3xl text-zinc-400 mb-8">
                  {currentPerf.song_artist}
                </p>
                <div className="flex items-center justify-center gap-4">
                  <Mic2 className="w-12 h-12 text-fuchsia-400" />
                  <span className="text-4xl text-fuchsia-400 font-bold">
                    {currentPerf.user_nickname}
                  </span>
                </div>
                
                {currentPerf.vote_count > 0 && (
                  <div className="mt-12 flex items-center justify-center gap-4">
                    <Star className="w-16 h-16 text-yellow-500 fill-yellow-500" />
                    <span className="text-6xl font-black text-yellow-500">
                      {(currentPerf.average_score || 0).toFixed(1)}
                    </span>
                    <span className="text-2xl text-zinc-500">
                      ({currentPerf.vote_count} voti)
                    </span>
                  </div>
                )}
                
                {currentPerf.status === "voting" && (
                  <p className="mt-8 text-3xl text-cyan-400 animate-pulse">
                    📱 Vota dal tuo telefono!
                  </p>
                )}

                {!currentPerf.youtube_url && (
                  <p className="mt-8 text-xl text-zinc-500">
                    Nessun video YouTube impostato
                  </p>
                )}
              </div>
            )}

            {/* Pause Overlay */}
            {currentPerf.status === "paused" && hasVideo && (
              <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-10 pointer-events-none">
                <div className="text-center">
                  <span className="text-8xl">⏸️</span>
                  <p className="text-4xl mt-4 text-yellow-400 font-bold">IN PAUSA</p>
                </div>
              </div>
            )}

            {/* Voting Overlay */}
            {currentPerf.status === "voting" && hasVideo && (
              <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-10 pointer-events-none">
                <div className="text-center">
                  <span className="text-8xl">⭐</span>
                  <p className="text-4xl mt-4 text-yellow-400 font-bold">VOTAZIONE IN CORSO</p>
                  <p className="text-2xl mt-2 text-cyan-400">📱 Vota dal tuo telefono!</p>
                  {currentPerf.vote_count > 0 && (
                    <div className="mt-8 flex items-center justify-center gap-4">
                      <span className="text-6xl font-black text-yellow-500">
                        {(currentPerf.average_score || 0).toFixed(1)}
                      </span>
                      <span className="text-xl text-zinc-400">
                        ({currentPerf.vote_count} voti)
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Floating Reactions */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
              {floatingReactions.map(r => (
                <div
                  key={r.id}
                  className="absolute animate-float-up"
                  style={{ 
                    left: `${r.left}%`, 
                    bottom: `${r.bottom}%`,
                    fontSize: '4rem',
                    zIndex: 100
                  }}
                >
                  {r.emoji}
                  {r.nickname && (
                    <span className="text-sm text-white/70 ml-2 bg-black/50 px-2 py-1 rounded">{r.nickname}</span>
                  )}
                </div>
              ))}
            </div>

            {/* Overlay Messages */}
            <div className="absolute top-8 left-0 right-0 flex flex-col items-center gap-4 pointer-events-none z-30">
              {overlayMessages.map(msg => (
                <div
                  key={msg.displayId || msg.id}
                  className="glass rounded-2xl px-8 py-4 animate-fade-in-up max-w-2xl"
                >
                  <p className="text-xs text-cyan-400 mb-1">{msg.user_nickname}</p>
                  <p className="text-2xl font-medium">{msg.text}</p>
                </div>
              ))}
            </div>
          </>
        ) : activeQuiz ? (
          /* Quiz Display - Full Screen when no performance */
          <div className="flex flex-col items-center justify-center p-8 animate-fade-in-up">
            {!quizResult ? (
              <>
                <div className="flex items-center gap-4 mb-8">
                  <HelpCircle className="w-16 h-16 text-fuchsia-400" />
                  <div>
                    <span className="text-fuchsia-400 text-xl font-bold">QUIZ TIME!</span>
                    {activeQuiz.category_name && (
                      <p className="text-zinc-400">{activeQuiz.category_name}</p>
                    )}
                    {activeQuiz.total_questions > 1 && (
                      <p className="text-cyan-400 text-sm">
                        Domanda {activeQuiz.question_number}/{activeQuiz.total_questions}
                      </p>
                    )}
                  </div>
                </div>
                
                <h1 className="text-5xl font-black text-center mb-12 max-w-4xl">
                  {activeQuiz.question}
                </h1>
                
                <div className="grid grid-cols-2 gap-6 w-full max-w-4xl">
                  {activeQuiz.options?.map((option, index) => (
                    <div
                      key={index}
                      className="glass rounded-2xl p-6 flex items-center gap-4"
                    >
                      <span className="w-12 h-12 rounded-full bg-fuchsia-500/30 flex items-center justify-center text-2xl font-bold text-fuchsia-400">
                        {String.fromCharCode(65 + index)}
                      </span>
                      <span className="text-2xl">{option}</span>
                    </div>
                  ))}
                </div>
                
                <p className="mt-8 text-3xl text-cyan-400 animate-pulse">
                  📱 Rispondi dal tuo telefono! ({activeQuiz.points} punti)
                </p>
              </>
            ) : (
              /* Quiz Result Display */
              <div className="text-center animate-fade-in-up">
                <span className="text-8xl mb-8 block">🏆</span>
                <h2 className="text-4xl font-bold mb-4 text-green-400">
                  {quizResult.message || "Risposta Corretta!"}
                </h2>
                {quizResult.correct_option && (
                  <p className="text-3xl mb-8">
                    <span className="text-zinc-400">Risposta:</span>{" "}
                    <span className="text-green-400 font-bold">{quizResult.correct_option}</span>
                  </p>
                )}
                {quizResult.winners && quizResult.winners.length > 0 && (
                  <div className="mb-8">
                    <p className="text-xl text-zinc-400 mb-4">Hanno indovinato:</p>
                    <div className="flex flex-wrap justify-center gap-3">
                      {quizResult.winners.map((winner, i) => (
                        <span 
                          key={i} 
                          className="px-6 py-3 bg-green-500/20 text-green-400 rounded-full text-xl font-medium"
                        >
                          {winner}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {quizResult.leaderboard && quizResult.leaderboard.length > 0 && (
                  <div className="mt-8">
                    <p className="text-xl text-zinc-400 mb-4">Classifica:</p>
                    <div className="flex flex-col gap-2 items-center">
                      {quizResult.leaderboard.slice(0, 5).map((player, i) => (
                        <div key={i} className="flex items-center gap-4">
                          <span className="text-2xl">
                            {i === 0 && "🥇"}
                            {i === 1 && "🥈"}
                            {i === 2 && "🥉"}
                            {i > 2 && `${i + 1}.`}
                          </span>
                          <span className="text-xl">{player.nickname}</span>
                          <span className="text-xl text-cyan-400 font-bold">{player.score || 0} pts</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center">
            <div className="w-32 h-32 rounded-full bg-fuchsia-500/20 flex items-center justify-center mx-auto mb-8 neon-primary">
              <Mic2 className="w-16 h-16 text-fuchsia-400" />
            </div>
            <h1 className="text-5xl font-black gradient-text mb-4">
              {displayData?.pub?.name || "NeonPub Karaoke"}
            </h1>
            <p className="text-2xl text-zinc-400">
              Scansiona il QR per richiedere una canzone!
            </p>
          </div>
        )}
      </div>

      {/* Sidebar */}
      <div className="col-span-3 row-span-12 bg-zinc-900/80 border-l border-white/10 p-6 flex flex-col">
        {/* Logo & QR */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-full bg-fuchsia-500 flex items-center justify-center">
              <Mic2 className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl">NeonPub</span>
          </div>
          
          <div className="qr-container inline-block mb-2">
            <QRCodeSVG 
              value={joinUrl}
              size={140}
              bgColor="#ffffff"
              fgColor="#000000"
              level="M"
            />
          </div>
          <p className="mono text-2xl text-cyan-400 font-bold">{pubCode}</p>
          <p className="text-xs text-zinc-500 mt-1">Scansiona per partecipare</p>
        </div>

        {/* Queue */}
        <div className="flex-1 overflow-hidden">
          <h3 className="font-bold text-lg flex items-center gap-2 mb-4">
            <Music className="w-5 h-5 text-fuchsia-400" />
            Prossimi
          </h3>
          
          {displayData?.queue?.length > 0 ? (
            <div className="space-y-2">
              {displayData.queue.slice(0, 6).map((song, index) => (
                <div 
                  key={song.id}
                  className="glass rounded-lg p-3 flex items-center gap-3"
                >
                  <span className="mono text-lg text-fuchsia-400 font-bold">{index + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{song.title}</p>
                    <p className="text-xs text-cyan-400 truncate">{song.user_nickname}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-zinc-500 text-sm text-center py-4">Coda vuota</p>
          )}
        </div>

        {/* Leaderboard */}
        <div className="mt-4 pt-4 border-t border-white/10">
          <h3 className="font-bold text-lg flex items-center gap-2 mb-3">
            <Trophy className="w-5 h-5 text-yellow-500" />
            Top 3
          </h3>
          
          {displayData?.leaderboard?.length > 0 ? (
            <div className="space-y-2">
              {displayData.leaderboard.slice(0, 3).map((player, index) => (
                <div 
                  key={player.id || index}
                  className="flex items-center gap-2"
                >
                  <span className="text-lg">
                    {index === 0 && "🥇"}
                    {index === 1 && "🥈"}
                    {index === 2 && "🥉"}
                  </span>
                  <span className="flex-1 truncate text-sm">{player.nickname}</span>
                  <span className="mono text-sm text-cyan-400">{player.score || 0}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-zinc-500 text-sm text-center">Nessun punteggio</p>
          )}
        </div>
      </div>

      {/* Bottom Ticker */}
      <div className="col-span-9 row-span-2 bg-fuchsia-500/10 border-t border-fuchsia-500/30 flex items-center overflow-hidden">
        <div className="ticker-container w-full">
          <div className="ticker-content animate-marquee">
            <span className="text-xl font-medium whitespace-nowrap px-8">{ticker}</span>
            <span className="text-xl font-medium whitespace-nowrap px-8">{ticker}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
