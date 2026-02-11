import { supabase } from './supabase'

// HELPER: Estrae dati dal token locale
function getParticipantFromToken() {
  const token = localStorage.getItem('neonpub_token')
  if (!token) throw new Error('Not authenticated')
  try { return JSON.parse(atob(token)) } catch { throw new Error('Invalid token') }
}

async function getAdminEvent() {
  const pubCode = localStorage.getItem('neonpub_pub_code')
  if (!pubCode) throw new Error('No event selected')
  const { data, error } = await supabase.from('events').select('*').eq('code', pubCode.toUpperCase()).single()
  if (error) throw error
  if (data.status === 'ended' || (data.expires_at && new Date(data.expires_at) < new Date())) {
      throw new Error("Evento scaduto");
  }
  return data
}

// --- AUTH & EVENTS ---
export const createPub = async (data) => {
  const { data: user } = await supabase.auth.getUser()
  if (!user?.user) throw new Error('Not authenticated')
  const { data: profile } = await supabase.from('profiles').select('credits, is_active').eq('id', user.user.id).single();
  if (!profile || !profile.is_active) throw new Error("Utente disabilitato");
  if (profile.credits < 1) throw new Error("Crediti insufficienti");
  await supabase.from('profiles').update({ credits: profile.credits - 1 }).eq('id', user.user.id);
  const code = Math.random().toString(36).substring(2, 8).toUpperCase()
  const expiresAt = new Date(); expiresAt.setHours(expiresAt.getHours() + 8);
  const { data: event, error } = await supabase.from('events').insert({
      owner_id: user.user.id, name: data.name, code: code, event_type: 'mixed', status: 'active',
      active_module: 'karaoke', expires_at: expiresAt.toISOString()
    }).select().single()
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
  const fileName = `${Date.now()}_logo.${file.name.split('.').pop()}`;
  const { error } = await supabase.storage.from('logos').upload(fileName, file);
  if (error) throw error;
  const { data } = supabase.storage.from('logos').getPublicUrl(fileName);
  return data.publicUrl;
}

export const updateEventSettings = async (data) => {
  const event = await getAdminEvent();
  await supabase.from('events').update({ name: data.name, logo_url: data.logo_url }).eq('id', event.id);
  return { data: 'ok' };
}

export const getPub = async (pubCode) => {
  if (!pubCode) return { data: null };
  const { data } = await supabase.from('events').select('*').eq('code', pubCode.toUpperCase()).single();
  if (!data || data.status === 'ended' || (data.expires_at && new Date(data.expires_at) < new Date())) return { data: null };
  return { data }
}

export const joinPub = async ({ pub_code, nickname }) => {
  const { data: event } = await supabase.from('events').select('id, name, status, expires_at').eq('code', pub_code.toUpperCase()).single()
  if (!event || event.status !== 'active' || (event.expires_at && new Date(event.expires_at) < new Date())) throw new Error("Evento non disponibile");
  const { data: participant, error } = await supabase.from('participants').insert({ event_id: event.id, nickname: nickname }).select().single()
  if (error) throw new Error('Nickname già in uso');
  const token = btoa(JSON.stringify({ participant_id: participant.id, event_id: event.id, nickname: nickname, pub_name: event.name }))
  return { data: { token, user: { ...participant, pub_name: event.name } } }
}

// --- SUPER ADMIN ---
export const getAllProfiles = async () => { const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false }); return { data }; }
export const updateProfileCredits = async (id, credits) => { await supabase.from('profiles').update({ credits }).eq('id', id); return { data: 'ok' }; }
export const toggleUserStatus = async (id, isActive) => { await supabase.from('profiles').update({ is_active: isActive }).eq('id', id); return { data: 'ok' }; }

// --- REGIA & MODULI ---
export const getEventState = async () => {
  const pubCode = localStorage.getItem('neonpub_pub_code');
  const { data } = await supabase.from('events').select('active_module, active_module_id').eq('code', pubCode).maybeSingle();
  return data;
};

export const setEventModule = async (moduleId, specificContentId = null) => {
  const pubCode = localStorage.getItem('neonpub_pub_code');
  const { data: event } = await supabase.from('events').update({ active_module: moduleId, active_module_id: specificContentId }).eq('code', pubCode).select().single();
  if (moduleId === 'quiz' && specificContentId) {
    const { data: cat } = await supabase.from('quiz_catalog').select('*').eq('id', specificContentId).single();
    await supabase.from('quizzes').update({ status: 'ended' }).eq('event_id', event.id).neq('status', 'ended');
    await supabase.from('quizzes').insert({
      event_id: event.id, category: cat.category, question: cat.question, options: cat.options,
      correct_index: cat.correct_index, points: cat.points, status: 'active', media_url: cat.media_url, media_type: cat.media_type
    });
  }
};

