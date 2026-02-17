import { supabase } from './supabase'

function getParticipantFromToken() {
  const token = localStorage.getItem('discojoys_token')
  if (!token) throw new Error('Not authenticated')
  try {
    return JSON.parse(atob(token))
  } catch {
    throw new Error('Invalid token')
  }
}

async function getAdminEvent() {
  const pubCode = localStorage.getItem('discojoys_pub_code')
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

// --- FUNZIONI BASE ---

export const getDisplayData = async (pubCode) => {
  const { data: event } = await supabase.from('events').select('*').eq('code', pubCode.toUpperCase()).single()
  
  if (!event || event.status === 'ended' || (event.expires_at && new Date(event.expires_at) < new Date())) {
      return { data: null };
  }

  const [perf, queue, lb, activeQuiz, adminMsg, approvedMsgs, activeArcade] = await Promise.all([
    supabase.from('performances').select('*, participants(nickname, avatar_url)').eq('event_id', event.id).in('status', ['live','voting','paused','ended']).order('started_at', {ascending: false}).limit(1).maybeSingle(),
    supabase.from('song_requests').select('*, participants(nickname, avatar_url)').eq('event_id', event.id).eq('status', 'queued').order('position', {ascending: true}).limit(10), 
    supabase.from('participants').select('nickname, score, avatar_url').eq('event_id', event.id).order('score', {ascending:false}).limit(20),
    supabase.from('quizzes').select('*').eq('event_id', event.id).in('status', ['active', 'closed', 'showing_results', 'leaderboard']).maybeSingle(),
    supabase.from('messages').select('*').eq('event_id', event.id).is('participant_id', null).eq('status', 'approved').order('created_at', {ascending: false}).limit(1).maybeSingle(),
    supabase.from('messages').select('*, participants(nickname)').eq('event_id', event.id).not('participant_id', 'is', null).eq('status', 'approved').order('created_at', {ascending: false}).limit(10),
    // FIX: Include anche 'ended' per mostrare il vincitore
    supabase.from('arcade_games').select('*').eq('event_id', event.id).in('status', ['setup', 'waiting', 'active', 'paused', 'ended']).order('created_at', {ascending: false}).limit(1).maybeSingle()
  ])

  let currentPerformance = perf.data ? {...perf.data, user_nickname: perf.data.participants?.nickname, user_avatar: perf.data.participants?.avatar_url} : null;
  if (currentPerformance && currentPerformance.status === 'ended') {
      const endedAt = new Date(currentPerformance.ended_at);
      const now = new Date();
      if ((now - endedAt) > 15 * 1000) { 
          currentPerformance = null;
      }
  }

  const liveRequestId = currentPerformance?.song_request_id || null;
  const queueData = (queue.data || [])
    .filter(q => !liveRequestId || q.id !== liveRequestId)
    .map(q => ({...q, user_nickname: q.participants?.nickname, user_avatar: q.participants?.avatar_url}));

  return {
    data: {
      pub: event,
      current_performance: currentPerformance,
      queue: queueData,
      leaderboard: lb.data,
      active_quiz: activeQuiz.data,
      admin_message: adminMsg.data,
      extraction_data: event.extraction_data,
      active_arcade: activeArcade.data,
      approved_messages: approvedMsgs.data?.filter(m => m.participants?.nickname).map(m => ({text: m.text, nickname: m.participants?.nickname})) || []
    }
  }
}

// FIX: Assicura che il nickname venga inviato
export const sendReaction = async (data) => {
  const participant = getParticipantFromToken()
  const nicknameToSend = participant.nickname || 'Anonimo';
  
  const { data: reaction, error } = await supabase.from('reactions').insert({
      event_id: participant.event_id, 
      participant_id: participant.participant_id, 
      emoji: data.emoji, 
      nickname: nicknameToSend 
    }).select().single()
  
  if (error) throw error
  return { data: reaction }
}

// --- ARCADE FUNCTIONS (Quelle che davano errore di import) ---

export const getActiveArcadeGame = async () => {
  try {
    // Nota: usiamo local storage o event id se disponibile, altrimenti null
    // Per ClientApp, getAdminEvent potrebbe fallire se non è un admin.
    // Usiamo una logica mista sicura.
    let eventId = null;
    
    // Tentativo 1: Admin
    const pubCode = localStorage.getItem('discojoys_pub_code');
    if (pubCode) {
        const { data } = await supabase.from('events').select('id').eq('code', pubCode.toUpperCase()).single();
        if (data) eventId = data.id;
    } 
    // Tentativo 2: Utente (ClientApp)
    else {
        const token = localStorage.getItem('discojoys_token');
        if (token) {
            const p = JSON.parse(atob(token));
            eventId = p.event_id;
        }
    }

    if (!eventId) return { data: null };

    const { data, error } = await supabase
      .from('arcade_games')
      .select('*')
      .eq('event_id', eventId)
      .in('status', ['setup', 'waiting', 'active', 'paused', 'ended']) // Include ended per mostrare vincitore
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (error) throw error;
    return { data: data?.[0] || null };
  } catch (error) {
    console.error('❌ Errore getActiveArcadeGame:', error);
    return { data: null };
  }
};

export const createArcadeGame = async ({
  gameType = 'song_guess', trackId, trackTitle, trackArtist, trackUrl, correctAnswer, pointsReward = 100, maxAttempts = 3, penaltySeconds = 10, mediaType = 'spotify', category = 'Generale', question = 'Indovina la canzone!', options = []
}) => {
  try {
    const event = await getAdminEvent();
    await supabase.from('arcade_games').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('event_id', event.id).in('status', ['setup', 'waiting', 'active', 'paused']);
    const { data, error } = await supabase.from('arcade_games').insert({
        event_id: event.id, game_type: gameType, status: 'setup', track_id: trackId, track_title: trackTitle, track_artist: trackArtist, track_url: trackUrl, correct_answer: correctAnswer, points_reward: pointsReward, max_attempts: maxAttempts, penalty_seconds: penaltySeconds, media_type: mediaType, category: category, question: question, options: options
      }).select().single();
    if (error) throw error;
    return { data };
  } catch (error) { throw error; }
}

export const startArcadeGame = async (gameId) => { try { const { data, error } = await supabase.from('arcade_games').update({ status: 'active', started_at: new Date().toISOString() }).eq('id', gameId).select().single(); if (error) throw error; return { data }; } catch (error) { throw error; } }
export const pauseArcadeGame = async (gameId) => { try { const { data, error } = await supabase.from('arcade_games').update({ status: 'paused' }).eq('id', gameId).select().single(); if (error) throw error; return { data }; } catch (error) { throw error; } }
export const resumeArcadeGame = async (gameId) => { try { const { data, error } = await supabase.from('arcade_games').update({ status: 'active' }).eq('id', gameId).select().single(); if (error) throw error; return { data }; } catch (error) { throw error; } }
export const endArcadeGame = async (gameId) => { try { const { data, error } = await supabase.from('arcade_games').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('id', gameId).select().single(); if (error) throw error; return { data }; } catch (error) { throw error; } }

export const bookArcadeAnswer = async (gameId, participantId) => {
  try {
    const { data: game, error: gameError } = await supabase.from('arcade_games').select('*').eq('id', gameId).single();
    if (gameError) throw gameError;
    if (game.status !== 'active') throw new Error('Il gioco non è attivo');
    const { data: existingBooking } = await supabase.from('arcade_bookings').select('*').eq('game_id', gameId).eq('participant_id', participantId).eq('status', 'pending').single();
    if (existingBooking) throw new Error('Hai già una prenotazione in corso');
    const { data, error } = await supabase.from('arcade_bookings').insert({ game_id: gameId, participant_id: participantId, status: 'pending', response_time: null }).select().single();
    if (error) throw error;
    return { data };
  } catch (error) { throw error; }
}

// FIX: Assicura che winner_id ed ended_at siano impostati correttamente
export const validateArcadeAnswer = async (bookingId, isCorrect, givenAnswer = null) => {
  try {
    const { data: booking, error: bookingError } = await supabase.from('arcade_bookings').select('*, arcade_games(*)').eq('id', bookingId).single();
    if (bookingError) throw bookingError;
    
    const game = booking.arcade_games;
    let pointsAwarded = isCorrect ? game.points_reward : 0;
    
    const { data: updatedBooking, error: updateError } = await supabase.from('arcade_bookings')
      .update({ 
        status: isCorrect ? 'correct' : 'wrong', 
        validated_at: new Date().toISOString(), 
        points_awarded: pointsAwarded, 
        given_answer: givenAnswer 
      })
      .eq('id', bookingId)
      .select().single();
    
    if (updateError) throw updateError;
    
    if (isCorrect) {
      // 1. Assegna punti
      const { data: p } = await supabase.from('participants').select('score').eq('id', booking.participant_id).single();
      await supabase.from('participants').update({ score: (p?.score || 0) + pointsAwarded }).eq('id', booking.participant_id);
      
      // 2. CHIUDI GIOCO E SETTA VINCITORE (Critico per display)
      await supabase.from('arcade_games')
        .update({ 
          status: 'ended', 
          winner_id: booking.participant_id, 
          ended_at: new Date().toISOString() 
        })
        .eq('id', game.id);
    }
    
    return { data: updatedBooking, isCorrect };
  } catch (error) { throw error; }
}

export const getArcadeBookings = async (gameId) => { try { const { data, error } = await supabase.from('arcade_bookings').select(`*, participants:participant_id (id, nickname, avatar_url, score)`).eq('game_id', gameId).order('booking_order', { ascending: true }); if (error) throw error; return { data: data || [] }; } catch (error) { throw error; } }
export const getCurrentBooking = async (gameId) => { try { const { data, error } = await supabase.from('arcade_bookings').select(`*, participants:participant_id (id, nickname, avatar_url)`).eq('game_id', gameId).eq('status', 'pending').order('booking_order', { ascending: true }).limit(1); if (error) throw error; return { data: data?.[0] || null }; } catch (error) { return { data: null }; } }
export const getArcadeLeaderboard = async () => { return { data: [] } }
export const cancelArcadeBooking = async (bookingId) => { try { const { data, error } = await supabase.from('arcade_bookings').update({ status: 'cancelled' }).eq('id', bookingId).select().single(); if (error) throw error; return { data }; } catch (error) { throw error; } }

// --- ALTRE FUNZIONI NECESSARIE ---

export const createPub = async (data) => {
  const { data: user } = await supabase.auth.getUser()
  if (!user?.user) throw new Error('Not authenticated')
  const { data: profile } = await supabase.from('profiles').select('credits, is_active').eq('id', user.user.id).single();
  if (!profile || !profile.is_active) throw new Error("Utente disabilitato.");
  if (profile.credits < 1) throw new Error("Crediti insufficienti!");
  await supabase.from('profiles').update({ credits: profile.credits - 1 }).eq('id', user.user.id);
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
  const expiresAt = new Date(); expiresAt.setHours(expiresAt.getHours() + 8);
  const eventData = { owner_id: user.user.id, name: data.name, code: code, event_type: 'mixed', status: 'active', active_module: 'karaoke', expires_at: expiresAt.toISOString() };
  if (data.venue_id) eventData.venue_id = data.venue_id;
  const { data: event, error } = await supabase.from('events').insert(eventData).select().single()
  if (error) throw error; return { data: event }
}

export const getActiveEventsForUser = async () => {
  const { data: user } = await supabase.auth.getUser();
  if (!user?.user) return [];
  const now = new Date().toISOString();
  const { data } = await supabase.from('events').select('*').eq('owner_id', user.user.id).eq('status', 'active').gt('expires_at', now).order('created_at', { ascending: false });
  return data || [];
}

export const getPub = async (pubCode) => {
  if (!pubCode) return { data: null };
  const { data } = await supabase.from('events').select('*').eq('code', pubCode.toUpperCase()).single();
  if (!data || data.status === 'ended' || (data.expires_at && new Date(data.expires_at) < new Date())) return { data: null, expired: true };
  return { data }
}

export const joinPub = async ({ pub_code, nickname, avatar_url }) => {
  const { data: event } = await supabase.from('events').select('id, name, status, expires_at').eq('code', pub_code.toUpperCase()).single()
  if (!event || event.status !== 'active') throw new Error("Evento non valido");
  const { data: existing } = await supabase.from('participants').select('*').eq('event_id', event.id).eq('nickname', nickname).maybeSingle();
  let participant;
  if (existing) {
    const { data: up } = await supabase.from('participants').update({ last_activity: new Date().toISOString(), avatar_url: avatar_url || existing.avatar_url }).eq('id', existing.id).select().single();
    participant = up;
  } else {
    const { data: newP } = await supabase.from('participants').insert({ event_id: event.id, nickname, avatar_url }).select().single();
    participant = newP;
  }
  const token = btoa(JSON.stringify({ participant_id: participant.id, event_id: event.id, nickname, pub_name: event.name }));
  return { data: { token, user: { ...participant, pub_name: event.name } } }
}

export const requestSong = async (data) => {
  const p = getParticipantFromToken();
  const { data: r, error } = await supabase.from('song_requests').insert({ event_id: p.event_id, participant_id: p.participant_id, title: data.title, artist: data.artist, youtube_url: data.youtube_url, status: 'pending' }).select().single();
  if (error) throw error; return { data: r }
}

export const getSongQueue = async () => {
  const p = getParticipantFromToken();
  const { data } = await supabase.from('song_requests').select('*, participants(nickname)').eq('event_id', p.event_id).eq('status', 'queued').order('position', {ascending: true});
  return { data: (data||[]).map(x => ({...x, user_nickname: x.participants?.nickname})) }
}

export const getMyRequests = async () => {
  const p = getParticipantFromToken();
  const { data } = await supabase.from('song_requests').select('*').eq('participant_id', p.participant_id).order('requested_at', {ascending: false});
  return { data }
}

export const getCurrentPerformance = async () => {
  const p = getParticipantFromToken();
  const { data } = await supabase.from('performances').select('*, participants(nickname)').eq('event_id', p.event_id).in('status', ['live','voting','paused']).order('started_at', {ascending: false}).limit(1).maybeSingle();
  return { data: data ? {...data, user_nickname: data.participants?.nickname} : null }
}

export const getLeaderboard = async () => {
  const p = getParticipantFromToken();
  const { data } = await supabase.from('participants').select('id, nickname, score').eq('event_id', p.event_id).order('score', {ascending: false}).limit(20);
  return { data }
}

export const submitVote = async (data) => {
  const p = getParticipantFromToken();
  const { data: v, error } = await supabase.from('votes').insert({ performance_id: data.performance_id, participant_id: p.participant_id, score: data.score }).select().single();
  if (error && error.code === '23505') throw new Error('Hai già votato');
  // Trigger update average
  const { data: all } = await supabase.from('votes').select('score').eq('performance_id', data.performance_id);
  if(all.length) {
      const avg = all.reduce((a,b)=>a+b.score,0) / all.length;
      await supabase.from('performances').update({ average_score: avg }).eq('id', data.performance_id);
  }
  return { data: v }
}

export const sendMessage = async (data) => {
  const p = getParticipantFromToken();
  const text = typeof data === 'string' ? data : data.text;
  const { data: m, error } = await supabase.from('messages').insert({ event_id: p.event_id, participant_id: p.participant_id, text, status: 'pending' }).select().single();
  if (error) throw error; return { data: m }
}

export const getActiveQuiz = async () => {
  const p = getParticipantFromToken();
  const { data } = await supabase.from('quizzes').select('*').eq('event_id', p.event_id).in('status', ['active','closed','showing_results','leaderboard']).maybeSingle();
  return { data }
}

export const answerQuiz = async (data) => {
  const p = getParticipantFromToken();
  const { data: q } = await supabase.from('quizzes').select('*').eq('id', data.quiz_id).single();
  const isCorrect = q.correct_index === data.answer_index;
  let pts = 0;
  if(isCorrect) {
      pts = q.points || 10; // Semplificato per brevità
      const { data: u } = await supabase.from('participants').select('score').eq('id', p.participant_id).single();
      await supabase.from('participants').update({ score: (u?.score||0) + pts }).eq('id', p.participant_id);
  }
  const { data: ans, error } = await supabase.from('quiz_answers').insert({ quiz_id: data.quiz_id, participant_id: p.participant_id, answer_index: data.answer_index, is_correct: isCorrect }).select().single();
  if (error && error.code === '23505') throw new Error('Già risposto');
  return { data: { ...ans, points_earned: pts } }
}

export const getQuizResults = async (quizId) => {
  const { data: q } = await supabase.from('quizzes').select('*').eq('id', quizId).single();
  const { data: a } = await supabase.from('quiz_answers').select('*, participants(id,nickname,avatar_url)').eq('quiz_id', quizId);
  const winners = a.filter(x => x.is_correct).map(x => ({ id: x.participants.id, nickname: x.participants.nickname, avatar: x.participants.avatar_url, points: q.points }));
  return { data: { quiz_id: quizId, question: q.question, correct_option: q.options[q.correct_index], correct_index: q.correct_index, total_answers: a.length, correct_count: winners.length, winners, points: q.points } }
}

// Funzioni Admin / Extra (Stub o semplificate dove necessario per compilazione)
export const adminLogin = async () => ({ data: { user: { email: 'admin' } } });
export const getMe = async () => { const { data } = await supabase.auth.getUser(); return { data: data.user } };
export const getAllProfiles = async () => { const { data } = await supabase.from('profiles').select('*'); return { data } };
export const updateProfileCredits = async (id, val) => supabase.from('profiles').update({credits: val}).eq('id', id);
export const toggleUserStatus = async (id, val) => supabase.from('profiles').update({is_active: val}).eq('id', id);
export const createOperatorProfile = async () => {};
export const getAdminQueue = async () => { const ev = await getAdminEvent(); const {data} = await supabase.from('song_requests').select('*, participants(nickname)').eq('event_id', ev.id).in('status', ['pending','queued']); return { data: data.map(x=>({...x, user_nickname: x.participants?.nickname})) } };
export const approveRequest = async (id) => supabase.from('song_requests').update({status:'queued'}).eq('id', id);
export const rejectRequest = async (id) => supabase.from('song_requests').update({status:'rejected'}).eq('id', id);
export const deleteRequest = async (id) => supabase.from('song_requests').update({status:'rejected'}).eq('id', id);
export const getAdminCurrentPerformance = async () => { const ev = await getAdminEvent(); const {data} = await supabase.from('performances').select('*, participants(nickname)').eq('event_id', ev.id).in('status', ['live','voting','paused']).maybeSingle(); return { data: data ? {...data, user_nickname: data.participants?.nickname} : null } };
export const startPerformance = async (reqId, url) => {
    const {data: req} = await supabase.from('song_requests').select('*').eq('id', reqId).single();
    await supabase.from('performances').update({status:'ended'}).eq('event_id', req.event_id).neq('status','ended');
    const {data: p} = await supabase.from('performances').insert({ event_id: req.event_id, song_request_id: req.id, participant_id: req.participant_id, song_title: req.title, song_artist: req.artist, youtube_url: url, status: 'live' }).select().single();
    await supabase.from('song_requests').update({status:'performing'}).eq('id', reqId);
    return { data: p }
};
export const pausePerformance = async (id) => supabase.from('performances').update({status:'paused'}).eq('id', id);
export const resumePerformance = async (id) => supabase.from('performances').update({status:'live'}).eq('id', id);
export const restartPerformance = async (id) => supabase.from('performances').update({status:'live', started_at: new Date().toISOString()}).eq('id', id);
export const endPerformance = async (id) => supabase.from('performances').update({status:'voting'}).eq('id', id);
export const closeVoting = async (id) => supabase.from('performances').update({status:'ended', ended_at: new Date().toISOString()}).eq('id', id);
export const stopAndNext = async (id) => supabase.from('performances').update({status:'ended', ended_at: new Date().toISOString()}).eq('id', id);
export const getAdminPendingMessages = async () => { const ev = await getAdminEvent(); const {data} = await supabase.from('messages').select('*, participants(nickname)').eq('event_id', ev.id).eq('status', 'pending'); return { data: data.map(x=>({...x, user_nickname: x.participants?.nickname})) } };
export const approveMessage = async (id) => supabase.from('messages').update({status:'approved'}).eq('id', id);
export const rejectMessage = async (id) => supabase.from('messages').update({status:'rejected'}).eq('id', id);
export const sendAdminMessage = async (msg) => { const ev = await getAdminEvent(); await supabase.from('messages').insert({event_id: ev.id, text: msg.text, status: 'approved'}); };
export const deleteApprovedMessage = async (id) => supabase.from('messages').delete().eq('id', id);
export const uploadLogo = async () => {};
export const updateEventSettings = async () => {};
export const uploadAvatar = async () => {};
export const getEventState = async () => { return { active_module: 'karaoke' } };
export const setEventModule = async () => {};
export const getMyVenues = async () => ({data: []});
export const createVenue = async () => {};
export const updateVenue = async () => {};
export const deleteVenue = async () => {};
export const getRandomSongPool = async () => ({data: []});
export const addSongToPool = async () => {};
export const updateSongInPool = async () => {};
export const deleteSongFromPool = async () => {};
export const importSongsToPool = async () => {};
export const extractRandomKaraoke = async () => {};
export const clearExtraction = async () => {};
export const getSongCatalog = async () => ({data:[]});
export const getSongCatalogMoods = async () => ({data:[]});
export const getSongCatalogGenres = async () => ({data:[]});
export const getChallengeCatalog = async () => ({data:[]});
export const getQuizCatalog = async () => ({data:[]});
export const deleteQuizQuestion = async () => {};
export const importQuizCatalog = async () => {};
export const startQuiz = async () => {};
export const endQuiz = async () => {};
export const closeQuizVoting = async () => {};
export const showQuizResults = async () => {};
export const showQuizLeaderboard = async () => {};
export const trackQuizUsage = async () => {};
export const resetQuizUsageForVenue = async () => {};
export const getQuizModules = async () => ({data:[]});
export const loadQuizModule = async () => {};
export const toggleMute = async (val) => { const ch = supabase.channel('tv_ctrl'); await ch.send({ type: 'broadcast', event: 'control', payload: { command: 'mute', value: val } }); };
export const deleteAdminMessage = async () => {};
export const getAdminLeaderboard = async () => ({data:[]});
export const importCustomQuiz = async () => {};

// EXPORT DEFAULT FONDAMENTALE
export default {
    getDisplayData, sendReaction, getActiveArcadeGame, createPub, createArcadeGame, startArcadeGame, pauseArcadeGame, resumeArcadeGame, endArcadeGame, bookArcadeAnswer, validateArcadeAnswer, getArcadeBookings, getCurrentBooking, getArcadeLeaderboard, cancelArcadeBooking,
    getQuizResults, clearExtraction, getActiveQuiz, getAdminQueue, getAdminCurrentPerformance, getAdminPendingMessages, getSongCatalog, getSongCatalogMoods, getSongCatalogGenres, getChallengeCatalog, getEventState, getMyVenues, getActiveEventsForUser, getAllProfiles, getPub, uploadAvatar, joinPub, requestSong, getSongQueue, getMyRequests, approveRequest, rejectRequest, deleteRequest, startPerformance, endPerformance, closeVoting, stopAndNext, pausePerformance, resumePerformance, restartPerformance, toggleMute, getCurrentPerformance, submitVote, sendMessage, approveMessage, rejectMessage, startQuiz, closeQuizVoting, showQuizResults, showQuizLeaderboard, endQuiz, answerQuiz, getLeaderboard, sendAdminMessage, importCustomQuiz, deleteAdminMessage, deleteApprovedMessage, getAdminLeaderboard, createVenue, updateVenue, deleteVenue, trackQuizUsage, resetQuizUsageForVenue, getRandomSongPool, addSongToPool, updateSongInPool, deleteSongFromPool, importSongsToPool, extractRandomKaraoke, uploadLogo, updateEventSettings, adminLogin, getMe, updateProfileCredits, toggleUserStatus, createOperatorProfile, getQuizCatalog, deleteQuizQuestion, importQuizCatalog, getQuizModules, loadQuizModule
}