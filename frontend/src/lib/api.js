import { supabase } from './supabase'

function getParticipantFromToken() {
  const token = localStorage.getItem('discojoys_token')
  if (!token) throw new Error('Not authenticated')
  try { return JSON.parse(atob(token)) } catch { throw new Error('Invalid token') }
}

async function getAdminEvent() {
  const pubCode = localStorage.getItem('discojoys_pub_code')
  if (!pubCode) throw new Error('No event selected')
  const { data } = await supabase.from('events').select('*').eq('code', pubCode.toUpperCase()).single()
  if (!data || (data.expires_at && new Date(data.expires_at) < new Date())) throw new Error("Evento scaduto");
  return data
}

// --- FUNZIONI DISPLAY ---

export const getDisplayData = async (pubCode) => {
  const { data: event } = await supabase.from('events').select('*').eq('code', pubCode.toUpperCase()).single()
  if (!event || (event.expires_at && new Date(event.expires_at) < new Date())) return { data: null };

  const [perf, queue, lb, activeQuiz, adminMsg, approvedMsgs, activeArcade] = await Promise.all([
    supabase.from('performances').select('*, participants(nickname, avatar_url)').eq('event_id', event.id).in('status', ['live','voting','paused','ended']).order('started_at', {ascending: false}).limit(1).maybeSingle(),
    supabase.from('song_requests').select('*, participants(nickname, avatar_url)').eq('event_id', event.id).eq('status', 'queued').order('position', {ascending: true}).limit(10), 
    supabase.from('participants').select('nickname, score, avatar_url').eq('event_id', event.id).order('score', {ascending:false}).limit(20),
    supabase.from('quizzes').select('*').eq('event_id', event.id).in('status', ['active', 'closed', 'showing_results', 'leaderboard']).maybeSingle(),
    supabase.from('messages').select('*').eq('event_id', event.id).is('participant_id', null).eq('status', 'approved').order('created_at', {ascending: false}).limit(1).maybeSingle(),
    supabase.from('messages').select('*, participants(nickname)').eq('event_id', event.id).not('participant_id', 'is', null).eq('status', 'approved').order('created_at', {ascending: false}).limit(10),
    // NOTA: Escludiamo 'archived' così sparisce quando l'admin lo archivia
    supabase.from('arcade_games').select('*').eq('event_id', event.id).in('status', ['setup', 'waiting', 'active', 'paused', 'ended']).order('created_at', {ascending: false}).limit(1).maybeSingle()
  ])

  let currentPerformance = perf.data ? {...perf.data, user_nickname: perf.data.participants?.nickname, user_avatar: perf.data.participants?.avatar_url} : null;
  if (currentPerformance && currentPerformance.status === 'ended') {
      if ((new Date() - new Date(currentPerformance.ended_at)) > 15000) currentPerformance = null;
  }

  const queueData = (queue.data || []).filter(q => currentPerformance?.song_request_id !== q.id).map(q => ({...q, user_nickname: q.participants?.nickname, user_avatar: q.participants?.avatar_url}));

  return {
    data: {
      pub: event, current_performance: currentPerformance, queue: queueData, leaderboard: lb.data, active_quiz: activeQuiz.data, admin_message: adminMsg.data, extraction_data: event.extraction_data, active_arcade: activeArcade.data,
      approved_messages: approvedMsgs.data?.filter(m => m.participants?.nickname).map(m => ({text: m.text, nickname: m.participants?.nickname})) || []
    }
  }
}

// FIX EMOTICON: Usa Broadcast per invio istantaneo e sicuro
export const sendReaction = async (data) => {
  const participant = getParticipantFromToken();
  const nickname = participant.nickname || 'Anonimo';
  
  // 1. Invia via Broadcast (Veloce, arriva al display subito)
  await supabase.channel('tv_ctrl').send({
    type: 'broadcast',
    event: 'reaction',
    payload: { emoji: data.emoji, nickname: nickname }
  });

  // 2. Salva nel DB (Opzionale, solo per statistiche future, non blocca l'invio)
  supabase.from('reactions').insert({
      event_id: participant.event_id, 
      participant_id: participant.participant_id, 
      emoji: data.emoji, 
      nickname: nickname 
  }).then(() => {}); // Fire and forget

  return { data: 'sent' };
}

// --- FUNZIONI ARCADE ---

