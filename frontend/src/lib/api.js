import { supabase } from './supabase'

// ============================================
// HELPER FUNCTIONS
// ============================================

function getParticipantFromToken() {
  const token = localStorage.getItem('neonpub_token')
  if (!token) throw new Error('Not authenticated')
  try {
    return JSON.parse(atob(token))
  } catch {
    throw new Error('Invalid token')
  }
}

async function getAdminEvent() {
  const pubCode = localStorage.getItem('neonpub_pub_code')
  if (!pubCode) throw new Error('No event selected')
  
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('code', pubCode.toUpperCase())
    .single()
  
  if (error) throw error
  return data
}

// ============================================
// AUTH & EVENTS & STORAGE
// ============================================

export const createPub = async (data) => {
  const { data: user } = await supabase.auth.getUser()
  if (!user?.user) throw new Error('Not authenticated')

  const { data: profile } = await supabase.from('profiles').select('credits').eq('id', user.user.id).single();
  if (!profile || profile.credits < 1) throw new Error("Crediti insufficienti!");

  const { error: creditError } = await supabase.from('profiles').update({ credits: profile.credits - 1 }).eq('id', user.user.id);
  if (creditError) throw new Error("Errore crediti");

  const code = Math.random().toString(36).substring(2, 8).toUpperCase()
  const { data: event, error } = await supabase.from('events').insert({
      owner_id: user.user.id, name: data.name, code: code, event_type: 'mixed', status: 'active', active_module: 'karaoke'
    }).select().single()

  if (error) throw error
  return { data: event }
}

export const recoverActiveEvent = async () => {
  const { data: user } = await supabase.auth.getUser();
  if (!user?.user) return null;
  const { data } = await supabase.from('events').select('*').eq('owner_id', user.user.id).eq('status', 'active').order('created_at', { ascending: false }).limit(1).maybeSingle();
  return data;
}

export const uploadLogo = async (file) => {
  const fileExt = file.name.split('.').pop();
  const fileName = `${Date.now()}.${fileExt}`;
  await supabase.storage.from('logos').upload(fileName, file, { upsert: true });
  const { data } = supabase.storage.from('logos').getPublicUrl(fileName);
  return data.publicUrl;
}

export const updateEventSettings = async (data) => {
  const event = await getAdminEvent();
  await supabase.from('events').update(data).eq('id', event.id);
  return { data: 'ok' };
}

export const getPub = async (pubCode) => {
  if (!pubCode) return { data: null };
  const { data, error } = await supabase.from('events').select('*').eq('code', pubCode.toUpperCase()).eq('status', 'active').single()
  if (error) throw error
  return { data }
}

export const joinPub = async ({ pub_code, nickname }) => {
  const { data: event, error: eventError } = await supabase.from('events').select('id, name').eq('code', pub_code.toUpperCase()).eq('status', 'active').single()
  if (eventError) throw eventError
  const { data: participant, error } = await supabase.from('participants').insert({ event_id: event.id, nickname: nickname }).select().single()
  if (error) { if (error.code === '23505') throw new Error('Nickname già in uso'); throw error }
  const token = btoa(JSON.stringify({ participant_id: participant.id, event_id: event.id, nickname: nickname, pub_name: event.name }))
  return { data: { token, user: { ...participant, pub_name: event.name } } }
}

export const adminLogin = async (data) => { return { data: { user: { email: data.email } } } }
export const getMe = async () => { const { data: { user } } = await supabase.auth.getUser(); return { data: user } }
export const getAllProfiles = async () => { const { data } = await supabase.from('profiles').select('*'); return { data }; }
export const updateProfileCredits = async (id, credits) => { await supabase.from('profiles').update({ credits }).eq('id', id); return { data: 'ok' }; }
export const createOperatorProfile = async () => { return { data: 'ok' }; }

// ============================================
// REGIA & STATO
// ============================================

export const getEventState = async () => {
  const pubCode = localStorage.getItem('neonpub_pub_code');
  if (!pubCode) return null;
  const { data } = await supabase.from('events').select('active_module, active_module_id').eq('code', pubCode).maybeSingle();
  return data;
};

