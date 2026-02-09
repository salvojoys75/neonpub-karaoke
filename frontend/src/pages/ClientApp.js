import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Home, Music, Trophy, User, Star, MessageSquare, RefreshCw, Mic2, Check, Lock, X, Crown } from "lucide-react";
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
  const [queue, setQueue] = useState([]);
  const [myRequests, setMyRequests] = useState([]);
  const [currentPerformance, setCurrentPerformance] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  
  // QUIZ STATE
  const [activeQuiz, setActiveQuiz] = useState(null);
  const [quizResult, setQuizResult] = useState(null);
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [quizAnswer, setQuizAnswer] = useState(null);
  const [quizPointsEarned, setQuizPointsEarned] = useState(null);
  const [quizLeaderboard, setQuizLeaderboard] = useState([]);
  const [quizStatus, setQuizStatus] = useState(null);
  
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

  useEffect(() => { if (!isAuthenticated) navigate("/"); }, [isAuthenticated, navigate]);

  const loadData = useCallback(async () => {
    try {
      const [queueRes, myRes, perfRes, lbRes, quizRes, eventState] = await Promise.all([
        api.getSongQueue(),
        api.getMyRequests(),
        api.getCurrentPerformance(),
        api.getLeaderboard(),
        api.getActiveQuiz(),
        api.getEventState()
      ]);
      setQueue(queueRes.data || []);
      setMyRequests(myRes.data || []);
      setLeaderboard(lbRes.data || []);
      
      // Safety Check: Se l'evento è tornato in Karaoke, uccidi i quiz
      if (eventState && eventState.active_module === 'karaoke') {
           setActiveQuiz(null); setShowQuizModal(false); setQuizStatus(null);
      } else {
           const serverQuiz = quizRes.data;
           if (serverQuiz && ['active', 'closed', 'showing_results', 'leaderboard'].includes(serverQuiz.status)) {
               setQuizStatus(serverQuiz.status);
               setActiveQuiz(serverQuiz);
               
               if (serverQuiz.status === 'showing_results' && !quizResult) {
                   const res = await api.getQuizResults(serverQuiz.id); setQuizResult(res.data);
               } else if (serverQuiz.status === 'leaderboard') {
                   const lb = await api.getLeaderboard(); setQuizLeaderboard(lb.data || []);
               }
               setShowQuizModal(true);
           } else {
               setShowQuizModal(false); setActiveQuiz(null);
           }
      }

      // Performance Logic (Voto etc)
      const newPerf = perfRes.data;
      setCurrentPerformance(prev => {
        if ((!prev && newPerf) || (prev && newPerf && prev.id !== newPerf.id)) {
          setRemainingReactions(REACTION_LIMIT);
          setHasVoted(false);
          setSelectedStars(0);
          return newPerf;
        } 
        if (prev && !newPerf) {
          setHasVoted(false); setSelectedStars(0); setRemainingReactions(REACTION_LIMIT);
          return null;
        }
        // Apre modale voto SOLO se è stato 'voting' e l'utente non ha votato
        if (newPerf && newPerf.status === 'voting' && prev?.status !== 'voting' && newPerf.participant_id !== user?.user?.id && !hasVoted) {
             setShowVoteModal(true);
             if (navigator.vibrate) navigator.vibrate(200);
        }
        return newPerf;
      });

    } catch (error) { console.error(error); }
  }, [user?.id, hasVoted, quizResult]);

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
      pollIntervalRef.current = setInterval(loadData, 5000);
      
      const channel = supabase.channel('client_realtime');
      
      // 1. MONITORO EVENTO GLOBALE (Per sbloccare se si incanta)
      channel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'events', filter: `id=eq.${user?.event_id}` }, 
        (payload) => {
             if (payload.new.active_module === 'karaoke') {
                 // FORCE EXIT QUIZ
                 setShowQuizModal(false); setActiveQuiz(null); setQuizStatus(null);
                 toast.info("Ritorno al Karaoke!");
             }
        }
      );

      // 2. MONITORO PERFORMANCES
      channel.on('postgres_changes', { event: '*', schema: 'public', table: 'performances', filter: `event_id=eq.${user?.event_id}` }, 
        (payload) => {
            if (payload.new.status === 'voting') { loadData(); } else { setCurrentPerformance(payload.new); }
        }
      );

      // 3. MONITORO QUIZ
      channel.on('postgres_changes', { event: '*', schema: 'public', table: 'quizzes', filter: `event_id=eq.${user?.event_id}` }, 
        async (payload) => {
            const status = payload.new.status;
            setQuizStatus(status);

            if (status === 'active') {
                setQuizAnswer(null); setQuizResult(null); setQuizPointsEarned(null); setActiveQuiz(payload.new); setShowQuizModal(true);
                if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
            } 
            else if (status === 'closed') {
                setActiveQuiz(prev => ({ ...prev, status: 'closed' }));
            }
            else if (status === 'showing_results') {
                const res = await api.getQuizResults(payload.new.id);
                setQuizResult(res.data);
            }
            else if (status === 'leaderboard') {
                const lb = await api.getLeaderboard();
                setQuizLeaderboard(lb.data || []);
            }
            else if (status === 'ended') {
                setShowQuizModal(false); setActiveQuiz(null); setQuizResult(null);
            }
        }
      );
        
      channel.subscribe();
      return () => { clearInterval(pollIntervalRef.current); supabase.removeChannel(channel); };
    }
  }, [isAuthenticated, loadData, user?.event_id]);

  // Handlers standard (request song, vote, etc.) - invariati...
  const addFloatingReaction = (emoji) => {
    const id = Date.now() + Math.random();
    const left = Math.random() * 80 + 10;
    setFloatingReactions(prev => [...prev, { id, emoji, left }]);
    setTimeout(() => setFloatingReactions(prev => prev.filter(r => r.id !== id)), 2000);
  };

  const handleRequestSong = async (e) => {
    e.preventDefault();
    if (!songTitle.trim() || !songArtist.trim()) { toast.error("Inserisci dati"); return; }
    try { await api.requestSong({ title: songTitle, artist: songArtist, youtube_url: songYoutubeUrl || null }); toast.success("Inviata!"); setShowRequestModal(false); setSongTitle(""); setSongArtist(""); setSongYoutubeUrl(""); loadData(); } catch (error) { toast.error("Errore invio"); }
  };

  const handleVote = async () => {
    if (selectedStars === 0 || !currentPerformance) return;
    try { await api.submitVote({ performance_id: currentPerformance.id, score: selectedStars }); toast.success(`Voto inviato!`); setHasVoted(true); setShowVoteModal(false); } catch (error) { toast.error("Errore voto"); setShowVoteModal(false); }
  };

  const handleReaction = async (emoji) => {
    if (remainingReactions <= 0) return;
    try { await api.sendReaction({ emoji }); addFloatingReaction(emoji); setRemainingReactions(prev => prev - 1); } catch (error) {}
  };

  const handleSendMessage = async () => {
    if (!messageText.trim()) return;
    try { await api.sendMessage({ text: messageText }); toast.success("Inviato!"); setShowMessageModal(false); setMessageText(""); } catch (error) {}
  };

  const handleQuizAnswer = async (index) => {
    if (quizAnswer !== null) return;
    setQuizAnswer(index);
    try {
        const { data } = await api.answerQuiz({ quiz_id: activeQuiz.id, answer_index: index });
        if (data.points_earned > 0) { setQuizPointsEarned(data.points_earned); toast.success(`Esatto! +${data.points_earned}`); } 
        else { setQuizPointsEarned(0); toast.error("Sbagliato!"); }
    } catch (e) {}
  };

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-[#050505] flex flex-col pb-24 font-sans text-white">
      {/* HEADER */}
      <header className="sticky top-0 z-40 bg-[#050505]/90 backdrop-blur-md p-4 flex justify-between items-center border-b border-white/5">
        <div><h1 className="font-bold text-lg text-fuchsia-500">{user?.pub_name}</h1><p className="text-xs text-zinc-500">{user?.nickname}</p></div>
        <div className="flex gap-2"><Button onClick={() => loadData()} variant="ghost" size="sm"><RefreshCw className="w-4 h-4"/></Button><Button onClick={logout} variant="ghost" size="sm">Esci</Button></div>
      </header>

      {/* FLOATING EMOJIS */}
      <div className="reactions-overlay pointer-events-none fixed inset-0 z-50 overflow-hidden">{floatingReactions.map(r => (<div key={r.id} className="absolute text-4xl animate-float-up" style={{ left: `${r.left}%`, bottom: '-50px' }}>{r.emoji}</div>))}</div>

      <main className="flex-1 p-4">
        {activeTab === "home" && (
          <div className="space-y-6 animate-fade-in-up">
            {currentPerformance ? (
              <div className="glass rounded-2xl p-5 neon-border bg-gradient-to-br from-fuchsia-900/20 to-black">
                <div className="flex items-center gap-2 mb-3"><span className={`w-3 h-3 rounded-full ${currentPerformance.status === "live" ? "bg-red-500 animate-pulse" : "bg-green-500"}`}></span><span className="text-sm font-medium uppercase tracking-wider text-white">{currentPerformance.status === 'live' ? 'LIVE' : currentPerformance.status}</span></div>
                <h2 className="text-2xl font-bold text-white mb-1">{currentPerformance.song_title}</h2>
                <p className="text-zinc-400 text-sm mb-4">{currentPerformance.song_artist}</p>
                <div className="flex items-center gap-2 bg-white/5 p-2 rounded-lg mb-4"><Mic2 className="w-4 h-4 text-fuchsia-400" /><span className="text-fuchsia-400 font-medium">{currentPerformance.user_nickname}</span></div>
                {currentPerformance.status === 'live' && (
                  <>
                    <div className="glass rounded-xl p-4 mt-2 border border-white/10"><p className="text-xs text-zinc-400 mb-3 text-center">Reazioni: <span className="text-cyan-400 font-bold">{remainingReactions}</span></p><div className="flex justify-between gap-1">{EMOJIS.map(emoji => (<button key={emoji} onClick={() => handleReaction(emoji)} className="text-3xl p-2 transition-transform active:scale-90 hover:scale-110">{emoji}</button>))}</div></div>
                    <Button onClick={() => setShowMessageModal(true)} variant="outline" className="w-full mt-4 border-zinc-700 hover:bg-zinc-800"><MessageSquare className="w-4 h-4 mr-2" /> Messaggio</Button>
                  </>
                )}
                {currentPerformance.status === 'voting' && !hasVoted && (<Button onClick={() => setShowVoteModal(true)} className="w-full mt-4 bg-yellow-500 text-black font-bold animate-pulse"><Star className="w-5 h-5 mr-2" /> Vota ora!</Button>)}
              </div>
            ) : (
               <div className="glass rounded-2xl p-8 text-center border-dashed border-2 border-zinc-800"><Music className="w-12 h-12 mx-auto text-zinc-600 mb-2" /><p className="text-zinc-500">Palco vuoto</p></div>
            )}
            <Button onClick={() => setShowRequestModal(true)} className="w-full rounded-full bg-gradient-to-r from-fuchsia-600 to-purple-600 py-6 text-lg shadow-lg font-bold"><Music className="w-5 h-5 mr-2" /> Richiedi Canzone</Button>
            <div className="space-y-3"><h3 className="font-bold text-lg flex items-center gap-2">Prossimi</h3>{queue.filter(s => s.status === "queued").slice(0, 5).map((song, index) => (<div key={song.id} className="glass rounded-xl p-4 flex items-center gap-4"><span className="mono text-2xl text-fuchsia-400 font-bold w-8">{index + 1}</span><div className="flex-1 min-w-0"><p className="font-medium truncate">{song.title}</p><p className="text-sm text-zinc-500 truncate">{song.artist}</p></div><span className="text-xs text-cyan-400">{song.user_nickname}</span></div>))}</div>
          </div>
        )}
        {activeTab === "songs" && (<div className="space-y-4"><h2 className="text-xl font-bold">Le Mie Richieste</h2>{myRequests.map(song => (<div key={song.id} className="glass rounded-xl p-4"><p className="font-medium">{song.title}</p><div className="flex justify-between mt-1"><p className="text-sm text-zinc-500">{song.artist}</p><span className={`text-xs uppercase px-2 py-1 rounded ${song.status==='queued' ? 'bg-green-500/20 text-green-400' : 'bg-zinc-800 text-zinc-500'}`}>{song.status}</span></div></div>))}</div>)}
        {activeTab === "leaderboard" && (<div className="space-y-4"><h2 className="text-xl font-bold text-yellow-500">Classifica</h2>{leaderboard.map((player, index) => (<div key={index} className="glass rounded-xl p-4 flex items-center gap-4"><span className={`text-2xl font-bold w-8 ${index===0 ? 'text-yellow-400' : 'text-zinc-500'}`}>#{index + 1}</span><span className="flex-1 font-medium">{player.nickname}</span><span className="font-bold text-cyan-400">{player.score}</span></div>))}</div>)}
        {activeTab === "profile" && (<div className="space-y-6 text-center pt-8"><div className="w-24 h-24 rounded-full bg-fuchsia-500/20 flex items-center justify-center mx-auto border-2 border-fuchsia-500/50"><User className="w-12 h-12 text-fuchsia-400" /></div><div><h2 className="text-2xl font-bold">{user?.nickname}</h2></div><Button onClick={logout} variant="outline" className="w-full border-red-500/50 text-red-400 hover:bg-red-950">Esci</Button></div>)}
      </main>

      {/* BOTTOM NAV */}
      <nav className="mobile-nav safe-bottom bg-[#0a0a0a] border-t border-white/10 flex justify-around p-2 fixed bottom-0 w-full z-40">
        {[ { id: "home", icon: Home, label: "Home" }, { id: "songs", icon: Music, label: "Canzoni" }, { id: "leaderboard", icon: Trophy, label: "Classifica" }, { id: "profile", icon: User, label: "Profilo" } ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex flex-col items-center gap-1 p-2 rounded-lg transition ${activeTab === tab.id ? 'text-fuchsia-500' : 'text-zinc-500'}`}><tab.icon className="w-6 h-6" /><span className="text-[10px]">{tab.label}</span></button>
        ))}
      </nav>

      {/* MODALI (Request, Vote, Message) - Copia standard dai precedenti... */}
      <Dialog open={showRequestModal} onOpenChange={setShowRequestModal}><DialogContent className="bg-zinc-900 border-zinc-800"><DialogHeader><DialogTitle>Richiedi Canzone</DialogTitle></DialogHeader><form onSubmit={handleRequestSong} className="space-y-4 mt-4"><Input value={songTitle} onChange={(e) => setSongTitle(e.target.value)} placeholder="Titolo" className="bg-zinc-800 border-zinc-700"/><Input value={songArtist} onChange={(e) => setSongArtist(e.target.value)} placeholder="Artista" className="bg-zinc-800 border-zinc-700"/><Button type="submit" className="w-full bg-fuchsia-600">Invia</Button></form></DialogContent></Dialog>
      <Dialog open={showVoteModal} onOpenChange={setShowVoteModal}><DialogContent className="bg-zinc-900 border-zinc-800 text-center"><DialogHeader><DialogTitle>Vota!</DialogTitle></DialogHeader><div className="flex justify-center gap-2 py-4">{[1, 2, 3, 4, 5].map(star => (<button key={star} onClick={() => setSelectedStars(star)}><Star className={`w-10 h-10 ${selectedStars >= star ? 'text-yellow-500 fill-yellow-500' : 'text-zinc-600'}`} /></button>))}</div><Button onClick={handleVote} disabled={selectedStars === 0} className="w-full bg-yellow-500 text-black">Conferma</Button></DialogContent></Dialog>
      <Dialog open={showMessageModal} onOpenChange={setShowMessageModal}><DialogContent className="bg-zinc-900 border-zinc-800"><DialogHeader><DialogTitle>Scrivi Messaggio</DialogTitle></DialogHeader><Input value={messageText} onChange={(e) => setMessageText(e.target.value)} className="bg-zinc-800 border-zinc-700"/><Button onClick={handleSendMessage} className="w-full mt-4 bg-cyan-600">Invia</Button></DialogContent></Dialog>

      {/* --- MODALE QUIZ --- */}
      <Dialog open={showQuizModal} onOpenChange={(open) => { if (!open) return; }}>
        <DialogContent className={`bg-zinc-900 border-2 max-w-md w-[95%] rounded-2xl ${quizStatus === 'leaderboard' ? 'border-yellow-500' : 'border-fuchsia-500'}`}>
          <DialogHeader><DialogTitle className="text-center text-2xl font-bold text-white">{quizStatus === 'leaderboard' ? "CLASSIFICA LIVE" : quizStatus === 'closed' ? "STOP AL VOTO" : quizResult ? "RISULTATO" : "QUIZ TIME!"}</DialogTitle></DialogHeader>
          
          {quizStatus !== 'leaderboard' && !quizResult && activeQuiz && (
            <div className="py-4">
              <p className="text-xl text-center mb-6 font-medium text-white">{activeQuiz.question}</p>
              {activeQuiz.media_type !== 'text' && <div className="text-center mb-4 text-cyan-400 text-sm animate-pulse">(Guarda lo schermo!)</div>}
              {quizStatus === 'closed' ? (
                 <div className="text-center p-6 bg-white/5 rounded-xl border border-white/10"><Lock className="w-12 h-12 mx-auto text-red-500 mb-2" /><p className="text-lg font-bold text-red-400">Tempo Scaduto</p></div>
              ) : (
                 <div className="space-y-3">{activeQuiz.options.map((option, index) => (<button key={index} onClick={() => handleQuizAnswer(index)} disabled={quizAnswer !== null} className={`w-full p-4 rounded-xl border text-left flex items-center ${quizAnswer === index ? 'bg-fuchsia-600 border-fuchsia-500 text-white' : 'border-white/10 bg-white/5 text-zinc-200'}`}><span className="font-bold mr-3">{String.fromCharCode(65 + index)}</span><span className="flex-1">{option}</span></button>))}</div>
              )}
            </div>
          )}

          {quizResult && quizStatus !== 'leaderboard' && (
            <div className="text-center py-6">
              {quizPointsEarned > 0 ? <><Trophy className="w-16 h-16 text-yellow-400 mx-auto mb-2" /><p className="text-2xl font-black text-green-500">VINTO! +{quizPointsEarned}</p></> : <><X className="w-16 h-16 text-red-500 mx-auto mb-2" /><p className="text-2xl font-black text-red-500">SBAGLIATO</p></>}
              <div className="bg-zinc-800 p-4 rounded-xl border border-zinc-700 mt-4"><p className="text-sm text-zinc-400">Risposta corretta:</p><p className="text-xl font-bold text-white">{quizResult.correct_option}</p></div>
            </div>
          )}

          {quizStatus === 'leaderboard' && (
              <div className="py-2 space-y-2 max-h-[60vh] overflow-y-auto">
                  {quizLeaderboard.slice(0, 10).map((p, i) => (
                      <div key={p.id} className={`flex items-center justify-between p-3 rounded-lg border ${p.id === user?.participant_id ? 'bg-fuchsia-900/50 border-fuchsia-500' : 'bg-white/5 border-white/10'}`}>
                          <div className="flex items-center gap-3"><span className="font-bold text-yellow-500">#{i+1}</span><span>{p.nickname}</span></div>
                          <span className="font-mono text-yellow-400 font-bold">{p.score}</span>
                      </div>
                  ))}
              </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}