import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Home, Music, Trophy, User, Star, MessageSquare, RefreshCw, Mic2, Check, Lock, X, Eye } from "lucide-react";
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
  const [activeQuiz, setActiveQuiz] = useState(null);
  const [quizResult, setQuizResult] = useState(null);
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [quizAnswer, setQuizAnswer] = useState(null);
  const [pointsEarned, setPointsEarned] = useState(0);
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
      const [queueRes, myRes, perfRes, lbRes, quizRes] = await Promise.all([
        api.getSongQueue(), api.getMyRequests(), api.getCurrentPerformance(), api.getLeaderboard(), api.getActiveQuiz(),
      ]);
      setQueue(queueRes.data || []);
      setMyRequests(myRes.data || []);
      setLeaderboard(lbRes.data || []);
      
      const newPerf = perfRes.data;
      setCurrentPerformance(prev => {
        if ((!prev && newPerf) || (prev && newPerf && prev.id !== newPerf.id)) {
          setRemainingReactions(REACTION_LIMIT); setHasVoted(false); setSelectedStars(0); return newPerf;
        } 
        if (prev && !newPerf) { setHasVoted(false); setSelectedStars(0); setRemainingReactions(REACTION_LIMIT); return null; }
        if (newPerf && newPerf.status === 'voting' && prev?.status !== 'voting' && newPerf.participant_id !== user?.user?.id && !hasVoted) { setShowVoteModal(true); toast.info("⭐ Votazione aperta! Vota ora!"); }
        return newPerf;
      });
      
      const serverQuiz = quizRes.data;
      if (serverQuiz) {
        if (!activeQuiz || activeQuiz.id !== serverQuiz.id) { setQuizAnswer(null); setQuizResult(null); setPointsEarned(0); }
        setActiveQuiz(serverQuiz);
        if (serverQuiz.status !== 'active' && serverQuiz.status !== 'closed') { setShowQuizModal(false); }
        if (serverQuiz.status === 'active' && !showQuizModal) { toast.success("📢 Nuovo Quiz!"); setShowQuizModal(true); }
        if (serverQuiz.status === 'showing_results' && quizAnswer !== null && !quizResult) { setTimeout(async () => { const { data } = await api.getQuizResults(serverQuiz.id); setQuizResult(data); }, 500); }
      } else { setActiveQuiz(null); setQuizResult(null); setShowQuizModal(false); }
    } catch (error) { console.error("Errore caricamento:", error); }
  }, [activeQuiz, showQuizModal, user, hasVoted, quizAnswer, quizResult]);

  useEffect(() => { loadData(); pollIntervalRef.current = setInterval(loadData, 3000); return () => clearInterval(pollIntervalRef.current); }, [loadData]);

  const addFloatingReaction = (emoji) => { const id = Date.now() + Math.random(); const left = Math.random() * 80 + 10; setFloatingReactions(prev => [...prev, { id, emoji, left }]); setTimeout(() => setFloatingReactions(prev => prev.filter(r => r.id !== id)), 2000); };

  const handleRequestSong = async (e) => {
    e.preventDefault(); if (!songTitle || !songArtist) return toast.error("Inserisci titolo e artista!");
    try { await api.requestSong({ title: songTitle, artist: songArtist, youtube_url: songYoutubeUrl }); toast.success("Richiesta inviata!"); setShowRequestModal(false); setSongTitle(""); setSongArtist(""); setSongYoutubeUrl(""); } catch (error) { toast.error("Errore richiesta"); }
  };

  const handleVote = async () => {
    if (selectedStars === 0) return; try { await api.submitVote({ performance_id: currentPerformance.id, score: selectedStars }); toast.success(`Hai votato ${selectedStars} stelle!`); setHasVoted(true); setShowVoteModal(false); } catch (error) { toast.error(error.message || "Errore voto"); }
  };

  const handleReaction = async (emoji) => {
    if (remainingReactions <= 0) { toast.error("Reazioni finite per questa canzone!"); return; }
    try { await api.sendReaction({ emoji }); addFloatingReaction(emoji); setRemainingReactions(prev => prev - 1); } catch (error) { toast.error("Errore reazione"); }
  };

  const handleSendMessage = async () => {
    if (!messageText.trim()) return;
    try { 
      await api.sendMessage({ text: messageText }); 
      toast.success("Messaggio inviato alla regia! Attendi approvazione per vederlo sullo schermo."); 
      setShowMessageModal(false); 
      setMessageText(""); 
    } catch (error) { 
      toast.error("Errore invio"); 
    }
  };

  const handleQuizAnswer = async (index) => {
    if (quizAnswer !== null) return; if (!activeQuiz || activeQuiz.status !== 'active') { toast.error("Tempo scaduto!"); return; }
    setQuizAnswer(index);
    try { const { data } = await api.answerQuiz({ quiz_id: activeQuiz.id, answer_index: index }); if (data.points_earned > 0) { setPointsEarned(data.points_earned); toast.success(`Hai guadagnato ${data.points_earned} punti!`); } else { setPointsEarned(0); } } catch (e) { toast.info("Risposta salvata."); }
  };

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-[#050505] flex flex-col pb-24 font-sans text-white">
      <header className="sticky top-0 z-40 bg-[#050505]/90 backdrop-blur-md p-4 flex justify-between items-center border-b border-white/5">
        <div><h1 className="font-bold text-lg text-fuchsia-500">{user?.pub_name || "NeonPub"}</h1><p className="text-xs text-zinc-500 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"></span> {user?.nickname}</p></div>
        <div className="flex items-center gap-2"><Button onClick={() => { loadData(); toast.success("Aggiornato!"); }} variant="ghost" size="sm" className="text-zinc-400"><RefreshCw className="w-4 h-4" /></Button><Button onClick={logout} variant="ghost" size="sm" className="text-zinc-400">Esci</Button></div>
      </header>
      <div className="reactions-overlay pointer-events-none fixed inset-0 z-50 overflow-hidden">{floatingReactions.map(r => (<div key={r.id} className="absolute text-4xl animate-float-up" style={{ left: `${r.left}%`, bottom: '-50px' }}>{r.emoji}</div>))}</div>
      <main className="flex-1 p-4">
        {activeTab === "home" && (
          <div className="space-y-6 animate-fade-in-up">
            {currentPerformance ? (
              <div className="glass rounded-2xl p-5 neon-border bg-gradient-to-br from-fuchsia-900/20 to-black">
                <div className="flex items-center gap-2 mb-3"><span className={`w-3 h-3 rounded-full ${currentPerformance.status === "live" ? "bg-red-500 animate-pulse" : "bg-green-500"}`}></span><span className="text-sm font-medium uppercase tracking-wider text-white">{currentPerformance.status === 'live' ? 'LIVE ORA' : currentPerformance.status}</span></div>
                <h2 className="text-2xl font-bold text-white mb-1">{currentPerformance.song_title}</h2><p className="text-zinc-400 text-sm mb-4">{currentPerformance.song_artist}</p><div className="flex items-center gap-2 bg-white/5 p-2 rounded-lg mb-4"><Mic2 className="w-4 h-4 text-fuchsia-400" /><span className="text-fuchsia-400 font-medium">{currentPerformance.user_nickname}</span></div>
                {currentPerformance.status === 'live' && (<div className="glass rounded-xl p-4 mt-2 border border-white/10"><p className="text-xs text-zinc-400 mb-3 text-center">Reazioni: <span className="text-cyan-400 font-bold">{remainingReactions}</span></p><div className="flex justify-between gap-1">{EMOJIS.map(emoji => (<button key={emoji} onClick={() => handleReaction(emoji)} className="text-3xl p-2 transition-transform active:scale-90 hover:scale-110">{emoji}</button>))}</div></div>)}
                {currentPerformance.status === 'voting' && !hasVoted && (<Button onClick={() => setShowVoteModal(true)} className="w-full mt-4 bg-yellow-500 hover:bg-yellow-600 text-black font-bold animate-pulse"><Star className="w-5 h-5 mr-2" /> Vota ora!</Button>)}
              </div>
            ) : (<div className="glass rounded-2xl p-8 text-center border-dashed border-2 border-zinc-800"><Music className="w-12 h-12 mx-auto text-zinc-600 mb-2" /><p className="text-zinc-500">Il palco è vuoto</p></div>)}
            <Button onClick={() => setShowMessageModal(true)} variant="outline" className="w-full border-zinc-700 hover:bg-zinc-800"><MessageSquare className="w-4 h-4 mr-2" /> Invia Messaggio</Button>
            <Button onClick={() => setShowRequestModal(true)} className="w-full rounded-full bg-gradient-to-r from-fuchsia-600 to-purple-600 py-6 text-lg shadow-lg font-bold"><Music className="w-5 h-5 mr-2" /> Richiedi Canzone</Button>
            <div className="space-y-3"><h3 className="font-bold text-lg flex items-center gap-2"><Music className="w-5 h-5 text-fuchsia-400" /> Prossimi</h3>{queue.filter(s => s.status === "queued").slice(0, 5).map((song, index) => (<div key={song.id} className="glass rounded-xl p-4 flex items-center gap-4"><span className="mono text-2xl text-fuchsia-400 font-bold w-8">{index + 1}</span><div className="flex-1 min-w-0"><p className="font-medium truncate">{song.title}</p><p className="text-sm text-zinc-500 truncate">{song.artist}</p></div><span className="text-xs text-cyan-400">{song.user_nickname}</span></div>))}</div>
          </div>
        )}
        {activeTab === "songs" && (<div className="space-y-4"><h2 className="text-xl font-bold">Le Mie Richieste</h2>{myRequests.map(song => (<div key={song.id} className="glass rounded-xl p-4"><p className="font-medium">{song.title}</p><div className="flex justify-between mt-1"><p className="text-sm text-zinc-500">{song.artist}</p><span className={`text-xs uppercase px-2 py-1 rounded ${song.status==='queued' ? 'bg-green-500/20 text-green-400' : 'bg-zinc-800 text-zinc-500'}`}>{song.status}</span></div></div>))}</div>)}
        {activeTab === "leaderboard" && (<div className="space-y-4"><h2 className="text-xl font-bold text-yellow-500">Classifica Quiz</h2>{leaderboard.map((player, index) => (<div key={index} className="glass rounded-xl p-4 flex items-center gap-4"><span className={`text-2xl font-bold w-8 ${index===0 ? 'text-yellow-400' : 'text-zinc-500'}`}>#{index + 1}</span><span className="flex-1 font-medium">{player.nickname}</span><span className="font-bold text-cyan-400">{player.score}</span></div>))}</div>)}
        {activeTab === "profile" && (<div className="space-y-6 text-center pt-8"><div className="w-24 h-24 rounded-full bg-fuchsia-500/20 flex items-center justify-center mx-auto border-2 border-fuchsia-500/50"><User className="w-12 h-12 text-fuchsia-400" /></div><div><h2 className="text-2xl font-bold">{user?.nickname}</h2><p className="text-zinc-500">{user?.pub_name}</p></div><Button onClick={logout} variant="outline" className="w-full border-red-500/50 text-red-400 hover:bg-red-950">Esci dal Pub</Button></div>)}
      </main>
      <nav className="mobile-nav safe-bottom bg-[#0a0a0a] border-t border-white/10 flex justify-around p-2 fixed bottom-0 w-full z-40">
        {[ { id: "home", icon: Home, label: "Home" }, { id: "songs", icon: Music, label: "Canzoni" }, { id: "leaderboard", icon: Trophy, label: "Classifica" }, { id: "profile", icon: User, label: "Profilo" } ].map(tab => (<button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex flex-col items-center gap-1 p-2 rounded-lg transition ${activeTab === tab.id ? 'text-fuchsia-500' : 'text-zinc-500'}`}><tab.icon className="w-6 h-6" /><span className="text-[10px]">{tab.label}</span></button>))}
      </nav>
      <Dialog open={showRequestModal} onOpenChange={setShowRequestModal}><DialogContent className="bg-zinc-900 border-zinc-800"><DialogHeader><DialogTitle>Richiedi Canzone</DialogTitle></DialogHeader><form onSubmit={handleRequestSong} className="space-y-4 mt-4"><Input value={songTitle} onChange={(e) => setSongTitle(e.target.value)} placeholder="Titolo" className="bg-zinc-800 border-zinc-700"/><Input value={songArtist} onChange={(e) => setSongArtist(e.target.value)} placeholder="Artista" className="bg-zinc-800 border-zinc-700"/><Input value={songYoutubeUrl} onChange={(e) => setSongYoutubeUrl(e.target.value)} placeholder="Link YouTube (facoltativo)" className="bg-zinc-800 border-zinc-700"/><Button type="submit" className="w-full bg-fuchsia-600 hover:bg-fuchsia-700">Invia</Button></form></DialogContent></Dialog>
      <Dialog open={showVoteModal} onOpenChange={setShowVoteModal}><DialogContent className="bg-zinc-900 border-zinc-800 text-center"><DialogHeader><DialogTitle>Vota l'Esibizione!</DialogTitle></DialogHeader><div className="flex justify-center gap-2 py-4">{[1, 2, 3, 4, 5].map(star => (<button key={star} onClick={() => setSelectedStars(star)}><Star className={`w-10 h-10 ${selectedStars >= star ? 'text-yellow-500 fill-yellow-500' : 'text-zinc-600'}`} /></button>))}</div><Button onClick={handleVote} disabled={selectedStars === 0} className="w-full bg-yellow-500 text-black">Conferma Voto</Button></DialogContent></Dialog>
      <Dialog open={showMessageModal} onOpenChange={setShowMessageModal}><DialogContent className="bg-zinc-900 border-zinc-800"><DialogHeader><DialogTitle>Messaggio al Pub</DialogTitle></DialogHeader><Input value={messageText} onChange={(e) => setMessageText(e.target.value)} placeholder="Scrivi messaggio..." className="bg-zinc-800 border-zinc-700"/><Button onClick={handleSendMessage} className="w-full mt-4 bg-cyan-600 hover:bg-cyan-700">Invia</Button></DialogContent></Dialog>
      <Dialog open={showQuizModal} onOpenChange={setShowQuizModal}>
        <DialogContent className="bg-zinc-900 border-fuchsia-500/30 max-w-md w-[90%] rounded-2xl">
          <DialogHeader><DialogTitle className="text-center text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-fuchsia-400 to-purple-600">{activeQuiz?.status === 'closed' ? "STOP AL VOTO!" : activeQuiz?.status === 'leaderboard' ? "CLASSIFICA LIVE" : quizResult ? "Risultato" : "Quiz Time!"}</DialogTitle></DialogHeader>
          {activeQuiz?.status === 'leaderboard' && (<div className="text-center py-8"><Trophy className="w-20 h-20 text-yellow-500 mx-auto mb-4 animate-bounce" /><p className="text-xl font-bold text-white mb-2">Guarda il Maxischermo!</p><p className="text-zinc-400">La classifica è in onda ora.</p></div>)}
          {!quizResult && activeQuiz && activeQuiz.status !== 'leaderboard' && (<div className="py-4"><p className="text-xl text-center mb-6 font-medium text-white">{activeQuiz.question}</p>{activeQuiz.status === 'closed' ? (<div className="text-center p-6 bg-white/5 rounded-xl border border-white/10 animate-pulse"><Lock className="w-12 h-12 mx-auto text-red-500 mb-2" /><p className="text-lg font-bold text-red-400">Tempo Scaduto</p><p className="text-sm text-zinc-500">Attendi i risultati...</p></div>) : (<div className="space-y-3">{activeQuiz.options.map((option, index) => (<button key={index} onClick={() => handleQuizAnswer(index)} disabled={quizAnswer !== null} className={`w-full p-4 rounded-xl border text-left transition-all active:scale-95 flex items-center ${quizAnswer === index ? 'bg-fuchsia-600 border-fuchsia-500 text-white shadow-[0_0_15px_rgba(192,38,211,0.5)]' : 'border-white/10 bg-white/5 hover:bg-white/10 text-zinc-200'}`}><span className={`font-bold mr-3 w-6 h-6 flex items-center justify-center rounded-full text-xs ${quizAnswer === index ? 'bg-white text-fuchsia-600' : 'bg-zinc-700 text-zinc-300'}`}>{String.fromCharCode(65 + index)}</span><span className="flex-1">{option}</span>{quizAnswer === index && <Check className="w-5 h-5 ml-2" />}</button>))}</div>)}</div>)}
          {quizResult && activeQuiz?.status !== 'leaderboard' && (<div className="text-center py-6 animate-zoom-in"><Trophy className="w-16 h-16 text-yellow-400 mx-auto mb-4" /><p className="text-sm text-zinc-400 uppercase tracking-widest mb-1">Risposta Corretta</p><div className="bg-green-500/20 border border-green-500 p-4 rounded-xl mb-6"><p className="text-2xl font-bold text-white">{quizResult.correct_option}</p></div>{pointsEarned > 0 ? (<div className="bg-fuchsia-600/20 border border-fuchsia-500 p-3 rounded mb-4"><p className="text-fuchsia-400 font-bold text-lg">+ {pointsEarned} Punti!</p></div>) : (<p className="text-red-400 mb-4">Peccato! Niente punti.</p>)}<div className="flex justify-center mb-4"><Button variant="outline" size="sm" onClick={() => setActiveTab("leaderboard")}><Eye className="w-4 h-4 mr-2"/> Vedi Classifica</Button></div><p className="text-zinc-500 text-sm">{quizResult.total_answers} persone hanno partecipato</p></div>)}
        </DialogContent>
      </Dialog>
    </div>
  );
}