// ** FUNZIONE CRUCIALE: RIPRISTINA IL KARAOKE E PULISCE I QUIZ **
export const restoreKaraokeMode = async () => {
    const event = await getAdminEvent();
    // 1. Chiude tutti i quiz
    await supabase.from('quizzes').update({ status: 'ended' }).eq('event_id', event.id);
    // 2. Imposta il modulo su karaoke
    await supabase.from('events').update({ active_module: 'karaoke', active_module_id: null }).eq('id', event.id);
    return { success: true };
}

export const setEventModule = async (moduleId, specificContentId = null) => {
  const pubCode = localStorage.getItem('neonpub_pub_code');
  const { data: event } = await supabase.from('events').update({ active_module: moduleId, active_module_id: specificContentId }).eq('code', pubCode).select().single();
  
  if (moduleId === 'quiz' && specificContentId) {
    const { data: catalogItem } = await supabase.from('quiz_catalog').select('*').eq('id', specificContentId).single();
    if (catalogItem) {
        await supabase.from('quizzes').update({ status: 'ended' }).eq('event_id', event.id).neq('status', 'ended');
        await supabase.from('quizzes').insert({
          event_id: event.id, category: catalogItem.category, question: catalogItem.question, options: catalogItem.options,
          correct_index: catalogItem.correct_index, points: catalogItem.points, status: 'active',
          media_url: catalogItem.media_url, media_type: catalogItem.media_type
        });
    }
  }
};

// ============================================
// CATALOGHI & IMPORT
// ============================================

export const getQuizCatalog = async () => {
  const { data } = await supabase.from('quiz_catalog').select('*').order('category');
  return { data: data || [] };
};

export const importQuizCatalog = async (jsonString) => {
    try {
        let items = JSON.parse(jsonString);
        if (!Array.isArray(items)) items = [items];
        const cleanItems = items.map(item => ({
             category: item.category || 'Generale',
             question: item.question,
             options: item.options,
             correct_index: item.correct_index ?? 0,
             points: item.points || 10,
             media_url: item.media_url || null,
             media_type: item.media_type || 'text'
        }));
        await supabase.from('quiz_catalog').insert(cleanItems);
        return { success: true, count: cleanItems.length };
    } catch (e) { throw new Error("Errore JSON"); }
}

export const getChallengeCatalog = async () => {
  const { data } = await supabase.from('challenge_catalog').select('*');
  return { data: data || [] };
};

// ============================================
// SONG REQUESTS & QUEUE
// ============================================

export const requestSong = async (data) => {
  const participant = getParticipantFromToken()
  const { data: request, error } = await supabase.from('song_requests').insert({
      event_id: participant.event_id, participant_id: participant.participant_id,
      title: data.title, artist: data.artist, youtube_url: data.youtube_url, status: 'pending'
    }).select().single()
  if (error) throw error
  return { data: request }
}

export const getSongQueue = async () => {
  const participant = getParticipantFromToken()
  const { data } = await supabase.from('song_requests').select('*, participants (nickname)').eq('event_id', participant.event_id).eq('status', 'queued').order('position', { ascending: true })
  return { data: (data || []).map(req => ({...req, user_nickname: req.participants?.nickname || 'Unknown'})) }
}

export const getMyRequests = async () => {
  const participant = getParticipantFromToken()
  const { data } = await supabase.from('song_requests').select('*').eq('participant_id', participant.participant_id).order('requested_at', { ascending: false })
  return { data }
}

export const getAdminQueue = async () => {
  const event = await getAdminEvent()
  const { data } = await supabase.from('song_requests').select('*, participants (nickname)').eq('event_id', event.id).in('status', ['pending', 'queued']).order('requested_at', { ascending: false })
  return { data: (data || []).map(req => ({...req, user_nickname: req.participants?.nickname || 'Unknown'})) }
}

export const approveRequest = async (requestId) => { await supabase.from('song_requests').update({ status: 'queued' }).eq('id', requestId); return { data: 'ok' } }
export const rejectRequest = async (requestId) => { await supabase.from('song_requests').update({ status: 'rejected' }).eq('id', requestId); return { data: 'ok' } }
export const deleteRequest = async (requestId) => { await supabase.from('song_requests').update({ status: 'rejected' }).eq('id', requestId); return { data: 'ok' } }

