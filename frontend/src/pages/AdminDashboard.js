import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Music, Play, Square, Trophy, Tv, Check, X, MessageSquare, 
  LogOut, SkipForward, Pause, RotateCcw, Search, Plus, ArrowLeft,
  ListMusic, BrainCircuit, Swords, Send, Star, VolumeX, Volume2, ExternalLink,
  Users, Coins, Settings, Save, LayoutDashboard, Gem, Upload, UserPlus, Ban, Trash2, Image as ImageIcon,
  FileJson, Download, Gamepad2, StopCircle, Eye, EyeOff, ListOrdered, MonitorPlay, 
  Music2, Film, Mic2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import api, { createPub, updateEventSettings, uploadLogo } from "@/lib/api";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { isAuthenticated, logout } = useAuth();
  
  const [appState, setAppState] = useState("loading");
  const [profile, setProfile] = useState(null);
  const [pubCode, setPubCode] = useState(localStorage.getItem("neonpub_pub_code"));
  
  const [eventState, setEventState] = useState({ active_module: 'karaoke', active_module_id: null });
  const [queue, setQueue] = useState([]);
  const [currentPerformance, setCurrentPerformance] = useState(null);
  const [pendingMessages, setPendingMessages] = useState([]);
  const [isMuted, setIsMuted] = useState(false);
  
  const [libraryTab, setLibraryTab] = useState("karaoke"); 
  const [quizCatalog, setQuizCatalog] = useState([]);
  const [quizCategoryFilter, setQuizCategoryFilter] = useState("all");
  const [challenges, setChallenges] = useState([]);

  const [userList, setUserList] = useState([]);
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserName, setNewUserName] = useState("");

  const [venueName, setVenueName] = useState("");
  const [venueLogo, setVenueLogo] = useState("");
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const [activeQuizId, setActiveQuizId] = useState(null);
  const [activeQuizData, setActiveQuizData] = useState(null);
  const [quizStatus, setQuizStatus] = useState(null); 
  const [quizResults, setQuizResults] = useState(null); 
  
  const [showYoutubeModal, setShowYoutubeModal] = useState(false);
  const [showCustomQuizModal, setShowCustomQuizModal] = useState(false);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState("");

  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [youtubeSearchQuery, setYoutubeSearchQuery] = useState("");
  const [youtubeSearchResults, setYoutubeSearchResults] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [searchingYoutube, setSearchingYoutube] = useState(false);

  const [quizQuestion, setQuizQuestion] = useState("");
  const [quizOptions, setQuizOptions] = useState(["", "", "", ""]);
  const [quizCorrectIndex, setQuizCorrectIndex] = useState(0);

  const [adminMessage, setAdminMessage] = useState("");
  const [newEventName, setNewEventName] = useState("");
  const [creatingEvent, setCreatingEvent] = useState(false);
  const pollIntervalRef = useRef(null);

  useEffect(() => { checkUserProfile(); }, [isAuthenticated]);

  const checkUserProfile = async () => {
    if (!isAuthenticated) return; 
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      let { data: userProfile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (!userProfile && user.email === 'admin@neonpub.com') userProfile = { id: user.id, email: user.email, role: 'super_admin', credits: 9999 };
      if (!userProfile) userProfile = (await supabase.from('profiles').insert([{ id: user.id, email: user.email, role: 'operator', credits: 0 }]).select().single()).data;
      setProfile(userProfile);
      
      if (userProfile.role === 'super_admin') { 
          setAppState("super_admin"); loadSuperAdminData(); 
      } else {
        const storedCode = localStorage.getItem("neonpub_pub_code");
        if (storedCode) { setPubCode(storedCode); setAppState("dashboard"); } 
        else {
            const activeEvent = await api.recoverActiveEvent();
            if (activeEvent) { localStorage.setItem("neonpub_pub_code", activeEvent.code); setPubCode(activeEvent.code); setAppState("dashboard"); toast.success("Evento ripristinato"); } 
            else { setAppState("setup"); }
        }
      }
    } catch (error) { console.error(error); }
  };

  const handleLogout = () => { localStorage.removeItem("neonpub_pub_code"); logout(); navigate("/"); };

  const handleStartEvent = async (e) => {
    e.preventDefault();
    if (!newEventName) return toast.error("Inserisci nome");
    setCreatingEvent(true);
    try {
        const { data } = await createPub({ name: newEventName });
        localStorage.setItem("neonpub_pub_code", data.code); setPubCode(data.code); setAppState("dashboard");
        toast.success("Evento Iniziato!");
    } catch (error) { toast.error(error.message); } finally { setCreatingEvent(false); }
  };

  const loadData = useCallback(async () => {
    if (!pubCode || appState !== 'dashboard') return;
    try {
      const stateData = await api.getEventState();
      if(stateData) setEventState(stateData);

      const [qRes, perfRes, msgRes, activeQuizRes, pubRes, quizCatRes, challRes] = await Promise.all([
        api.getAdminQueue(), api.getAdminCurrentPerformance(), api.getAdminPendingMessages(), api.getActiveQuiz(),
        api.getPub(pubCode), api.getQuizCatalog(), api.getChallengeCatalog()
      ]);

      setQueue(qRes.data || []); setCurrentPerformance(perfRes.data); setPendingMessages(msgRes.data || []);
      setQuizCatalog(quizCatRes.data || []); setChallenges(challRes.data || []);
      if(pubRes.data && !venueName) { setVenueName(pubRes.data.name); setVenueLogo(pubRes.data.logo_url || ""); }
      
      if(activeQuizRes.data) {
         setActiveQuizId(activeQuizRes.data.id); setActiveQuizData(activeQuizRes.data); setQuizStatus(activeQuizRes.data.status);
         if(activeQuizRes.data.status === 'showing_results' || activeQuizRes.data.status === 'leaderboard') {
             const res = await api.getQuizResults(activeQuizRes.data.id); setQuizResults(res.data);
         }
      } else { setActiveQuizId(null); setActiveQuizData(null); setQuizStatus(null); setQuizResults(null); }
    } catch (error) { console.error(error); }
  }, [pubCode, appState, venueName]);

  useEffect(() => {
    if (appState === 'dashboard') {
      loadData(); pollIntervalRef.current = setInterval(loadData, 3000);
      return () => clearInterval(pollIntervalRef.current);
    }
  }, [appState, loadData]);

  const loadSuperAdminData = async () => { const { data } = await api.getAllProfiles(); setUserList(data || []); };
  const addCredits = async (userId, amount) => { await api.updateProfileCredits(userId, (userList.find(u=>u.id===userId)?.credits||0)+amount); loadSuperAdminData(); };
  const handleCreateOperator = async () => { await api.createOperatorProfile(); setShowCreateUserModal(false); toast.success("Fatto"); };

  const handleOpenDisplay = () => window.open(`/display/${pubCode}`, 'NeonPubDisplay', `popup=yes,width=1280,height=720`);
  const handleToggleMute = async () => { setIsMuted(!isMuted); await api.toggleMute(!isMuted); };
  const handleLogoUpload = async (e) => {
      const file = e.target.files[0]; if (!file) return; setUploadingLogo(true);
      try { const url = await api.uploadLogo(file); setVenueLogo(url); toast.success("Logo OK"); } catch { toast.error("Errore logo"); } finally { setUploadingLogo(false); }
  };
  const handleSaveSettings = async () => { await updateEventSettings({ name: venueName, logo_url: venueLogo }); toast.success("Salvataggio OK"); };

  const searchYouTube = async (manualQuery = null) => {
    const q = manualQuery || youtubeSearchQuery; if (!q.trim()) return; setSearchingYoutube(true);
    try {
      const res = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(q)}&type=video&maxResults=5&key=${process.env.REACT_APP_YOUTUBE_API_KEY}`);
      const data = await res.json(); setYoutubeSearchResults(data.items || []);
    } catch { toast.error("Errore YT"); } finally { setSearchingYoutube(false); }
  };

  const startPerformance = async () => {
    if (!selectedRequest || !youtubeUrl) return toast.error("Manca URL");
    try { const { data } = await api.startPerformance(selectedRequest.id, youtubeUrl); setCurrentPerformance(data); setShowYoutubeModal(false); toast.success("Karaoke OK"); loadData(); } catch(e) { toast.error(e.message); }
  };

  const ctrlPerf = async (action) => {
      if(!currentPerformance) return;
      try {
        if(action==='pause') await api.pausePerformance(currentPerformance.id);
        if(action==='resume') await api.resumePerformance(currentPerformance.id);
        if(action==='restart') await api.restartPerformance(currentPerformance.id);
        if(action==='end_vote') await api.endPerformance(currentPerformance.id);
        if(action==='skip_next') { if(window.confirm("Chiudere senza voto?")) await api.stopAndNext(currentPerformance.id); }
        if(action==='close_vote') await api.closeVoting(currentPerformance.id);
        loadData();
      } catch(e) { toast.error("Errore comando"); }
  };

  const deleteRequest = async (id) => { if(confirm("Eliminare?")) { await api.deleteRequest(id); loadData(); } };

  const handleSendMessage = async () => { await api.sendMessage({ text: adminMessage }); setShowMessageModal(false); setAdminMessage(""); toast.success("Inviato"); };

  const launchCustomQuiz = async () => {
      try { await api.startQuiz({ category: "custom", question: quizQuestion, options: quizOptions, correct_index: quizCorrectIndex, points: 10 }); setShowCustomQuizModal(false); toast.success("Quiz OK"); loadData(); } catch(e) { toast.error("Errore"); }
  };

  const launchCatalogQuiz = async (item) => {
      if(window.confirm(`Lanciare: ${item.question}?`)) { await api.setEventModule('quiz', item.id); toast.success("Quiz Lanciato!"); loadData(); }
  };

  // --- FIXATO ---
  const ctrlQuiz = async (action) => {
      if(!activeQuizId) return;
      try {
          if(action==='close_vote') await api.closeQuizVoting(activeQuizId);
          if(action==='show_results') await api.showQuizResults(activeQuizId);
          if(action==='leaderboard') await api.showQuizLeaderboard(activeQuizId);
          if(action==='end') { 
              await api.restoreKaraokeMode(); // PULIZIA TOTALE
              toast.info("Tornati al Karaoke"); 
              setActiveQuizId(null); setQuizStatus(null);
          }
          loadData();
      } catch(e) { toast.error("Errore comando quiz"); }
  };

  const handleImportScript = async () => {
      try { const res = await api.importQuizCatalog(importText); toast.success(`${res.count} Quiz importati!`); setShowImportModal(false); setImportText(""); loadData(); } catch(e) { toast.error(e.message); }
  };

  const filteredCatalog = quizCatalog.filter(item => {
      if (quizCategoryFilter === 'all') return true;
      const cat = item.category.toLowerCase();
      if (quizCategoryFilter === 'intro' && (cat.includes('intro') || item.media_type === 'audio')) return true;
      if (quizCategoryFilter === 'video' && (cat.includes('cinema') || cat.includes('video') || item.media_type === 'video')) return true;
      if (quizCategoryFilter === 'lyrics' && (cat.includes('testo') || cat.includes('lyrics'))) return true;
      return false;
  });

  if (appState === 'loading') return <div className="bg-black h-screen text-white flex items-center justify-center">Caricamento...</div>;
  if (appState === 'super_admin') return <div className="h-screen bg-zinc-950 text-white p-8"><h1>SUPER ADMIN</h1><div className="grid gap-4">{userList.map(u=><div key={u.id}>{u.email}: {u.credits} <button onClick={()=>addCredits(u.id,10)}>+10</button></div>)}</div></div>;
  if (appState === 'setup') return <div className="h-screen bg-zinc-950 flex items-center justify-center"><Card className="w-96 bg-zinc-900 text-white"><CardContent className="pt-6"><Input placeholder="Nome Evento" value={newEventName} onChange={e=>setNewEventName(e.target.value)} /><Button onClick={handleStartEvent} className="w-full mt-4 bg-fuchsia-600">START</Button></CardContent></Card></div>;

  const pendingReqs = queue.filter(r => r.status === 'pending');
  const queuedReqs = queue.filter(r => r.status === 'queued');

  return (
    <div className="h-screen bg-[#050505] text-white flex flex-col overflow-hidden">
      <header className="h-14 border-b border-white/10 flex items-center justify-between px-4 bg-zinc-900"><div className="flex gap-4"><h1 className="font-bold text-fuchsia-400">NEONPUB OS</h1><span className="bg-zinc-800 px-2 rounded text-zinc-400">{pubCode}</span></div><div className="flex gap-4"><span className="text-yellow-500 flex gap-2"><Gem className="w-4 h-4"/>{profile?.credits||0}</span><Button size="sm" onClick={handleOpenDisplay} variant="outline">DISPLAY</Button><Button size="sm" variant="ghost" onClick={handleLogout}><LogOut/></Button></div></header>

      <div className="flex-1 grid grid-cols-12 gap-0 overflow-hidden">
         <aside className="col-span-4 border-r border-white/10 bg-zinc-900/50 flex flex-col">
            <div className="p-2 border-b border-white/5"><Tabs value={libraryTab} onValueChange={setLibraryTab} className="w-full"><TabsList className="grid w-full grid-cols-5 bg-zinc-950 p-1"><TabsTrigger value="karaoke"><ListMusic/></TabsTrigger><TabsTrigger value="quiz"><BrainCircuit/></TabsTrigger><TabsTrigger value="challenges"><Swords/></TabsTrigger><TabsTrigger value="messages"><MessageSquare/></TabsTrigger><TabsTrigger value="settings"><Settings/></TabsTrigger></TabsList></Tabs></div>
            <ScrollArea className="flex-1 p-3">
               {libraryTab === 'karaoke' && (<div className="space-y-4">{pendingReqs.map(r=><div key={r.id} className="p-2 bg-yellow-900/10 border border-yellow-900/30 rounded flex justify-between"><div className="truncate w-2/3">{r.title}</div><div className="flex gap-1"><Button size="icon" variant="ghost" className="text-green-500" onClick={()=>api.approveRequest(r.id)}><Check/></Button><Button size="icon" variant="ghost" className="text-red-500" onClick={()=>api.rejectRequest(r.id)}><X/></Button></div></div>)}{queuedReqs.map((r,i)=><div key={r.id} className="p-3 bg-zinc-800 rounded flex justify-between group"><div className="w-2/3 truncate">{i+1}. {r.title}</div><div className="flex gap-2"><Button size="icon" onClick={()=>deleteRequest(r.id)}><Trash2/></Button><Button size="sm" className="bg-fuchsia-600" onClick={()=>{setSelectedRequest(r); setYoutubeSearchResults([]); setYoutubeUrl(r.youtube_url||""); setShowYoutubeModal(true); if(!r.youtube_url) setTimeout(()=>searchYouTube(`${r.title} ${r.artist} karaoke`),100);}}><Play/></Button></div></div>)}</div>)}
               
               {libraryTab === 'quiz' && (
                    <div className="flex flex-col h-full">
                        <div className="grid grid-cols-2 gap-2 mb-4"><Button onClick={()=>setShowCustomQuizModal(true)} variant="outline"><Plus/></Button><Button onClick={()=>setShowImportModal(true)} className="bg-blue-600"><Download/></Button></div>
                        {activeQuizId && quizStatus !== 'ended' ? (
                            <Card className="bg-zinc-900 border-2 border-fuchsia-600 mb-6">
                                <CardHeader className="py-2 bg-fuchsia-900/20"><CardTitle className="text-sm flex justify-between">IN ONDA <span className="bg-black px-2 rounded">{quizStatus}</span></CardTitle></CardHeader>
                                <CardContent className="pt-4 space-y-4">
                                    <div className="text-center font-bold text-lg">{activeQuizData?.question}</div>
                                    {activeQuizData?.media_url && (<div className="bg-black/50 p-2 rounded text-center">{activeQuizData.media_type==='video'?<iframe src={activeQuizData.media_url.replace("watch?v=","embed/")} className="w-full h-24"/>:<audio controls src={activeQuizData.media_url} className="w-full"/>}</div>)}
                                    <div className="grid gap-2">
                                        {quizStatus==='active'&&<Button className="bg-red-600 animate-pulse" onClick={()=>ctrlQuiz('close_vote')}>STOP VOTO</Button>}
                                        {quizStatus==='closed'&&<Button className="bg-blue-600" onClick={()=>ctrlQuiz('show_results')}>MOSTRA RISPOSTA</Button>}
                                        {(quizStatus==='showing_results'||quizStatus==='leaderboard')&&(<><Button className="bg-yellow-600 text-black" onClick={()=>ctrlQuiz('leaderboard')}>CLASSIFICA</Button><Button variant="destructive" onClick={()=>ctrlQuiz('end')}>CHIUDI</Button></>)}
                                    </div>
                                </CardContent>
                            </Card>
                        ) : <div className="text-center text-zinc-500 p-4 border border-dashed border-zinc-700">NESSUN QUIZ ATTIVO</div>}
                        <div className="flex gap-1 mb-2"><Button size="sm" variant={quizCategoryFilter==='all'?'secondary':'ghost'} onClick={()=>setQuizCategoryFilter('all')}>All</Button><Button size="sm" variant={quizCategoryFilter==='video'?'secondary':'ghost'} onClick={()=>setQuizCategoryFilter('video')}>Video</Button></div>
                        <div className="space-y-2">{filteredCatalog.map(item=><div key={item.id} className="p-3 bg-zinc-800 rounded hover:bg-zinc-700 cursor-pointer" onClick={()=>launchCatalogQuiz(item)}><div className="text-xs text-fuchsia-500 font-bold">{item.category}</div><div className="text-sm">{item.question}</div></div>)}</div>
                    </div>
               )}
               {libraryTab === 'messages' && (<div className="space-y-2"><Button className="w-full mb-4" onClick={()=>setShowMessageModal(true)}>Scrivi</Button>{pendingMessages.map(m=><div key={m.id} className="p-2 bg-zinc-800 rounded border-l-2 border-blue-500"><p>{m.text}</p><div className="flex gap-2 justify-end mt-2"><Button size="sm" onClick={()=>api.rejectMessage(m.id)}>Rifiuta</Button><Button size="sm" className="bg-green-600" onClick={()=>api.approveMessage(m.id)}>Approva</Button></div></div>)}</div>)}
               {libraryTab === 'settings' && (<div className="space-y-4"><Input value={venueName} onChange={e=>setVenueName(e.target.value)}/><Input type="file" onChange={handleLogoUpload}/><Button className="w-full" onClick={handleSaveSettings}>Salva</Button></div>)}
            </ScrollArea>
         </aside>

         <main className="col-span-8 bg-black flex flex-col">
            <div className="h-10 border-b border-white/10 flex items-center px-4 justify-between bg-zinc-950"><span className="text-xs font-mono">LIVE</span><Button size="sm" variant="ghost" onClick={handleToggleMute}>{isMuted?<VolumeX/>:<Volume2/>}</Button></div>
            <div className="flex-1 p-6 flex items-center justify-center bg-gradient-to-b from-zinc-900 to-black">
               {eventState.active_module === 'karaoke' && (
                  <div className="w-full max-w-3xl text-center">
                     {!currentPerformance ? <div className="text-zinc-600 opacity-50">In Attesa...</div> : (
                        <div className="bg-zinc-900/80 border border-white/10 p-8 rounded-2xl shadow-2xl relative">
                           <div className="mb-6"><h2 className="text-4xl font-black">{currentPerformance.song_title}</h2><p className="text-2xl text-fuchsia-400">{currentPerformance.song_artist}</p><div className="mt-4">🎤 {currentPerformance.user_nickname}</div></div>
                           {currentPerformance.status === 'voting' ? <div className="bg-yellow-500/20 p-6 rounded animate-pulse">VOTAZIONE IN CORSO<Button className="w-full mt-4 bg-yellow-500 text-black" onClick={()=>ctrlPerf('close_vote')}>CHIUDI</Button></div> : (
                               <div className="flex justify-center gap-4">{currentPerformance.status==='live'?<Button size="icon" onClick={()=>ctrlPerf('pause')}><Pause/></Button>:<Button size="icon" onClick={()=>ctrlPerf('resume')}><Play/></Button>}<Button size="icon" onClick={()=>ctrlPerf('restart')}><RotateCcw/></Button><Button variant="destructive" onClick={()=>ctrlPerf('end_vote')}>STOP</Button></div>
                           )}
                        </div>
                     )}
                  </div>
               )}
            </div>
         </main>
      </div>
      
      {/* MODALS */}
      <Dialog open={showMessageModal} onOpenChange={setShowMessageModal}><DialogContent className="bg-zinc-900"><Textarea value={adminMessage} onChange={e=>setAdminMessage(e.target.value)}/><Button onClick={handleSendMessage}>Invia</Button></DialogContent></Dialog>
      <Dialog open={showYoutubeModal} onOpenChange={setShowYoutubeModal}><DialogContent className="bg-zinc-900 max-w-3xl"><div className="flex gap-2"><Input value={youtubeSearchQuery} onChange={e=>setYoutubeSearchQuery(e.target.value)}/><Button onClick={()=>searchYouTube()}>Cerca</Button></div><div className="max-h-60 overflow-y-auto">{youtubeSearchResults.map(v=><div key={v.id.videoId} onClick={()=>{setYoutubeUrl(`https://www.youtube.com/watch?v=${v.id.videoId}`); setYoutubeSearchResults([]);}} className="p-2 hover:bg-white/10 cursor-pointer">{v.snippet.title}</div>)}</div><Input value={youtubeUrl} onChange={e=>setYoutubeUrl(e.target.value)}/><Button onClick={startPerformance} disabled={!youtubeUrl}>MANDA IN ONDA</Button></DialogContent></Dialog>
      <Dialog open={showCustomQuizModal} onOpenChange={setShowCustomQuizModal}><DialogContent className="bg-zinc-900"><Textarea value={quizQuestion} onChange={e=>setQuizQuestion(e.target.value)} placeholder="Domanda"/><Button onClick={launchCustomQuiz}>Lancia</Button></DialogContent></Dialog>
      <Dialog open={showImportModal} onOpenChange={setShowImportModal}><DialogContent className="bg-zinc-900"><Textarea value={importText} onChange={e=>setImportText(e.target.value)} placeholder="JSON"/><Button onClick={handleImportScript}>Importa</Button></DialogContent></Dialog>
    </div>
  );
}