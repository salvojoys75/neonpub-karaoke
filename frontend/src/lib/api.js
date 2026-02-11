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
  if (data.status === 'ended' || (data.expires_at && new Date(data.expires_at) < new Date())) {
      throw new Error("Evento scaduto");
  }

  return data
}

// ============================================
// AUTH & EVENTS & STORAGE
// ============================================

export const createPub = async (data) => {
  const { data: user } = await supabase.auth.getUser()
  if (!user?.user) throw new Error('Not authenticated')

  const { data: profile } = await supabase.from('profiles').select('credits, is_active').eq('id', user.user.id).single();
  
  if (!profile || !profile.is_active) throw new Error("Utente disabilitato o non trovato.");
  if (profile.credits < 1) throw new Error("Crediti insufficienti! Ricarica i crediti per creare un evento.");

  const { error: creditError } = await supabase.from('profiles')
    .update({ credits: profile.credits - 1 })
    .eq('id', user.user.id);
  
  if (creditError) throw new Error("Errore aggiornamento crediti");

  const code = Math.random().toString(36).substring(2, 8).toUpperCase()
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 8);

  const { data: event, error } = await supabase
    .from('events')
    .insert({
      owner_id: user.user.id,
      name: data.name,
      code: code,
      event_type: 'mixed',
      status: 'active',
      active_module: 'karaoke',
      expires_at: expiresAt.toISOString()
    })
    .select()
    .single()

  if (error) throw error
  return { data: event }
}

export const getActiveEventsForUser = async () => {
  const { data: user } = await supabase.auth.getUser();
  if (!user?.user) return [];

  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('owner_id', user.user.id)
    .eq('status', 'active')
    .gt('expires_at', now)
    .order('created_at', { ascending: false });

  if (error) console.error("Error fetching active events:", error);
  
  closeExpiredEvents(user.user.id);

  return data || [];
}

const closeExpiredEvents = async (ownerId) => {
    const now = new Date().toISOString();
    await supabase.from('events')
        .update({ status: 'ended' })
        .eq('owner_id', ownerId)
        .eq('status', 'active')
        .lte('expires_at', now);
}

export const uploadLogo = async (file) => {
  if (!file) throw new Error("Nessun file selezionato");
  const fileExt = file.name.split('.').pop();
  const cleanName = file.name.replace(/[^a-zA-Z0-9]/g, '_');
  const fileName = `${Date.now()}_${cleanName}.${fileExt}`;
  const { error: uploadError } = await supabase.storage.from('logos').upload(fileName, file, { upsert: true });
  if (uploadError) throw uploadError;
  const { data } = supabase.storage.from('logos').getPublicUrl(fileName);
  return data.publicUrl;
}

export const updateEventSettings = async (data) => {
  const event = await getAdminEvent();
  const updatePayload = { name: data.name };
  if (data.logo_url) updatePayload.logo_url = data.logo_url;
  const { error } = await supabase.from('events').update(updatePayload).eq('id', event.id);
  if (error) throw error;
  return { data: 'ok' };
}

export const getPub = async (pubCode) => {
  if (!pubCode) return { data: null };
  const { data, error } = await supabase.from('events')
      .select('*')
      .eq('code', pubCode.toUpperCase())
      .single();

  if (error || !data) return { data: null };
  
  if (data.status === 'ended' || (data.expires_at && new Date(data.expires_at) < new Date())) {
      return { data: null, expired: true };
  }

  return { data }
}

export const joinPub = async ({ pub_code, nickname }) => {
  const { data: event, error: eventError } = await supabase.from('events').select('id, name, status, expires_at').eq('code', pub_code.toUpperCase()).single()
  
  if (eventError || !event) throw new Error("Evento non trovato");
  if (event.status !== 'active' || (event.expires_at && new Date(event.expires_at) < new Date())) {
      throw new Error("Evento scaduto o terminato");
  }

  const { data: participant, error } = await supabase.from('participants').insert({ event_id: event.id, nickname: nickname }).select().single()
  if (error) { if (error.code === '23505') throw new Error('Nickname già in uso'); throw error }
  const token = btoa(JSON.stringify({ participant_id: participant.id, event_id: event.id, nickname: nickname, pub_name: event.name }))
  return { data: { token, user: { ...participant, pub_name: event.name } } }
}

export const adminLogin = async (data) => { return { data: { user: { email: data.email } } } }
export const getMe = async () => { const { data: { user } } = await supabase.auth.getUser(); return { data: user } }

