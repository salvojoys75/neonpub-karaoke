import { supabase } from '@/lib/supabase'

// ============================================
// 1. HELPER E AUTH
// ============================================

// Recupera l'utente autenticato (Operatore/Admin)
const getUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
};

// Recupera il partecipante dal token localStorage (Cliente)
function getParticipantFromToken() {
    const token = localStorage.getItem('neonpub_token');
    if (!token) throw new Error('Not authenticated');
    try { 
        const parsed = JSON.parse(atob(token));
        if (!parsed.participant_id || !parsed.event_id) throw new Error("Token incompleto");
        return parsed;
    } catch (e) { 
        localStorage.removeItem('neonpub_token');
        throw new Error('Invalid token'); 
    }
}

// ============================================
// 2. FUNZIONI PARTECIPANTE (CLIENT)
// ============================================

export const joinPub = async ({ pub_code, nickname, avatar_url }) => {
    // 1. Trova l'evento
    const { data: event, error: evError } = await supabase
        .from('events')
        .select('id, name, status, settings')
        .eq('code', pub_code.toUpperCase())
        .maybeSingle(); // Usa maybeSingle per evitare errori 406 se non trovato

    if (evError) throw evError;
    if (!event) throw new Error("Evento non trovato. Controlla il codice.");
    if (event.status === 'ended') throw new Error("L'evento è terminato.");

    // 2. Prepara Avatar
    const finalAvatar = avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${nickname}`;

    // 3. Crea Partecipante
    const { data: participant, error: pError } = await supabase
        .from('participants')
        .insert({ 
            event_id: event.id, 
            nickname, 
            avatar_url: finalAvatar,
            score: 0
        })
        .select()
        .single();

    if (pError) throw pError;
    
    // 4. Genera Token (Base64 semplice per demo)
    const tokenObj = { 
        participant_id: participant.id, 
        event_id: event.id, 
        nickname, 
        pub_name: event.name 
    };
    const token = btoa(JSON.stringify(tokenObj));
    
    // Salva nel localStorage
    localStorage.setItem('neonpub_token', token);
    
    return { data: { token, user: { ...participant, pub_name: event.name } } };
};

export const requestSong = async (data) => {
    const p = getParticipantFromToken();
    const { data: req, error } = await supabase.from('song_requests').insert({
        event_id: p.event_id, 
        participant_id: p.participant_id, 
        title: data.title, 
        artist: data.artist, 
        youtube_url: '', 
        status: 'pending'
    }).select().single();
    if(error) throw error; 
    return { data: req };
};

export const submitVote = async ({ performance_id, score }) => { 
    const p = getParticipantFromToken(); 
    // Verifica se ha già votato
    const { data: existing } = await supabase.from('votes')
        .select('*')
        .eq('participant_id', p.participant_id)
        .eq('performance_id', performance_id)
        .maybeSingle();
        
    if(existing) throw new Error("Hai già votato!");

    await supabase.from('votes').insert({
        performance_id, 
        participant_id: p.participant_id, 
        score
    }); 
    return { data: 'ok' };
};

export const answerQuiz = async ({ quiz_id, answer_index }) => { 
    const p = getParticipantFromToken(); 
    const { error } = await supabase.from('quiz_answers').insert({
        quiz_id, 
        participant_id: p.participant_id, 
        answer_index
    });
    if(error) throw error;
    return { data: { status: 'submitted' } };
};

export const sendReaction = async ({ emoji }) => { 
    const p = getParticipantFromToken(); 
    await supabase.from('reactions').insert({
        event_id: p.event_id, 
        participant_id: p.participant_id, 
        emoji
    }); 
};

export const getMyRequests = async () => { 
    const p = getParticipantFromToken(); 
    const { data } = await supabase.from('song_requests')
        .select('*')
        .eq('participant_id', p.participant_id)
        .order('created_at', {ascending: false}); 
    return { data }; 
};

// ============================================
// 3. FUNZIONI ADMIN / OPERATORE
// ============================================

export const getOwnerEvents = async () => {
    const user = await getUser();
    if (!user) return { data: [] };
    
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
    if (!user) throw new Error("Login richiesto");

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
    const { data } = await supabase.from('events')
        .select('*')
        .eq('code', pubCode.toUpperCase())
        .maybeSingle();
    return { data };
};

// --- GESTIONE CODA & PLAYLIST ---

export const getAdminQueue = async (eventId) => {
    if(!eventId) return { data: [] };
    const { data } = await supabase
        .from('song_requests')
        .select('*, participants(nickname, avatar_url)')
        .eq('event_id', eventId)
        .in('status', ['pending', 'queued'])
        .order('created_at', { ascending: true });
    
    // Mapping sicuro per evitare crash se participants è null
    const mapped = data?.map(r => ({
        ...r, 
        user_nickname: r.participants?.nickname || 'Anonimo',
        user_avatar: r.participants?.avatar_url
    })) || [];
    
    return { data: mapped };
};

export const approveRequest = async (id) => supabase.from('song_requests').update({ status: 'queued' }).eq('id', id);
export const rejectRequest = async (id) => supabase.from('song_requests').update({ status: 'rejected' }).eq('id', id);
export const deleteRequest = async (id) => supabase.from('song_requests').update({ status: 'deleted' }).eq('id', id);

// --- KARAOKE PLAYER ---

export const startPerformance = async (requestId, youtubeUrl) => {
    const { data: req } = await supabase.from('song_requests').select('*').eq('id', requestId).single();
    if(!req) throw new Error("Richiesta non trovata");

    // Chiudi precedenti
    await supabase.from('performances').update({ status: 'ended' }).eq('event_id', req.event_id).in('status', ['live', 'voting', 'paused']);

    // Crea nuova
    await supabase.from('performances').insert({
        event_id: req.event_id,
        song_request_id: req.id,
        participant_id: req.participant_id,
        song_title: req.title,
        song_artist: req.artist,
        youtube_url: youtubeUrl,
        status: 'live'
    });

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
    
    await supabase.from('performances').update({ status }).eq('id', perfId);
};

// --- QUIZ ---

export const getActiveQuiz = async (eventId) => {
    if (!eventId) {
        // Fallback per client che non passano ID esplicitamente ma usano token
        try {
            const p = getParticipantFromToken();
            eventId = p.event_id;
        } catch(e) { return { data: null }; }
    }
    
    const { data } = await supabase.from('quizzes')
        .select('*')
        .eq('event_id', eventId)
        .in('status', ['active', 'closed', 'showing_results'])
        .maybeSingle();
    return { data };
};

export const startQuiz = async (quizData) => {
    // Chiudi quiz precedenti
    await supabase.from('quizzes').update({ status: 'ended' }).eq('event_id', quizData.event_id).neq('status', 'ended');
    // Avvia nuovo
    await supabase.from('quizzes').insert({ ...quizData, status: 'active' });
};

export const ctrlQuiz = async (quizId, action) => {
    let status = 'active';
    if (action === 'close_vote') status = 'closed';
    if (action === 'show_results') status = 'showing_results';
    if (action === 'end') status = 'ended';
    await supabase.from('quizzes').update({ status }).eq('id', quizId);
};

// --- MESSAGGI & SETTINGS ---

export const getAdminPendingMessages = async (eventId) => {
    if(!eventId) return { data: [] };
    const { data } = await supabase.from('messages')
        .select('*, participants(nickname)')
        .eq('event_id', eventId)
        .eq('status', 'pending');
    return { data: data?.map(m => ({...m, user_nickname: m.participants?.nickname})) || [] };
};

export const approveMessage = async (id) => supabase.from('messages').update({ status: 'approved' }).eq('id', id);
export const rejectMessage = async (id) => supabase.from('messages').update({ status: 'rejected' }).eq('id', id);

export const sendMessage = async (eventId, text) => {
    await supabase.from('messages').insert({ event_id: eventId, text, type: 'system', status: 'approved' });
};

export const updateEventSettings = async (eventId, settings) => {
    await supabase.from('events').update(settings).eq('id', eventId);
};

export const uploadLogo = async (file) => {
    const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '')}`;
    const { error } = await supabase.storage.from('logos').upload(fileName, file);
    if(error) throw error;
    const { data } = supabase.storage.from('logos').getPublicUrl(fileName);
    return data.publicUrl;
};

export const toggleMute = async (isMuted) => { 
    // Logica opzionale
    console.log("Mute toggled:", isMuted);
};

// ============================================
// EXPORT DEFAULT (PER COMPATIBILITÀ)
// ============================================

const api = {
    // Client
    joinPub,
    requestSong,
    submitVote,
    answerQuiz,
    sendReaction,
    getMyRequests,
    
    // Admin
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