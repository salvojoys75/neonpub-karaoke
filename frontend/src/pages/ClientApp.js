import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Home, Music, Trophy, User, Star, MessageSquare, RefreshCw, Mic2, Check, Lock, X, Eye, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase"; 
import api from "@/lib/api";

const EMOJIS = ["❤️", "🔥", "👏", "🎤", "⭐", "🎉"];
const REACTION_LIMIT = 5;

export default function ClientApp() {
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuth();
  
  const [activeTab, setActiveTab] = useState("home");
  
  // Dati
  const [queue, setQueue] = useState([]);
  const [myRequests, setMyRequests] = useState([]);
  const [currentPerformance, setCurrentPerformance] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  
  // Quiz
  const [activeQuiz, setActiveQuiz] = useState(null);
  const [quizResult, setQuizResult] = useState(null);
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [quizAnswer, setQuizAnswer] = useState(null);
  const [pointsEarned, setPointsEarned] = useState(0);

  // Interazioni
  const [floatingReactions, setFloatingReactions] = useState([]);
  const [remainingReactions, setRemainingReactions] = useState(REACTION_LIMIT);
  
  // Modali Input
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

  useEffect(() => { if (!isAuthenticated) navigate("/"); }, [isAuthenticated, navigate]);

  // Funzione per resettare completamente il quiz
  const closeQuiz = useCallback(() => {
    setShowQuizModal(false);
    setActiveQuiz(null);
    setQuizResult(null);
    setQuizAnswer(null);
    setPointsEarned(0);
  }, []);

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
      
      // Gestione Performance
      const newPerf = perfRes.data;
      setCurrentPerformance(prev => {
        // Reset voti se cambia canzone
        if ((!prev && newPerf) || (prev && newPerf && prev.id !== newPerf.id)) {
          setRemainingReactions(REACTION_LIMIT); 
          setHasVoted(false); 
          setSelectedStars(0); 
          return newPerf;
        } 
        // Se la performance finisce
        if (prev && !newPerf) { 
          setHasVoted(false); 
          setSelectedStars(0); 
          setRemainingReactions(REACTION_LIMIT); 
          return null; 
        }
        // Se si apre il voto
        if (newPerf && newPerf.status === 'voting' && prev?.status !== 'voting' && newPerf.participant_id !== user?.user?.id && !hasVoted) { 
          setShowVoteModal(true); 
          toast.info("⭐ Votazione aperta! Vota ora!"); 
        }
        return newPerf;
      });
      
      // GESTIONE CRITICA QUIZ (FIX STUCK MODAL)
      const serverQuiz = quizRes.data;
      
      if (!serverQuiz) {
         // Se il server non restituisce quiz, CHIUDI TUTTO
         if (showQuizModal) closeQuiz();
      } else {
         // Se c'è un quiz, gestisci lo stato
         if (serverQuiz.status === 'active' || serverQuiz.status === 'closed') {
             setActiveQuiz(prev => { 
                 if (!prev || prev.id !== serverQuiz.id) { 
                     // Nuovo quiz
                     setQuizAnswer(null); 
                     setQuizResult(null); 
                     setPointsEarned(0); 
                     setShowQuizModal(true); 
                 } 
                 return serverQuiz; 
             });
             if (!showQuizModal) setShowQuizModal(true);
         } 
         else if (serverQuiz.status === 'showing_results' || serverQuiz.status === 'leaderboard') {
             // Mostra risultati
             if (!quizResult) { 
                 const res = await api.getQuizResults(serverQuiz.id); 
                 setQuizResult(res.data); 
             }
             setActiveQuiz(serverQuiz); 
             if (!showQuizModal) setShowQuizModal(true);
         }
         else if (serverQuiz.status === 'ended') {
             closeQuiz();
         }
      }
    } catch (error) { console.error(error); }
  }, [user?.id, hasVoted, showQuizModal, quizResult, closeQuiz, user?.user?.id]);

  useEffect(() => {
    if (isAuthenticated) {
      loadData(); 
      pollIntervalRef.current = setInterval(loadData, 3000); // Polling più veloce (3s) per reattività

      const channel = supabase.channel('client_realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'performances', filter: `event_id=eq.${user?.event_id}` }, 
            (payload) => { 
                const newPerf = payload.new; 
                if (newPerf.status === 'voting') { loadData(); } 
                else { setCurrentPerformance(newPerf); } 
            }
        )
        .on('postgres_changes', { event: '*', schema: 'public', table: 'quizzes', filter: `event_id=eq.${user?.event_id}` }, 
            async (payload) => {
                const q = payload.new;
                
                // GESTIONE REALTIME QUIZ
                if (q.status === 'active') { 
                    setQuizAnswer(null); 
                    setQuizResult(null); 
                    setPointsEarned(0); 
                    setActiveQuiz(q); 
                    setShowQuizModal(true); 
                    toast.info("🎯 Quiz Iniziato!"); 
                } 
                else if (q.status === 'closed') { 
                    setActiveQuiz(prev => ({ ...prev, status: 'closed' })); 
                    toast.warning("🛑 Televoto Chiuso!"); 
                }
                else if (q.status === 'showing_results') { 
                    const res = await api.getQuizResults(q.id); 
                    setQuizResult(res.data); 
                    setActiveQuiz(q); 
                }
                else if (q.status === 'leaderboard') { 
                    setActiveQuiz(q); 
                    toast.info("🏆 Classifica sul maxischermo!"); 
                }
                else if (q.status === 'ended') { 
                    // FIX: Forza chiusura immediata
                    closeQuiz(); 
                    toast.info("Quiz terminato, si torna alla musica!");
                }
            }
        ).subscribe();
        
      return () => { 
          clearInterval(pollIntervalRef.current); 
          supabase.removeChannel(channel); 
      };
    }
  }, [isAuthenticated, loadData, user?.event_id, closeQuiz]);

  const addFloatingReaction = (emoji) => {
    const id = Date.now() + Math.random(); const left = Math.random() * 80 + 10;
    setFloatingReactions(prev => [...prev, { id, emoji, left }]); 
    setTimeout(() => setFloatingReactions(prev => prev.filter(r => r.id !== id)), 2000);
  };

  const handleRequestSong = async (e) => {
    e.preventDefault(); 
    if (!songTitle.trim() || !songArtist.trim()) { toast.error("Inserisci titolo e artista"); return; }
    try { 
        await api.requestSong({ title: songTitle, artist: songArtist, youtube_url: songYoutubeUrl || null }); 
        toast.success("Richiesta inviata!"); 
        setShowRequestModal(false); 
        setSongTitle(""); setSongArtist(""); setSongYoutubeUrl(""); 
        loadData(); 
    } catch (error) { toast.error("Errore invio"); }
  };

  const handleVote = async () => {
    if (selectedStars === 0 || !currentPerformance) return;
    try { 
        await api.submitVote({ performance_id: currentPerformance.id, score: selectedStars }); 
        toast.success(`Voto inviato!`); 
        setHasVoted(true); 
        setShowVoteModal(false); 
    } catch (error) { toast.error("Errore voto"); setShowVoteModal(false); }
  };

  const handleReaction = async (emoji) => {
    if (remainingReactions <= 0) { toast.error("Reazioni finite per questa canzone!"); return; }
    try { 
        await api.sendReaction({ emoji }); 
        addFloatingReaction(emoji); 
        setRemainingReactions(prev => prev - 1); 
    } catch (error) { toast.error("Errore reazione"); }
  };

  const handleSendMessage = async () => {
    if (!messageText.trim()) return;
    try { 
        await api.sendMessage({ text: messageText }); 
        toast.success("Messaggio inviato alla regia!"); 
        setShowMessageModal(false); 
        setMessageText(""); 
    } catch (error) { toast.error("Errore invio"); }
  };

  const handleQuizAnswer = async (index) => {
    if (quizAnswer !== null) return; 
    if (!activeQuiz || activeQuiz.status !== 'active') { toast.error("Tempo scaduto!"); return; }
    
    setQuizAnswer(index);
    try { 
        const { data } = await api.answerQuiz({ quiz_id: activeQuiz.id, answer_index: index }); 
        if (data.points_earned > 0) { 
            setPointsEarned(data.points_earned); 
            toast.success(`Hai guadagnato ${data.points_earned} punti!`); 
        } else { 
            setPointsEarned(0); 
        } 
    } catch (e) { toast.info("Risposta salvata."); }
  };

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-[#050505] flex flex-col pb-24 font-sans text-white select-none">
      
      {/* HEADER */}
      <header className="sticky top-0 z-40 bg-[#050505]/95 backdrop-blur-md p-4 flex justify-between items-center border-b border-white/5 shadow-md">
        <div>
            <h1 className="font-bold text-lg text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-500 to-cyan-500">{user?.pub_name || "NeonPub"}</h1>
            <p className="text-xs text-zinc-500 flex items-center gap-1"><User className="w-3 h-3"/> {user?.nickname}</p>
        </div>
        <div className="flex items-center gap-2">
            <Button onClick={() => { loadData(); toast.success("Aggiornato!"); }} variant="ghost" size="icon" className="text-zinc-400 h-8 w-8"><RefreshCw className="w-4 h-4" /></Button>
            <Button onClick={logout} variant="ghost" size="sm" className="text-zinc-400 h-8 text-xs">Esci</Button>
        </div>
      </header>

      {/* REACTIONS OVERLAY */}
      <div className="reactions-overlay pointer-events-none fixed inset-0 z-50 overflow-hidden">
          {floatingReactions.map(r => (
              <div key={r.id} className="absolute text-4xl animate-float-up" style={{ left: `${r.left}%`, bottom: '-50px' }}>{r.emoji}</div>
          ))}
      </div>

      <main className="flex-1 p-4 overflow-y-auto">
        {activeTab === "home" && (
          <div className="space-y-6 animate-fade-in">
            {/* PLAYER CARD */}
            {currentPerformance ? (
              <div className="relative overflow-hidden rounded-2xl p-5 border border-white/10 bg-gradient-to-br from-zinc-900 to-black shadow-2xl">
                <div className="absolute top-0 right-0 p-2 opacity-20"><Music className="w-24 h-24 text-fuchsia-500"/></div>
                
                <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-3">
                        <span className={`w-2 h-2 rounded-full ${currentPerformance.status === "live" ? "bg-red-500 animate-pulse shadow-[0_0_10px_red]" : "bg-yellow-500"}`}></span>
                        <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">{currentPerformance.status === 'live' ? 'ON STAGE' : currentPerformance.status}</span>
                    </div>
                    
                    <h2 className="text-2xl font-black text-white mb-1 leading-tight">{currentPerformance.song_title}</h2>
                    <p className="text-fuchsia-400 font-medium text-sm mb-4">{currentPerformance.song_artist}</p>
                    
                    <div className="flex items-center gap-2 bg-white/5 p-2 rounded-lg mb-4 border border-white/5">
                        <Mic2 className="w-4 h-4 text-cyan-400" />
                        <span className="text-zinc-200 text-sm font-bold">{currentPerformance.user_nickname}</span>
                    </div>

                    {currentPerformance.status === 'live' && (
                        <>
                            <div className="grid grid-cols-6 gap-2 mb-4">
                                {EMOJIS.map(emoji => (
                                    <button key={emoji} onClick={() => handleReaction(emoji)} className="aspect-square flex items-center justify-center bg-white/5 rounded-lg text-xl hover:bg-white/10 active:scale-90 transition-all border border-white/5">
                                        {emoji}
                                    </button>
                                ))}
                            </div>
                            <Button onClick={() => setShowMessageModal(true)} variant="outline" className="w-full border-zinc-700 hover:bg-zinc-800 text-xs h-9">
                                <MessageSquare className="w-3 h-3 mr-2" /> Messaggio allo schermo
                            </Button>
                        </>
                    )}

                    {currentPerformance.status === 'voting' && !hasVoted && (
                        <Button onClick={() => setShowVoteModal(true)} className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-bold animate-pulse shadow-[0_0_20px_rgba(234,179,8,0.4)]">
                            <Star className="w-4 h-4 mr-2" /> VOTA L'ESIBIZIONE
                        </Button>
                    )}
                </div>
              </div>
            ) : (
                <div className="rounded-2xl p-8 text-center border-2 border-dashed border-zinc-800 bg-zinc-900/50">
                    <Music className="w-12 h-12 mx-auto text-zinc-700 mb-2" />
                    <p className="text-zinc-500 font-medium">Il palco è vuoto</p>
                </div>
            )}

            {/* ACTION BUTTON */}
            <Button onClick={() => setShowRequestModal(true)} className="w-full rounded-xl bg-gradient-to-r from-fuchsia-700 to-purple-800 py-8 text-lg shadow-xl font-bold border-t border-white/20 hover:scale-[1.02] transition-transform">
                <Music className="w-6 h-6 mr-2" /> PRENOTA CANZONE
            </Button>

            {/* QUEUE LIST */}
            <div className="space-y-3 pt-2">
                <h3 className="font-bold text-sm text-zinc-500 uppercase tracking-wider flex items-center gap-2">
                    <Music className="w-4 h-4" /> Prossimi Cantanti
                </h3>
                {queue.filter(s => s.status === "queued").slice(0, 5).map((song, index) => (
                    <div key={song.id} className="bg-zinc-900/80 border border-white/5 rounded-xl p-3 flex items-center gap-4">
                        <span className="font-mono text-xl text-zinc-600 font-bold w-6 text-center">{index + 1}</span>
                        <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm text-white truncate">{song.title}</p>
                            <p className="text-xs text-zinc-500 truncate">{song.artist}</p>
                        </div>
                        <span className="text-[10px] bg-zinc-800 px-2 py-1 rounded text-zinc-400 font-medium">{song.user_nickname}</span>
                    </div>
                ))}
            </div>
          </div>
        )}

        {activeTab === "songs" && (
            <div className="space-y-4 animate-fade-in">
                <h2 className="text-xl font-bold text-white">Le Mie Richieste</h2>
                {myRequests.length === 0 ? <p className="text-zinc-500 text-center py-10">Nessuna richiesta.</p> : myRequests.map(song => (
                    <div key={song.id} className="bg-zinc-900 border border-white/5 rounded-xl p-4 relative overflow-hidden">
                        <div className={`absolute left-0 top-0 bottom-0 w-1 ${song.status === 'queued' ? 'bg-green-500' : 'bg-zinc-700'}`}></div>
                        <p className="font-bold text-white">{song.title}</p>
                        <div className="flex justify-between mt-1 items-center">
                            <p className="text-sm text-zinc-400">{song.artist}</p>
                            <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded ${song.status==='queued' ? 'bg-green-900/30 text-green-400' : 'bg-zinc-800 text-zinc-500'}`}>
                                {song.status === 'performing' ? 'IN CORSO' : song.status}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        )}

        {activeTab === "leaderboard" && (
            <div className="space-y-4 animate-fade-in">
                <div className="flex items-center gap-2 mb-4">
                    <Trophy className="w-6 h-6 text-yellow-500" />
                    <h2 className="text-xl font-bold text-white">Classifica Quiz</h2>
                </div>
                {leaderboard.map((player, index) => (
                    <div key={index} className={`rounded-xl p-3 flex items-center gap-4 border ${index===0 ? 'bg-yellow-900/20 border-yellow-500/50' : 'bg-zinc-900 border-white/5'}`}>
                        <div className={`font-bold text-lg w-8 text-center ${index===0 ? 'text-yellow-500' : index===1 ? 'text-zinc-300' : index===2 ? 'text-amber-700' : 'text-zinc-600'}`}>
                            #{index + 1}
                        </div>
                        <span className="flex-1 font-medium text-sm text-white">{player.nickname}</span>
                        <span className="font-mono font-bold text-cyan-400">{player.score} pt</span>
                    </div>
                ))}
            </div>
        )}

        {activeTab === "profile" && (
            <div className="space-y-6 text-center pt-12 animate-fade-in">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-fuchsia-600 to-purple-700 flex items-center justify-center mx-auto shadow-2xl">
                    <span className="text-3xl font-bold text-white">{user?.nickname?.substring(0,2).toUpperCase()}</span>
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-white">{user?.nickname}</h2>
                    <p className="text-zinc-500 text-sm">Partecipante al {user?.pub_name}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-left">
                    <div className="bg-zinc-900 p-4 rounded-xl border border-white/5">
                        <p className="text-xs text-zinc-500 uppercase">Punteggio Totale</p>
                        <p className="text-2xl font-bold text-cyan-400">{leaderboard.find(p=>p.id===user?.user?.id)?.score || 0}</p>
                    </div>
                    <div className="bg-zinc-900 p-4 rounded-xl border border-white/5">
                        <p className="text-xs text-zinc-500 uppercase">Richieste</p>
                        <p className="text-2xl font-bold text-fuchsia-400">{myRequests.length}</p>
                    </div>
                </div>

                <Button onClick={logout} variant="outline" className="w-full border-red-900/30 text-red-500 hover:bg-red-950/20 h-12">
                    Esci dal Locale
                </Button>
            </div>
        )}
      </main>

      {/* MOBILE NAV */}
      <nav className="fixed bottom-0 w-full bg-[#0a0a0a]/95 backdrop-blur-xl border-t border-white/10 flex justify-around p-2 pb-safe z-40">
        {[ 
           { id: "home", icon: Home, label: "Home" }, 
           { id: "songs", icon: Music, label: "Richieste" }, 
           { id: "leaderboard", icon: Trophy, label: "Classifica" }, 
           { id: "profile", icon: User, label: "Profilo" } 
        ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all duration-200 w-16 ${activeTab === tab.id ? 'text-fuchsia-500 bg-fuchsia-500/10' : 'text-zinc-600 hover:text-zinc-400'}`}>
                <tab.icon className="w-5 h-5" />
                <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
        ))}
      </nav>

      {/* MODALS */}
      <Dialog open={showRequestModal} onOpenChange={setShowRequestModal}>
          <DialogContent className="bg-zinc-900 border-zinc-800 w-[90%] rounded-2xl">
              <DialogHeader><DialogTitle>Richiedi Canzone</DialogTitle></DialogHeader>
              <form onSubmit={handleRequestSong} className="space-y-4 mt-2">
                  <Input value={songTitle} onChange={(e) => setSongTitle(e.target.value)} placeholder="Titolo Canzone" className="bg-black border-zinc-700 h-12 text-lg"/>
                  <Input value={songArtist} onChange={(e) => setSongArtist(e.target.value)} placeholder="Artista" className="bg-black border-zinc-700 h-12 text-lg"/>
                  <Input value={songYoutubeUrl} onChange={(e) => setSongYoutubeUrl(e.target.value)} placeholder="Link YouTube (Opzionale)" className="bg-black border-zinc-700 h-10 text-xs font-mono text-zinc-400"/>
                  <Button type="submit" className="w-full bg-fuchsia-600 hover:bg-fuchsia-700 h-12 font-bold text-lg">INVIA RICHIESTA</Button>
              </form>
          </DialogContent>
      </Dialog>

      <Dialog open={showVoteModal} onOpenChange={setShowVoteModal}>
          <DialogContent className="bg-zinc-900 border-zinc-800 text-center w-[90%] rounded-2xl">
              <DialogHeader><DialogTitle className="text-xl">Vota l'Esibizione!</DialogTitle></DialogHeader>
              <div className="flex justify-center gap-2 py-6">
                  {[1, 2, 3, 4, 5].map(star => (
                      <button key={star} onClick={() => setSelectedStars(star)} className="transition-transform active:scale-90">
                          <Star className={`w-10 h-10 ${selectedStars >= star ? 'text-yellow-500 fill-yellow-500 drop-shadow-[0_0_10px_rgba(234,179,8,0.5)]' : 'text-zinc-700'}`} />
                      </button>
                  ))}
              </div>
              <Button onClick={handleVote} disabled={selectedStars === 0} className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-bold h-12 text-lg">
                  CONFERMA VOTO
              </Button>
          </DialogContent>
      </Dialog>

      <Dialog open={showMessageModal} onOpenChange={setShowMessageModal}>
          <DialogContent className="bg-zinc-900 border-zinc-800 w-[90%] rounded-2xl">
              <DialogHeader><DialogTitle>Messaggio al Pub</DialogTitle></DialogHeader>
              <Input value={messageText} onChange={(e) => setMessageText(e.target.value)} placeholder="Scrivi il tuo messaggio..." className="bg-black border-zinc-700 h-12"/>
              <Button onClick={handleSendMessage} className="w-full mt-4 bg-cyan-600 hover:bg-cyan-700 font-bold h-12">INVIA ALLO SCHERMO</Button>
          </DialogContent>
      </Dialog>

      {/* QUIZ MODAL - DESIGN MIGLIORATO & FIX CHIUSURA */}
      <Dialog open={showQuizModal} onOpenChange={(open) => { if (!open) closeQuiz(); }}>
        <DialogContent className="bg-[#0f0f11] border border-fuchsia-500/30 max-w-md w-[95%] rounded-3xl p-0 overflow-hidden shadow-2xl">
          
          {/* HEADER QUIZ */}
          <div className="bg-gradient-to-r from-fuchsia-900 to-purple-900 p-6 text-center relative overflow-hidden">
              <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
              <DialogTitle className="text-2xl font-black text-white italic tracking-wide relative z-10">
                  {activeQuiz?.status === 'closed' ? "TEMPO SCADUTO!" : activeQuiz?.status === 'leaderboard' ? "CLASSIFICA" : quizResult ? "RISULTATO" : "QUIZ TIME!"}
              </DialogTitle>
              {activeQuiz?.category && <p className="text-xs text-fuchsia-200 uppercase tracking-widest mt-1 relative z-10">{activeQuiz.category}</p>}
          </div>

          <div className="p-6">
              {/* CASO CLASSIFICA */}
              {activeQuiz?.status === 'leaderboard' && (
                  <div className="text-center py-4 animate-in zoom-in">
                      <Trophy className="w-24 h-24 text-yellow-500 mx-auto mb-4 animate-bounce drop-shadow-[0_0_15px_rgba(234,179,8,0.6)]" />
                      <p className="text-xl font-bold text-white mb-2">Guarda il Maxischermo!</p>
                      <p className="text-zinc-500 text-sm">La classifica è in onda ora.</p>
                  </div>
              )}

              {/* CASO DOMANDA ATTIVA / CHIUSA SENZA RISULTATI */}
              {!quizResult && activeQuiz && activeQuiz.status !== 'leaderboard' && (
                  <div className="py-2">
                      <div className="bg-zinc-800/50 p-4 rounded-xl border border-white/5 mb-6">
                        <p className="text-lg text-center font-bold text-white leading-relaxed">{activeQuiz.question}</p>
                      </div>

                      {activeQuiz.status === 'closed' ? (
                          <div className="text-center p-8 bg-black/30 rounded-2xl border-2 border-dashed border-zinc-700 animate-pulse">
                              <Lock className="w-12 h-12 mx-auto text-red-500 mb-2" />
                              <p className="text-lg font-bold text-red-400">Il televoto è chiuso</p>
                              <p className="text-xs text-zinc-500 mt-1">Attendi i risultati...</p>
                          </div>
                      ) : (
                          <div className="space-y-3">
                              {activeQuiz.options.map((option, index) => (
                                  <button 
                                      key={index} 
                                      onClick={() => handleQuizAnswer(index)} 
                                      disabled={quizAnswer !== null} 
                                      className={`w-full p-4 rounded-xl border-2 text-left transition-all active:scale-95 flex items-center relative overflow-hidden group
                                        ${quizAnswer === index 
                                            ? 'bg-fuchsia-600 border-fuchsia-500 text-white shadow-[0_0_20px_rgba(192,38,211,0.4)]' 
                                            : 'border-white/10 bg-zinc-800 hover:bg-zinc-700 text-zinc-200'}`
                                      }
                                  >
                                      <span className={`font-black mr-4 w-8 h-8 flex items-center justify-center rounded-lg text-sm transition-colors
                                          ${quizAnswer === index ? 'bg-white text-fuchsia-600' : 'bg-black/30 text-zinc-400 group-hover:bg-black/50'}`}>
                                          {String.fromCharCode(65 + index)}
                                      </span>
                                      <span className="flex-1 font-bold text-sm">{option}</span>
                                      {quizAnswer === index && <Check className="w-5 h-5 ml-2 animate-in zoom-in" />}
                                  </button>
                              ))}
                          </div>
                      )}
                  </div>
              )}

              {/* CASO RISULTATO */}
              {quizResult && activeQuiz?.status !== 'leaderboard' && (
                  <div className="text-center py-2 animate-in slide-in-from-bottom-10 fade-in duration-500">
                      <p className="text-xs text-zinc-500 uppercase tracking-widest mb-2">La risposta corretta era</p>
                      
                      <div className="bg-green-500/10 border-2 border-green-500 p-6 rounded-2xl mb-8 relative overflow-hidden">
                          <div className="absolute inset-0 bg-green-500/10 animate-pulse"></div>
                          <p className="text-2xl font-black text-white relative z-10 leading-tight">{quizResult.correct_option}</p>
                          <div className="mt-2 flex justify-center gap-1">
                              {[...Array(3)].map((_,i)=><Star key={i} className="w-4 h-4 text-green-400 fill-green-400"/>)}
                          </div>
                      </div>

                      {pointsEarned > 0 ? (
                          <div className="bg-gradient-to-r from-fuchsia-600 to-purple-600 p-4 rounded-xl mb-6 shadow-lg transform hover:scale-105 transition-transform">
                              <div className="flex items-center justify-center gap-2 text-white">
                                  <Zap className="w-6 h-6 fill-yellow-300 text-yellow-300" />
                                  <p className="font-black text-xl italic">HAI VINTO {pointsEarned} PUNTI!</p>
                              </div>
                          </div>
                      ) : (
                          <div className="bg-zinc-800 p-4 rounded-xl mb-6">
                              <p className="text-red-400 font-bold">Peccato! Risposta sbagliata.</p>
                              <p className="text-xs text-zinc-500">Ritenta al prossimo quiz!</p>
                          </div>
                      )}

                      <div className="flex items-center justify-center gap-2 text-zinc-500 text-xs">
                          <User className="w-3 h-3"/> {quizResult.total_answers} partecipanti totali
                      </div>
                  </div>
              )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}