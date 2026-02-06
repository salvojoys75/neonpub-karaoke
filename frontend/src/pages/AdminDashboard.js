import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { 
  Music, Play, Square, Trophy, Tv, Star,
  Check, X, LogOut, SkipForward, Pause, RotateCcw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { isAuthenticated, isAdmin, logout } = useAuth();
  
  const [queue, setQueue] = useState([]);
  const [currentPerformance, setCurrentPerformance] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [activeSection, setActiveSection] = useState("queue");
  
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [quizQuestion, setQuizQuestion] = useState("");
  const [quizOptions, setQuizOptions] = useState(["", "", "", ""]);
  const [quizCorrectIndex, setQuizCorrectIndex] = useState(0);
  const [activeQuizId, setActiveQuizId] = useState(null);

  const [showYoutubeModal, setShowYoutubeModal] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [selectedRequest, setSelectedRequest] = useState(null);

  const pubCode = localStorage.getItem("neonpub_pub_code");

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
      const [queueRes, perfRes, lbRes] = await Promise.all([
        api.getAdminQueue(),
        api.getAdminCurrentPerformance(),
        api.getAdminLeaderboard(),
      ]);
      
      setQueue(queueRes.data || []);
      setCurrentPerformance(perfRes.data);
      setLeaderboard(lbRes.data || []);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Errore caricamento dati");
    }
  }, [pubCode]);

  useEffect(() => {
    if (isAuthenticated && isAdmin && pubCode) {
      loadData();
      const interval = setInterval(loadData, 3000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, isAdmin, pubCode, loadData]);

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
    if (request.youtube_url) {
      startPerformance(request.id, request.youtube_url);
    } else {
      setSelectedRequest(request);
      setYoutubeUrl("");
      setShowYoutubeModal(true);
    }
  };

  const startPerformance = async (requestId, url) => {
    try {
      await api.startPerformance(requestId, url);
      toast.success("Esibizione iniziata!");
      setShowYoutubeModal(false);
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
    try {
      await api.skipPerformance(currentPerformance.id);
      toast.info("Esibizione saltata");
      loadData();
    } catch (error) {
      toast.error("Errore skip");
    }
  };

  const handleStartQuiz = async (e) => {
    e.preventDefault();
    if (!quizQuestion.trim() || quizOptions.some(o => !o.trim())) {
      toast.error("Compila tutti i campi");
      return;
    }

    try {
      const { data } = await api.startQuiz({
        question: quizQuestion,
        options: quizOptions,
        correct_index: quizCorrectIndex,
        points: 10
      });
      
      setActiveQuizId(data.id);
      toast.success("Quiz lanciato!");
      setShowQuizModal(false);
    } catch (error) {
      toast.error("Errore lancio quiz");
    }
  };

  const handleEndQuiz = async () => {
    if (!activeQuizId) return;
    try {
      await api.endQuiz(activeQuizId);
      toast.success("Quiz terminato!");
      setActiveQuizId(null);
      setQuizQuestion("");
      setQuizOptions(["", "", "", ""]);
      setQuizCorrectIndex(0);
      loadData();
    } catch (error) {
      toast.error("Errore fine quiz");
    }
  };

  const handleOpenDisplay = () => {
    window.open(`/display/${pubCode}`, '_blank');
  };

  const handleLogout = () => {
    localStorage.removeItem("neonpub_pub_code");
    logout();
    navigate("/");
  };

  const pendingRequests = queue.filter(r => r.status === "pending");
  const queuedRequests = queue.filter(r => r.status === "queued");

  return (
    <div className="min-h-screen bg-[#050505] p-6">
      {/* Header */}
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Regia Admin</h1>
          <p className="text-zinc-500">Codice: <span className="mono text-cyan-400">{pubCode}</span></p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleOpenDisplay} variant="outline">
            <Tv className="w-4 h-4 mr-2" /> Apri Display
          </Button>
          <Button onClick={handleLogout} variant="ghost">
            <LogOut className="w-4 h-4 mr-2" /> Esci
          </Button>
        </div>
      </header>

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
                <span className="text-sm font-medium uppercase">{currentPerformance.status}</span>
              </div>
              <h2 className="text-2xl font-bold">{currentPerformance.song_title}</h2>
              <p className="text-zinc-400">{currentPerformance.song_artist}</p>
              <p className="text-fuchsia-400 mt-1">🎤 {currentPerformance.user_nickname}</p>
            </div>
            
            {currentPerformance.vote_count > 0 && (
              <div className="text-right">
                <div className="flex items-center gap-2">
                  <Star className="w-6 h-6 text-yellow-500 fill-yellow-500" />
                  <span className="text-3xl font-bold">{(currentPerformance.average_score || 0).toFixed(1)}</span>
                </div>
                <p className="text-zinc-500 text-sm">{currentPerformance.vote_count} voti</p>
              </div>
            )}
          </div>

          <div className="flex gap-2 flex-wrap">
            {currentPerformance.status === 'live' && (
              <>
                <Button onClick={handlePause} variant="outline" size="sm">
                  <Pause className="w-4 h-4 mr-2" /> Pausa
                </Button>
                <Button onClick={handleEndPerformance} className="bg-green-500 hover:bg-green-600" size="sm">
                  <Square className="w-4 h-4 mr-2" /> Fine → Vota
                </Button>
                <Button onClick={handleSkip} variant="destructive" size="sm">
                  <SkipForward className="w-4 h-4 mr-2" /> Skip
                </Button>
              </>
            )}
            
            {currentPerformance.status === 'paused' && (
              <Button onClick={handleResume} className="bg-green-500 hover:bg-green-600" size="sm">
                <Play className="w-4 h-4 mr-2" /> Riprendi
              </Button>
            )}
            
            {currentPerformance.status === 'voting' && (
              <Button onClick={handleCloseVoting} className="bg-yellow-500 hover:bg-yellow-600 text-black" size="sm">
                <Check className="w-4 h-4 mr-2" /> Chiudi Votazione
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeSection} onValueChange={setActiveSection}>
        <TabsList className="grid w-full grid-cols-3 bg-zinc-900">
          <TabsTrigger value="queue">
            Coda ({queuedRequests.length})
          </TabsTrigger>
          <TabsTrigger value="pending">
            Richieste ({pendingRequests.length})
          </TabsTrigger>
          <TabsTrigger value="leaderboard">
            Classifica
          </TabsTrigger>
        </TabsList>

        {/* Queue */}
        <TabsContent value="queue" className="space-y-4 mt-6">
          {queuedRequests.length === 0 ? (
            <p className="text-center text-zinc-500 py-12">Nessuna canzone in coda</p>
          ) : (
            queuedRequests.map((request, index) => (
              <div key={request.id} className="glass rounded-xl p-4 flex items-center gap-4">
                <span className="text-2xl font-bold text-fuchsia-400 w-8">{index + 1}</span>
                <div className="flex-1">
                  <p className="font-medium">{request.title}</p>
                  <p className="text-sm text-zinc-500">{request.artist}</p>
                  <p className="text-xs text-cyan-400 mt-1">{request.user_nickname}</p>
                </div>
                <Button 
                  onClick={() => handleStartLive(request)}
                  disabled={currentPerformance !== null}
                  className="bg-green-500 hover:bg-green-600"
                >
                  <Play className="w-4 h-4 mr-2" /> Start
                </Button>
              </div>
            ))
          )}
        </TabsContent>

        {/* Pending */}
        <TabsContent value="pending" className="space-y-4 mt-6">
          {pendingRequests.length === 0 ? (
            <p className="text-center text-zinc-500 py-12">Nessuna richiesta da approvare</p>
          ) : (
            pendingRequests.map((request) => (
              <div key={request.id} className="glass rounded-xl p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="font-medium">{request.title}</p>
                    <p className="text-sm text-zinc-500">{request.artist}</p>
                    <p className="text-xs text-cyan-400 mt-1">{request.user_nickname}</p>
                    {request.youtube_url && (
                      <a href={request.youtube_url} target="_blank" rel="noopener noreferrer" 
                         className="text-xs text-blue-400 hover:underline mt-1 block">
                        🎬 Video suggerito
                      </a>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button 
                    onClick={() => handleApprove(request.id)}
                    className="flex-1 bg-green-500 hover:bg-green-600"
                    size="sm"
                  >
                    <Check className="w-4 h-4 mr-2" /> Approva
                  </Button>
                  <Button 
                    onClick={() => handleReject(request.id)}
                    variant="destructive"
                    className="flex-1"
                    size="sm"
                  >
                    <X className="w-4 h-4 mr-2" /> Rifiuta
                  </Button>
                </div>
              </div>
            ))
          )}
        </TabsContent>

        {/* Leaderboard */}
        <TabsContent value="leaderboard" className="space-y-4 mt-6">
          {leaderboard.length === 0 ? (
            <p className="text-center text-zinc-500 py-12">Nessun punteggio</p>
          ) : (
            leaderboard.map((player, index) => (
              <div key={player.id} className="glass rounded-xl p-4 flex items-center gap-4">
                <span className={`text-2xl font-bold w-8 ${
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
        </TabsContent>
      </Tabs>

      {/* Quiz Button */}
      <div className="fixed bottom-6 right-6 flex gap-3">
        {activeQuizId && (
          <Button 
            onClick={handleEndQuiz}
            className="bg-red-500 hover:bg-red-600 rounded-full shadow-lg"
            size="lg"
          >
            <Trophy className="w-5 h-5 mr-2" /> Termina Quiz
          </Button>
        )}
        <Button 
          onClick={() => setShowQuizModal(true)}
          disabled={activeQuizId !== null}
          className="bg-fuchsia-500 hover:bg-fuchsia-600 rounded-full shadow-lg"
          size="lg"
        >
          <Trophy className="w-5 h-5 mr-2" /> Lancia Quiz
        </Button>
      </div>

      {/* YouTube Modal */}
      <Dialog open={showYoutubeModal} onOpenChange={setShowYoutubeModal}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle>Inserisci URL YouTube</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <p className="text-sm text-zinc-400">
              {selectedRequest?.title} - {selectedRequest?.artist}
            </p>
            <Input
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              className="bg-zinc-800 border-zinc-700"
            />
            <Button 
              onClick={() => startPerformance(selectedRequest?.id, youtubeUrl)}
              disabled={!youtubeUrl.trim()}
              className="w-full bg-green-500 hover:bg-green-600"
            >
              <Play className="w-4 h-4 mr-2" /> Avvia Esibizione
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
          <form onSubmit={handleStartQuiz} className="space-y-4 mt-4">
            <div>
              <label className="text-sm text-zinc-400">Domanda</label>
              <Input
                value={quizQuestion}
                onChange={(e) => setQuizQuestion(e.target.value)}
                placeholder="Qual è la canzone più famosa di...?"
                className="bg-zinc-800 border-zinc-700"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm text-zinc-400">Opzioni</label>
              {quizOptions.map((option, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={option}
                    onChange={(e) => {
                      const newOptions = [...quizOptions];
                      newOptions[index] = e.target.value;
                      setQuizOptions(newOptions);
                    }}
                    placeholder={`Opzione ${index + 1}`}
                    className="bg-zinc-800 border-zinc-700"
                  />
                  <Button
                    type="button"
                    onClick={() => setQuizCorrectIndex(index)}
                    variant={quizCorrectIndex === index ? "default" : "outline"}
                    size="sm"
                  >
                    <Check className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>

            <Button 
              type="submit"
              className="w-full bg-fuchsia-500 hover:bg-fuchsia-600"
            >
              <Trophy className="w-4 h-4 mr-2" /> Lancia Quiz
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}