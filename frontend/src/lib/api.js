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
    try {
        const { data, error } = await supabase.functions.invoke('create-user', {
            body: { email, password, name, credits: initialCredits }
        });

        if (error) {
            console.warn("Edge function not found or error, falling back to profile stub. Please create user in Auth manually.");
            return { data: 'Simulation: User creation requested. Setup Backend logic.' };
        }
        return data;

    } catch (e) {
        return { data: 'Mock success' };
    }
}

export const getEventState = async () => {
  const pubCode = localStorage.getItem('neonpub_pub_code');
  if (!pubCode) return null;
  const { data } = await supabase.from('events').select('active_module, active_module_id').eq('code', pubCode.toUpperCase()).maybeSingle();
  return data;
};

export const setEventModule = async (moduleId, specificContentId = null) => {
  const pubCode = localStorage.getItem('neonpub_pub_code');
  const { data: event, error } = await supabase.from('events').update({ active_module: moduleId, active_module_id: specificContentId }).eq('code', pubCode.toUpperCase()).select().single();
  if (error) throw error;
  
  if (moduleId === 'quiz' && specificContentId) {
    const { data: catalogItem } = await supabase.from('quiz_catalog').select('*').eq('id', specificContentId).single();
    if (catalogItem) {
        await supabase.from('quizzes').update({ status: 'ended' }).eq('event_id', event.id).neq('status', 'ended');
        await supabase.from('quizzes').insert({
          event_id: event.id, 
          category: catalogItem.category, 
          question: catalogItem.question, 
          options: catalogItem.options, 
          correct_index: catalogItem.correct_index, 
          points: catalogItem.points, 
          status: 'active',
          media_url: catalogItem.media_url || null,
          media_type: catalogItem.media_type || 'text'
        });
    }
  }
};

export const getQuizCatalog = async () => {
  const { data: catalog, error } = await supabase
    .from('quiz_catalog')
    .select('*')
    .eq('is_active', true) 
    .order('category');

  if (error) throw error;

  try {
      const pubCode = localStorage.getItem('neonpub_pub_code');
      if(pubCode) {
          const { data: event } = await supabase.from('events').select('id').eq('code', pubCode.toUpperCase()).single();
          if(event) {
              const { data: usedQuizzes } = await supabase.from('quizzes')
                  .select('question')
                  .eq('event_id', event.id);
              
              if (usedQuizzes && usedQuizzes.length > 0) {
                  const usedQuestionsSet = new Set(usedQuizzes.map(q => q.question));
                  const filteredCatalog = catalog.filter(item => !usedQuestionsSet.has(item.question));
                  return { data: filteredCatalog };
              }
          }
      }
  } catch (e) {
      console.warn("Impossibile filtrare domande usate:", e);
  }

  return { data: catalog || [] };
};

export const deleteQuizQuestion = async (catalogId) => {
    const { error } = await supabase
        .from('quiz_catalog')
        .update({ is_active: false })
        .eq('id', catalogId);
        
    if (error) throw error;
    return { data: 'ok' };
}

export const getChallengeCatalog = async () => {
  const { data, error } = await supabase.from('challenge_catalog').select('*');
  return { data: data || [] };
};

export const importQuizCatalog = async (jsonString) => {
    try {
        let items;
        try { items = JSON.parse(jsonString); } catch (e) { throw new Error("JSON non valido."); }
        if (!Array.isArray(items)) items = [items];
        
        const { data: existingQuestions } = await supabase.from('quiz_catalog').select('question');
        const existingSet = new Set(existingQuestions?.map(q => q.question) || []);
        
        const newItems = items
            .filter(item => item.question && item.options && !existingSet.has(item.question))
            .map(item => ({
                 category: item.category || 'Generale',
                 question: item.question,
                 options: item.options,
                 correct_index: item.correct_index ?? 0,
                 points: item.points || 10,
                 media_url: item.media_url || null,
                 media_type: item.media_type || 'text',
                 is_active: true
             }));

        if (newItems.length === 0) {
            return { success: true, count: 0, message: "Nessuna nuova domanda." };
        }

        const { error } = await supabase.from('quiz_catalog').insert(newItems);
        if(error) throw error;
        
        return { success: true, count: newItems.length };
    } catch (e) { throw new Error("Errore Importazione: " + e.message); }
}

export const requestSong = async (data) => {
  const participant = getParticipantFromToken()
  const { data: request, error } = await supabase.from('song_requests').insert({
      event_id: participant.event_id, participant_id: participant.participant_id,
      title: data.title, artist: data.artist, youtube_url: data.youtube_url, status: 'pending'
    }).select().single()
  if (error) throw error
  return { data: request }
}

