import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { 
  Music, Play, Check, X, MessageSquare, LogOut, 
  Pause, RotateCcw, Plus, ListMusic, BrainCircuit, 
  VolumeX, Volume2, Settings, Save, Power, Download, Trash2, Coins, Tv, RefreshCw
} from "lucide-react";
// Assicurati che questi percorsi puntino ai tuoi componenti UI esistenti
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";

export default function AdminDashboard() {
  const navigate = useNavigate();
  // useAuth ritorna user (da Supabase) quando sei loggato
  const { user, isAuthenticated, logout } = useAuth();
  
  // --- STATES ---
  const [viewState, setViewState] = useState("loading"); // loading, setup, dashboard
  const [pubCode, setPubCode] = useState(localStorage.getItem("neonpub_pub_code"));
  const [currentEvent, setCurrentEvent] = useState(null); // Contiene l'intero oggetto evento (id, name, code)
  
  // Setup / History
  const [pastEvents, setPastEvents] = useState([]);
  const [newEventName, setNewEventName] = useState("");
  
  // Dashboard Core
  const [activeTab, setActiveTab] = useState("karaoke");
  const [queue, setQueue] = useState([]);
  const [currentPerf, setCurrentPerf] = useState(null);
  const [activeQuiz, setActiveQuiz] = useState(null);
  const [quizCatalog, setQuizCatalog] = useState([]); // Popola se hai un catalogo
  const [pendingMsgs, setPendingMsgs] = useState([]);
  const [isMuted, setIsMuted] = useState(false);
  const [messageTxt, setMessageTxt] = useState("");
  const [settings, setSettings] = useState({ name: "", logo: "" });
  const [uploading, setUploading] = useState(false);

  // Modals
  const [showYoutube, setShowYoutube] = useState(false);
  const [ytQuery, setYtQuery] = useState("");
  const [ytResults, setYtResults] = useState([]);
  const [selectedReq, setSelectedReq] = useState(null);
  const [selectedVideoUrl, setSelectedVideoUrl] = useState("");
  const [showCustomQuiz, setShowCustomQuiz] = useState(false);
  const [newQuiz, setNewQuiz] = useState({ q: "", opts: ["","","",""], correct: 0, cat: "Generale" });

  // --- INIT LOGIC ---
  
  // 1. Controllo Auth
  useEffect(() => {
    if (!isAuthenticated && !localStorage.getItem('sb-access-token')) {
       // Se non autenticato, AuthContext gestirà il redirect o mostrerà stato vuoto
       // Qui assumiamo che se isAuthenticated è false dopo il caricamento, l'utente debba loggarsi
       return;
    }

    const checkEvent = async () => {
      if (pubCode) {
          const res = await api.getPub(pubCode);
          if (res.data) {
              setCurrentEvent(res.data);
              setSettings({ name: res.data.name, logo: res.data.logo_url });
              setViewState("dashboard");
          } else {
              setPubCode(null);
              localStorage.removeItem("neonpub_pub_code");
              setViewState("setup");
          }
      } else {
          setViewState("setup");
      }
    };
    checkEvent();
  }, [isAuthenticated, pubCode]);

  // 2. Caricamento Lista Eventi Passati (Solo in setup)
  useEffect(() => {
      if (viewState === 'setup' && isAuthenticated) {
          const loadHistory = async () => {
              try {
                  const res = await api.getOwnerEvents();
                  setPastEvents(res.data || []);
              } catch (e) {
                  console.error("Errore history", e);
              }
          };
          loadHistory();
      }
  }, [viewState, isAuthenticated]);

  // 3. Polling Dati (Solo in dashboard)
  useEffect(() => {
    if (viewState !== 'dashboard' || !currentEvent) return;
    
    const loadData = async () => {
        try {
            const eventId = currentEvent.id;
            const [qRes, perfRes, quizRes, msgRes] = await Promise.all([
                api.getAdminQueue(eventId),
                api.getAdminCurrentPerformance(eventId),
                api.getActiveQuiz(eventId),
                api.getAdminPendingMessages(eventId)
            ]);
            setQueue(qRes.data);
            setCurrentPerf(perfRes.data);
            setActiveQuiz(quizRes.data);
            setPendingMsgs(msgRes.data);
        } catch (e) { console.error("Polling error", e); }
    };
    
    loadData();
    const interval = setInterval(loadData, 3000);
    return () => clearInterval(interval);
  }, [viewState, currentEvent]);


  // --- ACTIONS ---

  const handleStartEvent = async () => {
    if(!newEventName) return toast.error("Inserisci nome evento");
    try {
        const res = await api.createPub({name: newEventName});
        const evt = res.data;
        localStorage.setItem("neonpub_pub_code", evt.code);
        setPubCode(evt.code);
        setCurrentEvent(evt);
        setSettings({ name: evt.name, logo: null });
        setViewState("dashboard");
        toast.success("Evento Iniziato!");
    } catch(e) { toast.error(e.message); }
  };

  const handleResumeEvent = (evt) => {
      localStorage.setItem("neonpub_pub_code", evt.code);
      setPubCode(evt.code);
      setCurrentEvent(evt);
      setSettings({ name: evt.name, logo: evt.logo_url });
      setViewState("dashboard");
      toast.success("Evento ripreso");
  };

  const handleLogout = () => {
      localStorage.removeItem("neonpub_pub_code");
      setPubCode(null);
      logout();
      navigate("/");
  };

  // --- KARAOKE ACTIONS ---
  
  const searchYT = async () => {
      if(!ytQuery) return;
      // Inserisci qui la tua API KEY reale se vuoi che funzioni la ricerca, 
      // altrimenti usa l'input manuale URL nel modale
      const apiKey = import.meta.env.VITE_YOUTUBE_API_KEY || ""; 
      if (!apiKey) {
          toast.info("API Key non configurata. Inserisci URL manuale.");
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

  // --- QUIZ ACTIONS ---
  
  const createAndLaunchCustomQuiz = async () => {
      if (!currentEvent) return;
      try {
          await api.startQuiz({
              event_id: currentEvent.id,
              category: newQuiz.cat, 
              question: newQuiz.q, 
              options: newQuiz.opts, 
              correct_index: newQuiz.correct, 
              points: 10
          });
          setShowCustomQuiz(false);
          toast.success("Quiz Custom In Onda!");
      } catch(e) { toast.error(e.message); }
  };

  const ctrlQuiz = async (action) => {
      if(!activeQuiz) return;
      await api.ctrlQuiz(activeQuiz.id, action);
  };

  // --- SETTINGS & MESSAGES ---

  const saveSettings = async () => {
      if (!currentEvent) return;
      try { 
          await api.updateEventSettings(currentEvent.id, { name: settings.name, logo_url: settings.logo }); 
          toast.success("Salvato"); 
      } catch(e) { toast.error(e.message); }
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
      if(!messageTxt || !currentEvent) return;
      await api.sendMessage(currentEvent.id, messageTxt);
      setMessageTxt("");
      toast.success("Inviato");
  };

  // --- VIEWS ---

  if (viewState === "loading") return <div className="h-screen bg-black text-white flex items-center justify-center">Caricamento...</div>;

  if (viewState === "setup") return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4">
          <Card className="w-full max-w-md bg-zinc-900 border-zinc-800 mb-4">
              <CardHeader><CardTitle className="text-center text-white text-2xl">NEONPUB CONTROL</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                  <div className="space-y-2">
                      <Input placeholder="Nome Evento (es. Karaoke Night)" value={newEventName} onChange={e=>setNewEventName(e.target.value)} className="bg-black text-white border-zinc-700"/>
                      <Button onClick={handleStartEvent} className="w-full bg-fuchsia-600 hover:bg-fuchsia-700 h-12 text-lg font-bold">CREA EVENTO</Button>
                  </div>
              </CardContent>
          </Card>

          {/* LISTA EVENTI PASSATI - LA FUNZIONALITA' MANCANTE */}
          {pastEvents.length > 0 && (
              <Card className="w-full max-w-md bg-zinc-900 border-zinc-800">
                  <CardHeader><CardTitle className="text-zinc-500 text-sm uppercase">Riprendi Evento</CardTitle></CardHeader>
                  <CardContent className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                      {pastEvents.map(evt => (
                          <div key={evt.id} onClick={() => handleResumeEvent(evt)} className="flex items-center justify-between p-3 bg-zinc-800 rounded border border-zinc-700 hover:border-zinc-500 cursor-pointer transition">
                              <div>
                                  <div className="font-bold text-white text-sm">{evt.name}</div>
                                  <div className="text-xs text-zinc-500 font-mono">CODE: {evt.code}</div>
                              </div>
                              <Play className="w-4 h-4 text-green-500"/>
                          </div>
                      ))}
                  </CardContent>
              </Card>
          )}

          <Button variant="ghost" onClick={handleLogout} className="mt-4 text-zinc-500">Logout</Button>
      </div>
  );

  return (
    <div className="h-screen bg-zinc-950 text-white flex flex-col overflow-hidden">
      {/* HEADER */}
      <header className="h-16 border-b border-zinc-800 bg-black flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-4">
              <div className="bg-fuchsia-900/30 text-fuchsia-400 px-3 py-1 rounded font-mono font-bold border border-fuchsia-500/30 text-lg">{pubCode}</div>
              <div className="flex flex-col"><span className="font-bold tracking-wider text-sm">REGIA LIVE</span><span className="text-[10px] text-zinc-500">{settings.name}</span></div>
          </div>
          <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={()=>window.open(`/display/${pubCode}`, 'NeonDisplay', 'width=1280,height=720')} className="border-cyan-700 text-cyan-400 bg-cyan-950/30"><Tv className="w-4 h-4 mr-2"/> DISPLAY</Button>
              <Button variant="ghost" size="icon" onClick={() => { setIsMuted(!isMuted); api.toggleMute(!isMuted); }}>{isMuted ? <VolumeX className="text-red-500"/> : <Volume2 className="text-green-500"/>}</Button>
              <Button variant="destructive" size="sm" onClick={() => { localStorage.removeItem("neonpub_pub_code"); setPubCode(null); setViewState("setup"); }}><Power className="w-4 h-4"/></Button>
          </div>
      </header>

      {/* BODY */}
      <div className="flex-1 grid grid-cols-12 overflow-hidden">
          {/* SIDEBAR TABS */}
          <aside className="col-span-3 border-r border-zinc-800 bg-zinc-900/50 flex flex-col overflow-hidden">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col h-full">
                  <div className="p-2 border-b border-zinc-800 bg-zinc-950">
                      <TabsList className="grid w-full grid-cols-4 bg-zinc-900">
                          <TabsTrigger value="karaoke"><ListMusic className="w-4 h-4"/></TabsTrigger>
                          <TabsTrigger value="quiz"><BrainCircuit className="w-4 h-4"/></TabsTrigger>
                          <TabsTrigger value="msgs"><MessageSquare className="w-4 h-4"/></TabsTrigger>
                          <TabsTrigger value="settings"><Settings className="w-4 h-4"/></TabsTrigger>
                      </TabsList>
                  </div>

                  <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
                      {activeTab === 'karaoke' && (
                          <div className="space-y-4">
                              {/* Pending Requests */}
                              {queue.some(q=>q.status==='pending') && (
                                  <div className="space-y-2">
                                      <h3 className="text-xs font-bold text-yellow-500 uppercase flex items-center gap-2"><Music className="w-3 h-3"/> Da Approvare</h3>
                                      {queue.filter(q=>q.status==='pending').map(req => (
                                          <div key={req.id} className="bg-yellow-950/20 border border-yellow-900/50 p-2 rounded flex justify-between items-center">
                                              <div className="text-xs truncate w-32 font-bold text-yellow-200">{req.title}<br/><span className="font-normal text-zinc-500">{req.user_nickname}</span></div>
                                              <div className="flex gap-1">
                                                  <Button size="icon" className="h-6 w-6 bg-green-900/50 text-green-400" onClick={()=>api.approveRequest(req.id)}><Check className="w-3 h-3"/></Button>
                                                  <Button size="icon" className="h-6 w-6 bg-red-900/50 text-red-400" onClick={()=>api.rejectRequest(req.id)}><X className="w-3 h-3"/></Button>
                                              </div>
                                          </div>
                                      ))}
                                  </div>
                              )}
                              
                              {/* Active Queue */}
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
                                              <Button size="icon" className="h-8 w-8 bg-fuchsia-600" onClick={()=>{ setSelectedReq(req); setYtQuery(`${req.title} ${req.artist} karaoke`); setSelectedVideoUrl(req.youtube_url || ""); setShowYoutube(true); }}><Play className="w-4 h-4"/></Button>
                                              <Button size="icon" variant="ghost" className="h-8 w-8 text-zinc-600 hover:text-red-500" onClick={()=>api.deleteRequest(req.id)}><Trash2 className="w-4 h-4"/></Button>
                                          </div>
                                      </div>
                                  ))}
                              </div>
                          </div>
                      )}

                      {activeTab === 'quiz' && (
                          <div className="space-y-3">
                              <Button size="sm" variant="outline" className="w-full text-xs border-zinc-700" onClick={()=>setShowCustomQuiz(true)}><Plus className="w-3 h-3 mr-1"/> Nuovo Quiz Manuale</Button>
                              <div className="text-center text-zinc-500 text-xs mt-4">Nessun catalogo caricato</div>
                          </div>
                      )}

                      {activeTab === 'msgs' && (
                          <div className="space-y-4">
                              <div className="p-3 bg-zinc-800 rounded">
                                  <h3 className="text-xs font-bold text-zinc-500 uppercase mb-2">Invia Avviso</h3>
                                  <Textarea placeholder="Es. Happy Hour tra 10 min!" value={messageTxt} onChange={e=>setMessageTxt(e.target.value)} className="bg-black border-zinc-700 mb-2 text-sm"/>
                                  <Button onClick={sendMsg} className="w-full bg-cyan-600 h-8 text-xs font-bold">INVIA A SCHERMO</Button>
                              </div>
                              <h3 className="text-xs font-bold text-zinc-500 uppercase">Messaggi Utenti</h3>
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
                              <div className="space-y-2"><label className="text-xs text-zinc-500">Nome Locale</label><Input value={settings.name} onChange={e=>setSettings(s=>({...s, name: e.target.value}))} className="bg-zinc-800 border-zinc-700"/></div>
                              <div className="space-y-2"><label className="text-xs text-zinc-500">Logo URL</label><div className="flex gap-2"><Input type="file" onChange={onLogoUpload} className="text-xs bg-zinc-800" disabled={uploading}/></div></div>
                              <Button onClick={saveSettings} className="w-full bg-zinc-700"><Save className="w-4 h-4 mr-2"/> Salva Impostazioni</Button>
                          </div>
                      )}
                  </div>
              </Tabs>
          </aside>

          {/* MAIN PLAYER AREA */}
          <main className="col-span-9 bg-black p-8 flex flex-col items-center justify-center relative overflow-hidden">
             <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 pointer-events-none"></div>
             
             {activeTab === 'karaoke' && (
                 <div className="w-full max-w-4xl z-10">
                     {currentPerf ? (
                         <Card className="bg-zinc-900 border-fuchsia-500/30 shadow-2xl overflow-hidden">
                             <div className="h-2 bg-gradient-to-r from-fuchsia-600 to-purple-600"></div>
                             <CardHeader className="text-center pb-2 bg-zinc-900/80">
                                 <div className="flex justify-center mb-4"><span className={`px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest ${currentPerf.status === 'live' ? 'bg-red-500 text-white animate-pulse' : 'bg-zinc-700 text-zinc-400'}`}>{currentPerf.status}</span></div>
                                 <CardTitle className="text-4xl text-white font-black">{currentPerf.song_title}</CardTitle>
                                 <p className="text-fuchsia-400 text-2xl font-light mt-1">{currentPerf.song_artist}</p>
                                 <div className="mt-4 flex items-center justify-center gap-2 text-zinc-400"><span className="font-bold text-white">{currentPerf.user_nickname}</span></div>
                             </CardHeader>
                             <CardContent className="flex justify-center gap-6 pt-8 pb-10 bg-black/20">
                                 {currentPerf.status !== 'voting' && (
                                     <>
                                         {currentPerf.status === 'live' ? <Button size="lg" variant="outline" className="h-20 w-20 rounded-full border-2 border-white/10" onClick={()=>ctrlPlayer('pause')}><Pause className="w-8 h-8"/></Button> : <Button size="lg" className="h-20 w-20 rounded-full bg-green-600" onClick={()=>ctrlPlayer('resume')}><Play className="w-8 h-8 ml-1"/></Button>}
                                         <Button size="lg" className="h-20 px-10 bg-yellow-500 text-black font-bold text-lg" onClick={()=>ctrlPlayer('voting')}>STOP & VOTA</Button>
                                         <Button size="lg" variant="destructive" className="h-20 px-6 font-bold" onClick={()=>ctrlPlayer('end')}>NEXT</Button>
                                     </>
                                 )}
                                 {currentPerf.status === 'voting' && (<div className="text-center animate-pulse"><div className="text-yellow-500 font-bold mb-2 uppercase tracking-widest">Televoto in Corso</div><Button size="lg" variant="destructive" className="h-16 px-12 text-xl font-bold" onClick={()=>ctrlPlayer('end')}>CHIUDI & MOSTRA RISULTATI</Button></div>)}
                             </CardContent>
                         </Card>
                     ) : (
                         <div className="text-center text-zinc-600 border-2 border-dashed border-zinc-800 rounded-3xl p-12"><Music className="w-32 h-32 mx-auto mb-6 opacity-20"/><h2 className="text-3xl font-bold text-zinc-500">NESSUNA ESIBIZIONE IN CORSO</h2></div>
                     )}
                 </div>
             )}

             {activeTab === 'quiz' && activeQuiz && (
                 <Card className="w-full max-w-2xl bg-zinc-900 border-blue-500/30 z-10 shadow-2xl">
                     <div className="h-2 bg-gradient-to-r from-blue-600 to-cyan-600"></div>
                     <CardHeader className="bg-blue-900/10 border-b border-blue-500/10"><div className="flex justify-between items-center"><div className="flex items-center gap-2"><BrainCircuit className="w-5 h-5 text-blue-400"/><span className="font-bold text-blue-100">QUIZ LIVE</span></div><span className="text-xs bg-blue-500 text-white px-2 py-1 rounded font-bold uppercase tracking-widest">{activeQuiz.status}</span></div></CardHeader>
                     <CardContent className="pt-8 pb-8 space-y-8"><h2 className="text-3xl font-bold text-white text-center leading-tight">{activeQuiz.question}</h2><div className="grid grid-cols-2 gap-4"><Button className="h-14 text-lg bg-red-600 hover:bg-red-500 font-bold" onClick={()=>ctrlQuiz('close_vote')}>1. STOP VOTI</Button><Button className="h-14 text-lg bg-green-600 hover:bg-green-500 font-bold" onClick={()=>ctrlQuiz('show_results')}>2. MOSTRA RISULTATI</Button><Button className="h-14 text-lg bg-yellow-500 hover:bg-yellow-400 text-black font-bold col-span-2" onClick={()=>ctrlQuiz('end')}>3. CHIUDI QUIZ</Button></div></CardContent>
                 </Card>
             )}
          </main>
      </div>

      {/* DIALOGS */}
      <Dialog open={showYoutube} onOpenChange={setShowYoutube}>
        <DialogContent className="bg-zinc-900 border-zinc-800 max-w-4xl">
            <DialogHeader><DialogTitle>Scegli Video per {selectedReq?.title}</DialogTitle></DialogHeader>
            <div className="flex gap-2 my-4"><Input value={ytQuery} onChange={e=>setYtQuery(e.target.value)} placeholder="Cerca su YouTube..." className="bg-black border-zinc-700 h-12"/><Button onClick={searchYT} className="w-32 bg-zinc-700 h-12">Cerca</Button></div>
            <div className="grid grid-cols-2 gap-4 max-h-[300px] overflow-y-auto custom-scrollbar">
                {ytResults.map(vid => (
                    <div key={vid.id.videoId} className="flex gap-3 p-3 bg-zinc-800 rounded cursor-pointer hover:bg-zinc-700 transition" onClick={()=>setSelectedVideoUrl(`https://www.youtube.com/watch?v=${vid.id.videoId}`)}>
                        <img src={vid.snippet.thumbnails.default.url} className="w-32 h-20 object-cover rounded" alt="thumb"/>
                        <div className="overflow-hidden flex-1"><div className="font-bold text-sm truncate text-white mb-1">{vid.snippet.title}</div></div>
                    </div>
                ))}
            </div>
            <div className="mt-6 pt-4 border-t border-zinc-800">
                <div className="flex gap-2"><Input value={selectedVideoUrl} onChange={e=>setSelectedVideoUrl(e.target.value)} placeholder="Incolla URL YouTube qui se non cerchi" className="bg-black font-mono text-fuchsia-400 h-12"/><Button className="bg-green-600 w-48 font-bold h-12" onClick={launchKaraoke} disabled={!selectedVideoUrl}>MANDA IN ONDA</Button></div>
            </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showCustomQuiz} onOpenChange={setShowCustomQuiz}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
            <DialogHeader><DialogTitle>Crea Quiz Manuale</DialogTitle></DialogHeader>
            <div className="space-y-3">
                <Input placeholder="Domanda" value={newQuiz.q} onChange={e=>setNewQuiz({...newQuiz, q:e.target.value})} className="bg-black"/>
                {newQuiz.opts.map((o,i) => (<div key={i} className="flex gap-2"><Input placeholder={`Opzione ${i+1}`} value={o} onChange={e=>{const n=[...newQuiz.opts];n[i]=e.target.value;setNewQuiz({...newQuiz, opts:n})}} className="bg-black"/><Button size="icon" variant={newQuiz.correct===i?'default':'outline'} onClick={()=>setNewQuiz({...newQuiz, correct:i})} className={newQuiz.correct===i?'bg-green-600':''}><Check className="w-4 h-4"/></Button></div>))}
                <Button onClick={createAndLaunchCustomQuiz} className="w-full bg-blue-600 font-bold">LANCIA SUBITO</Button>
            </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}