import { supabase } from './supabase'

// ============================================
// HELPER FUNCTIONS & AUTH
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
      status: 'active',
      active_module: 'karaoke' // Default state
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
// NUOVO: GESTIONE STATO EVENTO (REGIA)
// ============================================

export const getEventState = async () => {
  const pubCode = localStorage.getItem('neonpub_pub_code');
  if (!pubCode) return null;
  const { data } = await supabase.from('events').select('active_module, active_module_id').eq('code', pubCode).maybeSingle();
  return data;
};

export const setEventModule = async (moduleId, specificContentId = null) => {
  // moduleId: 'karaoke', 'quiz', 'idle'
  const pubCode = localStorage.getItem('neonpub_pub_code');
  
  // 1. Aggiorna lo stato globale dell'evento
  const { data: event, error } = await supabase
    .from('events')
    .update({ 
      active_module: moduleId,
      active_module_id: specificContentId 
    })
    .eq('code', pubCode)
    .select()
    .single();

  if (error) throw error;

  // 2. LOGICA DI TRANSIZIONE (Se attivo un quiz dal catalogo)
  if (moduleId === 'quiz' && specificContentId) {
    // Recupera il quiz dal catalogo
    const { data: catalogItem } = await supabase.from('quiz_catalog').select('*').eq('id', specificContentId).single();
    
    // Chiudi eventuali quiz vecchi
    await supabase.from('quizzes').update({ status: 'ended' }).eq('event_id', event.id);

    // Crea il nuovo quiz live
    await supabase.from('quizzes').insert({
      event_id: event.id,
      category: catalogItem.category,
      question: catalogItem.question,
      options: catalogItem.options,
      correct_index: catalogItem.correct_index,
      points: catalogItem.points,
      status: 'active'
    });
  }
};

// ============================================
// NUOVO: GESTIONE CATALOGHI
// ============================================