// ============================================
// PERFORMANCES (KARAOKE CONTROLS)
// ============================================

export const startPerformance = async (requestId, youtubeUrl) => {
  const { data: request } = await supabase.from('song_requests').select('*, participants(nickname)').eq('id', requestId).single()
  // Chiude performance precedenti
  await supabase.from('performances').update({ status: 'ended' }).eq('event_id', request.event_id).neq('status', 'ended');
  
  const { data: performance, error } = await supabase.from('performances').insert({
      event_id: request.event_id, song_request_id: request.id, participant_id: request.participant_id,
      song_title: request.title, song_artist: request.artist, youtube_url: youtubeUrl || request.youtube_url, status: 'live', average_score: 0 
    }).select().single()
  
  if (error) throw error
  await supabase.from('song_requests').update({ status: 'performing' }).eq('id', requestId)
  
  // FORZA MODULO KARAOKE
  await supabase.from('events').update({ active_module: 'karaoke' }).eq('id', request.event_id);
  
  return { data: performance }
}

export const endPerformance = async (performanceId) => {
  // Passa allo stato 'voting'
  await supabase.from('performances').update({ status: 'voting', ended_at: new Date().toISOString() }).eq('id', performanceId);
  return { data: 'ok' }
}

export const closeVoting = async (performanceId) => {
  // Calcola punteggio e chiude
  const { data: perf } = await supabase.from('performances').select('*, participants(score)').eq('id', performanceId).single();
  await supabase.from('performances').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('id', performanceId);
  
  if (perf && perf.song_request_id) {
      await supabase.from('song_requests').update({ status: 'ended' }).eq('id', perf.song_request_id);
  }
  // Aggiorna classifica generale
  if (perf && perf.participant_id && perf.average_score > 0) {
      const currentScore = perf.participants?.score || 0;
      await supabase.from('participants').update({ score: currentScore + perf.average_score }).eq('id', perf.participant_id);
  }
  return { data: 'ok' }
}

export const stopAndNext = async (performanceId) => {
    // Chiude brutalmente senza voto
    const { data: perf } = await supabase.from('performances').select('song_request_id').eq('id', performanceId).single();
    if (perf?.song_request_id) {
        await supabase.from('song_requests').update({ status: 'ended' }).eq('id', perf.song_request_id);
    }
    await supabase.from('performances').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('id', performanceId);
    return { data: 'ok' };
}

// -- CONTROLLI PLAY/PAUSA --
export const pausePerformance = async (performanceId) => {
  await supabase.from('performances').update({ status: 'paused' }).eq('id', performanceId);
  return { data: 'ok' };
}

export const resumePerformance = async (performanceId) => {
  await supabase.from('performances').update({ status: 'live' }).eq('id', performanceId);
  return { data: 'ok' };
}

export const restartPerformance = async (performanceId) => {
  // Prima update a restarted, poi subito live per triggerare il player
  await supabase.from('performances').update({ status: 'restarted', started_at: new Date().toISOString() }).eq('id', performanceId);
  await supabase.from('performances').update({ status: 'live' }).eq('id', performanceId);
  return { data: 'ok' };
}

export const toggleMute = async (isMuted) => {
    const pubCode = localStorage.getItem('neonpub_pub_code');
    const channel = supabase.channel(`display_control_${pubCode}`);
    await channel.send({ type: 'broadcast', event: 'control', payload: { command: 'mute', value: isMuted } });
}

export const getCurrentPerformance = async () => {
  const participant = getParticipantFromToken()
  const { data } = await supabase.from('performances').select('*, participants (nickname)').eq('event_id', participant.event_id).in('status', ['live', 'voting', 'paused', 'restarted']).order('started_at', { ascending: false }).limit(1).maybeSingle()
  return { data: data ? { ...data, user_nickname: data.participants?.nickname || 'Unknown' } : null }
}

