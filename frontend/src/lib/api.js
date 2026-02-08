import { supabase } from './supabase'

// HELPER: Ottieni utente o null (se sei regia)
function getParticipant() {
  const token = localStorage.getItem('neonpub_token');
  if (token) {
    try { return JSON.parse(atob(token)); } catch(e) {}
  }
  return null;
}

// HELPER: Ottieni ID evento (Funziona sia per Utente che per Admin)
async function getEventId() {
  const p = getParticipant();
  if (p) return p.event_id;

  const pubCode = localStorage.getItem('neonpub_pub_code');
  if (!pubCode) throw new Error('Nessun evento selezionato');
  
  const { data } = await supabase.from('events').select('id').eq('code', pubCode.toUpperCase()).single();
  if (!data) throw new Error('Evento non trovato');
  return data.id;
}

// --- AUTH ---
export const createPub = async (data) => {
  const { data: user } = await supabase.auth.getUser();
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
  const { data: event, error } = await supabase.from('events').insert({
      owner_id: user.user.id, name: data.name, code, event_type: 'mixed', status: 'active'
  }).select().single();
  if (error) throw error; return { data: event };
}

export const joinPub = async ({ pub_code, nickname }) => {
  const { data: event, error: evErr } = await supabase.from('events').select('id, name').eq('code', pub_code.toUpperCase()).eq('status', 'active').single();
  if (evErr) throw evErr;
  const { data: participant, error } = await supabase.from('participants').insert({ event_id: event.id, nickname }).select().single();
  if (error) { if (error.code === '23505') throw new Error('Nickname già usato'); throw error; }
  const token = btoa(JSON.stringify({ participant_id: participant.id, event_id: event.id, nickname, pub_name: event.name }));
  return { data: { token, user: { ...participant, pub_name: event.name } } };
}

export const adminLogin = async (data) => { return { data: { user: { email: data.email } } } }
export const getMe = async () => { const { data: { user } } = await supabase.auth.getUser(); return { data: user } }

// --- AZIONI ---
export const requestSong = async (data) => {
  const p = getParticipant(); if(!p) throw new Error("Scansiona il QR Code");
  const { data: req, error } = await supabase.from('song_requests').insert({
      event_id: p.event_id, participant_id: p.participant_id, title: data.title, artist: data.artist, youtube_url: data.youtube_url, status: 'pending'
  }).select().single();
  if (error) throw error; return { data: req };
}

// MESSAGGI (Gestisce sia Utente che Regia)
export const sendMessage = async (data) => {
  const p = getParticipant();
  const eventId = await getEventId(); 
  
  const text = typeof data === 'string' ? data : (data.text || data.message);
  // Se sei utente -> pending. Se sei admin (no p) -> approved subito.
  const status = p ? 'pending' : 'approved'; 
  
  const payload = {
      event_id: eventId,
      text: text,
      status: status,
      participant_id: p ? p.participant_id : null // Null se Regia
  };

  const { data: msg, error } = await supabase.from('messages').insert(payload).select().single();
  if (error) throw error; return { data: msg };
}

export const sendReaction = async (data) => {
  const p = getParticipant(); if(!p) return;
  if (data.message) return sendMessage(data.message);
  
  await supabase.from('reactions').insert({
      event_id: p.event_id, participant_id: p.participant_id, emoji: data.emoji, nickname: p.nickname
  });
}

// --- ADMIN GETTERS ---
export const getAdminQueue = async () => {
  const eventId = await getEventId();
  const { data } = await supabase.from('song_requests').select('*, participants(nickname)').eq('event_id', eventId).order('requested_at', {ascending: false});
  return { data: data.map(r => ({...r, user_nickname: r.participants?.nickname || 'Sconosciuto'})) };
}
export const getAdminCurrentPerformance = async () => {
  const eventId = await getEventId();
  const { data } = await supabase.from('performances').select('*, participants(nickname)').eq('event_id', eventId).in('status', ['live','voting','paused']).order('started_at', {ascending: false}).limit(1).maybeSingle();
  return { data: data ? {...data, user_nickname: data.participants?.nickname || 'Sconosciuto'} : null };
}
export const getAdminPendingMessages = async () => {
  const eventId = await getEventId();
  const { data } = await supabase.from('messages').select('*, participants(nickname)').eq('event_id', eventId).eq('status', 'pending');
  return { data: data.map(m => ({...m, user_nickname: m.participants?.nickname || 'Anonimo'})) };
}

// --- LIVE CONTROLS (Tasti Regia) ---
export const startPerformance = async (reqId, youtubeUrl) => {
  const { data: req } = await supabase.from('song_requests').select('*').eq('id', reqId).single();
  await supabase.from('performances').insert({
      event_id: req.event_id, song_request_id: req.id, participant_id: req.participant_id,
      song_title: req.title, song_artist: req.artist, youtube_url: youtubeUrl || req.youtube_url, status: 'live'
  });
  await supabase.from('song_requests').update({ status: 'queued' }).eq('id', reqId);
}
export const pausePerformance = async (id) => supabase.from('performances').update({ status: 'paused' }).eq('id', id);
export const resumePerformance = async (id) => supabase.from('performances').update({ status: 'live' }).eq('id', id);
export const restartPerformance = async (id) => {
    // Trucco: cambia stato per triggerare useEffect, poi rimetti live
    await supabase.from('performances').update({ status: 'restarted', started_at: new Date().toISOString() }).eq('id', id);
    setTimeout(() => supabase.from('performances').update({ status: 'live' }).eq('id', id), 1000);
}
export const endPerformance = async (id) => supabase.from('performances').update({ status: 'voting' }).eq('id', id);
export const closeVoting = async (id) => supabase.from('performances').update({ status: 'ended' }).eq('id', id);
export const skipPerformance = async (id) => supabase.from('performances').update({ status: 'ended' }).eq('id', id);
// NUOVI COMANDI MUTE/BLUR
export const togglePerformanceMute = async (id, val) => supabase.from('performances').update({ is_muted: val }).eq('id', id);
export const togglePerformanceBlur = async (id, val) => supabase.from('performances').update({ is_blurred: val }).eq('id', id);

