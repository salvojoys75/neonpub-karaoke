// src/lib/api.js - VERSIONE COMPLETA CON LIBRERIA E SFIDE
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
// AUTH & PROFILES
// ============================================

export const createPub = async (data) => {
  const { data: user } = await supabase.auth.getUser()
  if (!user?.user) throw new Error('Not authenticated')

  const code = Math.random().toString(36).substring(2, 8).toUpperCase()

  const { data: event, error } = await supabase
    .from('events')
    .insert({
      owner_id: user.user.id,
      name: data.name,
      code: code,
      event_type: 'mixed',
      status: 'active'
    })
    .select()
    .single()

  if (error) throw error
  return { data: event }
}

export const getPub = async (pubCode) => {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('code', pubCode.toUpperCase())
    .eq('status', 'active')
    .single()

  if (error) throw error
  return { data }
}

export const joinPub = async ({ pub_code, nickname }) => {
  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('id, name')
    .eq('code', pub_code.toUpperCase())
    .eq('status', 'active')
    .single()

  if (eventError) throw eventError

  const { data: participant, error } = await supabase
    .from('participants')
    .insert({ event_id: event.id, nickname: nickname })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') throw new Error('Nickname già in uso')
    throw error
  }

  const token = btoa(JSON.stringify({ 
    participant_id: participant.id, 
    event_id: event.id,
    nickname: nickname,
    pub_name: event.name
  }))

  return { data: { token, user: { ...participant, pub_name: event.name } } }
}

export const adminLogin = async (data) => { return { data: { user: { email: data.email } } } }
export const getMe = async () => { const { data: { user } } = await supabase.auth.getUser(); return { data: user } }

// ============================================
// SONG REQUESTS
// ============================================

export const requestSong = async (data) => {
  const participant = getParticipantFromToken()
  const { data: request, error } = await supabase
    .from('song_requests')
    .insert({
      event_id: participant.event_id,
      participant_id: participant.participant_id,
      title: data.title,
      artist: data.artist,
      youtube_url: data.youtube_url,
      status: 'pending'
    }).select().single()
  if (error) throw error
  return { data: request }
}

export const getSongQueue = async () => {
  const participant = getParticipantFromToken()
  const { data, error } = await supabase
    .from('song_requests')
    .select(`*, participants (nickname)`)
    .eq('event_id', participant.event_id)
    .in('status', ['pending', 'queued', 'approved'])
    .order('position', { ascending: true })
  if (error) throw error
  return { data: (data || []).map(req => ({...req, user_nickname: req.participants?.nickname || 'Unknown'})) }
}

export const getMyRequests = async () => {
  const participant = getParticipantFromToken()
  const { data, error } = await supabase.from('song_requests').select('*').eq('participant_id', participant.participant_id).order('requested_at', { ascending: false })
  if (error) throw error; return { data }
}

export const getAdminQueue = async () => {
  const event = await getAdminEvent()
  const { data, error } = await supabase.from('song_requests').select(`*, participants (nickname)`).eq('event_id', event.id).order('requested_at', { ascending: false })
  if (error) throw error
  return { data: (data || []).map(req => ({...req, user_nickname: req.participants?.nickname || 'Unknown'})) }
}

export const approveRequest = async (requestId) => {
  const { data, error } = await supabase.from('song_requests').update({ status: 'queued' }).eq('id', requestId).select()
  if (error) throw error; return { data }
}

export const rejectRequest = async (requestId) => {
  const { data, error } = await supabase.from('song_requests').update({ status: 'rejected' }).eq('id', requestId).select()
  if (error) throw error; return { data }
}

// ============================================
// PERFORMANCES & CHALLENGES CONTROL
// ============================================

export const startPerformance = async (requestId, youtubeUrl) => {
  const { data: request } = await supabase.from('song_requests').select('*, participants(nickname)').eq('id', requestId).single()
  const { data: performance, error } = await supabase
    .from('performances')
    .insert({
      event_id: request.event_id,
      song_request_id: request.id,
      participant_id: request.participant_id,
      song_title: request.title,
      song_artist: request.artist,
      youtube_url: youtubeUrl || request.youtube_url,
      status: 'live'
    }).select().single()
  if (error) throw error
  await supabase.from('song_requests').update({ status: 'performing' }).eq('id', requestId)
  return { data: performance }
}

export const endPerformance = async (performanceId) => {
  const { data, error } = await supabase.from('performances').update({ status: 'voting', ended_at: new Date().toISOString() }).eq('id', performanceId).select()
  if (error) throw error; return { data }
}

export const closeVoting = async (performanceId) => {
  const { data, error } = await supabase.from('performances').update({ status: 'ended' }).eq('id', performanceId).select()
  if (error) throw error; return { data }
}