export const getAdminCurrentPerformance = async () => {
  const event = await getAdminEvent()
  const { data } = await supabase.from('performances').select('*, participants (nickname)').eq('event_id', event.id).in('status', ['live', 'voting', 'paused', 'restarted']).order('started_at', { ascending: false }).limit(1).maybeSingle()
  return { data: data ? { ...data, user_nickname: data.participants?.nickname || 'Unknown' } : null }
}

// ============================================
// VOTO & MESSAGGI
// ============================================

export const submitVote = async (data) => {
  const participant = getParticipantFromToken();
  const { error } = await supabase.from('votes').insert({ performance_id: data.performance_id, participant_id: participant.participant_id, score: data.score });
  if (error && error.code === '23505') throw new Error('Hai già votato');
  
  // Calcolo media istantanea
  const { data: allVotes } = await supabase.from('votes').select('score').eq('performance_id', data.performance_id);
  if (allVotes && allVotes.length > 0) {
      const total = allVotes.reduce((acc, v) => acc + v.score, 0);
      const avg = total / allVotes.length;
      await supabase.from('performances').update({ average_score: avg }).eq('id', data.performance_id);
  }
  return { data: 'ok' };
}

export const sendReaction = async (data) => {
  const participant = getParticipantFromToken()
  await supabase.from('reactions').insert({ event_id: participant.event_id, participant_id: participant.participant_id, emoji: data.emoji, nickname: participant.nickname });
  return { data: 'ok' }
}

export const sendMessage = async (data) => {
  // Logica ibrida semplificata: se c'è token, è user. Se no, è admin (approvato subito)
  let status = 'pending';
  let pId = null;
  let eId = null;
  
  try {
     const p = getParticipantFromToken();
     pId = p.participant_id; eId = p.event_id;
  } catch {
     const pubCode = localStorage.getItem('neonpub_pub_code');
     if(pubCode) {
        const { data: event } = await supabase.from('events').select('id').eq('code', pubCode).single();
        if(event) { eId = event.id; status = 'approved'; }
     }
  }
  
  if(!eId) return;
  const text = typeof data === 'string' ? data : (data.text || data.message);
  await supabase.from('messages').insert({ event_id: eId, participant_id: pId, text: text, status: status });
  return { data: 'ok' }
}

export const getAdminPendingMessages = async () => {
  const event = await getAdminEvent()
  const { data } = await supabase.from('messages').select('*, participants(nickname)').eq('event_id', event.id).eq('status', 'pending')
  return { data: data.map(m => ({...m, user_nickname: m.participants?.nickname})) }
}

export const approveMessage = async (id) => { await supabase.from('messages').update({status:'approved'}).eq('id', id); return {data:'ok'} }
export const rejectMessage = async (id) => { await supabase.from('messages').update({status:'rejected'}).eq('id', id); return {data:'ok'} }

// ============================================
// QUIZ & DISPLAY
// ============================================

export const startQuiz = async (data) => {
  const event = await getAdminEvent()
  await supabase.from('quizzes').update({ status: 'ended' }).eq('event_id', event.id);
  const { data: quiz } = await supabase.from('quizzes').insert({
    event_id: event.id, category: data.category, question: data.question, options: data.options,
    correct_index: data.correct_index, points: data.points, status: 'active',
    media_url: data.media_url || null, media_type: data.media_type || 'text'
  }).select().single()
  
  await supabase.from('events').update({ active_module: 'quiz' }).eq('id', event.id);
  return { data: quiz }
}

export const closeQuizVoting = async (quizId) => { await supabase.from('quizzes').update({ status: 'closed' }).eq('id', quizId); return { data: 'ok' }; }
export const showQuizResults = async (quizId) => { await supabase.from('quizzes').update({ status: 'showing_results' }).eq('id', quizId); return { data: 'ok' } }
export const showQuizLeaderboard = async (quizId) => { await supabase.from('quizzes').update({ status: 'leaderboard' }).eq('id', quizId); return { data: 'ok' } }
export const endQuiz = async (id) => { 
    await supabase.from('quizzes').update({status: 'ended', ended_at: new Date().toISOString()}).eq('id', id); 
    return { data: 'ok' } 
}

