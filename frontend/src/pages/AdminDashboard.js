import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Music, Play, Square, Trophy, Tv, Star, HelpCircle,
  Check, X, Sparkles, LogOut, SkipForward, Pause,
  RotateCcw, MessageSquare, Mic2, Search
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import { RotateCcw } from "lucide-react"; 

const EFFECT_EMOJIS = ["🔥", "❤️", "⭐", "🎉", "👏", "🎤", "💃", "🕺"];

const QUIZ_CATEGORIES = [
  { id: "music_general", name: "Musica Generale" },
  { id: "rock", name: "Rock" },
  { id: "pop", name: "Pop" },
  { id: "rap", name: "Rap/Hip-Hop" },
  { id: "italian", name: "Musica Italiana" },
  { id: "80s", name: "Anni '80" },
  { id: "90s", name: "Anni '90" },
  { id: "2000s", name: "Anni 2000" },
];

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { isAuthenticated, isAdmin, logout } = useAuth();
 
  const [queue, setQueue] = useState([]);
  const [currentPerformance, setCurrentPerformance] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [activeSection, setActiveSection] = useState("queue");
  const [pendingMessages, setPendingMessages] = useState([]);
  
  // Quiz
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [quizTab, setQuizTab] = useState("custom");
  const [quizCategory, setQuizCategory] = useState("music_general");
  const [quizQuestion, setQuizQuestion] = useState("");
  const [quizOptions, setQuizOptions] = useState(["", "", "", ""]);
  const [quizCorrectIndex, setQuizCorrectIndex] = useState(0);
  const [activeQuizId, setActiveQuizId] = useState(null);
  const [quizResults, setQuizResults] = useState(null);
  const [quizStatus, setQuizStatus] = useState(null); // 'active', 'showing_results', 'ended'
  
  // YouTube
  const [showYoutubeModal, setShowYoutubeModal] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [youtubeSearchQuery, setYoutubeSearchQuery] = useState("");
  const [youtubeSearchResults, setYoutubeSearchResults] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [searchingYoutube, setSearchingYoutube] = useState(false);
  
  // Effects
  const [showEffectModal, setShowEffectModal] = useState(false);

  const pubCode = localStorage.getItem("neonpub_pub_code");
  const pollIntervalRef = useRef(null);

  const handleLogout = () => {
    localStorage.removeItem("neonpub_pub_code");
    logout();
    navigate("/");
  };

  useEffect(() => {
    if (!isAuthenticated || !isAdmin) {
      navigate("/");
      return;
    }
    if (!pubCode) {
      toast.error("Nessun evento selezionato");
      navigate("/");
    }
  }, [isAuthenticated, isAdmin, pubCode, navigate]);

  const loadData = useCallback(async () => {
    if (!pubCode) return;
   
    try {
      const [queueRes, perfRes, lbRes, messagesRes] = await Promise.all([
        api.getAdminQueue(),
        api.getAdminCurrentPerformance(),
        api.getAdminLeaderboard(),
        api.getAdminPendingMessages(),
      ]);
     
      setQueue(queueRes.data || []);
      setCurrentPerformance(perfRes.data);
      setLeaderboard(lbRes.data || []);
      setPendingMessages(messagesRes.data || []);
    } catch (error) {
      console.error("Error loading data:", error);
    }
  }, [pubCode]);

  useEffect(() => {
    if (isAuthenticated && isAdmin && pubCode) {
      loadData();
      pollIntervalRef.current = setInterval(loadData, 3000);
      return () => {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      };
    }
  }, [isAuthenticated, isAdmin, pubCode, loadData]);

  const searchYouTube = async () => {
    if (!youtubeSearchQuery.trim()) {
      toast.error("Inserisci una ricerca");
      return;
    }

    setSearchingYoutube(true);
    try {
      const query = `${selectedRequest?.title || youtubeSearchQuery} ${selectedRequest?.artist || ''} karaoke`.trim();
      const apiKey = process.env.REACT_APP_YOUTUBE_API_KEY;
      
      if (!apiKey || apiKey === 'YOUR_KEY') {
        toast.error("YouTube API Key non configurata");
        setSearchingYoutube(false);
        return;
      }
      
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/search?` +
        `part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=5&` +
        `key=${apiKey}`
      );
      
      if (!response.ok) throw new Error('YouTube API error');
      
      const data = await response.json();
      setYoutubeSearchResults(data.items || []);
    } catch (error) {
      console.error("YouTube search error:", error);
      toast.error("Errore ricerca YouTube - usa URL manuale");
      setYoutubeSearchResults([]);
    } finally {
      setSearchingYoutube(false);
    }
  };

  const selectYouTubeVideo = (videoId) => {
    setYoutubeUrl(`https://www.youtube.com/watch?v=${videoId}`);
    setYoutubeSearchResults([]);
  };

  const handleApprove = async (id) => {
    try {
      await api.approveRequest(id);
      toast.success("Richiesta approvata!");
      loadData();
    } catch (error) {
      toast.error("Errore approvazione");
    }
  };

  const handleReject = async (id) => {
    try {
      await api.rejectRequest(id);
      toast.success("Richiesta rifiutata");
      loadData();
    } catch (error) {
      toast.error("Errore rifiuto");
    }
  };

  const handleStartLive = (request) => {
    setSelectedRequest(request);
    setYoutubeUrl(request.youtube_url || "");
    setYoutubeSearchQuery(`${request.title} ${request.artist} karaoke`);
    setYoutubeSearchResults([]);
    setShowYoutubeModal(true);
  };

  const startPerformance = async () => {
    if (!selectedRequest || !youtubeUrl.trim()) {
      toast.error("Inserisci URL YouTube");
      return;
    }

    try {
      await api.startPerformance(selectedRequest.id, youtubeUrl);
      toast.success("Esibizione iniziata!");
      setShowYoutubeModal(false);
      setSelectedRequest(null);
      setYoutubeUrl("");
      setYoutubeSearchResults([]);
      loadData();
    } catch (error) {
      toast.error("Errore avvio esibizione");
    }
  };

  const handlePause = async () => {
    if (!currentPerformance) return;
    try {
      await api.pausePerformance(currentPerformance.id);
      toast.info("Esibizione in pausa");
      loadData();
    } catch (error) {
      toast.error("Errore pausa");
    }
  };

  const handleResume = async () => {
    if (!currentPerformance) return;
    try {
      await api.resumePerformance(currentPerformance.id);
      toast.success("Esibizione ripresa!");
      loadData();
    } catch (error) {
      toast.error("Errore ripresa");
    }
  };

const handleRestart = async () => {
  if (!currentPerformance) return;
  try {
    await api.restartPerformance(currentPerformance.id);
    toast.success("Video riavvolto!");
    loadData(); // Ricarica stato
  } catch (error) {
    toast.error("Errore riavvolgimento");
  }
};

  const handleEndPerformance = async () => {
    if (!currentPerformance) return;
    try {
      await api.endPerformance(currentPerformance.id);
      toast.success("Votazione aperta!");
      loadData();
    } catch (error) {
      toast.error("Errore fine esibizione");
    }
  };

  const handleCloseVoting = async () => {
    if (!currentPerformance) return;
    try {
      await api.closeVoting(currentPerformance.id);
      toast.success("Votazione chiusa!");
      loadData();
    } catch (error) {
      toast.error("Errore chiusura votazione");
    }
  };

  const handleSkip = async () => {
    if (!currentPerformance) return;
    if (!window.confirm("Sicuro di saltare questa esibizione?")) return;
    
    try {
      await api.skipPerformance(currentPerformance.id);
      toast.info("Esibizione saltata");
      loadData();
    } catch (error) {
      toast.error("Errore skip");
    }
  };

  // MESSAGES HANDLERS
  const handleApproveMessage = async (messageId) => {
    try {
      await api.approveMessage(messageId);
      toast.success("Messaggio approvato!");
      loadData();
    } catch (error) {
      toast.error("Errore approvazione messaggio");
    }
  };

  const handleRejectMessage = async (messageId) => {
    try {
      await api.rejectMessage(messageId);
      toast.success("Messaggio rifiutato");
      loadData();
    } catch (error) {
      toast.error("Errore rifiuto messaggio");
    }
  };

  // QUIZ HANDLERS - STEP BY STEP
  const handleStartQuiz = async (e) => {
    e.preventDefault();
   
    if (quizTab === "custom") {
      if (!quizQuestion.trim() || quizOptions.some(o => !o.trim())) {
        toast.error("Compila tutti i campi");
        return;
      }
      try {
        const { data } = await api.startQuiz({
          category: "custom",
          question: quizQuestion,
          options: quizOptions,
          correct_index: quizCorrectIndex,
          points: 10
        });
       
        setActiveQuizId(data.id);
        setQuizStatus('active');
        setQuizResults(null);
        toast.success("Quiz lanciato! Aspetta le risposte...");
        setShowQuizModal(false);
      } catch (error) {
        toast.error("Errore lancio quiz");
      }
    } else {
      toast.info(`Quiz categoria "${quizCategory}" - funzione da implementare`);
    }
  };

  const handleShowResults = async () => {
    if (!activeQuizId) return;
    try {
      // Change quiz status to showing_results
      await api.showQuizResults(activeQuizId);
      
      // Get results
      const { data } = await api.getQuizResults(activeQuizId);
      setQuizResults(data);
      setQuizStatus('showing_results');
      toast.success("Risultati mostrati!");
    } catch (error) {
      toast.error("Errore mostra risultati");
    }
  };

  const handleNextQuestion = () => {
    // Reset for next question
    setActiveQuizId(null);
    setQuizStatus(null);
    setQuizResults(null);
    setQuizQuestion("");
    setQuizOptions(["", "", "", ""]);
    setQuizCorrectIndex(0);
    setShowQuizModal(true);
    toast.info("Prepara la prossima domanda");
  };

  const handleEndQuiz = async () => {
    if (!activeQuizId) return;
    try {
      await api.endQuiz(activeQuizId);
      
      // Get final leaderboard
      const { data } = await api.getQuizLeaderboard();
      setLeaderboard(data);
      
      toast.success("Quiz terminato! Classifica finale aggiornata");
      setActiveQuizId(null);
      setQuizStatus(null);
      setQuizResults(null);
      setQuizQuestion("");
      setQuizOptions(["", "", "", ""]);
      setQuizCorrectIndex(0);
      loadData();
    } catch (error) {
      toast.error("Errore fine quiz");
    }
  };

  const handleSendEffect = async (emoji) => {
    try {
      toast.success(`Effetto ${emoji} inviato!`);
      setShowEffectModal(false);
    } catch (error) {
      toast.error("Errore invio effetto");
    }
  };

  const handleOpenDisplay = () => {
    window.open(`/display/${pubCode}`, '_blank');
  };

  const pendingRequests = queue.filter(r => r.status === "pending");
  const queuedRequests = queue.filter(r => r.status === "queued");

  return (
    <div className="min-h-screen bg-[#050505] flex">
      {/* Sidebar */}
      <aside className="w-64 bg-zinc-900/50 border-r border-white/5 p-6 flex flex-col">
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-2">Regia Admin</h1>
          <div className="glass rounded-xl p-3">
            <p className="text-xs text-zinc-500 mb-1">Codice Evento</p>
            <p className="mono text-lg text-cyan-400 font-bold">{pubCode}</p>
          </div>
        </div>

        <nav className="space-y-2 flex-1">
          {[
            { id: "queue", icon: Music, label: "Coda", badge: queuedRequests.length + pendingRequests.length },
            { id: "performance", icon: Mic2, label: "Esibizione", badge: currentPerformance ? 1 : 0 },
            { id: "messages", icon: MessageSquare, label: "Messaggi", badge: pendingMessages.length },
            { id: "quiz", icon: HelpCircle, label: "Quiz", badge: activeQuizId ? 1 : 0 },
            { id: "leaderboard", icon: Trophy, label: "Classifica", badge: 0 },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all relative ${
                activeSection === item.id
                  ? 'bg-fuchsia-500 text-white'
                  : 'hover:bg-white/5 text-zinc-400'
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
          <Button onClick={handleOpenDisplay} className="w-full rounded-xl bg-cyan-500 hover:bg-cyan-600">
            <Tv className="w-4 h-4 mr-2" /> Apri Display
          </Button>
          <Button onClick={() => setShowEffectModal(true)} variant="outline" className="w-full rounded-xl">
            <Sparkles className="w-4 h-4 mr-2" /> Effetti
          </Button>
          <Button onClick={handleLogout} variant="ghost" className="w-full text-zinc-500 hover:text-red-400">
            <LogOut className="w-4 h-4 mr-2" /> Esci
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-y-auto">
        {/* Current Performance */}
        {currentPerformance && (
          <div className="glass rounded-2xl p-6 mb-8">
            <div className="flex justify-between items-start mb-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`w-3 h-3 rounded-full ${
                    currentPerformance.status === 'live' ? 'bg-red-500 animate-pulse' :
                    currentPerformance.status === 'paused' ? 'bg-yellow-500' :
                    'bg-green-500'
                  }`}></span>
                  <span className="text-sm font-medium uppercase text-zinc-400">{currentPerformance.status}</span>
                </div>
                <h2 className="text-3xl font-bold">{currentPerformance.song_title}</h2>
                <p className="text-xl text-zinc-400">{currentPerformance.song_artist}</p>
                <p className="text-fuchsia-400 mt-2 text-lg">🎤 {currentPerformance.user_nickname}</p>
              </div>
              
              {currentPerformance.vote_count > 0 && (
                <div className="text-right">
                  <div className="flex items-center gap-2 justify-end">
                    <Star className="w-8 h-8 text-yellow-500 fill-yellow-500" />
                    <span className="text-4xl font-bold">{(currentPerformance.average_score || 0).toFixed(1)}</span>
                  </div>
                  <p className="text-zinc-500">{currentPerformance.vote_count} voti</p>
                </div>
              )}
            </div>

            <div className="flex gap-2 flex-wrap">
              {currentPerformance.status === 'live' && (
                <>
                  <Button onClick={handlePause} variant="outline" size="lg">
                    <Pause className="w-5 h-5 mr-2" /> Pausa
                  </Button>
<Button 
  onClick={handleRestart} 
  className="rounded-xl bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 py-4"
>
  <RotateCcw className="w-5 h-5 mr-2" /> Riavvolgi
</Button>
                  <Button onClick={handleEndPerformance} className="bg-green-500 hover:bg-green-600" size="lg">
                    <Square className="w-5 h-5 mr-2" /> Fine → Vota
                  </Button>
                  <Button onClick={handleSkip} variant="destructive" size="lg">
                    <SkipForward className="w-5 h-5 mr-2" /> Skip
                  </Button>
                </>
              )}
              
              {currentPerformance.status === 'paused' && (
                <>
                  <Button onClick={handleResume} className="bg-green-500 hover:bg-green-600" size="lg">
                    <Play className="w-5 h-5 mr-2" /> Riprendi
                  </Button>
                  <Button onClick={handleSkip} variant="destructive" size="lg">
                    <SkipForward className="w-5 h-5 mr-2" /> Skip
                  </Button>
                </>
              )}
              
              {currentPerformance.status === 'voting' && (
                <Button onClick={handleCloseVoting} className="bg-yellow-500 hover:bg-yellow-600 text-black" size="lg">
                  <Check className="w-5 h-5 mr-2" /> Chiudi Votazione
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Sections */}
        {activeSection === "queue" && (
          <div className="space-y-8">
            {/* Pending */}
            <div>
              <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
                Richieste in Attesa ({pendingRequests.length})
              </h2>
              {pendingRequests.length === 0 ? (
                <p className="text-zinc-500 py-8 text-center">Nessuna richiesta</p>
              ) : (
                <div className="space-y-3">
                  {pendingRequests.map((req) => (
                    <div key={req.id} className="glass rounded-xl p-5 flex items-center gap-4">
                      <div className="flex-1">
                        <p className="font-bold text-lg">{req.title}</p>
                        <p className="text-zinc-400">{req.artist}</p>
                        <p className="text-cyan-400 text-sm mt-1">🎤 {req.user_nickname}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={() => handleApprove(req.id)} size="sm" className="bg-green-500/20 text-green-400 hover:bg-green-500/30">
                          <Check className="w-4 h-4" />
                        </Button>
                        <Button onClick={() => handleStartLive(req)} size="sm" className="bg-fuchsia-500 hover:bg-fuchsia-600">
                          <Play className="w-4 h-4" />
                        </Button>
                        <Button onClick={() => handleReject(req.id)} size="sm" className="bg-red-500/20 text-red-400 hover:bg-red-500/30">
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Queued */}
            <div>
              <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-cyan-500"></span>
                In Coda ({queuedRequests.length})
              </h2>
              {queuedRequests.length === 0 ? (
                <p className="text-zinc-500 py-8 text-center">Nessuna canzone in coda</p>
              ) : (
                <div className="space-y-3">
                  {queuedRequests.map((req, idx) => (
                    <div key={req.id} className="glass rounded-xl p-5 flex items-center gap-4">
                      <span className="text-3xl font-bold text-fuchsia-400 w-12">{idx + 1}</span>
                      <div className="flex-1">
                        <p className="font-bold text-lg">{req.title}</p>
                        <p className="text-zinc-400">{req.artist}</p>
                        <p className="text-cyan-400 text-sm mt-1">🎤 {req.user_nickname}</p>
                      </div>
                      {!currentPerformance && (
                        <Button onClick={() => handleStartLive(req)} className="bg-fuchsia-500 hover:bg-fuchsia-600">
                          <Play className="w-5 h-5 mr-2" /> Avvia
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* MESSAGES SECTION */}
        {activeSection === "messages" && (
          <div>
            <h2 className="text-2xl font-bold mb-6">Messaggi da Approvare</h2>
            {pendingMessages.length === 0 ? (
              <p className="text-zinc-500 py-12 text-center">Nessun messaggio in attesa</p>
            ) : (
              <div className="space-y-3">
                {pendingMessages.map((msg) => (
                  <div key={msg.id} className="glass rounded-xl p-5">
                    <div className="mb-4">
                      <p className="text-xs text-zinc-500 mb-1">Da: {msg.user_nickname}</p>
                      <p className="text-lg">{msg.text}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        onClick={() => handleApproveMessage(msg.id)}
                        className="flex-1 bg-green-500 hover:bg-green-600"
                      >
                        <Check className="w-4 h-4 mr-2" /> Approva e Mostra
                      </Button>
                      <Button 
                        onClick={() => handleRejectMessage(msg.id)}
                        variant="destructive"
                        className="flex-1"
                      >
                        <X className="w-4 h-4 mr-2" /> Rifiuta
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* QUIZ SECTION */}
        {activeSection === "quiz" && (
          <div>
            <h2 className="text-2xl font-bold mb-6">Gestione Quiz</h2>
            
            {!activeQuizId ? (
              <div className="text-center py-12">
                <p className="text-zinc-500 mb-6">Nessun quiz attivo</p>
                <Button 
                  onClick={() => setShowQuizModal(true)}
                  className="bg-fuchsia-500 hover:bg-fuchsia-600"
                  size="lg"
                >
                  <HelpCircle className="w-5 h-5 mr-2" /> Lancia Nuovo Quiz
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Quiz Status */}
                <div className="glass rounded-xl p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-3 h-3 rounded-full ${
                      quizStatus === 'active' ? 'bg-green-500 animate-pulse' :
                      quizStatus === 'showing_results' ? 'bg-yellow-500' :
                      'bg-zinc-500'
                    }`}></div>
                    <span className="text-lg font-medium">
                      {quizStatus === 'active' && '🟢 Quiz Attivo - In attesa risposte'}
                      {quizStatus === 'showing_results' && '🟡 Risultati Mostrati'}
                    </span>
                  </div>
                  
                  <div className="bg-white/5 rounded-xl p-4 mb-4">
                    <p className="text-sm text-zinc-400 mb-2">Domanda:</p>
                    <p className="text-xl font-medium">{quizQuestion}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-6">
                    {quizOptions.map((opt, idx) => (
                      <div 
                        key={idx}
                        className={`p-3 rounded-lg border ${
                          idx === quizCorrectIndex 
                            ? 'border-green-500 bg-green-500/10' 
                            : 'border-white/10 bg-white/5'
                        }`}
                      >
                        <span className="text-xs text-zinc-500 mr-2">{String.fromCharCode(65 + idx)}.</span>
                        <span>{opt}</span>
                        {idx === quizCorrectIndex && <span className="ml-2 text-green-400">✓</span>}
                      </div>
                    ))}
                  </div>

                  {/* Quiz Results */}
                  {quizResults && (
                    <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 mb-4">
                      <p className="text-green-400 font-bold mb-2">Risultati:</p>
                      <p className="text-sm mb-1">Risposte totali: {quizResults.total_answers}</p>
                      <p className="text-sm mb-1">Risposte corrette: {quizResults.correct_count}</p>
                      <p className="text-sm">Vincitori: {quizResults.winners.join(', ') || 'Nessuno'}</p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-3">
                    {quizStatus === 'active' && (
                      <Button 
                        onClick={handleShowResults}
                        className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-black"
                        size="lg"
                      >
                        📊 Mostra Risultati
                      </Button>
                    )}
                    
                    {quizStatus === 'showing_results' && (
                      <>
                        <Button 
                          onClick={handleNextQuestion}
                          className="flex-1 bg-blue-500 hover:bg-blue-600"
                          size="lg"
                        >
                          ➡️ Prossima Domanda
                        </Button>
                        <Button 
                          onClick={handleEndQuiz}
                          className="flex-1 bg-red-500 hover:bg-red-600"
                          size="lg"
                        >
                          🏁 Fine Quiz
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* LEADERBOARD SECTION */}
        {activeSection === "leaderboard" && (
          <div>
            <h2 className="text-2xl font-bold mb-6">Classifica</h2>
            {leaderboard.length === 0 ? (
              <p className="text-zinc-500 py-12 text-center">Nessun punteggio</p>
            ) : (
              <div className="space-y-3">
                {leaderboard.map((player, idx) => (
                  <div key={player.id} className="glass rounded-xl p-5 flex items-center gap-4">
                    <span className={`text-3xl font-bold w-12 ${
                      idx === 0 ? 'text-yellow-500' :
                      idx === 1 ? 'text-zinc-400' :
                      idx === 2 ? 'text-amber-700' :
                      'text-zinc-600'
                    }`}>
                      {idx + 1}
                    </span>
                    <p className="flex-1 text-lg font-medium">{player.nickname}</p>
                    <span className="text-2xl font-bold text-cyan-400">{player.score}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Quiz Floating Button */}
      {!activeQuizId && (
        <div className="fixed bottom-8 right-8">
          <Button 
            onClick={() => setShowQuizModal(true)}
            className="bg-fuchsia-500 hover:bg-fuchsia-600 rounded-full shadow-2xl"
            size="lg"
          >
            <HelpCircle className="w-5 h-5 mr-2" /> Lancia Quiz
          </Button>
        </div>
      )}

      {/* YouTube Modal */}
      <Dialog open={showYoutubeModal} onOpenChange={setShowYoutubeModal}>
        <DialogContent className="bg-zinc-900 border-zinc-800 max-w-3xl">
          <DialogHeader>
            <DialogTitle>Scegli Video YouTube</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <p className="text-lg font-bold mb-1">{selectedRequest?.title}</p>
              <p className="text-zinc-400">{selectedRequest?.artist}</p>
            </div>

            <Tabs defaultValue="search" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="search">Ricerca Auto</TabsTrigger>
                <TabsTrigger value="manual">URL Manuale</TabsTrigger>
              </TabsList>

              <TabsContent value="search" className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    value={youtubeSearchQuery}
                    onChange={(e) => setYoutubeSearchQuery(e.target.value)}
                    placeholder="Cerca video karaoke..."
                    className="bg-zinc-800 border-zinc-700"
                    onKeyPress={(e) => e.key === 'Enter' && searchYouTube()}
                  />
                  <Button onClick={searchYouTube} disabled={searchingYoutube}>
                    <Search className="w-4 h-4" />
                  </Button>
                </div>

                {youtubeSearchResults.length > 0 && (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {youtubeSearchResults.map(video => (
                      <div 
                        key={video.id.videoId}
                        onClick={() => selectYouTubeVideo(video.id.videoId)}
                        className="glass rounded-lg p-3 flex gap-3 cursor-pointer hover:bg-white/10 transition"
                      >
                        <img 
                          src={video.snippet.thumbnails.default.url} 
                          alt={video.snippet.title}
                          className="w-24 h-18 rounded object-cover"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{video.snippet.title}</p>
                          <p className="text-sm text-zinc-500">{video.snippet.channelTitle}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="manual">
                <Input
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="bg-zinc-800 border-zinc-700"
                />
              </TabsContent>
            </Tabs>

            <Button 
              onClick={startPerformance}
              disabled={!youtubeUrl.trim()}
              className="w-full bg-green-500 hover:bg-green-600"
              size="lg"
            >
              <Play className="w-5 h-5 mr-2" /> Avvia Esibizione
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Quiz Modal */}
      <Dialog open={showQuizModal} onOpenChange={setShowQuizModal}>
        <DialogContent className="bg-zinc-900 border-zinc-800 max-w-2xl">
          <DialogHeader>
            <DialogTitle>Crea Quiz</DialogTitle>
          </DialogHeader>
          
          <Tabs value={quizTab} onValueChange={setQuizTab} className="mt-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="custom">Personalizzato</TabsTrigger>
              <TabsTrigger value="category">Da Categoria</TabsTrigger>
            </TabsList>

            <TabsContent value="custom" className="space-y-4 mt-4">
              <form onSubmit={handleStartQuiz} className="space-y-4">
                <div>
                  <label className="text-sm text-zinc-400 mb-2 block">Domanda</label>
                  <Textarea
                    value={quizQuestion}
                    onChange={(e) => setQuizQuestion(e.target.value)}
                    placeholder="Scrivi la domanda..."
                    className="bg-zinc-800 border-zinc-700 min-h-20"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm text-zinc-400">Opzioni di Risposta</label>
                  {quizOptions.map((option, idx) => (
                    <div key={idx} className="flex gap-2">
                      <Input
                        value={option}
                        onChange={(e) => {
                          const newOptions = [...quizOptions];
                          newOptions[idx] = e.target.value;
                          setQuizOptions(newOptions);
                        }}
                        placeholder={`Opzione ${idx + 1}`}
                        className="bg-zinc-800 border-zinc-700 flex-1"
                      />
                      <Button
                        type="button"
                        onClick={() => setQuizCorrectIndex(idx)}
                        variant={quizCorrectIndex === idx ? "default" : "outline"}
                        className={quizCorrectIndex === idx ? "bg-green-500" : ""}
                      >
                        {quizCorrectIndex === idx ? <Check className="w-4 h-4" /> : <span className="w-4 h-4" />}
                      </Button>
                    </div>
                  ))}
                </div>

                <Button type="submit" className="w-full bg-fuchsia-500 hover:bg-fuchsia-600" size="lg">
                  <HelpCircle className="w-5 h-5 mr-2" /> Lancia Quiz
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="category" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-3">
                {QUIZ_CATEGORIES.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setQuizCategory(cat.id)}
                    className={`p-4 rounded-xl border transition ${
                      quizCategory === cat.id
                        ? 'border-fuchsia-500 bg-fuchsia-500/20'
                        : 'border-zinc-700 hover:border-zinc-600'
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
              <Button 
                onClick={handleStartQuiz}
                className="w-full bg-fuchsia-500 hover:bg-fuchsia-600"
                size="lg"
              >
                <HelpCircle className="w-5 h-5 mr-2" /> Genera Quiz Random
              </Button>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Effects Modal */}
      <Dialog open={showEffectModal} onOpenChange={setShowEffectModal}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle>Invia Effetto</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-4 gap-3 mt-4">
            {EFFECT_EMOJIS.map(emoji => (
              <button
                key={emoji}
                onClick={() => handleSendEffect(emoji)}
                className="aspect-square rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-4xl transition"
              >
                {emoji}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}