export const getQuizCatalog = async () => { const { data } = await supabase.from('quiz_catalog').select('*').eq('is_active', true).order('category'); return { data: data || [] }; }
export const deleteQuizQuestion = async (id) => { await supabase.from('quiz_catalog').update({ is_active: false }).eq('id', id); return { data: 'ok' }; }
export const importQuizCatalog = async (json) => {
    const items = JSON.parse(json);
    const formatted = items.map(i => ({ ...i, is_active: true }));
    await supabase.from('quiz_catalog').insert(formatted);
    return { success: true, count: formatted.length };
}

// --- KARAOKE & PERFORMANCES ---
export const requestSong = async (d) => {
  const p = getParticipantFromToken();
  const { data } = await supabase.from('song_requests').insert({ event_id: p.event_id, participant_id: p.participant_id, title: d.title, artist: d.artist, youtube_url: d.youtube_url, status: 'pending' }).select().single();
  return { data };
}

export const getSongQueue = async () => {
  const p = getParticipantFromToken();
  const { data } = await supabase.from('song_requests').select('*, participants(nickname)').eq('event_id', p.event_id).eq('status', 'queued').order('position');
  return { data: data?.map(r => ({...r, user_nickname: r.participants?.nickname})) || [] };
}

export const getAdminQueue = async () => {
  const e = await getAdminEvent();
  const { data } = await supabase.from('song_requests').select('*, participants(nickname)').eq('event_id', e.id).in('status', ['pending', 'queued']).order('requested_at');
  return { data: data?.map(r => ({...r, user_nickname: r.participants?.nickname})) || [] };
}

export const approveRequest = async (id) => supabase.from('song_requests').update({ status: 'queued' }).eq('id', id);
export const rejectRequest = async (id) => supabase.from('song_requests').update({ status: 'rejected' }).eq('id', id);

export const startPerformance = async (reqId, ytUrl) => {
  const { data: req } = await supabase.from('song_requests').select('*').eq('id', reqId).single();
  await supabase.from('performances').update({ status: 'ended' }).eq('event_id', req.event_id).neq('status', 'ended');
  const { data: perf } = await supabase.from('performances').insert({
    event_id: req.event_id, song_request_id: req.id, participant_id: req.participant_id,
    song_title: req.title, song_artist: req.artist, youtube_url: ytUrl, status: 'live'
  }).select().single();
  await supabase.from('song_requests').update({ status: 'performing' }).eq('id', reqId);
  return { data: perf };
}

export const endPerformance = async (id) => supabase.from('performances').update({ status: 'voting', ended_at: new Date().toISOString() }).eq('id', id);
export const closeVoting = async (id) => {
  const { data: perf } = await supabase.from('performances').select('*').eq('id', id).single();
  await supabase.from('performances').update({ status: 'ended' }).eq('id', id);
  await supabase.from('song_requests').update({ status: 'ended' }).eq('id', perf.song_request_id);
  if (perf.participant_id && perf.average_score > 0) {
    const { data: p } = await supabase.from('participants').select('score').eq('id', perf.participant_id).single();
    await supabase.from('participants').update({ score: (p.score || 0) + perf.average_score }).eq('id', perf.participant_id);
  }
}

export const pausePerformance = async (id) => supabase.from('performances').update({ status: 'paused' }).eq('id', id);
export const resumePerformance = async (id) => supabase.from('performances').update({ status: 'live' }).eq('id', id);
export const toggleMute = async (val) => {
    const channel = supabase.channel('tv_ctrl');
    await channel.send({ type: 'broadcast', event: 'control', payload: { command: 'mute', value: val } });
}

// --- QUIZ LOGIC ---
export const startQuiz = async (d) => {
  const e = await getAdminEvent();
  await supabase.from('quizzes').update({ status: 'ended' }).eq('event_id', e.id).neq('status', 'ended');
  const { data } = await supabase.from('quizzes').insert({
    event_id: e.id, category: d.category, question: d.question, options: d.options,
    correct_index: d.correct_index, points: d.points, status: 'active', media_url: d.media_url, media_type: d.media_type
  }).select().single();
  return { data };
}

