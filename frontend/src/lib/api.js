import { supabase } from './supabase'

// ============================================
// HELPER & AUTH
// ============================================

function getParticipantFromToken() {
  const token = localStorage.getItem('neonpub_token')
  if (!token) throw new Error('Not authenticated')
  try { return JSON.parse(atob(token)) } catch { throw new Error('Invalid token') }
}

async function getAdminEvent() {
  const pubCode = localStorage.getItem('neonpub_pub_code')
  if (!pubCode) throw new Error('No event selected')
  // Nota: Rimuovo il filtro status='active' per permettere all'admin di vedere eventi scaduti e riattivarli o analizzarli
  const { data, error } = await supabase.from('events').select('*').eq('code', pubCode.toUpperCase()).single()
  if (error) throw error
  return data
}

export const getMe = async () => { const { data: { user } } = await supabase.auth.getUser(); return { data: user } }

// ============================================
// EVENT MANAGEMENT (Admin & Setup)
// ============================================

export const createPub = async (data) => {
  const { data: user } = await supabase.auth.getUser()
  if (!user?.user) throw new Error('Login necessario')
  
  // Verifica profilo e crediti
  const { data: profile } = await supabase.from('profiles').select('credits, is_active, role').eq('id', user.user.id).single();
  
  if (!profile || !profile.is_active) throw new Error("Account disabilitato.");
  // Se è super_admin non scala crediti, altrimenti si
  if (profile.role !== 'super_admin') {
      if (profile.credits < 1) throw new Error("Crediti insufficienti.");
      await supabase.from('profiles').update({ credits: profile.credits - 1 }).eq('id', user.user.id);
  }

  const code = Math.random().toString(36).substring(2, 8).toUpperCase()
  const expiresAt = new Date(); 
  expiresAt.setHours(expiresAt.getHours() + 12); // Durata 12 ore

  const { data: event, error } = await supabase.from('events').insert({
      owner_id: user.user.id, 
      name: data.name, 
      code: code, 
      status: 'active', 
      active_module: 'karaoke', 
      expires_at: expiresAt.toISOString()
    }).select().single()

  if (error) throw error
  return { data: event }
}

export const getPub = async (pubCode) => {
  if (!pubCode) return { data: null };
  const { data } = await supabase.from('events').select('*').eq('code', pubCode.toUpperCase()).maybeSingle();
  // Se scaduto, restituisci comunque i dati ma flaggato
  if (data && (data.status === 'ended' || new Date(data.expires_at) < new Date())) {
      return { data, expired: true };
  }
  return { data }
}

export const updateEventSettings = async (data) => {
  const event = await getAdminEvent();
  const updatePayload = { name: data.name };
  if (data.logo_url) updatePayload.logo_url = data.logo_url;
  const { error } = await supabase.from('events').update(updatePayload).eq('id', event.id);
  if (error) throw error;
  return { data: 'ok' };
}

export const uploadLogo = async (file) => {
  const fileExt = file.name.split('.').pop();
  const fileName = `${Date.now()}.${fileExt}`;
  const { error } = await supabase.storage.from('logos').upload(fileName, file);
  if (error) throw error;
  const { data } = supabase.storage.from('logos').getPublicUrl(fileName);
  return data.publicUrl;
}

export const getActiveEventsForUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if(!user) return [];
    // Ritorna gli ultimi 5 eventi creati, indipendentemente dallo status, per storico
    const { data } = await supabase.from('events').select('*').eq('owner_id', user.id).order('created_at', {ascending: false}).limit(5);
    return data || [];
}

// ============================================
// SUPER ADMIN FEATURES
// ============================================
export const getAllProfiles = async () => {
    const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return { data };
}
export const updateProfileCredits = async (id, credits) => { 
    const { error } = await supabase.from('profiles').update({ credits: parseInt(credits) }).eq('id', id); 
    if (error) throw error; return { data: 'ok' }; 
}
export const toggleUserStatus = async (id, isActive) => { 
    const { error } = await supabase.from('profiles').update({ is_active: isActive }).eq('id', id); 
    if (error) throw error; return { data: 'ok' }; 
}
// Mock per creazione operatore (richiederebbe backend reale per auth.admin)
export const createOperatorProfile = async () => { return { data: 'Funzione disabilitata in demo client-side' }; }


// ============================================
// CLIENT / JOIN
// ============================================