export const getQuizCatalog = async () => {
  const { data, error } = await supabase.from('quiz_catalog').select('*').order('category');
  // Se la tabella non esiste ancora o è vuota, non blocchiamo tutto
  if (error && error.code !== '42P01') console.error("Errore catalogo", error); 
  return { data: data || [] };
};

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
// PERFORMANCES
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
  
  // Forziamo lo stato evento su 'karaoke' quando parte una canzone
  await supabase.from('events').update({ active_module: 'karaoke' }).eq('id', request.event_id);
  
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
  // Se invia l'admin, il messaggio è già approvato, altrimenti è pending
  let status = data.status || 'pending';

  try {
     // CASO 1: Utente con telefono (Token presente)
     const p = getParticipantFromToken();
     participantId = p.participant_id;
     eventId = p.event_id;
  } catch (e) {
     // CASO 2: Regia/Admin (Nessun token partecipante, usiamo il codice locale)
     const pubCode = localStorage.getItem('neonpub_pub_code');
     if(pubCode) {
        const { data: event } = await supabase.from('events').select('id').eq('code', pubCode).single();
        if(event) {
           eventId = event.id;
        }
     }
  }

  if (!eventId) throw new Error("Impossibile inviare il messaggio: evento non trovato.");

  const text = typeof data === 'string' ? data : (data.text || data.message);
  
  const { data: message, error } = await supabase
    .from('messages')
    .insert({
      event_id: eventId,
      participant_id: participantId, // Se null, il sistema capisce che è "Regia"
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
  return { data: data.map(m => ({...m, user_nickname: m.participants?.nickname || 'Anonimo'})) }
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
// QUIZ (LOGICA CORRETTA PUNTEGGI)
// ============================================

export const startQuiz = async (data) => {
  const event = await getAdminEvent()
  const { data: quiz, error } = await supabase.from('quizzes').insert({
    event_id: event.id, category: data.category, question: data.question, options: data.options, correct_index: data.correct_index, points: data.points, status: 'active'
  }).select().single()
  
  if (error) throw error; 
  
  // Quando creo un quiz Custom (non da catalogo), imposto il modulo su Quiz
  await supabase.from('events').update({ active_module: 'quiz' }).eq('id', event.id);
  
  return { data: quiz }
}

export const closeQuizVoting = async (quizId) => {
  const { data, error } = await supabase.from('quizzes').update({ status: 'closed' }).eq('id', quizId).select()
  if (error) throw error; return { data };
}

export const showQuizResults = async (quizId) => {
  const { data, error } = await supabase.from('quizzes').update({ status: 'showing_results' }).eq('id', quizId).select().single()
  if (error) throw error
  return { data }
}

export const endQuiz = async (id) => {
  const { error } = await supabase.from('quizzes').update({status: 'ended', ended_at: new Date().toISOString()}).eq('id', id);
  if (error) throw error; return { data: 'ok' }
}

export const getQuizResults = async (quizId) => {
  const { data: quiz } = await supabase.from('quizzes').select('*').eq('id', quizId).single()
  // Join con participants per avere i nickname dei vincitori
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
  
  // 1. Recupera il quiz per vedere la risposta corretta
  const { data: quiz, error: quizError } = await supabase
    .from('quizzes')
    .select('correct_index, points')
    .eq('id', data.quiz_id)
    .single();

  if (quizError) throw quizError;

  const isCorrect = quiz.correct_index === data.answer_index;
  const pointsEarned = isCorrect ? quiz.points : 0;

  // 2. Salva la risposta
  const { data: ans, error } = await supabase.from('quiz_answers').insert({
    quiz_id: data.quiz_id, 
    participant_id: participant.participant_id, 
    answer_index: data.answer_index,
    is_correct: isCorrect
  }).select().single()

  if (error) { 
      if (error.code==='23505') throw new Error('Già risposto'); 
      throw error;
  }

  // 3. Se corretto, AGGIORNA il punteggio del partecipante
  if (isCorrect) {
      // Nota: idealmente usare la RPC 'give_points' lato DB, ma qui manteniamo compatibilità
      const { data: p } = await supabase.from('participants').select('score').eq('id', participant.participant_id).single();
      if (p) {
          await supabase.from('participants').update({ score: p.score + pointsEarned }).eq('id', participant.participant_id);
      }
  }

  return { data: { ...ans, points_earned: pointsEarned } }
}

export const getActiveQuiz = async () => {
  const participant = getParticipantFromToken()
  // Se non ho token (admin), devo usare il code
  if(!participant) {
     const event = await getAdminEvent();
     const { data } = await supabase.from('quizzes').select('*').eq('event_id', event.id).in('status', ['active', 'closed', 'showing_results']).maybeSingle()
     return { data };
  }
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
  
  // Fetch parallelo dei dati necessari per il display
  const [perf, queue, lb, activeQuiz, msg] = await Promise.all([
    supabase.from('performances').select('*, participants(nickname)').eq('event_id', event.id).in('status', ['live','voting','paused','restarted']).maybeSingle(),
    supabase.from('song_requests').select('*, participants(nickname)').eq('event_id', event.id).eq('status', 'queued').limit(10),
    supabase.from('participants').select('nickname, score').eq('event_id', event.id).order('score', {ascending:false}).limit(5),
    supabase.from('quizzes').select('*').eq('event_id', event.id).in('status', ['active', 'closed', 'showing_results']).maybeSingle(),
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
  createPub, getPub, joinPub, adminLogin, getMe,
  getEventState, setEventModule, getQuizCatalog, // NEW
  requestSong, getSongQueue, getMyRequests, getAdminQueue, approveRequest, rejectRequest,
  startPerformance, pausePerformance, resumePerformance, endPerformance, closeVoting, skipPerformance, restartPerformance, 
  getCurrentPerformance, getAdminCurrentPerformance,
  submitVote, sendReaction,
  sendMessage, getAdminPendingMessages, approveMessage, rejectMessage,
  startQuiz, endQuiz, answerQuiz, getActiveQuiz, closeQuizVoting, showQuizResults,
  getQuizResults, getQuizLeaderboard,
  getLeaderboard, getAdminLeaderboard,
  getDisplayData
}