export const getQuizResults = async (quizId) => {
  const { data: quiz } = await supabase.from('quizzes').select('*').eq('id', quizId).single()
  const { data: answers } = await supabase.from('quiz_answers').select('*, participants(nickname)').eq('quiz_id', quizId)
  const correctAnswers = answers.filter(a => a.is_correct)
  return {
    data: {
      quiz_id: quizId, question: quiz.question, correct_option: quiz.options[quiz.correct_index],
      total_answers: answers.length, winners: correctAnswers.map(a => a.participants?.nickname || 'Unknown')
    }
  }
}

export const answerQuiz = async (data) => {
  const participant = getParticipantFromToken()
  const { data: quiz } = await supabase.from('quizzes').select('correct_index, points').eq('id', data.quiz_id).single();
  const isCorrect = quiz.correct_index === data.answer_index;
  const pointsEarned = isCorrect ? quiz.points : 0;
  
  await supabase.from('quiz_answers').insert({
    quiz_id: data.quiz_id, participant_id: participant.participant_id, answer_index: data.answer_index, is_correct: isCorrect
  });

  if (isCorrect) {
      const { data: p } = await supabase.from('participants').select('score').eq('id', participant.participant_id).single();
      await supabase.from('participants').update({ score: (p.score || 0) + pointsEarned }).eq('id', participant.participant_id);
  }
  return { data: { points_earned: pointsEarned } }
}

export const getActiveQuiz = async () => {
  try {
      const participant = getParticipantFromToken()
      const { data } = await supabase.from('quizzes').select('*').eq('event_id', participant.event_id).in('status', ['active', 'closed', 'showing_results', 'leaderboard']).maybeSingle()
      return { data }
  } catch { return { data: null }; }
}

export const getLeaderboard = async () => {
  const participant = getParticipantFromToken()
  const { data } = await supabase.from('participants').select('id, nickname, score').eq('event_id', participant.event_id).order('score', {ascending:false}).limit(20)
  return { data }
}

export const getDisplayData = async (pubCode) => {
  const { data: event } = await supabase.from('events').select('*').eq('code', pubCode.toUpperCase()).single()
  const [perf, queue, lb, activeQuiz, msg] = await Promise.all([
    supabase.from('performances').select('*, participants(nickname)').eq('event_id', event.id).in('status', ['live','voting','paused','restarted']).maybeSingle(),
    supabase.from('song_requests').select('*, participants(nickname)').eq('event_id', event.id).eq('status', 'queued').limit(10), 
    supabase.from('participants').select('nickname, score').eq('event_id', event.id).order('score', {ascending:false}).limit(5),
    supabase.from('quizzes').select('*').eq('event_id', event.id).in('status', ['active', 'closed', 'showing_results', 'leaderboard']).maybeSingle(),
    supabase.from('messages').select('*').eq('event_id', event.id).eq('status', 'approved').order('created_at', {ascending: false}).limit(1).maybeSingle()
  ])
  return {
    data: {
      pub: event,
      current_performance: perf.data ? {...perf.data, user_nickname: perf.data.participants?.nickname} : null,
      queue: queue.data?.map(q => ({...q, user_nickname: q.participants?.nickname})),
      leaderboard: lb.data,
      active_quiz: activeQuiz.data,
      latest_message: msg.data
    }
  }
}

export default {
  createPub, updateEventSettings, uploadLogo, getPub, joinPub, adminLogin, getMe,
  getAllProfiles, updateProfileCredits, createOperatorProfile,
  getEventState, setEventModule, restoreKaraokeMode, // <-- NUOVO EXPORT
  getQuizCatalog, importQuizCatalog, getChallengeCatalog,
  requestSong, getSongQueue, getMyRequests, getAdminQueue, approveRequest, rejectRequest, deleteRequest,
  startPerformance, pausePerformance, resumePerformance, endPerformance, closeVoting, stopAndNext, restartPerformance, toggleMute,
  getCurrentPerformance, getAdminCurrentPerformance,
  submitVote, sendReaction,
  sendMessage, getAdminPendingMessages, approveMessage, rejectMessage,
  startQuiz, endQuiz, answerQuiz, getActiveQuiz, closeQuizVoting, showQuizResults, showQuizLeaderboard,
  getQuizResults, getLeaderboard, getDisplayData, recoverActiveEvent
}