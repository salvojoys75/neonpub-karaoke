import { supabase } from './supabase'

function getParticipantFromToken() {
  const token = localStorage.getItem('neonpub_token')
  if (!token) return null
  try { return JSON.parse(atob(token)) } catch { return null }
}

async function getAdminEvent() {
  const pubCode = localStorage.getItem('neonpub_pub_code')
  if (!pubCode) throw new Error('Nessun evento selezionato')
  const { data, error } = await supabase.from('events').select('*').eq('code', pubCode.toUpperCase()).single()
  if (error || !data) throw new Error('Evento non trovato')
  return data
}

// Named Exports
export const getPub = async (code) => supabase.from('events').select('*').eq('code', code?.toUpperCase()).single();

export const createPub = async (data) => {
  const { data: user } = await supabase.auth.getUser()
  const { data: prof } = await supabase.from('profiles').select('credits').eq('id', user.user.id).single()
  if (prof.credits < 1) throw new Error("Crediti insufficienti")
  await supabase.from('profiles').update({ credits: prof.credits - 1 }).eq('id', user.user.id)
  const code = Math.random().toString(36).substring(2, 8).toUpperCase()
  const expiresAt = new Date(); expiresAt.setHours(expiresAt.getHours() + 8)
  return supabase.from('events').insert({
    owner_id: user.user.id, name: data.name, code, status: 'active', active_module: 'karaoke', expires_at: expiresAt.toISOString()
  }).select().single()
};

export const updateEventSettings = async (d) => {
  const pubCode = localStorage.getItem('neonpub_pub_code')
  return supabase.from('events').update({ name: d.name, logo_url: d.logo_url }).eq('code', pubCode)
};

export const uploadLogo = async (file) => {
  const fileName = `${Date.now()}_logo.${file.name.split('.').pop()}`
  await supabase.storage.from('logos').upload(fileName, file)
  return supabase.storage.from('logos').getPublicUrl(fileName).data.publicUrl
};

export const getActiveEventsForUser = async () => {
  const { data: user } = await supabase.auth.getUser()
  if (!user?.user) return []
  return (await supabase.from('events').select('*').eq('owner_id', user.user.id).eq('status', 'active').gt('expires_at', new Date().toISOString())).data || []
};

export const getEventState = async () => {
  const code = localStorage.getItem('neonpub_pub_code'); if (!code) return null
  return (await supabase.from('events').select('active_module, active_module_id').eq('code', code).maybeSingle()).data
};

export const getAdminQueue = async () => {
  const e = await getAdminEvent()
  const { data } = await supabase.from('song_requests').select('*, participants(nickname)').eq('event_id', e.id).in('status', ['pending', 'queued']).order('created_at')
  return { data: data?.map(r => ({ ...r, user_nickname: r.participants?.nickname })) || [] }
};

export const getAdminCurrentPerformance = async () => {
  const e = await getAdminEvent()
  const { data } = await supabase.from('performances').select('*, participants(nickname, avatar_url)').eq('event_id', e.id).in('status', ['live', 'paused', 'voting']).order('started_at', { ascending: false }).limit(1).maybeSingle()
  return { data: data ? { ...data, user_nickname: data.participants?.nickname, user_avatar: data.participants?.avatar_url } : null }
};

export const startPerformance = async (reqId, ytUrl) => {
  const { data: req } = await supabase.from('song_requests').select('*').eq('id', reqId).single()
  await supabase.from('performances').update({ status: 'ended' }).eq('event_id', req.event_id)
  const { data: perf } = await supabase.from('performances').insert({
    event_id: req.event_id, song_request_id: req.id, participant_id: req.participant_id,
    song_title: req.title, song_artist: req.artist, youtube_url: ytUrl, status: 'live'
  }).select().single()
  await supabase.from('song_requests').update({ status: 'performing' }).eq('id', reqId)
  return { data: perf }
};

export const getQuizResults = async (id) => {
  const { data: quiz } = await supabase.from('quizzes').select('*').eq('id', id).single()
  const { data: wins } = await supabase.from('quiz_answers').select('*, participants(nickname, avatar_url)').eq('quiz_id', id).eq('is_correct', true)
  return { data: { correct_option: quiz.options[quiz.correct_index], winners: wins?.map(w => ({ nickname: w.participants.nickname, avatar: w.participants.avatar_url, points: quiz.points })) || [] } }
};

