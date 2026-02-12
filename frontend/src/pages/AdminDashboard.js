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
  const [approvedMessages, setApprovedMessages] = useState([]);
  const [isMuted, setIsMuted] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(null);
  
  const [libraryTab, setLibraryTab] = useState("karaoke"); 

  // --- STATI CATALOGHI ---
  const [quizCatalog, setQuizCatalog] = useState([]);
  const [quizCategoryFilter, setQuizCategoryFilter] = useState("all"); 
  const [challenges, setChallenges] = useState([]);

  // --- STATI SUPER ADMIN ---
  const [userList, setUserList] = useState([]);
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState(""); // Aggiunto stato password
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
  const [quizCategory, setQuizCategory] = useState("Indovina Intro");

  // --- MESSAGGI VARS ---
  const [adminMessage, setAdminMessage] = useState("");

  // --- SETUP & MULTI EVENTO ---
  const [newEventName, setNewEventName] = useState("");
  const [creatingEvent, setCreatingEvent] = useState(false);
  const [activeEventsList, setActiveEventsList] = useState([]); // Lista eventi attivi dell'operatore

  const pollIntervalRef = useRef(null);
  const timerIntervalRef = useRef(null);

  useEffect(() => { checkUserProfile(); }, [isAuthenticated]);

  const checkUserProfile = async () => {
    if (!isAuthenticated) return; 
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      let { data: userProfile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      
      // LOGICA ADMIN: Se è l'admin, forza sempre il ruolo e lo stato attivo se non corretti
      if (user.email === 'admin@neonpub.com') {
          if (!userProfile || userProfile.role !== 'super_admin' || userProfile.is_active !== true) {
              const { error } = await supabase.from('profiles').upsert({ 
                  id: user.id, 
                  email: user.email, 
                  role: 'super_admin', 
                  credits: 9999, 
                  is_active: true 
              });
              if(!error) {
                  // Aggiorna l'oggetto locale dopo l'upsert
                  userProfile = { id: user.id, email: user.email, role: 'super_admin', credits: 9999, is_active: true };
              }
          }
      }
      
      // CREAZIONE PROFILO STANDARD (Se non esiste)
      if (!userProfile) {
         const { data: newProfile } = await supabase.from('profiles').insert([{ 
             id: user.id, 
             email: user.email, 
             role: 'operator', 
             credits: 0, 
             is_active: true 
         }]).select().single();
         userProfile = newProfile;
      }

      // CONTROLLO BAN (Solo se esplicitamente false, così se è null/undefined entra lo stesso)
      if (userProfile.is_active === false) {
          toast.error("Account disabilitato. Contatta l'amministratore.");
          logout();
          return;
      }

      setProfile(userProfile);
      
      // ROUTING IN BASE AL RUOLO
      if (userProfile.role === 'super_admin') { 
          setAppState("super_admin"); 
          loadSuperAdminData(); 
      } else {
        // Logica Operatore
        const storedCode = localStorage.getItem("neonpub_pub_code");
        
        if (storedCode) { 
            const pubData = await api.getPub(storedCode);
            // Verifica validità evento
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
    } catch (error) { 
        console.error(error); 
        toast.error("Errore profilo: " + error.message);
    }
  };

  const loadActiveEvents = async () => {
      const events = await api.getActiveEventsForUser();
      setActiveEventsList(events || []);
  };

  const handleLogout = () => { localStorage.removeItem("neonpub_pub_code"); logout(); navigate("/"); };

  const handleStartEvent = async (e) => {
    e.preventDefault();
    if (!newEventName) return toast.error("Inserisci nome evento");
    if ((profile?.credits || 0) < 1) return toast.error("Crediti insufficienti!");

    setCreatingEvent(true);
    try {
        const { data: pubData } = await createPub({ name: newEventName });
        localStorage.setItem("neonpub_pub_code", pubData.code);
        setPubCode(pubData.code);
        
        // Aggiorna crediti locali per UI veloce
        setProfile(prev => ({...prev, credits: prev.credits - 1}));
        
        setAppState("dashboard");
        toast.success("Evento Iniziato! (-1 Credito, Valido 8 ore)");
    } catch (error) { toast.error(error.message); } finally { setCreatingEvent(false); }
  };

  const handleResumeEvent = (code) => {
      localStorage.setItem("neonpub_pub_code", code);
      setPubCode(code);
      setAppState("dashboard");
      toast.success("Evento ripreso!");
  };

  const loadData = useCallback(async () => {
    if (!pubCode || appState !== 'dashboard') return;
    try {
      const pubRes = await api.getPub(pubCode);
      if (!pubRes.data) {
          toast.error("Evento scaduto o inesistente.");
          localStorage.removeItem("neonpub_pub_code");
          setAppState("setup");
          loadActiveEvents();
          return;
      }
      
      // Calcolo tempo rimanente
      const expires = new Date(pubRes.data.expires_at);
      const now = new Date();
      const diff = expires - now;
      if (diff <= 0) {
           setTimeRemaining("SCADUTO");
      } else {
           const hours = Math.floor(diff / (1000 * 60 * 60));
           const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
           setTimeRemaining(`${hours}h ${minutes}m`);
      }

      const stateData = await api.getEventState();
      if(stateData) setEventState(stateData);

      const [qRes, perfRes, msgRes, activeQuizRes, quizCatRes, challRes] = await Promise.all([
        api.getAdminQueue(),
        api.getAdminCurrentPerformance(),
        api.getAdminPendingMessages(),
        api.getActiveQuiz(),
        api.getQuizCatalog(),
        api.getChallengeCatalog()
      ]);

      setQueue(qRes.data || []);
      setCurrentPerformance(perfRes.data);
      setPendingMessages(msgRes.data || []);
      
      // Load approved messages - FILTRA PER EVENTO
      const approvedRes = await supabase.from('messages')
        .select('*, participants(nickname)')
        .eq('event_id', pubRes.data.id)  // ← FILTRO PER EVENTO!
        .eq('status', 'approved')
        .order('created_at', {ascending: false})
        .limit(10);
      setApprovedMessages(approvedRes.data?.map(m => ({...m, user_nickname: m.participants?.nickname})) || []);
      
      setQuizCatalog(quizCatRes.data || []);
      setChallenges(challRes.data || []);

      if(pubRes.data && !venueName) { setVenueName(pubRes.data.name); setVenueLogo(pubRes.data.logo_url || ""); }
      
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

  // --- SUPER ADMIN LOGIC ---
  const loadSuperAdminData = async () => { const { data } = await api.getAllProfiles(); setUserList(data || []); };
  
  const addCredits = async (userId, amount) => {
      const user = userList.find(u => u.id === userId);
      if(!user) return;
      const current = user.credits || 0;
      await api.updateProfileCredits(userId, current + amount);
      toast.success("Crediti aggiornati"); loadSuperAdminData();
  };

  const toggleUserStatus = async (userId, currentStatus) => {
      try {
          await api.toggleUserStatus(userId, !currentStatus);
          toast.success(`Utente ${!currentStatus ? 'Attivato' : 'Disabilitato'}`);
          loadSuperAdminData();
      } catch (e) { toast.error("Errore modifica stato"); }
  };

  const handleCreateOperator = async () => {
      if(!newUserEmail || !newUserPassword) return toast.error("Email e Password richieste");
      try {
        await api.createOperatorProfile(newUserEmail, newUserName, newUserPassword, 0);
        setShowCreateUserModal(false); 
        setNewUserEmail(""); setNewUserPassword(""); setNewUserName("");
        toast.success("Operatore creato e invitato."); 
        loadSuperAdminData();
      } catch (e) {
        toast.error("Errore creazione: " + e.message);
      }
  };

  // --- DASHBOARD ACTIONS ---
  const handleOpenDisplay = () => {
    const width = 1280; const height = 720;
    const left = (window.screen.width - width) / 2; const top = (window.screen.height - height) / 2;
    window.open(`/display/${pubCode}`, 'NeonPubDisplay', `popup=yes,width=${width},height=${height},top=${top},left=${left},toolbar=no,menubar=no`);
  };

  const handleToggleMute = async () => {
      const newState = !isMuted;
      setIsMuted(newState); 
      await api.toggleMute(newState);
  };

  const handleLogoUpload = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      setUploadingLogo(true);
      try {
          const url = await api.uploadLogo(file);
          setVenueLogo(url);
          toast.success("Logo caricato! Clicca Salva per confermare.");
      } catch(err) {
          toast.error("Errore caricamento logo.");
          console.error(err);
      } finally { setUploadingLogo(false); }
  };

  const handleSaveSettings = async () => {
      try {
          await updateEventSettings({ name: venueName, logo_url: venueLogo });
          toast.success("Impostazioni salvate");
      } catch (e) { toast.error("Errore salvataggio: " + e.message); }
  };

  const searchYouTube = async (manualQuery = null) => {
    const q = manualQuery || youtubeSearchQuery;
    if (!q.trim()) return;
    setSearchingYoutube(true);
    try {
      const apiKey = process.env.REACT_APP_YOUTUBE_API_KEY; 
      const response = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(q)}&type=video&maxResults=5&key=${apiKey}`);
      const data = await response.json();
      setYoutubeSearchResults(data.items || []);
    } catch (error) { toast.error("Errore ricerca YT."); } finally { setSearchingYoutube(false); }
  };

  const startPerformance = async () => {
    if (!selectedRequest || !youtubeUrl) return toast.error("Manca URL");
    try {
        const { data: newPerf } = await api.startPerformance(selectedRequest.id, youtubeUrl);
        setCurrentPerformance(newPerf); setShowYoutubeModal(false); toast.success("Karaoke Avviato!"); loadData();
    } catch(e) { toast.error(e.message); }
  };

  const ctrlPerf = async (action) => {
      if(!currentPerformance) return;
      try {
        if(action==='pause') await api.pausePerformance(currentPerformance.id);
        if(action==='resume') await api.resumePerformance(currentPerformance.id);
        if(action==='restart') await api.restartPerformance(currentPerformance.id);
        if(action==='end_vote') await api.endPerformance(currentPerformance.id);
        if(action==='skip_next') { if(window.confirm("Chiudere senza voto?")) { await api.stopAndNext(currentPerformance.id); toast.info("Chiuso senza voto"); } }
        if(action==='close_vote') { await api.closeVoting(currentPerformance.id); toast.success("Votazione conclusa!"); }
        loadData();
      } catch(e) { toast.error("Errore comando: " + e.message); }
  };

  const deleteRequest = async (id) => {
      if(!confirm("Eliminare definitivamente dalla scaletta?")) return;
      try { await api.deleteRequest(id); toast.success("Cancellato"); loadData(); } catch(e) { toast.error("Errore cancellazione"); }
  };

  const openManualVideoWindow = () => {
      const urlToOpen = currentPerformance?.youtube_url || youtubeUrl;
      if (urlToOpen) window.open(urlToOpen, '_blank');
      else toast.error("Nessun video attivo");
  };

  const handleSendMessage = async () => {
      if(!adminMessage) return;
      await api.sendMessage({ text: adminMessage });
      setShowMessageModal(false); 
      setAdminMessage("");
      toast.success("Messaggio Inviato");
  };

  const launchCustomQuiz = async () => {
      try {
          await api.startQuiz({
              category: quizCategory, 
              question: quizQuestion, 
              options: quizOptions, 
              correct_index: quizCorrectIndex, 
              points: 10,
              media_url: quizMediaUrl || null,
              media_type: quizMediaType
          });
          setShowCustomQuizModal(false); toast.success("Quiz Custom Lanciato!"); loadData();
      } catch(e) { toast.error("Errore quiz custom: " + e.message); }
  };

  const launchCatalogQuiz = async (item) => {
      if(window.confirm(`Lanciare: ${item.question}?`)) {
          await api.setEventModule('quiz', item.id);
          toast.success("Quiz Lanciato!");
          loadData();
      }
  };

  const handleDeleteQuestion = async (e, item) => {
      e.stopPropagation();
      if(!confirm(`Sei sicuro di voler eliminare dal catalogo: "${item.question}"?`)) return;
      try {
          await api.deleteQuizQuestion(item.id);
          toast.success("Domanda rimossa dal catalogo.");
          loadData();
      } catch(err) {
          toast.error("Errore eliminazione: " + err.message);
      }
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

  const handleImportScript = async () => {
      if(!importText) return;
      try {
          const res = await api.importQuizCatalog(importText);
          toast.success(`${res.count} Quiz importati con successo!`);
          setShowImportModal(false);
          setImportText("");
          loadData();
      } catch(e) {
          toast.error(e.message);
      }
  };

  const MUSIC_CATEGORIES = [
    { id: 'all', label: 'Tutti' },
    { id: 'intro', label: 'Intro' },
    { id: 'lyrics', label: 'Testi' },
    { id: 'video', label: 'Videoclip' },
    { id: 'cover', label: 'Cover' },
    { id: 'anno', label: 'Anno' },
    { id: 'artista', label: 'Artista' },
  ];

  const filteredCatalog = quizCatalog.filter(item => {
      if (quizCategoryFilter === 'all') return true;
      const cat = (item.category || '').toLowerCase();
      if (quizCategoryFilter === 'intro' && (cat.includes('intro') || cat.includes('indovina') || item.media_type === 'audio')) return true;
      if (quizCategoryFilter === 'video' && (cat.includes('video') || cat.includes('clip') || cat.includes('cinema') || item.media_type === 'video')) return true;
      if (quizCategoryFilter === 'lyrics' && (cat.includes('testo') || cat.includes('lyrics') || cat.includes('parole'))) return true;
      if (quizCategoryFilter === 'cover' && (cat.includes('cover') || cat.includes('originale'))) return true;
      if (quizCategoryFilter === 'anno' && (cat.includes('anno') || cat.includes('decade') || cat.includes('epoca'))) return true;
      if (quizCategoryFilter === 'artista' && (cat.includes('artista') || cat.includes('cantante') || cat.includes('band') || cat.includes('chi'))) return true;
      return false;
  });

  if (appState === 'loading') return <div className="bg-black h-screen text-white flex items-center justify-center">Caricamento...</div>;

  // --- VIEW: SUPER ADMIN ---
  if (appState === 'super_admin') {
      return (
        <div className="h-screen bg-zinc-950 text-white flex flex-col p-8 overflow-auto">
            <header className="flex justify-between items-center mb-8 border-b border-zinc-800 pb-4">
                <h1 className="text-3xl font-bold text-fuchsia-500">SUPER ADMIN DASHBOARD</h1>
                <Button variant="ghost" onClick={handleLogout}><LogOut className="w-4 h-4 mr-2"/> Esci</Button>
            </header>
            <div className="mb-6"><Button onClick={()=>setShowCreateUserModal(true)} className="bg-green-600"><UserPlus className="w-4 h-4 mr-2"/> Nuovo Operatore</Button></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {userList.map(user => (
                    <Card key={user.id} className={`border-zinc-800 ${!user.is_active ? 'bg-red-950/20 opacity-70' : 'bg-zinc-900'}`}>
                        <CardHeader className="flex flex-row justify-between items-start">
                            <CardTitle className="text-white text-sm truncate w-2/3">{user.email}</CardTitle>
                            <span className={`text-[10px] uppercase px-2 py-1 rounded ${user.role==='super_admin'?'bg-fuchsia-900 text-fuchsia-300':'bg-zinc-800 text-zinc-400'}`}>{user.role}</span>
                        </CardHeader>
                        <CardContent>
                            <div className="flex justify-between items-center mb-4">
                                <span className="text-zinc-500">Crediti:</span>
                                <span className="text-2xl font-bold text-yellow-500">{user.credits || 0}</span>
                            </div>
                            <div className="flex gap-2 mb-4">
                                <Button size="sm" onClick={()=>addCredits(user.id, 1)} className="flex-1 bg-zinc-800 border border-white/10">+1</Button>
                                <Button size="sm" onClick={()=>addCredits(user.id, 10)} className="flex-1 bg-yellow-600 text-black font-bold">+10</Button>
                            </div>
                            <div className="border-t border-white/10 pt-4 flex justify-between items-center">
                                <span className="text-xs text-zinc-500">Stato: {user.is_active ? 'Attivo' : 'Disabilitato'}</span>
                                {user.role !== 'super_admin' && (
                                    <Button size="sm" variant={user.is_active ? "destructive" : "secondary"} onClick={() => toggleUserStatus(user.id, user.is_active)}>
                                        {user.is_active ? <Ban className="w-4 h-4" /> : <Check className="w-4 h-4"/>}
                                    </Button>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
            
            {/* MODALE CREAZIONE USER */}
            <Dialog open={showCreateUserModal} onOpenChange={setShowCreateUserModal}>
                <DialogContent className="bg-zinc-900 border-zinc-800">
                    <DialogHeader><DialogTitle>Crea Operatore</DialogTitle></DialogHeader>
                    <div className="space-y-4 pt-4">
                        <Input placeholder="Email Utente" value={newUserEmail} onChange={e=>setNewUserEmail(e.target.value)} className="bg-zinc-800"/>
                        <Input placeholder="Password Generata" value={newUserPassword} onChange={e=>setNewUserPassword(e.target.value)} className="bg-zinc-800"/>
                        <Input placeholder="Nome (Opzionale)" value={newUserName} onChange={e=>setNewUserName(e.target.value)} className="bg-zinc-800"/>
                        <p className="text-xs text-zinc-500">Fornisci queste credenziali all'operatore.</p>
                        <Button className="w-full bg-green-600 font-bold" onClick={handleCreateOperator}>Crea Account</Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
      );
  }

  // --- VIEW: SETUP (OPERATOR) ---
  if (appState === 'setup') {
      return (
        <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-8">
                
                {/* COLONNA 1: NUOVO EVENTO */}
                <Card className="bg-zinc-900 border-zinc-800 border-2 border-fuchsia-900/50 shadow-2xl">
                    <CardHeader>
                        <CardTitle className="text-center text-white flex items-center justify-center gap-2">
                            <Plus className="w-5 h-5 text-fuchsia-500"/> NUOVO EVENTO
                        </CardTitle>
                        <div className="text-center text-yellow-500 text-sm font-bold border border-yellow-900/50 bg-yellow-900/10 p-2 rounded mt-2">
                            DISPONIBILI: {profile?.credits || 0} CREDITI
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-xs text-zinc-400 text-center">Ogni nuovo evento costa 1 Credito e dura 8 ore.</p>
                        <Input placeholder="Nome Serata (es. Venerdì Karaoke)" value={newEventName} onChange={e=>setNewEventName(e.target.value)} className="bg-zinc-950 text-center h-12" />
                        <Button onClick={handleStartEvent} disabled={creatingEvent || (profile?.credits || 0) < 1} className="w-full bg-fuchsia-600 h-14 text-lg font-bold hover:bg-fuchsia-500">
                            {creatingEvent ? "Creazione..." : "LANCIA (-1 Credit)"}
                        </Button>
                    </CardContent>
                    <CardFooter className="justify-center border-t border-white/5 pt-4">
                         <Button variant="ghost" onClick={handleLogout} className="text-zinc-500">Esci</Button>
                    </CardFooter>
                </Card>

                {/* COLONNA 2: EVENTI ATTIVI */}
                <Card className="bg-zinc-900 border-zinc-800">
                    <CardHeader>
                        <CardTitle className="text-center text-white flex items-center justify-center gap-2">
                            <Clock className="w-5 h-5 text-cyan-500"/> I TUOI EVENTI ATTIVI
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {activeEventsList.length === 0 ? (
                            <div className="text-center py-8 text-zinc-600">
                                <p>Nessun evento attivo.</p>
                                <p className="text-xs mt-2">Crea un nuovo evento per iniziare.</p>
                            </div>
                        ) : (
                            <ScrollArea className="h-64 pr-2">
                                <div className="space-y-3">
                                    {activeEventsList.map(evt => {
                                        const expires = new Date(evt.expires_at);
                                        const now = new Date();
                                        const diff = expires - now;
                                        const hours = Math.floor(diff / (1000 * 60 * 60));
                                        
                                        return (
                                            <div key={evt.id} className="p-3 bg-zinc-800 rounded border border-zinc-700 flex justify-between items-center group hover:border-cyan-500 transition-all cursor-pointer" onClick={() => handleResumeEvent(evt.code)}>
                                                <div>
                                                    <div className="font-bold text-white">{evt.name}</div>
                                                    <div className="text-xs text-cyan-400 font-mono">CODE: {evt.code}</div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-xs text-zinc-400">Scade in:</div>
                                                    <div className="font-bold text-yellow-500">{hours}h</div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </ScrollArea>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
      );
  }

  // --- VIEW: DASHBOARD (MAIN) ---
  const pendingReqs = queue.filter(r => r.status === 'pending');
  const queuedReqs = queue.filter(r => r.status === 'queued');

  return (
    <div className="h-screen bg-[#050505] text-white flex flex-col overflow-hidden">
      
      <header className="h-14 border-b border-white/10 flex items-center justify-between px-4 bg-zinc-900">
         <div className="flex items-center gap-4">
            <h1 className="font-bold text-lg text-fuchsia-400">NEONPUB OS</h1>
            <div className="flex flex-col items-start">
                <span className="text-xs px-2 py-0.5 bg-zinc-800 rounded font-mono text-zinc-400">{pubCode}</span>
                {timeRemaining && <span className="text-[10px] text-yellow-600 flex items-center gap-1 mt-0.5"><Clock className="w-3 h-3"/> {timeRemaining}</span>}
            </div>
         </div>
         <div className="flex items-center gap-4">
             <div className="text-yellow-500 font-bold text-sm flex gap-2 items-center bg-yellow-900/10 px-3 py-1 rounded-full border border-yellow-900/30">
                 <Gem className="w-4 h-4"/>{profile?.credits || 0}
             </div>
             <Button variant="outline" size="sm" onClick={handleOpenDisplay} className="bg-cyan-900/20 text-cyan-400 border-cyan-800"><Tv className="w-4 h-4 mr-2" /> DISPLAY</Button>
             <Button variant="ghost" size="sm" onClick={() => { if(confirm("Tornare al menu eventi?")) { localStorage.removeItem("neonpub_pub_code"); setPubCode(null); setAppState("setup"); loadActiveEvents(); } }}><LogOut className="w-4 h-4" /></Button>
         </div>
      </header>

      <div className="flex-1 grid grid-cols-12 gap-0 overflow-hidden">
         {/* SIDEBAR */}
         <aside className="col-span-4 border-r border-white/10 bg-zinc-900/50 flex flex-col">
            <div className="p-2 border-b border-white/5">
               <Tabs value={libraryTab} onValueChange={setLibraryTab} className="w-full">
                  <TabsList className="grid w-full grid-cols-5 bg-zinc-950 p-1">
                     <TabsTrigger value="karaoke" className="text-xs px-1"><ListMusic className="w-3 h-3" /></TabsTrigger>
                     <TabsTrigger value="quiz" className="text-xs px-1"><BrainCircuit className="w-3 h-3" /></TabsTrigger>
                     <TabsTrigger value="challenges" className="text-xs px-1"><Swords className="w-3 h-3" /></TabsTrigger>
                     <TabsTrigger value="messages" className="text-xs px-1 relative">
                        <MessageSquare className="w-3 h-3" />
                        {pendingMessages.length > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>}
                     </TabsTrigger>
                     <TabsTrigger value="settings" className="text-xs px-1"><Settings className="w-3 h-3" /></TabsTrigger>
                  </TabsList>
               </Tabs>
            </div>
            
            <ScrollArea className="flex-1 p-3">
               {libraryTab === 'karaoke' && (
                  <div className="space-y-4">
                     {pendingReqs.length > 0 && (
                        <div className="space-y-2">
                            <h3 className="text-xs font-bold text-yellow-500 uppercase">Da Approvare ({pendingReqs.length})</h3>
                            {pendingReqs.map(req => (
                                <div key={req.id} className="p-2 bg-yellow-900/10 border border-yellow-900/30 rounded flex justify-between items-center">
                                    <div className="truncate w-2/3"><div className="font-bold text-sm truncate">{req.title}</div><div className="text-xs text-zinc-400">{req.user_nickname}</div></div>
                                    <div className="flex gap-1">
                                        <Button size="icon" variant="ghost" className="h-6 w-6 text-green-500" onClick={()=>api.approveRequest(req.id)}><Check className="w-4 h-4"/></Button>
                                        <Button size="icon" variant="ghost" className="h-6 w-6 text-red-500" onClick={()=>api.rejectRequest(req.id)}><X className="w-4 h-4"/></Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                     )}
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
                              <div className="flex gap-2">
                                  <Button size="icon" variant="ghost" className="h-7 w-7 text-zinc-500 hover:text-red-500 hover:bg-red-900/20" onClick={() => deleteRequest(req.id)}><Trash2 className="w-3 h-3" /></Button>
                                  <Button size="sm" className="bg-fuchsia-600 h-7" onClick={() => { 
                                      setSelectedRequest(req); setYoutubeSearchResults([]); setYoutubeUrl(req.youtube_url || ""); setShowYoutubeModal(true);
                                      if(!req.youtube_url) setTimeout(() => searchYouTube(`${req.title} ${req.artist} karaoke`), 100);
                                  }}><Play className="w-3 h-3 mr-1" /> LIVE</Button>
                              </div>
                           </div>
                        ))}
                     </div>
                  </div>
               )}

               {libraryTab === 'quiz' && (
                    <div className="flex flex-col h-full">
                        <div className="grid grid-cols-2 gap-2 mb-4">
                            <Button className="bg-zinc-800 hover:bg-zinc-700 border border-white/10 text-xs" onClick={()=>setShowCustomQuizModal(true)}>
                                <Plus className="w-3 h-3 mr-1"/> Crea Manuale
                            </Button>
                            <Button className="bg-blue-600 hover:bg-blue-500 text-xs" onClick={()=>setShowImportModal(true)}>
                                <Download className="w-3 h-3 mr-1"/> Importa JSON
                            </Button>
                        </div>

                        {activeQuizId && quizStatus !== 'ended' ? (
                            <Card className="bg-zinc-900 border-2 border-fuchsia-600 mb-6 shadow-2xl shadow-fuchsia-900/20">
                                <CardHeader className="pb-2 border-b border-white/10 bg-fuchsia-900/20">
                                    <CardTitle className="text-sm font-bold text-white flex justify-between items-center">
                                        <span className="flex items-center gap-2">
                                            <Gamepad2 className="w-4 h-4 text-fuchsia-400"/> IN ONDA
                                        </span>
                                        <span className="text-xs font-mono px-2 py-1 bg-black rounded text-fuchsia-300">
                                            STATUS: {quizStatus?.toUpperCase()}
                                        </span>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="pt-4 space-y-4">
                                    <div className="text-center">
                                        <div className="text-xs text-zinc-400 uppercase tracking-widest mb-1">Domanda Attuale</div>
                                        <div className="font-bold text-lg leading-tight text-white mb-2">
                                            {activeQuizData?.question || "Caricamento..."}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 gap-2">
                                        {quizStatus === 'active' && (
                                            <Button className="w-full bg-red-600 hover:bg-red-500 h-10 font-bold animate-pulse" 
                                                onClick={() => ctrlQuiz('close_vote')}>
                                                <StopCircle className="w-4 h-4 mr-2"/> STOP AL TELEVOTO
                                            </Button>
                                        )}
                                        
                                        {quizStatus === 'closed' && (
                                            <div className="grid grid-cols-1 gap-2">
                                                <Button className="bg-blue-600 hover:bg-blue-500" onClick={() => ctrlQuiz('show_results')}>
                                                    <Eye className="w-4 h-4 mr-2"/> MOSTRA RISPOSTA
                                                </Button>
                                            </div>
                                        )}

                                        {(quizStatus === 'showing_results' || quizStatus === 'leaderboard') && (
                                            <div className="grid grid-cols-1 gap-2">
                                                {quizStatus !== 'leaderboard' && (
                                                    <Button className="bg-yellow-600 hover:bg-yellow-500 text-black font-bold" 
                                                        onClick={() => ctrlQuiz('leaderboard')}>
                                                        <ListOrdered className="w-4 h-4 mr-2"/> MOSTRA CLASSIFICA
                                                    </Button>
                                                )}
                                                <Button variant="destructive" onClick={() => ctrlQuiz('end')}>
                                                    <MonitorPlay className="w-4 h-4 mr-2"/> CHIUDI E TORNA AL KARAOKE
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        ) : (
                            <div className="p-4 bg-zinc-900/50 border border-dashed border-zinc-700 rounded mb-4 text-center text-zinc-500 text-xs">
                                NESSUN QUIZ ATTIVO. SELEZIONA DAL CATALOGO.
                            </div>
                        )}

                        <div className="flex flex-wrap gap-1 mb-2 bg-zinc-950 p-1 rounded">
                            {MUSIC_CATEGORIES.map(cat => (
                                <Button key={cat.id} size="sm" variant={quizCategoryFilter===cat.id?'secondary':'ghost'} className="text-[10px] h-6 px-2" onClick={()=>setQuizCategoryFilter(cat.id)}>{cat.label}</Button>
                            ))}
                        </div>

                        <div className="flex-1 overflow-hidden flex flex-col">
                            <h3 className="text-xs font-bold text-zinc-500 uppercase mb-2 flex justify-between items-center">
                                Catalogo ({filteredCatalog.length})
                            </h3>
                            
                            <ScrollArea className="flex-1 pr-2">
                                <div className="space-y-2 pb-20">
                                    {filteredCatalog.map((item, index) => (
                                        <div key={item.id || index} 
                                            className="group relative bg-zinc-800 hover:bg-zinc-700 border border-transparent hover:border-yellow-500 rounded p-3 cursor-pointer transition-all"
                                            onClick={() => launchCatalogQuiz(item)}>
                                            <div className="absolute top-2 right-2 flex gap-1 z-10">
                                                {item.media_type === 'audio' && <span className="bg-yellow-500/20 text-yellow-500 p-1 rounded"><Music2 className="w-3 h-3"/></span>}
                                                {item.media_type === 'video' && <span className="bg-blue-500/20 text-blue-500 p-1 rounded"><Film className="w-3 h-3"/></span>}
                                                <Button size="icon" variant="ghost" className="h-6 w-6 bg-red-900/50 hover:bg-red-600 text-white rounded-full ml-1" onClick={(e) => handleDeleteQuestion(e, item)}><Trash2 className="w-3 h-3" /></Button>
                                            </div>
                                            <div className="text-[10px] font-bold text-fuchsia-500 uppercase tracking-wider mb-1 flex items-center gap-1">{item.category}</div>
                                            <div className="text-sm font-medium text-white pr-6 line-clamp-2">{item.question}</div>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        </div>
                    </div>
               )}

               {libraryTab === 'challenges' && (
                   <div className="space-y-3">
                       <h3 className="text-xs font-bold text-zinc-500 uppercase">Catalogo Sfide</h3>
                       {challenges.length === 0 ? <p className="text-xs text-zinc-600">Nessuna sfida.</p> : challenges.map(c => (
                           <div key={c.id} className="p-3 bg-zinc-800 rounded flex flex-col gap-1 hover:bg-zinc-700 cursor-pointer border-l-2 border-red-500" onClick={() => toast.info(`Sfida "${c.title}" lanciata! (In arrivo)`)}>
                               <div className="flex justify-between"><span className="font-bold text-sm text-white">{c.title}</span><Swords className="w-3 h-3 text-red-500" /></div>
                               <p className="text-xs text-zinc-400">{c.description}</p>
                           </div>
                       ))}
                   </div>
               )}

               {libraryTab === 'messages' && (
                   <div className="space-y-4 pt-2">
                       <Button className="w-full bg-cyan-600 hover:bg-cyan-500 mb-4" onClick={()=>setShowMessageModal(true)}><MessageSquare className="w-4 h-4 mr-2"/> Scrivi Messaggio Regia</Button>
                       
                       <h3 className="text-xs font-bold text-zinc-500 uppercase">In Attesa ({pendingMessages.length})</h3>
                       {pendingMessages.map(msg => (
                           <div key={msg.id} className="bg-zinc-800 p-3 rounded border-l-2 border-blue-500">
                               <div className="flex justify-between mb-2"><span className="font-bold text-sm">{msg.user_nickname || 'Anonimo'}</span><span className="text-xs text-zinc-500">App: {msg.participant_id ? 'Utente' : 'Regia'}</span></div>
                               <p className="text-sm bg-black/20 p-2 rounded mb-2">{msg.text}</p>
                               <div className="flex gap-2 justify-end"><Button size="sm" variant="ghost" className="text-red-500 hover:bg-red-900/20 h-7" onClick={async()=>{await api.rejectMessage(msg.id); loadData();}}>Rifiuta</Button><Button size="sm" className="bg-green-600 h-7 hover:bg-green-500" onClick={async()=>{await api.approveMessage(msg.id); loadData();}}>Approva</Button></div>
                           </div>
                       ))}
                       
                       <h3 className="text-xs font-bold text-green-500 uppercase mt-6">Approvati (Display)</h3>
                       {approvedMessages && approvedMessages.length > 0 ? approvedMessages.map(msg => (
                           <div key={msg.id} className="bg-zinc-800 p-3 rounded border-l-2 border-green-500 flex items-start justify-between gap-3">
                               <div className="flex-1">
                                   <div className="flex gap-2 mb-1"><span className="font-bold text-sm text-green-400">{msg.user_nickname || 'Regia'}</span></div>
                                   <p className="text-sm bg-black/20 p-2 rounded">{msg.text}</p>
                               </div>
                               <Button size="sm" variant="ghost" className="text-red-500 hover:bg-red-900/20 shrink-0" onClick={async()=>{await supabase.from('messages').delete().eq('id', msg.id); toast.success("Eliminato"); loadData();}}><Trash2 className="w-4 h-4"/></Button>
                           </div>
                       )) : <p className="text-xs text-zinc-600 italic">Nessun messaggio approvato</p>}
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

         {/* MAIN CONTENT */}
         <main className="col-span-8 bg-black relative flex flex-col">
            <div className="h-10 border-b border-white/10 flex items-center px-4 justify-between bg-zinc-950">
               <span className="text-xs font-mono text-zinc-500">PROGRAMMA LIVE</span>
               <Button size="sm" variant="ghost" onClick={handleToggleMute} className={isMuted?'text-red-500':'text-zinc-400'}>{isMuted ? <VolumeX className="w-4 h-4"/> : <Volume2 className="w-4 h-4"/>}</Button>
            </div>
            <div className="flex-1 p-6 flex items-center justify-center bg-gradient-to-b from-zinc-900 to-black">
               {eventState.active_module === 'karaoke' && (
                  <div className="w-full max-w-3xl text-center">
                     {!currentPerformance ? (
                        <div className="text-zinc-600 flex flex-col items-center opacity-50"><ListMusic className="w-24 h-24 mb-4" /><h2 className="text-2xl font-bold">In Attesa...</h2></div>
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
                                       <Button size="lg" variant="outline" className="h-16 w-16 rounded-full border-blue-500 text-blue-500 hover:bg-blue-900/20" onClick={openManualVideoWindow}><ExternalLink className="w-6 h-6" /></Button>
                                       <div className="flex gap-2 ml-4"><Button size="lg" variant="destructive" className="h-16 px-6" onClick={()=>ctrlPerf('end_vote')}>STOP & VOTA</Button><Button size="lg" className="h-16 px-4 bg-zinc-700" onClick={()=>ctrlPerf('skip_next')}>SKIP</Button></div>
                               </div></div>
                           )}
                        </div>
                     )}
                  </div>
               )}
            </div>
         </main>
      </div>

      {/* MODALS */}
      <Dialog open={showMessageModal} onOpenChange={setShowMessageModal}>
          <DialogContent className="bg-zinc-900 border-zinc-800"><DialogHeader><DialogTitle>Messaggio Regia</DialogTitle></DialogHeader><div className="space-y-4 pt-4"><Textarea value={adminMessage} onChange={e=>setAdminMessage(e.target.value)} placeholder="Scrivi avviso..." className="bg-zinc-800 border-zinc-700 h-32"/><Button className="w-full bg-cyan-600 font-bold" onClick={handleSendMessage}><Send className="w-4 h-4 mr-2"/> INVIA AGLI SCHERMI</Button></div></DialogContent>
      </Dialog>
      
      <Dialog open={showYoutubeModal} onOpenChange={setShowYoutubeModal}>
        <DialogContent className="bg-zinc-900 border-zinc-800 max-w-3xl">
          <DialogHeader><DialogTitle>Video per: {selectedRequest?.title}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-4"><div className="flex gap-2"><Input value={youtubeSearchQuery} onChange={e=>setYoutubeSearchQuery(e.target.value)} className="bg-zinc-800 border-zinc-700" placeholder="Cerca su YouTube..." onKeyDown={e=>e.key==='Enter'&&searchYouTube(youtubeSearchQuery)}/><Button onClick={() => searchYouTube(youtubeSearchQuery)} disabled={searchingYoutube} className="bg-zinc-700">{searchingYoutube?'...':'Cerca'}</Button></div>
              <div className="max-h-60 overflow-y-auto space-y-2 custom-scrollbar">{youtubeSearchResults.map(vid => (<div key={vid.id.videoId} className="flex gap-3 p-2 hover:bg-white/5 cursor-pointer rounded transition" onClick={()=>{setYoutubeUrl(`https://www.youtube.com/watch?v=${vid.id.videoId}`); setYoutubeSearchResults([]);}}><img src={vid.snippet.thumbnails.default.url} className="w-24 h-16 object-cover rounded" alt="thumb"/><div className="flex-1"><div className="font-bold text-sm text-white">{vid.snippet.title}</div><div className="text-xs text-zinc-500">{vid.snippet.channelTitle}</div></div><Button size="sm" variant="ghost" className="text-fuchsia-500">Seleziona</Button></div>))}</div>
              <div className="pt-4 border-t border-white/10"><p className="text-xs text-zinc-500 mb-2">URL:</p><Input value={youtubeUrl} onChange={e=>setYoutubeUrl(e.target.value)} className="bg-zinc-950 border-zinc-800 font-mono text-xs mb-4"/><Button className="w-full bg-green-600 h-12 text-lg font-bold" disabled={!youtubeUrl} onClick={startPerformance}><Play className="w-5 h-5 mr-2"/> MANDA IN ONDA</Button></div></div>
        </DialogContent>
      </Dialog>

      <Dialog open={showCustomQuizModal} onOpenChange={setShowCustomQuizModal}>
          <DialogContent className="bg-zinc-900 border-zinc-800 max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Crea Quiz Musicale</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-4">
                  <div>
                      <label className="text-xs text-zinc-500 mb-1">Categoria</label>
                      <Select value={quizCategory} onValueChange={setQuizCategory}>
                          <SelectTrigger className="bg-zinc-800 border-zinc-700"><SelectValue /></SelectTrigger>
                          <SelectContent className="bg-zinc-800 border-zinc-700">
                              <SelectItem value="Indovina Intro">Indovina l'Intro</SelectItem>
                              <SelectItem value="Indovina Videoclip">Indovina il Videoclip</SelectItem>
                              <SelectItem value="Completa il Testo">Completa il Testo</SelectItem>
                              <SelectItem value="Chi Canta?">Chi Canta?</SelectItem>
                              <SelectItem value="Indovina l'Anno">Indovina l'Anno</SelectItem>
                              <SelectItem value="Cover o Originale?">Cover o Originale?</SelectItem>
                              <SelectItem value="Musica Generale">Musica Generale</SelectItem>
                          </SelectContent>
                      </Select>
                  </div>
                  <div>
                      <label className="text-xs text-zinc-500 mb-1">Domanda</label>
                      <Textarea value={quizQuestion} onChange={e=>setQuizQuestion(e.target.value)} className="bg-zinc-800 border-zinc-700"/>
                  </div>
                  <div>
                      <label className="text-xs text-zinc-500 mb-1">Media (Opzionale)</label>
                      <div className="flex gap-2 mb-2">
                           <Select value={quizMediaType} onValueChange={setQuizMediaType}>
                               <SelectTrigger className="w-[120px] bg-zinc-800 border-zinc-700"><SelectValue /></SelectTrigger>
                               <SelectContent className="bg-zinc-800 border-zinc-700">
                                   <SelectItem value="text">Nessuno</SelectItem>
                                   <SelectItem value="audio">Audio (MP3)</SelectItem>
                                   <SelectItem value="video">Video (YT/MP4)</SelectItem>
                               </SelectContent>
                           </Select>
                           <Input value={quizMediaUrl} onChange={e=>setQuizMediaUrl(e.target.value)} placeholder="URL Media (YouTube o MP3 Direct Link)" className="bg-zinc-800 border-zinc-700 flex-1"/>
                      </div>
                      <p className="text-[10px] text-zinc-500">Per YouTube, usa il link normale. Per MP3, un link diretto al file.</p>
                  </div>
                  <div className="space-y-2">
                      <label className="text-xs text-zinc-500 mb-1">Opzioni</label>
                      {quizOptions.map((opt, i) => (
                          <div key={i} className="flex gap-2">
                              <Input value={opt} onChange={e=>{const n=[...quizOptions]; n[i]=e.target.value; setQuizOptions(n)}} className="bg-zinc-800 border-zinc-700"/>
                              <Button size="icon" variant={quizCorrectIndex===i?'default':'outline'} className={quizCorrectIndex===i?'bg-green-600 border-none':''} onClick={()=>setQuizCorrectIndex(i)}><Check className="w-4 h-4"/></Button>
                          </div>
                      ))}
                  </div>
                  <Button className="w-full bg-fuchsia-600 mt-4 h-12 text-lg font-bold" onClick={launchCustomQuiz}>LANCIA QUIZ</Button>
              </div>
          </DialogContent>
      </Dialog>

      <Dialog open={showImportModal} onOpenChange={setShowImportModal}>
          <DialogContent className="bg-zinc-900 border-zinc-800 max-w-2xl">
              <DialogHeader><DialogTitle>Importa Script JSON</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-4">
                  <p className="text-xs text-zinc-500">Formato: {`[ { "category": "Indovina Intro", "question": "...", "options": ["A","B","C","D"], "correct_index": 0, "media_url": "https://youtube...", "media_type": "audio" } ]`}</p>
                  <p className="text-[10px] text-zinc-600">Categorie: Indovina Intro, Indovina Videoclip, Completa il Testo, Chi Canta?, Indovina l'Anno, Cover o Originale?, Musica Generale</p>
                  <Textarea value={importText} onChange={e=>setImportText(e.target.value)} placeholder='Incolla JSON qui...' className="bg-zinc-950 border-zinc-700 font-mono text-xs h-64"/>
                  <Button className="w-full bg-blue-600 font-bold" onClick={handleImportScript}><Download className="w-4 h-4 mr-2"/> IMPORTA NEL CATALOGO</Button>
              </div>
          </DialogContent>
      </Dialog>
    </div>
  );
}