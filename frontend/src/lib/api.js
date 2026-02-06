// lib/api.js - SUPABASE VERSION
import { supabase } from './supabase'

// ============================================
// AUTH & PROFILES
// ============================================

export const createPub = async (data) => {
  const { data: user } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

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
  // 1. Get event
  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('id')
    .eq('code', pub_code.toUpperCase())
    .eq('status', 'active')
    .single()

  if (eventError) throw eventError

  // 2. Create participant (anonymous, no auth needed)
  const { data: participant, error } = await supabase
    .from('participants')
    .insert({
      event_id: event.id,
      nickname: nickname
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') { // Unique constraint violation
      throw new Error('Nickname già in uso')
    }
    throw error
  }

  // 3. Create session token (store participant_id)
  const token = btoa(JSON.stringify({ 
    participant_id: participant.id, 
    event_id: event.id,
    nickname: nickname 
  }))

  return { 
    data: { 
      token, 
      user: participant 
    } 
  }
}

export const adminLogin = async (data) => {
  const { data: authData, error } = await supabase.auth.signInWithPassword({
    email: data.email || `${data.pub_code}@neonpub.local`, // Temp email mapping
    password: data.password
  })

  if (error) throw error

  return { data: authData }
}

export const getMe = async () => {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return { data: profile }
}

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
// ADMIN QUEUE
// ============================================

export const approveRequest = async (requestId) => {
  const { data, error } = await supabase
    .from('song_requests')
    .update({ status: 'approved' })
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
  // Batch update positions
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
// PERFORMANCES
// ============================================

export const startPerformance = async (requestId, youtubeUrl) => {
  const { data: request } = await supabase
    .from('song_requests')
    .select('*, participants(*)')
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

  // Update request status
  await supabase
    .from('song_requests')
    .update({ status: 'performed', performed_at: new Date().toISOString() })
    .eq('id', requestId)

  return { data: performance }
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

export const getCurrentPerformance = async () => {
  const participant = getParticipantFromToken()

  const { data, error } = await supabase
    .from('performances')
    .select('*')
    .eq('event_id', participant.event_id)
    .in('status', ['live', 'voting'])
    .order('started_at', { ascending: false })
    .limit(1)
    .single()

  if (error && error.code !== 'PGRST116') throw error // Ignore "not found"
  return { data }
}

export const getPerformanceHistory = async () => {
  const participant = getParticipantFromToken()

  const { data, error } = await supabase
    .from('performances')
    .select('*')
    .eq('event_id', participant.event_id)
    .order('started_at', { ascending: false })

  if (error) throw error
  return { data }
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

// ============================================
// QUIZ
// ============================================

export const startQuiz = async (data) => {
  const { data: { user } } = await supabase.auth.getUser()
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('*, events!owner_id(*)')
    .eq('id', user.id)
    .single()

  const event = profile.events[0] // Get current event

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

export const answerQuiz = async (data) => {
  const participant = getParticipantFromToken()

  const { data: answer, error } = await supabase
    .from('quiz_answers')
    .insert({
      quiz_id: data.quiz_id,
      participant_id: participant.participant_id,
      answer_index: data.answer_index,
      is_correct: false, // Will be set by trigger
      points_earned: 0
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

export const getActiveQuiz = async () => {
  const participant = getParticipantFromToken()

  const { data, error } = await supabase
    .from('quizzes')
    .select('*')
    .eq('event_id', participant.event_id)
    .eq('status', 'active')
    .order('started_at', { ascending: false })
    .limit(1)
    .single()

  if (error && error.code !== 'PGRST116') throw error
  return { data }
}

// ============================================
// EFFECTS
// ============================================

export const sendEffect = async (data) => {
  // Effects are broadcast via Realtime, no DB storage needed
  // Just return success for compatibility
  return { data: 'ok' }
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

// ============================================
// DISPLAY DATA
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
      .select('*')
      .eq('event_id', event.id)
      .in('status', ['live', 'voting'])
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    
    supabase
      .from('song_requests')
      .select('*')
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
      current_performance: currentPerf.data,
      queue: queue.data,
      leaderboard: leaderboard.data
    }
  }
}

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

export default {
  createPub,
  getPub,
  joinPub,
  adminLogin,
  getMe,
  requestSong,
  getSongQueue,
  getMyRequests,
  approveRequest,
  rejectRequest,
  reorderQueue,
  startPerformance,
  endPerformance,
  closeVoting,
  getCurrentPerformance,
  getPerformanceHistory,
  submitVote,
  sendReaction,
  startQuiz,
  answerQuiz,
  endQuiz,
  getActiveQuiz,
  sendEffect,
  getLeaderboard,
  getDisplayData,
  sendMessage
}