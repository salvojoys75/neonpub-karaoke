import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Music, Play, Square, Trophy, Tv, Star, HelpCircle,
  Check, X, MessageSquare, LogOut, SkipForward, Pause,
  RotateCcw, Mic2, Search, Send, Coins, BookOpen, 
  Upload, EyeOff, VolumeX, Volume2, Eye, Plus, Lock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"; 
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase"; 
import api, { createPub } from "@/lib/api"; 

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { isAuthenticated, logout } = useAuth();
 
  // --- STATI PROFILO ---
  const [appState, setAppState] = useState("loading");
  const [profile, setProfile] = useState(null);
  const [operators, setOperators] = useState([]);
  const [newEventName, setNewEventName] = useState("");
  const [creatingEvent, setCreatingEvent] = useState(false);

  // --- STATI DASHBOARD ---
  const [queue, setQueue] = useState([]);
  const [currentPerformance, setCurrentPerformance] = useState(null);
  const [activeSection, setActiveSection] = useState("queue");
  const [pendingMessages, setPendingMessages] = useState([]);
  
  // --- STATI QUIZ (Libreria + Manuale) ---
  const [libraryQuizzes, setLibraryQuizzes] = useState([]);
  const [jsonImport, setJsonImport] = useState("");
  const [showQuizModal, setShowQuizModal] = useState(false); // Modale creazione manuale
  
  // Quiz Manuale form
  const [quizQuestion, setQuizQuestion] = useState("");
  const [quizOptions, setQuizOptions] = useState(["", "", "", ""]);
  const [quizCorrectIndex, setQuizCorrectIndex] = useState(0); 

  // Quiz Live Controllo
  const [activeQuizId, setActiveQuizId] = useState(null);
  const [quizResults, setQuizResults] = useState(null);
  const [quizStatus, setQuizStatus] = useState(null); // 'active', 'closed', 'showing_results'
  
  // --- YOUTUBE ---
  const [showYoutubeModal, setShowYoutubeModal] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [youtubeSearchQuery, setYoutubeSearchQuery] = useState("");
  const [youtubeSearchResults, setYoutubeSearchResults] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [searchingYoutube, setSearchingYoutube] = useState(false);
  
  // --- MESSAGGI REGIA ---
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [adminMessage, setAdminMessage] = useState("");

  const [pubCode, setPubCode] = useState(localStorage.getItem("neonpub_pub_code"));
  const pollIntervalRef = useRef(null);

  // --- INIT ---
  useEffect(() => { checkUserProfile(); }, [isAuthenticated]);

  const checkUserProfile = async () => {
    if (!isAuthenticated) return; 
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      let { data: userProfile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (!userProfile) {
         const { data: newProfile } = await supabase.from('profiles').insert([{ id: user.id, email: user.email, role: 'operator', credits: 0 }]).select().single();
         userProfile = newProfile;
      }
      setProfile(userProfile);
      if (userProfile.role === 'super_admin') {
         setAppState("super_admin");
         const { data } = await supabase.from('profiles').select('*').neq('role', 'super_admin');
         setOperators(data || []);
      } else {
         const storedCode = localStorage.getItem("neonpub_pub_code");
         if (storedCode) { setPubCode(storedCode); setAppState("dashboard"); } 
         else { setAppState("setup"); }
      }
    } catch (error) { setAppState("setup"); }
  };

  const handleLogout = () => { localStorage.removeItem("neonpub_pub_code"); logout(); navigate("/"); };

  // --- CARICAMENTO DATI ---
  const loadData = useCallback(async () => {
    if (!pubCode || appState !== 'dashboard') return;
    try {
      const [queueRes, perfRes, messagesRes, quizRes] = await Promise.all([
        api.getAdminQueue(),
        api.getAdminCurrentPerformance(),
        api.getAdminPendingMessages(),
        api.getActiveQuiz()
      ]);
      setQueue(queueRes.data || []);
      setCurrentPerformance(perfRes.data);
      setPendingMessages(messagesRes.data || []);
      
      // Sincronizza stato Quiz
      if (quizRes.data) {
          setActiveQuizId(quizRes.data.id);
          setQuizStatus(quizRes.data.status);
          setQuizQuestion(quizRes.data.question);
          if (quizRes.data.status === 'showing_results' && !quizResults) {
             const res = await api.getQuizResults(quizRes.data.id);
             setQuizResults(res.data);
          }
      } else {
          // Se non c'è quiz dal server ma ne avevamo uno locale, resettiamo
          if (activeQuizId) {
             setActiveQuizId(null); setQuizStatus(null); setQuizResults(null);
          }
      }
    } catch (error) { console.error(error); }
  }, [pubCode, appState, activeQuizId, quizResults]);

  const loadLibrary = useCallback(async () => {
    if (activeSection === 'library') {
      try {
        const { data } = await api.getLibraryQuizzes();
        setLibraryQuizzes(data || []);
      } catch (error) { console.error(error); }
    }
  }, [activeSection]);

  useEffect(() => {
    if (isAuthenticated && appState === 'dashboard' && pubCode) {
      loadData(); loadLibrary();
      pollIntervalRef.current = setInterval(loadData, 3000);
      return () => clearInterval(pollIntervalRef.current);
    }
  }, [isAuthenticated, appState, pubCode, loadData, loadLibrary]);

  // --- AZIONI YOUTUBE ---
  const searchYouTube = async () => {
    if (!youtubeSearchQuery.trim()) return; 
    setSearchingYoutube(true);
    try {
      const apiKey = process.env.REACT_APP_YOUTUBE_API_KEY;
      const res = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(youtubeSearchQuery)}&type=video&maxResults=5&key=${apiKey}`);
      const data = await res.json(); 
      setYoutubeSearchResults(data.items || []);
    } catch (error) { toast.error("Errore ricerca YouTube"); } 
    finally { setSearchingYoutube(false); }
  };
  
  const handleStartLive = (req) => { 
      setSelectedRequest(req); 
      setYoutubeSearchQuery(req.title + " " + req.artist + " karaoke"); // Precompila ricerca
      setYoutubeUrl(req.youtube_url || ""); 
      setYoutubeSearchResults([]); // Pulisci vecchi risultati
      setShowYoutubeModal(true); 
  };
  
  const startPerformance = async () => { 
      try { 
          await api.startPerformance(selectedRequest.id, youtubeUrl); 
          setShowYoutubeModal(false); 
          loadData(); 
          toast.success("Live Avviata!");
      } catch(e) { toast.error("Errore avvio live"); } 
  };

  // --- AZIONI PERFORMANCE ---
  const handleToggleMute = async () => { if(currentPerformance) await api.togglePerformanceMute(currentPerformance.id, !currentPerformance.is_muted); loadData(); };
  const handleToggleBlur = async () => { if(currentPerformance) await api.togglePerformanceBlur(currentPerformance.id, !currentPerformance.is_blurred); loadData(); };

  // --- AZIONI QUIZ ---
  const handleStartManualQuiz = async (e) => { 
    e.preventDefault(); 
    if (!quizQuestion.trim() || quizOptions.some(o => !o.trim())) { toast.error("Compila tutti i campi"); return; } 
    try { 
        const { data } = await api.startQuiz({ category: "custom", question: quizQuestion, options: quizOptions, correct_index: quizCorrectIndex, points: 10 }); 
        setActiveQuizId(data.id); setQuizStatus('active'); setQuizResults(null); 
        toast.success("Quiz Manuale Lanciato!"); setShowQuizModal(false); 
    } catch (error) { toast.error("Errore lancio quiz"); } 
  };

  const handleLaunchLibraryQuiz = async (quizId) => {
    try {
      const { data } = await api.launchQuizFromLibrary(quizId);
      setActiveQuizId(data.id); setQuizStatus('active'); setQuizResults(null);
      setQuizQuestion(data.question);
      toast.success("Quiz Libreria Lanciato!");
      setActiveSection('quiz');
    } catch (e) { toast.error("Errore: " + e.message); }
  };

  const handleStopVoting = async () => { await api.closeQuizVoting(activeQuizId); setQuizStatus('closed'); toast.info("Voto chiuso!"); };
  const handleShowResults = async () => { await api.showQuizResults(activeQuizId); const { data } = await api.getQuizResults(activeQuizId); setQuizResults(data); setQuizStatus('showing_results'); };
  const handleEndQuiz = async () => { await api.endQuiz(activeQuizId); setActiveQuizId(null); setQuizStatus(null); setQuizResults(null); loadData(); toast.success("Quiz Terminato"); };

  const handleBulkImport = async () => {
    try {
        const data = JSON.parse(jsonImport);
        await api.importQuizBatch(data);
        toast.success("Importazione riuscita!"); setJsonImport(""); loadLibrary();
    } catch(e) { toast.error("JSON non valido"); }
  };

  // --- AZIONI MESSAGGI & ALTRO ---
  const handleApproveMessage = async (id) => { await api.approveMessage(id); loadData(); };
  const handleRejectMessage = async (id) => { await api.rejectMessage(id); loadData(); };
  const handleBroadcastMessage = async () => { if(adminMessage) { await api.sendMessage({ text: adminMessage, status: 'approved' }); setShowMessageModal(false); setAdminMessage(""); toast.success("Messaggio inviato!"); }};
  const handleOpenDisplay = () => window.open(`/display/${pubCode}`, 'NeonPub', 'width=1280,height=720');
  
  const handleStartEvent = async () => {
    if (!newEventName) return toast.error("Inserisci nome evento");
    setCreatingEvent(true);
    try {
        const { data: pubData } = await createPub({ name: newEventName });
        localStorage.setItem("neonpub_pub_code", pubData.code); setPubCode(pubData.code);
        toast.success("Evento Creato!"); setAppState("dashboard");
    } catch (error) { toast.error(error.message); } finally { setCreatingEvent(false); }
  };


  // --- RENDER ---
  if (appState === 'loading') return <div className="h-screen bg-black text-white flex items-center justify-center">Caricamento...</div>;

  if (appState === 'setup') return (
    <div className="min-h-screen bg-zinc-950 text-white p-6 flex items-center justify-center">
       <Card className="w-full max-w-lg bg-zinc-900 border-zinc-800">
          <CardHeader><CardTitle>Nuovo Evento Karaoke</CardTitle></CardHeader>
          <CardContent className="space-y-4">
             <div className="bg-yellow-500/10 text-yellow-500 p-3 rounded text-center mb-4"><Coins className="inline w-4 h-4 mr-2"/>Crediti: {profile?.credits}</div>
             <Input placeholder="Nome del Locale" value={newEventName} onChange={e => setNewEventName(e.target.value)} className="bg-black border-zinc-700 h-12 text-lg text-center"/>
             <Button onClick={handleStartEvent} disabled={creatingEvent} className="w-full bg-fuchsia-600 h-12 text-lg">Lancia Evento (-1 Credito)</Button>
          </CardContent>
       </Card>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050505] flex text-white font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-zinc-900/50 border-r border-white/5 p-6 flex flex-col">
        <div className="mb-6">
           <h1 className="text-2xl font-bold">Regia</h1>
           <p className="text-zinc-500 text-sm">Codice: <span className="text-cyan-400 font-mono font-bold">{pubCode}</span></p>
        </div>
        <nav className="space-y-2 flex-1">
          {[
            { id: "queue", icon: Music, label: "Coda" }, 
            { id: "performance", icon: Mic2, label: "Live Control" }, 
            { id: "library", icon: BookOpen, label: "Libreria Quiz" }, 
            { id: "quiz", icon: HelpCircle, label: "Quiz Live" },
            { id: "messages", icon: MessageSquare, label: "Messaggi" }
          ].map(item => (
            <button key={item.id} onClick={() => setActiveSection(item.id)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeSection === item.id ? 'bg-fuchsia-600 shadow-lg shadow-fuchsia-900/20' : 'hover:bg-white/5 text-zinc-400'}`}>
              <item.icon className="w-5 h-5" /><span>{item.label}</span>
              {item.id === 'queue' && queue.filter(q=>q.status==='pending').length > 0 && <span className="ml-auto bg-red-500 text-xs px-2 py-0.5 rounded-full text-white">{queue.filter(q=>q.status==='pending').length}</span>}
              {item.id === 'messages' && pendingMessages.length > 0 && <span className="ml-auto bg-red-500 text-xs px-2 py-0.5 rounded-full text-white">{pendingMessages.length}</span>}
            </button>
          ))}
        </nav>
        <div className="space-y-3 pt-6 border-t border-white/10">
          <Button onClick={handleOpenDisplay} className="w-full bg-cyan-600 hover:bg-cyan-700"><Tv className="w-4 h-4 mr-2"/> Apri Display</Button>
          <Button onClick={() => setShowMessageModal(true)} variant="outline" className="w-full border-zinc-700 hover:bg-zinc-800"><MessageSquare className="w-4 h-4 mr-2"/> Msg Regia</Button>
          <Button onClick={handleLogout} variant="ghost" className="w-full text-zinc-500 hover:text-red-400"><LogOut className="w-4 h-4 mr-2"/> Esci</Button>
        </div>
      </aside>

      {/* Main Area */}
      <main className="flex-1 p-8 overflow-y-auto">
        
        {/* SEZIONE 1: CODA */}
        {activeSection === "queue" && (
           <div className="space-y-6">
             <h2 className="text-3xl font-bold mb-4">Gestione Coda</h2>
             
             {/* Richieste in Attesa */}
             {queue.filter(r => r.status === 'pending').length > 0 && (
               <div className="space-y-2 mb-8">
                 <h3 className="text-yellow-500 font-bold text-sm uppercase tracking-wider">In Attesa di Approvazione</h3>
                 {queue.filter(r => r.status === 'pending').map(req => (
                   <div key={req.id} className="glass p-4 flex items-center justify-between bg-zinc-900 border border-yellow-500/30 rounded-xl">
                     <div><p className="font-bold text-lg">{req.title}</p><p className="text-zinc-400">{req.user_nickname} • {req.artist}</p></div>
                     <div className="flex gap-2">
                        <Button onClick={()=>handleApprove(req.id)} className="bg-green-600 hover:bg-green-700"><Check className="w-4 h-4"/></Button>
                        <Button onClick={()=>handleReject(req.id)} className="bg-red-600 hover:bg-red-700"><X className="w-4 h-4"/></Button>
                     </div>
                   </div>
                 ))}
               </div>
             )}

             {/* Coda Approvata */}
             <div className="space-y-2">
                <h3 className="text-cyan-500 font-bold text-sm uppercase tracking-wider">In Scaletta</h3>
                {queue.filter(r => r.status === 'queued').length === 0 ? <p className="text-zinc-600 italic">Coda vuota.</p> : queue.filter(r => r.status === 'queued').map((req, i) => (
                  <div key={req.id} className="glass p-4 flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-xl">
                    <div className="flex items-center gap-4">
                       <span className="font-mono text-2xl text-zinc-600 font-bold w-8">{i+1}</span>
                       <div><p className="font-bold text-lg">{req.title}</p><p className="text-zinc-400">{req.user_nickname}</p></div>
                    </div>
                    {/* Se non c'è live, mostra tasto play */}
                    {!currentPerformance && <Button onClick={() => handleStartLive(req)} className="bg-fuchsia-600 hover:bg-fuchsia-700 px-6"><Play className="w-5 h-5 mr-2"/> Manda Live</Button>}
                  </div>
                ))}
             </div>
           </div>
        )}

        {/* SEZIONE 2: LIVE CONTROL */}
        {activeSection === "performance" && (
           <div className="space-y-6">
              <h2 className="text-3xl font-bold mb-4">Controllo Live</h2>
              {currentPerformance ? (
                 <div className="glass p-8 bg-zinc-900 border-zinc-800 rounded-2xl shadow-2xl">
                    <div className="flex justify-between items-start mb-8">
                       <div>
                          <div className="flex items-center gap-2 mb-2">
                             <span className={`w-3 h-3 rounded-full ${currentPerformance.status === 'live' ? 'bg-red-500 animate-pulse' : 'bg-yellow-500'}`}></span>
                             <span className="text-sm font-bold uppercase tracking-wider text-zinc-400">{currentPerformance.status}</span>
                          </div>
                          <h3 className="text-4xl font-bold text-white mb-2">{currentPerformance.song_title}</h3>
                          <p className="text-2xl text-zinc-400">{currentPerformance.song_artist}</p>
                          <p className="text-fuchsia-500 mt-2 font-bold">🎤 {currentPerformance.user_nickname}</p>
                       </div>
                       <div className="text-right bg-black/30 p-4 rounded-xl">
                          <div className="flex items-center gap-2 justify-end text-yellow-500 mb-1"><Star className="w-8 h-8 fill-yellow-500"/> <span className="text-4xl font-bold">{currentPerformance.average_score || 0}</span></div>
                          <p className="text-zinc-500 text-sm">{currentPerformance.vote_count} voti ricevuti</p>
                       </div>
                    </div>

                    {/* Controls Grid */}
                    <div className="grid grid-cols-4 gap-4">
                       {currentPerformance.status === 'live' && (
                          <>
                             <Button onClick={async()=>{await api.pausePerformance(currentPerformance.id);loadData()}} variant="outline" className="h-14 border-zinc-700 hover:bg-zinc-800"><Pause className="mr-2"/> Pausa</Button>
                             <Button onClick={async()=>{await api.restartPerformance(currentPerformance.id);loadData()}} variant="outline" className="h-14 border-zinc-700 hover:bg-zinc-800 text-blue-400"><RotateCcw className="mr-2"/> Riavvolgi</Button>
                             <Button onClick={handleToggleMute} variant="outline" className={`h-14 border-zinc-700 ${currentPerformance.is_muted ? "bg-red-900/30 text-red-400 border-red-500" : "hover:bg-zinc-800"}`}>{currentPerformance.is_muted ? <VolumeX className="mr-2"/> : <Volume2 className="mr-2"/>} {currentPerformance.is_muted ? "UNMUTE" : "MUTE"}</Button>
                             <Button onClick={handleToggleBlur} variant="outline" className={`h-14 border-zinc-700 ${currentPerformance.is_blurred ? "bg-purple-900/30 text-purple-400 border-purple-500" : "hover:bg-zinc-800"}`}>{currentPerformance.is_blurred ? <Eye className="mr-2"/> : <EyeOff className="mr-2"/>} {currentPerformance.is_blurred ? "SVELA" : "OSCURA"}</Button>
                             
                             <Button onClick={async()=>{if(confirm("Chiudere esibizione?")) await api.endPerformance(currentPerformance.id);loadData()}} className="h-14 col-span-2 bg-green-600 hover:bg-green-700 text-lg"><Square className="mr-2"/> FINE ESIBIZIONE</Button>
                             <Button onClick={async()=>{if(confirm("Saltare?")) await api.skipPerformance(currentPerformance.id);loadData()}} variant="destructive" className="h-14 col-span-2"><SkipForward className="mr-2"/> SALTA (SKIP)</Button>
                          </>
                       )}
                       
                       {currentPerformance.status === 'paused' && <Button onClick={async()=>{await api.resumePerformance(currentPerformance.id);loadData()}} className="col-span-4 h-16 bg-green-600 text-xl"><Play className="mr-2"/> RIPRENDI VIDEO</Button>}
                       
                       {currentPerformance.status === 'voting' && <Button onClick={async()=>{await api.closeVoting(currentPerformance.id);loadData()}} className="col-span-4 h-16 bg-yellow-500 text-black font-bold text-xl"><Check className="mr-2"/> CHIUDI VOTAZIONE E APRI CODA</Button>}
                    </div>
                 </div>
              ) : (
                 <div className="glass p-12 text-center bg-zinc-900 border-zinc-800 rounded-2xl border-dashed border-2">
                    <Mic2 className="w-16 h-16 mx-auto text-zinc-700 mb-4"/>
                    <p className="text-zinc-500 text-xl">Nessuna esibizione in corso.</p>
                    <p className="text-zinc-600 text-sm mt-2">Vai nella sezione "Coda" per mandare qualcuno sul palco.</p>
                 </div>
              )}
           </div>
        )}

        {/* SEZIONE 3: LIBRERIA */}
        {activeSection === "library" && (
           <div className="space-y-6">
              <h2 className="text-3xl font-bold">Libreria & AI</h2>
              <div className="grid md:grid-cols-3 gap-6">
                 {/* Box Import */}
                 <div className="md:col-span-1">
                    <Card className="bg-zinc-900 border-zinc-800 sticky top-4">
                       <CardHeader><CardTitle className="text-white flex items-center gap-2"><Upload className="w-5 h-5"/> Importa JSON</CardTitle></CardHeader>
                       <CardContent>
                          <p className="text-xs text-zinc-400 mb-2">Incolla qui l'output di ChatGPT:</p>
                          <Textarea value={jsonImport} onChange={e=>setJsonImport(e.target.value)} placeholder='[{"category":"Rock",...}]' className="bg-black border-zinc-700 font-mono text-xs h-40 mb-4"/>
                          <Button onClick={handleBulkImport} className="w-full bg-blue-600 hover:bg-blue-700">Importa nel Database</Button>
                       </CardContent>
                    </Card>
                 </div>
                 {/* Lista Quiz */}
                 <div className="md:col-span-2 space-y-3">
                    {libraryQuizzes.length === 0 ? <p className="text-zinc-500 italic">Libreria vuota.</p> : libraryQuizzes.map(q => (
                       <div key={q.id} className="glass p-4 flex items-center gap-4 bg-zinc-900 border border-zinc-800 rounded-xl hover:border-zinc-700 transition">
                          <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center font-bold text-zinc-500 shrink-0">{q.category.substring(0,2).toUpperCase()}</div>
                          <div className="flex-1 min-w-0">
                             <p className="font-bold truncate">{q.question}</p>
                             <p className="text-xs text-zinc-500">{q.category}</p>
                          </div>
                          <Button onClick={()=>handleLaunchLibraryQuiz(q.id)} size="sm" className="bg-fuchsia-600 hover:bg-fuchsia-700 whitespace-nowrap">Lancia</Button>
                       </div>
                    ))}
                 </div>
              </div>
           </div>
        )}

        {/* SEZIONE 4: QUIZ LIVE */}
        {activeSection === "quiz" && (
           <div className="space-y-6">
              <h2 className="text-3xl font-bold">Quiz Live Control</h2>
              {!activeQuizId ? (
                 <div className="text-center py-20 bg-zinc-900 rounded-2xl border border-zinc-800">
                    <HelpCircle className="w-16 h-16 mx-auto text-zinc-700 mb-6"/>
                    <h2 className="text-xl font-bold mb-2">Nessun Quiz Attivo</h2>
                    <p className="text-zinc-500 mb-8">Scegli dalla Libreria o creane uno al volo.</p>
                    <Button onClick={()=>setShowQuizModal(true)} className="bg-fuchsia-600 hover:bg-fuchsia-700 text-lg px-8 py-6 rounded-xl"><Plus className="w-5 h-5 mr-2"/> Crea Quiz Manuale</Button>
                 </div>
              ) : (
                 <div className="glass p-8 bg-zinc-900 border-2 border-fuchsia-500/50 rounded-2xl shadow-[0_0_50px_rgba(192,38,211,0.1)]">
                    <div className="flex justify-between items-start mb-8 border-b border-white/10 pb-6">
                       <h3 className="text-2xl font-bold text-white max-w-3xl">{quizQuestion}</h3>
                       <span className={`px-4 py-2 rounded-full font-bold uppercase tracking-wider text-sm ${
                          quizStatus === 'active' ? 'bg-green-500 text-black animate-pulse' :
                          quizStatus === 'closed' ? 'bg-red-500 text-white' : 'bg-yellow-500 text-black'
                       }`}>
                          {quizStatus === 'active' ? "TELEVOTO APERTO" : quizStatus === 'closed' ? "VOTO CHIUSO" : "RISULTATI"}
                       </span>
                    </div>

                    <div className="grid grid-cols-3 gap-6">
                       <Button onClick={handleStopVoting} disabled={quizStatus!=='active'} className="h-24 text-xl bg-red-600 hover:bg-red-700 disabled:opacity-20 flex flex-col gap-2">
                          <Lock className="w-8 h-8"/> 1. STOP VOTO
                       </Button>
                       <Button onClick={()=>handleShowResults()} disabled={quizStatus!=='closed'} className="h-24 text-xl bg-yellow-500 hover:bg-yellow-600 text-black disabled:opacity-20 flex flex-col gap-2">
                          <Trophy className="w-8 h-8"/> 2. MOSTRA RISULTATI
                       </Button>
                       <Button onClick={handleEndQuiz} className="h-24 text-xl bg-zinc-700 hover:bg-zinc-600 flex flex-col gap-2">
                          <X className="w-8 h-8"/> 3. CHIUDI QUIZ
                       </Button>
                    </div>

                    {quizResults && (
                       <div className="mt-8 bg-green-900/20 p-6 rounded-xl border border-green-500/30 text-center animate-fade-in">
                          <p className="text-green-400 font-bold text-2xl mb-2">Risposta Corretta: {quizResults.correct_option}</p>
                          <p className="text-zinc-400">Hanno indovinato: <span className="text-white font-bold">{quizResults.winners.length > 0 ? quizResults.winners.join(', ') : "Nessuno"}</span></p>
                       </div>
                    )}
                 </div>
              )}
           </div>
        )}

        {/* SEZIONE 5: MESSAGGI */}
        {activeSection === "messages" && (
           <div className="space-y-6">
              <h2 className="text-3xl font-bold">Messaggi in Arrivo</h2>
              {pendingMessages.length === 0 ? <p className="text-zinc-500 italic">Nessun messaggio da approvare.</p> : (
                 <div className="grid gap-4">
                    {pendingMessages.map(msg => (
                       <div key={msg.id} className="glass p-4 flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-xl">
                          <div><p className="font-bold text-lg">"{msg.text}"</p><p className="text-sm text-cyan-400 font-bold">{msg.user_nickname}</p></div>
                          <div className="flex gap-2">
                             <Button onClick={()=>handleApproveMessage(msg.id)} className="bg-green-600">Pubblica</Button>
                             <Button onClick={()=>handleRejectMessage(msg.id)} variant="destructive">Rifiuta</Button>
                          </div>
                       </div>
                    ))}
                 </div>
              )}
           </div>
        )}

      </main>

      {/* MODALS */}
      
      {/* YOUTUBE SEARCH MODAL */}
      <Dialog open={showYoutubeModal} onOpenChange={setShowYoutubeModal}>
         <DialogContent className="bg-zinc-900 border-zinc-800 max-w-2xl">
            <DialogHeader><DialogTitle>Ricerca YouTube</DialogTitle></DialogHeader>
            <div className="flex gap-2 mb-4">
               <Input value={youtubeSearchQuery} onChange={e=>setYoutubeSearchQuery(e.target.value)} placeholder="Cerca canzone..." className="bg-black border-zinc-700"/>
               <Button onClick={searchYouTube} disabled={searchingYoutube}><Search className="w-4 h-4"/></Button>
            </div>
            {/* Lista Risultati */}
            {youtubeSearchResults.length > 0 && (
               <div className="space-y-2 max-h-60 overflow-y-auto mb-4 border border-zinc-800 rounded p-2">
                  {youtubeSearchResults.map(v => (
                     <div key={v.id.videoId} onClick={()=>{setYoutubeUrl(`https://www.youtube.com/watch?v=${v.id.videoId}`); setYoutubeSearchResults([])}} className="flex items-center gap-3 p-2 hover:bg-zinc-800 cursor-pointer rounded">
                        <img src={v.snippet.thumbnails.default.url} alt="" className="w-12 h-9 object-cover rounded"/>
                        <p className="text-sm font-medium truncate">{v.snippet.title}</p>
                     </div>
                  ))}
               </div>
            )}
            <div className="space-y-2">
               <label className="text-xs text-zinc-500">URL Manuale (opzionale)</label>
               <Input value={youtubeUrl} onChange={e=>setYoutubeUrl(e.target.value)} placeholder="https://youtube.com/..." className="bg-black border-zinc-700"/>
            </div>
            <Button onClick={startPerformance} className="w-full bg-green-600 mt-4 h-12 text-lg">AVVIA KARAOKE</Button>
         </DialogContent>
      </Dialog>
      
      {/* QUIZ MANUALE MODAL (FIXATO con bottoni selezione) */}
      <Dialog open={showQuizModal} onOpenChange={setShowQuizModal}>
         <DialogContent className="bg-zinc-900 border-zinc-800 max-w-lg">
            <DialogHeader><DialogTitle>Crea Quiz Manuale</DialogTitle></DialogHeader>
            <form onSubmit={handleStartManualQuiz} className="space-y-4 mt-2">
               <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Domanda</label>
                  <Textarea value={quizQuestion} onChange={e => setQuizQuestion(e.target.value)} placeholder="Scrivi la domanda..." className="bg-black border-zinc-700 min-h-[80px]"/>
               </div>
               
               <div className="space-y-3">
                  <label className="text-xs text-zinc-400 block">Opzioni (Clicca la lettera corretta)</label>
                  {quizOptions.map((option, idx) => (
                    <div key={idx} className="flex gap-3 items-center">
                       {/* BOTTONE SELEZIONE (Radio Button style) */}
                       <button
                          type="button"
                          onClick={() => setQuizCorrectIndex(idx)}
                          className={`w-12 h-12 rounded-lg font-bold text-lg flex items-center justify-center transition-all border-2 ${
                             quizCorrectIndex === idx 
                                ? 'bg-green-500 text-black border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.4)] scale-105' 
                                : 'bg-zinc-800 text-zinc-500 border-zinc-700 hover:bg-zinc-700'
                          }`}
                       >
                          {String.fromCharCode(65 + idx)}
                       </button>
                       <Input 
                          value={option} 
                          onChange={(e) => {
                             const newOpts = [...quizOptions];
                             newOpts[idx] = e.target.value;
                             setQuizOptions(newOpts);
                          }}
                          placeholder={`Opzione ${String.fromCharCode(65 + idx)}`} 
                          className="bg-black border-zinc-700 flex-1 h-12"
                       />
                    </div>
                  ))}
               </div>

               <Button type="submit" className="w-full bg-fuchsia-600 h-14 text-lg font-bold mt-4 shadow-lg shadow-fuchsia-900/20">LANCIA QUIZ ORA</Button>
            </form>
         </DialogContent>
      </Dialog>

      {/* MESSAGGIO REGIA MODAL */}
      <Dialog open={showMessageModal} onOpenChange={setShowMessageModal}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader><DialogTitle>Messaggio a Schermo</DialogTitle></DialogHeader>
          <Textarea value={adminMessage} onChange={e=>setAdminMessage(e.target.value)} placeholder="Scrivi un avviso per tutti..." className="bg-black border-zinc-700 min-h-[100px]"/>
          <Button onClick={handleBroadcastMessage} className="w-full mt-4 bg-cyan-600 h-12 text-lg">INVIA AL DISPLAY</Button>
        </DialogContent>
      </Dialog>

    </div>
  );
}