// --- QUIZ (Con supporto Media) ---
export const startQuiz = async (data) => {
  const eventId = await getEventId();
  const { data: q, error } = await supabase.from('quizzes').insert({
      event_id: eventId, category: data.category, question: data.question, options: data.options,
      correct_index: data.correct_index, points: data.points, media_url: data.media_url, status: 'active'
  }).select().single();
  if(error) throw error; return { data: q };
}
export const getActiveQuiz = async () => {
  const p = getParticipant();
  let eventId = p ? p.event_id : await getEventId();
  const { data } = await supabase.from('quizzes').select('*').eq('event_id', eventId).in('status', ['active','closed','showing_results']).maybeSingle();
  return { data };
}
export const answerQuiz = async ({ quiz_id, answer_index }) => {
  const p = getParticipant();
  const { data: quiz } = await supabase.from('quizzes').select('correct_index, points').eq('id', quiz_id).single();
  const isCorrect = quiz.correct_index === answer_index;
  const { data: ans, error } = await supabase.from('quiz_answers').insert({
      quiz_id, participant_id: p.participant_id, answer_index, is_correct: isCorrect
  }).select().single();
  if(error && error.code === '23505') throw new Error('Già risposto');
  if(isCorrect) {
      const { data: part } = await supabase.from('participants').select('score').eq('id', p.participant_id).single();
      await supabase.from('participants').update({ score: (part.score || 0) + quiz.points }).eq('id', p.participant_id);
  }
  return { data: { ...ans, points_earned: isCorrect ? quiz.points : 0 } };
}

// ALTRI WRAPPERS
export const approveRequest = (id) => supabase.from('song_requests').update({status:'queued'}).eq('id', id);
export const rejectRequest = (id) => supabase.from('song_requests').update({status:'rejected'}).eq('id', id);
export const approveMessage = (id) => supabase.from('messages').update({status:'approved'}).eq('id', id);
export const rejectMessage = (id) => supabase.from('messages').update({status:'rejected'}).eq('id', id);
export const closeQuizVoting = (id) => supabase.from('quizzes').update({status:'closed'}).eq('id', id);
export const showQuizResults = (id) => supabase.from('quizzes').update({status:'showing_results'}).eq('id', id);
export const endQuiz = (id) => supabase.from('quizzes').update({status:'ended'}).eq('id', id);
export const getQuizResults = async (id) => {
    const { data: quiz } = await supabase.from('quizzes').select('*').eq('id', id).single();
    const { data: answers } = await supabase.from('quiz_answers').select('*, participants(nickname)').eq('quiz_id', id);
    const correct = answers.filter(a => a.is_correct);
    return { data: { ...quiz, total_answers: answers.length, correct_count: correct.length, winners: correct.map(a => a.participants?.nickname) }};
}
export const getQuizLeaderboard = async () => {
    const eventId = await getEventId();
    const { data } = await supabase.from('participants').select('nickname, score').eq('event_id', eventId).order('score', {ascending:false}).limit(20);
    return { data };
}
export const getLeaderboard = getQuizLeaderboard;
export const getAdminLeaderboard = getQuizLeaderboard;

// DISPLAY FETCH
export const getDisplayData = async (pubCode) => {
  const { data: event } = await supabase.from('events').select('id, name').eq('code', pubCode.toUpperCase()).single();
  const [perf, queue, lb] = await Promise.all([
      supabase.from('performances').select('*, participants(nickname)').eq('event_id', event.id).in('status', ['live','voting','paused']).maybeSingle(),
      supabase.from('song_requests').select('*, participants(nickname)').eq('event_id', event.id).eq('status', 'queued').limit(10),
      supabase.from('participants').select('nickname, score').eq('event_id', event.id).order('score', {ascending:false}).limit(5)
  ]);
  return {
      data: {
          pub: event,
          current_performance: perf.data ? {...perf.data, user_nickname: perf.data.participants?.nickname} : null,
          queue: queue.data?.map(q => ({...q, user_nickname: q.participants?.nickname})) || [],
          leaderboard: lb.data || []
      }
  };
}

export const getLibraryQuizzes = async () => { const { data } = await supabase.from('quiz_library').select('*'); return { data }; }
export const importQuizBatch = async (data) => { await supabase.from('quiz_library').insert(data); }
export const launchQuizFromLibrary = async (id) => {
    const t = (await supabase.from('quiz_library').select('*').eq('id', id).single()).data;
    return startQuiz(t);
}

export default {
    createPub, joinPub, adminLogin, getMe,
    requestSong, sendMessage, sendReaction,
    getAdminQueue, getAdminCurrentPerformance, getAdminPendingMessages,
    startPerformance, pausePerformance, resumePerformance, restartPerformance, endPerformance, closeVoting, skipPerformance,
    togglePerformanceMute, togglePerformanceBlur,
    approveRequest, rejectRequest, approveMessage, rejectMessage,
    startQuiz, activeQuiz: getActiveQuiz, getActiveQuiz, answerQuiz, closeQuizVoting, showQuizResults, endQuiz, getQuizResults,
    getDisplayData, getQuizLeaderboard, getLeaderboard, getAdminLeaderboard,
    getLibraryQuizzes, importQuizBatch, launchQuizFromLibrary
};