export const getQuizResults = async (quizId) => {
  const { data: quiz } = await supabase.from('quizzes').select('*').eq('id', quizId).single();
  // Recuperiamo risposte corrette includendo NICKNAME e AVATAR_URL dei partecipanti
  const { data: answers } = await supabase.from('quiz_answers')
    .select('*, participants(nickname, avatar_url)')
    .eq('quiz_id', quizId)
    .eq('is_correct', true)
    .order('created_at', { ascending: true });

  return {
    data: {
      quiz_id: quizId,
      correct_option: quiz.options[quiz.correct_index],
      winners: answers?.map(a => ({
        nickname: a.participants?.nickname || 'Anonimo',
        avatar: a.participants?.avatar_url,
        points: quiz.points
      })) || []
    }
  }
}

export const answerQuiz = async (d) => {
  const p = getParticipantFromToken();
  const { data: quiz } = await supabase.from('quizzes').select('*').eq('id', d.quiz_id).single();
  const isCorrect = quiz.correct_index === d.answer_index;
  const { data: ans } = await supabase.from('quiz_answers').insert({
    quiz_id: d.quiz_id, participant_id: p.participant_id, answer_index: d.answer_index, is_correct: isCorrect
  }).select().single();
  if (isCorrect) {
    const { data: part } = await supabase.from('participants').select('score').eq('id', p.participant_id).single();
    await supabase.from('participants').update({ score: (part.score || 0) + quiz.points }).eq('id', p.participant_id);
  }
  return { data: { ...ans, points_earned: isCorrect ? quiz.points : 0 } };
}

// --- MESSAGGI & REAZIONI ---
export const sendMessage = async (d) => {
  let eId = null; let pId = null; let stat = d.status || 'pending';
  try { const p = getParticipantFromToken(); eId = p.event_id; pId = p.participant_id; }
  catch { const c = localStorage.getItem('neonpub_pub_code'); const { data } = await supabase.from('events').select('id').eq('code', c).single(); eId = data.id; stat = 'approved'; }
  return supabase.from('messages').insert({ event_id: eId, participant_id: pId, text: d.text, status: stat });
}

export const approveMessage = async (id) => supabase.from('messages').update({ status: 'approved' }).eq('id', id);
export const rejectMessage = async (id) => supabase.from('messages').update({ status: 'rejected' }).eq('id', id);

export const sendReaction = async (d) => {
  const p = getParticipantFromToken();
  return supabase.from('reactions').insert({ event_id: p.event_id, participant_id: p.participant_id, emoji: d.emoji, nickname: p.nickname });
}

// --- DISPLAY DATA ---
export const getDisplayData = async (code) => {
  const { data: event } = await supabase.from('events').select('*').eq('code', code.toUpperCase()).single();
  if (!event) return { data: null };
  const [perf, queue, lb, quiz, msgs] = await Promise.all([
    supabase.from('performances').select('*, participants(nickname, avatar_url)').eq('event_id', event.id).in('status', ['live','voting','paused','ended']).order('started_at', {ascending: false}).limit(1).maybeSingle(),
    supabase.from('song_requests').select('*, participants(nickname, avatar_url)').eq('event_id', event.id).eq('status', 'queued').limit(10),
    supabase.from('participants').select('nickname, avatar_url, score').eq('event_id', event.id).order('score', {ascending:false}).limit(20),
    supabase.from('quizzes').select('*').eq('event_id', event.id).in('status', ['active', 'closed', 'showing_results', 'leaderboard']).maybeSingle(),
    supabase.from('messages').select('*, participants(nickname)').eq('event_id', event.id).eq('status', 'approved').order('created_at', {ascending: false}).limit(5)
  ]);
  return {
    data: {
      pub: event,
      current_performance: perf.data ? {...perf.data, user_nickname: perf.data.participants?.nickname, user_avatar: perf.data.participants?.avatar_url} : null,
      queue: queue.data?.map(q => ({...q, user_nickname: q.participants?.nickname, user_avatar: q.participants?.avatar_url})),
      leaderboard: lb.data?.map(l => ({...l, avatar: l.avatar_url})),
      active_quiz: quiz.data,
      approved_messages: msgs.data?.map(m => ({text: m.text, nickname: m.participants?.nickname || 'Regia'})) || []
    }
  }
}

export default {
  createPub, updateEventSettings, uploadLogo, getPub, joinPub,
  getAllProfiles, updateProfileCredits, toggleUserStatus,
  getEventState, setEventModule, getQuizCatalog, deleteQuizQuestion, importQuizCatalog,
  requestSong, getSongQueue, getAdminQueue, approveRequest, rejectRequest,
  startPerformance, pausePerformance, resumePerformance, endPerformance, closeVoting, toggleMute,
  startQuiz, answerQuiz, getQuizResults, sendMessage, approveMessage, rejectMessage, sendReaction,
  getDisplayData, getActiveEventsForUser
}