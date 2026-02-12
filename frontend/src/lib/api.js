import { supabase } from './supabase'

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

export const uploadAvatar = async (file) => {
  if (!file) throw new Error("Nessun file selezionato");
  const fileExt = file.name.split('.').pop();
  const cleanName = file.name.replace(/[^a-zA-Z0-9]/g, '_');
  const fileName = `${Date.now()}_${cleanName}.${fileExt}`;
  const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, file, { upsert: true });
  if (uploadError) throw uploadError;
  const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
  return data.publicUrl;
}

export const joinPub = async ({ pub_code, nickname, avatar_url }) => {
  const { data: event, error: eventError } = await supabase.from('events').select('id, name, status, expires_at').eq('code', pub_code.toUpperCase()).single()
  
  if (eventError || !event) throw new Error("Evento non trovato");
  if (event.status !== 'active' || (event.expires_at && new Date(event.expires_at) < new Date())) {
      throw new Error("Evento scaduto o terminato");
  }

  // Controlla se esiste già un partecipante con questo nickname in questo evento
  const { data: existingParticipant } = await supabase
    .from('participants')
    .select('*')
    .eq('event_id', event.id)
    .eq('nickname', nickname)
    .maybeSingle();

  let participant;
  
  if (existingParticipant) {
    // Re-login: aggiorna last_activity e avatar se fornito
    const updateData = { last_activity: new Date().toISOString() };
    if (avatar_url) updateData.avatar_url = avatar_url;
    
    const { data: updated, error: updateError } = await supabase
      .from('participants')
      .update(updateData)
      .eq('id', existingParticipant.id)
      .select()
      .single();
    
    if (updateError) throw updateError;
    participant = updated;
  } else {
    // Nuovo partecipante
    const { data: newParticipant, error } = await supabase
      .from('participants')
      .insert({ 
        event_id: event.id, 
        nickname: nickname,
        avatar_url: avatar_url || null
      })
      .select()
      .single();
    
    if (error) throw error;
    participant = newParticipant;
  }
  
  const token = btoa(JSON.stringify({ participant_id: participant.id, event_id: event.id, nickname: nickname, pub_name: event.name }))
  return { data: { token, user: { ...participant, pub_name: event.name } } }
}

export const adminLogin = async (data) => { return { data: { user: { email: data.email } } } }
export const getMe = async () => { const { data: { user } } = await supabase.auth.getUser(); return { data: user } }

export const getAllProfiles = async () => {
    const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return { data };
}

export const updateProfileCredits = async (userId, newCredits) => {
    const { error } = await supabase.from('profiles').update({ credits: newCredits }).eq('id', userId);
    if (error) throw error;
    return { data: 'ok' };
}

export const createOperatorProfile = async (email, password, name) => {
    const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });
    if (authError) throw authError;
    
    const { error: profileError } = await supabase.from('profiles').insert({
        id: authData.user.id,
        email: email,
        name: name || null,
        role: 'operator',
        credits: 0,
        is_active: true
    });
    
    if (profileError) throw profileError;
    return { data: authData.user };
}

export const toggleUserStatus = async (userId, currentStatus) => {
    const { error } = await supabase.from('profiles').update({ is_active: !currentStatus }).eq('id', userId);
    if (error) throw error;
    return { data: 'ok' };
}

export const getEventState = async () => {
  const event = await getAdminEvent()
  return { active_module: event.active_module || 'karaoke', active_module_id: event.active_module_id || null }
}

export const setEventModule = async (module, moduleId) => {
  const event = await getAdminEvent()
  const { error } = await supabase.from('events').update({ active_module: module, active_module_id: moduleId }).eq('id', event.id)
  if (error) throw error
  return { data: 'ok' }
}

export const getQuizCatalog = async () => {
  const event = await getAdminEvent()
  const { data, error } = await supabase.from('quiz_questions').select('*').eq('event_id', event.id).order('created_at', { ascending: false })
  if (error) throw error
  return { data }
}

