import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { 
  Music, Play, Square, Trophy, Tv, Check, X, MessageSquare, LogOut, 
  SkipForward, Pause, RotateCcw, Search, Plus, ListMusic, BrainCircuit, 
  Send, VolumeX, Volume2, ExternalLink, Settings, Save, Power, UserPlus, Ban, Coins, Swords, Download, Trash2, Upload
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import api, { createPub } from "@/lib/api";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { isAuthenticated, logout } = useAuth();
  
  // --- GLOBAL STATE ---
  const [viewState, setViewState] = useState("loading"); // loading, setup, dashboard, super_admin
  const [profile, setProfile] = useState(null);
  const [pubCode, setPubCode] = useState(localStorage.getItem("neonpub_pub_code"));
  
  // --- DASHBOARD DATA ---
  const [activeTab, setActiveTab] = useState("karaoke");
  const [queue, setQueue] = useState([]);
  const [currentPerf, setCurrentPerf] = useState(null);
  const [activeQuiz, setActiveQuiz] = useState(null);
  const [quizCatalog, setQuizCatalog] = useState([]);
  const [challenges, setChallenges] = useState([]);
  const [pendingMsgs, setPendingMsgs] = useState([]);
  const [isMuted, setIsMuted] = useState(false);
  
  // --- SUPER ADMIN DATA ---
  const [usersList, setUsersList] = useState([]);

  // --- MODALS STATE ---
  const [showYoutube, setShowYoutube] = useState(false);
  const [ytQuery, setYtQuery] = useState("");
  const [ytResults, setYtResults] = useState([]);
  const [selectedReq, setSelectedReq] = useState(null);
  const [selectedVideoUrl, setSelectedVideoUrl] = useState("");
  
  const [showCustomQuiz, setShowCustomQuiz] = useState(false);
  const [newQuiz, setNewQuiz] = useState({ q: "", opts: ["","","",""], correct: 0, cat: "Generale" });
  
  const [showImportQuiz, setShowImportQuiz] = useState(false);
  const [importJson, setImportJson] = useState("");
  
  const [settings, setSettings] = useState({ name: "", logo: "" });
  const [uploading, setUploading] = useState(false);
  
  const [messageTxt, setMessageTxt] = useState("");
  
  const [newEventName, setNewEventName] = useState("");

  // --- INITIAL CHECK ---
  useEffect(() => {
    const checkUser = async () => {
      if(!isAuthenticated) return;
      const { data: { user } } = await supabase.auth.getUser();
      if(!user) return;
      
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      setProfile(prof);

      if (prof?.role === 'super_admin') {
          setViewState("super_admin");
          loadSuperAdmin();
      } else {
          // Check if event is active
          if (pubCode) {
              const res = await api.getPub(pubCode);
              if (res.data && !res.expired) {
                  setViewState("dashboard");
                  setSettings({ name: res.data.name, logo: res.data.logo_url });
              } else {
                  setPubCode(null);
                  localStorage.removeItem("neonpub_pub_code");
                  setViewState("setup");
              }
          } else {
              setViewState("setup");
          }
      }
    };
    checkUser();
  }, [isAuthenticated]);

  // --- DATA POLLING (Only in dashboard) ---
  useEffect(() => {
    if (viewState !== 'dashboard' || !pubCode) return;
    
    const load = async () => {
        try {
            const [qRes, perfRes, quizRes, catRes, challRes, msgRes] = await Promise.all([
                api.getAdminQueue(),
                api.getAdminCurrentPerformance(),
                api.getActiveQuiz(),
                api.getQuizCatalog(),
                api.getChallengeCatalog(),
                api.getAdminPendingMessages()
            ]);
            setQueue(qRes.data);
            setCurrentPerf(perfRes.data);
            setActiveQuiz(quizRes.data);
            setQuizCatalog(catRes.data);
            setChallenges(challRes.data);
            setPendingMsgs(msgRes.data);
        } catch (e) {
            console.error("Polling error", e);
        }
    };
    
    load();
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, [viewState, pubCode]);

  // --- ACTIONS ---

  const handleStartEvent = async () => {
    if(!newEventName) return toast.error("Inserisci nome evento");
    try {
        const res = await createPub({name: newEventName});
        localStorage.setItem("neonpub_pub_code", res.data.code);
        setPubCode(res.data.code);
        setSettings({ name: res.data.name, logo: null });
        setViewState("dashboard");
        toast.success("Evento Iniziato!");
    } catch(e) { toast.error(e.message); }
  };

  const handleResume = (code) => {
      localStorage.setItem("neonpub_pub_code", code);
      setPubCode(code);
      setViewState("dashboard");
  };

  // Karaoke Logic
  const searchYT = async () => {
      if(!ytQuery) return;
      const apiKey = process.env.REACT_APP_YOUTUBE_API_KEY; 
      if (!apiKey) {
          // Fallback manuale se no API Key
          toast.info("Ricerca disabilitata (No API Key). Inserisci URL manuale.");
          return;
      }
      try {
          const res = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(ytQuery)}&type=video&maxResults=5&key=${apiKey}`);
          const data = await res.json();
          setYtResults(data.items || []);
      } catch(e) { toast.error("Errore YT API"); }
  };

  const launchKaraoke = async () => {
      if(!selectedReq || !selectedVideoUrl) return toast.error("Dati mancanti");
      try {
          await api.startPerformance(selectedReq.id, selectedVideoUrl);
          setShowYoutube(false);
          setYtResults([]);
          setYtQuery("");
          setSelectedVideoUrl("");
          toast.success("Karaoke in onda!");
      } catch(e) { toast.error(e.message); }
  };

  const ctrlPlayer = async (action) => {
      if(!currentPerf) return;
      await api.ctrlPerformance(currentPerf.id, action);
      toast.success("Comando inviato");
  };

  // Quiz Logic
  const launchQuiz = async (item) => {
      if(!confirm(`Lanciare: ${item.question}?`)) return;
      try {
          await api.startQuiz(item);
          toast.success("Quiz Attivo!");
      } catch(e) { toast.error(e.message); }
  };

  const createAndLaunchCustomQuiz = async () => {
      try {
          await api.startQuiz({
              category: newQuiz.cat, question: newQuiz.q, options: newQuiz.opts, correct_index: newQuiz.correct, points: 10
          });
          setShowCustomQuiz(false);
          toast.success("Quiz Custom In Onda!");
      } catch(e) { toast.error(e.message); }
  };

  const handleImport = async () => {
      try {
          const res = await api.importQuizCatalog(importJson);
          toast.success(`Importate ${res.count} domande!`);
          setShowImportQuiz(false);
          setImportJson("");
      } catch(e) { toast.error(e.message); }
  };

  const deleteQuestion = async (e, id) => {
      e.stopPropagation();
      if(!confirm("Eliminare dal catalogo?")) return;
      await api.deleteQuizQuestion(id);
      toast.success("Eliminata");
  };

  const ctrlQuiz = async (action) => {
      if(!activeQuiz) return;
      await api.ctrlQuiz(activeQuiz.id, action);
  };

  // Settings & Messages
  const saveSettings = async () => {
      try { await api.updateEventSettings({ name: settings.name, logo_url: settings.logo }); toast.success("Salvato"); } 
      catch(e) { toast.error(e.message); }
  };

  const onLogoUpload = async (e) => {
      const file = e.target.files[0];
      if(!file) return;
      setUploading(true);
      try {
          const url = await api.uploadLogo(file);
          setSettings(prev => ({...prev, logo: url}));
      } catch(e) { toast.error("Upload fallito"); }
      finally { setUploading(false); }
  };

  const sendMsg = async () => {
      if(!messageTxt) return;
      await api.sendMessage(messageTxt);
      setMessageTxt("");
      toast.success("Inviato");
  };

  // Super Admin
  const loadSuperAdmin = async () => { const res = await api.getAllProfiles(); setUsersList(res.data || []); };
  const addCredits = async (id, amt) => { await api.updateProfileCredits(id, amt); toast.success("Crediti aggiornati"); loadSuperAdmin(); };
  const toggleUser = async (id, status) => { await api.toggleUserStatus(id, !status); toast.success("Stato aggiornato"); loadSuperAdmin(); };

  // --- VIEWS ---

  if (viewState === "loading") return <div className="h-screen bg-black text-white flex items-center justify-center">Caricamento...</div>;

  if (viewState === "super_admin") return (
      <div className="p-8 bg-zinc-950 min-h-screen text-white">
          <header className="flex justify-between items-center mb-8">
              <h1 className="text-3xl font-bold text-fuchsia-500">SUPER ADMIN</h1>
              <Button onClick={logout} variant="outline">Logout</Button>
          </header>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {usersList.map(u => (
                  <Card key={u.id} className="bg-zinc-900 border-zinc-800">
                      <CardHeader><CardTitle className="text-white text-sm">{u.email}</CardTitle></CardHeader>
                      <CardContent>
                          <div className="flex justify-between mb-4">
                              <span>Crediti: <span className="text-yellow-500 font-bold">{u.credits}</span></span>
                              <span className={u.is_active ? "text-green-500" : "text-red-500"}>{u.is_active ? "Attivo" : "Ban"}</span>
                          </div>
                          <div className="flex gap-2 mb-2">
                              <Button size="sm" onClick={()=>addCredits(u.id, u.credits+5)}>+5 Cred</Button>
                              <Button size="sm" onClick={()=>addCredits(u.id, u.credits+20)}>+20 Cred</Button>
                          </div>
                          <Button variant="destructive" size="sm" className="w-full" onClick={()=>toggleUser(u.id, u.is_active)}>
                              {u.is_active ? "Disabilita" : "Riattiva"}
                          </Button>
                      </CardContent>
                  </Card>
              ))}
          </div>
      </div>
  );

  if (viewState === "setup") return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
          <Card className="w-full max-w-md bg-zinc-900 border-zinc-800">
              <CardHeader>
                  <CardTitle className="text-center text-white text-2xl">NEONPUB SETUP</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                  <div className="text-center p-4 bg-zinc-800 rounded">
                      <div className="text-sm text-zinc-400">Crediti Disponibili</div>
                      <div className="text-4xl font-bold text-yellow-500">{profile?.credits || 0}</div>
                  </div>
                  <div className="space-y-2">
                      <Input placeholder="Nome Evento (es. Venerdì Karaoke)" value={newEventName} onChange={e=>setNewEventName(e.target.value)} className="bg-black text-white border-zinc-700"/>
                      <Button onClick={handleStartEvent} className="w-full bg-fuchsia-600 hover:bg-fuchsia-700 h-12 text-lg font-bold">CREA EVENTO (-1 Credit)</Button>
                  </div>
                  
                  <div className="pt-4 border-t border-zinc-800">
                      <h3 className="text-xs text-zinc-500 mb-2 uppercase">Eventi Recenti</h3>
                      <div className="space-y-2">
                          {/* Qui potresti mappare gli eventi recenti se salvati, per ora simuliamo resume manuale se c'è codice */}
                          <div className="text-center text-zinc-600 text-xs italic">Nessun evento recente attivo</div>
                      </div>
                  </div>
                  <Button variant="ghost" onClick={logout} className="w-full text-zinc-500">Esci</Button>
              </CardContent>
          </Card>
      </div>
  );

  return (
    <div className="h-screen bg-zinc-950 text-white flex flex-col overflow-hidden">
      {/* HEADER */}
      <header className="h-16 border-b border-zinc-800 bg-black flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-4">
              <div className="bg-fuchsia-900/30 text-fuchsia-400 px-3 py-1 rounded font-mono font-bold border border-fuchsia-500/30 text-lg">{pubCode}</div>
              <div className="flex flex-col">
                  <span className="font-bold tracking-wider text-sm">REGIA LIVE</span>
                  <span className="text-[10px] text-zinc-500">{settings.name}</span>
              </div>
          </div>
          <div className="flex items-center gap-2">
              <div className="bg-zinc-800 px-3 py-1 rounded flex items-center gap-2">
                  <Coins className="w-4 h-4 text-yellow-500"/>
                  <span className="text-sm font-bold">{profile?.credits}</span>
              </div>
              <Button variant="outline" size="sm" onClick={()=>window.open(`/display/${pubCode}`, 'NeonDisplay', 'width=1280,height=720')} className="border-cyan-700 text-cyan-400 bg-cyan-950/30"><Tv className="w-4 h-4 mr-2"/> DISPLAY</Button>
              <Button variant="ghost" size="icon" onClick={() => { setIsMuted(!isMuted); api.toggleMute(!isMuted); }}>
                  {isMuted ? <VolumeX className="text-red-500"/> : <Volume2 className="text-green-500"/>}
              </Button>
              <Button variant="destructive" size="sm" onClick={() => { if(confirm("Chiudere sessione?")) { localStorage.removeItem("neonpub_pub_code"); setPubCode(null); setViewState("setup"); } }}>
                  <Power className="w-4 h-4"/>
              </Button>
          </div>
      </header>

      <div className="flex-1 grid grid-cols-12 overflow-hidden">
          {/* SIDEBAR */}
          <aside className="col-span-3 border-r border-zinc-800 bg-zinc-900/50 flex flex-col overflow-hidden">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col h-full">
                  <div className="p-2 border-b border-zinc-800 bg-zinc-950">
                      <TabsList className="grid w-full grid-cols-5 bg-zinc-900">
                          <TabsTrigger value="karaoke"><ListMusic className="w-4 h-4"/></TabsTrigger>
                          <TabsTrigger value="quiz"><BrainCircuit className="w-4 h-4"/></TabsTrigger>
                          <TabsTrigger value="msgs"><MessageSquare className="w-4 h-4"/></TabsTrigger>
                          <TabsTrigger value="chall"><Swords className="w-4 h-4"/></TabsTrigger>
                          <TabsTrigger value="settings"><Settings className="w-4 h-4"/></TabsTrigger>
                      </TabsList>
                  </div>

                  <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
                      {activeTab === 'karaoke' && (
                          <div className="space-y-4">
                              {/* PENDING REQUESTS */}
                              {queue.some(q=>q.status==='pending') && (
                                  <div className="space-y-2">
                                      <h3 className="text-xs font-bold text-yellow-500 uppercase flex items-center gap-2"><Music className="w-3 h-3"/> Da Approvare</h3>
                                      {queue.filter(q=>q.status==='pending').map(req => (
                                          <div key={req.id} className="bg-yellow-950/20 border border-yellow-900/50 p-2 rounded flex justify-between items-center">
                                              <div className="text-xs truncate w-32 font-bold text-yellow-200">{req.title}<br/><span className="font-normal text-zinc-500">{req.user_nickname}</span></div>
                                              <div className="flex gap-1">
                                                  <Button size="icon" className="h-6 w-6 bg-green-900/50 text-green-400 hover:bg-green-800" onClick={()=>api.approveRequest(req.id)}><Check className="w-3 h-3"/></Button>
                                                  <Button size="icon" className="h-6 w-6 bg-red-900/50 text-red-400 hover:bg-red-800" onClick={()=>api.rejectRequest(req.id)}><X className="w-3 h-3"/></Button>
                                              </div>
                                          </div>
                                      ))}
                                  </div>
                              )}
                              
                              {/* QUEUED REQUESTS */}
                              <div className="space-y-2">
                                  <h3 className="text-xs font-bold text-fuchsia-500 uppercase flex items-center gap-2"><ListMusic className="w-3 h-3"/> Scaletta</h3>
                                  {queue.filter(q=>q.status==='queued').map((req, i) => (
                                      <div key={req.id} className="bg-zinc-800 p-3 rounded flex justify-between items-center group border-l-2 border-transparent hover:border-fuchsia-500">
                                          <div className="overflow-hidden">
                                              <div className="flex items-center gap-2">
                                                  <span className="text-xs font-mono text-zinc-500">{i+1}</span>
                                                  <div className="font-bold truncate text-sm">{req.title}</div>
                                              </div>
                                              <div className="text-xs text-zinc-400 pl-4 truncate">{req.artist} • {req.user_nickname}</div>
                                          </div>
                                          <div className="flex gap-1">
                                              <Button size="icon" className="h-8 w-8 bg-fuchsia-600 hover:bg-fuchsia-500" onClick={()=>{ setSelectedReq(req); setYtQuery(`${req.title} ${req.artist} karaoke`); setSelectedVideoUrl(req.youtube_url || ""); setShowYoutube(true); }}>
                                                  <Play className="w-4 h-4"/>
                                              </Button>
                                              <Button size="icon" variant="ghost" className="h-8 w-8 text-zinc-600 hover:text-red-500" onClick={()=>api.deleteRequest(req.id)}><Trash2 className="w-4 h-4"/></Button>
                                          </div>
                                      </div>
                                  ))}
                              </div>
                          </div>
                      )}

                      {activeTab === 'quiz' && (
                          <div className="space-y-3">
                              <div className="grid grid-cols-2 gap-2">
                                  <Button size="sm" variant="outline" className="text-xs border-zinc-700" onClick={()=>setShowCustomQuiz(true)}><Plus className="w-3 h-3 mr-1"/> Manuale</Button>
                                  <Button size="sm" variant="outline" className="text-xs border-zinc-700" onClick={()=>setShowImportQuiz(true)}><Download className="w-3 h-3 mr-1"/> Import JSON</Button>
                              </div>
                              <h3 className="text-xs font-bold text-zinc-500 uppercase mt-2">Catalogo Domande</h3>
                              {quizCatalog.map(q => (
                                  <div key={q.id} className="bg-zinc-800 p-3 rounded cursor-pointer hover:bg-zinc-700 border-l-2 border-transparent hover:border-blue-500 group relative" onClick={()=>launchQuiz(q)}>
                                      <div className="text-[10px] text-blue-400 uppercase font-bold mb-1">{q.category}</div>
                                      <div className="text-sm font-medium line-clamp-2">{q.question}</div>
                                      <Button size="icon" className="absolute top-1 right-1 h-6 w-6 bg-red-900/0 text-red-500 hover:bg-red-900 opacity-0 group-hover:opacity-100" onClick={(e)=>deleteQuestion(e, q.id)}><Trash2 className="w-3 h-3"/></Button>
                                  </div>
                              ))}
                          </div>
                      )}

                      {activeTab === 'msgs' && (
                          <div className="space-y-4">
                              <div className="p-3 bg-zinc-800 rounded">
                                  <h3 className="text-xs font-bold text-zinc-500 uppercase mb-2">Invia Avviso</h3>
                                  <Textarea placeholder="Scrivi messaggio..." value={messageTxt} onChange={e=>setMessageTxt(e.target.value)} className="bg-black border-zinc-700 mb-2 text-sm"/>
                                  <Button onClick={sendMsg} className="w-full bg-cyan-600 h-8 text-xs font-bold">INVIA A SCHERMO</Button>
                              </div>
                              
                              <h3 className="text-xs font-bold text-zinc-500 uppercase">Messaggi Utenti</h3>
                              {pendingMsgs.length === 0 && <div className="text-zinc-600 text-xs italic text-center py-4">Nessun messaggio</div>}
                              {pendingMsgs.map(m => (
                                  <div key={m.id} className="bg-zinc-800 p-2 rounded text-sm border-l-2 border-cyan-500">
                                      <div className="font-bold text-zinc-400 text-xs mb-1">{m.user_nickname}</div>
                                      <div className="mb-2">{m.text}</div>
                                      <div className="flex justify-end gap-2">
                                          <Button size="sm" variant="ghost" className="h-6 text-red-500 text-xs" onClick={()=>api.rejectMessage(m.id)}>Rifiuta</Button>
                                          <Button size="sm" className="h-6 bg-green-600 text-xs" onClick={()=>api.approveMessage(m.id)}>Approva</Button>
                                      </div>
                                  </div>
                              ))}
                          </div>
                      )}

                      {activeTab === 'settings' && (
                          <div className="space-y-4">
                              <div className="space-y-2">
                                  <label className="text-xs text-zinc-500">Nome Locale</label>
                                  <Input value={settings.name} onChange={e=>setSettings(s=>({...s, name: e.target.value}))} className="bg-zinc-800 border-zinc-700"/>
                              </div>
                              <div className="space-y-2">
                                  <label className="text-xs text-zinc-500">Logo URL / Upload</label>
                                  <div className="flex gap-2">
                                      <Input type="file" onChange={onLogoUpload} className="text-xs bg-zinc-800" disabled={uploading}/>
                                      {uploading && <span className="text-xs animate-pulse text-yellow-500">...</span>}
                                  </div>
                              </div>
                              <Button onClick={saveSettings} className="w-full bg-zinc-700"><Save className="w-4 h-4 mr-2"/> Salva</Button>
                          </div>
                      )}
                  </div>
              </Tabs>
          </aside>

          {/* MAIN STAGE AREA */}
          <main className="col-span-9 bg-black p-8 flex flex-col items-center justify-center relative overflow-hidden">
             <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 pointer-events-none"></div>
             
             {/* KARAOKE CONTROLS */}
             {activeTab === 'karaoke' && (
                 <div className="w-full max-w-4xl z-10">
                     {currentPerf ? (
                         <Card className="bg-zinc-900 border-fuchsia-500/30 shadow-2xl overflow-hidden">
                             <div className="h-2 bg-gradient-to-r from-fuchsia-600 to-purple-600"></div>
                             <CardHeader className="text-center pb-2 bg-zinc-900/80">
                                 <div className="flex justify-center mb-4">
                                     <span className={`px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest ${currentPerf.status === 'live' ? 'bg-red-500 text-white animate-pulse' : 'bg-zinc-700 text-zinc-400'}`}>
                                         {currentPerf.status}
                                     </span>
                                 </div>
                                 <CardTitle className="text-4xl text-white font-black">{currentPerf.song_title}</CardTitle>
                                 <p className="text-fuchsia-400 text-2xl font-light mt-1">{currentPerf.song_artist}</p>
                                 <div className="mt-4 flex items-center justify-center gap-2 text-zinc-400">
                                     <Mic2 className="w-4 h-4"/>
                                     <span className="font-bold text-white">{currentPerf.user_nickname}</span>
                                 </div>
                             </CardHeader>
                             <CardContent className="flex justify-center gap-6 pt-8 pb-10 bg-black/20">
                                 {currentPerf.status !== 'voting' && (
                                     <>
                                         {currentPerf.status === 'live' 
                                            ? <Button size="lg" variant="outline" className="h-20 w-20 rounded-full border-2 border-white/10 hover:bg-white/10" onClick={()=>ctrlPlayer('pause')}><Pause className="w-8 h-8"/></Button>
                                            : <Button size="lg" className="h-20 w-20 rounded-full bg-green-600 hover:bg-green-500 shadow-[0_0_20px_rgba(22,163,74,0.4)]" onClick={()=>ctrlPlayer('resume')}><Play className="w-8 h-8 ml-1"/></Button>
                                         }
                                         <Button size="lg" variant="secondary" className="h-20 w-20 rounded-full bg-zinc-800 hover:bg-zinc-700" onClick={()=>ctrlPlayer('restart')}><RotateCcw className="w-6 h-6"/></Button>
                                         <Button size="lg" className="h-20 px-10 bg-yellow-500 hover:bg-yellow-400 text-black font-bold text-lg shadow-[0_0_20px_rgba(234,179,8,0.4)]" onClick={()=>ctrlPlayer('voting')}>STOP & VOTA</Button>
                                         <Button size="lg" variant="destructive" className="h-20 px-6 font-bold" onClick={()=>ctrlPlayer('end')}>NEXT</Button>
                                     </>
                                 )}
                                 {currentPerf.status === 'voting' && (
                                     <div className="text-center animate-pulse">
                                         <div className="text-yellow-500 font-bold mb-2 uppercase tracking-widest">Televoto in Corso</div>
                                         <Button size="lg" variant="destructive" className="h-16 px-12 text-xl font-bold" onClick={()=>ctrlPlayer('end')}>CHIUDI & MOSTRA PUNTEGGIO</Button>
                                     </div>
                                 )}
                             </CardContent>
                         </Card>
                     ) : (
                         <div className="text-center text-zinc-600 border-2 border-dashed border-zinc-800 rounded-3xl p-12">
                             <Music className="w-32 h-32 mx-auto mb-6 opacity-20"/>
                             <h2 className="text-3xl font-bold text-zinc-500">NESSUNA ESIBIZIONE</h2>
                             <p className="text-zinc-600 mt-2">Seleziona "Play" su una richiesta nella barra laterale.</p>
                         </div>
                     )}
                 </div>
             )}

             {/* QUIZ CONTROLS */}
             {activeTab === 'quiz' && activeQuiz && (
                 <Card className="w-full max-w-2xl bg-zinc-900 border-blue-500/30 z-10 shadow-2xl">
                     <div className="h-2 bg-gradient-to-r from-blue-600 to-cyan-600"></div>
                     <CardHeader className="bg-blue-900/10 border-b border-blue-500/10">
                         <div className="flex justify-between items-center">
                             <div className="flex items-center gap-2">
                                 <BrainCircuit className="w-5 h-5 text-blue-400"/>
                                 <span className="font-bold text-blue-100">QUIZ IN CORSO</span>
                             </div>
                             <span className="text-xs bg-blue-500 text-white px-2 py-1 rounded font-bold uppercase tracking-widest">{activeQuiz.status}</span>
                         </div>
                     </CardHeader>
                     <CardContent className="pt-8 pb-8 space-y-8">
                         <h2 className="text-3xl font-bold text-white text-center leading-tight">{activeQuiz.question}</h2>
                         
                         <div className="grid grid-cols-2 gap-4">
                             <Button className="h-14 text-lg bg-red-600 hover:bg-red-500 font-bold shadow-lg" onClick={()=>ctrlQuiz('close_vote')}>1. STOP TELEVOTO</Button>
                             <Button className="h-14 text-lg bg-green-600 hover:bg-green-500 font-bold shadow-lg" onClick={()=>ctrlQuiz('show_results')}>2. MOSTRA RISULTATI</Button>
                             <Button className="h-14 text-lg bg-yellow-500 hover:bg-yellow-400 text-black font-bold col-span-2 shadow-lg" onClick={()=>ctrlQuiz('end')}>3. CHIUDI QUIZ & TORNA AL KARAOKE</Button>
                         </div>
                     </CardContent>
                 </Card>
             )}
          </main>
      </div>

      {/* --- MODALS --- */}

      {/* YOUTUBE SEARCH */}
      <Dialog open={showYoutube} onOpenChange={setShowYoutube}>
          <DialogContent className="bg-zinc-900 border-zinc-800 max-w-4xl">
              <DialogHeader><DialogTitle className="text-xl">Scegli Video per: <span className="text-fuchsia-400">{selectedReq?.title}</span></DialogTitle></DialogHeader>
              <div className="flex gap-2 my-4">
                  <Input value={ytQuery} onChange={e=>setYtQuery(e.target.value)} placeholder="Cerca su YouTube..." className="bg-black border-zinc-700 h-12 text-lg" onKeyDown={e=>e.key==='Enter'&&searchYT()}/>
                  <Button onClick={searchYT} className="w-32 bg-zinc-700 h-12">Cerca</Button>
              </div>
              <div className="grid grid-cols-2 gap-4 max-h-[300px] overflow-y-auto custom-scrollbar">
                  {ytResults.map(vid => (
                      <div key={vid.id.videoId} className="flex gap-3 p-3 bg-zinc-800 rounded cursor-pointer hover:bg-zinc-700 transition border border-transparent hover:border-fuchsia-500" onClick={()=>setSelectedVideoUrl(`https://www.youtube.com/watch?v=${vid.id.videoId}`)}>
                          <img src={vid.snippet.thumbnails.default.url} className="w-32 h-20 object-cover rounded"/>
                          <div className="overflow-hidden flex-1">
                              <div className="font-bold text-sm truncate text-white mb-1">{vid.snippet.title}</div>
                              <div className="text-xs text-zinc-500">{vid.snippet.channelTitle}</div>
                          </div>
                      </div>
                  ))}
              </div>
              <div className="mt-6 pt-4 border-t border-zinc-800">
                  <label className="text-xs text-zinc-500 font-bold uppercase mb-2 block">Link Video Finale</label>
                  <div className="flex gap-2">
                      <Input value={selectedVideoUrl} onChange={e=>setSelectedVideoUrl(e.target.value)} className="bg-black font-mono text-fuchsia-400 h-12"/>
                      <Button className="bg-green-600 hover:bg-green-500 w-48 font-bold h-12 text-lg shadow-[0_0_15px_rgba(22,163,74,0.5)]" onClick={launchKaraoke} disabled={!selectedVideoUrl}>MANDA IN ONDA</Button>
                  </div>
              </div>
          </DialogContent>
      </Dialog>
      
      {/* CUSTOM QUIZ */}
      <Dialog open={showCustomQuiz} onOpenChange={setShowCustomQuiz}>
          <DialogContent className="bg-zinc-900 border-zinc-800">
              <DialogHeader><DialogTitle>Crea Quiz Manuale</DialogTitle></DialogHeader>
              <div className="space-y-3">
                  <Input placeholder="Domanda" value={newQuiz.q} onChange={e=>setNewQuiz({...newQuiz, q:e.target.value})} className="bg-black"/>
                  {newQuiz.opts.map((o,i) => (
                      <div key={i} className="flex gap-2">
                           <Input placeholder={`Opzione ${i+1}`} value={o} onChange={e=>{const n=[...newQuiz.opts];n[i]=e.target.value;setNewQuiz({...newQuiz, opts:n})}} className="bg-black"/>
                           <Button size="icon" variant={newQuiz.correct===i?'default':'outline'} onClick={()=>setNewQuiz({...newQuiz, correct:i})} className={newQuiz.correct===i?'bg-green-600':''}><Check className="w-4 h-4"/></Button>
                      </div>
                  ))}
                  <Button onClick={createAndLaunchCustomQuiz} className="w-full bg-blue-600 font-bold">LANCIA ORA</Button>
              </div>
          </DialogContent>
      </Dialog>
      
      {/* IMPORT JSON */}
      <Dialog open={showImportQuiz} onOpenChange={setShowImportQuiz}>
          <DialogContent className="bg-zinc-900 border-zinc-800">
              <DialogHeader><DialogTitle>Importa JSON</DialogTitle></DialogHeader>
              <Textarea placeholder='[{"question":"...","options":["A","B"],"correct_index":0}]' value={importJson} onChange={e=>setImportJson(e.target.value)} className="h-64 bg-black font-mono text-xs"/>
              <Button onClick={handleImport} className="w-full bg-fuchsia-600">IMPORTA</Button>
          </DialogContent>
      </Dialog>
    </div>
  );
}