export const getSongQueue = async () => {
  const participant = getParticipantFromToken()
  const { data, error } = await supabase.from('song_requests')
    .select('*, participants (nickname)')
    .eq('event_id', participant.event_id)
    .eq('status', 'queued')
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
  const { data, error } = await supabase.from('song_requests')
    .select('*, participants (nickname)')
    .eq('event_id', event.id)
    .in('status', ['pending', 'queued']) 
    .order('requested_at', { ascending: false })
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

export const deleteRequest = async (requestId) => {
    const { data, error } = await supabase.from('song_requests').update({ status: 'rejected' }).eq('id', requestId).select();
    if (error) throw error;
    return { data };
}

export const startPerformance = async (requestId, youtubeUrl) => {
  const { data: request } = await supabase.from('song_requests').select('*, participants(nickname)').eq('id', requestId).single()
  await supabase.from('performances').update({ status: 'ended' }).eq('event_id', request.event_id).neq('status', 'ended');
  await supabase.from('quizzes').update({ status: 'ended' }).eq('event_id', request.event_id).neq('status', 'ended');

  const { data: performance, error } = await supabase.from('performances').insert({
      event_id: request.event_id, song_request_id: request.id, participant_id: request.participant_id,
      song_title: request.title, song_artist: request.artist, youtube_url: youtubeUrl || request.youtube_url, status: 'live',
      average_score: 0 
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
  const { data, error } = await supabase.from('performances')
      .update({ status: 'live', started_at: new Date().toISOString() })
      .eq('id', performanceId).select();
  if (error) throw error;
  return { data };
}

export const toggleMute = async (isMuted) => {
    const pubCode = localStorage.getItem('neonpub_pub_code');
    const channel = supabase.channel('tv_ctrl');
    await channel.send({
        type: 'broadcast',
        event: 'control',
        payload: { command: 'mute', value: isMuted }
    });
}

export const getCurrentPerformance = async () => {
  const participant = getParticipantFromToken()
  const { data, error } = await supabase.from('performances')
    .select('*, participants (nickname)')
    .eq('event_id', participant.event_id)
    .in('status', ['live', 'voting', 'paused']) 
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return { data: data ? { ...data, user_nickname: data.participants?.nickname || 'Unknown' } : null }
}

export const getAdminCurrentPerformance = async () => {
  const event = await getAdminEvent()
  const { data, error } = await supabase.from('performances')
    .select('*, participants (nickname)')
    .eq('event_id', event.id)
    .in('status', ['live', 'voting', 'paused']) 
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
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

export const sendReaction = async (data) => {
  const participant = getParticipantFromToken()
  const { data: reaction, error } = await supabase.from('reactions').insert({
      event_id: participant.event_id, participant_id: participant.participant_id, emoji: data.emoji, nickname: participant.nickname 
    }).select().single()
  if (error) throw error
  return { data: reaction }
}

export const sendMessage = async (data) => {
  // PRIORITÀ 1: Controlla se è un UTENTE (ha neonpub_token)
  // Questo controlla prima se c'è un token utente valido
  const userToken = localStorage.getItem('neonpub_token');
  if (userToken) {
    try {
      const participant = getParticipantFromToken();
      const text = typeof data === 'string' ? data : (data.text || data.message);
      const { data: message, error } = await supabase.from('messages').insert({
          event_id: participant.event_id,
          participant_id: participant.participant_id, 
          text: text, 
          status: 'pending'  // ← UTENTI: PENDING (devono essere approvati)
      }).select().single();
      if (error) throw error;
      return { data: message };
    } catch (e) {
      // Se fallisce la validazione del token utente, continua al controllo admin
      console.error('Errore token utente:', e);
    }
  }

  // PRIORITÀ 2: Controlla se è ADMIN (ha neonpub_pub_code ma NO token utente)
  const pubCode = localStorage.getItem('neonpub_pub_code');
  if (pubCode) {
      const { data: event } = await supabase.from('events').select('id').eq('code', pubCode.toUpperCase()).single();
      if (event) {
           const text = typeof data === 'string' ? data : (data.text || data.message);
           const { data: message, error } = await supabase.from('messages').insert({
                event_id: event.id,
                participant_id: null,  // ← ADMIN: null (nessun participant)
                text: text, 
                status: 'approved'     // ← ADMIN: APPROVED (approvazione automatica)
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
      .eq('event_id', event.id) // FILTRO PER EVENTO
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

export const deleteAdminMessage = async (id) => {
  const event = await getAdminEvent();
  const { error } = await supabase.from('messages')
    .delete()
    .eq('id', id)
    .eq('event_id', event.id)
    .is('participant_id', null); // sicurezza: solo messaggi regia
  if (error) throw error;
  return { data: 'ok' };
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
    // Messaggio REGIA
    supabase.from('messages').select('*').eq('event_id', event.id).is('participant_id', null).eq('status', 'approved').order('created_at', {ascending: false}).limit(1).maybeSingle(),
    // Messaggi UTENTI
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
  sendMessage, getAdminPendingMessages, approveMessage, rejectMessage, deleteAdminMessage,
  startQuiz, endQuiz, answerQuiz, getActiveQuiz, closeQuizVoting, showQuizResults, showQuizLeaderboard,
  getQuizResults, getAdminLeaderboard,
  getLeaderboard, getDisplayData,
  getActiveEventsForUser,
  deleteQuizQuestion
}