export const getChallengeCatalog = async () => {
  const event = await getAdminEvent()
  const { data, error } = await supabase.from('challenges').select('*').eq('event_id', event.id)
  if (error) throw error
  return { data }
}

export const importQuizCatalog = async (questions) => {
  const event = await getAdminEvent()
  const questionsWithEvent = questions.map(q => ({ ...q, event_id: event.id }))
  const { data, error } = await supabase.from('quiz_questions').insert(questionsWithEvent).select()
  if (error) throw error
  return { data }
}

export const deleteQuizQuestion = async (questionId) => {
  const { error } = await supabase.from('quiz_questions').delete().eq('id', questionId);
  if (error) throw error;
  return { data: 'ok' };
}

export const requestSong = async (data) => {
  const participant = getParticipantFromToken()
  
  const { data: song, error } = await supabase.from('song_requests').insert({
    event_id: participant.event_id,
    participant_id: participant.participant_id,
    title: data.title,
    artist: data.artist,
    youtube_url: data.youtube_url || null,
    status: 'pending'
  }).select().single()
  
  if (error) throw error
  return { data: song }
}

export const getSongQueue = async () => {
  const participant = getParticipantFromToken()
  const { data, error } = await supabase.from('song_requests')
    .select('*, participants(nickname, avatar_url)')
    .eq('event_id', participant.event_id)
    .eq('status', 'queued')
    .order('approved_at', { ascending: true })
  
  if (error) throw error
  return { data: data.map(s => ({...s, user_nickname: s.participants?.nickname, user_avatar: s.participants?.avatar_url})) }
}

export const getMyRequests = async () => {
  const participant = getParticipantFromToken()
  const { data, error } = await supabase.from('song_requests').select('*').eq('participant_id', participant.participant_id).order('created_at', { ascending: false })
  if (error) throw error
  return { data }
}

export const getAdminQueue = async () => {
  const event = await getAdminEvent()
  const { data, error } = await supabase.from('song_requests')
    .select('*, participants(nickname, avatar_url)')
    .eq('event_id', event.id)
    .in('status', ['pending', 'queued'])
    .order('created_at', { ascending: true })
  
  if (error) throw error
  return { data: data.map(s => ({...s, user_nickname: s.participants?.nickname, user_avatar: s.participants?.avatar_url})) }
}