export const joinPub = async ({ pub_code, nickname }) => {
  const { data: event } = await supabase.from('events').select('id, name, status, expires_at').eq('code', pub_code.toUpperCase()).single()
  
  if (!event) throw new Error("Evento non trovato");
  if (event.status !== 'active' && new Date(event.expires_at) > new Date()) {
       // Permettiamo il join se è "pausato" ma non scaduto, ma se è ended no.
       if(event.status === 'ended') throw new Error("Evento terminato");
  }

  const { data: participant, error } = await supabase.from('participants').insert({ event_id: event.id, nickname }).select().single()
  if (error) {
      if (error.code === '23505') throw new Error("Nickname già in uso in questo evento.");
      throw error;
  }
  
  const token = btoa(JSON.stringify({ participant_id: participant.id, event_id: event.id, nickname, pub_name: event.name }))
  return { data: { token, user: { ...participant, pub_name: event.name } } }
}

// ============================================
// KARAOKE LOGIC
// ============================================

export const requestSong = async (data) => {
  const p = getParticipantFromToken()
  const { data: req, error } = await supabase.from('song_requests').insert({
      event_id: p.event_id, participant_id: p.participant_id, title: data.title, artist: data.artist, youtube_url: data.youtube_url, status: 'pending'
    }).select().single()
  if(error) throw error; return { data: req }
}

export const getAdminQueue = async () => {
  const event = await getAdminEvent()
  const { data } = await supabase.from('song_requests').select('*, participants(nickname)').eq('event_id', event.id).in('status', ['pending', 'queued']).order('created_at', { ascending: true })
  return { data: data?.map(r => ({...r, user_nickname: r.participants?.nickname})) || [] }
}

export const approveRequest = async (id) => { await supabase.from('song_requests').update({ status: 'queued' }).eq('id', id); return {data:'ok'} }
export const rejectRequest = async (id) => { await supabase.from('song_requests').update({ status: 'rejected' }).eq('id', id); return {data:'ok'} }
export const deleteRequest = async (id) => { await supabase.from('song_requests').update({ status: 'deleted' }).eq('id', id); return {data:'ok'} }

// START KARAOKE (CRITICO: Resetta stati precedenti)
export const startPerformance = async (requestId, youtubeUrl) => {
  const { data: request } = await supabase.from('song_requests').select('*').eq('id', requestId).single()
  
  // 1. Termina tutto ciò che è in corso
  await supabase.from('performances').update({ status: 'ended' }).eq('event_id', request.event_id).in('status', ['live', 'paused', 'voting']);
  await supabase.from('quizzes').update({ status: 'ended' }).eq('event_id', request.event_id).neq('status', 'ended');

  // 2. Crea nuova performance LIVE
  const { data: perf, error } = await supabase.from('performances').insert({
      event_id: request.event_id,
      song_request_id: request.id,
      participant_id: request.participant_id,
      song_title: request.title,
      song_artist: request.artist,
      youtube_url: youtubeUrl || request.youtube_url,
      status: 'live',
      started_at: new Date().toISOString()
  }).select().single();

  if (error) throw error;

  // 3. Aggiorna stato richiesta ed evento
  await supabase.from('song_requests').update({ status: 'performing' }).eq('id', requestId);
  await supabase.from('events').update({ active_module: 'karaoke' }).eq('id', request.event_id);

  return { data: perf };
}

// CONTROLLI PLAYER (Pause, Resume, Stop & Vota, Next)
export const ctrlPerformance = async (id, action) => {
    const updates = {};
    if (action === 'pause') updates.status = 'paused';
    if (action === 'resume') updates.status = 'live';
    if (action === 'restart') updates.started_at = new Date().toISOString();
    if (action === 'voting') updates.status = 'voting';
    if (action === 'end') {
        updates.status = 'ended';
        updates.ended_at = new Date().toISOString();
    }
    
    const { data, error } = await supabase.from('performances').update(updates).eq('id', id).select().single();
    if(error) throw error;
    
    // Se finisce, chiudiamo la richiesta e calcoliamo i punti (se c'è voto)
    if (action === 'end') {
        const { data: perf } = await supabase.from('performances').select('song_request_id, average_score, participant_id').eq('id', id).single();
        if(perf?.song_request_id) await supabase.from('song_requests').update({ status: 'ended' }).eq('id', perf.song_request_id);
        
        // Assegna punti al cantante in base al voto medio
        if (perf.participant_id && perf.average_score > 0) {
             const points = Math.round(perf.average_score * 10); // Es: 4.5 stelle = 45 punti
             await supabase.rpc('increment_score', { row_id: perf.participant_id, amount: points });
        }
    }
    
    return { data };
}