export const pausePerformance = async (performanceId) => {
  const { data, error } = await supabase.from('performances').update({ status: 'paused' }).eq('id', performanceId).select()
  if (error) throw error; return { data };
}

export const resumePerformance = async (performanceId) => {
  const { data, error } = await supabase.from('performances').update({ status: 'live' }).eq('id', performanceId).select()
  if (error) throw error; return { data };
}

export const restartPerformance = async (performanceId) => {
  const { data, error } = await supabase.from('performances').update({ status: 'restarted', started_at: new Date().toISOString() }).eq('id', performanceId).select()
  if (error) throw error;
  await supabase.from('performances').update({ status: 'live' }).eq('id', performanceId);
  return { data };
}

export const skipPerformance = async (performanceId) => {
  const { data, error } = await supabase.from('performances').update({ status: 'ended' }).eq('id', performanceId).select()
  if (error) throw error; return { data };
}

// --- NUOVI COMANDI SFIDE (Mute / Blur) ---
export const togglePerformanceMute = async (performanceId, isMuted) => {
  const { data, error } = await supabase.from('performances').update({ is_muted: isMuted }).eq('id', performanceId).select();
  if (error) throw error; return { data };
}

export const togglePerformanceBlur = async (performanceId, isBlurred) => {
  const { data, error } = await supabase.from('performances').update({ is_blurred: isBlurred }).eq('id', performanceId).select();
  if (error) throw error; return { data };
}

export const getCurrentPerformance = async () => {
  const participant = getParticipantFromToken()
  const { data, error } = await supabase.from('performances').select(`*, participants (nickname)`).eq('event_id', participant.event_id).in('status', ['live', 'voting', 'paused']).order('started_at', { ascending: false }).limit(1).maybeSingle()
  if (error) throw error
  return { data: data ? { ...data, user_nickname: data.participants?.nickname || 'Unknown' } : null }
}

export const getAdminCurrentPerformance = async () => {
  const event = await getAdminEvent()
  const { data, error } = await supabase.from('performances').select(`*, participants (nickname)`).eq('event_id', event.id).in('status', ['live', 'voting', 'paused']).order('started_at', { ascending: false }).limit(1).maybeSingle()
  if (error) throw error
  return { data: data ? { ...data, user_nickname: data.participants?.nickname || 'Unknown' } : null }
}

// ============================================
// VOTING & MESSAGES
// ============================================

export const submitVote = async (data) => {
  const participant = getParticipantFromToken()
  const { data: vote, error } = await supabase.from('votes').insert({
      performance_id: data.performance_id,
      participant_id: participant.participant_id,
      score: data.score
    }).select().single()
  if (error) { if (error.code === '23505') throw new Error('Hai già votato'); throw error; }
  return { data: vote }
}

export const sendReaction = async (data) => {
  const participant = getParticipantFromToken()
  const { data: reaction, error } = await supabase.from('reactions').insert({
      event_id: participant.event_id,
      participant_id: participant.participant_id,
      emoji: data.emoji,
      nickname: participant.nickname 
    }).select().single()
  if (error) throw error
  return { data: reaction }
}

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
           status = data.status || 'pending';
        }
     }
  }

  if (!eventId) throw new Error("Errore contesto evento: ricarica la pagina");
  const text = typeof data === 'string' ? data : (data.text || data.message);
  
  const { data: message, error } = await supabase
    .from('messages')
    .insert({
      event_id: eventId,
      participant_id: participantId,
      text: text,
      status: status
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
// QUIZ LIBRARY & LIVE (NUOVO)
// ============================================

// 1. Importazione massiva (ChatGPT -> DB)
export const importQuizBatch = async (jsonData) => {
  const { data, error } = await supabase.from('quiz_library').insert(jsonData).select();
  if (error) throw error; return { data };
}

// 2. Lettura libreria
export const getLibraryQuizzes = async (category = null) => {
  let query = supabase.from('quiz_library').select('*');
  if (category) query = query.eq('category', category);
  const { data, error } = await query.limit(50);
  if (error) throw error; return { data };
}

// 3. Lancio quiz dalla libreria
export const launchQuizFromLibrary = async (libraryId) => {
  const event = await getAdminEvent();
  
  // Prendi template
  const { data: template } = await supabase.from('quiz_library').select('*').eq('id', libraryId).single();
    
  // Crea quiz attivo
  const { data: activeQuiz, error } = await supabase.from('quizzes').insert({
      event_id: event.id,
      category: template.category,
      question: template.question,
      options: template.options,
      correct_index: template.correct_index,
      media_url: template.media_url, // Supporto media
      points: template.points,
      status: 'active'
    }).select().single();

  if (error) throw error; return { data: activeQuiz };
}

// 4. Lancio quiz manuale (vecchio metodo)
export const startQuiz = async (data) => {
  const event = await getAdminEvent()
  const { data: quiz, error } = await supabase.from('quizzes').insert({
    event_id: event.id, category: data.category, question: data.question, options: data.options, correct_index: data.correct_index, points: data.points, status: 'active'
  }).select().single()
  if (error) throw error; return { data: quiz }
}

export const closeQuizVoting = async (quizId) => {
  const { data, error } = await supabase.from('quizzes').update({ status: 'closed' }).eq('id', quizId).select()
  if (error) throw error; return { data };
}

export const showQuizResults = async (quizId) => {
  const { data, error } = await supabase.from('quizzes').update({ status: 'showing_results' }).eq('id', quizId).select().single()
  if (error) throw error; return { data }
}

export const endQuiz = async (id) => {
  const { error } = await supabase.from('quizzes').update({status: 'ended', ended_at: new Date().toISOString()}).eq('id', id);
  if (error) throw error; return { data: 'ok' }
}

export const getQuizResults = async (quizId) => {
  const { data: quiz } = await supabase.from('quizzes').select('*').eq('id', quizId).single()
  const { data: answers, error } = await supabase.from('quiz_answers').select('*, participants(nickname)').eq('quiz_id', quizId)
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
      winners: correctAnswers.map(a => a.participants?.nickname || 'Unknown'),
      points: quiz.points
    }
  }
}

