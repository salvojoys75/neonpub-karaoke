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

export const sendReaction = async (data) => {
  const participant = getParticipantFromToken()
  const { data: reaction, error } = await supabase.from('reactions').insert({
      event_id: participant.event_id, participant_id: participant.participant_id, emoji: data.emoji, nickname: participant.nickname 
    }).select().single()
  if (error) throw error
  return { data: reaction }
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

  const eventData = {
    owner_id: user.user.id,
    name: data.name,
    code: code,
    event_type: 'mixed',
    status: 'active',
    active_module: 'karaoke',
    expires_at: expiresAt.toISOString()
  };

  if (data.venue_id) {
    eventData.venue_id = data.venue_id;
  }

  const { data: event, error } = await supabase
    .from('events')
    .insert(eventData)
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
  return data || [];
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

  const { data: existingParticipant } = await supabase.from('participants').select('*').eq('event_id', event.id).eq('nickname', nickname).maybeSingle();
  let participant;
  
  if (existingParticipant) {
    const updateData = { last_activity: new Date().toISOString() };
    if (avatar_url) updateData.avatar_url = avatar_url;
    const { data: updated, error: updateError } = await supabase.from('participants').update(updateData).eq('id', existingParticipant.id).select().single();
    if (updateError) throw updateError;
    participant = updated;
  } else {
    const { data: newParticipant, error } = await supabase.from('participants').insert({ event_id: event.id, nickname: nickname, avatar_url: avatar_url || null }).select().single();
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

export const updateProfileCredits = async (id, credits) => {
    const val = parseInt(credits, 10);
    if (isNaN(val)) throw new Error("Invalid credit amount");
    const { error } = await supabase.from('profiles').update({ credits: val }).eq('id', id);
    if (error) throw error;
    return { data: 'ok' };
}

export const toggleUserStatus = async (id, isActive) => {
    const { error } = await supabase.from('profiles').update({ is_active: isActive }).eq('id', id);
    if (error) throw error;
    return { data: 'ok' };
}

export const createOperatorProfile = async (email, name, password, initialCredits) => {
    const { data: { session } } = await supabase.auth.getSession();
    const { data, error } = await supabase.functions.invoke('create-user', {
        body: { email, password, name, credits: initialCredits },
        headers: { Authorization: `Bearer ${session?.access_token}` }
    });
    if (error) throw new Error(error.message || 'Errore creazione operatore');
    if (!data || data.error) throw new Error(data?.error || 'Errore nella risposta della funzione');
    return data;
}

export const getEventState = async () => {
  const pubCode = localStorage.getItem('discojoys_pub_code');
  if (!pubCode) return null;
  const { data } = await supabase.from('events').select('active_module, active_module_id').eq('code', pubCode.toUpperCase()).maybeSingle();
  return data;
};

export const setEventModule = async (moduleId, specificContentId = null) => {
  const pubCode = localStorage.getItem('discojoys_pub_code');
  const { data: event, error } = await supabase.from('events').update({ active_module: moduleId, active_module_id: specificContentId }).eq('code', pubCode.toUpperCase()).select().single();
  if (error) throw error;
  
  if (moduleId === 'quiz' && specificContentId) {
    const { data: catalogItem } = await supabase.from('quiz_catalog').select('*').eq('id', specificContentId).single();
    if (catalogItem) {
        await supabase.from('quizzes').update({ status: 'ended' }).eq('event_id', event.id).neq('status', 'ended');
        await supabase.from('quizzes').insert({
          event_id: event.id, category: catalogItem.category, question: catalogItem.question, options: catalogItem.options, correct_index: catalogItem.correct_index, points: catalogItem.points, status: 'active', media_url: catalogItem.media_url || null, media_type: catalogItem.media_type || 'text'
        });
    }
  }
};

export const getQuizCatalog = async (venueId = null, daysThreshold = 30) => {
  const pubCode = localStorage.getItem('discojoys_pub_code');
  if (!pubCode) return { data: [] };

  const { data: event } = await supabase.from('events').select('id').eq('code', pubCode.toUpperCase()).single();
  if (!event) return { data: [] };

  const { data: eventQuestions } = await supabase.from('event_quiz_catalog').select('quiz_catalog_id').eq('event_id', event.id);
  if (!eventQuestions || eventQuestions.length === 0) return { data: [] };

  const questionIds = eventQuestions.map(eq => eq.quiz_catalog_id);
  let { data: catalog } = await supabase.from('quiz_catalog').select('*').in('id', questionIds).eq('is_active', true).order('category');

  try {
      const { data: usedQuizzes } = await supabase.from('quizzes').select('quiz_catalog_id').eq('event_id', event.id).not('quiz_catalog_id', 'is', null);
      if (usedQuizzes && usedQuizzes.length > 0) {
          const usedQuizIds = new Set(usedQuizzes.map(q => q.quiz_catalog_id));
          catalog = catalog.filter(item => !usedQuizIds.has(item.id));
      }
  } catch (e) { console.warn("Impossibile filtrare domande usate:", e); }

  if (venueId) {
    try {
      const thresholdDate = new Date();
      thresholdDate.setDate(thresholdDate.getDate() - daysThreshold);
      const { data: usedQuestions } = await supabase.from('quiz_usage_history').select('question_id, used_at').eq('venue_id', venueId).gte('used_at', thresholdDate.toISOString());
      const usedQuestionIds = new Set(usedQuestions?.map(q => q.question_id) || []);
      return { 
        data: catalog.map(q => ({ ...q, recently_used: usedQuestionIds.has(q.id), last_used: usedQuestions?.find(uq => uq.question_id === q.id)?.used_at || null }))
      };
    } catch (e) { console.warn("Impossibile filtrare per venue:", e); }
  }

  return { data: catalog || [] };
};

export const deleteQuizQuestion = async (catalogId) => {
    const { error } = await supabase.from('quiz_catalog').delete().eq('id', catalogId);
    if (error) throw error;
    return { data: 'ok' };
}

export const getChallengeCatalog = async () => {
  const { data } = await supabase.from('challenge_catalog').select('*');
  return { data: data || [] };
};

export const importQuizCatalog = async (jsonString) => {
    try {
        let items;
        try { items = JSON.parse(jsonString); } catch (e) { throw new Error("JSON non valido."); }
        if (!Array.isArray(items)) items = [items];
        
        const { data: existingQuestions } = await supabase.from('quiz_catalog').select('question');
        const existingSet = new Set(existingQuestions?.map(q => q.question) || []);
        
        const newItems = items.filter(item => item.question && item.options && !existingSet.has(item.question)).map(item => ({
                 category: item.category || 'Generale', question: item.question, options: item.options, correct_index: item.correct_index ?? 0, points: item.points || 10, media_url: item.media_url || null, media_type: item.media_type || 'text', is_active: true
             }));

        if (newItems.length === 0) return { success: true, count: 0, message: "Nessuna nuova domanda." };

        const { error } = await supabase.from('quiz_catalog').insert(newItems);
        if(error) throw error;
        return { success: true, count: newItems.length };
    } catch (e) { throw new Error("Errore Importazione: " + e.message); }
}

export const getQuizModules = async () => {
    const { data } = await supabase.from('quiz_library').select('*').order('category', { ascending: true }).order('genre', { ascending: true });
    return { data: data || [] };
}

export const loadQuizModule = async (moduleId) => {
    const pubCode = localStorage.getItem('discojoys_pub_code');
    if (!pubCode) throw new Error("Nessun evento selezionato");

    const { data: event } = await supabase.from('events').select('id').eq('code', pubCode.toUpperCase()).single();
    if (!event) throw new Error("Evento non trovato");

    const { data: module } = await supabase.from('quiz_library').select('*').eq('id', moduleId).single();
    if (!module) throw new Error("Modulo non trovato");
    
    const questions = module.questions || [];
    if (questions.length === 0) throw new Error("Modulo vuoto");
    
    const { data: existing } = await supabase.from('quiz_catalog').select('id, question');
    const existingQuestionMap = new Map(existing?.map(q => [q.question, q.id]) || []);
    
    const newQuestions = [];
    const existingQuestionIds = [];
    
    for (const q of questions) {
        if (existingQuestionMap.has(q.question)) {
            existingQuestionIds.push(existingQuestionMap.get(q.question));
        } else {
            newQuestions.push({
                category: q.category || module.category, question: q.question, options: q.options, correct_index: q.correct_index ?? 0, points: q.points || 10, media_url: q.media_url || null, media_type: q.media_type || 'text', is_active: true
            });
        }
    }
    
    let insertedIds = [];
    if (newQuestions.length > 0) {
        const { data: inserted, error } = await supabase.from('quiz_catalog').insert(newQuestions).select('id');
        if (error) throw error;
        insertedIds = inserted.map(q => q.id);
    }
    
    const allQuestionIds = [...insertedIds, ...existingQuestionIds];
    
    const { data: alreadyLinked } = await supabase.from('event_quiz_catalog').select('quiz_catalog_id').eq('event_id', event.id).in('quiz_catalog_id', allQuestionIds);
    const alreadyLinkedIds = new Set(alreadyLinked?.map(l => l.quiz_catalog_id) || []);
    const toLink = allQuestionIds.filter(id => !alreadyLinkedIds.has(id));
    
    if (toLink.length > 0) {
        const links = toLink.map(qid => ({ event_id: event.id, quiz_catalog_id: qid }));
        const { error: linkError } = await supabase.from('event_quiz_catalog').upsert(links, { onConflict: 'event_id,quiz_catalog_id', ignoreDuplicates: true });
        if (linkError) throw linkError;
    }
    
    return { success: true, count: toLink.length, skipped: allQuestionIds.length - toLink.length, module: module.name };
}

export const requestSong = async (data) => {
  const participant = getParticipantFromToken()
  const { data: request, error } = await supabase.from('song_requests').insert({
      event_id: participant.event_id, participant_id: participant.participant_id, title: data.title, artist: data.artist, youtube_url: data.youtube_url, status: 'pending'
    }).select().single()
  if (error) throw error
  return { data: request }
}

export const getSongQueue = async () => {
  const participant = getParticipantFromToken()
  const { data, error } = await supabase.from('song_requests').select('*, participants (nickname)').eq('event_id', participant.event_id).eq('status', 'queued').order('position', { ascending: true })
  if (error) throw error
  return { data: (data || []).map(req => ({...req, user_nickname: req.participants?.nickname || 'Unknown'})) }
}

export const getMyRequests = async () => {
  const participant = getParticipantFromToken()
  const { data } = await supabase.from('song_requests').select('*').eq('participant_id', participant.participant_id).order('requested_at', { ascending: false })
  return { data }
}

export const getAdminQueue = async () => {
  const event = await getAdminEvent()
  const { data } = await supabase.from('song_requests').select('*, participants (nickname)').eq('event_id', event.id).in('status', ['pending', 'queued']).order('requested_at', { ascending: false })
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

export const deleteRequest = async (requestId) => {
    const { error } = await supabase.from('song_requests').update({ status: 'rejected' }).eq('id', requestId);
    if (error) throw error;
    return { data: { id: requestId } };
}

export const startPerformance = async (requestId, youtubeUrl) => {
  const { data: request } = await supabase.from('song_requests').select('*, participants(nickname)').eq('id', requestId).single()
  await supabase.from('performances').update({ status: 'ended' }).eq('event_id', request.event_id).neq('status', 'ended');
  await supabase.from('quizzes').update({ status: 'ended' }).eq('event_id', request.event_id).neq('status', 'ended');

  const { data: performance, error } = await supabase.from('performances').insert({
      event_id: request.event_id, song_request_id: request.id, participant_id: request.participant_id, song_title: request.title, song_artist: request.artist, youtube_url: youtubeUrl || request.youtube_url, status: 'live', average_score: 0 
    }).select().single()
  if (error) throw error
  await supabase.from('song_requests').update({ status: 'performing' }).eq('id', requestId)
  await supabase.from('events').update({ active_module: 'karaoke' }).eq('id', request.event_id);
  return { data: performance }
}

export const endPerformance = async (performanceId) => {
  const { data, error } = await supabase.from('performances').update({ status: 'voting', ended_at: new Date().toISOString() }).eq('id', performanceId).select().single();
  if (error) throw error; 
  return { data }
}

export const closeVoting = async (performanceId) => {
  const { data: perf } = await supabase.from('performances').select('*, participants(score)').eq('id', performanceId).single();
  if (!perf) throw new Error("Performance not found");
  const { data, error } = await supabase.from('performances').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('id', performanceId).select();
  if (error) throw error;
  if (perf.song_request_id) {
      await supabase.from('song_requests').update({ status: 'ended' }).eq('id', perf.song_request_id);
  }
  if (perf.participant_id && perf.average_score > 0) {
      const currentScore = perf.participants?.score || 0;
      const newScore = currentScore + perf.average_score;
      await supabase.from('participants').update({ score: newScore }).eq('id', perf.participant_id);
  }
  return { data }
}

export const stopAndNext = async (performanceId) => {
    const { data: perf } = await supabase.from('performances').select('song_request_id').eq('id', performanceId).single();
    if (perf?.song_request_id) {
        await supabase.from('song_requests').update({ status: 'ended' }).eq('id', perf.song_request_id);
    }
    const { data, error } = await supabase.from('performances').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('id', performanceId).select()
    if (error) throw error; 
    return { data };
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
  const { data, error } = await supabase.from('performances').update({ status: 'live', started_at: new Date().toISOString() }).eq('id', performanceId).select();
  if (error) throw error;
  return { data };
}

export const toggleMute = async (isMuted) => {
    const channel = supabase.channel('tv_ctrl');
    await channel.send({ type: 'broadcast', event: 'control', payload: { command: 'mute', value: isMuted } });
}

export const getCurrentPerformance = async () => {
  const participant = getParticipantFromToken()
  const { data } = await supabase.from('performances').select('*, participants (nickname)').eq('event_id', participant.event_id).in('status', ['live', 'voting', 'paused']).order('started_at', { ascending: false }).limit(1).maybeSingle()
  return { data: data ? { ...data, user_nickname: data.participants?.nickname || 'Unknown' } : null }
}

export const getAdminCurrentPerformance = async () => {
  const event = await getAdminEvent()
  const { data } = await supabase.from('performances').select('*, participants (nickname)').eq('event_id', event.id).in('status', ['live', 'voting', 'paused']).order('started_at', { ascending: false }).limit(1).maybeSingle()
  return { data: data ? { ...data, user_nickname: data.participants?.nickname || 'Unknown' } : null }
}

export const submitVote = async (data) => {
  const participant = getParticipantFromToken();
  const { data: vote, error } = await supabase.from('votes').insert({
      performance_id: data.performance_id, participant_id: participant.participant_id, score: data.score
    }).select().single();
  if (error) { if (error.code === '23505') throw new Error('Hai già votato'); throw error; }
  const { data: allVotes } = await supabase.from('votes').select('score').eq('performance_id', data.performance_id);
  if (allVotes && allVotes.length > 0) {
      const total = allVotes.reduce((acc, v) => acc + v.score, 0);
      const avg = total / allVotes.length;
      await supabase.from('performances').update({ average_score: avg }).eq('id', data.performance_id);
  }
  return { data: vote };
}

export const sendMessage = async (data) => {
  const userToken = localStorage.getItem('discojoys_token');
  if (userToken) {
    try {
      const participant = getParticipantFromToken();
      const text = typeof data === 'string' ? data : (data.text || data.message);
      const { data: message, error } = await supabase.from('messages').insert({ event_id: participant.event_id, participant_id: participant.participant_id, text: text, status: 'pending' }).select().single();
      if (error) throw error;
      return { data: message };
    } catch (e) { console.error(e); }
  }
  const pubCode = localStorage.getItem('discojoys_pub_code');
  if (pubCode) {
      const { data: event } = await supabase.from('events').select('id').eq('code', pubCode.toUpperCase()).single();
      if (event) {
           const text = typeof data === 'string' ? data : (data.text || data.message);
           const { data: message, error } = await supabase.from('messages').insert({ event_id: event.id, participant_id: null, text: text, status: 'approved' }).select().single();
           if (error) throw error;
           return { data: message };
      }
  }
  throw new Error("Errore invio messaggio: autenticazione non valida.");
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
    event_id: event.id, category: data.category, question: data.question, options: data.options, correct_index: data.correct_index, points: data.points, status: 'active', started_at: new Date().toISOString(), media_url: data.media_url || null, media_type: data.media_type || 'text', quiz_catalog_id: data.quiz_catalog_id || null
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

export const answerQuiz = async (data) => {
  const participant = getParticipantFromToken()
  const { data: quiz, error: quizError } = await supabase.from('quizzes').select('correct_index, points, started_at').eq('id', data.quiz_id).single();
  if (quizError) throw quizError;
  const isCorrect = quiz.correct_index === data.answer_index;
  let pointsEarned = 0;
  if (isCorrect) {
    const basePoints = quiz.points || 10;
    let timeBonus = 0;
    if (quiz.started_at) {
      const elapsedMs = Date.now() - new Date(quiz.started_at).getTime();
      const elapsedSec = Math.max(0, elapsedMs / 1000);
      if (elapsedSec < 30) timeBonus = Math.round(basePoints * (1 - elapsedSec / 30));
    }
    pointsEarned = (quiz.points || 10) + timeBonus;
  }
  const { data: ans, error } = await supabase.from('quiz_answers').insert({ quiz_id: data.quiz_id, participant_id: participant.participant_id, answer_index: data.answer_index, is_correct: isCorrect }).select().single()
  if (error) { if (error.code==='23505') throw new Error('Già risposto'); throw error; }
  if (isCorrect) {
      const { data: p } = await supabase.from('participants').select('score').eq('id', participant.participant_id).single();
      if (p) { await supabase.from('participants').update({ score: (p.score || 0) + pointsEarned }).eq('id', participant.participant_id); }
  }
  return { data: { ...ans, points_earned: pointsEarned } }
}

export const getLeaderboard = async () => {
  const participant = getParticipantFromToken()
  const { data, error } = await supabase.from('participants').select('id, nickname, score').eq('event_id', participant.event_id).order('score', {ascending:false}).limit(20)
  if (error) throw error; return { data }
}

export const sendAdminMessage = async (text) => {
  const event = await getAdminEvent();
  const { data: message, error } = await supabase.from('messages').insert({ event_id: event.id, participant_id: null, text: typeof text === 'string' ? text : text.text, status: 'approved' }).select().single();
  if (error) throw error;
  return { data: message };
}

export const importCustomQuiz = async (questions) => {
  const event = await getAdminEvent();
  let count = 0;
  for (const q of questions) {
    const payload = { category: 'Personalizzata', question: q.question, options: q.options, correct_index: q.correct_index, points: q.points || 10, media_url: q.media_url || null, media_type: q.media_type || 'text', is_active: true, is_custom: true, event_id: event.id };
    const { data: inserted, error } = await supabase.from('quiz_catalog').insert(payload).select().single();
    if (!error) {
        await supabase.from('event_quiz_catalog').upsert({ event_id: event.id, quiz_catalog_id: inserted.id }, { onConflict: 'event_id,quiz_catalog_id', ignoreDuplicates: true });
        count++;
    }
  }
  return { count };
}

export const deleteAdminMessage = async (id) => {
  const event = await getAdminEvent();
  const { error } = await supabase.from('messages').delete().eq('id', id).eq('event_id', event.id).is('participant_id', null);
  if (error) throw error;
  return { data: 'ok' };
}

export const deleteApprovedMessage = async (id) => {
  const event = await getAdminEvent();
  const { error } = await supabase.from('messages').delete().eq('id', id).eq('event_id', event.id);
  if (error) throw error;
  return { data: 'ok' };
}

export const getAdminLeaderboard = async () => {
  const event = await getAdminEvent()
  const { data, error } = await supabase.from('participants').select('id, nickname, score').eq('event_id', event.id).order('score', {ascending:false}).limit(20)
  if (error) throw error; return { data }
}

export const getMyVenues = async () => {
  const { data: user } = await supabase.auth.getUser()
  if (!user?.user) throw new Error('Not authenticated')
  const { data, error } = await supabase.from('venues').select('*').eq('operator_id', user.user.id).order('name')
  if (error) throw error
  return { data }
}

export const createVenue = async (venueData) => {
  const { data: user } = await supabase.auth.getUser()
  if (!user?.user) throw new Error('Not authenticated')
  const { data, error } = await supabase.from('venues').insert({ operator_id: user.user.id, name: venueData.name, city: venueData.city || null, address: venueData.address || null }).select().single()
  if (error) throw error
  return { data }
}

export const updateVenue = async (venueId, venueData) => {
  const { data, error } = await supabase.from('venues').update({ name: venueData.name, city: venueData.city, address: venueData.address }).eq('id', venueId).select().single()
  if (error) throw error
  return { data }
}

export const deleteVenue = async (venueId) => {
  const { error } = await supabase.from('venues').delete().eq('id', venueId)
  if (error) throw error
  return { data: 'ok' }
}

export const trackQuizUsage = async (questionId, venueId) => {
  try {
    const pubCode = localStorage.getItem('discojoys_pub_code');
    if (!pubCode) return { data: 'no_pubcode' };
    const { data: event } = await supabase.from('events').select('id, owner_id').eq('code', pubCode.toUpperCase()).single();
    if (!event) return { data: 'no_event' };
    const insertData = { question_id: questionId, operator_id: event.owner_id, event_id: event.id };
    if (venueId) insertData.venue_id = venueId;
    const { data, error } = await supabase.from('quiz_usage_history').insert(insertData).select().single();
    if (error && error.code === '23505') return { data: 'already_tracked' };
    return { data };
  } catch (e) { return { data: 'error', error: e.message }; }
}

export const resetQuizUsageForVenue = async (venueId) => {
  try {
    const { data: user } = await supabase.auth.getUser()
    if (!user?.user) throw new Error('Not authenticated');
    const { error, count } = await supabase.from('quiz_usage_history').delete().eq('venue_id', venueId).eq('operator_id', user.user.id)
    if (error) throw error;
    return { data: { deleted_count: count || 0 } }
  } catch (e) { throw e }
}

export const getRandomSongPool = async () => {
  const { data: user } = await supabase.auth.getUser()
  if (!user?.user) throw new Error('Not authenticated')
  const { data, error } = await supabase.from('random_song_pool').select('*').eq('operator_id', user.user.id).eq('is_active', true).order('artist', { ascending: true })
  if (error) throw error
  return { data }
}

export const addSongToPool = async (songData) => {
  const { data: user } = await supabase.auth.getUser()
  if (!user?.user) throw new Error('Not authenticated')
  const { data, error } = await supabase.from('random_song_pool').insert({ operator_id: user.user.id, title: songData.title, artist: songData.artist, youtube_url: songData.youtube_url, genre: songData.genre || null, decade: songData.decade || null, difficulty: songData.difficulty || null }).select().single()
  if (error) throw error
  return { data }
}

export const updateSongInPool = async (songId, songData) => {
  const { data, error } = await supabase.from('random_song_pool').update({ title: songData.title, artist: songData.artist, youtube_url: songData.youtube_url, genre: songData.genre, decade: songData.decade, difficulty: songData.difficulty }).eq('id', songId).select().single()
  if (error) throw error
  return { data }
}

export const deleteSongFromPool = async (songId) => {
  const { error } = await supabase.from('random_song_pool').update({ is_active: false }).eq('id', songId)
  if (error) throw error
  return { data: 'ok' }
}

export const importSongsToPool = async (songsArray) => {
  const { data: user } = await supabase.auth.getUser()
  if (!user?.user) throw new Error('Not authenticated')
  const songsToInsert = songsArray.map(song => ({ operator_id: user.user.id, title: song.title, artist: song.artist, youtube_url: song.youtube_url, genre: song.genre || null, decade: song.decade || null, difficulty: song.difficulty || null }))
  const { data, error } = await supabase.from('random_song_pool').insert(songsToInsert).select()
  if (error) throw error
  return { data, count: data.length }
}

export const extractRandomKaraoke = async (options = {}) => {
  try {
    const event = await getAdminEvent()
    let participant = null
    if (options.forcedParticipantId) {
      const { data } = await supabase.from('participants').select('*').eq('id', options.forcedParticipantId).single()
      participant = data
    } else {
      const { data: participants } = await supabase.from('participants').select('*').eq('event_id', event.id).order('last_activity', { ascending: false }).limit(50)
      if (!participants || participants.length === 0) throw new Error('Nessun partecipante disponibile')
      participant = participants[Math.floor(Math.random() * participants.length)]
    }
    let song = null
    if (options.forcedSongId) {
      const { data } = await supabase.from('random_song_pool').select('*').eq('id', options.forcedSongId).single()
      song = data
    } else {
      const { data: user } = await supabase.auth.getUser()
      const { data: songs } = await supabase.from('random_song_pool').select('*').eq('operator_id', user.user.id).eq('is_active', true)
      if (!songs || songs.length === 0) throw new Error('Nessuna canzone nel pool.')
      song = songs[Math.floor(Math.random() * songs.length)]
    }
    const { data: request, error: reqError } = await supabase.from('song_requests').insert({ event_id: event.id, participant_id: participant.id, title: song.title, artist: song.artist, status: 'queued' }).select('*, participants(nickname, avatar_url)').single()
    if (reqError) throw reqError
    const extractionData = { participant: { id: participant.id, nickname: participant.nickname, avatar_url: participant.avatar_url }, song: { id: song.id, title: song.title, artist: song.artist }, timestamp: new Date().toISOString() }
    await supabase.from('events').update({ extraction_data: extractionData }).eq('id', event.id)
    return { data: { participant: { id: participant.id, nickname: participant.nickname, avatar_url: participant.avatar_url }, song: { id: song.id, title: song.title, artist: song.artist, youtube_url: song.youtube_url }, request: request } }
  } catch (error) { throw error }
}

export const createArcadeGame = async ({
    gameType = 'song_guess',
    trackId,
    trackTitle,
    trackArtist,
    trackUrl,
    correctAnswer,
    pointsReward = 100,
    maxAttempts = 3,
    penaltySeconds = 10,
    mediaType = 'spotify',
    category = 'Generale',
    question = 'Indovina la canzone!',
    options = []
  }) => {
    try {
      const event = await getAdminEvent();
      await supabase.from('arcade_games').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('event_id', event.id).in('status', ['setup', 'waiting', 'active', 'paused']);
      const { data, error } = await supabase.from('arcade_games').insert({
          event_id: event.id, game_type: gameType, status: 'setup', track_id: trackId, track_title: trackTitle, track_artist: trackArtist, track_url: trackUrl, correct_answer: correctAnswer, points_reward: pointsReward, max_attempts: maxAttempts, penalty_seconds: penaltySeconds, media_type: mediaType, category: category, question: question, options: options
        }).select().single();
      if (error) throw error;
      return { data };
    } catch (error) { console.error('❌ Errore creazione gioco arcade:', error); throw error; }
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
export const validateArcadeAnswer = async (bookingId, isCorrect, givenAnswer = null) => {
    try {
      const { data: booking, error: bookingError } = await supabase.from('arcade_bookings').select('*, arcade_games(*)').eq('id', bookingId).single();
      if (bookingError) throw bookingError;
      const game = booking.arcade_games;
      let pointsAwarded = isCorrect ? game.points_reward : 0;
      const { data: updatedBooking, error: updateError } = await supabase.from('arcade_bookings').update({ status: isCorrect ? 'correct' : 'wrong', validated_at: new Date().toISOString(), points_awarded: pointsAwarded, given_answer: givenAnswer }).eq('id', bookingId).select().single();
      if (updateError) throw updateError;
      if (isCorrect) {
        await supabase.from('participants').update({ score: (await supabase.from('participants').select('score').eq('id', booking.participant_id).single()).data.score + pointsAwarded }).eq('id', booking.participant_id);
        await supabase.from('arcade_games').update({ status: 'ended', winner_id: booking.participant_id, ended_at: new Date().toISOString() }).eq('id', game.id);
      }
      return { data: updatedBooking, isCorrect };
    } catch (error) { throw error; }
  }
export const getArcadeBookings = async (gameId) => { try { const { data, error } = await supabase.from('arcade_bookings').select(`*, participants:participant_id (id, nickname, avatar_url, score)`).eq('game_id', gameId).order('booking_order', { ascending: true }); if (error) throw error; return { data: data || [] }; } catch (error) { throw error; } }
export const getCurrentBooking = async (gameId) => { try { const { data, error } = await supabase.from('arcade_bookings').select(`*, participants:participant_id (id, nickname, avatar_url)`).eq('game_id', gameId).eq('status', 'pending').order('booking_order', { ascending: true }).limit(1); if (error) throw error; return { data: data?.[0] || null }; } catch (error) { return { data: null }; } }
export const getArcadeLeaderboard = async () => { return { data: [] } }
export const cancelArcadeBooking = async (bookingId) => { try { const { data, error } = await supabase.from('arcade_bookings').update({ status: 'cancelled' }).eq('id', bookingId).select().single(); if (error) throw error; return { data }; } catch (error) { throw error; } }

export default {
    getDisplayData, sendReaction, getActiveArcadeGame, createPub, createArcadeGame, startArcadeGame, pauseArcadeGame, resumeArcadeGame, endArcadeGame, bookArcadeAnswer, validateArcadeAnswer, getArcadeBookings, getCurrentBooking, getArcadeLeaderboard, cancelArcadeBooking,
    getQuizResults, clearExtraction, getActiveQuiz, getAdminQueue, getAdminCurrentPerformance, getAdminPendingMessages, getSongCatalog, getSongCatalogMoods, getSongCatalogGenres, getChallengeCatalog, getEventState, getMyVenues, getActiveEventsForUser, getAllProfiles, getPub, uploadAvatar, joinPub, requestSong, getSongQueue, getMyRequests, approveRequest, rejectRequest, deleteRequest, startPerformance, endPerformance, closeVoting, stopAndNext, pausePerformance, resumePerformance, restartPerformance, toggleMute, getCurrentPerformance, submitVote, sendMessage, approveMessage, rejectMessage, startQuiz, closeQuizVoting, showQuizResults, showQuizLeaderboard, endQuiz, answerQuiz, getLeaderboard, sendAdminMessage, importCustomQuiz, deleteAdminMessage, deleteApprovedMessage, getAdminLeaderboard, createVenue, updateVenue, deleteVenue, trackQuizUsage, resetQuizUsageForVenue, getRandomSongPool, addSongToPool, updateSongInPool, deleteSongFromPool, importSongsToPool, extractRandomKaraoke, uploadLogo, updateEventSettings, adminLogin, getMe, updateProfileCredits, toggleUserStatus, createOperatorProfile, getQuizCatalog, deleteQuizQuestion, importQuizCatalog, getQuizModules, loadQuizModule
}