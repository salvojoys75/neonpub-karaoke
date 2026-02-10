import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Music, Play, Square, Trophy, Tv, Check, X, MessageSquare, 
  LogOut, SkipForward, Pause, RotateCcw, Search, Plus, ArrowLeft,
  ListMusic, BrainCircuit, Swords, Send, Star, VolumeX, Volume2, ExternalLink,
  Users, Coins, Settings, Save, LayoutDashboard, Gem, Upload, UserPlus, Ban, Trash2, Image as ImageIcon,
  FileJson, Download, Gamepad2, StopCircle, Eye, EyeOff, ListOrdered, MonitorPlay, 
  Music2, Film, Mic2, Clock, Unlock, Lock, ArrowRight, LayoutTemplate
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import api, { createPub, updateEventSettings, uploadLogo } from "@/lib/api";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { isAuthenticated, logout } = useAuth();
  
  // --- STATI GLOBALI ---
  const [appState, setAppState] = useState("loading");
  const [profile, setProfile] = useState(null);
  const [pubCode, setPubCode] = useState(localStorage.getItem("neonpub_pub_code"));
  
  // --- STATI DASHBOARD ---
  const [eventState, setEventState] = useState({ active_module: 'karaoke', active_module_id: null });
  const [queue, setQueue] = useState([]);
  const [currentPerformance, setCurrentPerformance] = useState(null);
  const [pendingMessages, setPendingMessages] = useState([]);
  const [isMuted, setIsMuted] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(null);
  
  const [libraryTab, setLibraryTab] = useState("karaoke"); 

  // --- STATI CATALOGHI ---
  const [quizCatalog, setQuizCatalog] = useState([]);
  const [quizCategoryFilter, setQuizCategoryFilter] = useState("all"); 
  const [challenges, setChallenges] = useState([]);

  // --- IMPOSTAZIONI EVENTO ---
  const [venueName, setVenueName] = useState("");
  const [venueLogo, setVenueLogo] = useState("");
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // --- STATI QUIZ & MODALI ---
  const [activeQuizId, setActiveQuizId] = useState(null);
  const [activeQuizData, setActiveQuizData] = useState(null); 
  const [quizStatus, setQuizStatus] = useState(null); 
  const [quizResults, setQuizResults] = useState(null); 
  
  const [showYoutubeModal, setShowYoutubeModal] = useState(false);
  const [showCustomQuizModal, setShowCustomQuizModal] = useState(false);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState("");

  // --- YOUTUBE VARS ---
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [youtubeSearchQuery, setYoutubeSearchQuery] = useState("");
  const [youtubeSearchResults, setYoutubeSearchResults] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [searchingYoutube, setSearchingYoutube] = useState(false);

  // --- CUSTOM QUIZ VARS ---
  const [quizQuestion, setQuizQuestion] = useState("");
  const [quizOptions, setQuizOptions] = useState(["", "", "", ""]);
  const [quizCorrectIndex, setQuizCorrectIndex] = useState(0);
  const [quizMediaUrl, setQuizMediaUrl] = useState("");
  const [quizMediaType, setQuizMediaType] = useState("text");

  // --- MESSAGGI VARS ---
  const [adminMessage, setAdminMessage] = useState("");

  // --- SETUP & MULTI EVENTO ---
  const [newEventName, setNewEventName] = useState("");
  const [creatingEvent, setCreatingEvent] = useState(false);
  const [activeEventsList, setActiveEventsList] = useState([]); 

  const pollIntervalRef = useRef(null);

  // AUTH & LOAD LOGIC (Omitted for brevity as it's mostly same)
  useEffect(() => { checkUserProfile(); }, [isAuthenticated]);

  const checkUserProfile = async () => {
    if (!isAuthenticated) return; 
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      let { data: userProfile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      
      if (!userProfile) {
         const { data: newProfile } = await supabase.from('profiles').insert([{ id: user.id, email: user.email, role: 'operator', credits: 0, is_active: true }]).select().single();
         userProfile = newProfile;
      }
      setProfile(userProfile);
      
      const storedCode = localStorage.getItem("neonpub_pub_code");
      if (storedCode) { 
          const pubData = await api.getPub(storedCode);
          if (pubData.data && (!pubData.data.expires_at || new Date(pubData.data.expires_at) > new Date())) {
              setPubCode(storedCode); 
              setAppState("dashboard"); 
          } else {
              localStorage.removeItem("neonpub_pub_code");
              setPubCode(null);
              loadActiveEvents(); 
              setAppState("setup");
          }
      } else {
          loadActiveEvents();
          setAppState("setup"); 
      }
    } catch (error) { console.error(error); }
  };

  const loadActiveEvents = async () => {
      const events = await api.getActiveEventsForUser();
      setActiveEventsList(events || []);
  };

  const handleStartEvent = async (e) => {
    e.preventDefault();
    if (!newEventName) return toast.error("Inserisci nome evento");
    if ((profile?.credits || 0) < 1) return toast.error("Crediti insufficienti!");
    setCreatingEvent(true);
    try {
        const { data: pubData } = await createPub({ name: newEventName });
        localStorage.setItem("neonpub_pub_code", pubData.code);
        setPubCode(pubData.code);
        setProfile(prev => ({...prev, credits: prev.credits - 1}));
        setAppState("dashboard");
        toast.success("Evento Iniziato!");
    } catch (error) { toast.error(error.message); } finally { setCreatingEvent(false); }
  };

  const handleResumeEvent = (code) => {
      localStorage.setItem("neonpub_pub_code", code);
      setPubCode(code);
      setAppState("dashboard");
  };

  const loadData = useCallback(async () => {
    if (!pubCode || appState !== 'dashboard') return;
    try {
      const stateData = await api.getEventState();
      if(stateData) setEventState(stateData);

      const [qRes, perfRes, msgRes, activeQuizRes, quizCatRes] = await Promise.all([
        api.getAdminQueue(),
        api.getAdminCurrentPerformance(),
        api.getAdminPendingMessages(),
        api.getActiveQuiz(),
        api.getQuizCatalog(),
      ]);

      setQueue(qRes.data || []);
      setCurrentPerformance(perfRes.data);
      setPendingMessages(msgRes.data || []);
      setQuizCatalog(quizCatRes.data || []);
      
      if(activeQuizRes.data) {
         setActiveQuizId(activeQuizRes.data.id);
         setActiveQuizData(activeQuizRes.data); 
         setQuizStatus(activeQuizRes.data.status);
      } else {
         setActiveQuizId(null); setActiveQuizData(null); setQuizStatus(null);
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

  // ACTIONS
  const handleOpenDisplay = () => {
    window.open(`/display/${pubCode}`, 'NeonPubDisplay', `popup=yes,width=1280,height=720`);
  };

  const handleToggleMute = async () => {
      const newState = !isMuted;
      setIsMuted(newState); 
      await api.toggleMute(newState);
  };

  const startPerformance = async () => {
    if (!selectedRequest || !youtubeUrl) return toast.error("Manca URL");
    try {
        await api.startPerformance(selectedRequest.id, youtubeUrl);
        setShowYoutubeModal(false); toast.success("Karaoke Avviato!"); loadData();
    } catch(e) { toast.error(e.message); }
  };

  const ctrlPerf = async (action) => {
      if(!currentPerformance) return;
      try {
        if(action==='pause') await api.pausePerformance(currentPerformance.id);
        if(action==='resume') await api.resumePerformance(currentPerformance.id);
        if(action==='restart') await api.restartPerformance(currentPerformance.id);
        if(action==='end_vote') await api.endPerformance(currentPerformance.id);
        if(action==='close_vote') { await api.closeVoting(currentPerformance.id); toast.success("Votazione conclusa!"); }
        loadData();
      } catch(e) { toast.error(e.message); }
  };

  const ctrlQuiz = async (action) => {
      if(!activeQuizId) return;
      try {
          if(action==='close_vote') await api.closeQuizVoting(activeQuizId);
          if(action==='show_results') await api.showQuizResults(activeQuizId);
          if(action==='leaderboard') await api.showQuizLeaderboard(activeQuizId);
          if(action==='end') { await api.endQuiz(activeQuizId); await api.setEventModule('karaoke'); toast.info("Tornati al Karaoke"); }
          loadData();
      } catch(e) { toast.error("Errore comando quiz"); }
  };

  const launchCatalogQuiz = async (item) => {
      if(window.confirm(`Lanciare: ${item.question}?`)) {
          await api.setEventModule('quiz', item.id);
          toast.success("Quiz Lanciato!");
          loadData();
          setLibraryTab('quiz'); // Switch to Quiz tab view implicitly
      }
  };

  const launchCustomQuiz = async () => {
      try {
          await api.startQuiz({
              category: "custom", question: quizQuestion, options: quizOptions, correct_index: quizCorrectIndex, points: 10,
              media_url: quizMediaUrl || null, media_type: quizMediaType
          });
          setShowCustomQuizModal(false); toast.success("Quiz Custom Lanciato!"); loadData();
      } catch(e) { toast.error("Errore quiz custom: " + e.message); }
  };

  if (appState === 'loading') return <div className="bg-black h-screen text-white flex items-center justify-center">Caricamento...</div>;

  if (appState === 'setup') {
      return (
        <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-4">
             <Card className="bg-zinc-900 border-zinc-800 w-full max-w-md">
                 <CardHeader><CardTitle>Setup Evento</CardTitle></CardHeader>
                 <CardContent className="space-y-4">
                     <Input placeholder="Nome Evento" value={newEventName} onChange={e=>setNewEventName(e.target.value)} className="bg-zinc-800"/>
                     <Button className="w-full bg-fuchsia-600" onClick={handleStartEvent} disabled={creatingEvent}>Crea Evento</Button>
                     {activeEventsList.length > 0 && <div className="border-t border-white/10 pt-4"><p className="mb-2">Riprendi evento:</p>{activeEventsList.map(ev=>(<Button key={ev.id} variant="outline" className="w-full mb-2" onClick={()=>handleResumeEvent(ev.code)}>{ev.name} ({ev.code})</Button>))}</div>}
                 </CardContent>
             </Card>
        </div>
      );
  }

  // DASHBOARD MAIN
  const pendingReqs = queue.filter(r => r.status === 'pending');
  const queuedReqs = queue.filter(r => r.status === 'queued');

  // VIEW LOGIC: Show Quiz Controls if Quiz is active, else Show Karaoke Controls
  const isQuizMode = activeQuizId && quizStatus !== 'ended';

  return (
    <div className="h-screen bg-[#050505] text-white flex flex-col overflow-hidden">
      
      {/* HEADER */}
      <header className="h-14 border-b border-white/10 flex items-center justify-between px-4 bg-zinc-900">
         <div className="flex items-center gap-4">
            <h1 className="font-bold text-lg text-fuchsia-400">NEONPUB OS</h1>
            <span className="text-xs px-2 py-0.5 bg-zinc-800 rounded font-mono text-zinc-400">{pubCode}</span>
         </div>
         <div className="flex items-center gap-4">
             <Button variant="outline" size="sm" onClick={handleOpenDisplay} className="bg-cyan-900/20 text-cyan-400 border-cyan-800"><Tv className="w-4 h-4 mr-2" /> DISPLAY</Button>
             <Button variant="ghost" size="sm" onClick={() => { if(confirm("Esci?")) { localStorage.removeItem("neonpub_pub_code"); setPubCode(null); setAppState("setup"); loadActiveEvents(); } }}><LogOut className="w-4 h-4" /></Button>
         </div>
      </header>

      <div className="flex-1 grid grid-cols-12 gap-0 overflow-hidden">
         {/* SIDEBAR LIBRARY */}
         <aside className="col-span-4 border-r border-white/10 bg-zinc-900/50 flex flex-col">
            <div className="p-2 border-b border-white/5">
               <Tabs value={libraryTab} onValueChange={setLibraryTab} className="w-full">
                  <TabsList className="grid w-full grid-cols-4 bg-zinc-950 p-1">
                     <TabsTrigger value="karaoke" className="text-xs px-1"><ListMusic className="w-3 h-3" /></TabsTrigger>
                     <TabsTrigger value="quiz" className="text-xs px-1"><BrainCircuit className="w-3 h-3" /></TabsTrigger>
                     <TabsTrigger value="messages" className="text-xs px-1 relative"><MessageSquare className="w-3 h-3" />{pendingMessages.length>0 && <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>}</TabsTrigger>
                     <TabsTrigger value="settings" className="text-xs px-1"><Settings className="w-3 h-3" /></TabsTrigger>
                  </TabsList>
               </Tabs>
            </div>
            
            <ScrollArea className="flex-1 p-3">
               {/* LIBRARY CONTENT (Karaoke Queue, Quiz Catalog, etc) */}
               {libraryTab === 'karaoke' && (
                  <div className="space-y-4">
                     {pendingReqs.map(req => (
                        <div key={req.id} className="p-2 bg-yellow-900/10 border border-yellow-900/30 rounded flex justify-between items-center">
                            <div className="truncate w-2/3"><div className="font-bold text-sm truncate">{req.title}</div><div className="text-xs text-zinc-400">{req.user_nickname}</div></div>
                            <div className="flex gap-1">
                                <Button size="icon" variant="ghost" className="h-6 w-6 text-green-500" onClick={()=>api.approveRequest(req.id)}><Check className="w-4 h-4"/></Button>
                                <Button size="icon" variant="ghost" className="h-6 w-6 text-red-500" onClick={()=>api.rejectRequest(req.id)}><X className="w-4 h-4"/></Button>
                            </div>
                        </div>
                     ))}
                     {queuedReqs.map((req, i) => (
                        <div key={req.id} className="p-3 bg-zinc-800 rounded flex justify-between items-center group hover:bg-zinc-700 transition">
                            <div className="flex items-center gap-3 overflow-hidden w-2/3">
                                <span className="text-zinc-500 font-mono text-sm">{i+1}</span>
                                <div className="truncate">
                                    <div className="font-bold text-sm truncate">{req.title}</div>
                                    <div className="text-xs text-zinc-400 truncate">{req.artist} • {req.user_nickname}</div>
                                </div>
                            </div>
                            <Button size="sm" className="bg-fuchsia-600 h-7" onClick={() => { setSelectedRequest(req); setYoutubeSearchResults([]); setYoutubeUrl(req.youtube_url || ""); setShowYoutubeModal(true); if(!req.youtube_url) setTimeout(() => searchYouTube(`${req.title} ${req.artist} karaoke`), 100); }}><Play className="w-3 h-3 mr-1" /> LIVE</Button>
                        </div>
                     ))}
                  </div>
               )}

               {libraryTab === 'quiz' && (
                    <div className="flex flex-col h-full space-y-2">
                        <div className="grid grid-cols-2 gap-2 mb-2">
                            <Button className="bg-zinc-800 text-xs" onClick={()=>setShowCustomQuizModal(true)}><Plus className="w-3 h-3 mr-1"/> Manuale</Button>
                            <Button className="bg-blue-600 text-xs" onClick={()=>setShowImportModal(true)}><Download className="w-3 h-3 mr-1"/> Import JSON</Button>
                        </div>
                        <div className="flex gap-1 mb-2 bg-zinc-950 p-1 rounded">
                             <Button size="sm" variant={quizCategoryFilter==='all'?'secondary':'ghost'} className="text-[10px] h-6 flex-1" onClick={()=>setQuizCategoryFilter('all')}>All</Button>
                             <Button size="sm" variant={quizCategoryFilter==='intro'?'secondary':'ghost'} className="text-[10px] h-6 flex-1" onClick={()=>setQuizCategoryFilter('intro')}>Intro</Button>
                             <Button size="sm" variant={quizCategoryFilter==='video'?'secondary':'ghost'} className="text-[10px] h-6 flex-1" onClick={()=>setQuizCategoryFilter('video')}>Video</Button>
                        </div>
                        <div className="space-y-2 pb-20">
                            {quizCatalog.filter(q => quizCategoryFilter === 'all' || q.category.toLowerCase().includes(quizCategoryFilter)).map((item, index) => (
                                <div key={item.id} className="group relative bg-zinc-800 hover:bg-zinc-700 border border-transparent hover:border-yellow-500 rounded p-3 cursor-pointer transition-all" onClick={() => launchCatalogQuiz(item)}>
                                    <div className="text-[10px] font-bold text-fuchsia-500 uppercase tracking-wider mb-1 flex items-center gap-1">{item.category}</div>
                                    <div className="text-sm font-medium text-white pr-6 line-clamp-2">{item.question}</div>
                                </div>
                            ))}
                        </div>
                    </div>
               )}
            </ScrollArea>
         </aside>

         {/* MAIN DIRECTOR CONSOLE */}
         <main className="col-span-8 bg-black relative flex flex-col">
            <div className="h-10 border-b border-white/10 flex items-center px-4 justify-between bg-zinc-950">
               <span className="text-xs font-mono text-zinc-500">{isQuizMode ? 'QUIZ DIRECTOR MODE' : 'KARAOKE DIRECTOR MODE'}</span>
               <Button size="sm" variant="ghost" onClick={handleToggleMute} className={isMuted?'text-red-500':'text-zinc-400'}>{isMuted ? <VolumeX className="w-4 h-4"/> : <Volume2 className="w-4 h-4"/>}</Button>
            </div>
            
            <div className="flex-1 p-6 flex items-center justify-center bg-gradient-to-b from-zinc-900 to-black">
               
               {/* SCENARIO 1: QUIZ ATTIVO */}
               {isQuizMode && (
                  <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-8">
                      {/* Left: Preview Status */}
                      <Card className="bg-zinc-900 border-2 border-fuchsia-600 shadow-2xl shadow-fuchsia-900/20">
                          <CardHeader className="bg-fuchsia-900/20 border-b border-fuchsia-600/30">
                              <CardTitle className="text-fuchsia-400 flex justify-between items-center">
                                  <span>IN ONDA</span>
                                  <span className="px-2 py-1 bg-black rounded text-xs text-white uppercase">{quizStatus}</span>
                              </CardTitle>
                          </CardHeader>
                          <CardContent className="pt-6 text-center space-y-4">
                              <h3 className="text-xl font-bold text-white">{activeQuizData?.question}</h3>
                              {activeQuizData?.media_url && <div className="text-xs text-zinc-500 flex items-center justify-center gap-2"><Film className="w-4 h-4"/> Media Presente</div>}
                          </CardContent>
                      </Card>

                      {/* Right: Controls */}
                      <div className="flex flex-col gap-4 justify-center">
                          {quizStatus === 'active' && (
                              <Button size="lg" className="h-20 text-2xl font-black bg-red-600 hover:bg-red-500 shadow-lg animate-pulse" onClick={() => ctrlQuiz('close_vote')}>
                                  <StopCircle className="w-8 h-8 mr-3"/> STOP TELEVOTO
                              </Button>
                          )}
                          
                          {quizStatus === 'closed' && (
                              <Button size="lg" className="h-20 text-xl font-bold bg-blue-600 hover:bg-blue-500 shadow-lg" onClick={() => ctrlQuiz('show_results')}>
                                  <Eye className="w-6 h-6 mr-3"/> MOSTRA RISPOSTA
                              </Button>
                          )}

                          {(quizStatus === 'showing_results' || quizStatus === 'leaderboard') && (
                              <>
                                {quizStatus !== 'leaderboard' && (
                                    <Button size="lg" className="h-16 text-xl font-bold bg-yellow-500 hover:bg-yellow-400 text-black" onClick={() => ctrlQuiz('leaderboard')}>
                                        <ListOrdered className="w-6 h-6 mr-3"/> CLASSIFICA
                                    </Button>
                                )}
                                <Button size="lg" variant="destructive" className="h-16" onClick={() => ctrlQuiz('end')}>
                                    <MonitorPlay className="w-6 h-6 mr-3"/> CHIUDI E ESCI
                                </Button>
                              </>
                          )}
                      </div>
                  </div>
               )}

               {/* SCENARIO 2: KARAOKE / IDLE */}
               {!isQuizMode && (
                  <div className="w-full max-w-3xl text-center">
                     {!currentPerformance ? (
                        <div className="text-zinc-600 flex flex-col items-center opacity-50"><ListMusic className="w-24 h-24 mb-4" /><h2 className="text-2xl font-bold">Nessuna Performance Attiva</h2></div>
                     ) : (
                        <div className="bg-zinc-900/80 border border-white/10 p-8 rounded-2xl shadow-2xl relative">
                           <div className="mb-6"><h2 className="text-4xl font-black text-white">{currentPerformance.song_title}</h2><p className="text-2xl text-fuchsia-400">{currentPerformance.song_artist}</p><div className="mt-4 text-zinc-300">🎤 {currentPerformance.user_nickname}</div></div>
                           {currentPerformance.status === 'voting' ? (
                               <div className="bg-yellow-500/20 p-6 rounded-xl border border-yellow-500/50 animate-pulse"><h3 className="text-2xl font-bold text-yellow-500 mb-4">VOTAZIONE IN CORSO</h3><Button size="lg" className="w-full bg-yellow-500 text-black font-bold" onClick={()=>ctrlPerf('close_vote')}>CHIUDI VOTAZIONE & NEXT</Button></div>
                           ) : (
                               <div className="flex flex-col gap-4"><div className="flex justify-center gap-4">
                                       {currentPerformance.status === 'live' && <Button size="lg" variant="outline" className="h-16 w-16 rounded-full" onClick={()=>ctrlPerf('pause')}><Pause className="w-6 h-6" /></Button>}
                                       {currentPerformance.status === 'paused' && <Button size="lg" className="h-16 w-16 rounded-full bg-green-500 text-black" onClick={()=>ctrlPerf('resume')}><Play className="w-6 h-6" /></Button>}
                                       <Button size="lg" variant="secondary" className="h-16 w-16 rounded-full" onClick={()=>ctrlPerf('restart')}><RotateCcw className="w-6 h-6" /></Button>
                                       <div className="flex gap-2 ml-4"><Button size="lg" variant="destructive" className="h-16 px-6" onClick={()=>ctrlPerf('end_vote')}>STOP & VOTA</Button></div>
                               </div></div>
                           )}
                        </div>
                     )}
                  </div>
               )}
            </div>
         </main>
      </div>

      {/* DIALOGS (Youtube, Custom Quiz, Messages, Import) - (Keeping brief, standard implementation) */}
      <Dialog open={showYoutubeModal} onOpenChange={setShowYoutubeModal}>
        <DialogContent className="bg-zinc-900 border-zinc-800"><DialogHeader><DialogTitle>Video: {selectedRequest?.title}</DialogTitle></DialogHeader><div className="space-y-4"><Input value={youtubeSearchQuery} onChange={e=>setYoutubeSearchQuery(e.target.value)} placeholder="Cerca YouTube..." onKeyDown={e=>e.key==='Enter'&&searchYouTube()}/><Button onClick={startPerformance} className="w-full bg-green-600 font-bold">AVVIA</Button></div></DialogContent>
      </Dialog>
      
      <Dialog open={showCustomQuizModal} onOpenChange={setShowCustomQuizModal}>
          <DialogContent className="bg-zinc-900 border-zinc-800"><DialogHeader><DialogTitle>Nuovo Quiz</DialogTitle></DialogHeader><div className="space-y-4"><Input placeholder="Domanda" value={quizQuestion} onChange={e=>setQuizQuestion(e.target.value)} /><Input placeholder="Media URL (Youtube)" value={quizMediaUrl} onChange={e=>setQuizMediaUrl(e.target.value)} /><Button onClick={launchCustomQuiz} className="w-full bg-fuchsia-600">LANCIA</Button></div></DialogContent>
      </Dialog>
    </div>
  );
}