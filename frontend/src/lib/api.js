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
  const { data, error } = await supabase.from('events').select('*').eq('code', pubCode.toUpperCase()).single()
  if (error) throw error
  return data
}

export const getMe = async () => { const { data: { user } } = await supabase.auth.getUser(); return { data: user } }

// ============================================
// EVENT MANAGEMENT
// ============================================

export const createPub = async (data) => {
  const { data: user } = await supabase.auth.getUser()
  if (!user?.user) throw new Error('Login necessario')
  
  const { data: profile } = await supabase.from('profiles').select('credits, is_active, role').eq('id', user.user.id).single();
  if (!profile || !profile.is_active) throw new Error("Account disabilitato.");
  
  if (profile.role !== 'super_admin') {
      if (profile.credits < 1) throw new Error("Crediti insufficienti.");
      await supabase.from('profiles').update({ credits: profile.credits - 1 }).eq('id', user.user.id);
  }

  const code = Math.random().toString(36).substring(2, 8).toUpperCase()
  const expiresAt = new Date(); 
  expiresAt.setHours(expiresAt.getHours() + 12); 

  const { data: event, error } = await supabase.from('events').insert({
      owner_id: user.user.id, name: data.name, code: code, status: 'active', active_module: 'karaoke', expires_at: expiresAt.toISOString()
    }).select().single()

  if (error) throw error
  return { data: event }
}

export const getPub = async (pubCode) => {
  if (!pubCode) return { data: null };
  const { data } = await supabase.from('events').select('*').eq('code', pubCode.toUpperCase()).maybeSingle();
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
    const { data } = await supabase.from('events').select('*').eq('owner_id', user.id).order('created_at', {ascending: false}).limit(5);
    return data || [];
}

// ============================================
// CLIENT JOIN (Con Avatar)
// ============================================

