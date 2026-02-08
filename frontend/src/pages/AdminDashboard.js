import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Music, Play, Square, Trophy, Tv, Star, HelpCircle,
  Check, X, MessageSquare, LogOut, SkipForward, Pause,
  RotateCcw, Mic2, Search, Send, Coins, Users, Plus, ArrowLeft,
  ListMusic, BrainCircuit, AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import api, { createPub } from "@/lib/api";

const QUIZ_CATEGORIES = [
  { id: "music_general", name: "Musica Generale" },
  { id: "rock", name: "Rock" },
  { id: "pop", name: "Pop" },
  { id: "cinema", name: "Cinema" },
];

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { isAuthenticated, logout } = useAuth();
 
  // --- STATI GLOBALI APP ---
  const [appState, setAppState] = useState("loading"); // 'loading', 'super_admin', 'setup', 'dashboard'
  const [profile, setProfile] = useState(null);
  const [pubCode, setPubCode] = useState(localStorage.getItem("neonpub_pub_code"));
  
  // --- STATI SUPER ADMIN ---
  const [operators, setOperators] = useState([]);
  const [newOperatorEmail, setNewOperatorEmail] = useState("");
  const [newOperatorPassword, setNewOperatorPassword] = useState("");
  
  // --- STATI SETUP EVENTO ---
  const [newEventName, setNewEventName] = useState("");
  const [creatingEvent, setCreatingEvent] = useState(false);

  // --- STATI DASHBOARD REGIA ---
  // Dati
  const [eventState, setEventState] = useState({ active_module: 'karaoke', active_module_id: null });
  const [queue, setQueue] = useState([]);
  const [currentPerformance, setCurrentPerformance] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [pendingMessages, setPendingMessages] = useState([]);
  const [quizCatalog, setQuizCatalog] = useState([]);
  
  // UI Library Tabs
  const [libraryTab, setLibraryTab] = useState("karaoke"); // 'karaoke', 'quiz', 'messages'

  // Quiz States (Active & Results)
  const [activeQuizId, setActiveQuizId] = useState(null);
  const [quizStatus, setQuizStatus] = useState(null);
  const [quizResults, setQuizResults] = useState(null);

  // Modals States
  const [showYoutubeModal, setShowYoutubeModal] = useState(false);
  const [showCustomQuizModal, setShowCustomQuizModal] = useState(false);
  const [showMessageModal, setShowMessageModal] = useState(false);

  // YouTube Logic Variables
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [youtubeSearchQuery, setYoutubeSearchQuery] = useState("");
  const [youtubeSearchResults, setYoutubeSearchResults] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [searchingYoutube, setSearchingYoutube] = useState(false);

  // Custom Quiz Logic Variables
  const [quizQuestion, setQuizQuestion] = useState("");
  const [quizOptions, setQuizOptions] = useState(["", "", "", ""]);
  const [quizCorrectIndex, setQuizCorrectIndex] = useState(0);

  // Message Logic Variables
  const [adminMessage, setAdminMessage] = useState("");

  const pollIntervalRef = useRef(null);

  // --- 1. INIT & AUTH CHECK ---
  useEffect(() => {
    checkUserProfile();
  }, [isAuthenticated]);

  const checkUserProfile = async () => {
    if (!isAuthenticated) return; 
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let { data: userProfile } = await supabase.from('profiles').select('*').eq('id', user.id).single();

      if (!userProfile) {
         // Fallback profile creation
         const { data: newProfile } = await supabase.from('profiles').insert([{ id: user.id, email: user.email, role: 'operator', credits: 0 }]).select().single();
         userProfile = newProfile;
      }
      setProfile(userProfile);

      if (userProfile.role === 'super_admin') {
        setAppState("super_admin");
        fetchOperators();
      } else {
        const storedCode = localStorage.getItem("neonpub_pub_code");
        if (storedCode) {
          setPubCode(storedCode);
          setAppState("dashboard");
        } else {
          setAppState("setup");
        }
      }
    } catch (error) {
      console.error("Errore check profile:", error);
      toast.error("Errore caricamento profilo");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("neonpub_pub_code");
    logout();
    navigate("/");
  };

  // --- 2. LOGICA SUPER ADMIN & SETUP ---
  const fetchOperators = async () => {
    const { data } = await supabase.from('profiles').select('*').neq('role', 'super_admin');
    setOperators(data || []);
  };

  const handleCreateOperator = async (e) => {
    e.preventDefault();
    if(!newOperatorEmail || !newOperatorPassword) return;
    if (!window.confirm("Attenzione: verrai scollegato. Procedere?")) return;

    try {
      const { data, error } = await supabase.auth.signUp({
        email: newOperatorEmail,
        password: newOperatorPassword,
      });
      if (error) throw error;
      if (data.user) {
          await supabase.from('profiles').upsert([{ id: data.user.id, email: newOperatorEmail, role: 'operator', credits: 5 }]);
      }
      toast.success("Operatore creato!");
    } catch (error) { toast.error(error.message); }
  };

  const addCredits = async (operatorId, currentCredits, amount) => {
    const { error } = await supabase.from('profiles').update({ credits: currentCredits + amount }).eq('id', operatorId);
    if (error) toast.error("Errore"); else { toast.success("Crediti aggiunti!"); fetchOperators(); }
  };

  const handleStartEvent = async (e) => {
    e.preventDefault();
    if (!newEventName) return toast.error("Nome mancante");
    if (profile.credits < 1) return toast.error("Crediti insufficienti!");

    setCreatingEvent(true);
    try {
        const { data: pubData } = await createPub({ name: newEventName });
        await supabase.from('profiles').update({ credits: profile.credits - 1 }).eq('id', profile.id);
        
        setProfile(prev => ({ ...prev, credits: prev.credits - 1 }));
        localStorage.setItem("neonpub_pub_code", pubData.code);
        setPubCode(pubData.code);
        setAppState("dashboard");
    } catch (error) { toast.error(error.message); } finally { setCreatingEvent(false); }
  };

  // --- 3. DATA LOADING & POLLING (DASHBOARD) ---
  const loadData = useCallback(async () => {
    if (!pubCode || appState !== 'dashboard') return;
    try {
      // Load Global State + Data Modules
      const stateData = await api.getEventState();
      if(stateData) setEventState(stateData);

      const [qRes, perfRes, msgRes, lbRes, quizCatRes, activeQuizRes] = await Promise.all([
        api.getAdminQueue(),
        api.getAdminCurrentPerformance(),
        api.getAdminPendingMessages(),
        api.getAdminLeaderboard(),
        api.getQuizCatalog(),
        api.getActiveQuiz()
      ]);

      setQueue(qRes.data || []);
      setCurrentPerformance(perfRes.data);
      setPendingMessages(msgRes.data || []);
      setLeaderboard(lbRes.data || []);
      setQuizCatalog(quizCatRes.data || []);
      
      // Update Quiz Local State
      if(activeQuizRes.data) {
         setActiveQuizId(activeQuizRes.data.id);
         setQuizStatus(activeQuizRes.data.status);
         // Se stiamo mostrando risultati, fetch dei dettagli
         if(activeQuizRes.data.status === 'showing_results') {
             const resData = await api.getQuizResults(activeQuizRes.data.id);
             setQuizResults(resData.data);
         }
      } else {
         setActiveQuizId(null);
         setQuizStatus(null);
         setQuizResults(null);
      }

    } catch (error) { console.error(error); }
  }, [pubCode, appState]);

  useEffect(() => {
    if (appState === 'dashboard') {
      loadData();
      pollIntervalRef.current = setInterval(loadData, 3000);
      return () => clearInterval(pollIntervalRef.current);
    }
  }, [appState, loadData]);

  // --- 4. FUNZIONI OPERATIVE REGIA ---

  // YOUTUBE & KARAOKE
  const handleStartLivePre = (req) => {
    setSelectedRequest(req);
    setYoutubeUrl(req.youtube_url || "");
    setYoutubeSearchQuery(`${req.title} ${req.artist} karaoke`);
    setYoutubeSearchResults([]);
    setShowYoutubeModal(true);
  };

  const searchYouTube = async () => {
    if (!youtubeSearchQuery.trim()) return;
    setSearchingYoutube(true);
    try {
      const apiKey = process.env.REACT_APP_YOUTUBE_API_KEY;
      const response = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(youtubeSearchQuery)}&type=video&maxResults=5&key=${apiKey}`);
      const data = await response.json();
      setYoutubeSearchResults(data.items || []);
    } catch (error) { toast.error("Errore YouTube API"); } finally { setSearchingYoutube(false); }
  };

  const startPerformance = async () => {
    if (!selectedRequest || !youtubeUrl) return toast.error("Manca URL");
    try {
        await api.startPerformance(selectedRequest.id, youtubeUrl);
        // setEventModule viene chiamato automaticamente dentro startPerformance in api.js o lo forziamo qui
        // In api.js ho messo che startPerformance forza active_module='karaoke'
        setShowYoutubeModal(false);
        toast.success("Karaoke Avviato!");
        loadData();
    } catch(e) { toast.error("Errore avvio"); }
  };

  // CONTROLLI PERFORMANCE
  const ctrlPerf = async (action) => {
      if(!currentPerformance) return;
      try {
        if(action==='pause') await api.pausePerformance(currentPerformance.id);
        if(action==='resume') await api.resumePerformance(currentPerformance.id);
        if(action==='restart') await api.restartPerformance(currentPerformance.id);
        if(action==='skip') await api.skipPerformance(currentPerformance.id);
        if(action==='end') await api.endPerformance(currentPerformance.id); // Goes to voting
        if(action==='close_vote') await api.closeVoting(currentPerformance.id);
        loadData();
      } catch(e) { toast.error("Errore comando"); }
  };

  // QUIZ
  const launchCatalogQuiz = async (item) => {
      if(window.confirm(`Lanciare: ${item.question}?`)) {
          await api.setEventModule('quiz', item.id);
          toast.success("Quiz Lanciato!");
          loadData();
      }
  };

  const launchCustomQuiz = async (e) => {
      e.preventDefault();
      try {
          const { data } = await api.startQuiz({
              category: "custom",
              question: quizQuestion,
              options: quizOptions,
              correct_index: quizCorrectIndex,
              points: 10
          });
          setShowCustomQuizModal(false);
          toast.success("Quiz Custom Lanciato!");
          loadData();
      } catch(e) { toast.error("Errore creazione quiz"); }
  };

  const ctrlQuiz = async (action) => {
      if(!activeQuizId) return;
      try {
          if(action==='close_vote') await api.closeQuizVoting(activeQuizId);
          if(action==='show_results') await api.showQuizResults(activeQuizId);
          if(action==='end') {
              await api.endQuiz(activeQuizId);
              await api.setEventModule('karaoke'); // Return to default
              toast.info("Tornati al Karaoke");
          }
          loadData();
      } catch(e) { toast.error("Errore quiz cmd"); }
  };

  // MESSAGGI
  const handleApproveMessage = async (id) => { await api.approveMessage(id); loadData(); };
  const handleRejectMessage = async (id) => { await api.rejectMessage(id); loadData(); };
  const handleBroadcastMessage = async () => {
      if(!adminMessage) return;
      await api.sendMessage({ text: adminMessage, status: 'approved' });
      setShowMessageModal(false);
      setAdminMessage("");
      toast.success("Messaggio inviato!");
  };

  // --- RENDER CONDITIONALE ---

  if (appState === 'loading') return <div className="min-h-screen bg-black text-white flex items-center justify-center">Caricamento...</div>;

  // --- VISTA 1: SUPER ADMIN ---
  if (appState === 'super_admin') {
    return (
        <div className="min-h-screen bg-zinc-950 text-white p-6">
            <div className="max-w-4xl mx-auto">
                <div className="flex justify-between mb-8"><h1 className="text-2xl font-bold">Super Admin</h1><Button onClick={handleLogout}>Esci</Button></div>
                <div className="grid gap-6">
                    <Card className="bg-zinc-900 border-zinc-800"><CardHeader><CardTitle className="text-white">Operatori</CardTitle></CardHeader>
                        <CardContent>
                            {operators.map(op => (
                                <div key={op.id} className="flex justify-between mb-2 p-2 bg-zinc-800 rounded">
                                    <span>{op.email} (Cr: {op.credits})</span>
                                    <div><Button size="sm" onClick={()=>addCredits(op.id, op.credits, 5)}>+5</Button></div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                    <Card className="bg-zinc-900 border-zinc-800"><CardHeader><CardTitle className="text-white">Nuovo Operatore</CardTitle></CardHeader>
                         <CardContent className="flex gap-2">
                             <Input placeholder="Email" value={newOperatorEmail} onChange={e=>setNewOperatorEmail(e.target.value)} className="bg-zinc-800" />
                             <Input type="password" placeholder="Pass" value={newOperatorPassword} onChange={e=>setNewOperatorPassword(e.target.value)} className="bg-zinc-800" />
                             <Button onClick={handleCreateOperator}>Crea</Button>
                         </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
  }

  // --- VISTA 2: SETUP ---
  if (appState === 'setup') {
      return (
        <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-4">
            <Card className="w-full max-w-md bg-zinc-900 border-zinc-800">
                <CardHeader><CardTitle className="text-center text-white">Nuovo Evento</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    <div className="text-center bg-yellow-900/20 text-yellow-500 p-2 rounded">Crediti: {profile?.credits}</div>
                    <Input placeholder="Nome Evento" value={newEventName} onChange={e=>setNewEventName(e.target.value)} className="bg-zinc-950 text-center text-lg" />
                    <Button onClick={handleStartEvent} disabled={creatingEvent || profile?.credits < 1} className="w-full bg-fuchsia-600 h-12">LANCIA EVENTO (-1 Credito)</Button>
                    <Button variant="ghost" onClick={handleLogout} className="w-full text-zinc-500">Esci</Button>
                </CardContent>
            </Card>
        </div>
      );
  }

  // --- VISTA 3: MAIN DASHBOARD (NEW LAYOUT) ---
  const pendingReqs = queue.filter(r => r.status === 'pending');
  const queuedReqs = queue.filter(r => r.status === 'queued');

  return (
    <div className="h-screen bg-[#050505] text-white flex flex-col overflow-hidden">
      
      {/* HEADER */}
      <header className="h-14 border-b border-white/10 flex items-center justify-between px-4 bg-zinc-900">
         <div className="flex items-center gap-4">
            <h1 className="font-bold text-lg bg-clip-text text-transparent bg-gradient-to-r from-fuchsia-400 to-cyan-400">NEONPUB OS</h1>
            <span className="text-xs px-2 py-1 bg-zinc-800 rounded font-mono text-zinc-400">{pubCode}</span>
         </div>
         <div className="flex items-center gap-2">
             <Button variant="outline" size="sm" onClick={() => window.open(`/display/${pubCode}`, '_blank')}><Tv className="w-4 h-4 mr-2" /> Display</Button>
             <Button variant="ghost" size="sm" onClick={() => { if(confirm("Chiudere evento?")) { localStorage.removeItem("neonpub_pub_code"); setPubCode(null); setAppState("setup"); } }}><ArrowLeft className="w-4 h-4" /> Chiudi</Button>
         </div>
      </header>

      {/* MAIN GRID */}
      <div className="flex-1 grid grid-cols-12 gap-0 overflow-hidden">
         
         {/* LEFT: LIBRARY */}
         <aside className="col-span-4 border-r border-white/10 bg-zinc-900/50 flex flex-col">
            <div className="p-2 border-b border-white/5">
               <Tabs value={libraryTab} onValueChange={setLibraryTab} className="w-full">
                  <TabsList className="grid w-full grid-cols-3 bg-zinc-950">
                     <TabsTrigger value="karaoke"><ListMusic className="w-4 h-4 mr-2" />Coda</TabsTrigger>
                     <TabsTrigger value="quiz"><BrainCircuit className="w-4 h-4 mr-2" />Quiz</TabsTrigger>
                     <TabsTrigger value="messages"><MessageSquare className="w-4 h-4 mr-2" />Msg</TabsTrigger>
                  </TabsList>
               </Tabs>
            </div>
            
            <ScrollArea className="flex-1 p-3">
               {/* KARAOKE LIST */}
               {libraryTab === 'karaoke' && (
                  <div className="space-y-4">
                     {/* Pending */}
                     {pendingReqs.length > 0 && (
                        <div className="space-y-2">
                            <h3 className="text-xs font-bold text-yellow-500 uppercase">Da Approvare ({pendingReqs.length})</h3>
                            {pendingReqs.map(req => (
                                <div key={req.id} className="p-2 bg-yellow-900/10 border border-yellow-900/30 rounded flex justify-between items-center">
                                    <div className="truncate"><div className="font-bold text-sm truncate">{req.title}</div><div className="text-xs text-zinc-400">{req.user_nickname}</div></div>
                                    <div className="flex gap-1">
                                        <Button size="icon" variant="ghost" className="h-6 w-6 text-green-500" onClick={()=>api.approveRequest(req.id)}><Check className="w-4 h-4"/></Button>
                                        <Button size="icon" variant="ghost" className="h-6 w-6 text-red-500" onClick={()=>api.rejectRequest(req.id)}><X className="w-4 h-4"/></Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                     )}
                     
                     {/* Queued */}
                     <div className="space-y-2">
                        <h3 className="text-xs font-bold text-zinc-500 uppercase">In Scaletta ({queuedReqs.length})</h3>
                        {queuedReqs.map((req, i) => (
                           <div key={req.id} className="p-3 bg-zinc-800 rounded flex justify-between items-center group hover:bg-zinc-700 transition">
                              <div className="flex items-center gap-3 overflow-hidden">
                                  <span className="text-zinc-500 font-mono text-sm">{i+1}</span>
                                  <div className="truncate">
                                      <div className="font-bold text-sm truncate">{req.title}</div>
                                      <div className="text-xs text-zinc-400">{req.artist} • {req.user_nickname}</div>
                                  </div>
                              </div>
                              <Button size="sm" className="bg-fuchsia-600 h-7 opacity-0 group-hover:opacity-100 transition" onClick={() => handleStartLivePre(req)}>
                                 <Play className="w-3 h-3 mr-1" /> LIVE
                              </Button>
                           </div>
                        ))}
                     </div>
                  </div>
               )}

               {/* QUIZ LIBRARY */}
               {libraryTab === 'quiz' && (
                  <div className="space-y-3">
                     <Button className="w-full bg-zinc-800 hover:bg-zinc-700 border border-white/10" onClick={()=>setShowCustomQuizModal(true)}>
                        <Plus className="w-4 h-4 mr-2"/> Crea Quiz Manuale
                     </Button>
                     <h3 className="text-xs font-bold text-zinc-500 uppercase mt-4">Catalogo ({quizCatalog.length})</h3>
                     {quizCatalog.map((item) => (
                        <div key={item.id} className="p-3 bg-zinc-800 rounded border-l-2 border-transparent hover:border-yellow-500 cursor-pointer" onClick={() => launchCatalogQuiz(item)}>
                           <div className="text-xs text-yellow-500 font-bold mb-1">{item.category}</div>
                           <div className="text-sm font-medium">{item.question}</div>
                        </div>
                     ))}
                  </div>
               )}
               
               {/* MESSAGES LIBRARY */}
               {libraryTab === 'messages' && (
                   <div className="space-y-3">
                       <Button className="w-full bg-cyan-900/30 hover:bg-cyan-900/50 text-cyan-400 border border-cyan-500/30" onClick={()=>setShowMessageModal(true)}>
                           <MessageSquare className="w-4 h-4 mr-2"/> Invia Messaggio Libero
                       </Button>
                       <h3 className="text-xs font-bold text-zinc-500 uppercase mt-4">In Attesa ({pendingMessages.length})</h3>
                       {pendingMessages.map(msg => (
                           <div key={msg.id} className="p-3 bg-zinc-800 rounded">
                               <p className="text-sm mb-2">"{msg.text}"</p>
                               <p className="text-xs text-zinc-500 mb-2">da {msg.user_nickname}</p>
                               <div className="flex gap-2">
                                   <Button size="sm" className="flex-1 bg-green-600 h-7" onClick={()=>handleApproveMessage(msg.id)}>Approva</Button>
                                   <Button size="sm" variant="destructive" className="flex-1 h-7" onClick={()=>handleRejectMessage(msg.id)}>Rifiuta</Button>
                               </div>
                           </div>
                       ))}
                   </div>
               )}
            </ScrollArea>
         </aside>

         {/* RIGHT: LIVE DECK */}
         <main className="col-span-8 bg-black relative flex flex-col">
            
            {/* Live Status Bar */}
            <div className="h-10 border-b border-white/10 flex items-center px-4 justify-between bg-zinc-950 select-none">
               <span className="text-xs font-mono text-zinc-500">PROGRAMMA LIVE</span>
               <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${eventState.active_module !== 'idle' ? 'bg-red-500 animate-pulse' : 'bg-zinc-600'}`}></div>
                  <span className="uppercase font-bold tracking-wider text-sm text-red-500">{eventState.active_module}</span>
               </div>
            </div>

            {/* Deck Content */}
            <div className="flex-1 p-6 flex items-center justify-center bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-zinc-900 via-black to-black">
               
               {/* SCENA: KARAOKE */}
               {eventState.active_module === 'karaoke' && (
                  <div className="w-full max-w-3xl text-center">
                     {!currentPerformance ? (
                        <div className="text-zinc-600 flex flex-col items-center">
                           <Mic2 className="w-24 h-24 mb-4 opacity-10" />
                           <h2 className="text-2xl font-bold mb-2">Deck Karaoke Libero</h2>
                           <p>Scegli una canzone dalla libreria per andare in onda.</p>
                        </div>
                     ) : (
                        <div className="bg-zinc-900/80 backdrop-blur border border-white/10 p-8 rounded-2xl shadow-2xl relative overflow-hidden">
                           {/* Info */}
                           <div className="mb-8">
                               <h2 className="text-4xl font-black text-white mb-2 leading-tight">{currentPerformance.song_title}</h2>
                               <p className="text-2xl text-fuchsia-400">{currentPerformance.song_artist}</p>
                               <div className="mt-4 inline-block bg-white/10 px-4 py-1 rounded-full text-sm">🎤 {currentPerformance.user_nickname}</div>
                           </div>

                           {/* Controls */}
                           {currentPerformance.status === 'voting' ? (
                               <div className="bg-yellow-500/20 p-6 rounded-xl border border-yellow-500/50 animate-pulse">
                                   <h3 className="text-2xl font-bold text-yellow-500 mb-4">VOTAZIONE IN CORSO</h3>
                                   <div className="flex items-center justify-center gap-4 mb-4">
                                       <Star className="w-8 h-8 text-yellow-500 fill-yellow-500"/>
                                       <span className="text-4xl font-bold text-white">{(currentPerformance.average_score || 0).toFixed(1)}</span>
                                   </div>
                                   <Button size="lg" className="w-full bg-yellow-500 text-black hover:bg-yellow-400" onClick={()=>ctrlPerf('close_vote')}>CHIUDI VOTAZIONE</Button>
                               </div>
                           ) : (
                               <div className="flex justify-center gap-4">
                                   {currentPerformance.status === 'live' && <Button size="lg" variant="outline" className="h-16 w-16 rounded-full" onClick={()=>ctrlPerf('pause')}><Pause className="w-6 h-6" /></Button>}
                                   {currentPerformance.status === 'paused' && <Button size="lg" className="h-16 w-16 rounded-full bg-green-500 hover:bg-green-400" onClick={()=>ctrlPerf('resume')}><Play className="w-6 h-6" /></Button>}
                                   <Button size="lg" variant="secondary" className="h-16 w-16 rounded-full" onClick={()=>ctrlPerf('restart')}><RotateCcw className="w-6 h-6" /></Button>
                                   <Button size="lg" variant="destructive" className="h-16 w-auto px-8 rounded-full" onClick={()=>ctrlPerf('end')}><Square className="w-6 h-6 mr-2" /> STOP & VOTA</Button>
                               </div>
                           )}
                        </div>
                     )}
                  </div>
               )}

               {/* SCENA: QUIZ */}
               {eventState.active_module === 'quiz' && (
                  <div className="w-full max-w-2xl">
                     <div className="bg-yellow-950/30 border-2 border-yellow-600/50 p-8 rounded-2xl text-center shadow-[0_0_50px_rgba(234,179,8,0.2)]">
                        <div className="flex justify-center mb-6"><BrainCircuit className="w-16 h-16 text-yellow-500" /></div>
                        
                        <h2 className="text-3xl font-bold text-white mb-8 bg-black/50 p-4 rounded-xl border border-white/10">
                           {activeQuizId ? "Domanda in corso..." : "Caricamento..."}
                        </h2>

                        {activeQuizId && (
                           <div className="grid grid-cols-2 gap-4">
                              <Button disabled={quizStatus !== 'active'} className="h-16 text-lg bg-red-600 hover:bg-red-500" onClick={()=>ctrlQuiz('close_vote')}>
                                 🛑 STOP VOTO
                              </Button>
                              <Button disabled={quizStatus !== 'closed'} className="h-16 text-lg bg-blue-600 hover:bg-blue-500" onClick={()=>ctrlQuiz('show_results')}>
                                 🏆 RISULTATI
                              </Button>
                              <Button className="h-16 col-span-2 text-lg bg-zinc-700 hover:bg-zinc-600" onClick={()=>ctrlQuiz('end')}>
                                 🚪 CHIUDI QUIZ
                              </Button>
                           </div>
                        )}

                        {quizResults && (
                            <div className="mt-6 p-4 bg-green-900/20 rounded border border-green-500/30 text-green-400">
                                <div>Risposte Totali: {quizResults.total_answers}</div>
                                <div>Corrette: {quizResults.correct_count}</div>
                            </div>
                        )}
                     </div>
                  </div>
               )}

            </div>
         </main>
      </div>

      {/* --- MODALS --- */}
      
      {/* YOUTUBE MODAL */}
      <Dialog open={showYoutubeModal} onOpenChange={setShowYoutubeModal}>
        <DialogContent className="bg-zinc-900 border-zinc-800 max-w-3xl">
          <DialogHeader><DialogTitle>Scegli Video per {selectedRequest?.title}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-4">
              <Tabs defaultValue="search" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 bg-zinc-800">
                      <TabsTrigger value="search">Ricerca</TabsTrigger><TabsTrigger value="manual">URL</TabsTrigger>
                  </TabsList>
                  <TabsContent value="search" className="space-y-4 mt-4">
                      <div className="flex gap-2">
                          <Input value={youtubeSearchQuery} onChange={e=>setYoutubeSearchQuery(e.target.value)} className="bg-zinc-800" onKeyDown={e=>e.key==='Enter'&&searchYouTube()}/>
                          <Button onClick={searchYouTube} disabled={searchingYoutube}>{searchingYoutube?'...':'Cerca'}</Button>
                      </div>
                      <div className="max-h-60 overflow-y-auto space-y-2">
                          {youtubeSearchResults.map(vid => (
                              <div key={vid.id.videoId} className="flex gap-3 p-2 hover:bg-white/5 cursor-pointer rounded" onClick={()=>{setYoutubeUrl(`https://www.youtube.com/watch?v=${vid.id.videoId}`); setYoutubeSearchResults([]);}}>
                                  <img src={vid.snippet.thumbnails.default.url} className="w-24 h-16 object-cover rounded"/>
                                  <div className="flex-1"><div className="font-bold text-sm">{vid.snippet.title}</div><div className="text-xs text-zinc-500">{vid.snippet.channelTitle}</div></div>
                              </div>
                          ))}
                      </div>
                  </TabsContent>
                  <TabsContent value="manual" className="mt-4">
                      <Input placeholder="https://youtube.com..." value={youtubeUrl} onChange={e=>setYoutubeUrl(e.target.value)} className="bg-zinc-800"/>
                  </TabsContent>
              </Tabs>
              <div className="p-4 bg-zinc-950 rounded border border-zinc-800 break-all text-xs text-zinc-500">{youtubeUrl || "Nessun video selezionato"}</div>
              <Button className="w-full bg-green-600 h-12 text-lg" disabled={!youtubeUrl} onClick={startPerformance}>CONFERMA E MANDA IN ONDA</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* CUSTOM QUIZ MODAL */}
      <Dialog open={showCustomQuizModal} onOpenChange={setShowCustomQuizModal}>
          <DialogContent className="bg-zinc-900 border-zinc-800">
              <DialogHeader><DialogTitle>Crea Quiz al Volo</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-4">
                  <div><label className="text-xs text-zinc-500">Domanda</label><Textarea value={quizQuestion} onChange={e=>setQuizQuestion(e.target.value)} className="bg-zinc-800"/></div>
                  <div className="space-y-2">
                      <label className="text-xs text-zinc-500">Opzioni (Spunta la corretta)</label>
                      {quizOptions.map((opt, i) => (
                          <div key={i} className="flex gap-2">
                              <Input value={opt} onChange={e=>{const n=[...quizOptions]; n[i]=e.target.value; setQuizOptions(n)}} className="bg-zinc-800" placeholder={`Opzione ${i+1}`}/>
                              <Button size="icon" variant={quizCorrectIndex===i?'default':'outline'} className={quizCorrectIndex===i?'bg-green-600':''} onClick={()=>setQuizCorrectIndex(i)}><Check className="w-4 h-4"/></Button>
                          </div>
                      ))}
                  </div>
                  <Button className="w-full bg-fuchsia-600 mt-4" onClick={launchCustomQuiz}>LANCIA SUBITO</Button>
              </div>
          </DialogContent>
      </Dialog>

      {/* BROADCAST MSG MODAL */}
      <Dialog open={showMessageModal} onOpenChange={setShowMessageModal}>
          <DialogContent className="bg-zinc-900 border-zinc-800">
              <DialogHeader><DialogTitle>Messaggio Regia</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-4">
                  <Textarea value={adminMessage} onChange={e=>setAdminMessage(e.target.value)} placeholder="Scrivi avviso..." className="bg-zinc-800 h-32 text-lg"/>
                  <Button className="w-full bg-cyan-600" onClick={handleBroadcastMessage}><Send className="w-4 h-4 mr-2"/> INVIA AGLI SCHERMI</Button>
              </div>
          </DialogContent>
      </Dialog>

    </div>
  );
}