export const answerQuiz = async (data) => {
  const participant = getParticipantFromToken()
  const { data: quiz } = await supabase.from('quizzes').select('correct_index, points').eq('id', data.quiz_id).single();
  
  const isCorrect = quiz.correct_index === data.answer_index;
  const pointsEarned = isCorrect ? quiz.points : 0;

  const { data: ans, error } = await supabase.from('quiz_answers').insert({
    quiz_id: data.quiz_id, 
    participant_id: participant.participant_id, 
    answer_index: data.answer_index,
    is_correct: isCorrect
  }).select().single()

  if (error) { if (error.code==='23505') throw new Error('Già risposto'); throw error;}

  if (isCorrect) {
      const { data: p } = await supabase.from('participants').select('score').eq('id', participant.participant_id).single();
      if (p) await supabase.from('participants').update({ score: p.score + pointsEarned }).eq('id', participant.participant_id);
  }
  return { data: { ...ans, points_earned: pointsEarned } }
}

export const getActiveQuiz = async () => {
  const participant = getParticipantFromToken()
  const { data, error } = await supabase.from('quizzes').select('*').eq('event_id', participant.event_id).in('status', ['active', 'closed', 'showing_results']).maybeSingle()
  if (error) throw error; return { data }
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

export const getQuizLeaderboard = async () => { return getAdminLeaderboard(); }

export const getDisplayData = async (pubCode) => {
  const { data: event } = await supabase.from('events').select('*').eq('code', pubCode.toUpperCase()).single()
  const [perf, queue, lb] = await Promise.all([
    supabase.from('performances').select('*, participants(nickname)').eq('event_id', event.id).in('status', ['live','voting','paused','restarted']).maybeSingle(),
    supabase.from('song_requests').select('*, participants(nickname)').eq('event_id', event.id).eq('status', 'queued').limit(10),
    supabase.from('participants').select('nickname, score').eq('event_id', event.id).order('score', {ascending:false}).limit(5)
  ])
  return {
    data: {
      pub: event,
      current_performance: perf.data ? {...perf.data, user_nickname: perf.data.participants?.nickname} : null,
      queue: queue.data?.map(q => ({...q, user_nickname: q.participants?.nickname})),
      leaderboard: lb.data
    }
  }
}

export default {
  createPub, getPub, joinPub, adminLogin, getMe,
  requestSong, getSongQueue, getMyRequests, getAdminQueue, approveRequest, rejectRequest,
  startPerformance, pausePerformance, resumePerformance, endPerformance, closeVoting, skipPerformance, restartPerformance,
  togglePerformanceMute, togglePerformanceBlur, // Added new functions
  getCurrentPerformance, getAdminCurrentPerformance,
  submitVote, sendReaction, sendMessage,
  getAdminPendingMessages, approveMessage, rejectMessage,
  startQuiz, endQuiz, answerQuiz, getActiveQuiz, closeQuizVoting, showQuizResults,
  importQuizBatch, getLibraryQuizzes, launchQuizFromLibrary, // Added new functions
  getQuizResults, getQuizLeaderboard,
  getLeaderboard, getAdminLeaderboard,
  getDisplayData
}