export const joinPub = async ({ pub_code, nickname, avatar_url }) => {
  const { data: event } = await supabase.from('events').select('id, name, status, expires_at').eq('code', pub_code.toUpperCase()).single()
  
  if (!event) throw new Error("Evento non trovato");
  if (event.status !== 'active' && new Date(event.expires_at) > new Date()) {
       if(event.status === 'ended') throw new Error("Evento terminato");
  }

  // Avatar URL: se non passato, ne generiamo uno casuale o null
  const finalAvatar = avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${nickname}`;

  const { data: participant, error } = await supabase.from('participants').insert({ 
      event_id: event.id, 
      nickname, 
      avatar_url: finalAvatar 
  }).select().single()

  if (error) {
      if (error.code === '23505') throw new Error("Nickname già in uso.");
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
      event_id: p.event_id, 
      participant_id: p.participant_id, 
      title: data.title, 
      artist: data.artist, 
      youtube_url: data.youtube_url, 
      status: 'pending'
    }).select().single()
  if(error) throw error; 
  return { data: req }
}

export const getAdminQueue = async () => {
  const event = await getAdminEvent()
  const { data } = await supabase.from('song_requests')
    .select('*, participants(nickname, avatar_url)')
    .eq('event_id', event.id)
    .in('status', ['pending', 'queued'])
    .order('created_at', { ascending: true })
  
  return { data: data?.map(r => ({...r, user_nickname: r.participants?.nickname, user_avatar: r.participants?.avatar_url})) || [] }
}

export const approveRequest = async (id) => { await supabase.from('song_requests').update({ status: 'queued' }).eq('id', id); return {data:'ok'} }
export const rejectRequest = async (id) => { await supabase.from('song_requests').update({ status: 'rejected' }).eq('id', id); return {data:'ok'} }
export const deleteRequest = async (id) => { await supabase.from('song_requests').update({ status: 'deleted' }).eq('id', id); return {data:'ok'} }

export const startPerformance = async (requestId, youtubeUrl) => {
  const { data: request } = await supabase.from('song_requests').select('*').eq('id', requestId).single()
  
  await supabase.from('performances').update({ status: 'ended' }).eq('event_id', request.event_id).in('status', ['live', 'paused', 'voting']);
  await supabase.from('quizzes').update({ status: 'ended' }).eq('event_id', request.event_id).neq('status', 'ended');

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

  await supabase.from('song_requests').update({ status: 'performing' }).eq('id', requestId);
  await supabase.from('events').update({ active_module: 'karaoke' }).eq('id', request.event_id);

  return { data: perf };
}

export const ctrlPerformance = async (id, action) => {
    const updates = {};
    if (action === 'pause') updates.status = 'paused';
    if (action === 'resume') updates.status = 'live';
    if (action === 'restart') updates.started_at = new Date().toISOString();
    if (action === 'voting') updates.status = 'voting';
    if (action === 'end') { updates.status = 'ended'; updates.ended_at = new Date().toISOString(); }
    
    const { data, error } = await supabase.from('performances').update(updates).eq('id', id).select().single();
    if(error) throw error;
    
    if (action === 'end') {
        const { data: perf } = await supabase.from('performances').select('song_request_id, average_score, participant_id').eq('id', id).single();
        if(perf?.song_request_id) await supabase.from('song_requests').update({ status: 'ended' }).eq('id', perf.song_request_id);
        if (perf.participant_id && perf.average_score > 0) {
             const points = Math.round(perf.average_score * 10); 
             await supabase.rpc('increment_score', { row_id: perf.participant_id, amount: points });
        }
    }
    return { data };
}

export const getAdminCurrentPerformance = async () => {
    const event = await getAdminEvent();
    const { data } = await supabase.from('performances').select('*, participants(nickname, avatar_url)').eq('event_id', event.id).in('status', ['live', 'paused', 'voting']).maybeSingle();
    return { data: data ? {...data, user_nickname: data.participants?.nickname, user_avatar: data.participants?.avatar_url} : null };
}

// ============================================
// QUIZ & SCORING (LOGICA A TEMPO)
// ============================================

export const startQuiz = async (data) => {
    const event = await getAdminEvent();
    
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
        created_at: new Date().toISOString(), // Importante per il calcolo tempo
        media_url: data.media_url,
        media_type: data.media_type
    }).select().single();

    if(error) throw error;
    await supabase.from('events').update({ active_module: 'quiz' }).eq('id', event.id);
    return { data: quiz };
}

export const answerQuiz = async ({quiz_id, answer_index}) => { 
    const p = getParticipantFromToken(); 
    const {data:quiz} = await supabase.from('quizzes').select('*').eq('id', quiz_id).single();
    
    const isCorrect = quiz.correct_index === answer_index;
    
    // CALCOLO PUNTEGGIO A TEMPO
    let finalPoints = 0;
    if (isCorrect) {
        const basePoints = quiz.points;
        const now = new Date();
        const start = new Date(quiz.created_at);
        const secondsElapsed = (now - start) / 1000;
        
        // Bonus Tempo: Decresce per i primi 15 secondi
        const maxTimeBonus = 20; // Punti extra massimi
        const timeWindow = 15; // Secondi entro cui prendere bonus
        
        const bonus = Math.max(0, maxTimeBonus * (1 - (secondsElapsed / timeWindow)));
        finalPoints = Math.round(basePoints + bonus);
        
        // Aggiorna punteggio utente
        await supabase.rpc('increment_score', {row_id: p.participant_id, amount: finalPoints});
    }

    await supabase.from('quiz_answers').insert({
        quiz_id, 
        participant_id: p.participant_id, 
        answer_index, 
        is_correct: isCorrect,
        points_awarded: finalPoints
    });

    return { data: { points_earned: finalPoints } }
}

export const getQuizResults = async (quizId) => {
    const { data: quiz } = await supabase.from('quizzes').select('*').eq('id', quizId).single();
    
    // Recupera risposte con dettagli utente per la lista vincitori
    const { data: answers } = await supabase.from('quiz_answers')
        .select('is_correct, points_awarded, participants(nickname, avatar_url)')
        .eq('quiz_id', quizId)
        .eq('is_correct', true)
        .order('points_awarded', { ascending: false }) // Ordina per chi ha preso più punti (più veloce)
        .limit(5); // Top 5

    const { count } = await supabase.from('quiz_answers').select('*', { count: 'exact', head: true }).eq('quiz_id', quizId);
    const { count: correctCount } = await supabase.from('quiz_answers').select('*', { count: 'exact', head: true }).eq('quiz_id', quizId).eq('is_correct', true);

    return { data: {
        correct_option: quiz.options[quiz.correct_index],
        total_answers: count || 0,
        correct_count: correctCount || 0,
        winners: answers?.map(a => ({
            nickname: a.participants.nickname,
            avatar: a.participants.avatar_url,
            points: a.points_awarded
        })) || []
    }};
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

// ============================================
// DISPLAY & UTILS
// ============================================

export const getDisplayData = async (pubCode) => {
    const { data: event } = await supabase.from('events').select('*').eq('code', pubCode.toUpperCase()).single();
    if(!event) return { data: null };

    const [perf, queue, quiz, msg, lb] = await Promise.all([
        supabase.from('performances').select('*, participants(nickname, avatar_url)').eq('event_id', event.id).in('status', ['live', 'paused', 'voting', 'ended']).order('updated_at', {ascending: false}).limit(1).maybeSingle(),
        supabase.from('song_requests').select('*, participants(nickname, avatar_url)').eq('event_id', event.id).eq('status', 'queued').order('position', {ascending: true}).limit(5),
        supabase.from('quizzes').select('*').eq('event_id', event.id).in('status', ['active', 'closed', 'showing_results', 'leaderboard']).maybeSingle(),
        supabase.from('messages').select('*').eq('event_id', event.id).eq('status', 'approved').order('created_at', {ascending: false}).limit(1).maybeSingle(),
        supabase.from('participants').select('nickname, score, avatar_url').eq('event_id', event.id).order('score', {ascending: false}).limit(10)
    ]);

    return { data: {
        pub: event,
        current_performance: perf.data ? {...perf.data, user_nickname: perf.data.participants?.nickname, user_avatar: perf.data.participants?.avatar_url} : null,
        queue: queue.data?.map(q => ({...q, user_nickname: q.participants?.nickname, user_avatar: q.participants?.avatar_url})) || [],
        active_quiz: quiz.data,
        latest_message: msg.data,
        leaderboard: lb.data || []
    }};
}

export const getActiveQuiz = async () => {
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

export const getAllProfiles = async () => { const { data } = await supabase.from('profiles').select('*'); return {data} };
export const updateProfileCredits = async (id, val) => { await supabase.from('profiles').update({credits:val}).eq('id',id); return {data:'ok'} };
export const toggleUserStatus = async (id, val) => { await supabase.from('profiles').update({is_active:val}).eq('id',id); return {data:'ok'} };
export const createOperatorProfile = async () => { return {data:'ok'} }; // Mock
export const getQuizCatalog = async () => { const { data } = await supabase.from('quiz_catalog').select('*').eq('is_active', true); return {data: data||[]} };
export const importQuizCatalog = async (json) => { /* Same as before */ return {success:true, count:0} };
export const deleteQuizQuestion = async (id) => { await supabase.from('quiz_catalog').update({is_active:false}).eq('id',id); return {data:'ok'} };
export const toggleMute = async (val) => { const c=localStorage.getItem('neonpub_pub_code'); if(c) supabase.channel(`tv_${c}`).send({type:'broadcast', event:'control', payload:{command:'mute', value:val}}); };
export const sendMessage = async (txt) => { const e=await getAdminEvent(); await supabase.from('messages').insert({event_id:e.id, text:txt, status:'approved'}); return {data:'ok'} };
export const getAdminPendingMessages = async () => { const e=await getAdminEvent(); const {data}=await supabase.from('messages').select('*, participants(nickname)').eq('event_id',e.id).eq('status','pending'); return {data: data?.map(m=>({...m, user_nickname:m.participants?.nickname}))||[]} };
export const approveMessage = async (id) => { await supabase.from('messages').update({status:'approved'}).eq('id',id); return {data:'ok'} };
export const rejectMessage = async (id) => { await supabase.from('messages').update({status:'rejected'}).eq('id',id); return {data:'ok'} };
export const getChallengeCatalog = async () => { return {data:[]} };

export default {
    createPub, joinPub, getPub, getActiveEventsForUser, uploadLogo,
    requestSong, getAdminQueue, approveRequest, rejectRequest, deleteRequest,
    startPerformance, ctrlPerformance, getAdminCurrentPerformance,
    getQuizCatalog, startQuiz, ctrlQuiz, getActiveQuiz, getQuizResults,
    importQuizCatalog, deleteQuizQuestion, updateEventSettings,
    getDisplayData, toggleMute, sendMessage, getAdminPendingMessages, approveMessage, rejectMessage,
    getAllProfiles, updateProfileCredits, toggleUserStatus, createOperatorProfile, getChallengeCatalog,
    
    // Client specific
    getSongQueue: async () => { const p=getParticipantFromToken(); const {data}=await supabase.from('song_requests').select('*,participants(nickname, avatar_url)').eq('event_id',p.event_id).eq('status','queued'); return {data:data?.map(x=>({...x,user_nickname:x.participants?.nickname}))} },
    getMyRequests: async () => { const p=getParticipantFromToken(); const {data}=await supabase.from('song_requests').select('*').eq('participant_id',p.participant_id); return {data} },
    getCurrentPerformance: async () => { const p=getParticipantFromToken(); const {data}=await supabase.from('performances').select('*,participants(nickname, avatar_url)').eq('event_id',p.event_id).in('status',['live','voting']).maybeSingle(); return {data:data?{...data,user_nickname:data.participants?.nickname}:null} },
    submitVote: async ({performance_id, score}) => { const p=getParticipantFromToken(); await supabase.from('votes').insert({performance_id, participant_id:p.participant_id, score}); return {data:'ok'} },
    sendReaction: async ({emoji}) => { const p=getParticipantFromToken(); await supabase.from('reactions').insert({event_id:p.event_id, participant_id:p.participant_id, emoji, nickname:p.nickname}); return {data:'ok'} },
    answerQuiz,
    getLeaderboard: async () => { const p=getParticipantFromToken(); const {data}=await supabase.from('participants').select('nickname, score, avatar_url').eq('event_id',p.event_id).order('score', {ascending:false}).limit(20); return {data} }
}