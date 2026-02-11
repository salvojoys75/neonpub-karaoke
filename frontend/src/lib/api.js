import { supabase } from '@/lib/supabase' // Usa il tuo file esistente

// --- HELPER AUTH ---
const getUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Sessione scaduta o non valida");
    return user;
};

// --- FUNZIONI OPERATORE (ADMIN) ---

// 1. NUOVA: Recupera gli eventi passati dell'operatore
export const getOwnerEvents = async () => {
    const user = await getUser();
    const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false });
    
    if (error) console.error("Errore fetch eventi:", error);
    return { data: data || [] };
};

export const createPub = async ({ name }) => {
    const user = await getUser();
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    const { data, error } = await supabase.from('events').insert({
        owner_id: user.id,
        name: name, 
        code: code, 
        status: 'active', 
        active_module: 'karaoke', 
        event_type: 'mixed',
        expires_at: new Date(Date.now() + 43200000).toISOString()
    }).select().single();

    if (error) throw new Error(error.message);
    return { data };
};

export const getPub = async (pubCode) => {
    if (!pubCode) return { data: null };
    const { data } = await supabase.from('events').select('*').eq('code', pubCode.toUpperCase()).maybeSingle();
    return { data };
};

// --- GESTIONE CODA & KARAOKE ---
export const getAdminQueue = async (eventId) => {
    if(!eventId) return { data: [] };
    const { data } = await supabase
        .from('song_requests')
        .select('*, participants(nickname, avatar_url)')
        .eq('event_id', eventId)
        .in('status', ['pending', 'queued'])
        .order('created_at', { ascending: true });
    return { data: data?.map(r => ({...r, user_nickname: r.participants?.nickname})) || [] };
};

export const approveRequest = async (id) => supabase.from('song_requests').update({ status: 'queued' }).eq('id', id);
export const rejectRequest = async (id) => supabase.from('song_requests').update({ status: 'rejected' }).eq('id', id);
export const deleteRequest = async (id) => supabase.from('song_requests').update({ status: 'deleted' }).eq('id', id);

export const startPerformance = async (requestId, youtubeUrl) => {
    // Recupera la richiesta per avere i dati
    const { data: req } = await supabase.from('song_requests').select('*').eq('id', requestId).single();
    if(!req) throw new Error("Richiesta non trovata");

    // Chiudi eventuali performance attive
    await supabase.from('performances').update({ status: 'ended' }).eq('event_id', req.event_id).in('status', ['live', 'voting']);

    // Crea nuova performance
    await supabase.from('performances').insert({
        event_id: req.event_id,
        song_request_id: req.id,
        participant_id: req.participant_id,
        song_title: req.title,
        song_artist: req.artist,
        youtube_url: youtubeUrl,
        status: 'live'
    });

    // Aggiorna stato richiesta
    await supabase.from('song_requests').update({ status: 'played' }).eq('id', requestId);
};

export const getAdminCurrentPerformance = async (eventId) => {
    if(!eventId) return { data: null };
    const { data } = await supabase.from('performances')
        .select('*, participants(nickname)')
        .eq('event_id', eventId)
        .in('status', ['live', 'voting', 'paused'])
        .maybeSingle();
    return { data: data ? {...data, user_nickname: data.participants?.nickname} : null };
};

export const ctrlPerformance = async (perfId, action) => {
    let status = 'live';
    if (action === 'pause') status = 'paused';
    if (action === 'resume') status = 'live';
    if (action === 'voting') status = 'voting';
    if (action === 'end') status = 'ended';
    
    // Se restart, gestiamo lato client o riavviamo il timestamp, qui aggiorno solo stato
    await supabase.from('performances').update({ status }).eq('id', perfId);
};

// --- QUIZ & MESSAGGI ---
export const getActiveQuiz = async (eventId) => {
    if(!eventId) return { data: null };
    return { data: await supabase.from('quizzes').select('*').eq('event_id', eventId).in('status', ['active', 'closed', 'showing_results']).maybeSingle().then(r=>r.data) };
};

export const getQuizCatalog = async () => { 
    // Qui potresti avere una tabella 'quiz_catalog', per ora ritorno array vuoto o mock
    return { data: [] }; 
};

export const startQuiz = async (quizData) => {
    // quizData deve contenere event_id, question, options, etc.
    await supabase.from('quizzes').update({ status: 'ended' }).eq('event_id', quizData.event_id).neq('status', 'ended');
    await supabase.from('quizzes').insert({ ...quizData, status: 'active' });
};

export const ctrlQuiz = async (quizId, action) => {
    let status = 'active';
    if (action === 'close_vote') status = 'closed';
    if (action === 'show_results') status = 'showing_results';
    if (action === 'end') status = 'ended';
    await supabase.from('quizzes').update({ status }).eq('id', quizId);
};

export const getAdminPendingMessages = async (eventId) => {
    if(!eventId) return { data: [] };
    const { data } = await supabase.from('messages').select('*, participants(nickname)').eq('event_id', eventId).eq('status', 'pending');
    return { data: data?.map(m => ({...m, user_nickname: m.participants?.nickname})) || [] };
};

export const approveMessage = async (id) => supabase.from('messages').update({ status: 'approved' }).eq('id', id);
export const rejectMessage = async (id) => supabase.from('messages').update({ status: 'rejected' }).eq('id', id);
export const sendMessage = async (eventId, text) => {
    // Messaggio di sistema
    await supabase.from('messages').insert({ event_id: eventId, text, type: 'system', status: 'approved' });
};

export const updateEventSettings = async (eventId, settings) => {
    await supabase.from('events').update(settings).eq('id', eventId);
};

export const toggleMute = async (isMuted) => {
    // Logica opzionale se gestita su DB
};

export const uploadLogo = async (file) => {
    const fileName = `${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from('logos').upload(fileName, file);
    if(error) throw error;
    const { data } = supabase.storage.from('logos').getPublicUrl(fileName);
    return data.publicUrl;
};

// Assicurati che l'export sia corretto per come lo importi
const api = {
    getOwnerEvents,
    createPub,
    getPub,
    getAdminQueue,
    approveRequest,
    rejectRequest,
    deleteRequest,
    startPerformance,
    getAdminCurrentPerformance,
    ctrlPerformance,
    getActiveQuiz,
    getQuizCatalog,
    startQuiz,
    ctrlQuiz,
    getAdminPendingMessages,
    approveMessage,
    rejectMessage,
    sendMessage,
    updateEventSettings,
    toggleMute,
    uploadLogo
};

export default api;