export const getAdminCurrentPerformance = async () => {
    const event = await getAdminEvent();
    const { data } = await supabase.from('performances').select('*, participants(nickname)').eq('event_id', event.id).in('status', ['live', 'paused', 'voting']).maybeSingle();
    return { data: data ? {...data, user_nickname: data.participants?.nickname} : null };
}

// ============================================
// QUIZ MANAGEMENT
// ============================================

export const getQuizCatalog = async () => {
    const { data } = await supabase.from('quiz_catalog').select('*').eq('is_active', true).order('category');
    return { data: data || [] };
}

export const importQuizCatalog = async (jsonString) => {
    try {
        let items = JSON.parse(jsonString); if (!Array.isArray(items)) items = [items];
        const { error } = await supabase.from('quiz_catalog').insert(items.map(item => ({
             category: item.category || 'Generale', question: item.question, options: item.options,
             correct_index: item.correct_index ?? 0, points: item.points || 10, media_url: item.media_url || null,
             media_type: item.media_type || 'text', is_active: true
        })));
        if(error) throw error; return { success: true, count: items.length };
    } catch (e) { throw new Error("JSON non valido: " + e.message); }
}

export const deleteQuizQuestion = async (id) => {
    const { error } = await supabase.from('quiz_catalog').update({ is_active: false }).eq('id', id);
    if(error) throw error; return { data: 'ok' };
}

export const startQuiz = async (data) => {
    const event = await getAdminEvent();
    
    // Ferma Karaoke
    await supabase.from('performances').update({ status: 'ended' }).eq('event_id', event.id).in('status', ['live', 'paused']);
    await supabase.from('quizzes').update({ status: 'ended' }).eq('event_id', event.id).neq('status', 'ended');

    const { data: quiz, error } = await supabase.from('quizzes').insert({
        event_id: event.id,
        category: data.category,
        question: data.question,
        options: data.options,
        correct_index: data.correct_index,
        points: data.points || 10,
        status: 'active',
        media_url: data.media_url,
        media_type: data.media_type
    }).select().single();

    if(error) throw error;
    await supabase.from('events').update({ active_module: 'quiz' }).eq('id', event.id);
    return { data: quiz };
}

export const ctrlQuiz = async (id, action) => {
    const updates = {};
    if(action === 'close_vote') updates.status = 'closed';
    if(action === 'show_results') updates.status = 'showing_results';
    if(action === 'leaderboard') updates.status = 'leaderboard';
    if(action === 'end') updates.status = 'ended';

    const { data, error } = await supabase.from('quizzes').update(updates).eq('id', id).select().single();
    if(error) throw error;
    return { data };
}

export const getActiveQuiz = async () => {
    // Funziona sia per admin (via localStorage) che per client (via token)
    let eventId = null;
    const pubCode = localStorage.getItem('neonpub_pub_code');
    
    if (pubCode) {
        const { data } = await supabase.from('events').select('id').eq('code', pubCode).single();
        eventId = data?.id;
    } else {
        try { const p = getParticipantFromToken(); eventId = p.event_id; } catch(e){}
    }
    
    if(!eventId) return { data: null };
    const { data } = await supabase.from('quizzes').select('*').eq('event_id', eventId).in('status', ['active', 'closed', 'showing_results', 'leaderboard']).maybeSingle();
    return { data };
}

export const getQuizResults = async (quizId) => {
    const { data: quiz } = await supabase.from('quizzes').select('*').eq('id', quizId).single();
    const { data: answers } = await supabase.from('quiz_answers').select('is_correct');
    
    return { data: {
        correct_option: quiz.options[quiz.correct_index],
        total_answers: answers?.length || 0,
        correct_count: answers?.filter(a=>a.is_correct).length || 0
    }};
}

// ============================================
// DISPLAY & UTILS
// ============================================

export const getDisplayData = async (pubCode) => {
    const { data: event } = await supabase.from('events').select('*').eq('code', pubCode.toUpperCase()).single();
    if(!event) return { data: null };

    // Recupera TUTTO lo stato necessario per il display in una volta sola
    const [perf, queue, quiz, msg, lb] = await Promise.all([
        supabase.from('performances').select('*, participants(nickname)').eq('event_id', event.id).in('status', ['live', 'paused', 'voting', 'ended']).order('updated_at', {ascending: false}).limit(1).maybeSingle(),
        supabase.from('song_requests').select('*, participants(nickname)').eq('event_id', event.id).eq('status', 'queued').order('position', {ascending: true}).limit(5),
        supabase.from('quizzes').select('*').eq('event_id', event.id).in('status', ['active', 'closed', 'showing_results', 'leaderboard']).maybeSingle(),
        supabase.from('messages').select('*').eq('event_id', event.id).eq('status', 'approved').order('created_at', {ascending: false}).limit(1).maybeSingle(),
        supabase.from('participants').select('nickname, score').eq('event_id', event.id).order('score', {ascending: false}).limit(10)
    ]);

    return { data: {
        pub: event,
        current_performance: perf.data ? {...perf.data, user_nickname: perf.data.participants?.nickname} : null,
        queue: queue.data?.map(q => ({...q, user_nickname: q.participants?.nickname})) || [],
        active_quiz: quiz.data,
        latest_message: msg.data,
        leaderboard: lb.data || []
    }};
}