export const getActiveArcadeGame = async () => {
  try {
    let eventId = null;
    const pubCode = localStorage.getItem('discojoys_pub_code');
    if (pubCode) {
        const { data } = await supabase.from('events').select('id').eq('code', pubCode.toUpperCase()).single();
        if (data) eventId = data.id;
    } else {
        const token = localStorage.getItem('discojoys_token');
        if (token) eventId = JSON.parse(atob(token)).event_id;
    }
    if (!eventId) return { data: null };

    // Esclude 'archived'
    const { data } = await supabase.from('arcade_games').select('*').eq('event_id', eventId).in('status', ['setup', 'waiting', 'active', 'paused', 'ended']).order('created_at', { ascending: false }).limit(1);
    return { data: data?.[0] || null };
  } catch (error) { return { data: null }; }
};

// NUOVA FUNZIONE: Archivia il gioco per farlo sparire dal display
export const archiveArcadeGame = async (gameId) => {
    const { data, error } = await supabase.from('arcade_games').update({ status: 'archived', ended_at: new Date().toISOString() }).eq('id', gameId).select().single();
    if (error) throw error;
    return { data };
}

export const createArcadeGame = async ({ gameType = 'song_guess', trackId, trackTitle, trackArtist, trackUrl, correctAnswer, pointsReward = 100, maxAttempts = 3, penaltySeconds = 10, mediaType = 'spotify', category = 'Generale', question = 'Indovina la canzone!', options = [] }) => {
    const event = await getAdminEvent();
    await supabase.from('arcade_games').update({ status: 'archived' }).eq('event_id', event.id).in('status', ['setup', 'waiting', 'active', 'paused', 'ended']);
    const { data, error } = await supabase.from('arcade_games').insert({
        event_id: event.id, game_type: gameType, status: 'setup', track_id: trackId, track_title: trackTitle, track_artist: trackArtist, track_url: trackUrl, correct_answer: correctAnswer, points_reward: pointsReward, max_attempts: maxAttempts, penalty_seconds: penaltySeconds, media_type: mediaType, category: category, question: question, options: options
      }).select().single();
    if (error) throw error;
    return { data };
}

export const startArcadeGame = async (gameId) => { const { data, error } = await supabase.from('arcade_games').update({ status: 'active', started_at: new Date().toISOString() }).eq('id', gameId).select().single(); if (error) throw error; return { data }; }
export const pauseArcadeGame = async (gameId) => { const { data, error } = await supabase.from('arcade_games').update({ status: 'paused' }).eq('id', gameId).select().single(); if (error) throw error; return { data }; }
export const resumeArcadeGame = async (gameId) => { const { data, error } = await supabase.from('arcade_games').update({ status: 'active' }).eq('id', gameId).select().single(); if (error) throw error; return { data }; }
export const endArcadeGame = async (gameId) => { const { data, error } = await supabase.from('arcade_games').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('id', gameId).select().single(); if (error) throw error; return { data }; }

export const validateArcadeAnswer = async (bookingId, isCorrect, givenAnswer = null) => {
    const { data: booking } = await supabase.from('arcade_bookings').select('*, arcade_games(*)').eq('id', bookingId).single();
    const game = booking.arcade_games;
    let pointsAwarded = isCorrect ? game.points_reward : 0;
    
    const { data: updatedBooking, error } = await supabase.from('arcade_bookings').update({ status: isCorrect ? 'correct' : 'wrong', validated_at: new Date().toISOString(), points_awarded: pointsAwarded, given_answer: givenAnswer }).eq('id', bookingId).select().single();
    if (error) throw error;
    
    if (isCorrect) {
      const { data: p } = await supabase.from('participants').select('score').eq('id', booking.participant_id).single();
      await supabase.from('participants').update({ score: (p?.score || 0) + pointsAwarded }).eq('id', booking.participant_id);
      await supabase.from('arcade_games').update({ status: 'ended', winner_id: booking.participant_id, ended_at: new Date().toISOString() }).eq('id', game.id);
    }
    return { data: updatedBooking, isCorrect };
}

export const bookArcadeAnswer = async (gameId, participantId) => {
    const { data: game } = await supabase.from('arcade_games').select('*').eq('id', gameId).single();
    if (game.status !== 'active') throw new Error('Gioco non attivo');
    const { data: exist } = await supabase.from('arcade_bookings').select('*').eq('game_id', gameId).eq('participant_id', participantId).eq('status', 'pending').single();
    if (exist) throw new Error('Già prenotato');
    const { data, error } = await supabase.from('arcade_bookings').insert({ game_id: gameId, participant_id: participantId, status: 'pending' }).select().single();
    if (error) throw error; return { data };
}

