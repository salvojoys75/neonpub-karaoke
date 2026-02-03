import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Home, Music, Trophy, User, Send, Star, MessageSquare, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/context/AuthContext";
import { useWebSocket } from "@/context/WebSocketContext";
import api from "@/lib/api";

const EMOJIS = ["❤️", "🔥", "👏", "🎤", "⭐", "🎉"];
const REACTION_LIMIT = 3;

export default function ClientApp() {
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuth();
  const { lastMessage, isConnected } = useWebSocket();
  
  const [activeTab, setActiveTab] = useState("home");
  const [queue, setQueue] = useState([]);
  const [myRequests, setMyRequests] = useState([]);
  const [currentPerformance, setCurrentPerformance] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [activeQuiz, setActiveQuiz] = useState(null);
  const [floatingReactions, setFloatingReactions] = useState([]);
  const [lastUpdate, setLastUpdate] = useState(Date.now());
  const [remainingReactions, setRemainingReactions] = useState(REACTION_LIMIT);
  
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [songTitle, setSongTitle] = useState("");
  const [songArtist, setSongArtist] = useState("");
  const [songYoutubeUrl, setSongYoutubeUrl] = useState("");
  
  const [showVoteModal, setShowVoteModal] = useState(false);
  const [selectedStars, setSelectedStars] = useState(0);
  const [hasVoted, setHasVoted] = useState(false);

  const [showQuizModal, setShowQuizModal] = useState(false);
  const [quizAnswer, setQuizAnswer] = useState(null);
  const [quizResult, setQuizResult] = useState(null);

  const [showMessageModal, setShowMessageModal] = useState(false);
  const [messageText, setMessageText] = useState("");

  const pollIntervalRef = useRef(null);
  const lastQuizIdRef = useRef(null);


  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/");
    }
  }, [isAuthenticated, navigate]);

  const loadData = useCallback(async () => {
    try {
      const [queueRes, myRes, perfRes, lbRes, quizRes, reactionsRes] = await Promise.all([
        api.get("/songs/queue"),
        api.get("/songs/my-requests"),
        api.get("/performance/current"),
        api.get("/leaderboard"),
        api.get("/quiz/active"),
        api.get("/reactions/remaining").catch(() => ({ data: { remaining: REACTION_LIMIT } }))
      ]);
      
      setQueue(queueRes.data || []);
      setMyRequests(myRes.data || []);
      setLeaderboard(lbRes.data || []);
      setLastUpdate(Date.now());
      setRemainingReactions(reactionsRes.data?.remaining ?? REACTION_LIMIT);
      
      // Update current performance
      const newPerf = perfRes.data;
      setCurrentPerformance(prev => {
        // Check if performance changed
        if (!prev && newPerf) {
          // New performance started - reset reactions
          setRemainingReactions(REACTION_LIMIT);
          return newPerf;
        } else if (prev && !newPerf) {
          // Performance ended
          setHasVoted(false);
          setSelectedStars(0);
          setRemainingReactions(REACTION_LIMIT);
          return null;
        } else if (prev && newPerf && prev.id !== newPerf.id) {
          // Different performance - reset reactions
          setHasVoted(false);
          setSelectedStars(0);
          setRemainingReactions(REACTION_LIMIT);
          return newPerf;
        } else if (newPerf) {
          // Same performance, update data
          // Check if voting is now open and show modal
          if (newPerf.voting_open && !prev?.voting_open && newPerf.user_id !== user?.id && !hasVoted) {
            setShowVoteModal(true);
            toast.info("⭐ Votazione aperta! Vota ora!");
          }
          return newPerf;
        }
        return prev;
      });
      
      // Handle quiz - ONLY set if no active quiz and no recent quiz shown
      const newQuiz = quizRes.data;
      if (newQuiz && newQuiz.id) {
        // Only show quiz modal if it's a new quiz we haven't seen
        setActiveQuiz(prev => {
          if (!prev || prev.id !== newQuiz.id) {
            // Check if we already showed this quiz (via ref)
            if (lastQuizIdRef?.current !== newQuiz.id) {
              // Don't show modal from polling - WebSocket handles that
              // Just update the data silently
              return newQuiz;
            }
          }
          return prev;
        });
      }
    } catch (error) {
      console.error("Error loading data:", error);
    }
  }, [user?.id, hasVoted]);

  // Initial load and polling
  useEffect(() => {
    if (isAuthenticated) {
      loadData();
      
      // Poll every 5 seconds for updates (WebSocket handles real-time)
      pollIntervalRef.current = setInterval(loadData, 5000);
      
      return () => {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
        }
      };
    }
  }, [isAuthenticated, loadData]);

  // Handle WebSocket messages
  useEffect(() => {
    if (!lastMessage) return;
    
    // Prevent duplicate quiz notifications
    if (lastMessage.type === "quiz_started") {
      const quizId = lastMessage.data?.id;
      if (!quizId || lastQuizIdRef.current === quizId || showQuizModal) {
        return; // Skip duplicate
      }
    }
    
    console.log("Client received WS message:", lastMessage.type);
    
    switch (lastMessage.type) {
      case "queue_updated":
      case "new_request":
        loadData();
        break;
        
      case "performance_started":
      case "performance_resumed":
      case "performance_restarted":
        setCurrentPerformance(lastMessage.data);
        setHasVoted(false);
        setSelectedStars(0);
        toast.info(`🎤 ${lastMessage.data?.user_nickname || "Qualcuno"} sta cantando!`);
        break;
        
      case "performance_paused":
        setCurrentPerformance(prev => prev ? { ...prev, status: "paused" } : null);
        break;
        
      case "voting_started":
      case "voting_opened":
        console.log("VOTING EVENT RECEIVED:", lastMessage.type, lastMessage.data);
        // Immediately show vote modal for eligible users
        const perfData = lastMessage.data?.performance;
        if (perfData && perfData.voting_open) {
          setCurrentPerformance(perfData);
          // Check if user can vote (not the performer and hasn't voted)
          if (perfData.user_id !== user?.user_id) {
            setHasVoted(false); // Reset vote status for new voting session
            setSelectedStars(0);
            setShowVoteModal(true);
            toast.info("⭐ Votazione aperta! Vota ora!");
          }
        } else {
          // Fallback: fetch current performance
          api.get("/performance/current").then(res => {
            console.log("Fetched performance for voting:", res.data);
            if (res.data && res.data.voting_open && res.data.user_id !== user?.user_id) {
              setCurrentPerformance(res.data);
              setHasVoted(false);
              setSelectedStars(0);
              setShowVoteModal(true);
              toast.info("⭐ Votazione aperta! Vota ora!");
            }
          }).catch(err => console.error("Error fetching performance:", err));
        }
        break;
        
      case "voting_closed":
        setShowVoteModal(false);
        setCurrentPerformance(null);
        setHasVoted(false);
        setSelectedStars(0);
        toast.success(`Votazione chiusa! Media: ${lastMessage.data?.average_score || 0}⭐`);
        loadData();
        break;
        
      case "vote_received":
        setCurrentPerformance(prev => prev ? { 
          ...prev, 
          average_score: lastMessage.data.new_average,
          vote_count: lastMessage.data.vote_count 
        } : null);
        break;
        
      case "reaction":
        addFloatingReaction(lastMessage.data.emoji);
        break;
        
      case "effect":
        if (lastMessage.data.effect_type === "emoji_burst") {
          for (let i = 0; i < 10; i++) {
            setTimeout(() => addFloatingReaction(lastMessage.data.data.emoji), i * 100);
          }
        }
        break;
        
case "quiz_started": {
  const quizId = lastMessage.data?.id;

  if (!quizId) return;

  // 🔒 blocca quiz duplicato
  if (lastQuizIdRef.current === quizId) {
    return;
  }

  lastQuizIdRef.current = quizId;

  setActiveQuiz(lastMessage.data);
  setQuizAnswer(null);
  setQuizResult(null);
  setShowQuizModal(true);
  toast.info("🎯 Quiz Time!");
  break;
}

        
case "quiz_ended":
  setQuizResult(lastMessage.data);
  loadData();

  setTimeout(() => {
    setShowQuizModal(false);
    setActiveQuiz(null);
    setQuizResult(null);
    lastQuizIdRef.current = null; // 🔓 reset
  }, 5000);
  break;

        
      case "no_more_songs":
        setCurrentPerformance(null);
        break;
        
      default:
        break;
    }
  }, [lastMessage, user?.id, hasVoted, loadData]);

  const addFloatingReaction = (emoji) => {
    const id = Date.now() + Math.random();
    const left = Math.random() * 80 + 10;
    setFloatingReactions(prev => [...prev, { id, emoji, left }]);
    setTimeout(() => {
      setFloatingReactions(prev => prev.filter(r => r.id !== id));
    }, 2000);
  };

  const handleRequestSong = async (e) => {
    e.preventDefault();
    if (!songTitle.trim() || !songArtist.trim()) {
      toast.error("Inserisci titolo e artista");
      return;
    }
    
    try {
      await api.post("/songs/request", { 
        title: songTitle, 
        artist: songArtist,
        youtube_url: songYoutubeUrl || null
      });
      toast.success("Richiesta inviata! Attendi approvazione");
      setShowRequestModal(false);
      setSongTitle("");
      setSongArtist("");
      setSongYoutubeUrl("");
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Errore nell'invio");
    }
  };

  const handleVote = async () => {
    if (selectedStars === 0 || !currentPerformance) return;
    
    try {
      await api.post("/votes/submit", { performance_id: currentPerformance.id, score: selectedStars });
      toast.success(`Hai votato ${selectedStars} stelle!`);
      setHasVoted(true);
      setShowVoteModal(false);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Errore nel voto");
    }
  };

  const handleReaction = async (emoji) => {
    if (remainingReactions <= 0) {
      toast.error("Hai esaurito le reazioni per questa esibizione!");
      return;
    }
    
    try {
      const { data } = await api.post("/reactions/send", { emoji });
      addFloatingReaction(emoji);
      setRemainingReactions(data.remaining ?? (remainingReactions - 1));
      
      if (data.remaining === 0) {
        toast.info("Hai usato tutte le reazioni!");
      }
    } catch (error) {
      if (error.response?.data?.detail) {
        toast.error(error.response.data.detail);
      } else {
        console.error("Reaction error:", error);
      }
    }
  };

  const handleSendMessage = async () => {
    if (!messageText.trim()) return;
    
    try {
      await api.post("/messages/send", { text: messageText });
      toast.success("Messaggio inviato! Attendi approvazione");
      setShowMessageModal(false);
      setMessageText("");
    } catch (error) {
      toast.error("Errore nell'invio");
    }
  };

  const handleQuizAnswer = async (index) => {
    if (quizAnswer !== null || !activeQuiz) return;
    
    setQuizAnswer(index);
    try {
      const { data } = await api.post("/quiz/answer", { quiz_id: activeQuiz.id, answer_index: index });
      if (data.is_correct) {
        toast.success(`Corretto! +${data.points_earned} punti!`);
      } else {
        toast.error("Sbagliato!");
      }
      // Reload leaderboard after answering
      setTimeout(() => loadData(), 1000);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Errore");
    }
  };

  const handleRefresh = () => {
    loadData();
    toast.success("Aggiornato!");
  };

  if (!isAuthenticated) return null;

  const isVotingOpen = currentPerformance?.voting_open && !hasVoted && currentPerformance?.user_id !== user?.id;

  return (
    <div className="min-h-screen bg-[#050505] flex flex-col pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#050505]/90 backdrop-blur-md p-4 flex justify-between items-center border-b border-white/5">
        <div>
          <h1 className="font-bold text-lg">{user?.pub_name}</h1>
          <p className="text-xs text-zinc-500 flex items-center gap-1">
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-yellow-500'}`}></span>
            {user?.nickname} • {isConnected ? 'Live' : 'Polling'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            onClick={handleRefresh}
            variant="ghost" 
            size="sm"
            className="text-zinc-400"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button 
            data-testid="logout-btn"
            onClick={logout} 
            variant="ghost" 
            size="sm"
            className="text-zinc-400"
          >
            Esci
          </Button>
        </div>
      </header>

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

      {/* Content */}
      <main className="flex-1 p-4">
        {activeTab === "home" && (
          <div className="space-y-6 animate-fade-in-up">
            {/* Current Performance */}
            {currentPerformance && (
              <div className="glass rounded-2xl p-5 neon-border">
                <div className="flex items-center gap-2 mb-3">
                  <span className={`w-3 h-3 rounded-full ${
                    currentPerformance.status === "live" ? "bg-red-500 animate-pulse" :
                    currentPerformance.status === "paused" ? "bg-yellow-500" :
                    "bg-green-500"
                  }`}></span>
                  <span className={`text-sm font-medium ${
                    currentPerformance.status === "live" ? "text-red-400" :
                    currentPerformance.status === "paused" ? "text-yellow-400" :
                    "text-green-400"
                  }`}>
                    {currentPerformance.status === "live" && "LIVE ORA"}
                    {currentPerformance.status === "paused" && "IN PAUSA"}
                    {currentPerformance.status === "voting" && "VOTAZIONE"}
                  </span>
                </div>
                <h2 className="text-2xl font-bold">{currentPerformance.song_title}</h2>
                <p className="text-zinc-400">{currentPerformance.song_artist}</p>
                <p className="text-fuchsia-400 mt-2">🎤 {currentPerformance.user_nickname}</p>
                
                {isVotingOpen && (
                  <Button 
                    data-testid="vote-now-btn"
                    onClick={() => setShowVoteModal(true)}
                    className="w-full mt-4 rounded-full bg-yellow-500 hover:bg-yellow-600 text-black animate-pulse"
                  >
                    <Star className="w-4 h-4 mr-2" /> Vota Ora!
                  </Button>
                )}
                
                {hasVoted && (
                  <p className="text-green-400 text-sm mt-4 text-center">✓ Hai già votato</p>
                )}
                
                {currentPerformance.vote_count > 0 && (
                  <div className="mt-4 flex items-center gap-2">
                    <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                    <span className="font-bold">{(currentPerformance.average_score || 0).toFixed(1)}</span>
                    <span className="text-zinc-500 text-sm">({currentPerformance.vote_count} voti)</span>
                  </div>
                )}
              </div>
            )}

            {/* Reaction Bar - show when live */}
            {currentPerformance?.status === "live" && (
              <div className="space-y-3">
                {/* Remaining reactions counter */}
                <div className="text-center">
                  <span className={`text-sm ${remainingReactions > 0 ? 'text-cyan-400' : 'text-red-400'}`}>
                    {remainingReactions > 0 
                      ? `🎭 ${remainingReactions}/${REACTION_LIMIT} reazioni rimanenti`
                      : '❌ Reazioni esaurite per questa esibizione'
                    }
                  </span>
                </div>
                
                <div className="flex justify-center gap-3 py-2">
                  {EMOJIS.map(emoji => (
                    <button
                      key={emoji}
                      data-testid={`reaction-${emoji}`}
                      onClick={() => handleReaction(emoji)}
                      disabled={remainingReactions <= 0}
                      className={`emoji-btn w-14 h-14 rounded-full flex items-center justify-center text-2xl touch-target transition-all ${
                        remainingReactions > 0 
                          ? 'bg-white/5 hover:bg-white/10 hover:scale-110' 
                          : 'bg-white/5 opacity-50 cursor-not-allowed'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
                
                {/* Send Message Button */}
                <Button
                  onClick={() => setShowMessageModal(true)}
                  variant="outline"
                  className="w-full rounded-full border-cyan-500/30 text-cyan-400"
                >
                  <MessageSquare className="w-4 h-4 mr-2" /> Manda Messaggio
                </Button>
              </div>
            )}

            {/* Request Song Button */}
            <Button 
              data-testid="request-song-btn"
              onClick={() => setShowRequestModal(true)}
              className="w-full rounded-full bg-fuchsia-500 hover:bg-fuchsia-600 py-6 text-lg btn-primary"
            >
              <Music className="w-5 h-5 mr-2" /> Richiedi una Canzone
            </Button>

            {/* Queue Preview - only show queued (approved) songs */}
            <div className="space-y-3">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Music className="w-5 h-5 text-fuchsia-400" />
                Prossimi a Cantare
              </h3>
              {queue.filter(s => s.status === "queued").length === 0 ? (
                <p className="text-zinc-500 text-center py-8">Nessuno in coda. Sii il primo!</p>
              ) : (
                <div className="space-y-2">
                  {queue.filter(s => s.status === "queued").slice(0, 5).map((song, index) => (
                    <div 
                      key={song.id} 
                      className="glass rounded-xl p-4 flex items-center gap-4 song-card"
                    >
                      <span className="mono text-2xl text-fuchsia-400 font-bold w-8">{index + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{song.title}</p>
                        <p className="text-sm text-zinc-500 truncate">{song.artist}</p>
                      </div>
                      <span className="text-xs text-cyan-400 whitespace-nowrap">{song.user_nickname}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "songs" && (
          <div className="space-y-4 animate-fade-in-up">
            <h2 className="text-xl font-bold">Le Mie Richieste</h2>
            {myRequests.length === 0 ? (
              <p className="text-zinc-500 text-center py-12">Non hai ancora richiesto canzoni</p>
            ) : (
              <div className="space-y-2">
                {myRequests.map(song => (
                  <div key={song.id} className="glass rounded-xl p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">{song.title}</p>
                        <p className="text-sm text-zinc-500">{song.artist}</p>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        song.status === "pending" ? "bg-yellow-500/20 text-yellow-400" :
                        song.status === "queued" ? "bg-cyan-500/20 text-cyan-400" :
                        song.status === "performing" ? "bg-red-500/20 text-red-400" :
                        song.status === "completed" ? "bg-green-500/20 text-green-400" :
                        "bg-zinc-500/20 text-zinc-400"
                      }`}>
                        {song.status === "pending" && "In attesa"}
                        {song.status === "queued" && "In coda"}
                        {song.status === "performing" && "Sul palco!"}
                        {song.status === "completed" && "Completata"}
                        {song.status === "rejected" && "Rifiutata"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "leaderboard" && (
          <div className="space-y-4 animate-fade-in-up">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-500" /> Classifica Quiz
            </h2>
            {leaderboard.length === 0 ? (
              <p className="text-zinc-500 text-center py-12">Nessun punteggio ancora</p>
            ) : (
              <div className="space-y-2">
                {leaderboard.map((player, index) => (
                  <div key={player.id || index} className={`leaderboard-item glass rounded-xl p-4 flex items-center gap-4 ${
                    player.id === user?.id ? 'ring-1 ring-fuchsia-500' : ''
                  }`}>
                    <span className={`text-2xl font-bold w-8 ${
                      index === 0 ? 'text-yellow-500' :
                      index === 1 ? 'text-zinc-400' :
                      index === 2 ? 'text-amber-700' :
                      'text-zinc-600'
                    }`}>
                      {index + 1}
                    </span>
                    <div className="flex-1">
                      <p className="font-medium">{player.nickname}</p>
                    </div>
                    <span className="mono text-lg font-bold text-cyan-400">{player.score || 0}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "profile" && (
          <div className="space-y-6 animate-fade-in-up">
            <div className="text-center py-8">
              <div className="w-24 h-24 rounded-full bg-fuchsia-500/20 flex items-center justify-center mx-auto mb-4">
                <User className="w-12 h-12 text-fuchsia-400" />
              </div>
              <h2 className="text-2xl font-bold">{user?.nickname}</h2>
              <p className="text-zinc-500">{user?.pub_name}</p>
            </div>
            
            <div className="glass rounded-2xl p-6 space-y-4">
              <div className="flex justify-between">
                <span className="text-zinc-400">Canzoni richieste</span>
                <span className="font-bold">{myRequests.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Punteggio Quiz</span>
                <span className="font-bold text-cyan-400">{leaderboard.find(p => p.id === user?.id)?.score || 0}</span>
              </div>
            </div>

            <Button 
              data-testid="logout-profile-btn"
              onClick={logout}
              variant="outline"
              className="w-full rounded-full border-red-500/30 text-red-400 hover:bg-red-500/10"
            >
              Esci dal Pub
            </Button>
          </div>
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="mobile-nav safe-bottom">
        {[
          { id: "home", icon: Home, label: "Home" },
          { id: "songs", icon: Music, label: "Canzoni" },
          { id: "leaderboard", icon: Trophy, label: "Classifica" },
          { id: "profile", icon: User, label: "Profilo" },
        ].map(tab => (
          <button
            key={tab.id}
            data-testid={`nav-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            className={`mobile-nav-item flex flex-col items-center gap-1 touch-target ${
              activeTab === tab.id ? 'active' : 'text-zinc-500'
            }`}
          >
            <tab.icon className="w-6 h-6" />
            <span className="text-xs">{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* Request Song Modal */}
      <Dialog open={showRequestModal} onOpenChange={setShowRequestModal}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle>Richiedi una Canzone</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRequestSong} className="space-y-4 mt-4">
            <div className="space-y-2">
              <label className="text-sm text-zinc-400">Titolo Canzone *</label>
              <Input
                data-testid="song-title-input"
                value={songTitle}
                onChange={(e) => setSongTitle(e.target.value)}
                placeholder="Es: Wonderwall"
                className="bg-zinc-800 border-zinc-700"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-zinc-400">Artista *</label>
              <Input
                data-testid="song-artist-input"
                value={songArtist}
                onChange={(e) => setSongArtist(e.target.value)}
                placeholder="Es: Oasis"
                className="bg-zinc-800 border-zinc-700"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-zinc-400">Link YouTube Karaoke (opzionale)</label>
              <Input
                value={songYoutubeUrl}
                onChange={(e) => setSongYoutubeUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                className="bg-zinc-800 border-zinc-700"
              />
              <p className="text-xs text-zinc-500">Se hai trovato il video karaoke, incollalo qui!</p>
            </div>
            <Button 
              data-testid="submit-song-request"
              type="submit"
              className="w-full rounded-full bg-fuchsia-500 hover:bg-fuchsia-600"
            >
              <Send className="w-4 h-4 mr-2" /> Invia Richiesta
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Vote Modal */}
      <Dialog open={showVoteModal} onOpenChange={setShowVoteModal}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-center">Vota l'Esibizione!</DialogTitle>
          </DialogHeader>
          <div className="py-8 text-center">
            <p className="mb-2 text-lg">{currentPerformance?.song_title}</p>
            <p className="text-zinc-400 mb-6">di {currentPerformance?.user_nickname}</p>
            
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  data-testid={`star-${star}`}
                  onClick={() => setSelectedStars(star)}
                  className="star-rating touch-target"
                >
                  <Star 
                    className={`w-12 h-12 ${selectedStars >= star ? 'text-yellow-500 fill-yellow-500' : 'text-zinc-600'}`} 
                  />
                </button>
              ))}
            </div>

            <Button 
              data-testid="submit-vote-btn"
              onClick={handleVote}
              disabled={selectedStars === 0}
              className="mt-8 rounded-full bg-yellow-500 hover:bg-yellow-600 text-black px-8"
            >
              Conferma Voto
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Message Modal */}
      <Dialog open={showMessageModal} onOpenChange={setShowMessageModal}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle>Manda un Messaggio</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <p className="text-sm text-zinc-400">
              Il tuo messaggio apparirà sul display dopo l'approvazione dell'admin
            </p>
            <Input
              value={messageText}
              onChange={(e) => setMessageText(e.target.value.slice(0, 100))}
              placeholder="Scrivi il tuo messaggio..."
              className="bg-zinc-800 border-zinc-700"
              maxLength={100}
            />
            <p className="text-xs text-zinc-500 text-right">{messageText.length}/100</p>
            <Button 
              onClick={handleSendMessage}
              disabled={!messageText.trim()}
              className="w-full rounded-full bg-cyan-500 hover:bg-cyan-600"
            >
              <Send className="w-4 h-4 mr-2" /> Invia
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Quiz Modal */}
      <Dialog open={showQuizModal} onOpenChange={setShowQuizModal}>
        <DialogContent className="quiz-modal border-fuchsia-500/30 max-w-lg bg-zinc-900">
          <DialogHeader>
            <DialogTitle className="text-center gradient-text text-2xl">
              {quizResult ? "Risultato Quiz!" : "Quiz Time!"}
            </DialogTitle>
          </DialogHeader>
          
          {!quizResult && activeQuiz && (
            <div className="py-6">
              {activeQuiz.category_name && (
                <p className="text-center text-fuchsia-400 text-sm mb-2">{activeQuiz.category_name}</p>
              )}
              <p className="text-xl text-center mb-6">{activeQuiz.question}</p>
              <div className="space-y-3">
                {activeQuiz.options.map((option, index) => (
                  <button
                    key={index}
                    data-testid={`quiz-option-${index}`}
                    onClick={() => handleQuizAnswer(index)}
                    disabled={quizAnswer !== null}
                    className={`quiz-option w-full p-4 rounded-xl border border-white/10 text-left ${
                      quizAnswer === index ? 'ring-2 ring-fuchsia-500' : ''
                    }`}
                  >
                    <span className="mono text-fuchsia-400 mr-3">{String.fromCharCode(65 + index)}.</span>
                    {option}
                  </button>
                ))}
              </div>
              <p className="text-center text-zinc-500 mt-4">
                {activeQuiz.points} punti in palio!
              </p>
            </div>
          )}

          {quizResult && (
            <div className="py-6 text-center">
              <p className="text-lg mb-4">
                Risposta corretta: <span className="text-green-400 font-bold">{quizResult.correct_option}</span>
              </p>
              {quizResult.winners && quizResult.winners.length > 0 && (
                <div>
                  <p className="text-zinc-400 mb-2">Vincitori:</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {quizResult.winners.map((winner, i) => (
                      <span key={i} className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm">
                        {winner}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <p className="text-zinc-500 mt-4">{quizResult.total_answers} risposte totali</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