// === SUPER ADMIN ===
export const getAllProfiles = async () => {
    const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return { data };
}

export const updateProfileCredits = async (id, credits) => {
    const val = parseInt(credits, 10);
    if (isNaN(val)) throw new Error("Invalid credit amount");
    const { error } = await supabase.from('profiles').update({ credits: val }).eq('id', id);
    if (error) throw error;
    return { data: 'ok' };
}

export const toggleUserStatus = async (id, isActive) => {
    const { error } = await supabase.from('profiles').update({ is_active: isActive }).eq('id', id);
    if (error) throw error;
    return { data: 'ok' };
}

export const createOperatorProfile = async (email, name, password, initialCredits) => {
    const { data, error } = await supabase.rpc('create_operator_profile', {
        operator_email: email,
        operator_name: name,
        operator_password: password,
        initial_credits: initialCredits
    });
    if (error) throw error;
    return { data };
}

// ============================================
// EVENT STATE
// ============================================

export const getEventState = async () => {
  const event = await getAdminEvent()
  return { data: { active_module: event.active_module } }
}

export const setEventModule = async (module) => {
  const event = await getAdminEvent()
  const { error } = await supabase.from('events').update({ active_module: module }).eq('id', event.id)
  if (error) throw error; return { data: 'ok' }
}

// ============================================
// CATALOGHI (QUIZ, SFIDE)
// ============================================

export const getQuizCatalog = async () => {
  const event = await getAdminEvent()
  const { data, error } = await supabase.from('quiz_catalog').select('*').eq('event_id', event.id).order('created_at', { ascending: false })
  if (error) throw error; return { data }
}

export const getChallengeCatalog = async () => {
  const event = await getAdminEvent()
  const { data, error } = await supabase.from('challenge_catalog').select('*').eq('event_id', event.id)
  if (error) throw error; return { data }
}

export const importQuizCatalog = async (questions) => {
    const event = await getAdminEvent();
    const items = questions.map(q => ({
        event_id: event.id,
        category: q.category,
        question: q.question,
        options: q.options,
        correct_index: q.correct_index,
        media_url: q.media_url || null,
        media_type: q.media_type || 'text'
    }));
    const { data, error } = await supabase.from('quiz_catalog').insert(items);
    if (error) throw error;
    return { data: 'ok' };
}

export const deleteQuizQuestion = async (id) => {
    const { error } = await supabase.from('quiz_catalog').delete().eq('id', id);
    if (error) throw error;
    return { data: 'ok' };
}

// ============================================
// KARAOKE
// ============================================

export const requestSong = async (data) => {
  const participant = getParticipantFromToken()
  const { data: req, error } = await supabase.from('song_requests').insert({
    event_id: participant.event_id, participant_id: participant.participant_id,
    song_title: data.song_title, song_artist: data.song_artist, youtube_url: data.youtube_url,
    status: 'pending'
  }).select().single()
  if (error) throw error; return { data: req }
}

export const getSongQueue = async () => {
  const participant = getParticipantFromToken()
  const { data, error } = await supabase.from('song_requests').select('*').eq('event_id', participant.event_id).eq('status', 'queued').order('approved_at')
  if (error) throw error; return { data }
}

export const getMyRequests = async () => {
  const participant = getParticipantFromToken()
  const { data, error } = await supabase.from('song_requests').select('*').eq('participant_id', participant.participant_id).order('created_at', { ascending: false })
  if (error) throw error; return { data }
}

export const getAdminQueue = async () => {
  const event = await getAdminEvent()
  const { data, error } = await supabase.from('song_requests').select('*, participants(nickname)').eq('event_id', event.id).in('status', ['pending', 'queued']).order('created_at')
  if (error) throw error; return { data: data.map(r => ({...r, user_nickname: r.participants?.nickname})) }
}

