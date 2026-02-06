// ... (tutti gli import restano uguali)
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { 
  Music, Play, Square, Trophy, Tv, Star, HelpCircle,
  Check, X, Sparkles, LogOut,
  SkipForward, Pause, RotateCcw, MessageSquare, Mic2, ChevronRight, Search
} from "lucide-react"; // AGGIUNTO 'Search'
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/context/AuthContext";
import { useWebSocket } from "@/context/WebSocketContext";
import api from "@/lib/api";

const EFFECT_EMOJIS = ["🔥", "❤️", "⭐", "🎉", "👏", "🎤", "💃", "🕺"];

export default function AdminDashboard() {
  // ... (tutto il codice prima del return resta UGUALE a prima)
  const navigate = useNavigate();
  const { isAuthenticated, isAdmin, logout } = useAuth();
  const { lastMessage, isConnected } = useWebSocket();
  
  const [queue, setQueue] = useState([]);
  const [currentPerformance, setCurrentPerformance] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [activeSection, setActiveSection] = useState("queue");
  const [pendingMessages, setPendingMessages] = useState([]);
  
  // Quiz
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [quizTab, setQuizTab] = useState("custom");
  const [quizQuestion, setQuizQuestion] = useState("");
  const [quizOptions, setQuizOptions] = useState(["", "", "", ""]);
  const [quizCorrectIndex, setQuizCorrectIndex] = useState(0);
  const [activeQuizId, setActiveQuizId] = useState(null);

  // YouTube URL input
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [showYoutubeModal, setShowYoutubeModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);

  const pubCode = localStorage.getItem("neonpub_pub_code");

  // ... (mantieni loadData, useEffects, handleApprove, etc. uguali fino a handleStartLive)

  useEffect(() => {
    if (!isAuthenticated || !isAdmin) {
      navigate("/");
    }
  }, [isAuthenticated, isAdmin, navigate]);

  const loadData = useCallback(async () => {
    try {
      const [queueRes, lbRes, perfRes] = await Promise.all([
        api.getSongQueue(),
        api.getLeaderboard(),
        api.getCurrentPerformance(),
      ]);
      setQueue(queueRes.data || []);
      setLeaderboard(lbRes.data || []);
      setCurrentPerformance(perfRes.data);
      setPendingMessages([]); 
    } catch (error) {
      console.error("Error loading data:", error);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && isAdmin) {
      loadData();
      const interval = setInterval(loadData, 5000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, isAdmin, loadData]);

  useEffect(() => {
    if (!lastMessage) return;
    
    console.log("Admin WS Message:", lastMessage.type);

    switch (lastMessage.type) {
      case "queue_updated":
      case "new_request":
        loadData();
        if (lastMessage.type === "new_request") {
          toast.info(`Nuova richiesta!`);
        }
        break;
      case "performance_started":
      case "performance_updated":
      case "voting_opened":
      case "voting_closed":
        loadData();
        setCurrentPerformance(lastMessage.data);
        break;
      case "vote_received":
        loadData(); 
        break;
      case "quiz_ended":
        setActiveQuizId(null);
        loadData();
        break;
      default:
        break;
    }
  }, [lastMessage, loadData]);

  const handleApprove = async (requestId) => {
    try {
      await api.approveRequest(requestId);
      toast.success("Aggiunta alla coda");
      loadData();
    } catch (error) {
      toast.error("Errore nell'approvazione");
    }
  };

  const handleReject = async (requestId) => {
    try {
      await api.rejectRequest(requestId);
      toast.success("Richiesta rifiutata");
      loadData();
    } catch (error) {
      toast.error("Errore nel rifiuto");
    }
  };

  const handleStartLive = async (request) => {
    setSelectedRequest(request);
    // Se la richiesta aveva già un URL (magari inserito dal cliente), usalo
    setYoutubeUrl(request.youtube_url || "");
    setShowYoutubeModal(true);
  };
  
  // NUOVA FUNZIONE PER CERCARE SU YOUTUBE
  const openYoutubeSearch = () => {
    if (!selectedRequest) return;
    const query = encodeURIComponent(`${selectedRequest.title} ${selectedRequest.artist} karaoke`);
    window.open(`https://www.youtube.com/results?search_query=${query}`, '_blank');
  };

  const handleConfirmStart = async () => {
    if (!selectedRequest) return;
    
    try {
      await api.startPerformance(selectedRequest.id, youtubeUrl);
      toast.success("Esibizione iniziata!");
      setShowYoutubeModal(false);
      setYoutubeUrl("");
      setSelectedRequest(null);
      loadData();
    } catch (error) {
      toast.error("Errore nell'avvio: " + error.message);
    }
  };

  const handleEndPerformance = async () => {
    if (!currentPerformance) return;
    try {
      await api.endPerformance(currentPerformance.id);
      toast.success("Esibizione terminata, votazione aperta!");
      loadData();
    } catch (error) {
      toast.error("Errore");
    }
  };

  const handleCloseVoting = async () => {
    if (!currentPerformance) return;
    try {
      await api.closeVoting(currentPerformance.id);
      toast.success("Votazione chiusa!");
      setCurrentPerformance(null);
      loadData();
    } catch (error) {
      toast.error("Errore");
    }
  };

  const handleNotImplemented = () => toast.info("Funzione non disponibile in questa versione");

  const handleStartCustomQuiz = async () => {
    if (!quizQuestion.trim() || quizOptions.some(o => !o.trim())) {
      toast.error("Compila tutti i campi");
      return;
    }
    
    try {
      const { data } = await api.startQuiz({
        category: 'custom',
        question: quizQuestion,
        options: quizOptions,
        correct_index: quizCorrectIndex,
        points: 10
      });
      setActiveQuizId(data.id);
      toast.success("Quiz lanciato!");
      setShowQuizModal(false);
      setQuizQuestion("");
      setQuizOptions(["", "", "", ""]);
    } catch (error) {
      toast.error("Errore nel lancio quiz");
    }
  };

  const handleEndQuiz = async () => {
    if (!activeQuizId) return;
    try {
      await api.endQuiz(activeQuizId);
      toast.success("Quiz terminato!");
      setActiveQuizId(null);
    } catch (error) {
      toast.error("Errore");
    }
  };

  const handleSendEffect = async (emoji) => {
    try {
      await api.sendEffect({ emoji });
      toast.success("Effetto inviato!");
    } catch (error) {
      toast.error("Errore");
    }
  };

  const openDisplayWindow = () => {
    if (!pubCode) {
      toast.error("Codice pub mancante");
      return;
    }
    window.open(`/display/${pubCode}`, "_blank", "width=1920,height=1080");
  };

  // ... (TUTTO IL JSX RESTO DEL FILE, MA AGGIORNO IL DIALOG YOUTUBE ALLA FINE)

  if (!isAuthenticated || !isAdmin) return null;

  const pendingRequests = queue.filter(r => r.status === "pending");
  const queuedRequests = queue.filter(r => r.status === "queued");

  return (
    <div className="min-h-screen bg-[#050505] grid grid-cols-[260px_1fr]">
      {/* ... (TUTTA LA SIDEBAR E IL MAIN CONTENT RIMANGONO UGUALI) ... */}
      
      {/* Sidebar */}
      <aside className="admin-sidebar border-r border-white/10 p-6 flex flex-col">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-full bg-fuchsia-500 flex items-center justify-center">
            <Mic2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold">NeonPub</h1>
            <p className="text-xs text-zinc-500">Regia</p>
          </div>
        </div>

        <nav className="space-y-2 flex-1">
          {[
            { id: "queue", icon: Music, label: "Richieste", badge: pendingRequests.length },
            { id: "performance", icon: Play, label: "Live" },
            { id: "messages", icon: MessageSquare, label: "Messaggi", badge: pendingMessages.length },
            { id: "quiz", icon: Sparkles, label: "Quiz" },
            { id: "leaderboard", icon: Trophy, label: "Classifica" },
          ].map(item => (
            <button
              key={item.id}
              data-testid={`sidebar-${item.id}`}
              onClick={() => setActiveSection(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors relative ${
                activeSection === item.id 
                  ? 'bg-fuchsia-500/20 text-fuchsia-400' 
                  : 'text-zinc-400 hover:bg-white/5'
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span>{item.label}</span>
              {item.badge > 0 && (
                <span className="absolute right-3 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="space-y-3 pt-6 border-t border-white/10">
          <div className="glass rounded-xl p-4">
            <p className="text-xs text-zinc-500 mb-1">Codice Pub</p>
            <p className="mono text-lg text-cyan-400 font-bold">{pubCode}</p>
          </div>
          
          <Button 
            data-testid="open-display-btn"
            onClick={openDisplayWindow}
            className="w-full rounded-xl bg-cyan-500 hover:bg-cyan-600"
          >
            <Tv className="w-4 h-4 mr-2" /> Apri Display
          </Button>
          
          <Button 
            data-testid="admin-logout-btn"
            onClick={logout}
            variant="ghost"
            className="w-full text-zinc-500 hover:text-red-400"
          >
            <LogOut className="w-4 h-4 mr-2" /> Esci
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="p-8 overflow-y-auto">
        <div className="flex items-center gap-2 mb-6">
          <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></span>
          <span className="text-sm text-zinc-500">
            {isConnected ? 'Connesso' : 'Disconnesso'}
          </span>
        </div>

        {/* ... (SEZIONI QUEUE, PERFORMANCE, MESSAGGI, QUIZ, LEADERBOARD UGUALI A PRIMA) ... */}
        {activeSection === "queue" && (
          <div className="space-y-6">
            {/* Pending Requests */}
            <div>
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
                Richieste in Attesa ({pendingRequests.length})
              </h2>
              
              {pendingRequests.length === 0 ? (
                <p className="text-zinc-500 py-4">Nessuna richiesta in attesa</p>
              ) : (
                <div className="space-y-2">
                  {pendingRequests.map((request) => (
                    <div key={request.id} className="glass rounded-xl p-4 flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold truncate">{request.title}</p>
                        <p className="text-sm text-zinc-500">{request.artist}</p>
                        <p className="text-xs text-cyan-400 mt-1">🎤 {request.nickname}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button onClick={() => handleApprove(request.id)} size="sm" className="rounded-full bg-green-500/20 text-green-400"><Check className="w-4 h-4" /></Button>
                        <Button onClick={() => handleStartLive(request)} size="sm" className="rounded-full bg-fuchsia-500"><Play className="w-4 h-4" /></Button>
                        <Button onClick={() => handleReject(request.id)} size="sm" className="rounded-full bg-red-500/20 text-red-400"><X className="w-4 h-4" /></Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Queued Songs */}
            <div>
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-cyan-500"></span>
                In Coda ({queuedRequests.length})
              </h2>
              
              {queuedRequests.length === 0 ? (
                <p className="text-zinc-500 py-4">Nessuna canzone in coda</p>
              ) : (
                <div className="space-y-2">
                  {queuedRequests.map((request, index) => (
                    <div key={request.id} className="glass rounded-xl p-4 flex items-center gap-4">
                      <span className="mono text-2xl text-fuchsia-400 font-bold w-10">{index + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold truncate">{request.title}</p>
                        <p className="text-sm text-zinc-500">{request.artist}</p>
                        <p className="text-xs text-cyan-400 mt-1">🎤 {request.nickname}</p>
                      </div>
                      {!currentPerformance && (
                        <Button onClick={() => handleStartLive(request)} size="sm" className="rounded-full bg-fuchsia-500"><Play className="w-4 h-4 mr-1" /> Avvia</Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeSection === "performance" && (
           /* ... Codice Performance uguale a prima ... */
           <div className="space-y-6">
            <h2 className="text-2xl font-bold">Controllo Live</h2>
            {currentPerformance ? (
              <div className="space-y-6">
                <div className="glass rounded-2xl p-6 neon-border">
                  <h3 className="text-3xl font-bold mb-2">{currentPerformance.song_title}</h3>
                  <p className="text-xl text-zinc-400">{currentPerformance.song_artist}</p>
                  <p className="text-fuchsia-400 mt-4 text-lg">🎤 {currentPerformance.song_request_id ? "Cantante" : "..."}</p>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {currentPerformance.status === "live" && (
                    <Button onClick={handleEndPerformance} className="rounded-xl bg-green-500/20 text-green-400 py-4"><Star className="w-5 h-5 mr-2" /> Fine + Voto</Button>
                  )}
                  {currentPerformance.status === "voting" && (
                    <Button onClick={handleCloseVoting} className="col-span-2 rounded-xl bg-green-500 hover:bg-green-600 py-4"><Check className="w-5 h-5 mr-2" /> Chiudi Votazione</Button>
                  )}
                </div>
                <div className="glass rounded-xl p-6">
                  <h4 className="font-bold mb-4">Effetti Live</h4>
                  <div className="flex flex-wrap gap-3">
                    {EFFECT_EMOJIS.map(emoji => (
                      <button key={emoji} onClick={() => handleSendEffect(emoji)} className="w-14 h-14 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-2xl">{emoji}</button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-20 text-zinc-500">
                <Play className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p>Nessuna esibizione in corso</p>
              </div>
            )}
           </div>
        )}

        {/* ... SEZIONE MESSAGGI, QUIZ, LEADERBOARD RESTANO UGUALI ... */}
        {activeSection === "messages" && <div className="space-y-6"><h2 className="text-2xl font-bold">Messaggi</h2><p>Coming soon...</p></div>}
        {activeSection === "quiz" && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Quiz</h2>
            {!activeQuizId && <Button onClick={() => setShowQuizModal(true)} className="rounded-full bg-fuchsia-500"><Sparkles className="w-4 h-4 mr-2" /> Nuovo Quiz</Button>}
            {activeQuizId && <div className="glass p-6"><Button onClick={handleEndQuiz} className="bg-red-500 w-full">Termina Quiz</Button></div>}
          </div>
        )}
        {activeSection === "leaderboard" && (
          <div className="space-y-3">
             <h2 className="text-2xl font-bold">Classifica</h2>
             {leaderboard.map((p, i) => <div key={i} className="glass p-4 flex gap-4"><span className="font-bold text-yellow-500">#{i+1}</span><span>{p.nickname}</span><span className="ml-auto text-cyan-400">{p.score}</span></div>)}
          </div>
        )}

      </main>

      {/* QUI C'È IL DIALOG AGGIORNATO CON LA RICERCA YOUTUBE */}
      <Dialog open={showYoutubeModal} onOpenChange={setShowYoutubeModal}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle>Avvia Esibizione</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="glass rounded-xl p-4">
              <p className="font-bold">{selectedRequest?.title}</p>
              <p className="text-sm text-zinc-500">{selectedRequest?.artist}</p>
              <p className="text-xs text-cyan-400 mt-1">🎤 {selectedRequest?.nickname}</p>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm text-zinc-400">URL Video YouTube Karaoke</label>
              <div className="flex gap-2">
                <Input
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  placeholder="Incolla qui il link..."
                  className="bg-zinc-800 border-zinc-700"
                />
                <Button 
                  type="button" 
                  onClick={openYoutubeSearch}
                  variant="outline"
                  title="Cerca su YouTube"
                  className="border-red-600/50 hover:bg-red-600/10 text-red-500"
                >
                  <Search className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-zinc-500">
                Clicca sulla lente per cercare il video, poi copia il link qui.
              </p>
            </div>
            
            <Button
              onClick={handleConfirmStart}
              className="w-full rounded-full bg-fuchsia-500 hover:bg-fuchsia-600"
            >
              <Play className="w-4 h-4 mr-2" /> Avvia Karaoke
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Quiz Modal (Rimane uguale) */}
      <Dialog open={showQuizModal} onOpenChange={setShowQuizModal}>
        <DialogContent className="bg-zinc-900 border-zinc-800"><DialogHeader><DialogTitle>Nuovo Quiz</DialogTitle></DialogHeader>
        <div className="space-y-4">
           <Textarea value={quizQuestion} onChange={e=>setQuizQuestion(e.target.value)} placeholder="Domanda" className="bg-zinc-800" />
           {quizOptions.map((o,i)=><div key={i} className="flex gap-2"><div className={`w-8 h-8 rounded-full flex items-center justify-center ${quizCorrectIndex===i?'bg-green-500':'bg-zinc-700'}`} onClick={()=>setQuizCorrectIndex(i)}>{String.fromCharCode(65+i)}</div><Input value={o} onChange={e=>{const n=[...quizOptions];n[i]=e.target.value;setQuizOptions(n)}} className="bg-zinc-800"/></div>)}
           <Button onClick={handleStartCustomQuiz} className="w-full bg-fuchsia-500">Lancia</Button>
        </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}