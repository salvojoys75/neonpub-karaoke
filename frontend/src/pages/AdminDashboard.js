import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Music, Play, Square, Trophy, Tv, Star, HelpCircle,
  Check, X, MessageSquare, LogOut, SkipForward, Pause,
  RotateCcw, Mic2, Search, Send, Coins, Users, Plus, ArrowLeft
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"; // Aggiunto per la UI Admin
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase"; // Aggiunto per gestione crediti
import api, { createPub } from "@/lib/api"; // Aggiunto createPub

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
  const { isAuthenticated, logout, user } = useAuth();
  
  // Stati per Utente Finale (Giocatore)
  const [roomCode, setRoomCode] = useState("");

  // Stati per Admin/Operatore
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authTab, setAuthTab] = useState("login"); // 'login' o 'register' se serve in futuro
  const [loading, setLoading] = useState(false);

  // Admin Login Inputs
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");

  // Create Pub (Gestito post-login o se admin loggato)
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPubName, setNewPubName] = useState("");

  // --- LOGICA UTENTE FINALE ---
  const handleJoin = (e) => {
    e.preventDefault();
    if (!roomCode.trim()) {
      toast.error("Inserisci il codice della stanza");
      return;
    }
    // Naviga alla pagina di redirect che gestisce l'ingresso
    navigate(`/join/${roomCode.toUpperCase()}`);
  };

  // --- LOGICA OPERATORE / ADMIN ---
  const handleAdminLogin = async (e) => {
    e.preventDefault();
    if (!adminEmail.trim() || !adminPassword.trim()) {
      toast.error("Inserisci email e password");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: adminEmail,
        password: adminPassword
      });

      if (error) throw error;

      toast.success("Bentornato!");
      setShowAuthModal(false);
      // Una volta loggato, mandalo alla dashboard di regia
      navigate("/admin");
    } catch (error) {
      toast.error(error.message || "Credenziali non valide");
    } finally {
      setLoading(false);
    }
  };

  // Manteniamo la logica di creazione pub, ma idealmente andrebbe spostata dentro la AdminDashboard
  const handleCreatePub = async (e) => {
    e.preventDefault();
    if (!newPubName.trim()) {
      toast.error("Inserisci nome pub");
      return;
    }

    setLoading(true);
    try {
      const { data } = await createPub({ name: newPubName });
      toast.success(`Evento "${data.name}" creato!`);
      setShowCreateModal(false);
      localStorage.setItem("neonpub_pub_code", data.code);
      navigate(`/admin`);
    } catch (error) {
      if (error.message === 'No credits available') {
        toast.error("Nessun gettone disponibile");
      } else if (error.message === 'Not authenticated') {
        toast.error("Devi fare login prima");
        setShowCreateModal(false);
        setShowAuthModal(true);
      } else {
        toast.error("Errore nella creazione");
      }
    } finally {
      setLoading(false);
    }
  };

  // --- STATI TUA DASHBOARD ORIGINALE ---
  const [queue, setQueue] = useState([]);
  const [currentPerformance, setCurrentPerformance] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  
  const [activeQuiz, setActiveQuiz] = useState(null);
  const [quizResult, setQuizResult] = useState(null);
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [quizAnswer, setQuizAnswer] = useState(null);
  
  const [floatingReactions, setFloatingReactions] = useState([]);
  const [remainingReactions, setRemainingReactions] = useState(REACTION_LIMIT);
  
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [songTitle, setSongTitle] = useState("");
  const [songArtist, setSongArtist] = useState("");
  const [songYoutubeUrl, setSongYoutubeUrl] = useState("");
  
  const [showVoteModal, setShowVoteModal] = useState(false);
  const [selectedStars, setSelectedStars] = useState(0);
  const [hasVoted, setHasVoted] = useState(false);

  const [showMessageModal, setShowMessageModal] = useState(false);
  const [messageText, setMessageText] = useState("");

  const pollIntervalRef = useRef(null);

  useEffect(() => {
    if (!isAuthenticated) navigate("/");
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
      setLeaderboard(lbRes.data || []);
      
      const newPerf = perfRes.data;
      setCurrentPerformance(prev => {
        if ((!prev && newPerf) || (prev && newPerf && prev.id !== newPerf.id)) {
          setRemainingReactions(REACTION_LIMIT);
          setHasVoted(false);
          setSelectedStars(0);
          return newPerf;
        } 
        if (prev && !newPerf) {
          setHasVoted(false);
          setSelectedStars(0);
          setRemainingReactions(REACTION_LIMIT);
          return null;
        }
        if (newPerf && newPerf.status === 'voting' && prev?.status !== 'voting' && newPerf.participant_id !== user?.user?.id && !hasVoted) {
             setShowVoteModal(true);
             toast.info("⭐ Votazione aperta! Vota ora!");
        }
        return newPerf;
      });
      
      const serverQuiz = quizRes.data;
      if (serverQuiz) {
         if (serverQuiz.status === 'active' || serverQuiz.status === 'closed') {
             setActiveQuiz(prev => {
                 if (!prev || prev.id !== serverQuiz.id) {
                     setQuizAnswer(null); setQuizResult(null); setShowQuizModal(true);
                 }
                 return serverQuiz;
             });
         } else if (serverQuiz.status === 'showing_results') {
             if (!quizResult) {
                 const res = await api.getQuizResults(serverQuiz.id);
                 setQuizResult(res.data);
                 setShowQuizModal(true);
             }
         }
      } else {
         if (activeQuiz && !quizResult) { setShowQuizModal(false); setActiveQuiz(null); }
      }
    } catch (error) { console.error(error); }
  }, [user?.id, hasVoted, activeQuiz, quizResult]);

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
      pollIntervalRef.current = setInterval(loadData, 5000);
      const channel = supabase
        .channel('client_realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'performances', filter: `event_id=eq.${user?.event_id}` }, 
            (payload) => {
                const newPerf = payload.new;
                if (newPerf.status === 'voting') { loadData(); } else { setCurrentPerformance(newPerf); }
            }
        )
        .on('postgres_changes', { event: '*', schema: 'public', table: 'quizzes', filter: `event_id=eq.${user?.event_id}` }, 
            async (payload) => {
                if (payload.new.status === 'active') {
                    setQuizAnswer(null); setQuizResult(null); setActiveQuiz(payload.new); setShowQuizModal(true);
                    toast.info("🎯 Quiz Iniziato!");
                } 
                else if (payload.new.status === 'closed') {
                    setActiveQuiz(payload.new); toast.info("Tempo scaduto!");
                }
                else if (payload.new.status === 'showing_results') {
                    const res = await api.getQuizResults(payload.new.id);
                    setQuizResult(res.data); setShowQuizModal(true);
                }
                else if (payload.new.status === 'ended') {
                    setShowQuizModal(false); setActiveQuiz(null); setQuizResult(null);
                }
            }
        )
        .on('postgres_changes', { event: '*', schema: 'public', table: 'song_requests', filter: `event_id=eq.${user?.event_id}` }, loadData)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'quiz_answers', filter: `event_id=eq.${user?.event_id}` }, loadData)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'participants', filter: `event_id=eq.${user?.event_id}` }, loadData)
        .subscribe();

      return () => {
        clearInterval(pollIntervalRef.current);
        supabase.removeChannel(channel);
      };
    }
  }, [isAuthenticated, loadData, navigate, user?.event_id]);

  const handleRequestSong = async (e) => {
    e.preventDefault();
    if (!songTitle.trim()) {
      toast.error("Inserisci il titolo");
      return;
    }
    try {
      await api.requestSong({ title: songTitle, artist: songArtist, youtube_url: songYoutubeUrl });
      toast.success("Richiesta inviata!");
      setShowRequestModal(false);
      setSongTitle(""); setSongArtist(""); setSongYoutubeUrl("");
      loadData();
    } catch (error) {
      toast.error(error.message || "Errore nell'invio");
    }
  };

  const handleVote = async () => {
    if (selectedStars === 0 || !currentPerformance) return;
    try {
      await api.submitVote({ performance_id: currentPerformance.id, score: selectedStars });
      toast.success(`Voto ${selectedStars} stelle inviato!`);
      setShowVoteModal(false);
      setHasVoted(true);
    } catch (error) {
      toast.error("Errore nel voto");
    }
  };

  const handleSendReaction = async (emoji) => {
    if (remainingReactions <= 0 || !currentPerformance) return;
    try {
      await api.sendReaction({ performance_id: currentPerformance.id, emoji });
      setRemainingReactions(prev => prev - 1);
      const id = Date.now();
      setFloatingReactions(prev => [...prev, { id, emoji, left: Math.random() * 80 + 10 }]);
      setTimeout(() => setFloatingReactions(prev => prev.filter(r => r.id !== id)), 4000);
    } catch (error) {
      toast.error("Errore reazione");
    }
  };

  const handleSendMessage = async () => {
    if (!messageText.trim()) return;
    try {
      await api.sendMessage({ text: messageText });
      toast.success("Messaggio inviato!");
      setMessageText("");
      setShowMessageModal(false);
    } catch (error) {
      toast.error("Errore messaggio");
    }
  };

  const handleQuizAnswer = async (index) => {
    if (!activeQuiz || quizAnswer !== null) return;
    setQuizAnswer(index);
    try {
      const res = await api.answerQuiz({ quiz_id: activeQuiz.id, answer_index: index });
      if (res.data.points_earned > 0) toast.success(`Risposta corretta! +${res.data.points_earned} punti!`);
      else toast.error("Risposta sbagliata!");
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  if (loading) return <div>Caricamento...</div>;

  return (
    <div className="min-h-screen bg-[#050505] text-white p-6">
      <header className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">{user?.pub_name}</h1>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setShowMessageModal(true)}><MessageSquare className="mr-2" /> Messaggio</Button>
          <Button variant="ghost" onClick={handleLogout}><LogOut className="mr-2" /> Esci</Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto">
        {/* Current Performance */}
        {currentPerformance ? (
          <div className="glass rounded-2xl p-6 mb-6 relative overflow-hidden">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-2xl font-bold mb-1">{currentPerformance.title}</h2>
                <p className="text-zinc-400">{currentPerformance.artist}</p>
                <p className="text-sm text-cyan-400 mt-2">Da: {currentPerformance.user_nickname}</p>
              </div>
              {currentPerformance.status === 'voting' && !hasVoted && currentPerformance.participant_id !== user.id && (
                <Button onClick={() => setShowVoteModal(true)} className="bg-yellow-500 text-black">Vota Ora!</Button>
              )}
            </div>
            {currentPerformance.status === 'voting' && hasVoted && (
              <p className="text-center text-yellow-400 font-bold">Votazione in corso...</p>
            )}
            <div className="flex justify-center gap-2 mt-4">
              {EMOJIS.map(emoji => (
                <button key={emoji} onClick={() => handleSendReaction(emoji)} disabled={remainingReactions <= 0} className={`text-3xl transition ${remainingReactions <= 0 ? 'opacity-50' : 'hover:scale-125'}`}>{emoji}</button>
              ))}
            </div>
            <p className="text-center text-sm text-zinc-500 mt-2">Reazioni rimaste: {remainingReactions}</p>
            {floatingReactions.map(r => (
              <div key={r.id} className="absolute animate-float-up text-5xl" style={{ left: `${r.left}%`, bottom: '-50px' }}>{r.emoji}</div>
            ))}
          </div>
        ) : (
          <div className="glass rounded-2xl p-6 mb-6 text-center">
            <Mic2 className="w-16 h-16 mx-auto text-fuchsia-400 mb-4" />
            <p className="text-zinc-400">Nessuna esibizione in corso</p>
          </div>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
          <TabsList className="grid w-full grid-cols-4 bg-zinc-900 rounded-full p-1">
            <TabsTrigger value="home" className="rounded-full">Home</TabsTrigger>
            <TabsTrigger value="queue" className="rounded-full">Coda</TabsTrigger>
            <TabsTrigger value="leaderboard" className="rounded-full">Classifica</TabsTrigger>
            <TabsTrigger value="profile" className="rounded-full">Profilo</TabsTrigger>
          </TabsList>
          <TabsContent value="home" className="mt-6">
            <Button onClick={() => setShowRequestModal(true)} className="w-full bg-fuchsia-500 hover:bg-fuchsia-600 py-6 text-lg mb-6"><Music className="mr-2" /> Richiedi Canzone</Button>
            <h3 className="text-lg font-bold mb-4">Le tue Richieste</h3>
            <div className="space-y-3">
              {myRequests.map(req => (
                <div key={req.id} className="glass p-4 rounded-xl">
                  <div className="flex justify-between">
                    <div>
                      <p className="font-medium">{req.title}</p>
                      <p className="text-sm text-zinc-400">{req.artist}</p>
                    </div>
                    <span className={`text-sm px-3 py-1 rounded-full ${req.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' : req.status === 'queued' ? 'bg-blue-500/20 text-blue-400' : req.status === 'approved' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>{req.status}</span>
                  </div>
                </div>
              ))}
              {!myRequests.length && <p className="text-center text-zinc-500">Nessuna richiesta</p>}
            </div>
          </TabsContent>
          <TabsContent value="queue" className="mt-6">
            <h3 className="text-lg font-bold mb-4">Coda Canzoni</h3>
            <div className="space-y-3">
              {queue.map((req, idx) => (
                <div key={req.id} className="glass p-4 rounded-xl flex justify-between">
                  <div>
                    <p className="font-medium">{req.title}</p>
                    <p className="text-sm text-zinc-400">{req.artist}</p>
                    <p className="text-xs text-cyan-400 mt-1">Da: {req.user_nickname}</p>
                  </div>
                  <span className="text-lg font-bold text-zinc-500">#{idx + 1}</span>
                </div>
              ))}
              {!queue.length && <p className="text-center text-zinc-500">Coda vuota</p>}
            </div>
          </TabsContent>
          <TabsContent value="leaderboard" className="mt-6">
            <h3 className="text-lg font-bold mb-4">Classifica</h3>
            <div className="space-y-3">
              {leaderboard.map((player, idx) => (
                <div key={player.id} className="glass p-4 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`text-lg font-bold ${idx === 0 ? 'text-yellow-400' : idx === 1 ? 'text-zinc-400' : idx === 2 ? 'text-amber-600' : 'text-zinc-500'}`}>#{idx + 1}</span>
                    <p>{player.nickname}</p>
                  </div>
                  <p className="font-bold">{player.score} pt</p>
                </div>
              ))}
              {!leaderboard.length && <p className="text-center text-zinc-500">Classifica vuota</p>}
            </div>
          </TabsContent>
          <TabsContent value="profile" className="mt-6">
            <div className="glass rounded-2xl p-6 text-center">
              <div className="w-24 h-24 rounded-full bg-fuchsia-500/20 flex items-center justify-center mx-auto mb-4">
                <User className="w-12 h-12 text-fuchsia-400" />
              </div>
              <h2 className="text-2xl font-bold mb-2">{user.nickname}</h2>
              <p className="text-zinc-400 mb-4">Punteggio: {leaderboard.find(p => p.id === user.id)?.score || 0} pt</p>
              <Button variant="destructive" onClick={handleLogout} className="w-full">Esci</Button>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-zinc-900/80 backdrop-blur-md border-t border-zinc-800 px-6 py-3">
        <div className="flex justify-around max-w-md mx-auto">
          {[{ id: "home", icon: Home, label: "Home" }, { id: "queue", icon: Music, label: "Coda" }, { id: "leaderboard", icon: Trophy, label: "Classifica" }, { id: "profile", icon: User, label: "Profilo" }].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex flex-col items-center gap-1 p-2 rounded-lg transition ${activeTab === tab.id ? 'text-fuchsia-500' : 'text-zinc-500'}`}><tab.icon className="w-6 h-6" /><span className="text-[10px]">{tab.label}</span></button>
          ))}
        </div>
      </nav>
      <Dialog open={showRequestModal} onOpenChange={setShowRequestModal}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader><DialogTitle>Richiedi Canzone</DialogTitle></DialogHeader>
          <form onSubmit={handleRequestSong} className="space-y-4 mt-4">
            <Input value={songTitle} onChange={(e) => setSongTitle(e.target.value)} placeholder="Titolo" className="bg-zinc-800 border-zinc-700"/>
            <Input value={songArtist} onChange={(e) => setSongArtist(e.target.value)} placeholder="Artista" className="bg-zinc-800 border-zinc-700"/>
            <Input value={songYoutubeUrl} onChange={(e) => setSongYoutubeUrl(e.target.value)} placeholder="Link YouTube (facoltativo)" className="bg-zinc-800 border-zinc-700"/>
            <Button type="submit" className="w-full bg-fuchsia-600 hover:bg-fuchsia-700">Invia</Button>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={showVoteModal} onOpenChange={setShowVoteModal}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-center">
          <DialogHeader><DialogTitle>Vota l'Esibizione!</DialogTitle></DialogHeader>
          <div className="flex justify-center gap-2 py-4">
            {[1, 2, 3, 4, 5].map(star => (<button key={star} onClick={() => setSelectedStars(star)}><Star className={`w-10 h-10 ${selectedStars >= star ? 'text-yellow-500 fill-yellow-500' : 'text-zinc-600'}`} /></button>))}
          </div>
          <Button onClick={handleVote} disabled={selectedStars === 0} className="w-full bg-yellow-500 text-black">Conferma Voto</Button>
        </DialogContent>
      </Dialog>
      <Dialog open={showMessageModal} onOpenChange={setShowMessageModal}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader><DialogTitle>Messaggio al Pub</DialogTitle></DialogHeader>
          <Input value={messageText} onChange={(e) => setMessageText(e.target.value)} placeholder="Scrivi messaggio..." className="bg-zinc-800 border-zinc-700"/>
          <Button onClick={handleSendMessage} className="w-full mt-4 bg-cyan-600 hover:bg-cyan-700">Invia</Button>
        </DialogContent>
      </Dialog>
      <Dialog open={showQuizModal} onOpenChange={setShowQuizModal}>
        <DialogContent className="bg-zinc-900 border-fuchsia-500/30 max-w-md w-[90%] rounded-2xl">
          <DialogHeader><DialogTitle className="text-center text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-fuchsia-400 to-purple-600">{activeQuiz?.status === 'closed' ? "STOP AL VOTO!" : quizResult ? "Risultato" : "Quiz Time!"}</DialogTitle></DialogHeader>
          {!quizResult && activeQuiz && (
            <div className="py-4">
              <p className="text-xl text-center mb-6 font-medium text-white">{activeQuiz.question}</p>
              {activeQuiz.status === 'closed' ? (
                 <div className="text-center p-6 bg-white/5 rounded-xl border border-white/10 animate-pulse"><Lock className="w-12 h-12 mx-auto text-red-500 mb-2" /><p className="text-lg font-bold text-red-400">Tempo Scaduto</p><p className="text-sm text-zinc-500">Attendi i risultati...</p></div>
              ) : (
                 <div className="space-y-3">
                   {activeQuiz.options.map((option, index) => (
                     <button key={index} onClick={() => handleQuizAnswer(index)} disabled={quizAnswer !== null} className={`w-full p-4 rounded-xl border text-left transition-all active:scale-95 flex items-center ${quizAnswer === index ? 'bg-fuchsia-600 border-fuchsia-500 text-white shadow-[0_0_15px_rgba(192,38,211,0.5)]' : 'border-white/10 bg-white/5 hover:bg-white/10 text-zinc-200'}`}><span className={`font-bold mr-3 w-6 h-6 flex items-center justify-center rounded-full text-xs ${quizAnswer === index ? 'bg-white text-fuchsia-600' : 'bg-zinc-700 text-zinc-300'}`}>{String.fromCharCode(65 + index)}</span><span className="flex-1">{option}</span>{quizAnswer === index && <Check className="w-5 h-5 ml-2" />}</button>
                   ))}
                 </div>
              )}
            </div>
          )}
          {quizResult && (
            <div className="text-center py-6 animate-zoom-in">
              <Trophy className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
              <p className="text-sm text-zinc-400 uppercase tracking-widest mb-1">Risposta Corretta</p>
              <div className="bg-green-500/20 border border-green-500 p-4 rounded-xl mb-6"><p className="text-2xl font-bold text-white">{quizResult.correct_option}</p></div>
              <p className="text-zinc-500 text-sm">{quizResult.total_answers} persone hanno partecipato</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}