import { supabase } from './supabase'

// ============================================
// HELPER: Get Admin Event (già dovrebbe esistere)
// ============================================
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
// CREDITI OPERATORE
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

  // Packages configuration
  const packages = {
    starter: { credits: 10, price: 29.00 },
    pro: { credits: 50, price: 119.00 },
    premium: { credits: 150, price: 299.00 },
    unlimited: { credits: 999999, price: 799.00 }
  }

  const pkg = packages[packageType]
  if (!pkg) throw new Error('Invalid package type')

  // Crea record acquisto
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

  // TODO: Integrazione con Stripe/PayPal
  // Per ora: accredita direttamente (solo per sviluppo)
  // In produzione, questo dovrebbe essere fatto via webhook dopo il pagamento
  
  // TEMPORARY: Auto-complete per sviluppo
  if (process.env.NODE_ENV === 'development') {
    await completeCreditPurchase(purchase.id)
  }

  return purchase
}

// Questa funzione dovrebbe essere chiamata dal webhook di pagamento
export const completeCreditPurchase = async (purchaseId) => {
  const { data: purchase, error: fetchError } = await supabase
    .from('credit_purchases')
    .select('*')
    .eq('id', purchaseId)
    .single()
  
  if (fetchError) throw fetchError

  // Aggiorna stato acquisto
  await supabase
    .from('credit_purchases')
    .update({ 
      payment_status: 'completed',
      completed_at: new Date().toISOString()
    })
    .eq('id', purchaseId)

  // Aggiungi crediti al profilo
  const { data: profile } = await supabase
    .from('profiles')
    .select('credits')
    .eq('id', purchase.operator_id)
    .single()

  await supabase
    .from('profiles')
    .update({ credits: (profile.credits || 0) + purchase.credits_amount })
    .eq('id', purchase.operator_id)

  // Registra transazione
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
// GESTIONE SESSIONE QUIZ
// ============================================

export const startQuizSession = async (questionsData, quizTitle = "Quiz") => {
  const event = await getAdminEvent()
  const { data: user } = await supabase.auth.getUser()
  if (!user?.user) throw new Error('Not authenticated')

  // Verifica crediti
  const { data: profile } = await supabase
    .from('profiles')
    .select('credits')
    .eq('id', user.user.id)
    .single()

  if (!profile || profile.credits < 1) {
    throw new Error('INSUFFICIENT_CREDITS')
  }

  // Termina eventuali sessioni precedenti
  await supabase
    .from('quiz_sessions')
    .update({ state: 'finished', ended_at: new Date().toISOString() })
    .eq('pub_code', event.code)
    .neq('state', 'finished')

  // Crea nuova sessione
  const { data: session, error } = await supabase
    .from('quiz_sessions')
    .insert({
      pub_code: event.code,
      operator_id: user.user.id,
      event_id: event.id,
      quiz_title: quizTitle,
      state: 'idle',
      current_question_index: 0,
      total_questions: questionsData.length,
      questions_data: questionsData
    })
    .select()
    .single()
  
  if (error) throw error

  // Aggiorna modulo evento
  await supabase
    .from('events')
    .update({ active_module: 'quiz', active_module_id: session.id })
    .eq('id', event.id)

  return { data: session }
}

export const getActiveQuizSession = async () => {
  const event = await getAdminEvent()

  const { data, error } = await supabase
    .from('quiz_sessions')
    .select('*')
    .eq('pub_code', event.code)
    .neq('state', 'finished')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  
  if (error) throw error
  return data
}

// ============================================
// TRANSIZIONI DI STATO
// ============================================

export const quizTransition = async (sessionId, action) => {
  const { data: user } = await supabase.auth.getUser()
  if (!user?.user) throw new Error('Not authenticated')

  // Fetch sessione corrente
  const { data: session, error: fetchError } = await supabase
    .from('quiz_sessions')
    .select('*')
    .eq('id', sessionId)
    .single()
  
  if (fetchError) throw fetchError

  const currentState = session.state
  let newState = currentState
  let metadata = {}
  let creditDeducted = false
  let updates = {}

  // Definisci transizioni valide
  switch (action) {
    case 'show_question':
      if (currentState !== 'idle' && currentState !== 'leaderboard') {
        throw new Error('Può mostrare domanda solo da idle o dopo leaderboard')
      }
      
      // Verifica crediti e deduzione
      const { data: profile } = await supabase
        .from('profiles')
        .select('credits')
        .eq('id', user.user.id)
        .single()
      
      if (profile.credits < 1) {
        throw new Error('INSUFFICIENT_CREDITS')
      }

      // Deduce credito
      await supabase
        .from('profiles')
        .update({ credits: profile.credits - 1 })
        .eq('id', user.user.id)
      
      // Registra transazione
      await supabase
        .from('credit_transactions')
        .insert({
          operator_id: user.user.id,
          amount: -1,
          type: 'usage',
          description: `Quiz: ${session.quiz_title} - Q${session.current_question_index + 1}`,
          quiz_session_id: sessionId,
          metadata: { question_index: session.current_question_index }
        })
      
      creditDeducted = true
      newState = 'question_shown'
      updates.question_shown_at = new Date().toISOString()
      break

    case 'open_answers':
      if (currentState !== 'question_shown') {
        throw new Error('Può aprire risposte solo da question_shown')
      }
      newState = 'answers_open'
      updates.answers_opened_at = new Date().toISOString()
      break

    case 'close_answers':
      if (currentState !== 'answers_open') {
        throw new Error('Può chiudere risposte solo da answers_open')
      }
      newState = 'answers_closed'
      
      // Conta risposte ricevute
      const { count } = await supabase
        .from('quiz_answers')
        .select('id', { count: 'exact', head: true })
        .eq('session_id', sessionId)
        .eq('question_index', session.current_question_index)
      
      metadata.answers_received = count
      break

    case 'reveal_answer':
      if (currentState !== 'answers_closed' && currentState !== 'answers_open') {
        throw new Error('Può rivelare risposta solo da answers_closed')
      }
      newState = 'reveal_answer'
      break

    case 'show_results':
      if (currentState !== 'reveal_answer') {
        throw new Error('Può mostrare risultati solo da reveal_answer')
      }
      newState = 'show_results'
      break

    case 'show_leaderboard':
      if (currentState !== 'show_results') {
        throw new Error('Può mostrare classifica solo da show_results')
      }
      newState = 'leaderboard'
      break

    case 'next_question':
      if (currentState !== 'leaderboard') {
        throw new Error('Può andare a prossima domanda solo da leaderboard')
      }
      
      const nextIndex = session.current_question_index + 1
      if (nextIndex >= session.total_questions) {
        throw new Error('Non ci sono più domande')
      }
      
      newState = 'idle'
      updates.current_question_index = nextIndex
      break

    case 'end_quiz':
      newState = 'finished'
      updates.ended_at = new Date().toISOString()
      break

    default:
      throw new Error('Azione non valida')
  }

  // Aggiorna stato sessione
  const { error: updateError } = await supabase
    .from('quiz_sessions')
    .update({ 
      state: newState,
      ...updates
    })
    .eq('id', sessionId)
  
  if (updateError) throw updateError

  // Log transizione
  await supabase
    .from('quiz_state_log')
    .insert({
      session_id: sessionId,
      from_state: currentState,
      to_state: newState,
      question_index: session.current_question_index,
      triggered_by: user.user.id,
      trigger_type: 'manual',
      metadata
    })

  // Fetch sessione aggiornata
  const { data: updatedSession } = await supabase
    .from('quiz_sessions')
    .select('*')
    .eq('id', sessionId)
    .single()

  return { 
    data: updatedSession,
    credit_deducted: creditDeducted
  }
}

// ============================================
// PARTECIPANTI E RISPOSTE
// ============================================

export const joinQuizSession = async (sessionId) => {
  const participant = JSON.parse(localStorage.getItem('neonpub_token'))
  if (!participant) throw new Error('Not authenticated')

  // Verifica se già iscritto
  const { data: existing } = await supabase
    .from('quiz_participants')
    .select('id')
    .eq('session_id', sessionId)
    .eq('participant_id', participant.participant_id)
    .maybeSingle()
  
  if (existing) {
    return { data: existing }
  }

  // Crea partecipante
  const { data, error } = await supabase
    .from('quiz_participants')
    .insert({
      session_id: sessionId,
      participant_id: participant.participant_id,
      nickname: participant.nickname
    })
    .select()
    .single()
  
  if (error) throw error
  return { data }
}

export const submitQuizAnswer = async (sessionId, questionIndex, answerIndex, timeTaken) => {
  const participant = JSON.parse(localStorage.getItem('neonpub_token'))
  if (!participant) throw new Error('Not authenticated')

  // Verifica stato sessione
  const { data: session } = await supabase
    .from('quiz_sessions')
    .select('state, current_question_index, questions_data, time_per_question, points_base, points_speed_bonus')
    .eq('id', sessionId)
    .single()
  
  if (session.state !== 'answers_open') {
    throw new Error('ANSWERS_NOT_OPEN')
  }

  if (session.current_question_index !== questionIndex) {
    throw new Error('WRONG_QUESTION_INDEX')
  }

  // Verifica timing
  if (timeTaken > session.time_per_question) {
    throw new Error('TIMEOUT_EXCEEDED')
  }

  // Get quiz participant ID
  const { data: quizParticipant } = await supabase
    .from('quiz_participants')
    .select('id')
    .eq('session_id', sessionId)
    .eq('participant_id', participant.participant_id)
    .single()
  
  if (!quizParticipant) {
    throw new Error('PARTICIPANT_NOT_FOUND')
  }

  // Verifica risposta corretta
  const question = session.questions_data[questionIndex]
  const isCorrect = answerIndex === question.correct_index

  // Calcola punti
  let pointsEarned = 0
  if (isCorrect) {
    const speedBonus = Math.round(
      session.points_speed_bonus * (1 - timeTaken / session.time_per_question)
    )
    pointsEarned = session.points_base + speedBonus
  }

  // Salva risposta (trigger aggiorna automaticamente le stats)
  const { data: answer, error } = await supabase
    .from('quiz_answers')
    .insert({
      session_id: sessionId,
      quiz_participant_id: quizParticipant.id,
      question_index: questionIndex,
      answer_index: answerIndex,
      is_correct: isCorrect,
      time_taken: timeTaken,
      points_earned: pointsEarned
    })
    .select()
    .single()
  
  if (error) {
    if (error.code === '23505') { // unique violation
      throw new Error('ALREADY_ANSWERED')
    }
    throw error
  }

  return { 
    data: answer,
    is_correct: isCorrect,
    points_earned: pointsEarned
  }
}

export const getQuizLeaderboard = async (sessionId) => {
  const { data, error } = await supabase
    .from('quiz_leaderboard')
    .select('*')
    .eq('session_id', sessionId)
    .order('rank', { ascending: true })
  
  if (error) throw error
  return data
}

export const getQuizLiveStats = async (sessionId, questionIndex) => {
  const { data, error } = await supabase
    .from('quiz_answers')
    .select('answer_index, is_correct')
    .eq('session_id', sessionId)
    .eq('question_index', questionIndex)
  
  if (error) throw error

  // Conta risposte per opzione
  const distribution = { 0: 0, 1: 0, 2: 0, 3: 0 }
  data.forEach(answer => {
    distribution[answer.answer_index] = (distribution[answer.answer_index] || 0) + 1
  })

  return {
    total_answers: data.length,
    distribution,
    correct_count: data.filter(a => a.is_correct).length
  }
}

// ============================================
// CATALOGO QUIZ (mantieni funzioni esistenti)
// ============================================

export const getQuizCatalog = async () => {
  const event = await getAdminEvent()
  const { data, error } = await supabase
    .from('quiz_catalog')
    .select('*')
    .order('category', { ascending: true })
  
  if (error) throw error
  return { data }
}

export const addQuizToCatalog = async (quizData) => {
  const event = await getAdminEvent()
  const { data: user } = await supabase.auth.getUser()
  if (!user?.user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('quiz_catalog')
    .insert({
      category: quizData.category,
      question: quizData.question,
      options: quizData.options,
      correct_index: quizData.correct_index,
      media_url: quizData.media_url || null,
      media_type: quizData.media_type || 'text',
      created_by: user.user.id
    })
    .select()
    .single()
  
  if (error) throw error
  return { data }
}

export const deleteQuizQuestion = async (questionId) => {
  const { error } = await supabase
    .from('quiz_catalog')
    .delete()
    .eq('id', questionId)
  
  if (error) throw error
  return { data: 'ok' }
}

export const importQuizCatalog = async (jsonText) => {
  const { data: user } = await supabase.auth.getUser()
  if (!user?.user) throw new Error('Not authenticated')

  let questions
  try {
    questions = JSON.parse(jsonText)
  } catch (e) {
    throw new Error('JSON non valido')
  }

  if (!Array.isArray(questions)) {
    throw new Error('Il JSON deve contenere un array di domande')
  }

  const toInsert = questions.map(q => ({
    category: q.category || 'Generale',
    question: q.question,
    options: q.options,
    correct_index: q.correct_index,
    media_url: q.media_url || null,
    media_type: q.media_type || 'text',
    created_by: user.user.id
  }))

  const { data, error } = await supabase
    .from('quiz_catalog')
    .insert(toInsert)
    .select()
  
  if (error) throw error
  
  return { count: data.length, data }
}


export const restartQuizMedia = async (quizId) => {
  // Per riavviare, possiamo usare un trick: aggiorniamo media_state o un timestamp
  // Qui forziamo 'playing' e aggiorniamo created_at (o un campo dummy) per forzare il refresh se necessario
  // Ma per YouTube basta fare seekTo(0). Gestiamolo lato client col 'playing'.
  return controlQuizMedia(quizId, 'playing'); 
}
export default {
  createPub, updateEventSettings, uploadLogo, getPub, joinPub, adminLogin, getMe,
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
  getActiveEventsForUser, // Sostituisce recoverActiveEvent
  deleteQuizQuestion,
  controlQuizMedia,
  restartQuizMedia
}
  // Crediti
  getOperatorCredits,
  getCreditHistory,
  purchaseCredits,
  completeCreditPurchase,
  
  // Sessioni Quiz
  startQuizSession,
  getActiveQuizSession,
  quizTransition,
  
  // Partecipanti
  joinQuizSession,
  submitQuizAnswer,
  getQuizLeaderboard,
  getQuizLiveStats,
  
  // Catalogo
  getQuizCatalog,
  addQuizToCatalog,
  deleteQuizQuestion,
  importQuizCatalog
}