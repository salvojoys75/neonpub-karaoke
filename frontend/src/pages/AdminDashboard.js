import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Music, Play, Square, Trophy, Tv, Star, HelpCircle,
  Check, X, MessageSquare, LogOut, SkipForward, Pause,
  RotateCcw, Mic2, Search, Send, Coins, Users, Plus, ArrowLeft,
  Swords, Film // Nuovi icon per sfide e media
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase"; // Aggiunto per gestione crediti
import api, { createPub } from "@/lib/api"; // Aggiunto createPub

// Importa cataloghi (nuovi)
import quizText from '@/data/quiz_text.json';
import quizAudio from '@/data/quiz_audio.json';
import quizVideo from '@/data/quiz_video.json';
import challenges from '@/data/challenges.json';

const QUIZ_CATEGORIES = [
  { id: "music_general", name: "Musica Generale" },
  { id: "rock", name: "Rock" },
  { id: "pop", name: "Pop" },
  { id: "rap", name: "Rap/Hip-Hop" },
  { id: "italian", name: "Musica Italiana" },
  { id: "80s", name: "Anni '80" },
  { id: "90s", name: "Anni '90" },
  { id: "2000s", name: "Anni 2000" },
];

// Nuovi tipi modulo
const MODULE_TYPES = {
  KARAOKE: 'karaoke',
  QUIZ: 'quiz',
  CHALLENGE: 'challenge',
  MEDIA: 'media',
  LEADERBOARD: 'leaderboard'
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { isAuthenticated, logout, user } = useAuth(); // Ho rimosso isAdmin da qui perché lo gestiamo col DB
 
  // --- NUOVI STATI PER GESTIONE CREDITI E RUOLI ---
  const [appState, setAppState] = useState("loading"); // 'loading', 'super_admin', 'setup', 'dashboard'
  const [profile, setProfile] = useState(null);
  
  // Stati Super Admin
  const [operators, setOperators] = useState([]);
  const [newOperatorEmail, setNewOperatorEmail] = useState("");
  const [newOperatorPassword, setNewOperatorPassword] = useState("");
  
  // Stati Setup Evento
  const [newEventName, setNewEventName] = useState("");
  const [creatingEvent, setCreatingEvent] = useState(false);
  // ------------------------------------------------

  // --- STATI TUA DASHBOARD ORIGINALE ---
  const [queue, setQueue] = useState([]);
  const [currentPerformance, setCurrentPerformance] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [activeSection, setActiveSection] = useState("queue");
  const [pendingMessages, setPendingMessages] = useState([]);
  
  // Quiz
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [quizTab, setQuizTab] = useState("custom");
  const [quizCategory, setQuizCategory] = useState("music_general");
  const [quizQuestion, setQuizQuestion] = useState("");
  const [quizOptions, setQuizOptions] = useState(["", "", "", ""]);
  const [quizCorrectIndex, setQuizCorrectIndex] = useState(0);
  const [activeQuizId, setActiveQuizId] = useState(null);
  const [quizResults, setQuizResults] = useState(null);
  const [quizStatus, setQuizStatus] = useState(null);
  
  // YouTube
  const [showYoutubeModal, setShowYoutubeModal] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [youtubeSearchQuery, setYoutubeSearchQuery] = useState("");
  const [youtubeSearchResults, setYoutubeSearchResults] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [searchingYoutube, setSearchingYoutube] = useState(false);
  
  // Messaggi Regia
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [adminMessage, setAdminMessage] = useState("");

  const [pubCode, setPubCode] = useState(localStorage.getItem("neonpub_pub_code"));
  const pollIntervalRef = useRef(null);

  // Nuovi stati per moduli
  const [modulesPlaylist, setModulesPlaylist] = useState([]); // Playlist di moduli
  const [activeModule, setActiveModule] = useState(null); // Modulo corrente
  const [selectedCatalogItem, setSelectedCatalogItem] = useState(null); // Item da catalogo
  const [moduleConfig, setModuleConfig] = useState({}); // Config per nuovo modulo (es. points, media)
  const [showModuleModal, setShowModuleModal] = useState(false); // Modal per creare/lanciare modulo
  const [participants, setParticipants] = useState([]); // Lista partecipanti (destra)

  // --- 1. CONTROLLO INIZIALE RUOLO E STATO ---
  useEffect(() => {
    checkUserProfile();
  }, [isAuthenticated]);

  const checkUserProfile = async () => {
    if (!isAuthenticated) return; // Lasciamo gestire il redirect al AuthContext o useEffect sotto
    
    try {
      // 1. Prendi il profilo dal DB (per vedere crediti e ruolo)
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let { data: userProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      // Se non esiste profilo, crealo come operatore standard
      if (!userProfile) {
         const { data: newProfile } = await supabase
            .from('profiles')
            .insert([{ id: user.id, email: user.email, role: 'operator', credits: 0 }])
            .select()
            .single();
         userProfile = newProfile;
      }

      setProfile(userProfile);

      // 2. Decidi cosa mostrare
      if (userProfile.role === 'super_admin') {
        setAppState("super_admin");
        fetchOperators();
      } else {
        // È un operatore
        const storedCode = localStorage.getItem("neonpub_pub_code");
        if (storedCode) {
          setPubCode(storedCode);
          setAppState("dashboard");
          await loadAdminData(); // Carica dati evento
        } else {
          setAppState("setup"); // Deve creare evento
        }
      }
    } catch (error) {
      toast.error("Errore caricamento profilo");
      logout();
    } finally {
      setAppState(prev => prev === "loading" ? "setup" : prev);
    }
  };

  const fetchOperators = async () => {
    const { data } = await supabase.from('profiles').select('id, email, credits, role').eq('role', 'operator');
    setOperators(data || []);
  };

  const handleCreateOperator = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: newOperatorEmail,
        password: newOperatorPassword,
        options: { data: { role: 'operator' } }
      });
      if (error) throw error;

      await supabase.from('profiles').insert([{
        id: data.user.id,
        email: newOperatorEmail,
        role: 'operator',
        credits: 5  // Assegna crediti iniziali
      }]);

      toast.success("Operatore creato!");
      fetchOperators();
      setNewOperatorEmail("");
      setNewOperatorPassword("");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCredits = async (operatorId, credits) => {
    const { data: current } = await supabase.from('profiles').select('credits').eq('id', operatorId).single();
    await supabase.from('profiles').update({ credits: current.credits + credits }).eq('id', operatorId);
    fetchOperators();
    toast.success("Crediti aggiunti!");
  };

  const handleCreateEvent = async () => {
    if (!profile.credits) return toast.error("Nessun gettone disponibile");
    setCreatingEvent(true);
    try {
      const { data: event } = await api.createPub({ name: newEventName });
      localStorage.setItem("neonpub_pub_code", event.code);
      setPubCode(event.code);

      // Deduci credito
      await supabase.from('profiles').update({ credits: profile.credits - 1 }).eq('id', profile.id);
      setProfile(prev => ({ ...prev, credits: prev.credits - 1 }));

      toast.success(`Evento creato! Codice: ${event.code}`);
      setAppState("dashboard");
      await loadAdminData();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setCreatingEvent(false);
    }
  };

  // --- 2. CARICAMENTO DATI ADMIN (INVARIATO) ---
  const loadAdminData = useCallback(async () => {
    if (!pubCode) return;
    try {
      const [queueRes, perfRes, lbRes, msgsRes] = await Promise.all([
        api.getAdminQueue(),
        api.getAdminCurrentPerformance(),
        api.getAdminLeaderboard(),
        api.getAdminPendingMessages()
      ]);
      setQueue(queueRes.data || []);
      setCurrentPerformance(perfRes.data);
      setLeaderboard(lbRes.data || []);
      setPendingMessages(msgsRes.data || []);

      // Quiz attivo admin
      const quiz = await api.getActiveQuiz();
      if (quiz.data) {
        setActiveQuizId(quiz.data.id);
        setQuizStatus(quiz.data.status);
        if (quiz.data.status === 'showing_results' && !quizResults) {
          const res = await api.getQuizResults(quiz.data.id);
          setQuizResults(res.data);
        }
      } else {
        setActiveQuizId(null);
        setQuizStatus(null);
        setQuizResults(null);
      }
    } catch (error) {
      console.error(error);
    }
  }, [pubCode]);

  useEffect(() => {
    if (appState === "dashboard" && pubCode) {
      loadAdminData();
      pollIntervalRef.current = setInterval(loadAdminData, 5000);

      const channel = supabase
        .channel('admin_realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'song_requests', filter: `event_id=eq.${profile.event_id}` }, loadAdminData)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'performances', filter: `event_id=eq.${profile.event_id}` }, loadAdminData)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'participants', filter: `event_id=eq.${profile.event_id}` }, loadAdminData)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `event_id=eq.${profile.event_id}` }, loadAdminData)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'quizzes', filter: `event_id=eq.${profile.event_id}` }, loadAdminData)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'quiz_answers', filter: `event_id=eq.${profile.event_id}` }, loadAdminData)
        .subscribe();

      return () => {
        clearInterval(pollIntervalRef.current);
        supabase.removeChannel(channel);
      };
    }
  }, [appState, pubCode, profile?.event_id, loadAdminData]);

  // Nuovo useEffect per caricare moduli e partecipanti
  useEffect(() => {
    if (appState === "dashboard" && pubCode) {
      loadModules();
      loadParticipants();
      const modulesChannel = supabase
        .channel('modules_realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'modules', filter: `event_id=eq.${profile.event_id}` }, 
          (payload) => loadModules()
        )
        .subscribe();
      return () => supabase.removeChannel(modulesChannel);
    }
  }, [appState, pubCode, profile?.event_id]);

  const loadModules = async () => {
    const { data } = await supabase.from('modules').select('*').eq('event_id', profile.event_id).order('created_at');
    setModulesPlaylist(data || []);
    const active = data.find(m => m.status === 'active');
    setActiveModule(active || null);
  };

  const loadParticipants = async () => {
    const { data } = await supabase.from('participants').select('id, nickname, score').eq('event_id', profile.event_id).order('score', { ascending: false });
    setParticipants(data || []);
  };

  // Funzione per creare/lanciare modulo
  const createModule = async (type) => {
    try {
      const config = { ...moduleConfig, catalog_id: selectedCatalogItem?.id }; // Es. per quiz/challenge
      const { data } = await supabase.from('modules').insert({
        event_id: profile.event_id,
        type,
        status: 'ready',
        config: JSON.stringify(config)
      }).select().single();
      setModulesPlaylist(prev => [...prev, data]);
      toast.success(`Modulo ${type} creato!`);
      setShowModuleModal(false);
    } catch (error) {
      toast.error('Errore creazione modulo');
    }
  };

  // Controlli modulo (start, stop, etc.)
  const startModule = async (moduleId) => {
    await supabase.from('modules').update({ status: 'active' }).eq('id', moduleId);
    loadModules(); // Refresh
    // Integrazione con esistente: se quiz, chiama startQuiz; se karaoke, usa requestSong esistente
    if (activeModule.type === MODULE_TYPES.QUIZ) {
      // Usa logica quiz esistente, ma con config da catalogo (es. play media)
      handleStartQuiz(); // Esistente
    } else if (activeModule.type === MODULE_TYPES.CHALLENGE) {
      // Nuova logica: assegna partecipanti, play media, vota
      // Es. chiama startPerformance con config.song
    }
    // Aggiorna schermo Pub via realtime (esistente)
  };

  const endModule = async (moduleId, pointsToAssign) => {
    await supabase.from('modules').update({ status: 'ended' }).eq('id', moduleId);
    // Assegna punti alla leaderboard unica (integra con esistente)
    if (pointsToAssign) {
      // Es. aggiorna participants.score per vincitori
      await updateScores(pointsToAssign);
    }
    loadModules();
  };

  const updateScores = async (assignments) => {
    // assignments: [{ participant_id: id, points: num }]
    for (const ass of assignments) {
      const { data: p } = await supabase.from('participants').select('score').eq('id', ass.participant_id).single();
      await supabase.from('participants').update({ score: p.score + ass.points }).eq('id', ass.participant_id);
    }
    loadParticipants(); // Refresh destra
    loadAdminData(); // Refresh leaderboard esistente
  };

  // --- 3. FUNZIONI ORIGINALI INVARIATE ---
  const approveSong = async (requestId) => {
    try {
      await api.approveRequest(requestId);
      toast.success("Richiesta approvata!");
      loadAdminData();
    } catch (error) {
      toast.error("Errore approvazione");
    }
  };

  const rejectSong = async (requestId) => {
    try {
      await api.rejectRequest(requestId);
      toast.success("Richiesta respinta");
      loadAdminData();
    } catch (error) {
      toast.error("Errore");
    }
  };

  const startPerformance = async () => {
    if (!selectedRequest || !youtubeUrl.trim()) return;
    try {
      await api.startPerformance({
        request_id: selectedRequest.id,
        youtube_url: youtubeUrl
      });
      toast.success("Esibizione avviata!");
      setShowYoutubeModal(false);
      setYoutubeUrl("");
      setSelectedRequest(null);
      loadAdminData();
    } catch (error) {
      toast.error("Errore avvio esibizione");
    }
  };

  const pausePerformance = async () => {
    try {
      await api.pausePerformance(currentPerformance.id);
      loadAdminData();
    } catch {}
  };

  const resumePerformance = async () => {
    try {
      await api.resumePerformance(currentPerformance.id);
      loadAdminData();
    } catch {}
  };

  const endPerformance = async () => {
    try {
      await api.endPerformance(currentPerformance.id);
      loadAdminData();
    } catch {}
  };

  const skipPerformance = async () => {
    try {
      await api.skipPerformance(currentPerformance.id);
      loadAdminData();
    } catch {}
  };

  const restartPerformance = async () => {
    try {
      await api.restartPerformance(currentPerformance.id);
      loadAdminData();
    } catch {}
  };

  const closeVoting = async () => {
    try {
      await api.closeVoting(currentPerformance.id);
      loadAdminData();
    } catch {}
  };

  const approveMessage = async (msgId) => {
    try {
      await api.approveMessage(msgId);
      toast.success("Messaggio approvato");
      loadAdminData();
    } catch {}
  };

  const rejectMessage = async (msgId) => {
    try {
      await api.rejectMessage(msgId);
      toast.success("Messaggio respinto");
      loadAdminData();
    } catch {}
  };

  const handleBroadcastMessage = async () => {
    if (!adminMessage.trim()) return;
    try {
      await api.sendMessage({ text: adminMessage, from_regia: true });
      toast.success("Messaggio inviato!");
      setAdminMessage("");
      setShowMessageModal(false);
    } catch (error) {
      toast.error("Errore invio");
    }
  };

  const handleStartQuiz = async () => {
    let quizData;
    if (quizTab === 'category' || quizTab === 'custom') {
      // Esistente
      quizData = { question: quizQuestion, options: quizOptions, correct_index: quizCorrectIndex, points: 10 };
    } else {
      // Da catalogo
      const catalog = { text: quizText, audio: quizAudio, video: quizVideo }[quizCategory.split('_')[0]] || [];
      quizData = catalog.find(q => q.id === selectedCatalogItem.id);
    }
    // Crea quiz esistente, ma assegna a modulo
    const res = await api.startQuiz(quizData);
    setActiveQuizId(res.data.id);
    // Se media, play su PubDisplay (integra con YouTube esistente)
    if (quizData.media_url) {
      // Manda evento realtime per play media con effetti (mute, blur)
    }
    setShowQuizModal(false);
    loadAdminData();
  };

  const closeQuizVoting = async () => {
    try {
      await api.closeQuizVoting(activeQuizId);
      loadAdminData();
    } catch {}
  };

  const showQuizResults = async () => {
    try {
      await api.showQuizResults(activeQuizId);
      loadAdminData();
    } catch {}
  };

  const endQuiz = async () => {
    try {
      await api.endQuiz(activeQuizId);
      loadAdminData();
    } catch {}
  };

  const handleYoutubeSearch = async () => {
    if (!youtubeSearchQuery.trim()) return;
    setSearchingYoutube(true);
    try {
      // Placeholder per ricerca YouTube - integra con API reale se disponibile
      // Es. const res = await fetch(`https://youtube.com/search?q=${encodeURIComponent(youtubeSearchQuery)}`);
      // Per ora mock
      setYoutubeSearchResults([
        { id: 'vid1', title: 'Risultato 1', url: 'https://youtube.com/watch?v=vid1' },
        { id: 'vid2', title: 'Risultato 2', url: 'https://youtube.com/watch?v=vid2' }
      ]);
    } catch (error) {
      toast.error("Errore ricerca YouTube");
    } finally {
      setSearchingYoutube(false);
    }
  };

  const selectYoutubeResult = (url) => {
    setYoutubeUrl(url);
  };

  const handleLogout = () => {
    logout();
    localStorage.removeItem("neonpub_pub_code");
    navigate("/");
  };

  // Nuova funzione per sfide
  const handleStartChallenge = async () => {
    const challenge = challenges.find(c => c.id === selectedCatalogItem.id);
    // Assegna partecipanti (seleziona da lista destra)
    const participantsIds = []; // TODO: UI per selezionare da participants
    // Start performance con rules
    const perfRes = await api.startPerformance(/* usa esistente, ma con config */);
    // Votazione pubblica/giuria (usa voting esistente)
  };

  // --- RENDERING (AGGIORNATO CON COLONNE) ---
  if (appState === "loading") {
    return <div className="min-h-screen bg-[#050505] flex items-center justify-center"><div className="spinner"></div></div>;
  }

  if (appState === "super_admin") {
    return (
      <div className="min-h-screen bg-[#050505] text-white p-6">
        <header className="flex justify-between mb-8">
          <h1 className="text-3xl font-bold">Console Super Admin</h1>
          <Button variant="destructive" onClick={handleLogout}>Logout</Button>
        </header>

        <Card className="bg-zinc-900 border-zinc-800 mb-8">
          <CardHeader><CardTitle>Gestione Operatori</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleCreateOperator} className="space-y-4 mb-8">
              <Input value={newOperatorEmail} onChange={(e) => setNewOperatorEmail(e.target.value)} placeholder="Email Operatore" />
              <Input type="password" value={newOperatorPassword} onChange={(e) => setNewOperatorPassword(e.target.value)} placeholder="Password" />
              <Button type="submit" disabled={loading}>Crea Operatore</Button>
            </form>

            <div className="space-y-4">
              {operators.map(op => (
                <div key={op.id} className="flex justify-between items-center p-4 bg-zinc-800 rounded-xl">
                  <div>
                    <p className="font-medium">{op.email}</p>
                    <p className="text-sm text-zinc-400">Crediti: {op.credits}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => handleAddCredits(op.id, 1)} size="sm"><Coins className="mr-1 w-4" /> +1</Button>
                    <Button onClick={() => handleAddCredits(op.id, 5)} size="sm"><Coins className="mr-1 w-4" /> +5</Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (appState === "setup") {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-6">
        <Card className="w-full max-w-md bg-zinc-900 border-zinc-800">
          <CardHeader><CardTitle>Crea Nuovo Evento</CardTitle></CardHeader>
          <CardContent>
            <p className="mb-4 text-zinc-400">Crediti disponibili: {profile?.credits || 0}</p>
            <form onSubmit={(e) => { e.preventDefault(); handleCreateEvent(); }} className="space-y-4">
              <Input 
                value={newEventName}
                onChange={(e) => setNewEventName(e.target.value)}
                placeholder="Nome Evento (es. Serata Karaoke)"
              />
              <Button type="submit" disabled={creatingEvent || !profile?.credits} className="w-full">
                {creatingEvent ? "Creazione..." : "Crea Evento (1 credito)"}
              </Button>
            </form>
            <Button variant="ghost" onClick={handleLogout} className="w-full mt-4">Logout</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Dashboard (vista regia)
  return (
    <div className="min-h-screen bg-[#050505] text-white p-6">
      <header className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/')} size="icon"><ArrowLeft /></Button>
          <h1 className="text-2xl font-bold">{newEventName || 'Dashboard Regia'}</h1>
          <span className="text-zinc-500">Codice: {pubCode}</span>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setShowMessageModal(true)}><MessageSquare className="mr-2" /> Messaggio Regia</Button>
          <Button variant="ghost" onClick={() => navigate(`/display/${pubCode}`)}><Tv className="mr-2" /> Schermo Pub</Button>
          <Button variant="destructive" onClick={handleLogout}>Logout</Button>
        </div>
      </header>

      <div className="grid grid-cols-4 gap-6"> {/* Nuove colonne */}

        {/* Sinistra: Moduli */}
        <Card className="col-span-1 bg-zinc-900 border-zinc-800">
          <CardHeader><CardTitle>Moduli</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <Button onClick={() => setShowModuleModal(true)} className="w-full"><Plus /> Nuovo Modulo</Button>
            {Object.values(MODULE_TYPES).map(type => (
              <Button key={type} variant="outline" onClick={() => createModule(type)} className="w-full justify-start">
                {type === 'karaoke' && <Mic2 className="mr-2" />}
                {type === 'quiz' && <HelpCircle className="mr-2" />}
                {type === 'challenge' && <Swords className="mr-2" />}
                {type === 'media' && <Film className="mr-2" />}
                {type === 'leaderboard' && <Trophy className="mr-2" />}
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </Button>
            ))}
          </CardContent>
        </Card>

        {/* Centro: Modulo Attivo */}
        <Card className="col-span-2 bg-zinc-900 border-zinc-800">
          <CardHeader><CardTitle>Modulo Attivo: {activeModule?.type || 'Nessuno'}</CardTitle></CardHeader>
          <CardContent>
            {activeModule && (
              <div className="space-y-4">
                <p>Stato: {activeModule.status}</p>
                {/* Config da JSON */}
                <pre>{JSON.stringify(activeModule.config, null, 2)}</pre>
                <div className="flex gap-2">
                  <Button onClick={() => startModule(activeModule.id)}><Play /> Start</Button>
                  <Button onClick={() => endModule(activeModule.id, /* points */)}><Square /> End</Button>
                  {/* Altri controlli: pausa, next */}
                </div>
              </div>
            )}
            {/* Integrazione con sezioni esistenti (es. se karaoke, mostra queue) */}
            {activeModule?.type === MODULE_TYPES.KARAOKE && (
              // UI queue esistente qui
              <div className="space-y-4">
                <h3 className="text-lg font-bold">Coda Richieste</h3>
                {queue.map(req => (
                  <div key={req.id} className="bg-zinc-800 p-4 rounded-xl flex justify-between items-center">
                    <div>
                      <p className="font-medium">{req.title} - {req.artist}</p>
                      <p className="text-sm text-zinc-400">Da: {req.user_nickname}</p>
                      <p className="text-xs text-zinc-500">{new Date(req.requested_at).toLocaleTimeString()}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={() => { setSelectedRequest(req); setShowYoutubeModal(true); }} variant="outline"><Play className="mr-1 w-4" /> Avvia</Button>
                      <Button onClick={() => approveSong(req.id)} variant="outline"><Check className="w-4" /></Button>
                      <Button onClick={() => rejectSong(req.id)} variant="destructive" size="icon"><X className="w-4" /></Button>
                    </div>
                  </div>
                ))}
                {!queue.length && <p className="text-center text-zinc-500">Nessuna richiesta</p>}
              </div>
            )}
            {/* Altre integrazioni per quiz/challenge */}
          </CardContent>
        </Card>

        {/* Destra: Partecipanti / Leaderboard */}
        <Card className="col-span-1 bg-zinc-900 border-zinc-800">
          <CardHeader><CardTitle>Partecipanti</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-2 custom-scrollbar max-h-[60vh] overflow-y-auto">
              {participants.map(p => (
                <li key={p.id} className="flex justify-between p-3 bg-zinc-800 rounded-lg">
                  <span>{p.nickname}</span>
                  <span className="font-bold">{p.score} pt</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

      </div>

      {/* Modal per Nuovo Modulo (scegli da catalogo) */}
      <Dialog open={showModuleModal} onOpenChange={setShowModuleModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>Configura Modulo</DialogTitle></DialogHeader>
          {/* Tabs per tipo, catalogo */}
          <Tabs>
            <TabsList>
              <TabsTrigger value="quiz">Quiz</TabsTrigger>
              <TabsTrigger value="challenge">Sfida</TabsTrigger>
              {/* Altri */}
            </TabsList>
            <TabsContent value="quiz">
              {/* Lista da cataloghi */}
              {[...quizText, ...quizAudio, ...quizVideo].map(item => (
                <Button key={item.id} variant="outline" onClick={() => setSelectedCatalogItem(item)} className="w-full mb-2">{item.title}</Button>
              ))}
            </TabsContent>
            <TabsContent value="challenge">
              {challenges.map(item => (
                <Button key={item.id} variant="outline" onClick={() => setSelectedCatalogItem(item)} className="w-full mb-2">{item.title}</Button>
              ))}
            </TabsContent>
          </Tabs>
          <Button onClick={() => createModule(/* tipo basato su tab */)} className="w-full mt-4">Crea Modulo</Button>
        </DialogContent>
      </Dialog>

      {/* YOUTUBE MODAL (INVARIATO) */}
      <Dialog open={showYoutubeModal} onOpenChange={setShowYoutubeModal}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle>Avvia {selectedRequest?.title} di {selectedRequest?.user_nickname}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <Tabs defaultValue="search">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="search">Cerca YouTube</TabsTrigger>
                <TabsTrigger value="manual">Manuale</TabsTrigger>
              </TabsList>
              <TabsContent value="search">
                <div className="flex gap-2 mb-4">
                  <Input value={youtubeSearchQuery} onChange={(e) => setYoutubeSearchQuery(e.target.value)} placeholder="Cerca su YouTube..." />
                  <Button onClick={handleYoutubeSearch} disabled={searchingYoutube}><Search className="w-4 mr-2" /> Cerca</Button>
                </div>
                {searchingYoutube && <p className="text-center">Ricerca...</p>}
                {youtubeSearchResults.length > 0 && (
                  <div className="space-y-2">
                    {youtubeSearchResults.map(res => (
                      <div key={res.id} onClick={() => selectYoutubeResult(res.url)} className={`p-3 rounded-xl cursor-pointer transition ${youtubeUrl === res.url ? 'bg-fuchsia-500/20 border-fuchsia-500' : 'bg-zinc-800 hover:bg-zinc-700'}`}>
                        <p className="font-medium">{res.title}</p>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
              <TabsContent value="manual">
                <Input value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=..." className="bg-zinc-800 border-zinc-700" />
              </TabsContent>
            </Tabs>
            <Button onClick={startPerformance} disabled={!youtubeUrl.trim()} className="w-full bg-green-500 hover:bg-green-600" size="lg"><Play className="w-5 h-5 mr-2" /> Avvia Esibizione</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Quiz Modal */}
      <Dialog open={showQuizModal} onOpenChange={setShowQuizModal}>
        <DialogContent className="bg-zinc-900 border-zinc-800 max-w-2xl">
          <DialogHeader><DialogTitle>Crea Quiz</DialogTitle></DialogHeader>
          <Tabs value={quizTab} onValueChange={setQuizTab} className="mt-4">
            <TabsList className="grid w-full grid-cols-2"><TabsTrigger value="custom">Personalizzato</TabsTrigger><TabsTrigger value="category">Da Categoria</TabsTrigger></TabsList>
            <TabsContent value="custom" className="space-y-4 mt-4">
              <form onSubmit={handleStartQuiz} className="space-y-4">
                <div><label className="text-sm text-zinc-400 mb-2 block">Domanda</label><Textarea value={quizQuestion} onChange={(e) => setQuizQuestion(e.target.value)} placeholder="Scrivi la domanda..." className="bg-zinc-800 border-zinc-700 min-h-20" /></div>
                <div className="space-y-2"><label className="text-sm text-zinc-400">Opzioni di Risposta</label>
                  {quizOptions.map((option, idx) => (
                    <div key={idx} className="flex gap-2">
                      <Input value={option} onChange={(e) => { const newOptions = [...quizOptions]; newOptions[idx] = e.target.value; setQuizOptions(newOptions); }} placeholder={`Opzione ${idx + 1}`} className="bg-zinc-800 border-zinc-700 flex-1" />
                      <Button type="button" onClick={() => setQuizCorrectIndex(idx)} variant={quizCorrectIndex === idx ? "default" : "outline"} className={quizCorrectIndex === idx ? "bg-green-500" : ""}>{quizCorrectIndex === idx ? <Check className="w-4 h-4" /> : <span className="w-4 h-4" />}</Button>
                    </div>
                  ))}
                </div>
                <Button type="submit" className="w-full bg-fuchsia-500 hover:bg-fuchsia-600" size="lg"><HelpCircle className="w-5 h-5 mr-2" /> Lancia Quiz</Button>
              </form>
            </TabsContent>
            <TabsContent value="category" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-3">
                {QUIZ_CATEGORIES.map(cat => (
                  <button key={cat.id} onClick={() => setQuizCategory(cat.id)} className={`p-4 rounded-xl border transition ${quizCategory === cat.id ? 'border-fuchsia-500 bg-fuchsia-500/20' : 'border-zinc-700 hover:border-zinc-600'}`}>{cat.name}</button>
                ))}
              </div>
              <Button onClick={handleStartQuiz} className="w-full bg-fuchsia-500 hover:bg-fuchsia-600" size="lg"><HelpCircle className="w-5 h-5 mr-2" /> Genera Quiz Random</Button>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Messages Regia Modal */}
      <Dialog open={showMessageModal} onOpenChange={setShowMessageModal}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle>Invia Messaggio a Schermo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <Textarea 
              value={adminMessage}
              onChange={(e) => setAdminMessage(e.target.value)}
              placeholder="Scrivi un avviso per il pubblico..."
              className="bg-zinc-800 border-zinc-700 min-h-[100px]"
            />
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={() => setAdminMessage("🎉 Benvenuti al Karaoke! 🎉")} variant="outline" className="text-xs">Benvenuti</Button>
              <Button onClick={() => setAdminMessage("🍺 Happy Hour al Bar! 🍺")} variant="outline" className="text-xs">Happy Hour</Button>
              <Button onClick={() => setAdminMessage("👏 Applausi per il cantante! 👏")} variant="outline" className="text-xs">Applausi</Button>
              <Button onClick={() => setAdminMessage("🤫 Silenzio in sala per favore")} variant="outline" className="text-xs">Silenzio</Button>
            </div>
            <Button onClick={handleBroadcastMessage} className="w-full bg-cyan-600 hover:bg-cyan-700">
              <Send className="w-4 h-4 mr-2" /> Invia a Tutti
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}