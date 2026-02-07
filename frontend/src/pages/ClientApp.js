import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Home, Music, Trophy, User, Send, Star, MessageSquare, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
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
  const [currentPerformanceId, setCurrentPerformanceId] = useState(null);
  
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
      const [queueRes, myRes, perfRes, lbRes, quizRes] = await Promise.all([
        api.getSongQueue(),
        api.getMyRequests(),
        api.getCurrentPerformance(),
        api.getLeaderboard(),
        api.getActiveQuiz(),
      ]);

      setQueue(queueRes.data || []);
      setMyRequests(myRes.data || []);
      
      const newPerf = perfRes.data;
      
      // Detect performance change and reset reactions
      if (newPerf?.id !== currentPerformanceId) {
        setCurrentPerformanceId(newPerf?.id || null);
        setRemainingReactions(REACTION_LIMIT);
        setHasVoted(false);
        setSelectedStars(0);
        
        // Load reaction count for new performance
        if (newPerf?.id) {
          try {
            const { data } = await api.getReactionCount(newPerf.id);
            setRemainingReactions(REACTION_LIMIT - (data.count || 0));
          } catch (err) {
            console.error("Error loading reaction count:", err);
          }
        }
      }
      
      setCurrentPerformance(newPerf);
      
      // Auto-open vote modal when voting opens
      if (newPerf?.status === 'voting' && !hasVoted && newPerf?.participant_id !== user?.id) {
        setShowVoteModal(true);
      }
      
      setLeaderboard(lbRes.data || []);
      
      const newQuiz = quizRes.data;
      if (newQuiz && newQuiz.id !== lastQuizIdRef.current) {
        setActiveQuiz(newQuiz);
        setQuizAnswer(null);
        setQuizResult(null);
        if (newQuiz.status === 'active') {
          setShowQuizModal(true);
          lastQuizIdRef.current = newQuiz.id;
        }
      } else if (newQuiz?.status === 'showing_results') {
        setActiveQuiz(newQuiz);
      } else if (!newQuiz) {
        setActiveQuiz(null);
        setShowQuizModal(false);
      }
      
      setLastUpdate(Date.now());
    } catch (error) {
      console.error("Error loading data:", error);
    }
  }, [currentPerformanceId, hasVoted, user?.id]);

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
      pollIntervalRef.current = setInterval(loadData, 3000);
      return () => clearInterval(pollIntervalRef.current);
    }
  }, [isAuthenticated, loadData]);

  useEffect(() => {
    if (!lastMessage) return;
    
    switch (lastMessage.type) {
      case "queue_updated":
      case "new_request":
        loadData();
        break;
        
      case "performance_updated":
        loadData();
        if (lastMessage.data?.status === 'voting') {
          setShowVoteModal(true);
        }
        break;
        
      case "reaction":
        addFloatingReaction(lastMessage.data.emoji);
        break;
        
      case "quiz_started":
        loadData();
        break;
        
      case "quiz_ended":
        setShowQuizModal(false);
        loadData();
        break;
        
      default:
        break;
    }
  }, [lastMessage, loadData]);

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
      await api.requestSong({
        title: songTitle,
        artist: songArtist,
        youtube_url: songYoutubeUrl || null,
      });
      toast.success("Richiesta inviata!");
      setShowRequestModal(false);
      setSongTitle("");
      setSongArtist("");
      setSongYoutubeUrl("");
      loadData();
    } catch (error) {
      toast.error(error.message || "Errore invio richiesta");
    }
  };

  const handleVote = async () => {
    if (selectedStars === 0 || !currentPerformance) return;
    try {
      await api.submitVote({
        performance_id: currentPerformance.id,
        score: selectedStars
      });
      toast.success(`Voto inviato: ${selectedStars} stelle!`);
      setShowVoteModal(false);
      setHasVoted(true);
    } catch (error) {
      toast.error(error.message || "Errore invio voto");
    }
  };

  const handleQuizAnswer = async (index) => {
    if (quizAnswer !== null) return;
    setQuizAnswer(index);
    try {
      const { data } = await api.answerQuiz({
        quiz_id: activeQuiz.id,
        answer_index: index
      });
      if (data.is_correct) {
        toast.success("Risposta corretta! +" + (activeQuiz.points || 10) + " punti");
      } else {
        toast.error("Risposta sbagliata!");
      }
      // Wait for results
      setTimeout(() => loadData(), 1000);
    } catch (error) {
      toast.error(error.message || "Errore invio risposta");
    }
  };

  const handleSendMessage = async () => {
    if (!messageText.trim()) return;
    try {
      await api.sendMessage({ message: messageText });
      toast.success("Messaggio inviato! In attesa approvazione");
      setShowMessageModal(false);
      setMessageText("");
    } catch (error) {
      toast.error("Errore invio messaggio");
    }
  };

  const handleSendReaction = async (emoji) => {
    if (remainingReactions <= 0) {
      toast.error("Hai esaurito le reazioni per questa esibizione!");
      return;
    }
    if (!currentPerformance || currentPerformance.status !== 'live') {
      toast.error("Puoi inviare reazioni solo durante esibizioni live");
      return;
    }
    try {
      await api.sendReaction({
        performance_id: currentPerformance.id,
        emoji: emoji
      });
      setRemainingReactions(prev => prev - 1);
      addFloatingReaction(emoji);
      if (remainingReactions - 1 === 0) {
        toast.info("Hai usato tutte le reazioni!");
      }
    } catch (error) {
      console.error("Reaction error:", error);
      toast.error("Errore invio reazione");
    }
  };

  if (!isAuthenticated) return null;

  const isVotingOpen = currentPerformance?.status === 'voting' && !hasVoted && currentPerformance?.participant_id !== user?.id;

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
            onClick={loadData}
            variant="ghost" 
            size="sm"
            className="text-zinc-400"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button 
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

            {/* Reaction Bar */}
            {currentPerformance?.status === "live" && (
              <div className="space-y-3">
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
                      onClick={() => handleSendReaction(emoji)}
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
              onClick={() => setShowRequestModal(true)}
              className="w-full rounded-full bg-fuchsia-500 hover:bg-fuchsia-600 py-6 text-lg"
            >
              <Music className="w-5 h-5 mr-2" /> Richiedi una Canzone
            </Button>

            {/* Queue Preview */}
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
                      className="glass rounded-xl p-4 flex items-center gap-4"
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
                  <div key={player.id || index} className={`glass rounded-xl p-4 flex items-center gap-4 ${
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
            <DialogDescription>Compila i campi per richiedere il brano.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRequestSong} className="space-y-4 mt-4">
            <div className="space-y-2">
              <label className="text-sm text-zinc-400">Titolo Canzone *</label>
              <Input
                value={songTitle}
                onChange={(e) => setSongTitle(e.target.value)}
                placeholder="Es: Wonderwall"
                className="bg-zinc-800 border-zinc-700"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-zinc-400">Artista *</label>
              <Input
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
            <DialogDescription className="text-center">Assegna un punteggio da 1 a 5 stelle.</DialogDescription>
          </DialogHeader>
          <div className="py-8 text-center">
            <p className="mb-2 text-lg">{currentPerformance?.song_title}</p>
            <p className="text-zinc-400 mb-6">di {currentPerformance?.user_nickname}</p>
            
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
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
            <DialogDescription>Invia un messaggio che apparirà sul display dopo approvazione.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
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
              {activeQuiz?.status === 'showing_results' ? "Risultati Quiz!" : "Quiz Time!"}
            </DialogTitle>
            <DialogDescription className="text-center">
              {activeQuiz?.status === 'showing_results' ? "Attendi la prossima domanda..." : "Rispondi velocemente!"}
            </DialogDescription>
          </DialogHeader>
          
          {activeQuiz?.status === 'active' && !quizAnswer && (
            <div className="py-6">
              {activeQuiz.category && (
                <p className="text-center text-fuchsia-400 text-sm mb-2">{activeQuiz.category}</p>
              )}
              <p className="text-xl text-center mb-6">{activeQuiz.question}</p>
              <div className="space-y-3">
                {activeQuiz.options.map((option, index) => (
                  <button
                    key={index}
                    onClick={() => handleQuizAnswer(index)}
                    className="quiz-option w-full p-4 rounded-xl border border-white/10 text-left hover:border-fuchsia-500/50"
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

          {quizAnswer !== null && (
            <div className="py-6 text-center">
              <p className="text-lg">Risposta inviata!</p>
              <p className="text-zinc-400 mt-2">Attendi i risultati...</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
