// lib/api.js
import { supabase } from './supabase'

// ============================================
// SONGS
// ============================================
export const getQueue = async () => {
  const { data, error } = await supabase.from('songs').select('*').eq('status', 'queued')
  if (error) throw error
  return data
}

export const getMyRequests = async (userId) => {
  const { data, error } = await supabase.from('songs').select('*').eq('user_id', userId)
  if (error) throw error
  return data
}

export const requestSong = async ({ title, artist, youtube_url, user_id }) => {
  const { data, error } = await supabase.from('songs').insert({
    title,
    artist,
    youtube_url,
    user_id,
    status: 'pending'
  }).select().single()
  if (error) throw error
  return data
}

// ============================================
// PERFORMANCE
// ============================================
export const getCurrentPerformance = async () => {
  const { data, error } = await supabase.from('performance').select('*').eq('status', 'live').single()
  if (error) return null
  return data
}

// ============================================
// VOTES
// ============================================
export const submitVote = async ({ performance_id, score, user_id }) => {
  const { data, error } = await supabase.from('votes').insert({ performance_id, score, user_id }).select().single()
  if (error) throw error
  return data
}

// ============================================
// REACTIONS
// ============================================
export const getRemainingReactions = async (user_id) => {
  const { data, error } = await supabase.from('reactions').select('remaining').eq('user_id', user_id).single()
  if (error) return { remaining: 3 } // default
  return data
}

export const sendReaction = async ({ emoji, user_id, performance_id }) => {
  const { data, error } = await supabase.from('reactions').insert({ emoji, user_id, performance_id }).select().single()
  if (error) throw error
  return data
}

// ============================================
// QUIZ
// ============================================
export const getActiveQuiz = async () => {
  const { data, error } = await supabase.from('quiz').select('*').eq('active', true).single()
  if (error) return null
  return data
}

export const answerQuiz = async ({ quiz_id, answer_index, user_id }) => {
  const { data, error } = await supabase.from('quiz_answers').insert({ quiz_id, answer_index, user_id }).select().single()
  if (error) throw error
  return data
}

// ============================================
// LEADERBOARD
// ============================================
export const getLeaderboard = async () => {
  const { data, error } = await supabase.from('quiz_scores').select('*').order('score', { ascending: false })
  if (error) throw error
  return data
}