// ... Tutte le altre funzioni raggruppate per l'export default
const apiFunctions = {
  getPub, createPub, updateEventSettings, uploadLogo, getActiveEventsForUser, getEventState,
  getAdminQueue, getAdminCurrentPerformance, startPerformance, getQuizResults,
  getMe: async () => supabase.auth.getUser(),
  joinPub: async ({ pub_code, nickname }) => {
    const { data: event } = await supabase.from('events').select('*').eq('code', pub_code.toUpperCase()).single()
    const { data: participant } = await supabase.from('participants').insert({ event_id: event.id, nickname }).select().single()
    const token = btoa(JSON.stringify({ participant_id: participant.id, event_id: event.id, nickname, pub_name: event.name }))
    return { data: { token, user: { ...participant, pub_name: event.name } } }
  },
  getAllProfiles: async () => supabase.from('profiles').select('*').order('created_at', { ascending: false }),
  updateProfileCredits: async (id, credits) => supabase.from('profiles').update({ credits }).eq('id', id),
  toggleUserStatus: async (id, is_active) => supabase.from('profiles').update({ is_active }).eq('id', id),
  approveRequest: async (id) => supabase.from('song_requests').update({ status: 'queued' }).eq('id', id),
  rejectRequest: async (id) => supabase.from('song_requests').update({ status: 'rejected' }).eq('id', id),
  deleteRequest: async (id) => supabase.from('song_requests').delete().eq('id', id),
  pausePerformance: async (id) => supabase.from('performances').update({ status: 'paused' }).eq('id', id),
  resumePerformance: async (id) => supabase.from('performances').update({ status: 'live' }).eq('id', id),
  restartPerformance: async (id) => supabase.from('performances').update({ status: 'live', started_at: new Date().toISOString() }).eq('id', id),
  endPerformance: async (id) => supabase.from('performances').update({ status: 'voting' }).eq('id', id),
  closeVoting: async (id) => {
    const { data: perf } = await supabase.from('performances').select('*').eq('id', id).single()
    await supabase.from('performances').update({ status: 'ended' }).eq('id', id)
    if (perf.participant_id && perf.average_score > 0) {
      const { data: p } = await supabase.from('participants').select('score').eq('id', perf.participant_id).single()
      await supabase.from('participants').update({ score: (p.score || 0) + perf.average_score }).eq('id', perf.participant_id)
    }
  },
  stopAndNext: async (id) => {
    const { data: perf } = await supabase.from('performances').select('*').eq('id', id).single()
    await supabase.from('performances').update({ status: 'ended' }).eq('id', id)
    if (perf.song_request_id) await supabase.from('song_requests').update({ status: 'ended' }).eq('id', perf.song_request_id)
  },
  toggleMute: async (val) => {
    const channel = supabase.channel('tv_ctrl'); await channel.send({ type: 'broadcast', event: 'control', payload: { command: 'mute', value: val } })
  },
  getQuizCatalog: async () => supabase.from('quiz_catalog').select('*').eq('is_active', true).order('category'),
  getChallengeCatalog: async () => supabase.from('challenge_catalog').select('*'),
  setEventModule: async (mod, catId) => {
    const e = await getAdminEvent()
    if (mod === 'quiz' && catId) {
      const { data: cat } = await supabase.from('quiz_catalog').select('*').eq('id', catId).single()
      await supabase.from('quizzes').update({ status: 'ended' }).eq('event_id', e.id)
      return supabase.from('quizzes').insert({
        event_id: e.id, category: cat.category, question: cat.question, options: cat.options,
        correct_index: cat.correct_index, points: 10, status: 'active', media_url: cat.media_url, media_type: cat.media_type
      })
    }
    return supabase.from('events').update({ active_module: mod }).eq('id', e.id)
  },
  startQuiz: async (d) => {
    const e = await getAdminEvent()
    await supabase.from('quizzes').update({ status: 'ended' }).eq('event_id', e.id)
    return supabase.from('quizzes').insert({
      event_id: e.id, category: d.category, question: d.question, options: d.options,
      correct_index: d.correct_index, points: 10, status: 'active', media_url: d.media_url, media_type: d.media_type
    }).select().single()
  },
  getActiveQuiz: async () => {
    const code = localStorage.getItem('neonpub_pub_code')
    if (!code) return { data: null }
    const { data: ev } = await supabase.from('events').select('id').eq('code', code).single()
    return supabase.from('quizzes').select('*').eq('event_id', ev.id).in('status', ['active', 'closed', 'showing_results', 'leaderboard']).maybeSingle()
  },
  closeQuizVoting: async (id) => supabase.from('quizzes').update({ status: 'closed' }).eq('id', id),
  showQuizResults: async (id) => supabase.from('quizzes').update({ status: 'showing_results' }).eq('id', id),
  showQuizLeaderboard: async (id) => supabase.from('quizzes').update({ status: 'leaderboard' }).eq('id', id),
  endQuiz: async (id) => {
    await supabase.from('quizzes').update({ status: 'ended' }).eq('id', id)
    return supabase.from('events').update({ active_module: 'karaoke' }).eq('code', localStorage.getItem('neonpub_pub_code'))
  },
  deleteQuizQuestion: async (id) => supabase.from('quiz_catalog').update({ is_active: false }).eq('id', id),
  importQuizCatalog: async (json) => supabase.from('quiz_catalog').insert(JSON.parse(json).map(i => ({ ...i, is_active: true }))),
  getAdminPendingMessages: async () => {
    const e = await getAdminEvent()
    return supabase.from('messages').select('*, participants(nickname)').eq('event_id', e.id).eq('status', 'pending')
  },
  approveMessage: async (id) => supabase.from('messages').update({ status: 'approved' }).eq('id', id),
  rejectMessage: async (id) => supabase.from('messages').update({ status: 'rejected' }).eq('id', id),
  sendMessage: async (d) => {
    const { data: ev } = await supabase.from('events').select('id').eq('code', localStorage.getItem('neonpub_pub_code')).single()
    return supabase.from('messages').insert({ event_id: ev.id, text: d.text, status: 'approved' })
  },
  getDisplayData: async (code) => {
    const { data: event } = await supabase.from('events').select('*').eq('code', code.toUpperCase()).single()
    if (!event) return { data: null }
    const [perf, queue, lb, quiz, msgs] = await Promise.all([
      supabase.from('performances').select('*, participants(nickname, avatar_url)').eq('event_id', event.id).in('status', ['live', 'voting', 'paused', 'ended']).order('started_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('song_requests').select('*, participants(nickname, avatar_url)').eq('event_id', event.id).eq('status', 'queued').limit(10),
      supabase.from('participants').select('nickname, avatar_url, score').eq('event_id', event.id).order('score', { ascending: false }).limit(20),
      supabase.from('quizzes').select('*').eq('event_id', event.id).in('status', ['active', 'closed', 'showing_results', 'leaderboard']).maybeSingle(),
      supabase.from('messages').select('*, participants(nickname)').eq('event_id', event.id).eq('status', 'approved').order('created_at', { ascending: false }).limit(10)
    ])
    return { data: { pub: event, current_performance: perf.data ? { ...perf.data, user_nickname: perf.data.participants?.nickname, user_avatar: perf.data.participants?.avatar_url } : null, queue: queue.data?.map(q => ({ ...q, user_nickname: q.participants?.nickname, user_avatar: q.participants?.avatar_url })), leaderboard: lb.data?.map(l => ({ ...l, avatar: l.avatar_url })), active_quiz: quiz.data, approved_messages: msgs.data?.map(m => ({ text: m.text, nickname: m.participants?.nickname || 'Regia' })) || [] } }
  }
};

// OGGETTO DEFAULT (Per supportare l'importazione api.metodo)
const api = {
  getMe, getPub, createPub, updateEventSettings, uploadLogo, getActiveEventsForUser, joinPub,
  getAllProfiles, updateProfileCredits, toggleUserStatus, getEventState, getAdminQueue,
  getAdminCurrentPerformance, approveRequest, rejectRequest, deleteRequest, startPerformance,
  pausePerformance, resumePerformance, restartPerformance, endPerformance, stopAndNext,
  closeVoting, toggleMute, getQuizCatalog, getChallengeCatalog, setEventModule, startQuiz,
  getActiveQuiz, closeQuizVoting, showQuizResults, showQuizLeaderboard, endQuiz, getQuizResults,
  deleteQuizQuestion, importQuizCatalog, getAdminPendingMessages, approveMessage, rejectMessage,
  sendMessage, getDisplayData
};

export default api;