export const getArcadeBookings = async (gameId) => { const { data } = await supabase.from('arcade_bookings').select(`*, participants:participant_id (id, nickname, avatar_url, score)`).eq('game_id', gameId).order('booking_order', { ascending: true }); return { data: data || [] }; }
export const getCurrentBooking = async (gameId) => { const { data } = await supabase.from('arcade_bookings').select(`*, participants:participant_id (id, nickname, avatar_url)`).eq('game_id', gameId).eq('status', 'pending').order('booking_order', { ascending: true }).limit(1); return { data: data?.[0] || null }; }
export const getArcadeLeaderboard = async () => { return { data: [] } }
export const cancelArcadeBooking = async (bookingId) => { const { data } = await supabase.from('arcade_bookings').update({ status: 'cancelled' }).eq('id', bookingId).select().single(); return { data }; }

// --- ALTRE FUNZIONI NECESSARIE ---
export const getMyVenues = async () => { const { data: user } = await supabase.auth.getUser(); const { data } = await supabase.from('venues').select('*').eq('operator_id', user.user.id).order('name'); return { data } }
export const createVenue = async (d) => { const { data: user } = await supabase.auth.getUser(); const { data, error } = await supabase.from('venues').insert({ operator_id: user.user.id, ...d }).select().single(); if(error) throw error; return { data } }
export const updateVenue = async (id, d) => { const { data, error } = await supabase.from('venues').update(d).eq('id', id).select().single(); if(error) throw error; return { data } }
export const deleteVenue = async (id) => { await supabase.from('venues').delete().eq('id', id); return { data: 'ok' } }
export const createPub = async (d) => {
  const { data: user } = await supabase.auth.getUser();
  const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.user.id).single();
  if (prof.credits < 1) throw new Error("No crediti");
  await supabase.from('profiles').update({ credits: prof.credits - 1 }).eq('id', user.user.id);
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
  const exp = new Date(); exp.setHours(exp.getHours()+8);
  const { data: evt, error } = await supabase.from('events').insert({ owner_id: user.user.id, name: d.name, code, venue_id: d.venue_id, expires_at: exp.toISOString(), status: 'active', active_module: 'karaoke' }).select().single();
  if (error) throw error; return { data: evt };
}
export const getActiveEventsForUser = async () => { const { data: user } = await supabase.auth.getUser(); const now = new Date().toISOString(); const { data } = await supabase.from('events').select('*').eq('owner_id', user.user.id).eq('status', 'active').gt('expires_at', now); return data || []; }
export const requestSong = async (d) => { const p = getParticipantFromToken(); const { data, error } = await supabase.from('song_requests').insert({ event_id: p.event_id, participant_id: p.participant_id, title: d.title, artist: d.artist, youtube_url: d.youtube_url, status: 'pending' }).select().single(); if(error) throw error; return { data }; }
export const getSongQueue = async () => { const p = getParticipantFromToken(); const { data } = await supabase.from('song_requests').select('*, participants(nickname)').eq('event_id', p.event_id).eq('status', 'queued').order('position'); return { data: data.map(x=>({...x, user_nickname: x.participants?.nickname})) }; }
export const getMyRequests = async () => { const p = getParticipantFromToken(); const { data } = await supabase.from('song_requests').select('*').eq('participant_id', p.participant_id).order('requested_at', {ascending:false}); return { data }; }

