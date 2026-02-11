import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Home, Music, Trophy, Camera, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase"; 
import api from "@/lib/api";

const EMOJIS = ["❤️", "🔥", "👏", "🎤", "⭐", "🎉"];
const AVATAR_PRESETS = [
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix",
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka",
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Zack",
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Luna",
    "https://api.dicebear.com/7.x/bottts/svg?seed=Robot",
    "https://api.dicebear.com/7.x/fun-emoji/svg?seed=Happy"
];

export default function ClientApp() {
  const { pubCode } = useParams();
  const navigate = useNavigate();
  const { user, login, isAuthenticated, logout } = useAuth();
  
  // Login States
  const [nickname, setNickname] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState(AVATAR_PRESETS[0]);
  const [customFile, setCustomFile] = useState(null);
  const [isJoining, setIsJoining] = useState(false);

  // App States
  const [activeTab, setActiveTab] = useState("home");
  const [queue, setQueue] = useState([]);
  const [myRequests, setMyRequests] = useState([]);
  const [currentPerf, setCurrentPerf] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  
  // Quiz
  const [activeQuiz, setActiveQuiz] = useState(null);
  const [quizResult, setQuizResult] = useState(null);
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [quizAnswer, setQuizAnswer] = useState(null);
  const [pointsEarned, setPointsEarned] = useState(0);

  // Modals
  const [showReq, setShowReq] = useState(false);
  const [songInput, setSongInput] = useState({ title: "", artist: "" });
  const [showVote, setShowVote] = useState(false);
  const [voteVal, setVoteVal] = useState(0);

  const pollRef = useRef(null);

  // --- JOIN LOGIC ---
  const handleJoin = async (e) => {
      e.preventDefault();
      if (!nickname) return toast.error("Inserisci Nickname");
      setIsJoining(true);
      
      try {
          let avatarUrl = selectedAvatar;
          if (customFile) {
              avatarUrl = await api.uploadLogo(customFile);
          }
          await login(pubCode, nickname, avatarUrl);
      } catch (err) {
          toast.error(err.message);
          setIsJoining(false);
      }
  };

  const handleFileChange = (e) => {
      const file = e.target.files[0];
      if (file) {
          setCustomFile(file);
          setSelectedAvatar(URL.createObjectURL(file)); 
      }
  };

  const forceCloseQuiz = () => {
      setShowQuizModal(false);
      setActiveQuiz(null);
      setQuizResult(null);
      setQuizAnswer(null);
      setPointsEarned(0);
  };

  // --- DATA LOADING ---
  const loadData = useCallback(async () => {
    if(!isAuthenticated) return;
    try {
        const [q, my, perf, lb, quiz] = await Promise.all([
            api.getSongQueue(), 
            api.getMyRequests(), 
            api.getCurrentPerformance(), 
            api.getLeaderboard(), 
            api.getActiveQuiz()
        ]);
        
        setQueue(q.data); 
        setMyRequests(my.data); 
        setLeaderboard(lb.data);

        // Performance Check
        const newPerf = perf.data;
        setCurrentPerf(prev => {
            // Se inizia il voto
            if (newPerf?.status === 'voting' && prev?.status !== 'voting' && newPerf.participant_id !== user.id) {
                setShowVote(true);
            }
            return newPerf;
        });

        // Quiz Check
        const sQuiz = quiz.data;
        if (!sQuiz) {
            if (showQuizModal) forceCloseQuiz();
        } else {
            if (sQuiz.status === 'active' || sQuiz.status === 'closed') {
                setActiveQuiz(prev => {
                    if (!prev || prev.id !== sQuiz.id) {
                        setQuizAnswer(null); setQuizResult(null); setPointsEarned(0); setShowQuizModal(true);
                    }
                    return sQuiz;
                });
            } else if (sQuiz.status === 'showing_results') {
                if (!quizResult) { 
                    const res = await api.getQuizResults(sQuiz.id); 
                    setQuizResult(res.data); 
                }
                setActiveQuiz(sQuiz);
                if (!showQuizModal) setShowQuizModal(true);
            } else if (sQuiz.status === 'ended') {
                forceCloseQuiz();
            }
        }
    } catch (e) { 
        console.error(e); 
        // FIX CRITICO: Se il token è scaduto, butta fuori l'utente per evitare loop
        if(e.message === 'Not authenticated' || e.message.includes('token')) {
            logout();
        }
    }
  }, [isAuthenticated, showQuizModal, quizResult, user, logout]);

  useEffect(() => {
    if (isAuthenticated) {
        loadData();
        pollRef.current = setInterval(loadData, 3000);
        
        const ch = supabase.channel('client_room')
            .on('postgres_changes', {event: '*', schema: 'public', table: 'performances'}, (p) => {
                if (p.new.status === 'live') forceCloseQuiz();
                loadData();
            })
            .on('postgres_changes', {event: '*', schema: 'public', table: 'quizzes'}, loadData)
            .subscribe();
            
        return () => { clearInterval(pollRef.current); supabase.removeChannel(ch); };
    }
  }, [isAuthenticated, loadData]);

  // --- ACTIONS ---
  const sendRequest = async () => {
      if(!songInput.title) return toast.error("Titolo mancante");
      try { await api.requestSong(songInput); toast.success("Inviata!"); setShowReq(false); setSongInput({title:"", artist:""}); loadData(); }
      catch(e){ toast.error("Errore invio"); }
  };

  const sendVote = async () => {
      if(voteVal === 0) return;
      try { await api.submitVote({ performance_id: currentPerf.id, score: voteVal }); toast.success("Votato!"); setShowVote(false); }
      catch(e){ toast.error("Errore voto"); setShowVote(false); }
  };

  const sendQuizAns = async (idx) => {
      if(quizAnswer !== null) return;
      setQuizAnswer(idx);
      try {
          const res = await api.answerQuiz({ quiz_id: activeQuiz.id, answer_index: idx });
          if(res.data.points_earned > 0) {
              setPointsEarned(res.data.points_earned);
              toast.success(`+${res.data.points_earned} Punti!`);
          }
      } catch(e) { toast.error("Errore risposta"); }
  };

  // --- RENDER LOGIN ---
  if (!isAuthenticated) {
      return (
          <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6">
              <div className="w-full max-w-md space-y-8 text-center">
                  <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-500 to-cyan-500">NEONPUB</h1>
                  <p className="text-zinc-400">Inserisci i tuoi dati per partecipare</p>
                  
                  <div className="space-y-4">
                      {/* Avatar Selection */}
                      <div className="flex justify-center mb-6">
                          <div className="relative">
                              <img src={selectedAvatar} className="w-24 h-24 rounded-full border-4 border-fuchsia-600 object-cover bg-zinc-800" />
                              <label htmlFor="avatar-upload" className="absolute bottom-0 right-0 bg-white text-black p-2 rounded-full cursor-pointer">
                                  <Camera className="w-4 h-4"/>
                              </label>
                              <input id="avatar-upload" type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                          </div>
                      </div>
                      <div className="flex gap-2 justify-center overflow-x-auto py-2">
                          {AVATAR_PRESETS.map((url, i) => (
                              <img key={i} src={url} onClick={()=>setSelectedAvatar(url)} className={`w-10 h-10 rounded-full cursor-pointer border-2 ${selectedAvatar===url?'border-fuchsia-500':'border-transparent'}`} />
                          ))}
                      </div>

                      <Input placeholder="Il tuo Nickname" value={nickname} onChange={e=>setNickname(e.target.value)} className="bg-zinc-900 border-zinc-700 h-12 text-center text-lg"/>
                      
                      <Button onClick={handleJoin} disabled={isJoining} className="w-full bg-gradient-to-r from-fuchsia-600 to-purple-600 h-14 font-bold text-xl rounded-xl">
                          {isJoining ? "Entrando..." : "ENTRA NEL PUB"}
                      </Button>
                  </div>
              </div>
          </div>
      );
  }

  // --- RENDER APP ---
  return (
    <div className="min-h-screen bg-zinc-950 pb-24 text-white font-sans">
      {/* HEADER CORRETTO */}
      <header className="sticky top-0 bg-zinc-950/90 backdrop-blur border-b border-white/10 p-4 flex justify-between items-center z-40">
          <div className="flex items-center gap-3">
              <img src={user.avatar_url} className="w-8 h-8 rounded-full border border-fuchsia-500 object-cover"/>
              <div>
                  <h1 className="font-bold text-sm leading-none">{user.pub_name}</h1>
                  <p className="text-xs text-zinc-500">{user.nickname}</p>
              </div>
          </div>
          <Button variant="ghost" size="sm" onClick={logout} className="text-zinc-500 text-xs">Esci</Button>
      </header>

      <main className="p-4 space-y-6">
          {activeTab === 'home' && (
              <>
                  {currentPerf ? (
                      <div className="bg-gradient-to-br from-zinc-900 to-black p-5 rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden">
                          <div className="absolute top-0 right-0 p-4 opacity-10"><Music className="w-32 h-32"/></div>
                          <div className="relative z-10">
                              <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${currentPerf.status==='live'?'bg-red-500 animate-pulse':'bg-zinc-700'}`}>{currentPerf.status}</span>
                              <h2 className="text-2xl font-black mt-3 leading-tight">{currentPerf.song_title}</h2>
                              <p className="text-fuchsia-400 font-medium mb-4">{currentPerf.song_artist}</p>
                              <div className="flex items-center gap-2 mb-4">
                                  <img src={currentPerf.user_avatar} className="w-6 h-6 rounded-full"/>
                                  <span className="font-bold text-sm">{currentPerf.user_nickname}</span>
                              </div>
                              {currentPerf.status === 'live' && (
                                  <div className="grid grid-cols-6 gap-2">
                                      {EMOJIS.map(e => <button key={e} onClick={()=>api.sendReaction({emoji:e})} className="bg-white/5 rounded-lg p-2 text-xl active:scale-90">{e}</button>)}
                                  </div>
                              )}
                              {currentPerf.status === 'voting' && (
                                  <Button onClick={()=>setShowVote(true)} className="w-full bg-yellow-500 text-black font-bold animate-pulse">VOTA ORA</Button>
                              )}
                          </div>
                      </div>
                  ) : (
                      <div className="text-center p-8 bg-zinc-900/50 rounded-3xl border-2 border-dashed border-zinc-800 text-zinc-500">
                          <Music className="w-12 h-12 mx-auto mb-2 opacity-50"/>
                          <p>Nessuna esibizione</p>
                      </div>
                  )}

                  <Button onClick={()=>setShowReq(true)} className="w-full h-16 rounded-2xl bg-gradient-to-r from-fuchsia-700 to-purple-800 font-bold text-lg shadow-lg">
                      RICHIEDI CANZONE
                  </Button>

                  <div className="space-y-3">
                      <h3 className="text-xs font-bold text-zinc-500 uppercase">Prossimi in coda</h3>
                      {queue.map((q,i) => (
                          <div key={i} className="bg-zinc-900 p-3 rounded-xl flex items-center gap-3 border border-white/5">
                              <span className="font-mono text-zinc-600 font-bold text-lg w-6">#{i+1}</span>
                              <div className="overflow-hidden">
                                  <div className="font-bold truncate text-sm">{q.title}</div>
                                  <div className="text-xs text-zinc-500 truncate">{q.artist}</div>
                              </div>
                              <img src={q.user_avatar} className="w-6 h-6 rounded-full ml-auto"/>
                          </div>
                      ))}
                  </div>
              </>
          )}

          {activeTab === 'leaderboard' && (
              <div className="space-y-4">
                  <h2 className="text-xl font-bold flex items-center gap-2"><Trophy className="text-yellow-500"/> Classifica</h2>
                  {leaderboard.map((p,i) => (
                      <div key={i} className={`p-4 rounded-xl flex items-center gap-4 border ${i===0?'bg-yellow-900/20 border-yellow-500/50': 'bg-zinc-900 border-white/5'}`}>
                          <span className={`font-bold text-lg w-6 ${i===0?'text-yellow-500':'text-zinc-600'}`}>#{i+1}</span>
                          <img src={p.avatar_url} className="w-10 h-10 rounded-full object-cover bg-zinc-800"/>
                          <span className="font-bold flex-1">{p.nickname}</span>
                          <span className="font-mono text-fuchsia-400 font-bold">{p.score}</span>
                      </div>
                  ))}
              </div>
          )}
      </main>

      {/* NAV */}
      <nav className="fixed bottom-0 w-full bg-zinc-950 border-t border-white/10 flex justify-around p-2 pb-safe z-50">
          <button onClick={()=>setActiveTab('home')} className={`p-2 rounded-xl flex flex-col items-center w-16 ${activeTab==='home'?'text-fuchsia-500':'text-zinc-600'}`}><Home className="w-5 h-5"/><span className="text-[10px]">Home</span></button>
          <button onClick={()=>setActiveTab('leaderboard')} className={`p-2 rounded-xl flex flex-col items-center w-16 ${activeTab==='leaderboard'?'text-fuchsia-500':'text-zinc-600'}`}><Trophy className="w-5 h-5"/><span className="text-[10px]">Top</span></button>
      </nav>

      {/* REQUEST MODAL */}
      <Dialog open={showReq} onOpenChange={setShowReq}>
          <DialogContent className="bg-zinc-900 border-zinc-800 w-[95%] rounded-3xl" aria-describedby={undefined}>
              <DialogHeader>
                  <DialogTitle>Richiedi Canzone</DialogTitle>
                  <DialogDescription className="hidden">Inserisci dettagli canzone</DialogDescription>
              </DialogHeader>
              <div className="space-y-3 pt-4">
                  <Input placeholder="Titolo" value={songInput.title} onChange={e=>setSongInput({...songInput, title:e.target.value})} className="bg-black h-12"/>
                  <Input placeholder="Artista" value={songInput.artist} onChange={e=>setSongInput({...songInput, artist:e.target.value})} className="bg-black h-12"/>
                  <Button onClick={sendRequest} className="w-full h-12 bg-fuchsia-600 font-bold">INVIA</Button>
              </div>
          </DialogContent>
      </Dialog>

      {/* VOTE MODAL */}
      <Dialog open={showVote} onOpenChange={setShowVote}>
          <DialogContent className="bg-zinc-900 border-zinc-800 w-[95%] rounded-3xl text-center" aria-describedby={undefined}>
              <DialogHeader>
                  <DialogTitle>Vota {currentPerf?.user_nickname}</DialogTitle>
                  <DialogDescription className="hidden">Vota l'esibizione</DialogDescription>
              </DialogHeader>
              <div className="flex justify-center gap-2 py-6">
                  {[1,2,3,4,5].map(s => <button key={s} onClick={()=>setVoteVal(s)} className={`text-4xl transition-transform active:scale-90 ${voteVal>=s?'grayscale-0':'grayscale opacity-30'}`}>⭐</button>)}
              </div>
              <Button onClick={sendVote} className="w-full bg-yellow-500 text-black font-bold h-12">CONFERMA</Button>
          </DialogContent>
      </Dialog>

      {/* QUIZ MODAL */}
      <Dialog open={showQuizModal} onOpenChange={o => !o && forceCloseQuiz()}>
          <DialogContent className="bg-[#0f0f11] border-fuchsia-500/30 w-[95%] rounded-3xl p-0 overflow-hidden shadow-2xl" aria-describedby={undefined}>
              <DialogHeader className="sr-only"><DialogTitle>Quiz</DialogTitle></DialogHeader>
              <div className="bg-gradient-to-r from-fuchsia-900 to-purple-900 p-6 text-center">
                  <h2 className="text-xl font-black text-white italic tracking-wider">
                      {activeQuiz?.status === 'closed' ? "TEMPO SCADUTO" : quizResult ? "RISULTATO" : "QUIZ TIME!"}
                  </h2>
              </div>
              <div className="p-6">
                  {!quizResult && activeQuiz && (
                      <>
                          <div className="bg-zinc-800/50 p-4 rounded-xl mb-6 text-center border border-white/5">
                              <p className="font-bold text-white text-lg">{activeQuiz.question}</p>
                          </div>
                          {activeQuiz.status === 'closed' ? (
                              <div className="text-center p-8 text-red-400 font-bold border-2 border-dashed border-zinc-700 rounded-xl">🔒 IL TELEVOTO È CHIUSO</div>
                          ) : (
                              <div className="space-y-3">
                                  {activeQuiz.options.map((o,i) => (
                                      <button key={i} onClick={()=>sendQuizAns(i)} disabled={quizAnswer!==null} className={`w-full p-4 rounded-xl border-2 text-left flex items-center gap-3 transition-all ${quizAnswer===i?'bg-fuchsia-600 border-fuchsia-500 text-white':'bg-zinc-800 border-white/5 hover:bg-zinc-700'}`}>
                                          <span className="font-black bg-black/20 w-8 h-8 flex items-center justify-center rounded-lg">{String.fromCharCode(65+i)}</span>
                                          <span className="font-bold text-sm">{o}</span>
                                      </button>
                                  ))}
                              </div>
                          )}
                      </>
                  )}
                  {quizResult && (
                      <div className="text-center animate-in zoom-in">
                          <p className="text-xs text-zinc-500 uppercase font-bold mb-2">Risposta Corretta</p>
                          <div className="bg-green-600/20 border-2 border-green-500 p-4 rounded-xl mb-6">
                              <span className="text-2xl font-black text-white">{quizResult.correct_option}</span>
                          </div>
                          {pointsEarned > 0 ? (
                              <div className="bg-gradient-to-r from-yellow-500 to-orange-500 p-4 rounded-xl shadow-lg">
                                  <p className="text-black font-black text-xl flex items-center justify-center gap-2"><Zap className="fill-black"/> +{pointsEarned} PUNTI</p>
                              </div>
                          ) : (
                              <p className="text-zinc-500 text-sm">Nessun punto guadagnato.</p>
                          )}
                      </div>
                  )}
              </div>
          </DialogContent>
      </Dialog>
    </div>
  );
}