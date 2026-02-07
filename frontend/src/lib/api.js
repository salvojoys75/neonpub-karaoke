// lib/api.js - COMPLETE SUPABASE VERSION
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

  const { data: credits, error: creditsError } = await supabase
    .from('credits')
    .select('*')
    .eq('user_id', user.user.id)
    .single()

  if (creditsError || !credits || credits.amount <= credits.used) {
    throw new Error('No credits available')
  }

  const code = Math.random().toString(36).substring(2, 8).toUpperCase()

  const { data: event, error } = await supabase
    .from('events')
    .insert({
      owner_id: user.user.id,
      name: data.name,
      code: code,
      event_type: 'mixed',
      credit_used: credits.id,
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
    .insert({
      event_id: event.id,
      nickname: nickname
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      throw new Error('Nickname già in uso')
    }
    throw error
  }

  const token = btoa(JSON.stringify({ 
    participant_id: participant.id, 
    event_id: event.id,
    nickname: nickname,
    pub_name: event.name
  }))

  return { 
    data: { 
      token, 
      user: { ...participant, pub_name: event.name }
    } 
  }
}

// ============================================
// SONG REQUESTS - PARTICIPANT
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
    })
    .select()
    .single()

  if (error) throw error
  return { data: request }
}

export const getSongQueue = async () => {
  const participant = getParticipantFromToken()

  const { data, error } = await supabase
    .from('song_requests')
    .select('*')
    .eq('event_id', participant.event_id)
    .in('status', ['pending', 'queued', 'approved'])
    .order('position', { ascending: true })

  if (error) throw error
  return { data }
}

export const getMyRequests = async () => {
  const participant = getParticipantFromToken()

  const { data, error } = await supabase
    .from('song_requests')
    .select('*')
    .eq('participant_id', participant.participant_id)
    .order('requested_at', { ascending: false })

  if (error) throw error
  return { data }
}

// ============================================
// SONG REQUESTS - ADMIN
// ============================================

export const getAdminQueue = async () => {
  const event = await getAdminEvent()

  const { data, error } = await supabase
    .from('song_requests')
    .select(`
      *,
      participants (nickname)
    `)
    .eq('event_id', event.id)
    .order('requested_at', { ascending: false })

  if (error) throw error
  
  return { 
    data: (data || []).map(req => ({
      ...req,
      user_nickname: req.participants?.nickname || 'Unknown'
    }))
  }
}

export const approveRequest = async (requestId) => {
  const { data, error } = await supabase
    .from('song_requests')
    .update({ status: 'queued' })
    .eq('id', requestId)
    .select()

  if (error) throw error
  return { data }
}

export const rejectRequest = async (requestId) => {
  const { data, error } = await supabase
    .from('song_requests')
    .update({ status: 'rejected' })
    .eq('id', requestId)
    .select()

  if (error) throw error
  return { data }
}

export const reorderQueue = async (order) => {
  const updates = order.map((id, index) => 
    supabase
      .from('song_requests')
      .update({ position: index })
      .eq('id', id)
  )

  await Promise.all(updates)
  return { data: 'ok' }
}

// ============================================
// PERFORMANCES - ADMIN
// ============================================

export const startPerformance = async (requestId, youtubeUrl) => {
  const { data: request } = await supabase
    .from('song_requests')
    .select(`
      *,
      participants (nickname)
    `)
    .eq('id', requestId)
    .single()

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
    })
    .select()
    .single()

  if (error) throw error

  await supabase
    .from('song_requests')
    .update({ status: 'performing' })
    .eq('id', requestId)

  return { data: performance }
}

export const pausePerformance = async (performanceId) => {
  const { data, error } = await supabase
    .from('performances')
    .update({ status: 'paused' })
    .eq('id', performanceId)
    .select()

  if (error) throw error
  return { data }
}

export const resumePerformance = async (performanceId) => {
  const { data, error } = await supabase
    .from('performances')
    .update({ status: 'live' })
    .eq('id', performanceId)
    .select()

  if (error) throw error
  return { data }
}

export const endPerformance = async (performanceId) => {
  const { data, error } = await supabase
    .from('performances')
    .update({ 
      status: 'voting',
      ended_at: new Date().toISOString() 
    })
    .eq('id', performanceId)
    .select()

  if (error) throw error
  return { data }
}

export const closeVoting = async (performanceId) => {
  const { data, error } = await supabase
    .from('performances')
    .update({ status: 'ended' })
    .eq('id', performanceId)
    .select()

  if (error) throw error
  return { data }
}