export const toggleMute = async (val) => {
    const pubCode = localStorage.getItem('neonpub_pub_code');
    await supabase.channel(`tv_${pubCode}`).send({ type: 'broadcast', event: 'control', payload: { command: 'mute', value: val } });
}

export const sendMessage = async (text) => {
    const event = await getAdminEvent();
    await supabase.from('messages').insert({ event_id: event.id, text, status: 'approved' });
    return {data: 'ok'};
}

export const getAdminPendingMessages = async () => {
    const event = await getAdminEvent();
    const { data } = await supabase.from('messages').select('*, participants(nickname)').eq('event_id', event.id).eq('status', 'pending');
    return { data: data?.map(m => ({...m, user_nickname: m.participants?.nickname})) || [] };
}
export const approveMessage = async (id) => { await supabase.from('messages').update({status:'approved'}).eq('id', id); return {data:'ok'} }
export const rejectMessage = async (id) => { await supabase.from('messages').update({status:'rejected'}).eq('id', id); return {data:'ok'} }

// Challenge Catalog (Placeholder per la tua feature)
export const getChallengeCatalog = async () => { const { data } = await supabase.from('challenge_catalog').select('*'); return { data: data || [] }; }

// ============================================
// EXPORT PER CLIENT APP
// ============================================
export default {
    createPub, joinPub, getPub, getActiveEventsForUser,
    requestSong, getAdminQueue, approveRequest, rejectRequest, deleteRequest,
    startPerformance, ctrlPerformance, getAdminCurrentPerformance,
    getQuizCatalog, startQuiz, ctrlQuiz, getActiveQuiz, getQuizResults,
    importQuizCatalog, deleteQuizQuestion, updateEventSettings, uploadLogo,
    getDisplayData, toggleMute, sendMessage, getAdminPendingMessages, approveMessage, rejectMessage,
    getChallengeCatalog,
    // Super Admin
    getAllProfiles, updateProfileCredits, toggleUserStatus, createOperatorProfile,
    // Client Methods
    getSongQueue: async () => { const p=getParticipantFromToken(); const {data}=await supabase.from('song_requests').select('*,participants(nickname)').eq('event_id',p.event_id).eq('status','queued'); return {data:data?.map(x=>({...x,user_nickname:x.participants?.nickname}))} },
    getMyRequests: async () => { const p=getParticipantFromToken(); const {data}=await supabase.from('song_requests').select('*').eq('participant_id',p.participant_id); return {data} },
    getCurrentPerformance: async () => { const p=getParticipantFromToken(); const {data}=await supabase.from('performances').select('*,participants(nickname)').eq('event_id',p.event_id).in('status',['live','voting']).maybeSingle(); return {data:data?{...data,user_nickname:data.participants?.nickname}:null} },
    submitVote: async ({performance_id, score}) => { const p=getParticipantFromToken(); await supabase.from('votes').insert({performance_id, participant_id:p.participant_id, score}); return {data:'ok'} },
    sendReaction: async ({emoji}) => { const p=getParticipantFromToken(); await supabase.from('reactions').insert({event_id:p.event_id, participant_id:p.participant_id, emoji, nickname:p.nickname}); return {data:'ok'} },
    answerQuiz: async ({quiz_id, answer_index}) => { 
        const p=getParticipantFromToken(); 
        const {data:quiz}=await supabase.from('quizzes').select('*').eq('id',quiz_id).single();
        const isCorrect = quiz.correct_index === answer_index;
        await supabase.from('quiz_answers').insert({quiz_id, participant_id:p.participant_id, answer_index, is_correct:isCorrect});
        if(isCorrect) await supabase.rpc('increment_score', {row_id: p.participant_id, amount: quiz.points});
        return {data: {points_earned: isCorrect ? quiz.points : 0}}
    },
    getLeaderboard: async () => { const p=getParticipantFromToken(); const {data}=await supabase.from('participants').select('nickname, score').eq('event_id',p.event_id).order('score', {ascending:false}).limit(20); return {data} }
}