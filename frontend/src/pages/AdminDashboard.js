import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
Music, Play, Square, Trophy, Tv, Check, X, MessageSquare,
LogOut, SkipForward, Pause, RotateCcw, Search, Plus, ArrowLeft,
ListMusic, BrainCircuit, Swords, Send, Star, VolumeX, Volume2, ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import api, { createPub } from "@/lib/api";
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
const [libraryTab, setLibraryTab] = useState("karaoke");
// --- MODULO SFIDE & SCRIPT (AI Ready) ---
// Questo array simula il DB. In futuro verrà caricato via API.
const [challengeScripts, setChallengeScripts] = useState([
{ id: 'ai-001', type: 'physical', theme: 'party', title: 'Gara di Shot', content: 'Chi finisce prima 3 shot vince 50 punti.' },
{ id: 'ai-002', type: 'physical', theme: 'party', title: 'Limbo', content: 'Gara di Limbo. Il pubblico vota il migliore.' },
{ id: 'ai-003', type: 'social', theme: 'love', title: 'Abbraccio Collettivo', content: 'Tutti devono abbracciare il vicino.' },
{ id: 'ai-004', type: 'quiz', theme: 'cinema', title: 'Citazioni Film', content: 'Indovina il film dalla citazione.' },
{ id: 'ai-005', type: 'audio', theme: '80s', title: 'Indovina la Intro', content: '5 secondi di intro anni 80.' }
]);
const [challengeFilterType, setChallengeFilterType] = useState("all");
const [challengeFilterTheme, setChallengeFilterTheme] = useState("all");
// --- STATI QUIZ ---
const [activeQuizId, setActiveQuizId] = useState(null);
const [quizStatus, setQuizStatus] = useState(null);
const [quizResults, setQuizResults] = useState(null);
// --- MODALI ---
const [showYoutubeModal, setShowYoutubeModal] = useState(false);
const [showCustomQuizModal, setShowCustomQuizModal] = useState(false);
const [showMessageModal, setShowMessageModal] = useState(false);
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
// --- MESSAGGI VARS ---
const [adminMessage, setAdminMessage] = useState("");
// --- SETUP ---
const [newEventName, setNewEventName] = useState("");
const [creatingEvent, setCreatingEvent] = useState(false);
const pollIntervalRef = useRef(null);
// 1. INIT
useEffect(() => {
checkUserProfile();
}, [isAuthenticated]);
const checkUserProfile = async () => {
if (!isAuthenticated) return;
try {
const { data: { user } } = await supabase.auth.getUser();
if (!user) return;
code
Code
let { data: userProfile } = await supabase.from('profiles').select('*').eq('id', user.id).single();

  if (!userProfile) {
     const { data: newProfile } = await supabase.from('profiles').insert([{ id: user.id, email: user.email, role: 'operator', credits: 0 }]).select().single();
     userProfile = newProfile;
  }
  setProfile(userProfile);

  if (userProfile.role === 'super_admin') {
    setAppState("super_admin");
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
  console.error(error);
}
};
const handleLogout = () => {
localStorage.removeItem("neonpub_pub_code");
logout();
navigate("/");
};
// 2. SETUP EVENTO
const handleStartEvent = async (e) => {
e.preventDefault();
if (!newEventName) return toast.error("Inserisci nome evento");
setCreatingEvent(true);
try {
const { data: pubData } = await createPub({ name: newEventName });
localStorage.setItem("neonpub_pub_code", pubData.code);
setPubCode(pubData.code);
setAppState("dashboard");
toast.success("Evento Iniziato!");
} catch (error) { toast.error(error.message); } finally { setCreatingEvent(false); }
};
// 3. LOAD DATA
const loadData = useCallback(async () => {
if (!pubCode || appState !== 'dashboard') return;
try {
const stateData = await api.getEventState();
if(stateData) setEventState(stateData);
code
Code
const [qRes, perfRes, msgRes, activeQuizRes] = await Promise.all([
    api.getAdminQueue(),
    api.getAdminCurrentPerformance(),
    api.getAdminPendingMessages(),
    api.getActiveQuiz()
  ]);

  setQueue(qRes.data || []);
  setCurrentPerformance(perfRes.data);
  setPendingMessages(msgRes.data || []);
  
  if(activeQuizRes.data) {
     setActiveQuizId(activeQuizRes.data.id);
     setQuizStatus(activeQuizRes.data.status);
     if(activeQuizRes.data.status === 'showing_results') {
         const resData = await api.getQuizResults(activeQuizRes.data.id);
         setQuizResults(resData.data);
     }
  } else {
     setActiveQuizId(null); setQuizStatus(null); setQuizResults(null);
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
// --- ACTIONS ---
const handleOpenDisplay = () => {
const width = 1280;
const height = 720;
const left = (window.screen.width - width) / 2;
const top = (window.screen.height - height) / 2;
window.open(/display/${pubCode}, 'NeonPubDisplay', popup=yes,width=${width},height=${height},top=${top},left=${left},toolbar=no,menubar=no,scrollbars=no,status=no);
};
const handleStartLivePre = (req) => {
setSelectedRequest(req);
setYoutubeSearchResults([]);
setYoutubeUrl(req.youtube_url || "");
if(req.youtube_url) {
setShowYoutubeModal(true);
} else {
const query = ${req.title} ${req.artist} karaoke;
setYoutubeSearchQuery(query);
setShowYoutubeModal(true);
setTimeout(() => searchYouTube(query), 100);
}
};
const searchYouTube = async (manualQuery = null) => {
const q = manualQuery || youtubeSearchQuery;
if (!q.trim()) return;
setSearchingYoutube(true);
try {
const apiKey = process.env.REACT_APP_YOUTUBE_API_KEY;
if(!apiKey) throw new Error("Manca API Key");
const response = await fetch(https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(q)}&type=video&maxResults=5&key=${apiKey});
const data = await response.json();
setYoutubeSearchResults(data.items || []);
} catch (error) { toast.error("Errore ricerca YT automatico."); } finally { setSearchingYoutube(false); }
};
const startPerformance = async () => {
if (!selectedRequest || !youtubeUrl) return toast.error("Manca URL");
try {
await api.startPerformance(selectedRequest.id, youtubeUrl);
setShowYoutubeModal(false);
toast.success("Karaoke Avviato!");
loadData();
} catch(e) { toast.error(e.message); }
};
// --- MEDIA CONTROLS ---
const ctrlPerf = async (action) => {
if(!currentPerformance) return;
try {
if(action==='pause') await api.pausePerformance(currentPerformance.id);
if(action==='resume') await api.resumePerformance(currentPerformance.id);
if(action==='restart') await api.restartPerformance(currentPerformance.id);
code
Code
// NUOVO: Stop e Vota
    if(action==='end_vote') await api.endPerformance(currentPerformance.id);
    
    // NUOVO: Stop SENZA Voto (Skip)
    if(action==='skip_next') {
        if(window.confirm("Chiudere senza voto?")) {
            await api.stopAndNext(currentPerformance.id);
            toast.info("Chiuso senza voto");
        }
    }
    
    if(action==='close_vote') await api.closeVoting(currentPerformance.id);
    loadData();
  } catch(e) { toast.error("Errore comando"); }
};
const toggleMute = async () => {
const newState = !isMuted;
setIsMuted(newState);
await api.toggleMute(newState);
toast.success(newState ? "Audio Disattivato" : "Audio Attivo");
};
const openManualVideoWindow = () => {
if (currentPerformance?.youtube_url) {
window.open(currentPerformance.youtube_url, '_blank');
} else {
toast.error("Nessun video attivo");
}
};
// --- QUIZ & SFIDE ---
const filterScripts = () => {
return challengeScripts.filter(s => {
const typeMatch = challengeFilterType === 'all' || s.type === challengeFilterType;
const themeMatch = challengeFilterTheme === 'all' || s.theme === challengeFilterTheme;
return typeMatch && themeMatch;
});
};
const launchChallenge = async (script) => {
if(window.confirm(Lanciare sfida: ${script.title}?)) {
// Qui in futuro si creerà l'entry nel DB. Per ora toast.
toast.success(Sfida "${script.title}" inviata agli schermi (Simulazione));
// api.setEventModule('challenge', script.id);
}
};
const launchCustomQuiz = async (e) => {
e.preventDefault();
try {
await api.startQuiz({
category: "custom",
question: quizQuestion,
options: quizOptions,
correct_index: quizCorrectIndex,
points: 10
});
setShowCustomQuizModal(false);
toast.success("Quiz Custom Lanciato!");
loadData();
} catch(e) { toast.error("Errore quiz custom"); }
};
const ctrlQuiz = async (action) => {
if(!activeQuizId) return;
try {
if(action==='close_vote') await api.closeQuizVoting(activeQuizId);
if(action==='show_results') await api.showQuizResults(activeQuizId);
if(action==='end') {
await api.endQuiz(activeQuizId);
await api.setEventModule('karaoke');
toast.info("Tornati al Karaoke");
}
loadData();
} catch(e) { toast.error("Errore comando quiz"); }
};
// --- RENDER ---
if (appState === 'loading') return <div className="bg-black h-screen text-white flex items-center justify-center">Caricamento...</div>;
if (appState === 'setup') {
return (
<div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-4">
<Card className="w-full max-w-md bg-zinc-900 border-zinc-800">
<CardHeader><CardTitle className="text-center text-white">Nuovo Evento</CardTitle></CardHeader>
<CardContent className="space-y-4">
<Input placeholder="Nome Evento" value={newEventName} onChange={e=>setNewEventName(e.target.value)} className="bg-zinc-950 text-center text-lg" />
<Button onClick={handleStartEvent} disabled={creatingEvent} className="w-full bg-fuchsia-600 h-12">LANCIA EVENTO</Button>
<Button variant="ghost" onClick={handleLogout} className="w-full text-zinc-500">Esci</Button>
</CardContent>
</Card>
</div>
);
}
// DASHBOARD REALE
const pendingReqs = queue.filter(r => r.status === 'pending');
const queuedReqs = queue.filter(r => r.status === 'queued');
return (
<div className="h-screen bg-[#050505] text-white flex flex-col overflow-hidden">
code
Code
{/* HEADER */}
  <header className="h-14 border-b border-white/10 flex items-center justify-between px-4 bg-zinc-900">
     <div className="flex items-center gap-4">
        <h1 className="font-bold text-lg bg-clip-text text-transparent bg-gradient-to-r from-fuchsia-400 to-cyan-400">NEONPUB OS</h1>
        <span className="text-xs px-2 py-1 bg-zinc-800 rounded font-mono text-zinc-400">{pubCode}</span>
     </div>
     <div className="flex items-center gap-2">
         <Button variant="outline" size="sm" onClick={handleOpenDisplay} className="bg-cyan-900/20 text-cyan-400 border-cyan-800 hover:bg-cyan-900/40"><Tv className="w-4 h-4 mr-2" /> APRI DISPLAY</Button>
         <Button variant="ghost" size="sm" onClick={() => { if(confirm("Chiudere evento?")) { localStorage.removeItem("neonpub_pub_code"); setPubCode(null); setAppState("setup"); } }}><ArrowLeft className="w-4 h-4" /> Chiudi</Button>
     </div>
  </header>

  {/* GRID */}
  <div className="flex-1 grid grid-cols-12 gap-0 overflow-hidden">
     
     {/* SINISTRA: LIBRARY */}
     <aside className="col-span-4 border-r border-white/10 bg-zinc-900/50 flex flex-col">
        <div className="p-2 border-b border-white/5">
           <Tabs value={libraryTab} onValueChange={setLibraryTab} className="w-full">
              <TabsList className="grid w-full grid-cols-4 bg-zinc-950 p-1">
                 <TabsTrigger value="karaoke" className="text-xs"><ListMusic className="w-3 h-3 mr-1" />Coda</TabsTrigger>
                 <TabsTrigger value="quiz" className="text-xs"><BrainCircuit className="w-3 h-3 mr-1" />Quiz</TabsTrigger>
                 <TabsTrigger value="challenges" className="text-xs"><Swords className="w-3 h-3 mr-1" />Sfide</TabsTrigger>
                 <TabsTrigger value="messages" className="text-xs"><MessageSquare className="w-3 h-3 mr-1" />Msg</TabsTrigger>
              </TabsList>
           </Tabs>
        </div>
        
        <ScrollArea className="flex-1 p-3">
           {/* 1. KARAOKE */}
           {libraryTab === 'karaoke' && (
              <div className="space-y-4">
                 {/* PENDING */}
                 {pendingReqs.length > 0 && (
                    <div className="space-y-2">
                        <h3 className="text-xs font-bold text-yellow-500 uppercase">Da Approvare ({pendingReqs.length})</h3>
                        {pendingReqs.map(req => (
                            <div key={req.id} className="p-2 bg-yellow-900/10 border border-yellow-900/30 rounded flex justify-between items-center">
                                <div className="truncate w-2/3"><div className="font-bold text-sm truncate">{req.title}</div><div className="text-xs text-zinc-400">{req.user_nickname}</div></div>
                                <div className="flex gap-1">
                                    <Button size="icon" variant="ghost" className="h-6 w-6 text-green-500 hover:bg-green-500/20" onClick={()=>api.approveRequest(req.id)}><Check className="w-4 h-4"/></Button>
                                    <Button size="icon" variant="ghost" className="h-6 w-6 text-red-500 hover:bg-red-500/20" onClick={()=>api.rejectRequest(req.id)}><X className="w-4 h-4"/></Button>
                                </div>
                            </div>
                        ))}
                    </div>
                 )}
                 {/* QUEUE */}
                 <div className="space-y-2">
                    <h3 className="text-xs font-bold text-zinc-500 uppercase">In Scaletta ({queuedReqs.length})</h3>
                    {queuedReqs.map((req, i) => (
                       <div key={req.id} className="p-3 bg-zinc-800 rounded flex justify-between items-center group hover:bg-zinc-700 transition">
                          <div className="flex items-center gap-3 overflow-hidden w-2/3">
                              <span className="text-zinc-500 font-mono text-sm">{i+1}</span>
                              <div className="truncate">
                                  <div className="font-bold text-sm truncate">{req.title}</div>
                                  <div className="text-xs text-zinc-400 truncate">{req.artist} • {req.user_nickname}</div>
                              </div>
                          </div>
                          <Button size="sm" className="bg-fuchsia-600 h-7 opacity-0 group-hover:opacity-100 transition" onClick={() => handleStartLivePre(req)}>
                             <Play className="w-3 h-3 mr-1" /> LIVE
                          </Button>
                       </div>
                    ))}
                    {queuedReqs.length === 0 && <p className="text-center text-zinc-600 text-xs py-4">Nessuna canzone in coda.</p>}
                 </div>
              </div>
           )}

           {/* 2. QUIZ */}
           {libraryTab === 'quiz' && (
              <div className="space-y-3">
                 <Button className="w-full bg-zinc-800 hover:bg-zinc-700 border border-white/10" onClick={()=>setShowCustomQuizModal(true)}>
                    <Plus className="w-4 h-4 mr-2"/> Crea Quiz Manuale
                 </Button>
                 <p className="text-xs text-center text-zinc-500 py-4">Importazione Quiz da DB (WIP)</p>
              </div>
           )}

           {/* 3. SFIDE (AGGIORNATO - AI READY) */}
           {libraryTab === 'challenges' && (
               <div className="space-y-3">
                   <div className="flex gap-2">
                       <Select value={challengeFilterType} onValueChange={setChallengeFilterType}>
                           <SelectTrigger className="h-8 text-xs bg-zinc-950"><SelectValue placeholder="Tipo" /></SelectTrigger>
                           <SelectContent>
                               <SelectItem value="all">Tutti i Tipi</SelectItem>
                               <SelectItem value="physical">Fisico</SelectItem>
                               <SelectItem value="quiz">Quiz</SelectItem>
                               <SelectItem value="audio">Audio</SelectItem>
                               <SelectItem value="social">Social</SelectItem>
                           </SelectContent>
                       </Select>
                       <Select value={challengeFilterTheme} onValueChange={setChallengeFilterTheme}>
                           <SelectTrigger className="h-8 text-xs bg-zinc-950"><SelectValue placeholder="Tema" /></SelectTrigger>
                           <SelectContent>
                               <SelectItem value="all">Tutti i Temi</SelectItem>
                               <SelectItem value="party">Party</SelectItem>
                               <SelectItem value="cinema">Cinema</SelectItem>
                               <SelectItem value="80s">Anni 80</SelectItem>
                               <SelectItem value="love">Love</SelectItem>
                           </SelectContent>
                       </Select>
                   </div>

                   <div className="space-y-2">
                       {filterScripts().length === 0 && <p className="text-center text-zinc-600 text-xs">Nessuna sfida trovata.</p>}
                       {filterScripts().map(s => (
                           <div key={s.id} className="p-3 bg-zinc-800 rounded hover:bg-zinc-700 cursor-pointer border border-transparent hover:border-fuchsia-500/50" onClick={() => launchChallenge(s)}>
                               <div className="flex justify-between mb-1">
                                   <span className="font-bold text-sm">{s.title}</span>
                                   <span className="text-[10px] bg-zinc-900 px-1 rounded text-zinc-400 uppercase">{s.type}</span>
                               </div>
                               <p className="text-xs text-zinc-400 line-clamp-2">{s.content}</p>
                           </div>
                       ))}
                   </div>
               </div>
           )}
           
           {/* 4. MESSAGGI */}
           {libraryTab === 'messages' && (
               <div className="space-y-3">
                   <Button className="w-full bg-cyan-900/30 hover:bg-cyan-900/50 text-cyan-400 border border-cyan-500/30" onClick={()=>setShowMessageModal(true)}>
                       <MessageSquare className="w-4 h-4 mr-2"/> Invia Messaggio Libero
                   </Button>
                   <h3 className="text-xs font-bold text-zinc-500 uppercase mt-4">In Attesa ({pendingMessages.length})</h3>
                   {pendingMessages.map(msg => (
                       <div key={msg.id} className="p-3 bg-zinc-800 rounded">
                           <p className="text-sm mb-2 text-white">"{msg.text}"</p>
                           <p className="text-xs text-zinc-500 mb-2">da {msg.user_nickname}</p>
                           <div className="flex gap-2">
                               <Button size="sm" className="flex-1 bg-green-600 h-7 text-xs" onClick={()=>api.approveMessage(msg.id)}>Approva</Button>
                               <Button size="sm" variant="destructive" className="flex-1 h-7 text-xs" onClick={()=>api.rejectMessage(msg.id)}>Rifiuta</Button>
                           </div>
                       </div>
                   ))}
               </div>
           )}
        </ScrollArea>
     </aside>

     {/* DESTRA: LIVE DECK */}
     <main className="col-span-8 bg-black relative flex flex-col">
        
        {/* Live Status Bar */}
        <div className="h-10 border-b border-white/10 flex items-center px-4 justify-between bg-zinc-950 select-none">
           <span className="text-xs font-mono text-zinc-500">PROGRAMMA LIVE</span>
           <div className="flex items-center gap-4">
              <Button size="sm" variant="ghost" className={`h-6 w-6 p-0 ${isMuted?'text-red-500':'text-zinc-400'}`} onClick={toggleMute}>
                  {isMuted ? <VolumeX className="w-4 h-4"/> : <Volume2 className="w-4 h-4"/>}
              </Button>
              <div className="flex items-center gap-2">
                 <div className={`w-2 h-2 rounded-full ${eventState.active_module !== 'idle' ? 'bg-red-500 animate-pulse' : 'bg-zinc-600'}`}></div>
                 <span className="uppercase font-bold tracking-wider text-sm text-red-500">{eventState.active_module}</span>
              </div>
           </div>
        </div>

        {/* Deck Content */}
        <div className="flex-1 p-6 flex items-center justify-center bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-zinc-900 via-black to-black">
           
           {/* SCENA: KARAOKE */}
           {eventState.active_module === 'karaoke' && (
              <div className="w-full max-w-3xl text-center">
                 {!currentPerformance ? (
                    <div className="text-zinc-600 flex flex-col items-center opacity-50">
                       <ListMusic className="w-24 h-24 mb-4" />
                       <h2 className="text-2xl font-bold mb-2">Deck Karaoke Libero</h2>
                       <p>Scegli una canzone dalla libreria per andare in onda.</p>
                    </div>
                 ) : (
                    <div className="bg-zinc-900/80 backdrop-blur border border-white/10 p-8 rounded-2xl shadow-2xl relative overflow-hidden">
                       <div className="mb-6">
                           <h2 className="text-4xl font-black text-white mb-2 leading-tight">{currentPerformance.song_title}</h2>
                           <p className="text-2xl text-fuchsia-400">{currentPerformance.song_artist}</p>
                           <div className="mt-4 inline-block bg-white/10 px-4 py-1 rounded-full text-sm text-zinc-300">🎤 {currentPerformance.user_nickname}</div>
                       </div>

                       {/* Controls */}
                       {currentPerformance.status === 'voting' ? (
                           <div className="bg-yellow-500/20 p-6 rounded-xl border border-yellow-500/50 animate-pulse">
                               <h3 className="text-2xl font-bold text-yellow-500 mb-4">VOTAZIONE IN CORSO</h3>
                               <div className="flex items-center justify-center gap-4 mb-4">
                                   <Star className="w-8 h-8 text-yellow-500 fill-yellow-500"/>
                                   <span className="text-4xl font-bold text-white">{(currentPerformance.average_score || 0).toFixed(1)}</span>
                               </div>
                               <Button size="lg" className="w-full bg-yellow-500 text-black hover:bg-yellow-400 font-bold" onClick={()=>ctrlPerf('close_vote')}>CHIUDI VOTAZIONE & NEXT</Button>
                           </div>
                       ) : (
                           <div className="flex flex-col gap-4">
                               <div className="flex justify-center gap-4">
                                   {currentPerformance.status === 'live' && <Button size="lg" variant="outline" className="h-16 w-16 rounded-full border-zinc-700 hover:bg-zinc-800" onClick={()=>ctrlPerf('pause')}><Pause className="w-6 h-6" /></Button>}
                                   {currentPerformance.status === 'paused' && <Button size="lg" className="h-16 w-16 rounded-full bg-green-500 hover:bg-green-400 text-black" onClick={()=>ctrlPerf('resume')}><Play className="w-6 h-6" /></Button>}
                                   <Button size="lg" variant="secondary" className="h-16 w-16 rounded-full bg-zinc-800 hover:bg-zinc-700" onClick={()=>ctrlPerf('restart')}><RotateCcw className="w-6 h-6" /></Button>
                                   
                                   {/* Tasti Chiusura Differenziati */}
                                   <div className="flex gap-2 ml-4">
                                       <Button size="lg" variant="destructive" className="h-16 px-6" onClick={()=>ctrlPerf('end_vote')}><Square className="w-6 h-6 mr-2" /> STOP & VOTA</Button>
                                       <Button size="lg" className="h-16 px-4 bg-zinc-700 hover:bg-zinc-600" onClick={()=>ctrlPerf('skip_next')} title="Chiudi senza votare"><SkipForward className="w-6 h-6" /></Button>
                                   </div>
                               </div>

                               {/* Manual Override Link */}
                               <Button variant="link" className="text-zinc-500 text-xs" onClick={openManualVideoWindow}>
                                   <ExternalLink className="w-3 h-3 mr-1"/> Apri Finestra Esterna (Manuale)
                               </Button>
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
                    
                    <h2 className="text-3xl font-bold text-white mb-8 bg-black/50 p-4 rounded-xl border border-white/10 min-h-[100px] flex items-center justify-center">
                       {activeQuizId ? "Domanda attiva sugli schermi" : "Nessun Quiz Attivo"}
                    </h2>

                    {activeQuizId && (
                       <div className="grid grid-cols-2 gap-4">
                          <Button disabled={quizStatus !== 'active'} className="h-16 text-lg bg-red-600 hover:bg-red-500 font-bold" onClick={()=>ctrlQuiz('close_vote')}>
                             🛑 STOP VOTO
                          </Button>
                          <Button disabled={quizStatus !== 'closed'} className="h-16 text-lg bg-blue-600 hover:bg-blue-500 font-bold" onClick={()=>ctrlQuiz('show_results')}>
                             🏆 RISULTATI
                          </Button>
                          <Button className="h-16 col-span-2 text-lg bg-zinc-700 hover:bg-zinc-600 font-bold" onClick={()=>ctrlQuiz('end')}>
                             🚪 CHIUDI & ESCI
                          </Button>
                       </div>
                    )}

                    {quizResults && (
                        <div className="mt-6 p-4 bg-green-900/20 rounded border border-green-500/30 text-green-400">
                            <div className="text-xl font-bold mb-2">Statistiche</div>
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
      <DialogHeader><DialogTitle>Video per: {selectedRequest?.title}</DialogTitle></DialogHeader>
      <div className="space-y-4 pt-4">
          <div className="flex gap-2">
              <Input value={youtubeSearchQuery} onChange={e=>setYoutubeSearchQuery(e.target.value)} className="bg-zinc-800 border-zinc-700 text-white" placeholder="Cerca su YouTube..." onKeyDown={e=>e.key==='Enter'&&searchYouTube(youtubeSearchQuery)}/>
              <Button onClick={() => searchYouTube(youtubeSearchQuery)} disabled={searchingYoutube} className="bg-zinc-700 hover:bg-zinc-600">{searchingYoutube?'...':'Cerca'}</Button>
          </div>
          
          <div className="max-h-60 overflow-y-auto space-y-2 custom-scrollbar">
              {youtubeSearchResults.length === 0 && !searchingYoutube && <p className="text-center text-zinc-500 py-4">Nessun risultato.</p>}
              {youtubeSearchResults.map(vid => (
                  <div key={vid.id.videoId} className="flex gap-3 p-2 hover:bg-white/5 cursor-pointer rounded transition" onClick={()=>{setYoutubeUrl(`https://www.youtube.com/watch?v=${vid.id.videoId}`); setYoutubeSearchResults([]);}}>
                      <img src={vid.snippet.thumbnails.default.url} className="w-24 h-16 object-cover rounded" alt="thumb"/>
                      <div className="flex-1"><div className="font-bold text-sm text-white">{vid.snippet.title}</div><div className="text-xs text-zinc-500">{vid.snippet.channelTitle}</div></div>
                      <Button size="sm" variant="ghost" className="text-fuchsia-500">Seleziona</Button>
                  </div>
              ))}
          </div>

          <div className="pt-4 border-t border-white/10">
              <p className="text-xs text-zinc-500 mb-2">URL Selezionato:</p>
              <Input value={youtubeUrl} onChange={e=>setYoutubeUrl(e.target.value)} className="bg-zinc-950 border-zinc-800 font-mono text-xs mb-4" placeholder="https://youtube.com..."/>
              <Button className="w-full bg-green-600 hover:bg-green-500 h-12 text-lg font-bold" disabled={!youtubeUrl} onClick={startPerformance}><Play className="w-5 h-5 mr-2"/> MANDA IN ONDA</Button>
          </div>
      </div>
    </DialogContent>
  </Dialog>

  {/* CUSTOM QUIZ MODAL */}
  <Dialog open={showCustomQuizModal} onOpenChange={setShowCustomQuizModal}>
      <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader><DialogTitle>Crea Quiz al Volo</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-4">
              <div><label className="text-xs text-zinc-500 mb-1 block">Domanda</label><Textarea value={quizQuestion} onChange={e=>setQuizQuestion(e.target.value)} className="bg-zinc-800 border-zinc-700" placeholder="Scrivi la domanda..."/></div>
              <div className="space-y-2">
                  <label className="text-xs text-zinc-500 mb-1 block">Opzioni (Spunta la corretta)</label>
                  {quizOptions.map((opt, i) => (
                      <div key={i} className="flex gap-2">
                          <Input value={opt} onChange={e=>{const n=[...quizOptions]; n[i]=e.target.value; setQuizOptions(n)}} className="bg-zinc-800 border-zinc-700" placeholder={`Opzione ${String.fromCharCode(65+i)}`}/>
                          <Button size="icon" variant={quizCorrectIndex===i?'default':'outline'} className={quizCorrectIndex===i?'bg-green-600 hover:bg-green-500 border-none':''} onClick={()=>setQuizCorrectIndex(i)}><Check className="w-4 h-4"/></Button>
                      </div>
                  ))}
              </div>
              <Button className="w-full bg-fuchsia-600 hover:bg-fuchsia-500 mt-4 h-12 text-lg font-bold" onClick={launchCustomQuiz}>LANCIA QUIZ</Button>
          </div>
      </DialogContent>
  </Dialog>

  {/* MESSAGGI REGIA MODAL */}
  <Dialog open={showMessageModal} onOpenChange={setShowMessageModal}>
      <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader><DialogTitle>Messaggio Regia</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-4">
              <Textarea value={adminMessage} onChange={e=>setAdminMessage(e.target.value)} placeholder="Scrivi avviso per gli schermi..." className="bg-zinc-800 border-zinc-700 h-32 text-lg"/>
              <Button className="w-full bg-cyan-600 hover:bg-cyan-500 h-12 font-bold" onClick={async () => { await api.sendMessage({ text: adminMessage, status: 'approved' }); setShowMessageModal(false); toast.success("Inviato"); }}><Send className="w-4 h-4 mr-2"/> INVIA AGLI SCHERMI</Button>
          </div>
      </DialogContent>
  </Dialog>

</div>
);
}