export const approveRequest = async (id) => {
  const { error } = await supabase.from('song_requests').update({ status: 'queued', approved_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error; return { data: 'ok' }
}

export const rejectRequest = async (id) => {
  const { error } = await supabase.from('song_requests').update({ status: 'rejected' }).eq('id', id)
  if (error) throw error; return { data: 'ok' }
}

export const deleteRequest = async (id) => {
  const { error } = await supabase.from('song_requests').delete().eq('id', id)
  if (error) throw error; return { data: 'ok' }
}

// ============================================
// PERFORMANCE (KARAOKE)
// ============================================

export const startPerformance = async (data) => {
  const event = await getAdminEvent()
  
  await supabase.from('performances').update({ status: 'ended' }).eq('event_id', event.id).in('status', ['live', 'paused'])
  await supabase.from('quizzes').update({ status: 'ended' }).eq('event_id', event.id).neq('status', 'ended')

  const { data: perf, error } = await supabase.from('performances').insert({
    event_id: event.id, request_id: data.request_id, participant_id: data.participant_id,
    song_title: data.song_title, song_artist: data.song_artist, video_url: data.video_url,
    status: 'live', started_at: new Date().toISOString()
  }).select().single()
  if (error) throw error
  
  await supabase.from('song_requests').update({ status: 'playing' }).eq('id', data.request_id)
  await supabase.from('events').update({ active_module: 'karaoke' }).eq('id', event.id)
  
  return { data: perf }
}

export const pausePerformance = async (perfId) => {
  const { data, error } = await supabase.from('performances').update({ status: 'paused' }).eq('id', perfId).select()
  if (error) throw error; return { data }
}

export const resumePerformance = async (perfId) => {
  const { data, error } = await supabase.from('performances').update({ status: 'live' }).eq('id', perfId).select()
  if (error) throw error; return { data }
}

export const endPerformance = async (perfId) => {
  const { data, error } = await supabase.from('performances').update({ status: 'voting' }).eq('id', perfId).select()
  if (error) throw error; return { data }
}

export const closeVoting = async (perfId) => {
  const { data: votes, error: votesError } = await supabase.from('votes').select('stars').eq('performance_id', perfId)
  if (votesError) throw votesError
  
  const avg = votes.length > 0 ? votes.reduce((sum, v) => sum + v.stars, 0) / votes.length : 0
  
  const { data, error } = await supabase.from('performances').update({
    status: 'ended', ended_at: new Date().toISOString(), average_score: avg
  }).eq('id', perfId).select()
  if (error) throw error
  
  const { data: perf } = await supabase.from('performances').select('*, participants(id, score)').eq('id', perfId).single()
  if (perf && perf.participants) {
    const earnedPoints = Math.floor(avg * 20)
    await supabase.from('participants').update({ score: (perf.participants.score || 0) + earnedPoints }).eq('id', perf.participant_id)
  }
  
  return { data }
}

export const stopAndNext = async (perfId) => {
  await closeVoting(perfId)
  return { data: 'ok' }
}

export const restartPerformance = async (perfId) => {
  const { data, error } = await supabase.from('performances').update({ started_at: new Date().toISOString() }).eq('id', perfId).select()
  if (error) throw error; return { data }
}

export const toggleMute = async (value) => {
  const event = await getAdminEvent()
  await supabase.channel('tv_ctrl').send({ type: 'broadcast', event: 'control', payload: { command: 'mute', value } })
  return { data: 'ok' }
}

export const getCurrentPerformance = async () => {
  const participant = getParticipantFromToken()
  const { data, error } = await supabase.from('performances').select('*').eq('event_id', participant.event_id).in('status', ['live', 'voting', 'paused', 'ended']).order('started_at', { ascending: false }).limit(1).maybeSingle()
  if (error) throw error; return { data }
}

export const getAdminCurrentPerformance = async () => {
  const event = await getAdminEvent()
  const { data, error } = await supabase.from('performances').select('*').eq('event_id', event.id).in('status', ['live', 'voting', 'paused', 'ended']).order('started_at', { ascending: false }).limit(1).maybeSingle()
  if (error) throw error; return { data }
}

// ============================================
// VOTING & REACTIONS
// ============================================

export const submitVote = async (data) => {
  const participant = getParticipantFromToken()
  const { data: vote, error } = await supabase.from('votes').insert({
    performance_id: data.performance_id, participant_id: participant.participant_id, stars: data.stars
  }).select().single()
  if (error) { if (error.code === '23505') throw new Error('Hai già votato'); throw error }
  return { data: vote }
}

export const sendReaction = async (data) => {
  const participant = getParticipantFromToken()
  const { data: reaction, error } = await supabase.from('reactions').insert({
    event_id: participant.event_id, participant_id: participant.participant_id, emoji: data.emoji
  }).select().single()
  if (error) throw error; return { data: reaction }
}

// ============================================
// MESSAGES
// ============================================

export const sendMessage = async (data) => {
  let participantId = null;
  let eventId = null;
  let status = 'pending';

  try {
     const p = getParticipantFromToken(); 
     participantId = p.participant_id;
     eventId = p.event_id;
  } catch (e) {
     const pubCode = localStorage.getItem('neonpub_pub_code');
     if(pubCode) {
        const { data: event } = await supabase.from('events').select('id').eq('code', pubCode).single();
        if(event) {
           eventId = event.id;
           status = 'approved'; 
        }
     }
  }

  if (!eventId) throw new Error("Errore contesto evento: ricarica la pagina");
  
  const text = typeof data === 'string' ? data : (data.text || data.message);
  
  const { data: message, error } = await supabase.from('messages').insert({
      event_id: eventId, participant_id: participantId, text: text, status: status
    }).select().single()

  if (error) throw error
  return { data: message }
}

export const getAdminPendingMessages = async () => {
  const event = await getAdminEvent()
  const { data, error } = await supabase.from('messages').select('*, participants(nickname)').eq('event_id', event.id).eq('status', 'pending')
  if (error) throw error
  return { data: data.map(m => ({...m, user_nickname: m.participants?.nickname})) }
}

export const approveMessage = async (id) => {
  const { error } = await supabase.from('messages').update({status:'approved'}).eq('id', id);
  if (error) throw error; return {data:'ok'}
}

export const rejectMessage = async (id) => {
  const { error } = await supabase.from('messages').update({status:'rejected'}).eq('id', id);
  if (error) throw error; return {data:'ok'}
}

// ============================================
// QUIZ & DISPLAY DATA
// ============================================

export const startQuiz = async (data) => {
  const event = await getAdminEvent()
  
  await supabase.from('performances').update({ status: 'ended' }).eq('event_id', event.id).in('status', ['live','paused']);
  await supabase.from('quizzes').update({ status: 'ended' }).eq('event_id', event.id).neq('status', 'ended');

  const { data: quiz, error } = await supabase.from('quizzes').insert({
    event_id: event.id, 
    category: data.category, 
    question: data.question, 
    options: data.options, 
    correct_index: data.correct_index, 
    points: data.points, 
    status: 'active',
    media_url: data.media_url || null,
    media_type: data.media_type || 'text'
  }).select().single()
  
  if (error) throw error; 
  await supabase.from('events').update({ active_module: 'quiz' }).eq('id', event.id);
  return { data: quiz }
}

export const closeQuizVoting = async (quizId) => {
  const { data, error } = await supabase.from('quizzes').update({ status: 'closed' }).eq('id', quizId).select()
  if (error) throw error; return { data };
}

export const showQuizResults = async (quizId) => {
  const { data, error } = await supabase.from('quizzes').update({ status: 'showing_results' }).eq('id', quizId).select().single()
  if (error) throw error; return { data }
}

export const showQuizLeaderboard = async (quizId) => {
    const { data, error } = await supabase.from('quizzes').update({ status: 'leaderboard' }).eq('id', quizId).select().single()
    if (error) throw error; return { data }
}

export const endQuiz = async (id) => {
  const { error } = await supabase.from('quizzes').update({status: 'ended', ended_at: new Date().toISOString()}).eq('id', id);
  if (error) throw error; return { data: 'ok' }
}

export const getQuizResults = async (quizId) => {
  const { data: quiz } = await supabase.from('quizzes').select('*').eq('id', quizId).single()
  const { data: answers, error } = await supabase.from('quiz_answers').select('*, participants(id, nickname, avatar_url)').eq('quiz_id', quizId)
  if (error) throw error
  const correctAnswers = answers.filter(a => a.is_correct)
  return {
    data: {
      quiz_id: quizId, 
      question: quiz.question, 
      correct_option: quiz.options[quiz.correct_index], 
      correct_index: quiz.correct_index,
      total_answers: answers.length, 
      correct_count: correctAnswers.length, 
      winners: correctAnswers.map(a => ({
        id: a.participants?.id,
        nickname: a.participants?.nickname || 'Unknown',
        avatar: a.participants?.avatar_url || null,
        points: quiz.points
      })),
      points: quiz.points
    }
  }
}

export const answerQuiz = async (data) => {
  const participant = getParticipantFromToken()
  const { data: quiz, error: quizError } = await supabase.from('quizzes').select('correct_index, points').eq('id', data.quiz_id).single();
  if (quizError) throw quizError;
  const isCorrect = quiz.correct_index === data.answer_index;
  const pointsEarned = isCorrect ? quiz.points : 0;
  const { data: ans, error } = await supabase.from('quiz_answers').insert({
    quiz_id: data.quiz_id, participant_id: participant.participant_id, answer_index: data.answer_index, is_correct: isCorrect
  }).select().single()
  if (error) { if (error.code==='23505') throw new Error('Già risposto'); throw error; }
  if (isCorrect) {
      const { data: p } = await supabase.from('participants').select('score').eq('id', participant.participant_id).single();
      if (p) {
          await supabase.from('participants').update({ score: (p.score || 0) + pointsEarned }).eq('id', participant.participant_id);
      }
  }
  return { data: { ...ans, points_earned: pointsEarned } }
}

export const getActiveQuiz = async () => {
  try {
      const participant = getParticipantFromToken()
      const { data, error } = await supabase.from('quizzes').select('*').eq('event_id', participant.event_id).in('status', ['active', 'closed', 'showing_results', 'leaderboard']).maybeSingle()
      if (error) throw error; return { data }
  } catch (e) {
      const event = await getAdminEvent();
      const { data } = await supabase.from('quizzes').select('*').eq('event_id', event.id).in('status', ['active', 'closed', 'showing_results', 'leaderboard']).maybeSingle()
      return { data };
  }
}

export const getLeaderboard = async () => {
  const participant = getParticipantFromToken()
  const { data, error } = await supabase.from('participants').select('id, nickname, score').eq('event_id', participant.event_id).order('score', {ascending:false}).limit(20)
  if (error) throw error; return { data }
}

export const getAdminLeaderboard = async () => {
  const event = await getAdminEvent()
  const { data, error } = await supabase.from('participants').select('id, nickname, score').eq('event_id', event.id).order('score', {ascending:false}).limit(20)
  if (error) throw error; return { data }
}

export const getDisplayData = async (pubCode) => {
  const { data: event } = await supabase.from('events').select('*').eq('code', pubCode.toUpperCase()).single()
  
  if (!event || event.status === 'ended' || (event.expires_at && new Date(event.expires_at) < new Date())) {
      return { data: null };
  }

  const [perf, queue, lb, activeQuiz, msg, approvedMsgs] = await Promise.all([
    supabase.from('performances').select('*, participants(nickname)').eq('event_id', event.id).in('status', ['live','voting','paused','ended']).order('started_at', {ascending: false}).limit(1).maybeSingle(),
    supabase.from('song_requests').select('*, participants(nickname)').eq('event_id', event.id).eq('status', 'queued').limit(10), 
    supabase.from('participants').select('nickname, score').eq('event_id', event.id).order('score', {ascending:false}).limit(20),
    supabase.from('quizzes').select('*').eq('event_id', event.id).in('status', ['active', 'closed', 'showing_results', 'leaderboard']).maybeSingle(),
    supabase.from('messages').select('*').eq('event_id', event.id).eq('status', 'approved').order('created_at', {ascending: false}).limit(1).maybeSingle(),
    supabase.from('messages').select('*, participants(nickname)').eq('event_id', event.id).eq('status', 'approved').order('created_at', {ascending: false}).limit(5)
  ])
  return {
    data: {
      pub: event,
      current_performance: perf.data ? {...perf.data, user_nickname: perf.data.participants?.nickname} : null,
      queue: queue.data?.map(q => ({...q, user_nickname: q.participants?.nickname})),
      leaderboard: lb.data,
      active_quiz: activeQuiz.data,
      latest_message: msg.data,
      approved_messages: approvedMsgs.data?.map(m => ({text: m.text, nickname: m.participants?.nickname})) || []
    }
  }
}

export default {
  createPub, updateEventSettings, uploadLogo, getPub, joinPub, adminLogin, getMe,
  getAllProfiles, updateProfileCredits, createOperatorProfile, toggleUserStatus,
  getEventState, setEventModule, getQuizCatalog, getChallengeCatalog, importQuizCatalog,
  requestSong, getSongQueue, getMyRequests, getAdminQueue, approveRequest, rejectRequest, deleteRequest,
  startPerformance, pausePerformance, resumePerformance, endPerformance, closeVoting, stopAndNext, restartPerformance, toggleMute,
  getCurrentPerformance, getAdminCurrentPerformance,
  submitVote, sendReaction,
  sendMessage, getAdminPendingMessages, approveMessage, rejectMessage,
  startQuiz, endQuiz, answerQuiz, getActiveQuiz, closeQuizVoting, showQuizResults, showQuizLeaderboard,
  getQuizResults, getAdminLeaderboard,
  getLeaderboard, getDisplayData,
  getActiveEventsForUser,
  deleteQuizQuestion
}