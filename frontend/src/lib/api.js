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
// CREDITI OPERATORE (NUOVO)
// ============================================

export const getOperatorCredits = async () => {
  const { data: user } = await supabase.auth.getUser()
  if (!user?.user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('profiles')
    .select('credits, credit_expires_at')
    .eq('id', user.user.id)
    .single()
  
  if (error) throw error
  
  return { 
    credits: data.credits || 0,
    expires_at: data.credit_expires_at 
  }
}

export const getCreditHistory = async () => {
  const { data: user } = await supabase.auth.getUser()
  if (!user?.user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('credit_transactions')
    .select('*')
    .eq('operator_id', user.user.id)
    .order('created_at', { ascending: false })
    .limit(50)
  
  if (error) throw error
  return data
}

export const purchaseCredits = async (packageType) => {
  const { data: user } = await supabase.auth.getUser()
  if (!user?.user) throw new Error('Not authenticated')

  const packages = {
    starter: { credits: 10, price: 29.00 },
    pro: { credits: 50, price: 119.00 },
    premium: { credits: 150, price: 299.00 },
    unlimited: { credits: 999999, price: 799.00 }
  }

  const pkg = packages[packageType]
  if (!pkg) throw new Error('Invalid package type')

  const { data: purchase, error: purchaseError } = await supabase
    .from('credit_purchases')
    .insert({
      operator_id: user.user.id,
      package_type: packageType,
      credits_amount: pkg.credits,
      price_paid: pkg.price,
      payment_status: 'pending'
    })
    .select()
    .single()
  
  if (purchaseError) throw purchaseError

  // Mock pagamento per sviluppo
  if (process.env.NODE_ENV === 'development' || true) { // Forzato true per demo
    await completeCreditPurchase(purchase.id)
  }

  return purchase
}

export const completeCreditPurchase = async (purchaseId) => {
  const { data: purchase, error: fetchError } = await supabase
    .from('credit_purchases')
    .select('*')
    .eq('id', purchaseId)
    .single()
  
  if (fetchError) throw fetchError

  await supabase
    .from('credit_purchases')
    .update({ payment_status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', purchaseId)

  const { data: profile } = await supabase
    .from('profiles')
    .select('credits')
    .eq('id', purchase.operator_id)
    .single()

  await supabase
    .from('profiles')
    .update({ credits: (profile.credits || 0) + purchase.credits_amount })
    .eq('id', purchase.operator_id)

  await supabase
    .from('credit_transactions')
    .insert({
      operator_id: purchase.operator_id,
      amount: purchase.credits_amount,
      type: 'purchase',
      description: `Acquisto pacchetto ${purchase.package_type}`,
      metadata: { purchase_id: purchaseId }
    })

  return { success: true }
}

// ============================================
// AUTH & EVENTS (BASE)
// ============================================

export const createPub = async (data) => {
  const { data: user } = await supabase.auth.getUser()
  if (!user?.user) throw new Error('Not authenticated')

  const { data: profile } = await supabase.from('profiles').select('credits, is_active').eq('id', user.user.id).single();
  
  if (!profile || !profile.is_active) throw new Error("Utente disabilitato o non trovato.");
  // Nota: La creazione evento base costa 1 credito
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
  const { data } = await supabase.from('events').select('*').eq('owner_id', user.user.id).eq('status', 'active').gt('expires_at', now).order('created_at', { ascending: false });
  return data || [];
}

export const uploadLogo = async (file) => {
  if (!file) throw new Error("Nessun file selezionato");
  const fileExt = file.name.split('.').pop();
  const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9]/g, '_')}.${fileExt}`;
  const { error } = await supabase.storage.from('logos').upload(fileName, file, { upsert: true });
  if (error) throw error;
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
  const { data, error } = await supabase.from('events').select('*').eq('code', pubCode.toUpperCase()).single();
  if (error || !data) return { data: null };
  if (data.status === 'ended' || (data.expires_at && new Date(data.expires_at) < new Date())) {
      return { data: null, expired: true };
  }
  return { data }
}

export const joinPub = async ({ pub_code, nickname }) => {
  const { data: event, error: eventError } = await supabase.from('events').select('id, name, status, expires_at').eq('code', pub_code.toUpperCase()).single()
  if (eventError || !event) throw new Error("Evento non trovato");
  if (event.status !== 'active' || (event.expires_at && new Date(event.expires_at) < new Date())) throw new Error("Evento scaduto o terminato");

  const { data: participant, error } = await supabase.from('participants').insert({ event_id: event.id, nickname: nickname }).select().single()
  if (error) { if (error.code === '23505') throw new Error('Nickname già in uso'); throw error }
  const token = btoa(JSON.stringify({ participant_id: participant.id, event_id: event.id, nickname: nickname, pub_name: event.name }))
  return { data: { token, user: { ...participant, pub_name: event.name } } }
}

export const adminLogin = async (data) => { return { data: { user: { email: data.email } } } }
export const getMe = async () => { const { data: { user } } = await supabase.auth.getUser(); return { data: user } }

// === ADMIN PROFILES ===
export const getAllProfiles = async () => {
    const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    if (error) throw error; return { data };
}
export const updateProfileCredits = async (id, credits) => {
    const { error } = await supabase.from('profiles').update({ credits: parseInt(credits) }).eq('id', id);
    if (error) throw error; return { data: 'ok' };
}
export const toggleUserStatus = async (id, isActive) => {
    const { error } = await supabase.from('profiles').update({ is_active: isActive }).eq('id', id);
    if (error) throw error; return { data: 'ok' };
}
export const createOperatorProfile = async () => { return { data: 'Mock success' }; }

// ============================================
// GESTIONE SESSIONE QUIZ (NUOVO MODULO)
// ============================================

export const startQuizSession = async (questionsData, quizTitle = "Quiz") => {
  const event = await getAdminEvent()
  const { data: user } = await supabase.auth.getUser()
  if (!user?.user) throw new Error('Not authenticated')

  const { data: profile } = await supabase.from('profiles').select('credits').eq('id', user.user.id).single()
  if (!profile || profile.credits < 1) throw new Error('INSUFFICIENT_CREDITS')

  // Chiudi sessioni precedenti
  await supabase.from('quiz_sessions').update({ state: 'finished', ended_at: new Date().toISOString() }).eq('pub_code', event.code).neq('state', 'finished')

  const { data: session, error } = await supabase.from('quiz_sessions')
    .insert({
      pub_code: event.code, operator_id: user.user.id, event_id: event.id,
      quiz_title: quizTitle, state: 'idle', current_question_index: 0,
      total_questions: questionsData.length, questions_data: questionsData
    }).select().single()
  
  if (error) throw error
  await supabase.from('events').update({ active_module: 'quiz', active_module_id: session.id }).eq('id', event.id)
  return { data: session }
}

export const getActiveQuizSession = async () => {
  const event = await getAdminEvent()
  const { data } = await supabase.from('quiz_sessions').select('*').eq('pub_code', event.code).neq('state', 'finished').order('created_at', { ascending: false }).limit(1).maybeSingle()
  return data
}

export const quizTransition = async (sessionId, action) => {
  const { data: user } = await supabase.auth.getUser()
  const { data: session } = await supabase.from('quiz_sessions').select('*').eq('id', sessionId).single()
  
  let newState = session.state
  let updates = {}
  let creditDeducted = false

  switch (action) {
    case 'show_question':
      // Costo per domanda
      const { data: profile } = await supabase.from('profiles').select('credits').eq('id', user.user.id).single()
      if (profile.credits < 1) throw new Error('INSUFFICIENT_CREDITS')
      await supabase.from('profiles').update({ credits: profile.credits - 1 }).eq('id', user.user.id)
      await supabase.from('credit_transactions').insert({ operator_id: user.user.id, amount: -1, type: 'usage', description: `Quiz Q${session.current_question_index + 1}` })
      
      newState = 'question_shown'; updates.question_shown_at = new Date().toISOString(); creditDeducted = true;
      break;
    case 'open_answers': newState = 'answers_open'; updates.answers_opened_at = new Date().toISOString(); break;
    case 'close_answers': newState = 'answers_closed'; break;
    case 'reveal_answer': newState = 'reveal_answer'; break;
    case 'show_results': newState = 'show_results'; break;
    case 'show_leaderboard': newState = 'leaderboard'; break;
    case 'next_question': 
      if (session.current_question_index + 1 >= session.total_questions) throw new Error('Fine quiz');
      newState = 'idle'; updates.current_question_index = session.current_question_index + 1; 
      break;
    case 'end_quiz': newState = 'finished'; updates.ended_at = new Date().toISOString(); break;
  }

  const { data: updatedSession, error } = await supabase.from('quiz_sessions').update({ state: newState, ...updates }).eq('id', sessionId).select().single()
  if (error) throw error
  return { data: updatedSession, credit_deducted: creditDeducted }
}

export const joinQuizSession = async (sessionId) => {
  const p = getParticipantFromToken()
  const { data: existing } = await supabase.from('quiz_participants').select('id').eq('session_id', sessionId).eq('participant_id', p.participant_id).maybeSingle()
  if (existing) return { data: existing }
  const { data, error } = await supabase.from('quiz_participants').insert({ session_id: sessionId, participant_id: p.participant_id, nickname: p.nickname }).select().single()
  if (error) throw error
  return { data }
}

export const submitQuizAnswer = async (sessionId, questionIndex, answerIndex, timeTaken) => {
  const p = getParticipantFromToken()
  const { data: session } = await supabase.from('quiz_sessions').select('*').eq('id', sessionId).single()
  if (session.state !== 'answers_open') throw new Error('Risposte chiuse')
  
  const { data: qp } = await supabase.from('quiz_participants').select('id').eq('session_id', sessionId).eq('participant_id', p.participant_id).single()
  if (!qp) throw new Error('Partecipante non trovato')

  const isCorrect = answerIndex === session.questions_data[questionIndex].correct_index
  const points = isCorrect ? (session.points_base + Math.round(session.points_speed_bonus * (1 - timeTaken/session.time_per_question))) : 0

  const { data, error } = await supabase.from('quiz_answers').insert({
    session_id: sessionId, quiz_participant_id: qp.id, question_index: questionIndex,
    answer_index: answerIndex, is_correct: isCorrect, time_taken: timeTaken, points_earned: points
  }).select().single()
  
  if (error && error.code === '23505') throw new Error('Già risposto')
  if (error) throw error
  return { data, is_correct: isCorrect, points_earned: points }
}

export const getQuizLeaderboard = async (sessionId) => {
  const { data } = await supabase.from('quiz_leaderboard').select('*').eq('session_id', sessionId).order('rank');
  return data
}

export const getQuizLiveStats = async (sessionId, questionIndex) => {
  const { data } = await supabase.from('quiz_answers').select('answer_index, is_correct').eq('session_id', sessionId).eq('question_index', questionIndex)
  const distribution = { 0: 0, 1: 0, 2: 0, 3: 0 }; 
  data?.forEach(a => distribution[a.answer_index] = (distribution[a.answer_index]||0)+1);
  return { total_answers: data?.length||0, distribution, correct_count: data?.filter(a=>a.is_correct).length||0 }
}

// ============================================
// OLD / COMPATIBILITY FUNCTIONS
// ============================================

export const getEventState = async () => {
  const pubCode = localStorage.getItem('neonpub_pub_code');
  if (!pubCode) return null;
  const { data } = await supabase.from('events').select('active_module, active_module_id').eq('code', pubCode).maybeSingle();
  return data;
};
export const setEventModule = async (moduleId, id) => {
    const pubCode = localStorage.getItem('neonpub_pub_code');
    await supabase.from('events').update({ active_module: moduleId, active_module_id: id }).eq('code', pubCode);
};
export const getChallengeCatalog = async () => ({ data: [] });

// Song Requests
export const requestSong = async (data) => {
  const p = getParticipantFromToken()
  const { data: req, error } = await supabase.from('song_requests').insert({ event_id: p.event_id, participant_id: p.participant_id, title: data.title, artist: data.artist, youtube_url: data.youtube_url, status: 'pending' }).select().single()
  if (error) throw error; return { data: req }
}
export const getSongQueue = async () => {
  const p = getParticipantFromToken(); 
  const { data } = await supabase.from('song_requests').select('*, participants(nickname)').eq('event_id', p.event_id).eq('status', 'queued').order('position');
  return { data: data?.map(q => ({...q, user_nickname: q.participants?.nickname})) || [] }
}
export const getMyRequests = async () => {
  const p = getParticipantFromToken(); const { data } = await supabase.from('song_requests').select('*').eq('participant_id', p.participant_id); return { data }
}
export const getAdminQueue = async () => {
  const e = await getAdminEvent(); const { data } = await supabase.from('song_requests').select('*, participants(nickname)').eq('event_id', e.id).in('status', ['pending','queued']).order('requested_at');
  return { data: data?.map(q => ({...q, user_nickname: q.participants?.nickname})) }
}
export const approveRequest = async (id) => { await supabase.from('song_requests').update({ status: 'queued' }).eq('id', id); return { data: 'ok' } }
export const rejectRequest = async (id) => { await supabase.from('song_requests').update({ status: 'rejected' }).eq('id', id); return { data: 'ok' } }
export const deleteRequest = async (id) => { await supabase.from('song_requests').update({ status: 'rejected' }).eq('id', id); return { data: 'ok' } }

// Performance
export const startPerformance = async (reqId, url) => {
  const { data: req } = await supabase.from('song_requests').select('*').eq('id', reqId).single()
  await supabase.from('performances').update({ status: 'ended' }).eq('event_id', req.event_id).neq('status', 'ended');
  const { data: perf } = await supabase.from('performances').insert({ event_id: req.event_id, song_request_id: req.id, participant_id: req.participant_id, song_title: req.title, song_artist: req.artist, youtube_url: url || req.youtube_url, status: 'live' }).select().single()
  await supabase.from('song_requests').update({ status: 'performing' }).eq('id', reqId)
  await supabase.from('events').update({ active_module: 'karaoke' }).eq('id', req.event_id)
  return { data: perf }
}
export const pausePerformance = async (id) => { await supabase.from('performances').update({ status: 'paused' }).eq('id', id); return { data: 'ok' } }
export const resumePerformance = async (id) => { await supabase.from('performances').update({ status: 'live' }).eq('id', id); return { data: 'ok' } }
export const restartPerformance = async (id) => { await supabase.from('performances').update({ status: 'live', started_at: new Date().toISOString() }).eq('id', id); return { data: 'ok' } }
export const endPerformance = async (id) => { await supabase.from('performances').update({ status: 'voting', ended_at: new Date().toISOString() }).eq('id', id); return { data: 'ok' } }
export const closeVoting = async (id) => {
    const { data: perf } = await supabase.from('performances').select('*').eq('id', id).single();
    await supabase.from('performances').update({ status: 'ended' }).eq('id', id);
    if(perf.song_request_id) await supabase.from('song_requests').update({ status: 'ended' }).eq('id', perf.song_request_id);
    return { data: 'ok' }
}
export const stopAndNext = async (id) => closeVoting(id);
export const toggleMute = async (val) => {
    const code = localStorage.getItem('neonpub_pub_code');
    supabase.channel(`display_control_${code}`).send({ type: 'broadcast', event: 'control', payload: { command: 'mute', value: val } })
}
export const getCurrentPerformance = async () => {
    const p = getParticipantFromToken();
    const { data } = await supabase.from('performances').select('*, participants(nickname)').eq('event_id', p.event_id).in('status', ['live','paused','voting']).maybeSingle();
    return { data: data ? {...data, user_nickname: data.participants?.nickname} : null }
}
export const getAdminCurrentPerformance = async () => {
    const e = await getAdminEvent();
    const { data } = await supabase.from('performances').select('*, participants(nickname)').eq('event_id', e.id).in('status', ['live','paused','voting']).maybeSingle();
    return { data: data ? {...data, user_nickname: data.participants?.nickname} : null }
}
export const submitVote = async (data) => {
    const p = getParticipantFromToken();
    const { error } = await supabase.from('votes').insert({ performance_id: data.performance_id, participant_id: p.participant_id, score: data.score });
    if (error && error.code !== '23505') throw error;
    // Update avg
    const { data: votes } = await supabase.from('votes').select('score').eq('performance_id', data.performance_id);
    if(votes?.length) await supabase.from('performances').update({ average_score: votes.reduce((a,b)=>a+b.score,0)/votes.length }).eq('id', data.performance_id);
    return { data: 'ok' }
}
export const sendReaction = async (data) => {
    const p = getParticipantFromToken();
    await supabase.from('reactions').insert({ event_id: p.event_id, participant_id: p.participant_id, emoji: data.emoji, nickname: p.nickname });
    return { data: 'ok' }
}
export const sendMessage = async (data) => {
    let pId = null, eId = null;
    try { const p = getParticipantFromToken(); pId = p.participant_id; eId = p.event_id; }
    catch { const code = localStorage.getItem('neonpub_pub_code'); if(code) { const { data: e } = await supabase.from('events').select('id').eq('code', code).single(); eId = e?.id; } }
    if(!eId) return;
    await supabase.from('messages').insert({ event_id: eId, participant_id: pId, text: data.text || data.message, status: pId ? 'pending' : 'approved' });
    return { data: 'ok' }
}
export const getAdminPendingMessages = async () => {
    const e = await getAdminEvent(); const { data } = await supabase.from('messages').select('*, participants(nickname)').eq('event_id', e.id).eq('status', 'pending');
    return { data: data?.map(m => ({...m, user_nickname: m.participants?.nickname})) }
}
export const approveMessage = async (id) => { await supabase.from('messages').update({ status: 'approved' }).eq('id', id); return { data: 'ok' } }
export const rejectMessage = async (id) => { await supabase.from('messages').update({ status: 'rejected' }).eq('id', id); return { data: 'ok' } }

// QUIZ LEGACY / DISPLAY
export const getQuizCatalog = async () => {
    const { data } = await supabase.from('quiz_catalog').select('*').order('category');
    return { data }
}
export const addQuizToCatalog = async (quizData) => {
    const { data: user } = await supabase.auth.getUser()
    const { data, error } = await supabase.from('quiz_catalog').insert({ ...quizData, created_by: user.user.id }).select().single()
    if(error) throw error; return { data }
}
export const deleteQuizQuestion = async (id) => { await supabase.from('quiz_catalog').delete().eq('id', id); return { data: 'ok' } }
export const importQuizCatalog = async (jsonText) => {
    const { data: user } = await supabase.auth.getUser()
    const questions = JSON.parse(jsonText).map(q => ({ ...q, created_by: user.user.id }));
    const { data, error } = await supabase.from('quiz_catalog').insert(questions).select();
    if(error) throw error; return { count: data.length, data }
}

export const startQuiz = async (data) => startQuizSession([data]); // Wrapper legacy
export const endQuiz = async (id) => { await supabase.from('quizzes').update({ status: 'ended' }).eq('id', id); return { data: 'ok' } }
export const answerQuiz = async (data) => submitQuizAnswer(data.quiz_id, 0, data.answer_index, 10); // Wrapper legacy
export const getActiveQuiz = async () => {
    // Tenta prima il nuovo sistema sessioni
    const { data: session } = await supabase.from('quiz_sessions').select('*').neq('state', 'finished').order('created_at', {ascending: false}).limit(1).maybeSingle();
    if (session) {
        // Mappa sessione a formato "Quiz Legacy" per il display
        return { data: {
            id: session.id,
            status: session.state === 'question_shown' || session.state === 'answers_open' ? 'active' : session.state === 'answers_closed' ? 'closed' : session.state === 'show_results' ? 'showing_results' : session.state === 'leaderboard' ? 'leaderboard' : 'ended',
            question: session.questions_data[session.current_question_index]?.question,
            options: session.questions_data[session.current_question_index]?.options,
            correct_index: session.questions_data[session.current_question_index]?.correct_index,
            media_url: session.questions_data[session.current_question_index]?.media_url,
            media_type: session.questions_data[session.current_question_index]?.media_type,
            media_state: 'playing' // Default
        }};
    }
    // Fallback vecchio sistema
    const p = getParticipantFromToken();
    const { data } = await supabase.from('quizzes').select('*').eq('event_id', p.event_id).neq('status', 'ended').maybeSingle();
    return { data }
}
export const closeQuizVoting = async (id) => { await supabase.from('quizzes').update({ status: 'closed' }).eq('id', id); return { data: 'ok' } }
export const showQuizResults = async (id) => { await supabase.from('quizzes').update({ status: 'showing_results' }).eq('id', id); return { data: 'ok' } }
export const showQuizLeaderboard = async (id) => { await supabase.from('quizzes').update({ status: 'leaderboard' }).eq('id', id); return { data: 'ok' } }
export const getQuizResults = async (id) => {
    // Supporto ibrido
    const { data: session } = await supabase.from('quiz_sessions').select('*').eq('id', id).maybeSingle();
    if(session) {
        const stats = await getQuizLiveStats(id, session.current_question_index);
        const options = session.questions_data[session.current_question_index].options;
        const results = options.map((opt, i) => ({ answer: i, count: stats.distribution[i] || 0 }));
        return { data: results }
    }
    const { data } = await supabase.from('quiz_answers').select('answer_index').eq('quiz_id', id);
    // Legacy return...
    return { data: [] }
}
export const getAdminLeaderboard = async () => getLeaderboard();
export const getLeaderboard = async () => {
    const e = await getAdminEvent().catch(() => { const p = getParticipantFromToken(); return {id: p.event_id} });
    const { data } = await supabase.from('participants').select('id, nickname, score').eq('event_id', e.id).order('score', {ascending:false}).limit(20);
    return { data }
}
export const getDisplayData = async (pubCode) => {
    const { data: event } = await supabase.from('events').select('*').eq('code', pubCode.toUpperCase()).single();
    if (!event) return { data: null };
    
    // Check attivo
    const [perf, queue, lb, msg] = await Promise.all([
        supabase.from('performances').select('*, participants(nickname)').eq('event_id', event.id).in('status', ['live','voting','paused']).maybeSingle(),
        supabase.from('song_requests').select('*, participants(nickname)').eq('event_id', event.id).eq('status', 'queued').limit(10),
        supabase.from('participants').select('nickname, score').eq('event_id', event.id).order('score', {ascending:false}).limit(20),
        supabase.from('messages').select('*').eq('event_id', event.id).eq('status', 'approved').order('created_at', {ascending: false}).limit(1).maybeSingle()
    ]);

    // Check Quiz Session attivo per Display
    let activeQuiz = null;
    if (event.active_module === 'quiz' && event.active_module_id) {
        const { data: session } = await supabase.from('quiz_sessions').select('*').eq('id', event.active_module_id).single();
        if (session && session.state !== 'finished') {
            const qData = session.questions_data[session.current_question_index];
            activeQuiz = {
                id: session.id,
                status: session.state === 'question_shown' || session.state === 'answers_open' ? 'active' : session.state === 'answers_closed' ? 'closed' : session.state === 'show_results' ? 'showing_results' : session.state === 'leaderboard' ? 'leaderboard' : 'ended',
                question: qData.question,
                options: qData.options,
                correct_answer: qData.correct_index, // Serve al display per mostrare la corretta nei risultati
                media_url: qData.media_url,
                media_type: qData.media_type,
                media_state: 'playing'
            };
        }
    }

    return {
        data: {
            pub: event,
            current_performance: perf.data ? {...perf.data, user_nickname: perf.data.participants?.nickname} : null,
            queue: queue.data?.map(q => ({...q, user_nickname: q.participants?.nickname})),
            leaderboard: lb.data,
            active_quiz: activeQuiz,
            latest_message: msg.data
        }
    }
}
export const controlQuizMedia = async (id, state) => { /* Mock per compatibilità */ return { data: 'ok' } }
export const restartQuizMedia = async (id) => { return { data: 'ok' } }

export default {
  // Core
  createPub, updateEventSettings, uploadLogo, getPub, joinPub, adminLogin, getMe,
  getAllProfiles, updateProfileCredits, createOperatorProfile, toggleUserStatus,
  
  // Events & Modules
  getEventState, setEventModule, getActiveEventsForUser,
  
  // Credits (New)
  getOperatorCredits, getCreditHistory, purchaseCredits, completeCreditPurchase,

  // Quiz Session (New & Advanced)
  startQuizSession, getActiveQuizSession, quizTransition,
  joinQuizSession, submitQuizAnswer, getQuizLeaderboard, getQuizLiveStats,
  
  // Catalog
  getQuizCatalog, addQuizToCatalog, deleteQuizQuestion, importQuizCatalog, getChallengeCatalog,

  // Karaoke / Songs
  requestSong, getSongQueue, getMyRequests, getAdminQueue, approveRequest, rejectRequest, deleteRequest,
  startPerformance, pausePerformance, resumePerformance, restartPerformance, endPerformance, closeVoting, stopAndNext, toggleMute,
  getCurrentPerformance, getAdminCurrentPerformance,
  submitVote, sendReaction, sendMessage, getAdminPendingMessages, approveMessage, rejectMessage,

  // Display / Legacy Compatibility
  startQuiz, endQuiz, answerQuiz, getActiveQuiz, closeQuizVoting, showQuizResults, showQuizLeaderboard,
  getQuizResults, getAdminLeaderboard, getLeaderboard, getDisplayData, controlQuizMedia, restartQuizMedia
}