import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Music, Play, Trophy, Tv, Check, X, MessageSquare, 
  LogOut, SkipForward, Pause, RotateCcw, Search, Plus, 
  ListMusic, BrainCircuit, Swords, Send, VolumeX, Volume2, ExternalLink,
  Users, Settings, Save, Gem, Upload, UserPlus, Ban, Trash2, Download, Gamepad2, 
  StopCircle, Eye, ListOrdered, MonitorPlay, Music2, Film, Clock
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
  const [appState, setAppState] = useState("loading");
  const [profile, setProfile] = useState(null);
  const [pubCode, setPubCode] = useState(localStorage.getItem("neonpub_pub_code"));
  const [eventState, setEventState] = useState({ active_module: 'karaoke', active_module_id: null });
  const [queue, setQueue] = useState([]);
  const [currentPerformance, setCurrentPerformance] = useState(null);
  const [pendingMessages, setPendingMessages] = useState([]);
  const [approvedMessages, setApprovedMessages] = useState([]);
  const [isMuted, setIsMuted] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [libraryTab, setLibraryTab] = useState("karaoke"); 
  const [quizCatalog, setQuizCatalog] = useState([]);
  const [quizCategoryFilter, setQuizCategoryFilter] = useState("all"); 
  const [challenges, setChallenges] = useState([]);
  const [userList, setUserList] = useState([]);
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState(""); 
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
  const [quizMediaUrl, setQuizMediaUrl] = useState("");
  const [quizMediaType, setQuizMediaType] = useState("text");
  const [quizCategory, setQuizCategory] = useState("Indovina Intro");
  const [adminMessage, setAdminMessage] = useState("");
  const [newEventName, setNewEventName] = useState("");
  const [creatingEvent, setCreatingEvent] = useState(false);
  const [activeEventsList, setActiveEventsList] = useState([]);

  useEffect(() => { checkUserProfile(); }, [isAuthenticated]);

  const checkUserProfile = async () => {
    if (!isAuthenticated) return; 
    try {
      const { data: { user } } = await supabase.auth.getUser();
      let { data: userProfile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (user.email === 'admin@neonpub.com') {
          if (!userProfile || userProfile.role !== 'super_admin') {
              await supabase.from('profiles').upsert({ id: user.id, email: user.email, role: 'super_admin', credits: 9999, is_active: true });
              userProfile = { id: user.id, email: user.email, role: 'super_admin', credits: 9999, is_active: true };
          }
      }
      setProfile(userProfile);
      if (userProfile.role === 'super_admin') { setAppState("super_admin"); loadSuperAdminData(); }
      else {
        if (pubCode) { 
            const pubData = await api.getPub(pubCode);
            if (pubData.data) setAppState("dashboard"); 
            else { localStorage.removeItem("neonpub_pub_code"); loadActiveEvents(); setAppState("setup"); }
        } else { loadActiveEvents(); setAppState("setup"); }
      }
    } catch (error) { console.error(error); }
  };

  const loadActiveEvents = async () => { setActiveEventsList(await api.getActiveEventsForUser()); };
  const loadSuperAdminData = async () => { setUserList((await api.getAllProfiles()).data || []); };

  const loadData = useCallback(async () => {
    if (!pubCode || appState !== 'dashboard') return;
    try {
      const pubRes = await api.getPub(pubCode);
      if (pubRes.data) {
          const diff = new Date(pubRes.data.expires_at) - new Date();
          setTimeRemaining(diff > 0 ? `${Math.floor(diff/3600000)}h ${Math.floor((diff%3600000)/60000)}m` : "SCADUTO");
      }
      const stateData = await api.getEventState(); setEventState(stateData);
      const [q, p, m, aq, qc, ch] = await Promise.all([
        api.getAdminQueue(), api.getAdminCurrentPerformance(), api.getAdminPendingMessages(),
        api.getActiveQuiz(), api.getQuizCatalog(), api.getChallengeCatalog()
      ]);
      setQueue(q.data); setCurrentPerformance(p.data); setPendingMessages(m.data);
      setQuizCatalog(qc.data); setChallenges(ch.data);
      if(aq.data) {
         setActiveQuizId(aq.data.id); setActiveQuizData(aq.data); setQuizStatus(aq.data.status);
         if(aq.data.status === 'showing_results') setQuizResults((await api.getQuizResults(aq.data.id)).data);
      } else setActiveQuizId(null);
      const approved = await supabase.from('messages').select('*, participants(nickname)').eq('status', 'approved').order('created_at', {ascending: false}).limit(10);
      setApprovedMessages(approved.data?.map(m => ({...m, user_nickname: m.participants?.nickname})) || []);
    } catch (e) { console.error(e); }
  }, [pubCode, appState]);

  useEffect(() => {
    if (appState === 'dashboard') {
      loadData(); const int = setInterval(loadData, 3000);
      return () => clearInterval(int);
    }
  }, [appState, loadData]);

  const searchYouTube = async (q) => {
    setSearchingYoutube(true);
    const key = process.env.REACT_APP_YOUTUBE_API_KEY;
    const res = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(q)}&type=video&maxResults=5&key=${key}`);
    const d = await res.json(); setYoutubeSearchResults(d.items || []); setSearchingYoutube(false);
  };

  const ctrlPerf = async (action) => {
      if(!currentPerformance) return;
      if(action==='pause') await api.pausePerformance(currentPerformance.id);
      if(action==='resume') await api.resumePerformance(currentPerformance.id);
      if(action==='restart') await api.restartPerformance(currentPerformance.id);
      if(action==='end_vote') await api.endPerformance(currentPerformance.id);
      if(action==='close_vote') await api.closeVoting(currentPerformance.id);
      if(action==='skip_next') await api.stopAndNext(currentPerformance.id);
      loadData();
  };

  const ctrlQuiz = async (action) => {
      if(!activeQuizId) return;
      if(action==='close_vote') await api.closeQuizVoting(activeQuizId);
      if(action==='show_results') await api.showQuizResults(activeQuizId);
      if(action==='leaderboard') await api.showQuizLeaderboard(activeQuizId);
      if(action==='end') await api.endQuiz(activeQuizId);
      loadData();
  };

  const MUSIC_CATEGORIES = [
    { id: 'all', label: 'Tutti' }, { id: 'intro', label: 'Intro' }, { id: 'lyrics', label: 'Testi' },
    { id: 'video', label: 'Videoclip' }, { id: 'cover', label: 'Cover' }, { id: 'anno', label: 'Anno' }, { id: 'artista', label: 'Artista' },
  ];

  const filteredCatalog = quizCatalog.filter(item => {
      if (quizCategoryFilter === 'all') return true;
      const cat = (item.category || '').toLowerCase();
      if (quizCategoryFilter === 'intro' && (cat.includes('intro') || item.media_type === 'audio')) return true;
      if (quizCategoryFilter === 'video' && (cat.includes('video') || item.media_type === 'video')) return true;
      if (quizCategoryFilter === 'lyrics' && (cat.includes('testo') || cat.includes('lyrics'))) return true;
      if (quizCategoryFilter === 'cover' && cat.includes('cover')) return true;
      if (quizCategoryFilter === 'anno' && cat.includes('anno')) return true;
      if (quizCategoryFilter === 'artista' && (cat.includes('artista') || cat.includes('cantante'))) return true;
      return false;
  });

  if (appState === 'loading') return <div className="h-screen bg-black text-white flex items-center justify-center">Caricamento...</div>;

  if (appState === 'super_admin') return (
    <div className="h-screen bg-zinc-950 text-white p-8 overflow-auto">
        <header className="flex justify-between items-center mb-8 border-b border-zinc-800 pb-4">
            <h1 className="text-3xl font-bold text-fuchsia-500">SUPER ADMIN</h1>
            <Button variant="ghost" onClick={logout}><LogOut className="mr-2"/> Esci</Button>
        </header>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {userList.map(u => (
                <Card key={u.id} className="bg-zinc-900 border-zinc-800">
                    <CardHeader><CardTitle className="text-sm">{u.email}</CardTitle></CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-yellow-500 mb-4">{u.credits} CR</div>
                        <div className="flex gap-2">
                            <Button size="sm" onClick={() => api.updateProfileCredits(u.id, u.credits + 10)}>+10</Button>
                            <Button size="sm" variant={u.is_active ? "destructive" : "secondary"} onClick={() => api.toggleUserStatus(u.id, !u.is_active)}>{u.is_active ? <Ban/> : <Check/>}</Button>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    </div>
  );

  if (appState === 'setup') return (
    <div className="h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-6">
        <Card className="w-full max-w-md bg-zinc-900 border-zinc-800 shadow-2xl">
            <CardHeader><CardTitle className="text-center">Nuova Serata</CardTitle></CardHeader>
            <CardContent className="space-y-4">
                <div className="text-center text-yellow-500 text-sm font-bold bg-yellow-900/10 p-2 rounded">CREDITI: {profile?.credits}</div>
                <Input placeholder="Nome Evento" value={newEventName} onChange={e=>setNewEventName(e.target.value)} className="bg-zinc-800" />
                <Button onClick={async () => { const { data } = await createPub({ name: newEventName }); localStorage.setItem("neonpub_pub_code", data.code); setPubCode(data.code); setAppState("dashboard"); }} className="w-full bg-fuchsia-600 h-12 font-bold">LANCIA (-1 Credit)</Button>
                <div className="pt-4 border-t border-white/10">
                    <p className="text-xs text-zinc-500 mb-2 uppercase font-bold tracking-widest">Eventi attivi:</p>
                    {activeEventsList.map(e => (
                        <Button key={e.id} variant="outline" className="w-full mb-2 justify-between" onClick={() => { localStorage.setItem("neonpub_pub_code", e.code); setPubCode(e.code); setAppState("dashboard"); }}>{e.name} <Clock className="w-4 h-4"/></Button>
                    ))}
                </div>
            </CardContent>
            <CardFooter><Button variant="ghost" onClick={logout} className="w-full">Esci</Button></CardFooter>
        </Card>
    </div>
  );

  return (
    <div className="h-screen bg-[#050505] text-white flex flex-col overflow-hidden">
      <header className="h-14 border-b border-white/10 flex items-center justify-between px-4 bg-zinc-900">
         <div className="flex items-center gap-4">
            <h1 className="font-bold text-lg text-fuchsia-400">NEONPUB OS</h1>
            <div className="flex flex-col">
                <span className="text-xs font-mono text-zinc-400">{pubCode}</span>
                <span className="text-[10px] text-yellow-600 flex items-center gap-1"><Clock className="w-3 h-3"/> {timeRemaining}</span>
            </div>
         </div>
         <div className="flex items-center gap-4">
             <div className="text-yellow-500 font-bold text-sm bg-yellow-900/10 px-3 py-1 rounded-full border border-yellow-900/30 flex items-center gap-2"><Gem className="w-4 h-4"/>{profile?.credits}</div>
             <Button variant="outline" size="sm" onClick={() => window.open(`/display/${pubCode}`, '_blank')} className="border-cyan-800 text-cyan-400"><Tv className="w-4 h-4 mr-2" /> DISPLAY</Button>
             <Button variant="ghost" size="sm" onClick={() => { localStorage.removeItem("neonpub_pub_code"); setAppState("setup"); loadActiveEvents(); }}><LogOut/></Button>
         </div>
      </header>

      <div className="flex-1 grid grid-cols-12 overflow-hidden">
         <aside className="col-span-4 border-r border-white/10 bg-zinc-900/50 flex flex-col">
            <Tabs value={libraryTab} onValueChange={setLibraryTab} className="w-full">
               <TabsList className="grid grid-cols-5 bg-zinc-950 p-1">
                  <TabsTrigger value="karaoke"><ListMusic className="w-4 h-4"/></TabsTrigger>
                  <TabsTrigger value="quiz"><BrainCircuit className="w-4 h-4"/></TabsTrigger>
                  <TabsTrigger value="challenges"><Swords className="w-4 h-4"/></TabsTrigger>
                  <TabsTrigger value="messages" className="relative"><MessageSquare className="w-4 h-4"/>{pendingMessages.length > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>}</TabsTrigger>
                  <TabsTrigger value="settings"><Settings className="w-4 h-4"/></TabsTrigger>
               </TabsList>
            </Tabs>
            
            <ScrollArea className="flex-1 p-3">
               {libraryTab === 'karaoke' && (
                  <div className="space-y-4">
                     {queue.filter(r => r.status === 'pending').map(req => (
                        <div key={req.id} className="p-3 bg-yellow-900/10 border border-yellow-900/30 rounded flex justify-between items-center">
                           <div className="truncate"><div className="font-bold text-sm truncate">{req.title}</div><div className="text-xs text-zinc-400">{req.user_nickname}</div></div>
                           <div className="flex gap-1"><Button size="icon" variant="ghost" className="text-green-500" onClick={()=>api.approveRequest(req.id)}><Check/></Button><Button size="icon" variant="ghost" className="text-red-500" onClick={()=>api.rejectRequest(req.id)}><X/></Button></div>
                        </div>
                     ))}
                     {queue.filter(r => r.status === 'queued').map((req, i) => (
                        <div key={req.id} className="p-3 bg-zinc-800 rounded flex justify-between items-center group">
                           <div className="flex items-center gap-3"><span className="text-zinc-500 font-mono text-xs">{i+1}</span><div className="truncate"><div className="font-bold text-sm">{req.title}</div><div className="text-xs text-zinc-400">{req.user_nickname}</div></div></div>
                           <div className="flex gap-2"><Button size="icon" variant="ghost" className="text-zinc-500 hover:text-red-500" onClick={() => api.deleteRequest(req.id)}><Trash2 className="w-4 h-4"/></Button><Button size="sm" className="bg-fuchsia-600" onClick={() => { setSelectedRequest(req); setYoutubeUrl(req.youtube_url || ""); setShowYoutubeModal(true); if(!req.youtube_url) setTimeout(()=>searchYouTube(`${req.title} ${req.artist} karaoke`), 100); }}>LIVE</Button></div>
                        </div>
                     ))}
                  </div>
               )}

               {libraryTab === 'quiz' && (
                  <div className="space-y-4">
                     <div className="grid grid-cols-2 gap-2"><Button className="text-xs" onClick={()=>setShowCustomQuizModal(true)}><Plus className="w-3 h-3 mr-1"/> Manuale</Button><Button className="text-xs" onClick={()=>setShowImportModal(true)}><Download className="w-3 h-3 mr-1"/> Import JSON</Button></div>
                     {activeQuizId && (
                        <Card className="bg-zinc-900 border-2 border-fuchsia-600 p-4">
                           <div className="text-xs text-fuchsia-500 font-bold mb-2 uppercase tracking-widest flex justify-between">In Onda <span>{quizStatus}</span></div>
                           <div className="font-bold text-lg mb-4">{activeQuizData?.question}</div>
                           <div className="grid grid-cols-1 gap-2">
                              {quizStatus === 'active' && <Button className="bg-red-600 font-bold" onClick={() => ctrlQuiz('close_vote')}><StopCircle className="mr-2"/> STOP RISPOSTE</Button>}
                              {quizStatus === 'closed' && <Button className="bg-blue-600 font-bold" onClick={() => ctrlQuiz('show_results')}><Eye className="mr-2"/> RISULTATO</Button>}
                              {quizStatus === 'showing_results' && <Button className="bg-yellow-600 text-black font-bold" onClick={() => ctrlQuiz('leaderboard')}><ListOrdered className="mr-2"/> CLASSIFICA</Button>}
                              <Button variant="outline" size="sm" onClick={() => ctrlQuiz('end')}>TERMINA QUIZ</Button>
                           </div>
                        </Card>
                     )}
                     <div className="flex flex-wrap gap-1 mb-2 bg-zinc-950 p-1 rounded">
                        {MUSIC_CATEGORIES.map(cat => (
                            <Button key={cat.id} size="sm" variant={quizCategoryFilter===cat.id?'secondary':'ghost'} className="text-[10px] h-6 px-2" onClick={()=>setQuizCategoryFilter(cat.id)}>{cat.label}</Button>
                        ))}
                     </div>
                     {filteredCatalog.map(item => (
                        <div key={item.id} className="p-3 bg-zinc-800 rounded hover:border-yellow-500 border border-transparent cursor-pointer relative group" onClick={() => api.setEventModule('quiz', item.id)}>
                           <div className="text-[10px] font-bold text-fuchsia-500 uppercase">{item.category}</div>
                           <div className="text-sm font-medium">{item.question}</div>
                           {item.media_type === 'audio' && <Music2 className="absolute top-2 right-2 w-3 h-3 text-yellow-500"/>}
                        </div>
                     ))}
                  </div>
               )}

               {libraryTab === 'challenges' && (
                   <div className="space-y-3">
                       {challenges.map(c => (
                           <div key={c.id} className="p-3 bg-zinc-800 rounded border-l-2 border-red-500 hover:bg-zinc-700 cursor-pointer" onClick={() => toast.info(`Sfida "${c.title}" lanciata!`)}>
                               <div className="flex justify-between font-bold text-sm"><span>{c.title}</span><Swords className="w-3 h-3 text-red-500" /></div>
                               <p className="text-xs text-zinc-400">{c.description}</p>
                           </div>
                       ))}
                   </div>
               )}

               {libraryTab === 'messages' && (
                  <div className="space-y-4">
                     <Button className="w-full bg-cyan-600" onClick={()=>setShowMessageModal(true)}>Nuovo Messaggio Regia</Button>
                     {pendingMessages.map(msg => (
                        <div key={msg.id} className="bg-zinc-800 p-3 rounded border-l-2 border-blue-500">
                           <div className="font-bold text-xs text-zinc-400 mb-1">{msg.user_nickname}</div>
                           <p className="text-sm bg-black/20 p-2 rounded mb-2">{msg.text}</p>
                           <div className="flex gap-2"><Button size="sm" className="bg-green-600 flex-1" onClick={()=>api.approveMessage(msg.id)}>SI</Button><Button size="sm" variant="destructive" className="flex-1" onClick={()=>api.rejectMessage(msg.id)}>NO</Button></div>
                        </div>
                     ))}
                     <div className="pt-4 border-t border-white/10">
                        <h3 className="text-xs font-bold text-green-500 uppercase mb-2">Attivi sul display</h3>
                        {approvedMessages.map(msg => (
                            <div key={msg.id} className="bg-zinc-800 p-3 rounded border-l-2 border-green-500 flex justify-between items-start mb-2">
                            <div className="flex-1 text-sm"><strong>{msg.user_nickname}:</strong> {msg.text}</div>
                            <Button size="icon" variant="ghost" onClick={async()=>{await supabase.from('messages').delete().eq('id', msg.id); loadData();}}><Trash2 className="w-4 h-4"/></Button>
                            </div>
                        ))}
                     </div>
                  </div>
               )}

               {libraryTab === 'settings' && (
                  <div className="space-y-4">
                     <div><label className="text-xs text-zinc-500">Nome Locale</label><Input value={venueName} onChange={e=>setVenueName(e.target.value)} className="bg-zinc-800 border-none"/></div>
                     <div><label className="text-xs text-zinc-500">Logo</label><Input type="file" onChange={async(e)=>{const url=await api.uploadLogo(e.target.files[0]); setVenueLogo(url);}} className="bg-zinc-800 border-none text-xs" /></div>
                     <Button className="w-full bg-fuchsia-600" onClick={()=>updateEventSettings({name: venueName, logo_url: venueLogo})}>Salva Impostazioni</Button>
                  </div>
               )}
            </ScrollArea>
         </aside>

         <main className="col-span-8 bg-zinc-950 p-8 relative flex flex-col items-center justify-center">
            {eventState.active_module === 'karaoke' && (
               <div className="w-full max-w-3xl text-center">
                  {currentPerformance ? (
                     <div className="bg-zinc-900 p-12 rounded-[3rem] border border-white/5 shadow-2xl relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-600/10 to-transparent"></div>
                        <div className="relative z-10">
                           <h2 className="text-6xl font-black mb-2 tracking-tighter">{currentPerformance.song_title}</h2>
                           <p className="text-3xl text-white/50 mb-10">{currentPerformance.song_artist} • 🎤 {currentPerformance.user_nickname}</p>
                           <div className="flex justify-center gap-4">
                              {currentPerformance.status === 'live' ? <Button size="lg" variant="outline" className="h-16 w-16 rounded-full" onClick={()=>ctrlPerf('pause')}><Pause/></Button> : <Button size="lg" className="h-16 w-16 rounded-full bg-green-600" onClick={()=>ctrlPerf('resume')}><Play/></Button>}
                              <Button size="lg" variant="outline" className="h-16 w-16 rounded-full" onClick={()=>ctrlPerf('restart')}><RotateCcw/></Button>
                              <Button size="lg" variant="outline" className="h-16 w-16 rounded-full border-blue-500 text-blue-500" onClick={()=>window.open(currentPerformance.youtube_url, '_blank')}><ExternalLink/></Button>
                              <Button size="lg" variant="destructive" className="px-10 h-16 font-black text-xl" onClick={()=>ctrlPerf('end_vote')}>STOP & VOTA</Button>
                              <Button size="lg" variant="secondary" className="h-16 px-8 font-bold" onClick={()=>ctrlPerf('skip_next')}>SKIP</Button>
                           </div>
                           {currentPerformance.status === 'voting' && <Button className="w-full mt-10 bg-yellow-500 text-black font-black h-14 text-xl animate-pulse" onClick={()=>ctrlPerf('close_vote')}>CHIUDI VOTAZIONE E PROSSIMO</Button>}
                        </div>
                     </div>
                  ) : <div className="text-zinc-800 italic text-3xl">In attesa del prossimo cantante...</div>}
               </div>
            )}
         </main>
      </div>

      {/* MODALS */}
      <Dialog open={showYoutubeModal} onOpenChange={setShowYoutubeModal}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-2xl">
          <DialogHeader><DialogTitle>Video per: {selectedRequest?.title}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="flex gap-2"><Input placeholder="Cerca su YouTube..." value={youtubeSearchQuery} onChange={e=>setYoutubeSearchQuery(e.target.value)} onKeyDown={e=>e.key==='Enter'&&searchYouTube(youtubeSearchQuery)} className="bg-zinc-800 border-none"/><Button onClick={()=>searchYouTube(youtubeSearchQuery)} disabled={searchingYoutube}>{searchingYoutube?'...':<Search/>}</Button></div>
            <ScrollArea className="h-64 mb-4">{youtubeSearchResults.map(v => (<div key={v.id.videoId} className="flex gap-3 p-2 hover:bg-white/5 cursor-pointer rounded" onClick={()=>setYoutubeUrl(`https://www.youtube.com/watch?v=${v.id.videoId}`)}><img src={v.snippet.thumbnails.default.url} className="w-24 rounded"/><div className="text-xs font-bold">{v.snippet.title}</div></div>))}</ScrollArea>
            <Input value={youtubeUrl} onChange={e=>setYoutubeUrl(e.target.value)} className="bg-black font-mono text-xs mb-4" />
            <Button className="w-full bg-green-600 font-black h-12" onClick={startPerformance} disabled={!youtubeUrl}>MANDA IN ONDA</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showCustomQuizModal} onOpenChange={setShowCustomQuizModal}>
          <DialogContent className="bg-zinc-900 border-zinc-800 text-white">
              <DialogHeader><DialogTitle>Crea Quiz Manuale</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-4">
                  <Textarea placeholder="Domanda..." value={quizQuestion} onChange={e=>setQuizQuestion(e.target.value)} className="bg-zinc-800 h-24"/>
                  {quizOptions.map((o, i) => (<div key={i} className="flex gap-2"><Input value={o} onChange={e=>{const n=[...quizOptions]; n[i]=e.target.value; setQuizOptions(n)}} className="bg-zinc-800"/><Button variant={quizCorrectIndex===i?'default':'outline'} onClick={()=>setQuizCorrectIndex(i)}><Check/></Button></div>))}
                  <Button className="w-full bg-fuchsia-600 font-black h-12 mt-4" onClick={launchCustomQuiz}>LANCIA ORA</Button>
              </div>
          </DialogContent>
      </Dialog>

      <Dialog open={showMessageModal} onOpenChange={setShowMessageModal}>
          <DialogContent className="bg-zinc-900 border-zinc-800 text-white">
              <DialogHeader><DialogTitle>Messaggio Regia</DialogTitle></DialogHeader>
              <Textarea placeholder="Scrivi avviso..." value={adminMessage} onChange={e=>setAdminMessage(e.target.value)} className="bg-zinc-800 h-32 mt-4" />
              <Button className="w-full bg-cyan-600 font-black h-12 mt-4" onClick={handleSendMessage}>INVIA AGLI SCHERMI</Button>
          </DialogContent>
      </Dialog>

      <Dialog open={showImportModal} onOpenChange={setShowImportModal}>
          <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-2xl">
              <DialogHeader><DialogTitle>Importa Script JSON</DialogTitle></DialogHeader>
              <Textarea value={importText} onChange={e=>setImportText(e.target.value)} className="bg-zinc-950 font-mono text-xs h-64 border-zinc-800" placeholder='[{"category":"...","question":"...","options":["A","B","C","D"],"correct_index":0}]'/>
              <Button className="w-full bg-blue-600 font-bold" onClick={handleImportScript}>IMPORTA NEL CATALOGO</Button>
          </DialogContent>
      </Dialog>
    </div>
  );
}