export const skipPerformance = async (performanceId) => {
  const { data, error } = await supabase
    .from('performances')
    .update({ status: 'skipped' })
    .eq('id', performanceId)
    .select()

  if (error) throw error
  return { data }
}

// ============================================
// PERFORMANCES - PARTICIPANT
// ============================================

export const getCurrentPerformance = async () => {
  const participant = getParticipantFromToken()

  const { data, error } = await supabase
    .from('performances')
    .select('*')
    .eq('event_id', participant.event_id)
    .in('status', ['live', 'voting', 'paused'])
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return { data }
}

export const getAdminCurrentPerformance = async () => {
  const event = await getAdminEvent()

  const { data, error } = await supabase
    .from('performances')
    .select(`
      *,
      participants (nickname)
    `)
    .eq('event_id', event.id)
    .in('status', ['live', 'voting', 'paused'])
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  
  if (data) {
    return {
      data: {
        ...data,
        user_nickname: data.participants?.nickname || 'Unknown'
      }
    }
  }
  
  return { data: null }
}

// ============================================
// VOTING
// ============================================

export const submitVote = async (data) => {
  const participant = getParticipantFromToken()

  const { data: vote, error } = await supabase
    .from('votes')
    .insert({
      performance_id: data.performance_id,
      participant_id: participant.participant_id,
      score: data.score
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      throw new Error('Hai già votato')
    }
    throw error
  }

  return { data: vote }
}

// ============================================
// REACTIONS
// ============================================

export const sendReaction = async (data) => {
  const participant = getParticipantFromToken()

  const { data: reaction, error } = await supabase
    .from('reactions')
    .insert({
      event_id: participant.event_id,
      participant_id: participant.participant_id,
      performance_id: data.performance_id,
      emoji: data.emoji
    })
    .select()
    .single()

  if (error) throw error
  return { data: reaction }
}

export const getReactionCount = async (performanceId) => {
  const participant = getParticipantFromToken()

  const { count, error } = await supabase
    .from('reactions')
    .select('*', { count: 'exact', head: true })
    .eq('performance_id', performanceId)
    .eq('participant_id', participant.participant_id)

  if (error) throw error
  return { data: { count } }
}

// ============================================
// MESSAGES
// ============================================

export const sendMessage = async (data) => {
  const participant = getParticipantFromToken()

  const { data: message, error } = await supabase
    .from('messages')
    .insert({
      event_id: participant.event_id,
      participant_id: participant.participant_id,
      text: data.message,
      status: 'pending'
    })
    .select()
    .single()

  if (error) throw error
  return { data: message }
}