export const approveRequest = async (id) => {
  const { error } = await supabase.from('song_requests').update({ status: 'queued', approved_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
  return { data: 'ok' }
}

export const rejectRequest = async (id) => {
  const { error } = await supabase.from('song_requests').update({ status: 'rejected' }).eq('id', id)
  if (error) throw error
  return { data: 'ok' }
}

export const deleteRequest = async (id) => {
  const { error } = await supabase.from('song_requests').delete().eq('id', id)
  if (error) throw error
  return { data: 'ok' }
}

export const startPerformance = async (data) => {
  const event = await getAdminEvent()
  
  await supabase.from('performances').update({ status: 'ended' }).eq('event_id', event.id).in('status', ['live','paused','voting']);
  await supabase.from('quizzes').update({ status: 'ended' }).eq('event_id', event.id).neq('status', 'ended');

  const { data: perf, error } = await supabase.from('performances').insert({
    event_id: event.id,
    song_request_id: data.song_request_id,
    participant_id: data.participant_id,
    song_title: data.song_title,
    song_artist: data.song_artist,
    youtube_url: data.youtube_url,
    status: 'live',
    started_at: new Date().toISOString()
  }).select().single()
  
  if (error) throw error
  await supabase.from('events').update({ active_module: 'karaoke', active_module_id: perf.id }).eq('id', event.id);
  return { data: perf }
}

export const pausePerformance = async (id) => {
  const { error } = await supabase.from('performances').update({ status: 'paused' }).eq('id', id)
  if (error) throw error
  return { data: 'ok' }
}

export const resumePerformance = async (id) => {
  const { error } = await supabase.from('performances').update({ status: 'live' }).eq('id', id)
  if (error) throw error
  return { data: 'ok' }
}

export const endPerformance = async (id) => {
  const { error } = await supabase.from('performances').update({ status: 'voting' }).eq('id', id)
  if (error) throw error
  return { data: 'ok' }
}

export const closeVoting = async (id) => {
  const { data: votes } = await supabase.from('votes').select('stars').eq('performance_id', id)
  const avg = votes.length ? votes.reduce((a,v) => a+v.stars, 0) / votes.length : 0
  const { error } = await supabase.from('performances').update({ status: 'ended', ended_at: new Date().toISOString(), average_score: avg, votes_count: votes.length }).eq('id', id)
  if (error) throw error
  return { data: 'ok' }
}

export const stopAndNext = async (id) => {
  const { error } = await supabase.from('performances').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
  return { data: 'ok' }
}

export const restartPerformance = async (id) => {
  const { error } = await supabase.from('performances').update({ status: 'live', started_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
  return { data: 'ok' }
}

export const toggleMute = async (mute) => {
  await supabase.channel('tv_ctrl').send({ type: 'broadcast', event: 'control', payload: { command: 'mute', value: mute } })
  return { data: 'ok' }
}

export const getCurrentPerformance = async () => {
  const participant = getParticipantFromToken()
  const { data, error } = await supabase.from('performances')
    .select('*, participants(nickname, avatar_url)')
    .eq('event_id', participant.event_id)
    .in('status', ['live','paused','voting','ended'])
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  
  if (error) throw error
  return { data: data ? {...data, user_nickname: data.participants?.nickname, user_avatar: data.participants?.avatar_url} : null }
}

export const getAdminCurrentPerformance = async () => {
  const event = await getAdminEvent()
  const { data, error } = await supabase.from('performances')
    .select('*, participants(nickname, avatar_url)')
    .eq('event_id', event.id)
    .in('status', ['live','paused','voting','ended'])
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  
  if (error) throw error
  return { data: data ? {...data, user_nickname: data.participants?.nickname, user_avatar: data.participants?.avatar_url} : null }
}

export const submitVote = async (data) => {
  const participant = getParticipantFromToken()
  const { data: vote, error } = await supabase.from('votes').insert({
    performance_id: data.performance_id,
    participant_id: participant.participant_id,
    stars: data.stars
  }).select().single()
  
  if (error) {
    if (error.code === '23505') throw new Error('Hai già votato!')
    throw error
  }
  return { data: vote }
}

export const sendReaction = async (data) => {
  const participant = getParticipantFromToken()
  const { data: reaction, error } = await supabase.from('reactions').insert({
    event_id: participant.event_id,
    participant_id: participant.participant_id,
    emoji: data.emoji
  }).select().single()
  
  if (error) throw error
  return { data: reaction }
}

export const sendMessage = async (data) => {
  // MODIFICA CRUCIALE: Verifica prima se c'è un token UTENTE valido
  // Se c'è un token utente, usa quello (status: pending)
  // Altrimenti controlla se c'è pubCode (admin, status: approved)
  
  try {
    // PRIORITÀ 1: Controlla se è un UTENTE (ha neonpub_token)
    const userToken = localStorage.getItem('neonpub_token');
    if (userToken) {
      const participant = getParticipantFromToken();
      const text = typeof data === 'string' ? data : (data.text || data.message);
      const { data: message, error } = await supabase.from('messages').insert({
          event_id: participant.event_id,
          participant_id: participant.participant_id, 
          text: text, 
          status: 'pending'  // ← UTENTI: PENDING
      }).select().single();
      if (error) throw error;
      return { data: message };
    }
  } catch (e) {
    // Se fallisce, passa al controllo admin
    console.log('Non è un utente, provo con admin');
  }

  // PRIORITÀ 2: Controlla se è ADMIN (ha neonpub_pub_code)
  const pubCode = localStorage.getItem('neonpub_pub_code');
  if (pubCode) {
      const { data: event } = await supabase.from('events').select('id').eq('code', pubCode.toUpperCase()).single();
      if (event) {
           const text = typeof data === 'string' ? data : (data.text || data.message);
           const { data: message, error } = await supabase.from('messages').insert({
                event_id: event.id,
                participant_id: null,  // ← ADMIN: null
                text: text, 
                status: 'approved'     // ← ADMIN: APPROVED
           }).select().single();
           if (error) throw error;
           return { data: message };
      }
  }

  throw new Error("Errore invio messaggio: autenticazione non valida.");
}

export const getAdminPendingMessages = async () => {
  const event = await getAdminEvent()
  if (!event || !event.id) throw new Error("Evento non valido");
  
  const { data, error } = await supabase.from('messages')
      .select('*, participants(nickname)')
      .eq('event_id', event.id)
      .eq('status', 'pending') 
  
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
  await supabase.from('events').update({ active_module: 'quiz', active_module_id: quiz.id }).eq('id', event.id);
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
      quiz_id: quizId, question: quiz.question, correct_option: quiz.options[quiz.correct_index], correct_index: quiz.correct_index,
      total_answers: answers.length, correct_count: correctAnswers.length, 
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

  // FIX: Filtri rigorosi per event_id su TUTTE le tabelle
  const [perf, queue, lb, activeQuiz, adminMsg, approvedMsgs] = await Promise.all([
    supabase.from('performances').select('*, participants(nickname, avatar_url)').eq('event_id', event.id).in('status', ['live','voting','paused','ended']).order('started_at', {ascending: false}).limit(1).maybeSingle(),
    supabase.from('song_requests').select('*, participants(nickname, avatar_url)').eq('event_id', event.id).eq('status', 'queued').limit(10), 
    supabase.from('participants').select('nickname, score, avatar_url').eq('event_id', event.id).order('score', {ascending:false}).limit(20),
    supabase.from('quizzes').select('*').eq('event_id', event.id).in('status', ['active', 'closed', 'showing_results', 'leaderboard']).maybeSingle(),
    // Messaggio REGIA (sovraimpressione)
    supabase.from('messages').select('*').eq('event_id', event.id).is('participant_id', null).eq('status', 'approved').order('created_at', {ascending: false}).limit(1).maybeSingle(),
    // Messaggi UTENTI (banner scorrevole)
    supabase.from('messages').select('*, participants(nickname)').eq('event_id', event.id).not('participant_id', 'is', null).eq('status', 'approved').order('created_at', {ascending: false}).limit(10)
  ])

  let currentPerformance = perf.data ? {...perf.data, user_nickname: perf.data.participants?.nickname, user_avatar: perf.data.participants?.avatar_url} : null;
  if (currentPerformance && currentPerformance.status === 'ended') {
      const endedAt = new Date(currentPerformance.ended_at);
      const now = new Date();
      if ((now - endedAt) > 15 * 1000) { 
          currentPerformance = null;
      }
  }

  return {
    data: {
      pub: event,
      current_performance: currentPerformance,
      queue: queue.data?.map(q => ({...q, user_nickname: q.participants?.nickname, user_avatar: q.participants?.avatar_url})),
      leaderboard: lb.data,
      active_quiz: activeQuiz.data,
      admin_message: adminMsg.data,
      // FILTRO: solo messaggi UTENTI (con participants.nickname)
      approved_messages: approvedMsgs.data?.filter(m => m.participants?.nickname).map(m => ({text: m.text, nickname: m.participants?.nickname})) || []
    }
  }
}

export default {
  createPub, updateEventSettings, uploadLogo, getPub, joinPub, uploadAvatar, adminLogin, getMe,
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