// Export massiccio per compatibilità
export const getPub = async (c) => { const { data } = await supabase.from('events').select('*').eq('code', c.toUpperCase()).single(); if(!data || (data.expires_at && new Date(data.expires_at)<new Date())) return {data:null}; return {data}; }
export const joinPub = async ({pub_code, nickname, avatar_url}) => { const { data: e } = await supabase.from('events').select('id, name').eq('code', pub_code.toUpperCase()).single(); if(!e) throw new Error("No event"); let { data: p } = await supabase.from('participants').select('*').eq('event_id', e.id).eq('nickname', nickname).maybeSingle(); if(p) { await supabase.from('participants').update({last_activity: new Date(), avatar_url: avatar_url || p.avatar_url}).eq('id', p.id); } else { const {data:newP} = await supabase.from('participants').insert({event_id: e.id, nickname, avatar_url}).select().single(); p=newP; } const token = btoa(JSON.stringify({participant_id: p.id, event_id: e.id, nickname, pub_name: e.name})); return {data: {token, user: {...p, pub_name: e.name}}}; }
export const adminLogin = async (d) => ({data:{user:{email:d.email}}}); export const getMe = async () => { const {data:{user}} = await supabase.auth.getUser(); return {data:user}}; export const getAllProfiles = async () => { const {data} = await supabase.from('profiles').select('*'); return {data}}; export const updateProfileCredits = async (id, c) => supabase.from('profiles').update({credits:c}).eq('id', id); export const toggleUserStatus = async (id, s) => supabase.from('profiles').update({is_active:s}).eq('id', id); export const createOperatorProfile = async () => {}; export const uploadLogo = async () => {}; export const updateEventSettings = async () => {}; export const uploadAvatar = async (f) => { const n=`${Date.now()}_${f.name}`; await supabase.storage.from('avatars').upload(n,f); const {data} = supabase.storage.from('avatars').getPublicUrl(n); return data.publicUrl; }; export const getEventState = async () => { const c = localStorage.getItem('discojoys_pub_code'); const {data} = await supabase.from('events').select('active_module, active_module_id').eq('code', c).maybeSingle(); return data; }; export const setEventModule = async (m, id) => { const c = localStorage.getItem('discojoys_pub_code'); await supabase.from('events').update({active_module:m, active_module_id:id}).eq('code', c); }; export const getQuizCatalog = async () => ({data:[]}); export const deleteQuizQuestion = async () => {}; export const getChallengeCatalog = async () => ({data:[]}); export const importQuizCatalog = async () => {}; export const getAdminQueue = async () => ({data:[]}); export const approveRequest = async (id) => supabase.from('song_requests').update({status:'queued'}).eq('id', id); export const rejectRequest = async (id) => supabase.from('song_requests').update({status:'rejected'}).eq('id', id); export const deleteRequest = async (id) => supabase.from('song_requests').update({status:'rejected'}).eq('id', id); export const startPerformance = async (reqId, url) => { const {data:r} = await supabase.from('song_requests').select('*').eq('id', reqId).single(); await supabase.from('performances').update({status:'ended'}).eq('event_id', r.event_id).neq('status','ended'); const {data:p} = await supabase.from('performances').insert({event_id:r.event_id, song_request_id:r.id, participant_id:r.participant_id, song_title:r.title, song_artist:r.artist, youtube_url:url, status:'live'}).select().single(); await supabase.from('song_requests').update({status:'performing'}).eq('id', reqId); return {data:p}; }; export const endPerformance = async (id) => supabase.from('performances').update({status:'voting'}).eq('id', id); export const closeVoting = async (id) => supabase.from('performances').update({status:'ended'}).eq('id', id); export const stopAndNext = async (id) => supabase.from('performances').update({status:'ended'}).eq('id', id); export const pausePerformance = async (id) => supabase.from('performances').update({status:'paused'}).eq('id', id); export const resumePerformance = async (id) => supabase.from('performances').update({status:'live'}).eq('id', id); export const restartPerformance = async (id) => supabase.from('performances').update({status:'live', started_at: new Date()}).eq('id', id); export const toggleMute = async (v) => supabase.channel('tv_ctrl').send({type:'broadcast', event:'control', payload:{command:'mute', value:v}}); export const getCurrentPerformance = async () => { const p = getParticipantFromToken(); const {data} = await supabase.from('performances').select('*, participants(nickname)').eq('event_id', p.event_id).in('status', ['live','voting','paused']).maybeSingle(); return {data: data ? {...data, user_nickname: data.participants?.nickname} : null}; }; export const getAdminCurrentPerformance = async () => { const e = await getAdminEvent(); const {data} = await supabase.from('performances').select('*, participants(nickname)').eq('event_id', e.id).in('status', ['live','voting','paused']).maybeSingle(); return {data: data ? {...data, user_nickname: data.participants?.nickname} : null}; }; export const submitVote = async (d) => { const p = getParticipantFromToken(); await supabase.from('votes').insert({performance_id:d.performance_id, participant_id:p.participant_id, score:d.score}); return {data:'ok'}; }; export const sendMessage = async (d) => { const p = getParticipantFromToken(); await supabase.from('messages').insert({event_id:p.event_id, participant_id:p.participant_id, text:d.text, status:'pending'}); return {data:'ok'}; }; export const sendAdminMessage = async (d) => { const e = await getAdminEvent(); await supabase.from('messages').insert({event_id:e.id, text:d.text, status:'approved'}); }; export const getAdminPendingMessages = async () => ({data:[]}); export const approveMessage = async (id) => supabase.from('messages').update({status:'approved'}).eq('id', id); export const rejectMessage = async (id) => supabase.from('messages').update({status:'rejected'}).eq('id', id); export const deleteAdminMessage = async (id) => supabase.from('messages').delete().eq('id', id); export const deleteApprovedMessage = async (id) => supabase.from('messages').delete().eq('id', id); export const startQuiz = async () => {}; export const closeQuizVoting = async () => {}; export const showQuizResults = async () => {}; export const showQuizLeaderboard = async () => {}; export const endQuiz = async () => {}; export const getQuizResults = async () => ({data:{}}); export const answerQuiz = async () => {}; export const getActiveQuiz = async () => ({data:null}); export const getLeaderboard = async () => ({data:[]}); export const getAdminLeaderboard = async () => ({data:[]}); export const importCustomQuiz = async () => {}; export const trackQuizUsage = async () => {}; export const resetQuizUsageForVenue = async () => {}; export const getRandomSongPool = async () => ({data:[]}); export const addSongToPool = async () => {}; export const updateSongInPool = async () => {}; export const deleteSongFromPool = async () => {}; export const importSongsToPool = async () => {}; export const extractRandomKaraoke = async () => {}; export const clearExtraction = async () => {}; export const getSongCatalog = async () => ({data:[]}); export const getSongCatalogMoods = async () => ({data:[]}); export const getSongCatalogGenres = async () => ({data:[]}); export const addSongToCatalog = async () => {}; export const updateSongInCatalog = async () => {}; export const deleteSongFromCatalog = async () => {}; export const importSongsToCatalog = async () => {}; export const addCatalogSongToPool = async () => {}; export const addCatalogCategoryToPool = async () => {}; export const getQuizModules = async () => ({data:[]}); export const loadQuizModule = async () => {};

