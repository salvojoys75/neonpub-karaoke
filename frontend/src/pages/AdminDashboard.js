import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Music, Play, Square, Trophy, Tv, Check, X, MessageSquare, 
  LogOut, SkipForward, Pause, RotateCcw, Search, Plus, ArrowLeft,
  ListMusic, BrainCircuit, Swords, Send, Star, VolumeX, Volume2, ExternalLink,
  Users, Coins, Settings, Save, LayoutDashboard, Gem, Upload, UserPlus, Ban, Trash2, Image as ImageIcon,
  FileJson, Download, Gamepad2, StopCircle, Eye, EyeOff, ListOrdered, MonitorPlay, 
  Music2, Film, Mic2, Clock, Unlock, Lock, Dices, Shuffle
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

// Componente bottone elimina domanda con doppio step — evita cancellazioni accidentali
function DeleteQuizQuestionButton({ question, onConfirm }) {
  const [step, setStep] = useState(0);
  if (step === 0) return (
    <div className="mt-3 pt-3 border-t border-zinc-700/50">
      <button
        onClick={() => setStep(1)}
        className="w-full text-xs text-zinc-600 hover:text-zinc-400 transition flex items-center justify-center gap-1 py-1"
      >
        <Trash2 className="w-3 h-3"/> video/audio non funziona?
      </button>
    </div>
  );
  if (step === 1) return (
    <div className="mt-3 pt-3 border-t border-red-900/40 bg-red-950/20 rounded-lg p-3 space-y-2">
      <p className="text-xs text-red-400 font-bold text-center">⚠️ Eliminare DAL CATALOGO?</p>
      <p className="text-[10px] text-zinc-500 text-center line-clamp-2">"{question}"</p>
      <p className="text-[10px] text-red-500/70 text-center">Azione irreversibile — la domanda sparirà per sempre.</p>
      <div className="flex gap-2">
        <Button size="sm" variant="ghost" className="flex-1 text-zinc-400 h-7 text-xs" onClick={() => setStep(0)}>Annulla</Button>
        <Button size="sm" className="flex-1 bg-red-700 hover:bg-red-600 h-7 text-xs" onClick={() => { setStep(0); onConfirm(); }}>
          <Trash2 className="w-3 h-3 mr-1"/> Sì, elimina
        </Button>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { isAuthenticated, logout } = useAuth();
  
  // --- STATI GLOBALI ---
  const [appState, setAppState] = useState("loading");
  const [profile, setProfile] = useState(null);
  const [pubCode, setPubCode] = useState(localStorage.getItem("discojoys_pub_code"));
  
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
  const [customQuizTab, setCustomQuizTab] = useState('crea');
  const [customQuizJson, setCustomQuizJson] = useState('');
  const [importingCustom, setImportingCustom] = useState(false);
  const [showMessageModal, setShowMessageModal] = useState(false);
  
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState("");
  const [showModulesModal, setShowModulesModal] = useState(false);
  const [quizModules, setQuizModules] = useState([]);

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

  // --- VENUES (LOCALI) ---
  const [myVenues, setMyVenues] = useState([]);
  const [selectedVenueId, setSelectedVenueId] = useState(null);
  const [showVenueModal, setShowVenueModal] = useState(false);
  const [editingVenue, setEditingVenue] = useState(null);
  const [venueFormData, setVenueFormData] = useState({ name: '', city: '', address: '' });

// --- RANDOM EXTRACTION ---
  const [songPool, setSongPool] = useState([]);
  const [showCatalogModal, setShowCatalogModal] = useState(false);
  const [catalogSongs, setCatalogSongs] = useState([]);
  const [catalogMoods, setCatalogMoods] = useState([]);
  const [catalogGenres, setCatalogGenres] = useState([]);
  const [catalogMoodFilter, setCatalogMoodFilter] = useState("all");
  const [catalogGenreFilter, setCatalogGenreFilter] = useState("all");
  const [catalogSearch, setCatalogSearch] = useState("");
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [addingToPool, setAddingToPool] = useState(new Set());
  // Super Admin catalog management
  const [showAdminCatalogModal, setShowAdminCatalogModal] = useState(false);
  const [adminCatalogSongs, setAdminCatalogSongs] = useState([]);
  const [showAdminCatalogImportModal, setShowAdminCatalogImportModal] = useState(false);
  const [adminCatalogImportText, setAdminCatalogImportText] = useState("");
  const [showAdminCatalogSongModal, setShowAdminCatalogSongModal] = useState(false);
  const [editingCatalogSong, setEditingCatalogSong] = useState(null);
  const [catalogSongForm, setCatalogSongForm] = useState({ title: '', artist: '', youtube_url: '', genre: '', mood: '', decade: '', difficulty: 'facile' });
  const [showPoolModal, setShowPoolModal] = useState(false);
  const [editingSong, setEditingSong] = useState(null);
  const [poolFormData, setPoolFormData] = useState({ title: '', artist: '', youtube_url: '', genre: '', decade: '', difficulty: 'facile' });
  const [showImportPoolModal, setShowImportPoolModal] = useState(false);
  const [importPoolText, setImportPoolText] = useState("");
  const [extractionMode, setExtractionMode] = useState({ participant: 'random', song: 'random' });
  const [selectedParticipantId, setSelectedParticipantId] = useState(null);
  const [selectedSongId, setSelectedSongId] = useState(null);
  const [onlineParticipants, setOnlineParticipants] = useState([]);
 

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
      if (user.email === 'admin@discojoys.com') {
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
        const storedCode = localStorage.getItem("discojoys_pub_code");
        
        if (storedCode) { 
            const pubData = await api.getPub(storedCode);
            // Verifica validità evento
            if (pubData.data && (!pubData.data.expires_at || new Date(pubData.data.expires_at) > new Date())) {
                setPubCode(storedCode); 
                setAppState("dashboard"); 
            } else {
                localStorage.removeItem("discojoys_pub_code");
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

  const handleLogout = () => { localStorage.removeItem("discojoys_pub_code"); logout(); navigate("/"); };

  const handleStartEvent = async (e) => {
    e.preventDefault();
    if (!newEventName) return toast.error("Inserisci nome evento");
    if (!selectedVenueId) return toast.error("Seleziona un locale prima di creare l'evento");
    if ((profile?.credits || 0) < 1) return toast.error("Crediti insufficienti!");

    setCreatingEvent(true);
    try {
        const { data: pubData } = await createPub({ 
            name: newEventName,
            venue_id: selectedVenueId // Associa il venue all'evento
        });
        localStorage.setItem("discojoys_pub_code", pubData.code);
        setPubCode(pubData.code);
        
        // Aggiorna crediti locali per UI veloce
        setProfile(prev => ({...prev, credits: prev.credits - 1}));
        
        setAppState("dashboard");
        toast.success(`Evento Iniziato per ${myVenues.find(v => v.id === selectedVenueId)?.name}! (-1 Credito, Valido 8 ore)`);
    } catch (error) { toast.error(error.message); } finally { setCreatingEvent(false); }
  };

  const handleResumeEvent = (code) => {
      localStorage.setItem("discojoys_pub_code", code);
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
          localStorage.removeItem("discojoys_pub_code");
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

      // Usa il venue_id dell'evento se presente, altrimenti selectedVenueId (per compatibilità)
      const venueIdToUse = pubRes.data.venue_id || selectedVenueId;
      
      // Imposta automaticamente selectedVenueId se l'evento ha un venue
      if (pubRes.data.venue_id && !selectedVenueId) {
          setSelectedVenueId(pubRes.data.venue_id);
      }

      const [qRes, perfRes, msgRes, activeQuizRes, quizCatRes, challRes] = await Promise.all([
        api.getAdminQueue(),
        api.getAdminCurrentPerformance(),
        api.getAdminPendingMessages(),
        api.getActiveQuiz(),
        api.getQuizCatalog(venueIdToUse, 30),
        api.getChallengeCatalog()
      ]);

      setQueue(qRes.data || []);
      setCurrentPerformance(perfRes.data);
      setPendingMessages(msgRes.data || []);
      
      // Load approved messages - separati per tipo
      // Messaggi UTENTI approvati (hanno participant_id)
      const approvedUserMsgsRes = await supabase.from('messages')
        .select('*, participants(nickname)')
        .eq('event_id', pubRes.data.id)
        .eq('status', 'approved')
        .not('participant_id', 'is', null)
        .order('created_at', {ascending: false})
        .limit(10);
      // Messaggi REGIA approvati (participant_id null)
      const approvedAdminMsgsRes = await supabase.from('messages')
        .select('*')
        .eq('event_id', pubRes.data.id)
        .eq('status', 'approved')
        .is('participant_id', null)
        .order('created_at', {ascending: false})
        .limit(5);
      // Unione: prima i messaggi regia (con flag isAdmin), poi utenti
      const allApproved = [
        ...(approvedAdminMsgsRes.data || []).map(m => ({...m, user_nickname: 'Regia', isAdmin: true})),
        ...(approvedUserMsgsRes.data || []).map(m => ({...m, user_nickname: m.participants?.nickname}))
      ];
      setApprovedMessages(allApproved);
      
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

  // --- VENUES MANAGEMENT ---
  const loadMyVenues = async () => {
    try {
      const { data } = await api.getMyVenues();
      setMyVenues(data || []);
    } catch (e) {
      console.error("Errore caricamento locali:", e);
    }
  };

  const handleOpenVenueModal = (venue = null) => {
    if (venue) {
      setEditingVenue(venue);
      setVenueFormData({ name: venue.name, city: venue.city || '', address: venue.address || '' });
    } else {
      setEditingVenue(null);
      setVenueFormData({ name: '', city: '', address: '' });
    }
    setShowVenueModal(true);
  };

  const handleSaveVenue = async () => {
    if (!venueFormData.name) return toast.error("Nome locale obbligatorio");
    try {
      if (editingVenue) {
        await api.updateVenue(editingVenue.id, venueFormData);
        toast.success("Locale aggiornato");
      } else {
        await api.createVenue(venueFormData);
        toast.success("Locale creato");
      }
      setShowVenueModal(false);
      loadMyVenues();
    } catch (e) {
      toast.error("Errore: " + e.message);
    }
  };

  const handleDeleteVenue = async (venueId) => {
    if (!confirm("Eliminare questo locale? La cronologia quiz verrà mantenuta.")) return;
    try {
      await api.deleteVenue(venueId);
      toast.success("Locale eliminato");
      loadMyVenues();
      if (selectedVenueId === venueId) setSelectedVenueId(null);
    } catch (e) {
      toast.error("Errore eliminazione: " + e.message);
    }
  };

  useEffect(() => {
    if (appState === 'dashboard' || appState === 'setup') {
      loadMyVenues();
    }
  }, [appState]);
// --- RANDOM EXTRACTION FUNCTIONS ---
  const loadSongPool = async () => {
    try {
      const { data } = await api.getRandomSongPool();
      setSongPool(data || []);
    } catch (e) {
      console.error("Errore caricamento pool:", e);
    }
  };

  const loadOnlineParticipants = async () => {
    if (!pubCode) return;
    try {
      const { data: event } = await supabase.from('events').select('id').eq('code', pubCode.toUpperCase()).single();
      if (event) {
        const { data: parts } = await supabase
          .from('participants')
          .select('*')
          .eq('event_id', event.id)
          .order('last_activity', { ascending: false })
          .limit(50);
        setOnlineParticipants(parts || []);
      }
    } catch (e) {
      console.error("Errore caricamento partecipanti:", e);
    }
  };

  const handleOpenPoolModal = (song = null) => {
    if (song) {
      setEditingSong(song);
      setPoolFormData({
        title: song.title,
        artist: song.artist,
        youtube_url: song.youtube_url,
        genre: song.genre || '',
        decade: song.decade || '',
        difficulty: song.difficulty || 'facile'
      });
    } else {
      setEditingSong(null);
      setPoolFormData({ title: '', artist: '', youtube_url: '', genre: '', decade: '', difficulty: 'facile' });
    }
    setShowPoolModal(true);
  };

  const handleSaveSongPool = async () => {
    if (!poolFormData.title || !poolFormData.artist || !poolFormData.youtube_url) {
      return toast.error("Titolo, Artista e URL YouTube sono obbligatori");
    }
    try {
      if (editingSong) {
        await api.updateSongInPool(editingSong.id, poolFormData);
        toast.success("Canzone aggiornata");
      } else {
        await api.addSongToPool(poolFormData);
        toast.success("Canzone aggiunta al pool");
      }
      setShowPoolModal(false);
      loadSongPool();
    } catch (e) {
      toast.error("Errore: " + e.message);
    }
  };

  const handleDeleteSongPool = async (songId) => {
    if (!confirm("Eliminare questa canzone dal pool?")) return;
    try {
      await api.deleteSongFromPool(songId);
      toast.success("Canzone eliminata");
      loadSongPool();
    } catch (e) {
      toast.error("Errore eliminazione: " + e.message);
    }
  };

  const handleImportPoolScript = async () => {
    try {
      const parsed = JSON.parse(importPoolText);
      if (!Array.isArray(parsed)) throw new Error("Formato non valido");
      const result = await api.importSongsToPool(parsed);
      toast.success(`${result.count} canzoni importate!`);
      setShowImportPoolModal(false);
      setImportPoolText("");
      loadSongPool();
    } catch (e) {
      toast.error("Errore import: " + e.message);
    }
  };

  // ---- SONG CATALOG FUNCTIONS ----
  const loadSongCatalog = async () => {
    setLoadingCatalog(true);
    try {
      const moodFilter = catalogMoodFilter !== "all" ? catalogMoodFilter : null;
      const genreFilter = catalogGenreFilter !== "all" ? catalogGenreFilter : null;
      const [songsRes, moodsRes, genresRes] = await Promise.all([
        api.getSongCatalog({ mood: moodFilter, genre: genreFilter }),
        api.getSongCatalogMoods(),
        api.getSongCatalogGenres()
      ]);
      setCatalogSongs(songsRes.data || []);
      setCatalogMoods(moodsRes.data || []);
      setCatalogGenres(genresRes.data || []);
    } catch (e) {
      toast.error("Errore caricamento catalogo: " + e.message);
    } finally {
      setLoadingCatalog(false);
    }
  };

  const handleAddSongToPoolFromCatalog = async (song) => {
    setAddingToPool(prev => new Set(prev).add(song.id));
    try {
      const result = await api.addCatalogSongToPool(song);
      if (result.already_exists) {
        toast.info(`"${song.title}" è già nel tuo pool`);
      } else {
        toast.success(`✅ "${song.title}" aggiunto al pool!`);
        loadSongPool();
      }
    } catch (e) {
      toast.error("Errore: " + e.message);
    } finally {
      setAddingToPool(prev => { const s = new Set(prev); s.delete(song.id); return s; });
    }
  };

  const handleAddCategoryToPool = async (filterType, filterValue) => {
    const label = filterValue;
    if (!window.confirm(`Aggiungere tutte le canzoni "${label}" al tuo pool? I duplicati verranno saltati.`)) return;
    try {
      const options = filterType === 'mood' ? { mood: filterValue } : { genre: filterValue };
      const result = await api.addCatalogCategoryToPool(options);
      if (result.count === 0) {
        toast.info(`Tutte le canzoni "${label}" sono già nel tuo pool!`);
      } else {
        toast.success(`✅ ${result.count} canzoni aggiunte! (${result.skipped} già presenti)`);
        loadSongPool();
      }
    } catch (e) {
      toast.error("Errore: " + e.message);
    }
  };

  // Super Admin catalog management
  const loadAdminCatalog = async () => {
    try {
      const { data } = await api.getSongCatalog();
      setAdminCatalogSongs(data || []);
    } catch (e) {
      toast.error("Errore caricamento catalogo admin");
    }
  };

  const handleAdminCatalogImport = async () => {
    try {
      const parsed = JSON.parse(adminCatalogImportText);
      if (!Array.isArray(parsed)) throw new Error("Formato non valido");
      const result = await api.importSongsToCatalog(parsed);
      if (result.count === 0 && result.skipped > 0) {
        toast.info(`Tutte le ${result.skipped} canzoni erano già nel catalogo!`);
      } else if (result.skipped > 0) {
        toast.success(`${result.count} canzoni aggiunte al catalogo! (${result.skipped} già presenti, saltate)`);
      } else {
        toast.success(`${result.count} canzoni aggiunte al catalogo!`);
      }
      setShowAdminCatalogImportModal(false);
      setAdminCatalogImportText("");
      loadAdminCatalog();
    } catch (e) {
      toast.error("Errore import: " + e.message);
    }
  };

  const handleSaveAdminCatalogSong = async () => {
    if (!catalogSongForm.title || !catalogSongForm.artist || !catalogSongForm.youtube_url) {
      return toast.error("Titolo, Artista e URL sono obbligatori");
    }
    try {
      if (editingCatalogSong) {
        await api.updateSongInCatalog(editingCatalogSong.id, catalogSongForm);
        toast.success("Canzone aggiornata nel catalogo");
      } else {
        await api.addSongToCatalog(catalogSongForm);
        toast.success("Canzone aggiunta al catalogo");
      }
      setShowAdminCatalogSongModal(false);
      loadAdminCatalog();
    } catch (e) {
      toast.error("Errore: " + e.message);
    }
  };

  const handleDeleteAdminCatalogSong = async (songId, title) => {
    if (!window.confirm(`Eliminare "${title}" dal catalogo globale?`)) return;
    try {
      await api.deleteSongFromCatalog(songId);
      toast.success("Canzone eliminata dal catalogo");
      loadAdminCatalog();
    } catch (e) {
      toast.error("Errore eliminazione: " + e.message);
    }
  };

    const handleExtractRandom = async () => {
    try {
      const options = {};
      if (extractionMode.participant === 'forced' && selectedParticipantId) {
        options.forcedParticipantId = selectedParticipantId;
      }
      if (extractionMode.song === 'forced' && selectedSongId) {
        options.forcedSongId = selectedSongId;
      }
      
      const { data } = await api.extractRandomKaraoke(options);
      toast.success(`🎲 ${data.participant.nickname} canterà "${data.song.title}"!`);
      loadData(); // Ricarica coda
    } catch (e) {
      toast.error("Errore estrazione: " + e.message);
    }
  };

  useEffect(() => {
    if (appState === 'dashboard' && libraryTab === 'extraction') {
      loadSongPool();
      loadOnlineParticipants();
    }
  }, [appState, libraryTab]);

  useEffect(() => {
    if (showCatalogModal) {
      loadSongCatalog();
    }
  }, [showCatalogModal, catalogMoodFilter, catalogGenreFilter]);

  useEffect(() => {
    if (showAdminCatalogModal) {
      loadAdminCatalog();
    }
  }, [showAdminCatalogModal]);
 

  // --- DASHBOARD ACTIONS ---
  const handleOpenDisplay = () => {
    const width = 1280; const height = 720;
    const left = (window.screen.width - width) / 2; const top = (window.screen.height - height) / 2;
    window.open(`/display/${pubCode}`, 'DISCOJOYSDisplay', `popup=yes,width=${width},height=${height},top=${top},left=${left},toolbar=no,menubar=no`);
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
      try {
          await api.sendAdminMessage({ text: adminMessage });
          setShowMessageModal(false); 
          setAdminMessage("");
          toast.success("Messaggio inviato in sovraimpressione");
      } catch(e) {
          toast.error("Errore invio: " + e.message);
      }
  };

  const launchCustomQuiz = async () => {
      try {
          await api.startQuiz({
    category: item.category,
    question: item.question,
    options: item.options,
    correct_index: item.correct_index,
    points: item.points || 10,
    media_url: item.media_url || null,
    media_type: item.media_type || 'text',
    quiz_catalog_id: item.id
});
          setShowCustomQuizModal(false); toast.success("Quiz Custom Lanciato!"); loadData();
      } catch(e) { toast.error("Errore quiz custom: " + e.message); }
  };

  const handleImportCustomQuiz = async () => {
      if (!customQuizJson.trim()) return toast.error("Incolla il JSON prima");
      setImportingCustom(true);
      try {
          const parsed = JSON.parse(customQuizJson);
          const questions = Array.isArray(parsed) ? parsed : (parsed.questions || []);
          if (questions.length === 0) return toast.error("Nessuna domanda trovata nel JSON");
          const valid = questions.filter(q => q.question && Array.isArray(q.options) && q.options.length >= 2 && typeof q.correct_index === 'number');
          if (valid.length === 0) return toast.error("Formato JSON non valido — controlla la struttura");
          const result = await api.importCustomQuiz(valid);
          toast.success(`✅ ${result.count} domande personalizzate caricate!`);
          if (valid.length < questions.length) toast.warning(`${questions.length - valid.length} domande saltate per formato errato`);
          setCustomQuizJson('');
          setCustomQuizTab('crea');
          setShowCustomQuizModal(false);
          loadData();
      } catch(e) {
          if (e instanceof SyntaxError) toast.error("JSON non valido — controlla la sintassi");
          else toast.error("Errore: " + e.message);
      } finally {
          setImportingCustom(false);
      }
  };

  const launchCatalogQuiz = async (item) => {
      if(window.confirm(`Lanciare: ${item.question}?`)) {
          try {
              // Lancia quiz con tutti i dati dal catalogo (incluso media_url!)
              await api.startQuiz({
                  category: item.category,
                  question: item.question,
                  options: item.options,
                  correct_index: item.correct_index,
                  points: item.points || 10,
                  media_url: item.media_url || null,
                  media_type: item.media_type || 'text',
                  quiz_catalog_id: item.id
              });
              
              // SEMPRE traccia l'uso, anche senza venue (usa null come venue_id)
              const venueToTrack = selectedVenueId || null;
              console.log('🔍 Tracking quiz usage:', { 
                  questionId: item.id, 
                  venueId: venueToTrack,
                  hasVenue: !!selectedVenueId 
              });
              
              const trackResult = await api.trackQuizUsage(item.id, venueToTrack);
              console.log('✅ Track result:', trackResult);
              
              toast.success("Quiz Lanciato!");
              loadData();
          } catch (e) {
              console.error('❌ Error launching quiz:', e);
              toast.error("Errore: " + e.message);
          }
      }
  };

  const handleDeleteQuestion = async (e, item) => {
      e.stopPropagation();
      const isActive = item.id === activeQuizId;
      const msg = isActive 
          ? `⚠️ QUESTA DOMANDA È IN ONDA!\n\n"${item.question}"\n\nVuoi eliminarla? Il quiz verrà chiuso.`
          : `Eliminare: "${item.question}"?`;
      
      if(!confirm(msg)) return;
      
      try {
          await api.deleteQuizQuestion(item.id);
          toast.success("Domanda eliminata");
          
          if(isActive && activeQuizId) {
              await api.endQuiz(activeQuizId);
              await api.setEventModule('karaoke');
              toast.info("Quiz chiuso");
          }
          
          loadData();
      } catch(err) {
          toast.error("Errore: " + err.message);
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
          const modules = JSON.parse(importText);
          if (!Array.isArray(modules)) throw new Error("Formato non valido - serve un array");
          
          let count = 0;
          for (const mod of modules) {
              if (!mod.name || !mod.questions) {
                  console.warn("Modulo saltato - mancano name o questions:", mod);
                  continue;
              }
              
              const { error } = await supabase.from('quiz_library').insert({
                  name: mod.name,
                  category: mod.category || 'Generale',
                  description: mod.description || '',
                  questions: mod.questions
              });
              
              if (error) {
                  console.error("Errore inserimento modulo:", mod.name, error);
              } else {
                  count++;
              }
          }
          
          toast.success(`✅ ${count} moduli importati in libreria!`);
          setShowImportModal(false);
          setImportText("");
      } catch(e) {
          toast.error("Errore import: " + e.message);
      }
  };

  const loadQuizModules = async () => {
      try {
          const { data } = await api.getQuizModules();
          setQuizModules(data || []);
      } catch(e) {
          console.error("Errore caricamento moduli:", e);
      }
  };

  const handleLoadModule = async (moduleId, moduleName) => {
      if(!confirm(`Caricare il modulo "${moduleName}" nel catalogo?`)) return;
      try {
          const result = await api.loadQuizModule(moduleId);
          if(result.count === 0) {
              toast.info(`Tutte le domande di "${moduleName}" sono già nel catalogo!`);
          } else {
              toast.success(`✅ ${result.count} domande caricate! ${result.skipped > 0 ? `(${result.skipped} già presenti)` : ''}`);
          }
          setShowModulesModal(false);
          loadData();
      } catch(e) {
          toast.error("Errore: " + e.message);
      }
  };

  useEffect(() => {
      if(showModulesModal) {
          loadQuizModules();
      }
  }, [showModulesModal]);

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
            <div className="mb-6 flex gap-3">
                <Button onClick={()=>setShowCreateUserModal(true)} className="bg-green-600"><UserPlus className="w-4 h-4 mr-2"/> Nuovo Operatore</Button>
                <Button onClick={()=>setShowAdminCatalogModal(true)} className="bg-fuchsia-600"><ListMusic className="w-4 h-4 mr-2"/> Gestione Catalogo Pool</Button>
                <Button onClick={()=>setShowImportModal(true)} className="bg-cyan-600"><FileJson className="w-4 h-4 mr-2"/> Import Moduli Quiz</Button>
            </div>
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

            {/* ===== MODALE GESTIONE CATALOGO (SUPER ADMIN) ===== */}
            <Dialog open={showAdminCatalogModal} onOpenChange={setShowAdminCatalogModal}>
                <DialogContent className="bg-zinc-900 border-zinc-800 max-w-4xl max-h-[90vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <ListMusic className="w-5 h-5 text-fuchsia-400"/> Catalogo Pool Globale (Collaborativo)
                            <span className="text-xs text-zinc-500 font-normal">({adminCatalogSongs.length} canzoni)</span>
                        </DialogTitle>
                    </DialogHeader>
                    <div className="flex gap-2 pt-2">
                        <Button size="sm" className="bg-green-600 h-7" onClick={() => { setEditingCatalogSong(null); setCatalogSongForm({ title:'', artist:'', youtube_url:'', genre:'', mood:'', decade:'', difficulty:'facile' }); setShowAdminCatalogSongModal(true); }}>
                            <Plus className="w-3 h-3 mr-1"/> Aggiungi Canzone
                        </Button>
                        <Button size="sm" className="bg-blue-600 h-7" onClick={() => setShowAdminCatalogImportModal(true)}>
                            <Download className="w-3 h-3 mr-1"/> Import JSON
                        </Button>
                    </div>
                    <ScrollArea className="flex-1 mt-3 pr-1">
                        <div className="space-y-1 pb-4">
                            {adminCatalogSongs.map(song => (
                                <div key={song.id} className="flex items-center justify-between bg-zinc-800 px-3 py-2 rounded">
                                    <div className="flex-1 min-w-0">
                                        <div className="font-medium text-sm text-white truncate">{song.title}</div>
                                        <div className="text-xs text-zinc-400 flex gap-2 flex-wrap">
                                            <span>{song.artist}</span>
                                            {song.decade && <span className="text-zinc-600">• {song.decade}</span>}
                                            {song.mood && <span className="px-1.5 py-0.5 bg-fuchsia-900/40 text-fuchsia-300 rounded text-[10px]">{song.mood}</span>}
                                            {song.genre && <span className="px-1.5 py-0.5 bg-blue-900/40 text-blue-300 rounded text-[10px]">{song.genre}</span>}
                                        </div>
                                    </div>
                                    <div className="flex gap-1 ml-2">
                                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { setEditingCatalogSong(song); setCatalogSongForm({ title: song.title, artist: song.artist, youtube_url: song.youtube_url, genre: song.genre || '', mood: song.mood || '', decade: song.decade || '', difficulty: song.difficulty || 'facile' }); setShowAdminCatalogSongModal(true); }}>
                                            <Settings className="w-3 h-3"/>
                                        </Button>
                                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500" onClick={() => handleDeleteAdminCatalogSong(song.id, song.title)}>
                                            <Trash2 className="w-3 h-3"/>
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                </DialogContent>
            </Dialog>

            {/* ===== MODALE IMPORT CATALOGO GLOBALE ===== */}
            <Dialog open={showAdminCatalogImportModal} onOpenChange={setShowAdminCatalogImportModal}>
                <DialogContent className="bg-zinc-900 border-zinc-800 max-w-2xl">
                    <DialogHeader><DialogTitle>Importa nel Catalogo Globale</DialogTitle></DialogHeader>
                    <div className="space-y-4 pt-4">
                        <p className="text-xs text-zinc-500">Formato JSON con <code className="text-fuchsia-300">mood</code> e <code className="text-fuchsia-300">genre</code>:</p>
                        <p className="text-[10px] text-zinc-600 font-mono bg-zinc-950 p-2 rounded">{`[ { "title": "...", "artist": "...", "youtube_url": "https://...", "genre": "Pop", "mood": "Ballabili", "decade": "1990", "difficulty": "facile" } ]`}</p>
                        <p className="text-[10px] text-zinc-600">Mood: Ballabili, Allegre, Emozionanti, Anni 80, Anni 90, Anni 2000, Cartoni/Sigle, Italiane, Rock, Lente</p>
                        <Textarea
                            value={adminCatalogImportText}
                            onChange={e => setAdminCatalogImportText(e.target.value)}
                            placeholder="Incolla JSON qui..."
                            className="bg-zinc-950 border-zinc-700 font-mono text-xs h-48"
                        />
                        <Button className="w-full bg-blue-600 font-bold" onClick={handleAdminCatalogImport}>
                            <Download className="w-4 h-4 mr-2"/> IMPORTA NEL CATALOGO GLOBALE
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* ===== MODALE AGGIUNGI/MODIFICA CANZONE CATALOGO ===== */}
            <Dialog open={showAdminCatalogSongModal} onOpenChange={setShowAdminCatalogSongModal}>
                <DialogContent className="bg-zinc-900 border-zinc-800">
                    <DialogHeader><DialogTitle>{editingCatalogSong ? 'Modifica Canzone Catalogo' : 'Aggiungi al Catalogo Globale'}</DialogTitle></DialogHeader>
                    <div className="space-y-3 pt-4">
                        <div><label className="text-xs text-zinc-500 mb-1 block">Titolo *</label>
                            <Input value={catalogSongForm.title} onChange={e=>setCatalogSongForm({...catalogSongForm, title: e.target.value})} className="bg-zinc-800"/>
                        </div>
                        <div><label className="text-xs text-zinc-500 mb-1 block">Artista *</label>
                            <Input value={catalogSongForm.artist} onChange={e=>setCatalogSongForm({...catalogSongForm, artist: e.target.value})} className="bg-zinc-800"/>
                        </div>
                        <div><label className="text-xs text-zinc-500 mb-1 block">URL YouTube *</label>
                            <Input value={catalogSongForm.youtube_url} onChange={e=>setCatalogSongForm({...catalogSongForm, youtube_url: e.target.value})} className="bg-zinc-800"/>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div><label className="text-xs text-zinc-500 mb-1 block">Mood</label>
                                <Input value={catalogSongForm.mood} onChange={e=>setCatalogSongForm({...catalogSongForm, mood: e.target.value})} placeholder="es. Ballabili" className="bg-zinc-800"/>
                            </div>
                            <div><label className="text-xs text-zinc-500 mb-1 block">Genere</label>
                                <Input value={catalogSongForm.genre} onChange={e=>setCatalogSongForm({...catalogSongForm, genre: e.target.value})} placeholder="es. Pop" className="bg-zinc-800"/>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div><label className="text-xs text-zinc-500 mb-1 block">Decennio</label>
                                <Input value={catalogSongForm.decade} onChange={e=>setCatalogSongForm({...catalogSongForm, decade: e.target.value})} placeholder="es. 1990" className="bg-zinc-800"/>
                            </div>
                            <div><label className="text-xs text-zinc-500 mb-1 block">Difficoltà</label>
                                <Select value={catalogSongForm.difficulty} onValueChange={v=>setCatalogSongForm({...catalogSongForm, difficulty: v})}>
                                    <SelectTrigger className="bg-zinc-800"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="facile">Facile</SelectItem>
                                        <SelectItem value="media">Media</SelectItem>
                                        <SelectItem value="difficile">Difficile</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <Button className="w-full bg-green-600 font-bold" onClick={handleSaveAdminCatalogSong}>
                            <Save className="w-4 h-4 mr-2"/> {editingCatalogSong ? 'Aggiorna' : 'Aggiungi'} al Catalogo
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* ===== MODALE IMPORT MODULI QUIZ (SUPER ADMIN) ===== */}
            <Dialog open={showImportModal} onOpenChange={setShowImportModal}>
                <DialogContent className="bg-zinc-900 border-zinc-800 max-w-2xl">
                    <DialogHeader><DialogTitle>Importa Moduli Quiz (Super Admin)</DialogTitle></DialogHeader>
                    <div className="space-y-4 pt-4">
                        <p className="text-xs text-zinc-500 bg-cyan-900/20 p-3 rounded border border-cyan-700">
                            <strong>FORMATO MODULI:</strong> Array di moduli con campo "questions"
                        </p>
                        <p className="text-[10px] text-zinc-600 font-mono bg-zinc-950 p-2 rounded">
                            {`[{"name":"Intro Pop","category":"Indovina Intro","description":"...","questions":[{...},{...}]}]`}
                        </p>
                        <Textarea value={importText} onChange={e=>setImportText(e.target.value)} placeholder='Incolla JSON moduli qui...' className="bg-zinc-950 border-zinc-700 font-mono text-xs h-64"/>
                        <Button className="w-full bg-cyan-600 font-bold" onClick={handleImportScript}><FileJson className="w-4 h-4 mr-2"/> IMPORTA MODULI IN LIBRERIA</Button>
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
                        
                        {/* SELEZIONE LOCALE */}
                        <div className="border-2 border-cyan-500/30 rounded-lg p-4 bg-cyan-900/10">
                            <label className="text-sm font-bold text-cyan-400 mb-2 block flex items-center gap-2">
                                <Users className="w-4 h-4"/> 1. SELEZIONA LOCALE
                            </label>
                            
                            {myVenues.length === 0 ? (
                                <div className="text-center py-4">
                                    <p className="text-xs text-zinc-500 mb-3">Nessun locale configurato</p>
                                    <Button 
                                        size="sm" 
                                        onClick={() => handleOpenVenueModal()} 
                                        className="bg-blue-600 hover:bg-blue-500"
                                    >
                                        <Plus className="w-3 h-3 mr-1"/> Crea Primo Locale
                                    </Button>
                                </div>
                            ) : (
                                <Select value={selectedVenueId || ""} onValueChange={setSelectedVenueId}>
                                    <SelectTrigger className="bg-zinc-950 border-cyan-700 h-11">
                                        <SelectValue placeholder="Scegli locale..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {myVenues.map(venue => (
                                            <SelectItem key={venue.id} value={venue.id}>
                                                {venue.name} {venue.city && `• ${venue.city}`}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                            
                            {myVenues.length > 0 && (
                                <Button 
                                    size="sm" 
                                    variant="ghost" 
                                    className="w-full mt-2 text-xs text-zinc-500 hover:text-blue-400"
                                    onClick={() => handleOpenVenueModal()}
                                >
                                    <Plus className="w-3 h-3 mr-1"/> Aggiungi Nuovo Locale
                                </Button>
                            )}
                        </div>
                        
                        {/* NOME EVENTO */}
                        <div>
                            <label className="text-sm font-bold text-fuchsia-400 mb-2 block">
                                2. NOME SERATA
                            </label>
                            <Input 
                                placeholder="Es: Venerdì Karaoke" 
                                value={newEventName} 
                                onChange={e=>setNewEventName(e.target.value)} 
                                className="bg-zinc-950 text-center h-11" 
                            />
                        </div>
                        
                        <Button 
                            onClick={handleStartEvent} 
                            disabled={creatingEvent || (profile?.credits || 0) < 1 || !selectedVenueId || !newEventName} 
                            className="w-full bg-fuchsia-600 h-14 text-lg font-bold hover:bg-fuchsia-500 disabled:opacity-50"
                        >
                            {creatingEvent ? "Creazione..." : "🚀 LANCIA EVENTO (-1 Credit)"}
                        </Button>
                        
                        {selectedVenueId && (
                            <p className="text-xs text-center text-green-500">
                                ✓ Evento per: {myVenues.find(v => v.id === selectedVenueId)?.name}
                            </p>
                        )}
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

            {/* MODALE VENUE - necessario anche nella view setup */}
            <Dialog open={showVenueModal} onOpenChange={setShowVenueModal}>
                <DialogContent className="bg-zinc-900 border-zinc-800">
                    <DialogHeader><DialogTitle>{editingVenue ? 'Modifica Locale' : 'Nuovo Locale'}</DialogTitle></DialogHeader>
                    <div className="space-y-4 pt-4">
                        <div>
                            <label className="text-xs text-zinc-500 mb-1 block">Nome Locale *</label>
                            <Input 
                                value={venueFormData.name} 
                                onChange={e=>setVenueFormData({...venueFormData, name: e.target.value})} 
                                placeholder="Es: Red Lion Pub" 
                                className="bg-zinc-800"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-zinc-500 mb-1 block">Città</label>
                            <Input 
                                value={venueFormData.city} 
                                onChange={e=>setVenueFormData({...venueFormData, city: e.target.value})} 
                                placeholder="Es: Milano" 
                                className="bg-zinc-800"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-zinc-500 mb-1 block">Indirizzo</label>
                            <Input 
                                value={venueFormData.address} 
                                onChange={e=>setVenueFormData({...venueFormData, address: e.target.value})} 
                                placeholder="Es: Via Roma 123" 
                                className="bg-zinc-800"
                            />
                        </div>
                        <Button className="w-full bg-green-600 font-bold" onClick={handleSaveVenue}>
                            <Save className="w-4 h-4 mr-2"/> {editingVenue ? 'Aggiorna' : 'Crea'} Locale
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
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
            <h1 className="font-bold text-lg text-fuchsia-400">DISCOJOYS</h1>
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
             <Button variant="ghost" size="sm" onClick={() => { if(confirm("Tornare al menu eventi?")) { localStorage.removeItem("discojoys_pub_code"); setPubCode(null); setAppState("setup"); loadActiveEvents(); } }}><LogOut className="w-4 h-4" /></Button>
         </div>
      </header>

      <div className="flex-1 grid grid-cols-12 gap-0 overflow-hidden">
         {/* SIDEBAR */}
         <aside className="col-span-4 border-r border-white/10 bg-zinc-900/50 flex flex-col">
            <div className="p-2 border-b border-white/5">
               <Tabs value={libraryTab} onValueChange={setLibraryTab} className="w-full">
                  <TabsList className="grid w-full grid-cols-6 bg-zinc-950 p-1">
                     <TabsTrigger value="karaoke" className="text-xs px-1 data-[state=active]:bg-blue-900/30" title="Karaoke">
                        <ListMusic className="w-5 h-5 text-blue-400" />
                     </TabsTrigger>
                     <TabsTrigger value="quiz" className="text-xs px-1 data-[state=active]:bg-fuchsia-900/30" title="Quiz">
                        <BrainCircuit className="w-5 h-5 text-fuchsia-400" />
                     </TabsTrigger>
                     <TabsTrigger value="challenges" className="text-xs px-1 data-[state=active]:bg-red-900/30" title="Sfide">
                        <Swords className="w-5 h-5 text-red-400" />
                     </TabsTrigger>
                     <TabsTrigger value="messages" className="text-xs px-1 relative data-[state=active]:bg-green-900/30" title="Messaggi">
                        <MessageSquare className="w-5 h-5 text-green-400" />
                        {pendingMessages.length > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>}
                     </TabsTrigger>
                     <TabsTrigger value="settings" className="text-xs px-1 data-[state=active]:bg-zinc-700/30" title="Impostazioni">
                        <Settings className="w-5 h-5 text-zinc-400" />
                     </TabsTrigger>
                     <TabsTrigger value="extraction" className="text-xs px-1 data-[state=active]:bg-purple-900/30" title="Estrazione Casuale">
                        <Dices className="w-5 h-5 text-purple-400" />
                     </TabsTrigger>
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
                                <Plus className="w-3 h-3 mr-1"/> Crea Quiz
                            </Button>
                            <Button className="bg-purple-600 hover:bg-purple-500 text-xs" onClick={()=>setShowModulesModal(true)}>
                                <Dices className="w-3 h-3 mr-1"/> Carica Modulo
                            </Button>
                        </div>

                        {/* INFO */}
                        <div className="mb-2 p-2 bg-zinc-950 rounded text-[10px]">
                            <div className="text-zinc-500">Debug Info:</div>
                            <div className="text-yellow-500">Locale: {selectedVenueId ? '✅ Selezionato' : '❌ Nessuno'}</div>
                            <div className="text-cyan-500">Totale domande: {quizCatalog.length}</div>
                            <div className="text-orange-500">Con badge usata: {quizCatalog.filter(q => q.recently_used).length}</div>
                            {selectedVenueId && <div className="text-green-500">Venue ID: {selectedVenueId}</div>}
                        </div>

                        {selectedVenueId && quizCatalog.filter(q => q.recently_used).length > 0 && (
                            <Button 
                                variant="outline" 
                                size="sm"
                                className="mb-3 text-xs border-orange-500 text-orange-500 hover:bg-orange-500/10 w-full" 
                                onClick={async () => {
                                    const usedCount = quizCatalog.filter(q => q.recently_used).length;
                                    if(confirm(`Resettare le ${usedCount} domande usate negli ultimi 30 giorni per questo locale?`)) {
                                        try {
                                            console.log('🔄 Resetting venue:', selectedVenueId);
                                            await api.resetQuizUsageForVenue(selectedVenueId);
                                            toast.success("Domande venue resettate!");
                                            loadData();
                                        } catch(e) {
                                            console.error('❌ Reset error:', e);
                                            toast.error("Errore reset: " + e.message);
                                        }
                                    }
                                }}
                            >
                                <RotateCcw className="w-3 h-3 mr-1"/> Reset Domande Venue ({quizCatalog.filter(q => q.recently_used).length})
                            </Button>
                        )}

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
                                                <StopCircle className="w-4 h-4 mr-2"/> CHIUDI RISPOSTE
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

                                    {/* ZONA PERICOLOSA — separata visivamente e in fondo */}
                                    {quizStatus === 'active' && (
                                        <DeleteQuizQuestionButton 
                                            question={activeQuizData?.question}
                                            onConfirm={async () => {
                                                try {
                                                    await api.deleteQuizQuestion(activeQuizId);
                                                    toast.success("Domanda eliminata dal catalogo");
                                                    await api.endQuiz(activeQuizId);
                                                    await api.setEventModule('karaoke');
                                                    toast.info("Tornato al Karaoke");
                                                    loadData();
                                                } catch(e) {
                                                    toast.error("Errore: " + e.message);
                                                }
                                            }}
                                        />
                                    )}
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
                                <span>Catalogo ({filteredCatalog.length})</span>
                                {quizCatalog.filter(q => q.recently_used).length > 0 && (
                                    <span className="text-[10px] text-orange-400 font-normal flex items-center gap-1">
                                        🔄 {quizCatalog.filter(q => q.recently_used).length} usate 30gg
                                    </span>
                                )}
                            </h3>
                            
                            <ScrollArea className="h-[500px] pr-2">
                                <div className="space-y-2 pb-20">
                                    {filteredCatalog.map((item, index) => {
                                        const isActiveQuiz = item.id === activeQuizId;
                                        return (
                                        <div key={item.id || index} 
                                            className={`group relative bg-zinc-800 hover:bg-zinc-700 border rounded p-3 cursor-pointer transition-all ${isActiveQuiz ? 'border-fuchsia-500 bg-fuchsia-900/10' : item.recently_used ? 'border-orange-500/50 opacity-75' : 'border-transparent hover:border-yellow-500'}`}
                                            onClick={() => {
                                                if(isActiveQuiz) {
                                                    toast.info("Questa domanda è già in onda!");
                                                    return;
                                                }
                                                launchCatalogQuiz(item);
                                            }}>
                                            <div className="absolute top-2 right-2 flex gap-1 z-10">
                                                {isActiveQuiz && <span className="bg-fuchsia-500 text-white px-2 py-1 rounded text-[10px] font-bold">🔴 IN ONDA</span>}
                                                {item.recently_used && !isActiveQuiz && <span className="bg-orange-500/20 text-orange-500 px-2 py-1 rounded text-[10px] font-bold">🔄 USATA</span>}
                                                {item.media_type === 'audio' && <span className="bg-yellow-500/20 text-yellow-500 p-1 rounded"><Music2 className="w-3 h-3"/></span>}
                                                {item.media_type === 'video' && <span className="bg-blue-500/20 text-blue-500 p-1 rounded"><Film className="w-3 h-3"/></span>}
                                                <Button size="icon" variant="ghost" className={`h-6 w-6 text-white rounded-full ml-1 ${isActiveQuiz ? 'bg-red-600 hover:bg-red-700 animate-pulse' : 'bg-red-900/50 hover:bg-red-600'}`} onClick={(e) => handleDeleteQuestion(e, item)}><Trash2 className="w-3 h-3" /></Button>
                                            </div>
                                            <div className="text-[10px] font-bold text-fuchsia-500 uppercase tracking-wider mb-1 flex items-center gap-1">{item.category}</div>
                                            <div className="text-sm font-medium text-white pr-6 line-clamp-2">{item.question}</div>
                                            {item.recently_used && item.last_used && !isActiveQuiz && (
                                                <div className="text-[9px] text-orange-400 mt-1">
                                                    Usata: {new Date(item.last_used).toLocaleDateString('it-IT')}
                                                </div>
                                            )}
                                            {isActiveQuiz && (
                                                <div className="text-[9px] text-fuchsia-400 mt-1 font-bold">
                                                    ⚡ Questa domanda è in onda ora
                                                </div>
                                            )}
                                        </div>
                                        );
                                    })}
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
                           <div key={msg.id} className={`bg-zinc-800 p-3 rounded flex items-start justify-between gap-3 border-l-2 ${msg.isAdmin ? 'border-cyan-500' : 'border-green-500'}`}>
                               <div className="flex-1">
                                   <div className="flex gap-2 mb-1 items-center">
                                       <span className={`font-bold text-sm ${msg.isAdmin ? 'text-cyan-400' : 'text-green-400'}`}>{msg.user_nickname || 'Regia'}</span>
                                       {msg.isAdmin && <span className="text-[10px] bg-cyan-900/50 text-cyan-300 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">REGIA • IN SOVRAIMPRESSIONE</span>}
                                   </div>
                                   <p className="text-sm bg-black/20 p-2 rounded">{msg.text}</p>
                               </div>
                               <Button size="sm" variant="ghost" className="text-red-500 hover:bg-red-900/20 shrink-0" onClick={async()=>{ try { await api.deleteApprovedMessage(msg.id); toast.success("Eliminato"); loadData(); } catch(e) { toast.error("Errore eliminazione"); }}}><Trash2 className="w-4 h-4"/></Button>
                           </div>
                       )) : <p className="text-xs text-zinc-600 italic">Nessun messaggio approvato</p>}
                   </div>
               )}

               {libraryTab === 'settings' && (
                   <div className="space-y-6 pt-2">
                       {/* IMPOSTAZIONI EVENTO */}
                       <div>
                           <h3 className="text-sm font-bold text-white mb-3">⚙️ Impostazioni Evento</h3>
                           <div className="space-y-3">
                               <div className="space-y-2"><label className="text-xs text-zinc-500">Nome Evento</label><Input value={venueName} onChange={e=>setVenueName(e.target.value)} className="bg-zinc-800"/></div>
                               <div className="space-y-2"><label className="text-xs text-zinc-500">Logo (File)</label><div className="flex gap-2"><Input type="file" onChange={handleLogoUpload} className="bg-zinc-800 text-xs" accept="image/*" disabled={uploadingLogo}/>{uploadingLogo && <span className="text-yellow-500 text-xs animate-pulse">...</span>}</div></div>
                               <Button className="w-full bg-zinc-700" onClick={handleSaveSettings}><Save className="w-4 h-4 mr-2"/> Salva Impostazioni</Button>
                           </div>
                       </div>

                       {/* INFO LOCALE CORRENTE */}
                       {selectedVenueId && myVenues.length > 0 && (
                           <div className="border-t border-white/10 pt-4">
                               <div className="text-xs text-zinc-500 mb-1">Locale selezionato</div>
                               <div className="flex items-center justify-between bg-zinc-800 rounded p-3">
                                   <div>
                                       <div className="font-bold text-sm text-green-400">{myVenues.find(v => v.id === selectedVenueId)?.name}</div>
                                       {myVenues.find(v => v.id === selectedVenueId)?.city && (
                                           <div className="text-xs text-zinc-500">📍 {myVenues.find(v => v.id === selectedVenueId)?.city}</div>
                                       )}
                                   </div>
                                   <span className="text-[10px] bg-green-900/40 text-green-400 px-2 py-1 rounded font-bold">ATTIVO</span>
                               </div>
                           </div>
                       )}
                   </div>
               )}
{libraryTab === 'extraction' && (
                   <div className="space-y-4 pt-2">
                       {/* HEADER */}
                       <div className="flex justify-between items-center">
                           <h3 className="text-sm font-bold text-white">🎲 Pool Canzoni Estrazione</h3>
                           <div className="flex gap-1">
                               <Button size="sm" onClick={() => handleOpenPoolModal()} className="bg-blue-600 h-7">
                                   <Plus className="w-3 h-3 mr-1"/> Nuova
                               </Button>
                               <Button size="sm" onClick={() => { setShowCatalogModal(true); }} className="bg-fuchsia-600 h-7">
                                   <ListMusic className="w-3 h-3 mr-1"/> Catalogo
                               </Button>
                               <Button size="sm" onClick={() => { setEditingCatalogSong(null); setCatalogSongForm({ title:'', artist:'', youtube_url:'', genre:'', mood:'', decade:'', difficulty:'facile' }); setShowAdminCatalogSongModal(true); }} className="bg-zinc-700 h-7" title="Aggiungi canzone al catalogo globale">
                                   <Plus className="w-3 h-3 mr-1"/> +Catalogo
                               </Button>
                               <Button size="sm" onClick={() => setShowImportPoolModal(true)} className="bg-green-600 h-7">
                                   <FileJson className="w-3 h-3 mr-1"/> Import
                               </Button>
                           </div>
                       </div>

                       {/* LISTA CANZONI */}
                       <ScrollArea className="h-48">
                           {songPool.length > 0 ? (
                               <div className="space-y-2">
                                   {songPool.map(song => (
                                       <div key={song.id} className="bg-zinc-800 p-2 rounded flex justify-between items-center text-xs">
                                           <div className="flex-1">
                                               <div className="font-bold text-white">{song.title}</div>
                                               <div className="text-zinc-500">{song.artist} • {song.decade} • {song.difficulty}</div>
                                           </div>
                                           <div className="flex gap-1">
                                               <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => handleOpenPoolModal(song)}>
                                                   <Settings className="w-3 h-3"/>
                                               </Button>
                                               <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-red-500" onClick={() => handleDeleteSongPool(song.id)}>
                                                   <Trash2 className="w-3 h-3"/>
                                               </Button>
                                           </div>
                                       </div>
                                   ))}
                               </div>
                           ) : (
                               <p className="text-xs text-zinc-600 italic">Nessuna canzone. Importa il JSON con 30 canzoni!</p>
                           )}
                       </ScrollArea>

                       <div className="text-[10px] text-zinc-600">Totale: {songPool.length} canzoni</div>

                       {/* PANNELLO ESTRAZIONE */}
                       <div className="border-t border-white/10 pt-4 mt-4">
                           <h3 className="text-sm font-bold text-fuchsia-500 mb-3">🎰 ESTRAZIONE CASUALE</h3>
                           
                           {/* Partecipante */}
                           <div className="mb-3">
                               <label className="text-xs text-zinc-400 mb-1 block">Partecipante:</label>
                               <div className="space-y-1">
                                   <label className="flex items-center gap-2 text-xs">
                                       <input 
                                           type="radio" 
                                           checked={extractionMode.participant === 'random'}
                                           onChange={() => setExtractionMode({...extractionMode, participant: 'random'})}
                                       />
                                       <span className="text-white">Casuale dal pub</span>
                                   </label>
                                   <label className="flex items-center gap-2 text-xs">
                                       <input 
                                           type="radio"
                                           checked={extractionMode.participant === 'forced'}
                                           onChange={() => setExtractionMode({...extractionMode, participant: 'forced'})}
                                       />
                                       <span className="text-white">Scelgo io:</span>
                                   </label>
                                   {extractionMode.participant === 'forced' && (
                                       <Select value={selectedParticipantId} onValueChange={setSelectedParticipantId}>
                                           <SelectTrigger className="bg-zinc-800 text-xs h-8">
                                               <SelectValue placeholder="Seleziona..." />
                                           </SelectTrigger>
                                           <SelectContent>
                                               {onlineParticipants.map(p => (
                                                   <SelectItem key={p.id} value={p.id}>{p.nickname}</SelectItem>
                                               ))}
                                           </SelectContent>
                                       </Select>
                                   )}
                               </div>
                           </div>

                           {/* Canzone */}
                           <div className="mb-3">
                               <label className="text-xs text-zinc-400 mb-1 block">Canzone:</label>
                               <div className="space-y-1">
                                   <label className="flex items-center gap-2 text-xs">
                                       <input 
                                           type="radio"
                                           checked={extractionMode.song === 'random'}
                                           onChange={() => setExtractionMode({...extractionMode, song: 'random'})}
                                       />
                                       <span className="text-white">Casuale dal pool</span>
                                   </label>
                                   <label className="flex items-center gap-2 text-xs">
                                       <input 
                                           type="radio"
                                           checked={extractionMode.song === 'forced'}
                                           onChange={() => setExtractionMode({...extractionMode, song: 'forced'})}
                                       />
                                       <span className="text-white">Scelgo io:</span>
                                   </label>
                                   {extractionMode.song === 'forced' && (
                                       <Select value={selectedSongId} onValueChange={setSelectedSongId}>
                                           <SelectTrigger className="bg-zinc-800 text-xs h-8">
                                               <SelectValue placeholder="Seleziona..." />
                                           </SelectTrigger>
                                           <SelectContent>
                                               {songPool.map(s => (
                                                   <SelectItem key={s.id} value={s.id}>{s.title} - {s.artist}</SelectItem>
                                               ))}
                                           </SelectContent>
                                       </Select>
                                   )}
                               </div>
                           </div>

                           {/* Bottone Estrazione */}
                           <Button 
                               className="w-full bg-gradient-to-r from-fuchsia-600 to-purple-600 font-bold" 
                               onClick={handleExtractRandom}
                               disabled={songPool.length === 0}
                           >
                               <Dices className="w-4 h-4 mr-2"/> ESTRAI E METTI IN CODA
                           </Button>
                       </div>
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

      <Dialog open={showCustomQuizModal} onOpenChange={(open) => { setShowCustomQuizModal(open); if (!open) { setCustomQuizTab('crea'); setCustomQuizJson(''); } }}>
          <DialogContent className="bg-zinc-900 border-zinc-800 max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Crea Quiz Musicale</DialogTitle></DialogHeader>

              {/* TAB SWITCHER */}
              <div className="flex gap-1 bg-zinc-950 p-1 rounded-lg mt-1">
                  <button onClick={() => setCustomQuizTab('crea')} className={`flex-1 text-xs py-2 rounded-md font-bold transition-all ${customQuizTab === 'crea' ? 'bg-fuchsia-600 text-white shadow' : 'text-zinc-400 hover:text-white'}`}>
                      ✏️ Crea Domanda
                  </button>
                  <button onClick={() => setCustomQuizTab('personalizzate')} className={`flex-1 text-xs py-2 rounded-md font-bold transition-all ${customQuizTab === 'personalizzate' ? 'bg-purple-600 text-white shadow' : 'text-zinc-400 hover:text-white'}`}>
                      🎂 Personalizzate
                  </button>
              </div>

              {/* TAB CREA DOMANDA — invariato */}
              {customQuizTab === 'crea' && (
              <div className="space-y-4 pt-2">
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
              )}

              {/* TAB DOMANDE PERSONALIZZATE */}
              {customQuizTab === 'personalizzate' && (
              <div className="space-y-4 pt-2">
                  <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-3">
                      <p className="text-xs text-purple-300 font-bold mb-1">🎂 Manche Personalizzata</p>
                      <p className="text-xs text-zinc-400 leading-relaxed">Incolla il JSON generato dall'AI con le domande dell'evento (compleanno, festa a tema, ecc.). Le domande vengono aggiunte al catalogo e scadono automaticamente con l'evento.</p>
                  </div>

                  <div>
                      <label className="text-xs text-zinc-500 mb-1 block">JSON Domande</label>
                      <Textarea
                          value={customQuizJson}
                          onChange={e => setCustomQuizJson(e.target.value)}
                          placeholder={`[\n  {\n    "question": "Dove si sono conosciuti Mario e Laura?",\n    "options": ["Al mare", "All'università", "A una festa", "In palestra"],\n    "correct_index": 1,\n    "points": 10\n  }\n]`}
                          className="bg-zinc-950 border-zinc-700 font-mono text-xs h-52"
                      />
                  </div>

                  <div className="bg-zinc-800/60 rounded-lg p-3 space-y-1 text-xs text-zinc-400">
                      <p className="font-bold text-zinc-300 mb-2">Formato JSON richiesto:</p>
                      <p>• <code className="text-fuchsia-300">question</code> — testo della domanda</p>
                      <p>• <code className="text-fuchsia-300">options</code> — array di 2–4 risposte</p>
                      <p>• <code className="text-fuchsia-300">correct_index</code> — indice risposta corretta (0, 1, 2 o 3)</p>
                      <p>• <code className="text-fuchsia-300">points</code> — punti base (opzionale, default 10)</p>
                      <p className="text-zinc-500 mt-2 italic">Il bonus velocità verrà applicato automaticamente in base al tempo di risposta.</p>
                  </div>

                  <Button
                      className="w-full bg-purple-600 hover:bg-purple-500 h-12 text-base font-bold"
                      onClick={handleImportCustomQuiz}
                      disabled={importingCustom || !customQuizJson.trim()}
                  >
                      {importingCustom ? '⏳ Caricamento...' : '🎂 Carica Domande Personalizzate'}
                  </Button>
              </div>
              )}
          </DialogContent>
      </Dialog>

      <Dialog open={showModulesModal} onOpenChange={setShowModulesModal}>
          <DialogContent className="bg-zinc-900 border-zinc-800 max-w-2xl max-h-[80vh]">
              <DialogHeader><DialogTitle className="flex items-center gap-2"><Dices className="w-5 h-5 text-purple-400"/> Carica Moduli Quiz</DialogTitle></DialogHeader>
              <ScrollArea className="h-[500px] pr-4">
                  <div className="space-y-3 pt-4">
                      {quizModules.length === 0 ? (
                          <div className="text-center py-8 text-zinc-500">
                              <p>Nessun modulo disponibile</p>
                              <p className="text-xs mt-2">Aggiungi moduli nella tabella quiz_library</p>
                          </div>
                      ) : (
                          quizModules.map(module => (
                              <Card 
                                  key={module.id} 
                                  className="bg-zinc-800 border-zinc-700 hover:border-purple-500 cursor-pointer transition" 
                                  onClick={() => handleLoadModule(module.id, module.name)}
                              >
                                  <CardHeader>
                                      <div className="flex justify-between items-start">
                                          <div className="flex-1">
                                              <CardTitle className="text-base text-white">{module.name}</CardTitle>
                                              <div className="flex gap-2 mt-1">
                                                  <span className="text-xs px-2 py-0.5 bg-purple-900/50 text-purple-300 rounded">{module.category}</span>
                                                  <span className="text-xs text-zinc-500">{module.questions?.length || 0} domande</span>
                                              </div>
                                              {module.description && <p className="text-xs text-zinc-400 mt-2">{module.description}</p>}
                                          </div>
                                      </div>
                                  </CardHeader>
                              </Card>
                          ))
                      )}
                  </div>
              </ScrollArea>
              <div className="pt-4 border-t border-zinc-700 text-xs text-zinc-500">
                  💡 Click su un modulo per caricarlo nel catalogo. Le domande duplicate vengono saltate automaticamente.
              </div>
          </DialogContent>
      </Dialog>

      <Dialog open={showVenueModal} onOpenChange={setShowVenueModal}>
          <DialogContent className="bg-zinc-900 border-zinc-800">
              <DialogHeader><DialogTitle>{editingVenue ? 'Modifica Locale' : 'Nuovo Locale'}</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-4">
                  <div>
                      <label className="text-xs text-zinc-500 mb-1 block">Nome Locale *</label>
                      <Input 
                          value={venueFormData.name} 
                          onChange={e=>setVenueFormData({...venueFormData, name: e.target.value})} 
                          placeholder="Es: Red Lion Pub" 
                          className="bg-zinc-800"
                      />
                  </div>
                  <div>
                      <label className="text-xs text-zinc-500 mb-1 block">Città</label>
                      <Input 
                          value={venueFormData.city} 
                          onChange={e=>setVenueFormData({...venueFormData, city: e.target.value})} 
                          placeholder="Es: Milano" 
                          className="bg-zinc-800"
                      />
                  </div>
                  <div>
                      <label className="text-xs text-zinc-500 mb-1 block">Indirizzo</label>
                      <Input 
                          value={venueFormData.address} 
                          onChange={e=>setVenueFormData({...venueFormData, address: e.target.value})} 
                          placeholder="Es: Via Roma 123" 
                          className="bg-zinc-800"
                      />
                  </div>
                  <Button className="w-full bg-green-600 font-bold" onClick={handleSaveVenue}>
                      <Save className="w-4 h-4 mr-2"/> {editingVenue ? 'Aggiorna' : 'Crea'} Locale
                  </Button>
              </div>
          </DialogContent>
      </Dialog>
<Dialog open={showPoolModal} onOpenChange={setShowPoolModal}>
          <DialogContent className="bg-zinc-900 border-zinc-800">
              <DialogHeader>
                  <DialogTitle>{editingSong ? 'Modifica Canzone' : 'Nuova Canzone Pool'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 pt-4">
                  <div>
                      <label className="text-xs text-zinc-500 mb-1 block">Titolo *</label>
                      <Input 
                          value={poolFormData.title} 
                          onChange={e=>setPoolFormData({...poolFormData, title: e.target.value})} 
                          placeholder="Es: Azzurro" 
                          className="bg-zinc-800"
                      />
                  </div>
                  <div>
                      <label className="text-xs text-zinc-500 mb-1 block">Artista *</label>
                      <Input 
                          value={poolFormData.artist} 
                          onChange={e=>setPoolFormData({...poolFormData, artist: e.target.value})} 
                          placeholder="Es: Adriano Celentano" 
                          className="bg-zinc-800"
                      />
                  </div>
                  <div>
                      <label className="text-xs text-zinc-500 mb-1 block">URL YouTube *</label>
                      <Input 
                          value={poolFormData.youtube_url} 
                          onChange={e=>setPoolFormData({...poolFormData, youtube_url: e.target.value})} 
                          placeholder="https://www.youtube.com/watch?v=..." 
                          className="bg-zinc-800"
                      />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                      <div>
                          <label className="text-xs text-zinc-500 mb-1 block">Genere</label>
                          <Input 
                              value={poolFormData.genre} 
                              onChange={e=>setPoolFormData({...poolFormData, genre: e.target.value})} 
                              placeholder="Pop" 
                              className="bg-zinc-800"
                          />
                      </div>
                      <div>
                          <label className="text-xs text-zinc-500 mb-1 block">Decennio</label>
                          <Input 
                              value={poolFormData.decade} 
                              onChange={e=>setPoolFormData({...poolFormData, decade: e.target.value})} 
                              placeholder="1980" 
                              className="bg-zinc-800"
                          />
                      </div>
                      <div>
                          <label className="text-xs text-zinc-500 mb-1 block">Difficoltà</label>
                          <Select value={poolFormData.difficulty} onValueChange={(v)=>setPoolFormData({...poolFormData, difficulty: v})}>
                              <SelectTrigger className="bg-zinc-800">
                                  <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                  <SelectItem value="facile">Facile</SelectItem>
                                  <SelectItem value="media">Media</SelectItem>
                                  <SelectItem value="difficile">Difficile</SelectItem>
                              </SelectContent>
                          </Select>
                      </div>
                  </div>
                  <Button className="w-full bg-green-600 font-bold" onClick={handleSaveSongPool}>
                      <Save className="w-4 h-4 mr-2"/> {editingSong ? 'Aggiorna' : 'Aggiungi'} Canzone
                  </Button>
              </div>
          </DialogContent>
      </Dialog>

      {/* MODALE IMPORT POOL JSON */}
      <Dialog open={showImportPoolModal} onOpenChange={setShowImportPoolModal}>
          <DialogContent className="bg-zinc-900 border-zinc-800 max-w-2xl">
              <DialogHeader><DialogTitle>Importa Canzoni Pool (JSON)</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-4">
                  <p className="text-xs text-zinc-500">Formato: {`[ { "title": "...", "artist": "...", "youtube_url": "https://...", "genre": "Pop", "decade": "1980", "difficulty": "facile" } ]`}</p>
                  <Textarea 
                      value={importPoolText} 
                      onChange={e=>setImportPoolText(e.target.value)} 
                      placeholder='Incolla JSON qui...' 
                      className="bg-zinc-950 border-zinc-700 font-mono text-xs h-64"
                  />
                  <Button className="w-full bg-green-600 font-bold" onClick={handleImportPoolScript}>
                      <Download className="w-4 h-4 mr-2"/> IMPORTA NEL POOL
                  </Button>
              </div>
          </DialogContent>
      </Dialog>

      {/* ===== MODALE CATALOGO CENTRALIZZATO (OPERATORE) ===== */}
      <Dialog open={showCatalogModal} onOpenChange={setShowCatalogModal}>
          <DialogContent className="bg-zinc-900 border-zinc-800 max-w-3xl max-h-[90vh] flex flex-col">
              <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                      <ListMusic className="w-5 h-5 text-fuchsia-400"/> Catalogo Canzoni
                      <span className="text-xs text-zinc-500 font-normal ml-2">({catalogSongs.filter(s => {
                          const q = catalogSearch.toLowerCase();
                          return !q || s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q);
                      }).length} canzoni)</span>
                  </DialogTitle>
              </DialogHeader>

              {/* FILTRI */}
              <div className="space-y-2 pt-2">
                  <Input
                      placeholder="🔍 Cerca titolo o artista..."
                      value={catalogSearch}
                      onChange={e => setCatalogSearch(e.target.value)}
                      className="bg-zinc-800 border-zinc-700 h-8 text-sm"
                  />
                  <div className="flex gap-2">
                      <div className="flex-1">
                          <Select value={catalogMoodFilter} onValueChange={v => { setCatalogMoodFilter(v); setCatalogGenreFilter("all"); }}>
                              <SelectTrigger className="bg-zinc-800 border-zinc-700 h-8 text-xs">
                                  <SelectValue placeholder="Mood..." />
                              </SelectTrigger>
                              <SelectContent className="bg-zinc-800 border-zinc-700">
                                  <SelectItem value="all">🎵 Tutti i mood</SelectItem>
                                  {catalogMoods.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                              </SelectContent>
                          </Select>
                      </div>
                      <div className="flex-1">
                          <Select value={catalogGenreFilter} onValueChange={v => { setCatalogGenreFilter(v); setCatalogMoodFilter("all"); }}>
                              <SelectTrigger className="bg-zinc-800 border-zinc-700 h-8 text-xs">
                                  <SelectValue placeholder="Genere..." />
                              </SelectTrigger>
                              <SelectContent className="bg-zinc-800 border-zinc-700">
                                  <SelectItem value="all">🎸 Tutti i generi</SelectItem>
                                  {catalogGenres.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                              </SelectContent>
                          </Select>
                      </div>
                      {(catalogMoodFilter !== "all" || catalogGenreFilter !== "all") && (
                          <Button
                              size="sm"
                              className="bg-fuchsia-700 hover:bg-fuchsia-600 h-8 text-xs whitespace-nowrap"
                              onClick={() => {
                                  const filterType = catalogMoodFilter !== "all" ? 'mood' : 'genre';
                                  const filterValue = catalogMoodFilter !== "all" ? catalogMoodFilter : catalogGenreFilter;
                                  handleAddCategoryToPool(filterType, filterValue);
                              }}
                          >
                              <Plus className="w-3 h-3 mr-1"/> Aggiungi tutti
                          </Button>
                      )}
                  </div>
              </div>

              {/* LISTA CANZONI */}
              <ScrollArea className="flex-1 mt-2 pr-1">
                  {loadingCatalog ? (
                      <div className="text-center py-8 text-zinc-500 text-sm">Caricamento...</div>
                  ) : catalogSongs.length === 0 ? (
                      <div className="text-center py-8 text-zinc-600 text-sm">
                          <p>Nessuna canzone nel catalogo.</p>
                          <p className="text-xs mt-1 text-zinc-700">Il Super Admin deve prima popolare il catalogo.</p>
                      </div>
                  ) : (
                      <div className="space-y-1 pb-4">
                          {catalogSongs
                              .filter(s => {
                                  const q = catalogSearch.toLowerCase();
                                  return !q || s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q);
                              })
                              .map(song => (
                              <div key={song.id} className="flex items-center justify-between bg-zinc-800 hover:bg-zinc-700 px-3 py-2 rounded group transition-colors">
                                  <div className="flex-1 min-w-0">
                                      <div className="font-medium text-sm text-white truncate">{song.title}</div>
                                      <div className="text-xs text-zinc-400 flex gap-2">
                                          <span>{song.artist}</span>
                                          {song.decade && <span className="text-zinc-600">• {song.decade}</span>}
                                          {song.mood && <span className="px-1.5 py-0.5 bg-fuchsia-900/40 text-fuchsia-300 rounded text-[10px]">{song.mood}</span>}
                                          {song.genre && <span className="px-1.5 py-0.5 bg-blue-900/40 text-blue-300 rounded text-[10px]">{song.genre}</span>}
                                          {song.difficulty && <span className={`px-1.5 py-0.5 rounded text-[10px] ${song.difficulty === 'facile' ? 'bg-green-900/40 text-green-300' : song.difficulty === 'difficile' ? 'bg-red-900/40 text-red-300' : 'bg-yellow-900/40 text-yellow-300'}`}>{song.difficulty}</span>}
                                      </div>
                                  </div>
                                  <Button
                                      size="sm"
                                      className="ml-2 h-7 bg-fuchsia-700 hover:bg-fuchsia-600 text-xs shrink-0"
                                      onClick={() => handleAddSongToPoolFromCatalog(song)}
                                      disabled={addingToPool.has(song.id)}
                                  >
                                      {addingToPool.has(song.id) ? '...' : <><Plus className="w-3 h-3 mr-1"/>Pool</>}
                                  </Button>
                              </div>
                          ))}
                      </div>
                  )}
              </ScrollArea>
              <div className="border-t border-white/10 pt-3 mt-1 flex justify-between items-center">
                  <p className="text-[10px] text-zinc-600">Il catalogo è condiviso tra tutti gli operatori.</p>
                  <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs border-fuchsia-700 text-fuchsia-400 hover:bg-fuchsia-900/20"
                      onClick={() => { setShowCatalogModal(false); setEditingCatalogSong(null); setCatalogSongForm({ title:'', artist:'', youtube_url:'', genre:'', mood:'', decade:'', difficulty:'facile' }); setShowAdminCatalogSongModal(true); }}
                  >
                      <Plus className="w-3 h-3 mr-1"/> Aggiungi canzone al catalogo
                  </Button>
              </div>
          </DialogContent>
      </Dialog>

      {/* ===== MODALE GESTIONE CATALOGO (SUPER ADMIN) ===== */}
      <Dialog open={showAdminCatalogModal} onOpenChange={setShowAdminCatalogModal}>
          <DialogContent className="bg-zinc-900 border-zinc-800 max-w-4xl max-h-[90vh] flex flex-col">
              <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                      <ListMusic className="w-5 h-5 text-fuchsia-400"/> Catalogo Pool Globale (Collaborativo)
                      <span className="text-xs text-zinc-500 font-normal">({adminCatalogSongs.length} canzoni)</span>
                  </DialogTitle>
              </DialogHeader>
              <div className="flex gap-2 pt-2">
                  <Button size="sm" className="bg-green-600 h-7" onClick={() => { setEditingCatalogSong(null); setCatalogSongForm({ title:'', artist:'', youtube_url:'', genre:'', mood:'', decade:'', difficulty:'facile' }); setShowAdminCatalogSongModal(true); }}>
                      <Plus className="w-3 h-3 mr-1"/> Aggiungi Canzone
                  </Button>
                  <Button size="sm" className="bg-blue-600 h-7" onClick={() => setShowAdminCatalogImportModal(true)}>
                      <Download className="w-3 h-3 mr-1"/> Import JSON
                  </Button>
              </div>
              <ScrollArea className="flex-1 mt-3 pr-1">
                  <div className="space-y-1 pb-4">
                      {adminCatalogSongs.map(song => (
                          <div key={song.id} className="flex items-center justify-between bg-zinc-800 px-3 py-2 rounded">
                              <div className="flex-1 min-w-0">
                                  <div className="font-medium text-sm text-white truncate">{song.title}</div>
                                  <div className="text-xs text-zinc-400 flex gap-2 flex-wrap">
                                      <span>{song.artist}</span>
                                      {song.decade && <span className="text-zinc-600">• {song.decade}</span>}
                                      {song.mood && <span className="px-1.5 py-0.5 bg-fuchsia-900/40 text-fuchsia-300 rounded text-[10px]">{song.mood}</span>}
                                      {song.genre && <span className="px-1.5 py-0.5 bg-blue-900/40 text-blue-300 rounded text-[10px]">{song.genre}</span>}
                                  </div>
                              </div>
                              <div className="flex gap-1 ml-2">
                                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { setEditingCatalogSong(song); setCatalogSongForm({ title: song.title, artist: song.artist, youtube_url: song.youtube_url, genre: song.genre || '', mood: song.mood || '', decade: song.decade || '', difficulty: song.difficulty || 'facile' }); setShowAdminCatalogSongModal(true); }}>
                                      <Settings className="w-3 h-3"/>
                                  </Button>
                                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500" onClick={() => handleDeleteAdminCatalogSong(song.id, song.title)}>
                                      <Trash2 className="w-3 h-3"/>
                                  </Button>
                              </div>
                          </div>
                      ))}
                  </div>
              </ScrollArea>
          </DialogContent>
      </Dialog>

      {/* ===== MODALE IMPORT CATALOGO GLOBALE (SUPER ADMIN) ===== */}
      <Dialog open={showAdminCatalogImportModal} onOpenChange={setShowAdminCatalogImportModal}>
          <DialogContent className="bg-zinc-900 border-zinc-800 max-w-2xl">
              <DialogHeader><DialogTitle>Importa nel Catalogo Globale</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-4">
                  <p className="text-xs text-zinc-500">Formato JSON con campo <code className="text-fuchsia-300">mood</code> e <code className="text-fuchsia-300">genre</code>:</p>
                  <p className="text-[10px] text-zinc-600 font-mono bg-zinc-950 p-2 rounded">{`[ { "title": "...", "artist": "...", "youtube_url": "https://...", "genre": "Pop", "mood": "Ballabili", "decade": "1990", "difficulty": "facile" } ]`}</p>
                  <p className="text-[10px] text-zinc-600">Mood suggeriti: Ballabili, Allegre, Emozionanti, Anni 80, Anni 90, Anni 2000, Cartoni/Sigle, Italiane, Rock, Lente</p>
                  <Textarea
                      value={adminCatalogImportText}
                      onChange={e => setAdminCatalogImportText(e.target.value)}
                      placeholder="Incolla JSON qui..."
                      className="bg-zinc-950 border-zinc-700 font-mono text-xs h-48"
                  />
                  <Button className="w-full bg-blue-600 font-bold" onClick={handleAdminCatalogImport}>
                      <Download className="w-4 h-4 mr-2"/> IMPORTA NEL CATALOGO GLOBALE
                  </Button>
              </div>
          </DialogContent>
      </Dialog>

      {/* ===== MODALE AGGIUNGI/MODIFICA CANZONE CATALOGO (SUPER ADMIN) ===== */}
      <Dialog open={showAdminCatalogSongModal} onOpenChange={setShowAdminCatalogSongModal}>
          <DialogContent className="bg-zinc-900 border-zinc-800">
              <DialogHeader><DialogTitle>{editingCatalogSong ? 'Modifica Canzone Catalogo' : 'Aggiungi al Catalogo Globale'}</DialogTitle></DialogHeader>
              <div className="space-y-3 pt-4">
                  <div><label className="text-xs text-zinc-500 mb-1 block">Titolo *</label>
                      <Input value={catalogSongForm.title} onChange={e=>setCatalogSongForm({...catalogSongForm, title: e.target.value})} className="bg-zinc-800"/>
                  </div>
                  <div><label className="text-xs text-zinc-500 mb-1 block">Artista *</label>
                      <Input value={catalogSongForm.artist} onChange={e=>setCatalogSongForm({...catalogSongForm, artist: e.target.value})} className="bg-zinc-800"/>
                  </div>
                  <div><label className="text-xs text-zinc-500 mb-1 block">URL YouTube *</label>
                      <Input value={catalogSongForm.youtube_url} onChange={e=>setCatalogSongForm({...catalogSongForm, youtube_url: e.target.value})} className="bg-zinc-800"/>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                      <div><label className="text-xs text-zinc-500 mb-1 block">Mood</label>
                          <Input value={catalogSongForm.mood} onChange={e=>setCatalogSongForm({...catalogSongForm, mood: e.target.value})} placeholder="es. Ballabili" className="bg-zinc-800"/>
                      </div>
                      <div><label className="text-xs text-zinc-500 mb-1 block">Genere</label>
                          <Input value={catalogSongForm.genre} onChange={e=>setCatalogSongForm({...catalogSongForm, genre: e.target.value})} placeholder="es. Pop" className="bg-zinc-800"/>
                      </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                      <div><label className="text-xs text-zinc-500 mb-1 block">Decennio</label>
                          <Input value={catalogSongForm.decade} onChange={e=>setCatalogSongForm({...catalogSongForm, decade: e.target.value})} placeholder="es. 1990" className="bg-zinc-800"/>
                      </div>
                      <div><label className="text-xs text-zinc-500 mb-1 block">Difficoltà</label>
                          <Select value={catalogSongForm.difficulty} onValueChange={v=>setCatalogSongForm({...catalogSongForm, difficulty: v})}>
                              <SelectTrigger className="bg-zinc-800"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                  <SelectItem value="facile">Facile</SelectItem>
                                  <SelectItem value="media">Media</SelectItem>
                                  <SelectItem value="difficile">Difficile</SelectItem>
                              </SelectContent>
                          </Select>
                      </div>
                  </div>
                  <Button className="w-full bg-green-600 font-bold" onClick={handleSaveAdminCatalogSong}>
                      <Save className="w-4 h-4 mr-2"/> {editingCatalogSong ? 'Aggiorna' : 'Aggiungi'} al Catalogo
                  </Button>
              </div>
          </DialogContent>
      </Dialog>
    </div>
  );
}