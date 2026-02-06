import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Home, Music, Trophy, User, Send, Star, MessageSquare, RefreshCw, Mic2, Check } from "lucide-react";
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
        api.get("/songs/queue"),
        api.get("/songs/my-requests"),
        api.get("/performance/current"),
        api.get("/leaderboard"),
        api.get("/quiz/active"),
      ]);

      setQueue(queueRes.data || []);
      setMyRequests(myRes.data || []);
      setCurrentPerformance(perfRes.data || null);
      setLeaderboard(lbRes.data || []);
      setActiveQuiz(quizRes.data || null);
      setLastUpdate(Date.now());
    } catch (error) {
      console.error("Error loading data:", error);
    }
  }, []);

  useEffect(() => {
    loadData();
    pollIntervalRef.current = setInterval(loadData, 5000);

    return () => clearInterval(pollIntervalRef.current);
  }, [loadData]);

  useEffect(() => {
    if (lastMessage) {
      switch (lastMessage.type) {
        case "queue_updated":
          setQueue(prev => {
            const newQueue = [...prev];
            const index = newQueue.findIndex(q => q.id === lastMessage.data.id);
            if (index !== -1) newQueue[index] = lastMessage.data;
            else newQueue.push(lastMessage.data);
            return newQueue;
          });
          loadData();
          break;
        case "performance_updated":
          setCurrentPerformance(lastMessage.data);
          if (lastMessage.data.status === "voting") {
            setShowVoteModal(true);
            setSelectedStars(0);
            setHasVoted(false);
          }
          break;
        case "quiz_started":
          setActiveQuiz(lastMessage.data);
          setShowQuizModal(true);
          setQuizAnswer(null);
          setQuizResult(null);
          break;
        case "quiz_ended":
          setQuizResult(lastMessage.data.result);
          setActiveQuiz(null);
          setTimeout(() => setShowQuizModal(false), 5000);
          break;
        case "reaction":
          addFloatingReaction(lastMessage.data.emoji);
          break;
      }
    }
  }, [lastMessage]);

  const handleSongRequest = async () => {
    if (!songTitle.trim() || !songArtist.trim()) {
      toast.error("Inserisci titolo e artista");
      return;
    }

    try {
      await api.requestSong({
        title: songTitle,
        artist: songArtist,
        youtube_url: songYoutubeUrl,
      });
      toast.success("Richiesta inviata!");
      setShowRequestModal(false);
      setSongTitle("");
      setSongArtist("");
      setSongYoutubeUrl("");
      loadData();
    } catch (error) {
      toast.error("Errore invio richiesta");
    }
  };

  const handleVote = async () => {
    if (selectedStars === 0) return;
    try {
      await api.submitVote(currentPerformance.id, selectedStars);
      toast.success("Voto inviato!");
      setShowVoteModal(false);
      setHasVoted(true);
    } catch (error) {
      toast.error("Errore invio voto");
    }
  };

  const handleQuizAnswer = async (index) => {
    setQuizAnswer(index);
    try {
      const res = await api.submitQuizAnswer(activeQuiz.id, index);
      setQuizResult(res.data);
    } catch (error) {
      toast.error("Errore invio risposta");
    }
  };

  const handleSendMessage = async () => {
    if (!messageText.trim()) return;
    try {
      await api.sendMessage(messageText);
      toast.success("Messaggio inviato!");
      setShowMessageModal(false);
      setMessageText("");
    } catch (error) {
      toast.error("Errore invio messaggio");
    }
  };

  const handleSendReaction = async (emoji) => {
    if (remainingReactions <= 0) return;
    try {
      await api.sendReaction(emoji);
      setRemainingReactions(prev => prev - 1);
      addFloatingReaction(emoji);
    } catch (error) {
      toast.error("Errore invio reazione");
    }
  };

  const addFloatingReaction = (emoji) => {
    const id = Date.now() + Math.random();
    const left = Math.random() * 80 + 10;
    setFloatingReactions(prev => [...prev, { id, emoji, left }]);
    
    setTimeout(() => {
      setFloatingReactions(prev => prev.filter(r => r.id !== id));
    }, 3000);
  };

  const handleRefresh = () => {
    loadData();
    toast.info("Dati aggiornati");
  };

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const isVotingOpen = currentPerformance?.status === "voting" && !hasVoted;

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
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

      {/* Header */}
      <header className="p-4 flex justify-between items-center border-b border-white/5">
        <h1 className="text-2xl font-bold">{user?.nickname || "Partecipante"}</h1>
        <Button onClick={handleRefresh} variant="ghost">
          <RefreshCw className="w-5 h-5" />
        </Button>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 overflow-y-auto space-y-6">
        {activeTab === "home" && (
          <div className="space-y-6">
            {/* Current Performance */}
            {currentPerformance ? (
              <div className="glass rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`w-3 h-3 rounded-full ${
                    currentPerformance.status === 'live' ? 'bg-red-500 animate-pulse' :
                    currentPerformance.status === 'paused' ? 'bg-yellow-500' :
                    'bg-green-500'
                  }`}></span>
                  <span className="text-sm font-medium uppercase text-zinc-400">{currentPerformance.status}</span>
                </div>
                <h2 className="text-xl font-bold">{currentPerformance.song_title}</h2>
                <p className="text-zinc-400">{currentPerformance.song_artist}</p>
                <p className="text-fuchsia-400 mt-2">🎤 {currentPerformance.user_nickname}</p>
                
                {currentPerformance.status === 'voting' && !hasVoted && (
                  <Button 
                    onClick={() => setShowVoteModal(true)}
                    className="mt-4 w-full bg-yellow-500 hover:bg-yellow-600 text-black"
                  >
                    <Star className="w-5 h-5 mr-2" /> Vota ora!
                  </Button>
                )}
              </div>
            ) : (
              <div className="glass rounded-2xl p-4 text-center">
                <Mic2 className="w-12 h-12 mx-auto text-fuchsia-500/20 mb-2" />
                <p className="text-zinc-500">Nessuna esibizione in corso</p>
              </div>
            )}

            {/* Active Quiz */}
            {activeQuiz && (
              <Button 
                onClick={() => setShowQuizModal(true)}
                className="w-full bg-fuchsia-500 hover:bg-fuchsia-600"
              >
                <HelpCircle className="w-5 h-5 mr-2" /> Rispondi al Quiz!
              </Button>
            )}

            {/* Reactions */}
            {currentPerformance && remainingReactions > 0 && (
              <div className="glass rounded-2xl p-4">
                <p className="text-sm text-zinc-400 mb-2">Reazioni rimaste: {remainingReactions}/{REACTION_LIMIT}</p>
                <div className="grid grid-cols-6 gap-2">
                  {EMOJIS.map(emoji => (
                    <button
                      key={emoji}
                      onClick={() => handleSendReaction(emoji)}
                      className="text-3xl p-2 rounded-xl hover:bg-white/5 transition"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Send Message */}
            {currentPerformance && (
              <Button 
                onClick={() => setShowMessageModal(true)}
                variant="outline"
                className="w-full"
              >
                <MessageSquare className="w-5 h-5 mr-2" /> Invia Messaggio
              </Button>
            )}
          </div>
        )}

        {activeTab === "songs" && (
          <div className="space-y-6">
            <Button onClick={() => setShowRequestModal(true)} className="w-full bg-fuchsia-500 hover:bg-fuchsia-600">
              <Music className="w-5 h-5 mr-2" /> Richiedi Canzone
            </Button>
            
            <h2 className="text-xl font-bold mb-2">Le Tue Richieste</h2>
            {myRequests.length === 0 ? (
              <p className="text-zinc-500 text-center py-4">Nessuna richiesta</p>
            ) : (
              <div className="space-y-3">
                {myRequests.map(req => (
                  <div key={req.id} className="glass rounded-xl p-4">
                    <p className="font-medium">{req.title}</p>
                    <p className="text-zinc-400 text-sm">{req.artist}</p>
                    <p className="text-xs mt-2 uppercase">{req.status}</p>
                  </div>
                ))}
              </div>
            )}
            
            <h2 className="text-xl font-bold mb-2">Coda</h2>
            {queue.length === 0 ? (
              <p className="text-zinc-500 text-center py-4">Coda vuota</p>
            ) : (
              <div className="space-y-3">
                {queue.map((song, index) => (
                  <div key={song.id} className="glass rounded-xl p-4 flex items-center gap-3">
                    <span className="text-2xl font-bold text-fuchsia-400">{index + 1}</span>
                    <div className="flex-1">
                      <p className="font-medium">{song.title}</p>
                      <p className="text-zinc-400 text-sm">{song.artist}</p>
                      <p className="text-cyan-400 text-xs mt-1">{song.user_nickname}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "leaderboard" && (
          <div className="space-y-3">
            {leaderboard.length === 0 ? (
              <p className="text-zinc-500 text-center py-12">Nessun punteggio</p>
            ) : (
              leaderboard.map((player, index) => (
                <div key={player.id} className="glass rounded-xl p-4 flex items-center gap-3">
                  <span className={`text-2xl font-bold ${
                    index === 0 ? 'text-yellow-500' :
                    index === 1 ? 'text-zinc-400' :
                    index === 2 ? 'text-amber-700' :
                    'text-zinc-600'
                  }`}>
                    {index + 1}
                  </span>
                  <p className="flex-1 font-medium">{player.nickname}</p>
                  <span className="text-xl font-bold text-cyan-400">{player.score}</span>
                </div>
              ))
            )}
          </div>
        )}
      </main>

      {/* Navigation */}
      <nav className="p-2 border-t border-white/5">
        <div className="grid grid-cols-4">
          {[
            { id: "home", icon: Home, label: "Home" },
            { id: "songs", icon: Music, label: "Canzoni" },
            { id: "leaderboard", icon: Trophy, label: "Classifica" },
            { id: "profile", icon: User, label: "Profilo" },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center p-2 ${
                activeTab === tab.id ? 'text-fuchsia-500' : 'text-zinc-500'
              }`}
            >
              <tab.icon className="w-6 h-6 mb-1" />
              <span className="text-xs">{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Request Modal */}
      <Dialog open={showRequestModal} onOpenChange={setShowRequestModal}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle>Richiesta Canzone</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <Input
              value={songTitle}
              onChange={(e) => setSongTitle(e.target.value)}
              placeholder="Titolo"
              className="bg-zinc-800 border-zinc-700"
            />
            <Input
              value={songArtist}
              onChange={(e) => setSongArtist(e.target.value)}
              placeholder="Artista"
              className="bg-zinc-800 border-zinc-700"
            />
            <Input
              value={songYoutubeUrl}
              onChange={(e) => setSongYoutubeUrl(e.target.value)}
              placeholder="URL YouTube (opzionale)"
              className="bg-zinc-800 border-zinc-700"
            />
            <Button onClick={handleSongRequest} className="w-full bg-fuchsia-500 hover:bg-fuchsia-600" size="lg">
              <Send className="w-5 h-5 mr-2" /> Invia
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Vote Modal */}
      <Dialog open={showVoteModal} onOpenChange={setShowVoteModal}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle>Vota l'Esibizione</DialogTitle>
          </DialogHeader>
          <div className="py-6 text-center">
            <p className="text-xl mb-4">{currentPerformance?.song_title} - {currentPerformance?.user_nickname}</p>
            <div className="flex justify-center gap-2 mb-4">
              {[1,2,3,4,5].map(star => (
                <Star
                  key={star}
                  className={`w-10 h-10 cursor-pointer ${
                    star <= selectedStars ? 'fill-yellow-500 text-yellow-500' : 'text-zinc-700'
                  }`}
                  onClick={() => setSelectedStars(star)}
                />
              ))}
            </div>
            <Button onClick={handleVote} disabled={selectedStars === 0} className="w-full bg-yellow-500 hover:bg-yellow-600 text-black" size="lg">
              <Check className="w-5 h-5 mr-2" /> Invia Voto
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

      {/* Message Modal */}
      <Dialog open={showMessageModal} onOpenChange={setShowMessageModal}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle>Invia Messaggio</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <Input
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Scrivi il tuo messaggio..."
              className="bg-zinc-800 border-zinc-700"
            />
            <Button onClick={handleSendMessage} className="w-full bg-fuchsia-500 hover:bg-fuchsia-600" size="lg">
              <Send className="w-5 h-5 mr-2" /> Invia
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}