export default {
    getDisplayData, sendReaction, getActiveArcadeGame, createPub, updateEventSettings, uploadLogo, getPub, joinPub, uploadAvatar, adminLogin, getMe,
    getAllProfiles, updateProfileCredits, createOperatorProfile, toggleUserStatus,
    getEventState, setEventModule, getQuizCatalog, getChallengeCatalog, importQuizCatalog,
    requestSong, getSongQueue, getMyRequests, getAdminQueue, approveRequest, rejectRequest, deleteRequest,
    startPerformance, pausePerformance, resumePerformance, endPerformance, closeVoting, stopAndNext, restartPerformance, toggleMute,
    getCurrentPerformance, getAdminCurrentPerformance,
    submitVote, sendMessage, sendAdminMessage, getAdminPendingMessages, approveMessage, rejectMessage, deleteAdminMessage, deleteApprovedMessage, 
    createArcadeGame, startArcadeGame, pauseArcadeGame, resumeArcadeGame, endArcadeGame, archiveArcadeGame, bookArcadeAnswer, validateArcadeAnswer, getArcadeBookings, getCurrentBooking, cancelArcadeBooking, getArcadeLeaderboard,
    importCustomQuiz, startQuiz, endQuiz, answerQuiz, getActiveQuiz, closeQuizVoting, showQuizResults, showQuizLeaderboard,
    getQuizResults, getAdminLeaderboard, getLeaderboard, 
    getActiveEventsForUser, deleteQuizQuestion, getQuizModules, loadQuizModule,
    getMyVenues, createVenue, updateVenue, deleteVenue, trackQuizUsage, resetQuizUsageForVenue,
    getRandomSongPool, addSongToPool, updateSongInPool, deleteSongFromPool, importSongsToPool, extractRandomKaraoke, clearExtraction,
    getSongCatalog, getSongCatalogMoods, getSongCatalogGenres, addSongToCatalog, updateSongInCatalog, deleteSongFromCatalog, importSongsToCatalog, addCatalogSongToPool, addCatalogCategoryToPool
}