export const getAdminPendingMessages = async () => {
  const event = await getAdminEvent()

  const { data, error } = await supabase
    .from('messages')
    .select(`
      *,
      participants (nickname)
    `)
    .eq('event_id', event.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  if (error) throw error
  
  return {
    data: (data || []).map(msg => ({
      ...msg,
      user_nickname: msg.participants?.nickname || 'Unknown'
    }))
  }
}

export const approveMessage = async (messageId) => {
  const { data, error } = await supabase
    .from('messages')
    .update({ status: 'approved' })
    .eq('id', messageId)
    .select()
    .single()

  if (error) throw error
  return { data }
}

export const rejectMessage = async (messageId) => {
  const { data, error } = await supabase
    .from('messages')
    .update({ status: 'rejected' })
    .eq('id', messageId)
    .select()
    .single()

  if (error) throw error
  return { data }
}

export const getApprovedMessages = async () => {
  const participant = getParticipantFromToken()

  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('event_id', participant.event_id)
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(10)

  if (error) throw error
  return { data }
}

// ============================================
// QUIZ - ADMIN
// ============================================

export const startQuiz = async (data) => {
  const event = await getAdminEvent()

  const { data: quiz, error } = await supabase
    .from('quizzes')
    .insert({
      event_id: event.id,
      category: data.category,
      question: data.question,
      options: data.options,
      correct_index: data.correct_index,
      points: data.points || 10,
      status: 'active'
    })
    .select()
    .single()

  if (error) throw error
  return { data: quiz }
}

export const showQuizResults = async (quizId) => {
  const { data, error } = await supabase
    .from('quizzes')
    .update({ status: 'showing_results' })
    .eq('id', quizId)
    .select()
    .single()

  if (error) throw error
  return { data }
}

export const endQuiz = async (quizId) => {
  const { data, error } = await supabase
    .from('quizzes')
    .update({ 
      status: 'ended',
      ended_at: new Date().toISOString() 
    })
    .eq('id', quizId)
    .select()

  if (error) throw error
  return { data }
}

export const getQuizResults = async (quizId) => {
  // Get quiz details
  const { data: quiz } = await supabase
    .from('quizzes')
    .select('*')
    .eq('id', quizId)
    .single()

  // Get all answers with participant info
  const { data: answers, error } = await supabase
    .from('quiz_answers')
    .select(`
      *,
      participants (nickname)
    `)
    .eq('quiz_id', quizId)

  if (error) throw error

  // Calculate results
  const correctAnswers = answers.filter(a => a.is_correct)
  const winners = correctAnswers.map(a => a.participants.nickname)

  return {
    data: {
      quiz_id: quizId,
      question: quiz.question,
      correct_option: quiz.options[quiz.correct_index],
      correct_index: quiz.correct_index,
      total_answers: answers.length,
      correct_count: correctAnswers.length,
      winners: winners,
      points: quiz.points
    }
  }
}

export const getQuizLeaderboard = async () => {
  const event = await getAdminEvent()

  const { data, error } = await supabase
    .from('participants')
    .select('id, nickname, score')
    .eq('event_id', event.id)
    .order('score', { ascending: false })
    .limit(10)

  if (error) throw error
  return { data }
}

// ============================================
// QUIZ - PARTICIPANT
// ============================================

export const answerQuiz = async (data) => {
  const participant = getParticipantFromToken()

  const { data: answer, error } = await supabase
    .from('quiz_answers')
    .insert({
      quiz_id: data.quiz_id,
      participant_id: participant.participant_id,
      answer_index: data.answer_index
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      throw new Error('Hai già risposto')
    }
    throw error
  }

  return { data: answer }
}

export const getActiveQuiz = async () => {
  const participant = getParticipantFromToken()

  const { data, error } = await supabase
    .from('quizzes')
    .select('*')
    .eq('event_id', participant.event_id)
    .in('status', ['active', 'showing_results'])
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return { data }
}

// ============================================
// LEADERBOARD
// ============================================

export const getLeaderboard = async () => {
  const participant = getParticipantFromToken()

  const { data, error } = await supabase
    .from('participants')
    .select('id, nickname, score')
    .eq('event_id', participant.event_id)
    .order('score', { ascending: false })
    .limit(20)

  if (error) throw error
  return { data }
}

export const getAdminLeaderboard = async () => {
  const event = await getAdminEvent()

  const { data, error } = await supabase
    .from('participants')
    .select('id, nickname, score')
    .eq('event_id', event.id)
    .order('score', { ascending: false })
    .limit(20)

  if (error) throw error
  return { data }
}

// ============================================
// DISPLAY
// ============================================

export const getDisplayData = async (pubCode) => {
  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('*')
    .eq('code', pubCode.toUpperCase())
    .single()

  if (eventError) throw eventError

  const [currentPerf, queue, leaderboard] = await Promise.all([
    supabase
      .from('performances')
      .select(`
        *,
        participants (nickname)
      `)
      .eq('event_id', event.id)
      .in('status', ['live', 'voting', 'paused'])
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    
    supabase
      .from('song_requests')
      .select(`
        *,
        participants (nickname)
      `)
      .eq('event_id', event.id)
      .eq('status', 'queued')
      .order('position', { ascending: true })
      .limit(10),
    
    supabase
      .from('participants')
      .select('id, nickname, score')
      .eq('event_id', event.id)
      .order('score', { ascending: false })
      .limit(5)
  ])

  return {
    data: {
      pub: { name: event.name, code: event.code },
      current_performance: currentPerf.data ? {
        ...currentPerf.data,
        user_nickname: currentPerf.data.participants?.nickname
      } : null,
      queue: (queue.data || []).map(req => ({
        ...req,
        user_nickname: req.participants?.nickname
      })),
      leaderboard: leaderboard.data || []
    }
  }
}

export default {
  createPub,
  getPub,
  joinPub,
  requestSong,
  getSongQueue,
  getMyRequests,
  getAdminQueue,
  approveRequest,
  rejectRequest,
  reorderQueue,
  startPerformance,
  pausePerformance,
  resumePerformance,
  endPerformance,
  closeVoting,
  skipPerformance,
  getCurrentPerformance,
  getAdminCurrentPerformance,
  submitVote,
  sendReaction,
  getReactionCount,
  sendMessage,
  getAdminPendingMessages,
  approveMessage,
  rejectMessage,
  getApprovedMessages,
  startQuiz,
  showQuizResults,
  endQuiz,
  getQuizResults,
  getQuizLeaderboard,
  answerQuiz,
  getActiveQuiz,
  getLeaderboard,
  getAdminLeaderboard,
  getDisplayData
}