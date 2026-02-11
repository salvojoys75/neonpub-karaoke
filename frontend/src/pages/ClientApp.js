import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Home, Music, Trophy, User, Star, MessageSquare, RefreshCw, Mic2, Check, Lock, Zap } from "lucide-react";
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

  const forceCloseQuiz = useCallback(() => {
    console.log("Forcing quiz close");
    setShowQuizModal(false);
    setActiveQuiz(null);
    setQuizResult(null);
    setQuizAnswer(null);
    setPointsEarned(0);
  }, []);

  const loadData = useCallback(async () => {
    try {
      const [queueRes, myRes, perfRes, lbRes, quizRes] = await Promise.all([
        api.getSongQueue(), api.getMyRequests(), api.getCurrentPerformance(), 
        api.getLeaderboard(), api.getActiveQuiz(),
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
        if (newPerf && newPerf.status === 'voting' && prev?.status !== 'voting' && newPerf.participant_id !== user?.user?.id && !hasVoted) { setShowVoteModal(true); toast.info("⭐ Votazione aperta!"); }
        return newPerf;
      });
      
      const serverQuiz = quizRes.data;
      // FIX CRITICO: Se il server non restituisce quiz (null o undefined), forziamo la chiusura
      if (!serverQuiz) {
         if (showQuizModal) forceCloseQuiz();
      } else {
         if (serverQuiz.status === 'active' || serverQuiz.status === 'closed') {
             setActiveQuiz(prev => { 
                 if (!prev || prev.id !== serverQuiz.id) { 
                     setQuizAnswer(null); setQuizResult(null); setPointsEarned(0); setShowQuizModal(true); 
                 } 
                 return serverQuiz; 
             });
         } else if (serverQuiz.status === 'showing_results' || serverQuiz.status === 'leaderboard') {
             if (!quizResult) { const res = await api.getQuizResults(serverQuiz.id); setQuizResult(res.data); }
             setActiveQuiz(serverQuiz); 
             if(!showQuizModal) setShowQuizModal(true);
         } else if (serverQuiz.status === 'ended') {
             forceCloseQuiz();
         }
      }
    } catch (error) { console.error(error); }
  }, [user?.id, hasVoted, showQuizModal, quizResult, forceCloseQuiz, user?.user?.id]);

  useEffect(() => {
    if (isAuthenticated) {
      loadData(); pollIntervalRef.current = setInterval(loadData, 3000); // Polling rapido per sincronia
      
      const channel = supabase.channel('client_realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'performances', filter: `event_id=eq.${user?.event_id}` }, 
            (payload) => { const newPerf = payload.new; if (newPerf.status === 'voting') loadData(); else setCurrentPerformance(newPerf); }
        )
        .on('postgres_changes', { event: '*', schema: 'public', table: 'quizzes', filter: `event_id=eq.${user?.event_id}` }, 
            async (payload) => {
                const q = payload.new;
                // FIX CRITICO: Se lo stato è ended, chiudi subito
                if (q.status === 'ended') { forceCloseQuiz(); return; }
                
                if (q.status === 'active') { 
                    setQuizAnswer(null); setQuizResult(null); setPointsEarned(0); setActiveQuiz(q); setShowQuizModal(true); toast.info("🎯 Quiz Iniziato!"); 
                } else if (q.status === 'closed') { 
                    setActiveQuiz(prev => ({ ...prev, status: 'closed' })); toast.warning("🛑 Televoto Chiuso!"); 
                } else if (q.status === 'showing_results') { 
                    const res = await api.getQuizResults(q.id); setQuizResult(res.data); setActiveQuiz(q); 
                } else if (q.status === 'leaderboard') { 
                    setActiveQuiz(q); toast.info("🏆 Classifica sul maxischermo!"); 
                }
            }
        ).subscribe();
      return () => { clearInterval(pollIntervalRef.current); supabase.removeChannel(channel); };
    }
  }, [isAuthenticated, loadData, user?.event_id, forceCloseQuiz]);

  const addFloatingReaction = (emoji) => {
    const id = Date.now() + Math.random(); const left = Math.random() * 80 + 10;
    setFloatingReactions(prev => [...prev, { id, emoji, left }]); setTimeout(() => setFloatingReactions(prev => prev.filter(r => r.id !== id)), 2000);
  };
  const handleRequestSong = async (e) => { e.preventDefault(); if (!songTitle.trim()) { toast.error("Inserisci titolo"); return; } try { await api.requestSong({ title: songTitle, artist: songArtist, youtube_url: songYoutubeUrl || null }); toast.success("Richiesta inviata!"); setShowRequestModal(false); setSongTitle(""); setSongArtist(""); setSongYoutubeUrl(""); loadData(); } catch (error) { toast.error("Errore invio"); } };
  const handleVote = async () => { if (selectedStars === 0 || !currentPerformance) return; try { await api.submitVote({ performance_id: currentPerformance.id, score: selectedStars }); toast.success(`Voto inviato!`); setHasVoted(true); setShowVoteModal(false); } catch (error) { toast.error("Errore voto"); setShowVoteModal(false); } };
  const handleReaction = async (emoji) => { if (remainingReactions <= 0) { toast.error("Reazioni finite!"); return; } try { await api.sendReaction({ emoji }); addFloatingReaction(emoji); setRemainingReactions(prev => prev - 1); } catch (error) { toast.error("Errore reazione"); } };
  const handleSendMessage = async () => { if (!messageText.trim()) return; try { await api.sendMessage({ text: messageText }); toast.success("Inviato!"); setShowMessageModal(false); setMessageText(""); } catch (error) { toast.error("Errore invio"); } };
  const handleQuizAnswer = async (index) => { if (quizAnswer !== null || !activeQuiz || activeQuiz.status !== 'active') return; setQuizAnswer(index); try { const { data } = await api.answerQuiz({ quiz_id: activeQuiz.id, answer_index: index }); if (data.points_earned > 0) { setPointsEarned(data.points_earned); toast.success(`+${data.points_earned} Punti!`); } } catch (e) { toast.info("Salvato"); } };

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-[#050505] flex flex-col pb-24 font-sans text-white select-none">
      <header className="sticky top-0 z-40 bg-[#050505]/95 backdrop-blur-md p-4 flex justify-between items-center border-b border-white/5 shadow-md">
        <div><h1 className="font-bold text-lg text-fuchsia-500">{user?.pub_name || "NeonPub"}</h1><p className="text-xs text-zinc-500 flex items-center gap-1"><User className="w-3 h-3"/> {user?.nickname}</p></div>
        <div className="flex items-center gap-2"><Button onClick={() => { loadData(); toast.success("Aggiornato"); }} variant="ghost" size="icon" className="text-zinc-400"><RefreshCw className="w-4 h-4"/></Button><Button onClick={logout} variant="ghost" size="sm" className="text-zinc-400 text-xs">Esci</Button></div>
      </header>
      <div className="reactions-overlay pointer-events-none fixed inset-0 z-50 overflow-hidden">{floatingReactions.map(r => (<div key={r.id} className="absolute text-4xl animate-float-up" style={{ left: `${r.left}%`, bottom: '-50px' }}>{r.emoji}</div>))}</div>
      <main className="flex-1 p-4 overflow-y-auto">
        {activeTab === "home" && (
          <div className="space-y-6 animate-fade-in">
            {currentPerformance ? (
              <div className="relative overflow-hidden rounded-2xl p-5 border border-white/10 bg-gradient-to-br from-zinc-900 to-black shadow-lg">
                <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-3"><span className={`w-2 h-2 rounded-full ${currentPerformance.status === "live" ? "bg-red-500 animate-pulse" : "bg-yellow-500"}`}></span><span className="text-xs font-bold uppercase text-zinc-400">{currentPerformance.status==='live'?'ON STAGE':currentPerformance.status}</span></div>
                    <h2 className="text-2xl font-black text-white mb-1 leading-tight">{currentPerformance.song_title}</h2><p className="text-fuchsia-400 font-medium text-sm mb-4">{currentPerformance.song_artist}</p>
                    <div className="flex items-center gap-2 bg-white/5 p-2 rounded-lg mb-4 border border-white/5"><Mic2 className="w-4 h-4 text-cyan-400" /><span className="text-zinc-200 text-sm font-bold">{currentPerformance.user_nickname}</span></div>
                    {currentPerformance.status === 'live' && (<><div className="grid grid-cols-6 gap-2 mb-4">{EMOJIS.map(emoji => (<button key={emoji} onClick={() => handleReaction(emoji)} className="aspect-square flex items-center justify-center bg-white/5 rounded-lg text-xl active:scale-90 border border-white/5">{emoji}</button>))}</div><Button onClick={() => setShowMessageModal(true)} variant="outline" className="w-full border-zinc-700 hover:bg-zinc-800 text-xs h-9"><MessageSquare className="w-3 h-3 mr-2" /> Messaggio</Button></>)}
                    {currentPerformance.status === 'voting' && !hasVoted && (<Button onClick={() => setShowVoteModal(true)} className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-bold animate-pulse"><Star className="w-4 h-4 mr-2" /> VOTA ORA</Button>)}
                </div>
              </div>
            ) : (<div className="rounded-2xl p-8 text-center border-2 border-dashed border-zinc-800 bg-zinc-900/50"><Music className="w-12 h-12 mx-auto text-zinc-700 mb-2" /><p className="text-zinc-500 font-medium">Il palco è vuoto</p></div>)}
            <Button onClick={() => setShowRequestModal(true)} className="w-full rounded-xl bg-gradient-to-r from-fuchsia-700 to-purple-800 py-8 text-lg shadow-xl font-bold border-t border-white/20">PRENOTA CANZONE</Button>
            <div className="space-y-3 pt-2"><h3 className="font-bold text-sm text-zinc-500 uppercase flex items-center gap-2"><Music className="w-4 h-4" /> Prossimi</h3>{queue.filter(s => s.status === "queued").slice(0, 5).map((s, i) => (<div key={s.id} className="bg-zinc-900/80 border border-white/5 rounded-xl p-3 flex items-center gap-4"><span className="font-mono text-xl text-zinc-600 font-bold w-6 text-center">{i + 1}</span><div className="flex-1 min-w-0"><p className="font-bold text-sm text-white truncate">{s.title}</p><p className="text-xs text-zinc-500 truncate">{s.artist}</p></div><span className="text-[10px] bg-zinc-800 px-2 py-1 rounded text-zinc-400 font-medium">{s.user_nickname}</span></div>))}</div>
          </div>
        )}
        {activeTab === "songs" && (<div className="space-y-4 animate-fade-in"><h2 className="text-xl font-bold text-white">Le Mie Richieste</h2>{myRequests.map(s => (<div key={s.id} className="bg-zinc-900 border border-white/5 rounded-xl p-4 relative overflow-hidden"><div className={`absolute left-0 top-0 bottom-0 w-1 ${s.status === 'queued' ? 'bg-green-500' : 'bg-zinc-700'}`}></div><p className="font-bold text-white">{s.title}</p><div className="flex justify-between mt-1 items-center"><p className="text-sm text-zinc-400">{s.artist}</p><span className="text-[10px] uppercase font-bold bg-zinc-800 px-2 py-1 rounded text-zinc-500">{s.status}</span></div></div>))}</div>)}
        {activeTab === "leaderboard" && (<div className="space-y-4 animate-fade-in"><div className="flex items-center gap-2 mb-4"><Trophy className="w-6 h-6 text-yellow-500" /><h2 className="text-xl font-bold text-white">Classifica</h2></div>{leaderboard.map((p, i) => (<div key={i} className={`rounded-xl p-3 flex items-center gap-4 border ${i===0 ? 'bg-yellow-900/20 border-yellow-500/50' : 'bg-zinc-900 border-white/5'}`}><div className={`font-bold text-lg w-8 text-center ${i===0?'text-yellow-500':'text-zinc-600'}`}>#{i+1}</div><span className="flex-1 font-medium text-sm text-white">{p.nickname}</span><span className="font-mono font-bold text-cyan-400">{p.score} pt</span></div>))}</div>)}
        {activeTab === "profile" && (<div className="space-y-6 text-center pt-12 animate-fade-in"><div className="w-24 h-24 rounded-full bg-gradient-to-br from-fuchsia-600 to-purple-700 flex items-center justify-center mx-auto shadow-2xl"><span className="text-3xl font-bold text-white">{user?.nickname?.substring(0,2).toUpperCase()}</span></div><h2 className="text-2xl font-bold text-white">{user?.nickname}</h2><Button onClick={logout} variant="outline" className="w-full border-red-900/30 text-red-500 hover:bg-red-950/20">Esci</Button></div>)}
      </main>
      <nav className="fixed bottom-0 w-full bg-[#0a0a0a]/95 backdrop-blur-xl border-t border-white/10 flex justify-around p-2 pb-safe z-40">
        {[{ id: "home", icon: Home, label: "Home" }, { id: "songs", icon: Music, label: "Richieste" }, { id: "leaderboard", icon: Trophy, label: "Classifica" }, { id: "profile", icon: User, label: "Profilo" }].map(t => (<button key={t.id} onClick={() => setActiveTab(t.id)} className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all w-16 ${activeTab === t.id ? 'text-fuchsia-500 bg-fuchsia-500/10' : 'text-zinc-600'}`}><t.icon className="w-5 h-5" /><span className="text-[10px] font-medium">{t.label}</span></button>))}
      </nav>
      <Dialog open={showRequestModal} onOpenChange={setShowRequestModal}><DialogContent className="bg-zinc-900 border-zinc-800 w-[90%] rounded-2xl"><DialogHeader><DialogTitle>Richiedi Canzone</DialogTitle></DialogHeader><form onSubmit={handleRequestSong} className="space-y-4 mt-2"><Input value={songTitle} onChange={e => setSongTitle(e.target.value)} placeholder="Titolo" className="bg-black border-zinc-700 h-12"/><Input value={songArtist} onChange={e => setSongArtist(e.target.value)} placeholder="Artista" className="bg-black border-zinc-700 h-12"/><Input value={songYoutubeUrl} onChange={e => setSongYoutubeUrl(e.target.value)} placeholder="Link YT (Opzionale)" className="bg-black border-zinc-700 h-10 text-xs"/><Button type="submit" className="w-full bg-fuchsia-600 h-12 font-bold">INVIA</Button></form></DialogContent></Dialog>
      <Dialog open={showVoteModal} onOpenChange={setShowVoteModal}><DialogContent className="bg-zinc-900 border-zinc-800 text-center w-[90%] rounded-2xl"><DialogHeader><DialogTitle>Vota l'Esibizione!</DialogTitle></DialogHeader><div className="flex justify-center gap-2 py-6">{[1, 2, 3, 4, 5].map(s => (<button key={s} onClick={() => setSelectedStars(s)}><Star className={`w-10 h-10 ${selectedStars >= s ? 'text-yellow-500 fill-yellow-500' : 'text-zinc-700'}`} /></button>))}</div><Button onClick={handleVote} disabled={selectedStars === 0} className="w-full bg-yellow-500 text-black font-bold h-12">CONFERMA</Button></DialogContent></Dialog>
      <Dialog open={showMessageModal} onOpenChange={setShowMessageModal}><DialogContent className="bg-zinc-900 border-zinc-800 w-[90%] rounded-2xl"><DialogHeader><DialogTitle>Messaggio</DialogTitle></DialogHeader><Input value={messageText} onChange={e => setMessageText(e.target.value)} placeholder="..." className="bg-black border-zinc-700 h-12"/><Button onClick={handleSendMessage} className="w-full mt-4 bg-cyan-600 font-bold h-12">INVIA</Button></DialogContent></Dialog>
      <Dialog open={showQuizModal} onOpenChange={o => !o && forceCloseQuiz()}><DialogContent className="bg-[#0f0f11] border border-fuchsia-500/30 max-w-md w-[95%] rounded-3xl p-0 overflow-hidden shadow-2xl">
          <div className="bg-gradient-to-r from-fuchsia-900 to-purple-900 p-6 text-center"><DialogTitle className="text-2xl font-black text-white italic">{activeQuiz?.status === 'closed' ? "TEMPO SCADUTO" : activeQuiz?.status === 'leaderboard' ? "CLASSIFICA" : quizResult ? "RISULTATO" : "QUIZ TIME!"}</DialogTitle></div>
          <div className="p-6">
              {activeQuiz?.status === 'leaderboard' && (<div className="text-center py-4"><Trophy className="w-24 h-24 text-yellow-500 mx-auto mb-4 animate-bounce" /><p className="font-bold text-white">Guarda il Maxischermo!</p></div>)}
              {!quizResult && activeQuiz && activeQuiz.status !== 'leaderboard' && (<div className="py-2"><div className="bg-zinc-800/50 p-4 rounded-xl border border-white/5 mb-6"><p className="text-lg text-center font-bold text-white">{activeQuiz.question}</p></div>
                  {activeQuiz.status === 'closed' ? (<div className="text-center p-8 bg-black/30 rounded-2xl border-2 border-dashed border-zinc-700"><Lock className="w-12 h-12 mx-auto text-red-500 mb-2" /><p className="font-bold text-red-400">Televoto chiuso</p></div>) : (<div className="space-y-3">{activeQuiz.options.map((o, i) => (<button key={i} onClick={() => handleQuizAnswer(i)} disabled={quizAnswer !== null} className={`w-full p-4 rounded-xl border-2 text-left flex items-center ${quizAnswer === i ? 'bg-fuchsia-600 border-fuchsia-500 text-white' : 'border-white/10 bg-zinc-800'}`}><span className="font-black mr-4 w-8 h-8 flex items-center justify-center rounded-lg bg-black/30 text-sm">{String.fromCharCode(65 + i)}</span><span className="flex-1 font-bold text-sm">{o}</span></button>))}</div>)}</div>)}
              {quizResult && activeQuiz?.status !== 'leaderboard' && (<div className="text-center py-2"><p className="text-xs text-zinc-500 uppercase tracking-widest mb-2">Risposta Corretta</p><div className="bg-green-500/10 border-2 border-green-500 p-6 rounded-2xl mb-8"><p className="text-2xl font-black text-white">{quizResult.correct_option}</p></div>{pointsEarned > 0 ? (<div className="bg-fuchsia-600 p-4 rounded-xl mb-6"><div className="flex items-center justify-center gap-2 text-white"><Zap className="w-6 h-6 fill-yellow-300 text-yellow-300" /><p className="font-black text-xl">HAI VINTO {pointsEarned} PUNTI!</p></div></div>) : (<div className="bg-zinc-800 p-4 rounded-xl mb-6"><p className="text-red-400 font-bold">Risposta sbagliata</p></div>)}</div>)}
          </div></DialogContent></Dialog>
    </div>
  );
}