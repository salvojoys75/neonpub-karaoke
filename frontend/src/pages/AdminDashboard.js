import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Music, Play, Square, Trophy, Tv, Check, X, MessageSquare, 
  LogOut, SkipForward, Pause, RotateCcw, Search, Plus, ArrowLeft,
  ListMusic, BrainCircuit, Swords, Send, Star, VolumeX, Volume2, ExternalLink,
  Users, Coins, Settings, Save, LayoutDashboard, Gem, Upload, UserPlus, Ban, Trash2, Image as ImageIcon,
  FileJson, Download, Gamepad2, StopCircle, Eye, EyeOff, ListOrdered, MonitorPlay, 
  Music2, Film, Mic2, Clock, Unlock, Lock
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

  // --- STATI SUPER ADMIN ---
  const [userList, setUserList] = useState([]);
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserName, setNewUserName] = useState("");

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

  useEffect(() => { checkUserProfile(); }, [isAuthenticated]);

  const checkUserProfile = async () => {
    if (!isAuthenticated) return; 
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      let { data: userProfile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (user.email === 'admin@neonpub.com' && (!userProfile || userProfile.role !== 'super_admin')) {
          await supabase.from('profiles').upsert({ id: user.id, email: user.email, role: 'super_admin', credits: 9999, is_active: true });
          userProfile = { id: user.id, email: user.email, role: 'super_admin', credits: 9999, is_active: true };
      }
      
      if (!userProfile) {
         const { data: newProfile } = await supabase.from('profiles').insert([{ id: user.id, email: user.email, role: 'operator', credits: 0, is_active: true }]).select().single();
         userProfile = newProfile;
      }

      if (userProfile.is_active === false) { toast.error("Account disabilitato"); logout(); return; }

      setProfile(userProfile);
      
      if (userProfile.role === 'super_admin') { 
          setAppState("super_admin"); 
          loadSuperAdminData(); 
      } else {
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
      const pubRes = await api.getPub(pubCode);
      if (!pubRes.data) return;

      const expires = new Date(pubRes.data.expires_at);
      const diff = expires - new Date();
      setTimeRemaining(diff <= 0 ? "SCADUTO" : `${Math.floor(diff/(1000*60*60))}h ${Math.floor((diff%(1000*60*60))/(1000*60))}m`);
      
      if(!venueName && pubRes.data.name) { setVenueName(pubRes.data.name); setVenueLogo(pubRes.data.logo_url || ""); }

      const stateData = await api.getEventState();
      if(stateData) setEventState(stateData);

      const [qRes, perfRes, msgRes, activeQuizRes, quizCatRes] = await Promise.all([
        api.getAdminQueue(),
        api.getAdminCurrentPerformance(),
        api.getAdminPendingMessages(),
        api.getActiveQuiz(),
        api.getQuizCatalog()
      ]);

      setQueue(qRes.data || []);
      setCurrentPerformance(perfRes.data);
      setPendingMessages(msgRes.data || []);
      setQuizCatalog(quizCatRes.data || []);
      
      if(activeQuizRes.data) {
         setActiveQuizId(activeQuizRes.data.id);
         setActiveQuizData(activeQuizRes.data); 
         setQuizStatus(activeQuizRes.data.status);
         if(activeQuizRes.data.status === 'showing_results' || activeQuizRes.data.status === 'leaderboard') {
             const resData = await api.getQuizResults(activeQuizRes.data.id);
             setQuizResults(resData.data);
         }
      } else {
         setActiveQuizId(null); setActiveQuizData(null); setQuizStatus(null); setQuizResults(null);
      }
    } catch (error) { console.error(error); }
  }, [pubCode, appState, venueName]);

  useEffect(() => {
    if (appState === 'dashboard') {
      loadData();
      pollIntervalRef.current = setInterval(loadData, 3000);
      return () => clearInterval(pollIntervalRef.current);
    }
  }, [appState, loadData]);

  // SUPER ADMIN
  const loadSuperAdminData = async () => { const { data } = await api.getAllProfiles(); setUserList(data || []); };
  const addCredits = async (id, amt) => { const u = userList.find(u=>u.id===id); await api.updateProfileCredits(id, (u.credits||0)+amt); loadSuperAdminData(); };
  const handleCreateOperator = async () => { await api.createOperatorProfile(newUserEmail, newUserName, newUserPassword, 0); setShowCreateUserModal(false); loadSuperAdminData(); };

  // ACTIONS
  const handleOpenDisplay = () => window.open(`/display/${pubCode}`, 'NeonPubDisplay', `popup=yes,width=1280,height=720`);
  const handleToggleMute = async () => { const s = !isMuted; setIsMuted(s); await api.toggleMute(s); };
  
  // SETTINGS HANDLERS
  const handleLogoUpload = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      setUploadingLogo(true);
      try {
          const url = await api.uploadLogo(file);
          setVenueLogo(url);
          toast.success("Logo caricato! Clicca Salva.");
      } catch(err) { toast.error("Errore upload"); } finally { setUploadingLogo(false); }
  };

  const handleSaveSettings = async () => {
      try {
          await updateEventSettings({ name: venueName, logo_url: venueLogo });
          toast.success("Impostazioni salvate");
      } catch (e) { toast.error("Errore salvataggio"); }
  };

  const searchYouTube = async () => {
    if (!youtubeSearchQuery.trim()) return;
    setSearchingYoutube(true);
    try {
      const apiKey = process.env.REACT_APP_YOUTUBE_API_KEY; 
      const res = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(youtubeSearchQuery)}&type=video&maxResults=5&key=${apiKey}`);
      const data = await res.json();
      setYoutubeSearchResults(data.items || []);
    } catch (e) { toast.error("Errore YT"); } finally { setSearchingYoutube(false); }
  };

  const startPerformance = async () => {
    if (!selectedRequest || !youtubeUrl) return toast.error("Manca URL");
    try { await api.startPerformance(selectedRequest.id, youtubeUrl); setShowYoutubeModal(false); toast.success("Karaoke Avviato!"); loadData(); } catch(e) { toast.error(e.message); }
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

  const deleteRequest = async (id) => { if(confirm("Eliminare?")) { await api.deleteRequest(id); loadData(); } };
  const handleSendMessage = async () => { if(!adminMessage) return; await api.sendMessage({ text: adminMessage }); setShowMessageModal(false); setAdminMessage(""); toast.success("Inviato"); };

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
          setLibraryTab('quiz');
      }
  };

  const launchCustomQuiz = async () => {
      await api.startQuiz({ category: "custom", question: quizQuestion, options: quizOptions, correct_index: quizCorrectIndex, points: 10, media_url: quizMediaUrl || null, media_type: quizMediaType });
      setShowCustomQuizModal(false); toast.success("Quiz Custom Lanciato!"); loadData();
  };
  
  const handleImportScript = async () => {
      try { await api.importQuizCatalog(importText); toast.success("Importato!"); setShowImportModal(false); loadData(); } catch(e) { toast.error(e.message); }
  };

  if (appState === 'loading') return <div className="bg-black h-screen text-white flex items-center justify-center">Caricamento...</div>;
  if (appState === 'super_admin') return (
    <div className="h-screen bg-zinc-950 text-white p-8 overflow-auto">
        <h1 className="text-3xl font-bold mb-8">SUPER ADMIN</h1>
        <Button onClick={()=>setShowCreateUserModal(true)} className="mb-6 bg-green-600">Nuovo Utente</Button>
        <div className="grid grid-cols-3 gap-6">{userList.map(u=>(<Card key={u.id} className="bg-zinc-900 border-zinc-800"><CardHeader><CardTitle className="text-sm">{u.email}</CardTitle></CardHeader><CardContent><p>Crediti: {u.credits}</p><div className="flex gap-2 mt-4"><Button size="sm" onClick={()=>addCredits(u.id, 1)}>+1</Button><Button size="sm" onClick={()=>addCredits(u.id, 10)}>+10</Button></div></CardContent></Card>))}</div>
        <Dialog open={showCreateUserModal} onOpenChange={setShowCreateUserModal}><DialogContent className="bg-zinc-900"><Input placeholder="Email" value={newUserEmail} onChange={e=>setNewUserEmail(e.target.value)}/><Input placeholder="Password" value={newUserPassword} onChange={e=>setNewUserPassword(e.target.value)}/><Button onClick={handleCreateOperator}>Crea</Button></DialogContent></Dialog>
    </div>
  );

  if (appState === 'setup') return (
    <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-4">
        <Card className="bg-zinc-900 w-full max-w-md"><CardHeader><CardTitle>Setup Evento</CardTitle></CardHeader><CardContent className="space-y-4">
            <div className="text-center text-yellow-500 font-bold mb-2">Crediti: {profile?.credits}</div>
            <Input placeholder="Nome Evento" value={newEventName} onChange={e=>setNewEventName(e.target.value)} />
            <Button className="w-full bg-fuchsia-600" onClick={handleStartEvent}>Crea (-1 Credit)</Button>
            {activeEventsList.length>0 && activeEventsList.map(ev=><Button key={ev.id} variant="outline" className="w-full" onClick={()=>handleResumeEvent(ev.code)}>Riprendi {ev.name}</Button>)}
        </CardContent></Card>
    </div>
  );

  const pendingReqs = queue.filter(r => r.status === 'pending');
  const queuedReqs = queue.filter(r => r.status === 'queued');
  const isQuizMode = activeQuizId && quizStatus !== 'ended';

  return (
    <div className="h-screen bg-[#050505] text-white flex flex-col overflow-hidden">
      <header className="h-14 border-b border-white/10 flex items-center justify-between px-4 bg-zinc-900">
         <div className="flex items-center gap-4"><h1 className="font-bold text-lg text-fuchsia-400">NEONPUB OS</h1><span className="text-xs px-2 bg-zinc-800 rounded">{pubCode}</span><span className="text-[10px] text-yellow-600">{timeRemaining}</span></div>
         <div className="flex items-center gap-4">
             <div className="flex items-center gap-2 text-yellow-500 text-sm font-bold bg-yellow-900/20 px-3 py-1 rounded-full border border-yellow-900/50"><Gem className="w-4 h-4" /> {profile?.credits || 0}</div>
             <Button variant="outline" size="sm" onClick={handleOpenDisplay}>DISPLAY</Button>
             <Button variant="ghost" size="sm" onClick={() => { if(confirm("Esci?")) { localStorage.removeItem("neonpub_pub_code"); setPubCode(null); setAppState("setup"); loadActiveEvents(); } }}><LogOut className="w-4 h-4" /></Button>
         </div>
      </header>

      <div className="flex-1 grid grid-cols-12 gap-0 overflow-hidden">
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
               {libraryTab === 'karaoke' && (
                  <div className="space-y-4">
                     {pendingReqs.map(req => (<div key={req.id} className="p-2 bg-yellow-900/10 border border-yellow-900/30 rounded flex justify-between items-center"><div className="truncate w-2/3"><div className="font-bold text-sm truncate">{req.title}</div></div><div className="flex gap-1"><Button size="icon" variant="ghost" className="text-green-500" onClick={()=>api.approveRequest(req.id)}><Check className="w-4 h-4"/></Button><Button size="icon" variant="ghost" className="text-red-500" onClick={()=>api.rejectRequest(req.id)}><X className="w-4 h-4"/></Button></div></div>))}
                     {queuedReqs.map((req, i) => (<div key={req.id} className="p-3 bg-zinc-800 rounded flex justify-between items-center"><div className="truncate w-2/3"><span className="text-zinc-500 mr-2">{i+1}</span><span className="font-bold text-sm">{req.title}</span></div><div className="flex gap-2"><Button size="icon" variant="ghost" onClick={() => deleteRequest(req.id)}><Trash2 className="w-3 h-3" /></Button><Button size="sm" className="bg-fuchsia-600 h-7" onClick={() => { setSelectedRequest(req); setYoutubeSearchResults([]); setYoutubeUrl(req.youtube_url || ""); setShowYoutubeModal(true); }}><Play className="w-3 h-3 mr-1" /> LIVE</Button></div></div>))}
                  </div>
               )}
               {libraryTab === 'quiz' && (
                    <div className="flex flex-col space-y-2">
                        <div className="grid grid-cols-2 gap-2 mb-2"><Button className="bg-zinc-800 text-xs" onClick={()=>setShowCustomQuizModal(true)}><Plus className="w-3 h-3 mr-1"/> Manuale</Button><Button className="bg-blue-600 text-xs" onClick={()=>setShowImportModal(true)}><Download className="w-3 h-3 mr-1"/> Import JSON</Button></div>
                        <div className="flex gap-1 mb-2 bg-zinc-950 p-1 rounded"><Button size="sm" variant={quizCategoryFilter==='all'?'secondary':'ghost'} className="text-[10px] h-6 flex-1" onClick={()=>setQuizCategoryFilter('all')}>All</Button><Button size="sm" variant={quizCategoryFilter==='video'?'secondary':'ghost'} className="text-[10px] h-6 flex-1" onClick={()=>setQuizCategoryFilter('video')}>Video</Button></div>
                        <div className="space-y-2 pb-20">{quizCatalog.filter(q => quizCategoryFilter === 'all' || q.category.toLowerCase().includes(quizCategoryFilter)).map((item) => (<div key={item.id} className="bg-zinc-800 hover:bg-zinc-700 p-3 rounded cursor-pointer" onClick={() => launchCatalogQuiz(item)}><div className="text-[10px] text-fuchsia-500">{item.category}</div><div className="text-sm font-medium">{item.question}</div></div>))}</div>
                    </div>
               )}
               {libraryTab === 'messages' && (
                   <div className="space-y-4 pt-2">
                       <Button className="w-full bg-cyan-600 mb-4" onClick={()=>setShowMessageModal(true)}><MessageSquare className="w-4 h-4 mr-2"/> Scrivi Messaggio</Button>
                       {pendingMessages.map(msg => (<div key={msg.id} className="bg-zinc-800 p-3 rounded border-l-2 border-blue-500"><p className="text-sm bg-black/20 p-2 rounded mb-2">{msg.text}</p><div className="flex gap-2 justify-end"><Button size="sm" variant="ghost" onClick={()=>api.rejectMessage(msg.id)}>Rifiuta</Button><Button size="sm" className="bg-green-600" onClick={()=>api.approveMessage(msg.id)}>Approva</Button></div></div>))}
                   </div>
               )}
               {libraryTab === 'settings' && (
                   <div className="space-y-4 pt-2">
                       <div className="space-y-2"><label className="text-xs text-zinc-500">Nome Locale</label><Input value={venueName} onChange={e=>setVenueName(e.target.value)} className="bg-zinc-800"/></div>
                       <div className="space-y-2"><label className="text-xs text-zinc-500">Logo (File)</label><div className="flex gap-2"><Input type="file" onChange={handleLogoUpload} className="bg-zinc-800 text-xs" accept="image/*" disabled={uploadingLogo}/>{uploadingLogo && <span className="text-yellow-500 text-xs animate-pulse">...</span>}</div></div>
                       <Button className="w-full bg-zinc-700" onClick={handleSaveSettings}><Save className="w-4 h-4 mr-2"/> Salva Impostazioni</Button>
                   </div>
               )}
            </ScrollArea>
         </aside>

         <main className="col-span-8 bg-black relative flex flex-col">
            <div className="h-10 border-b border-white/10 flex items-center px-4 justify-between bg-zinc-950"><span className="text-xs font-mono text-zinc-500">{isQuizMode ? 'QUIZ DIRECTOR' : 'KARAOKE DIRECTOR'}</span><Button size="sm" variant="ghost" onClick={handleToggleMute} className={isMuted?'text-red-500':'text-zinc-400'}>{isMuted ? <VolumeX className="w-4 h-4"/> : <Volume2 className="w-4 h-4"/>}</Button></div>
            <div className="flex-1 p-6 flex items-center justify-center bg-gradient-to-b from-zinc-900 to-black">
               {isQuizMode ? (
                  <div className="w-full max-w-4xl grid grid-cols-2 gap-8">
                      <Card className="bg-zinc-900 border-2 border-fuchsia-600"><CardHeader className="bg-fuchsia-900/20"><CardTitle>IN ONDA: {quizStatus}</CardTitle></CardHeader><CardContent className="pt-6 text-center"><h3 className="text-xl font-bold">{activeQuizData?.question}</h3></CardContent></Card>
                      <div className="flex flex-col gap-4 justify-center">
                          {quizStatus === 'active' && <Button size="lg" className="h-20 text-2xl bg-red-600 animate-pulse" onClick={() => ctrlQuiz('close_vote')}><StopCircle className="w-8 h-8 mr-3"/> STOP TELEVOTO</Button>}
                          {quizStatus === 'closed' && <Button size="lg" className="h-20 text-xl bg-blue-600" onClick={() => ctrlQuiz('show_results')}><Eye className="w-6 h-6 mr-3"/> MOSTRA RISPOSTA</Button>}
                          {(quizStatus === 'showing_results' || quizStatus === 'leaderboard') && ( <> {quizStatus !== 'leaderboard' && <Button size="lg" className="h-16 text-xl bg-yellow-500 text-black" onClick={() => ctrlQuiz('leaderboard')}><ListOrdered className="w-6 h-6 mr-3"/> CLASSIFICA</Button>} <Button size="lg" variant="destructive" className="h-16" onClick={() => ctrlQuiz('end')}><MonitorPlay className="w-6 h-6 mr-3"/> CHIUDI E ESCI</Button> </> )}
                      </div>
                  </div>
               ) : (
                  <div className="w-full max-w-3xl text-center">
                     {!currentPerformance ? <div className="text-zinc-600 flex flex-col items-center opacity-50"><ListMusic className="w-24 h-24 mb-4" /><h2>In Attesa</h2></div> : (
                        <div className="bg-zinc-900/80 border border-white/10 p-8 rounded-2xl relative">
                           <div className="mb-6"><h2 className="text-4xl font-black">{currentPerformance.song_title}</h2><p className="text-2xl text-fuchsia-400">{currentPerformance.song_artist}</p></div>
                           {currentPerformance.status === 'voting' ? <Button size="lg" className="w-full bg-yellow-500 text-black font-bold" onClick={()=>ctrlPerf('close_vote')}>CHIUDI VOTAZIONE</Button> : <div className="flex justify-center gap-4">{currentPerformance.status === 'live' ? <Button size="lg" variant="outline" className="h-16 w-16 rounded-full" onClick={()=>ctrlPerf('pause')}><Pause/></Button> : <Button size="lg" className="h-16 w-16 rounded-full bg-green-500" onClick={()=>ctrlPerf('resume')}><Play/></Button>}<Button size="lg" variant="secondary" className="h-16 w-16 rounded-full" onClick={()=>ctrlPerf('restart')}><RotateCcw/></Button><Button size="lg" variant="destructive" className="h-16 px-6" onClick={()=>ctrlPerf('end_vote')}>STOP & VOTA</Button></div>}
                        </div>
                     )}
                  </div>
               )}
            </div>
         </main>
      </div>

      {/* MODALS */}
      <Dialog open={showMessageModal} onOpenChange={setShowMessageModal}><DialogContent className="bg-zinc-900"><DialogHeader><DialogTitle>Avviso Regia</DialogTitle></DialogHeader><Textarea value={adminMessage} onChange={e=>setAdminMessage(e.target.value)} /><Button onClick={handleSendMessage} className="bg-cyan-600">INVIA</Button></DialogContent></Dialog>
      <Dialog open={showYoutubeModal} onOpenChange={setShowYoutubeModal}><DialogContent className="bg-zinc-900"><DialogHeader><DialogTitle>Video</DialogTitle></DialogHeader><Input value={youtubeSearchQuery} onChange={e=>setYoutubeSearchQuery(e.target.value)} onKeyDown={e=>e.key==='Enter'&&searchYouTube()}/><div className="max-h-40 overflow-y-auto">{youtubeSearchResults.map(v=><div key={v.id.videoId} className="p-2 hover:bg-white/10 cursor-pointer" onClick={()=>setYoutubeUrl(`https://www.youtube.com/watch?v=${v.id.videoId}`)}>{v.snippet.title}</div>)}</div><Button onClick={startPerformance} className="bg-green-600 w-full">AVVIA</Button></DialogContent></Dialog>
      <Dialog open={showCustomQuizModal} onOpenChange={setShowCustomQuizModal}><DialogContent className="bg-zinc-900"><DialogHeader><DialogTitle>Nuovo Quiz</DialogTitle></DialogHeader><Input placeholder="Domanda" value={quizQuestion} onChange={e=>setQuizQuestion(e.target.value)} /><Input placeholder="Opzione A" value={quizOptions[0]} onChange={e=>{const n=[...quizOptions];n[0]=e.target.value;setQuizOptions(n)}} /><Input placeholder="Opzione B" value={quizOptions[1]} onChange={e=>{const n=[...quizOptions];n[1]=e.target.value;setQuizOptions(n)}} /><Button onClick={launchCustomQuiz} className="bg-fuchsia-600 w-full">LANCIA</Button></DialogContent></Dialog>
      <Dialog open={showImportModal} onOpenChange={setShowImportModal}><DialogContent className="bg-zinc-900"><DialogHeader><DialogTitle>Import JSON</DialogTitle></DialogHeader><Textarea value={importText} onChange={e=>setImportText(e.target.value)} /><Button onClick={handleImportScript} className="bg-blue-600 w-full">IMPORTA</Button></DialogContent></Dialog>
    </div>
  );
}