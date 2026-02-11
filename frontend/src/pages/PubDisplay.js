import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '@/lib/supabase';
import api from '@/lib/api';
import { Music, Users, Trophy, Mic2, MessageSquare, Crown, Star, Sparkles } from 'lucide-react';
import QuizMediaFixed from '@/components/QuizMediaFixed';

// ========== KARAOKE SCREEN ==========
const KaraokeScreen = ({ performance, isVoting, voteResult }) => {
  const playerRef = useRef(null);
  const prevVideoIdRef = useRef(null);
  const prevStartedAtRef = useRef(null);
  const isPlayerReadyRef = useRef(false);

  const getYoutubeId = (url) => {
    if (!url) return null;
    const regExp = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  useEffect(() => {
    if (!performance?.youtube_url) return;

    const videoId = getYoutubeId(performance.youtube_url);
    if (!videoId) return;

    const loadYouTubeAPI = () => {
      return new Promise((resolve) => {
        if (window.YT && window.YT.Player) {
          resolve();
          return;
        }
        
        if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
          const tag = document.createElement('script');
          tag.src = 'https://www.youtube.com/iframe_api';
          document.head.appendChild(tag);
        }
        
        const checkYT = setInterval(() => {
          if (window.YT && window.YT.Player) {
            clearInterval(checkYT);
            resolve();
          }
        }, 100);
      });
    };

    const createPlayer = async () => {
      await loadYouTubeAPI();

      // Se è lo stesso video, gestisci solo pause/play/restart
      if (prevVideoIdRef.current === videoId && playerRef.current && isPlayerReadyRef.current) {
        // Gestisci restart tramite started_at
        if (performance.started_at !== prevStartedAtRef.current) {
          console.log('[Karaoke] Restart rilevato');
          prevStartedAtRef.current = performance.started_at;
          playerRef.current.seekTo(0);
          playerRef.current.playVideo();
        }
        
        // Gestisci stato play/pause
        if (isVoting || voteResult) {
          playerRef.current.pauseVideo();
        } else if (performance.status === 'live') {
          playerRef.current.playVideo();
        } else if (performance.status === 'paused') {
          playerRef.current.pauseVideo();
        }
        return;
      }

      // Nuovo video - crea player
      console.log('[Karaoke] Nuovo video:', videoId);
      prevVideoIdRef.current = videoId;
      prevStartedAtRef.current = performance.started_at;
      isPlayerReadyRef.current = false;

      // Cleanup vecchio player
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch (e) {}
        playerRef.current = null;
      }

      const container = document.getElementById('karaoke-player');
      if (!container) return;

      playerRef.current = new window.YT.Player('karaoke-player', {
        videoId: videoId,
        playerVars: {
          autoplay: 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
          iv_load_policy: 3,
          modestbranding: 1,
          rel: 0,
          showinfo: 0,
          playsinline: 1,
          origin: window.location.origin
        },
        events: {
          onReady: (event) => {
            console.log('[Karaoke] Player pronto');
            isPlayerReadyRef.current = true;
            event.target.setVolume(100);
            if (performance.status === 'live' && !isVoting && !voteResult) {
              event.target.playVideo();
            } else {
              event.target.pauseVideo();
            }
          },
          onStateChange: (event) => {
            // Gestisci stati se necessario
          }
        }
      });
    };

    createPlayer();

    return () => {
      // Non distruggere il player durante aggiornamenti normali
    };
  }, [performance, isVoting, voteResult]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch (e) {}
        playerRef.current = null;
      }
      prevVideoIdRef.current = null;
      isPlayerReadyRef.current = false;
    };
  }, []);

  if (isVoting || voteResult) {
    return (
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900 via-black to-pink-900 flex flex-col items-center justify-center">
        <div className="text-center">
          {voteResult ? (
            <>
              <Crown className="w-20 h-20 text-yellow-400 mx-auto mb-4 animate-bounce" />
              <h2 className="text-4xl font-bold text-white mb-2">Risultato Votazione</h2>
              <p className="text-6xl font-bold text-yellow-400">{voteResult.toFixed(1)}</p>
              <p className="text-2xl text-purple-300 mt-2">{performance?.user_nickname}</p>
            </>
          ) : (
            <>
              <Star className="w-20 h-20 text-yellow-400 mx-auto mb-4 animate-pulse" />
              <h2 className="text-4xl font-bold text-white mb-2">Votazione in corso!</h2>
              <p className="text-2xl text-purple-300">Vota {performance?.user_nickname}</p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 bg-black">
      <div id="karaoke-player" className="absolute inset-0" />
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-6">
        <div className="flex items-center gap-4">
          <Mic2 className="w-8 h-8 text-pink-500" />
          <div>
            <h3 className="text-2xl font-bold text-white">{performance?.song_title}</h3>
            <p className="text-lg text-purple-300">{performance?.song_artist} - {performance?.user_nickname}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// ========== QUIZ SCREEN ==========
const QuizScreen = ({ quiz, quizResults }) => {
  // Memoizza i dati del quiz per evitare re-render inutili del media
  const quizDataRef = useRef(null);
  
  // Aggiorna ref solo se cambia davvero il quiz
  if (!quizDataRef.current || quizDataRef.current.id !== quiz?.id) {
    quizDataRef.current = quiz;
  }

  const currentQuiz = quizDataRef.current;

  if (!currentQuiz) return null;

  const isShowingResults = currentQuiz.status === 'showing_results' || currentQuiz.status === 'leaderboard';

  return (
    <div className="absolute inset-0 bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900">
      {/* Media component - usa ref stabile */}
      {currentQuiz.media_url && currentQuiz.media_type !== 'text' && (
        <QuizMediaFixed 
          key={currentQuiz.id} // Key stabile basata su quiz ID
          mediaUrl={currentQuiz.media_url} 
          mediaType={currentQuiz.media_type}
          isResult={isShowingResults}
        />
      )}
      
      {/* Quiz content overlay */}
      <div className="absolute inset-0 flex flex-col">
        {/* Header */}
        <div className="p-6 bg-black/40">
          <div className="flex items-center gap-3">
            <Sparkles className="w-8 h-8 text-yellow-400" />
            <span className="text-2xl font-bold text-white">
              {currentQuiz.category || 'Quiz'}
            </span>
            <span className="ml-auto bg-yellow-500 text-black px-4 py-1 rounded-full font-bold">
              {currentQuiz.points || 10} punti
            </span>
          </div>
        </div>

        {/* Question */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-4xl w-full">
            {/* Mostra risultati se disponibili */}
            {quizResults ? (
              <div className="text-center">
                <h2 className="text-4xl font-bold text-white mb-8">Risposta Corretta!</h2>
                <div className="bg-green-500/30 border-2 border-green-400 rounded-2xl p-6 mb-6">
                  <p className="text-3xl font-bold text-green-400">
                    {quizResults.correct_option}
                  </p>
                </div>
                <div className="flex justify-center gap-8 text-xl">
                  <div className="text-purple-300">
                    <span className="text-3xl font-bold text-white">{quizResults.correct_count}</span>
                    <br />risposte corrette
                  </div>
                  <div className="text-purple-300">
                    <span className="text-3xl font-bold text-white">{quizResults.total_answers}</span>
                    <br />partecipanti
                  </div>
                </div>
                {quizResults.winners && quizResults.winners.length > 0 && (
                  <div className="mt-6">
                    <p className="text-lg text-purple-300 mb-2">Vincitori:</p>
                    <div className="flex flex-wrap justify-center gap-2">
                      {quizResults.winners.slice(0, 5).map((w, i) => (
                        <span key={i} className="bg-yellow-500/30 text-yellow-300 px-3 py-1 rounded-full">
                          {w}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Mostra domanda e opzioni */
              <>
                <h2 className="text-4xl font-bold text-white text-center mb-12 drop-shadow-lg">
                  {currentQuiz.question}
                </h2>
                
                <div className="grid grid-cols-2 gap-4">
                  {currentQuiz.options?.map((option, index) => (
                    <div
                      key={index}
                      className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-6 
                                 hover:bg-white/20 transition-all duration-200"
                    >
                      <div className="flex items-center gap-4">
                        <span className="w-10 h-10 rounded-full bg-purple-500 flex items-center justify-center 
                                        text-white font-bold text-lg">
                          {String.fromCharCode(65 + index)}
                        </span>
                        <span className="text-xl text-white font-medium">{option}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ========== LEADERBOARD SCREEN ==========
const LeaderboardScreen = ({ leaderboard }) => {
  return (
    <div className="absolute inset-0 bg-gradient-to-br from-yellow-900 via-orange-900 to-red-900 p-8">
      <div className="flex items-center justify-center gap-4 mb-8">
        <Trophy className="w-12 h-12 text-yellow-400" />
        <h2 className="text-4xl font-bold text-white">Classifica</h2>
      </div>
      
      <div className="max-w-2xl mx-auto space-y-3">
        {leaderboard?.slice(0, 10).map((player, index) => (
          <div 
            key={player.id || index}
            className={`flex items-center gap-4 p-4 rounded-xl ${
              index === 0 ? 'bg-yellow-500/30 border-2 border-yellow-400' :
              index === 1 ? 'bg-gray-400/30 border-2 border-gray-400' :
              index === 2 ? 'bg-orange-600/30 border-2 border-orange-500' :
              'bg-white/10'
            }`}
          >
            <span className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${
              index === 0 ? 'bg-yellow-500 text-black' :
              index === 1 ? 'bg-gray-400 text-black' :
              index === 2 ? 'bg-orange-500 text-black' :
              'bg-white/20 text-white'
            }`}>
              {index + 1}
            </span>
            <span className="flex-1 text-xl text-white font-medium">{player.nickname}</span>
            <span className="text-2xl font-bold text-yellow-400">{player.score || 0}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ========== MAIN PUB DISPLAY ==========
const PubDisplay = () => {
  const { pubCode } = useParams();
  const [displayData, setDisplayData] = useState(null);
  const [quizResults, setQuizResults] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const pollIntervalRef = useRef(null);
  const lastQuizIdRef = useRef(null);

  const loadDisplayData = useCallback(async () => {
    if (!pubCode) return;
    
    try {
      const { data } = await api.getDisplayData(pubCode);
      
      if (!data) {
        setDisplayData(null);
        return;
      }

      setDisplayData(data);

      // Carica risultati quiz se necessario
      if (data.active_quiz) {
        const quiz = data.active_quiz;
        
        if (quiz.status === 'showing_results' || quiz.status === 'leaderboard') {
          // Carica risultati solo se è un nuovo quiz o stato cambiato
          if (lastQuizIdRef.current !== quiz.id || !quizResults) {
            lastQuizIdRef.current = quiz.id;
            const { data: results } = await api.getQuizResults(quiz.id);
            setQuizResults(results);
          }
        } else {
          // Reset risultati se il quiz è attivo (nuova domanda)
          if (quiz.status === 'active' && quizResults) {
            setQuizResults(null);
          }
        }
      } else {
        setQuizResults(null);
        lastQuizIdRef.current = null;
      }
      
    } catch (error) {
      console.error('Errore caricamento display:', error);
    } finally {
      setIsLoading(false);
    }
  }, [pubCode, quizResults]);

  // Initial load e polling
  useEffect(() => {
    loadDisplayData();
    
    pollIntervalRef.current = setInterval(loadDisplayData, 3000);
    
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [loadDisplayData]);

  // Supabase realtime subscriptions
  useEffect(() => {
    if (!pubCode) return;

    const channel = supabase
      .channel(`display_${pubCode}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'performances'
      }, () => {
        loadDisplayData();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'quizzes'
      }, () => {
        loadDisplayData();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'events'
      }, () => {
        loadDisplayData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [pubCode, loadDisplayData]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <Music className="w-16 h-16 text-purple-500 mx-auto mb-4 animate-pulse" />
          <p className="text-xl text-white">Caricamento...</p>
        </div>
      </div>
    );
  }

  if (!displayData?.pub) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <p className="text-2xl text-red-400">Evento non trovato o terminato</p>
        </div>
      </div>
    );
  }

  const { pub, current_performance, active_quiz, leaderboard, latest_message } = displayData;
  const isVoting = current_performance?.status === 'voting';
  const voteResult = current_performance?.status === 'ended' ? current_performance.average_score : null;

  // Determina cosa mostrare
  const showQuiz = active_quiz && ['active', 'closed', 'showing_results'].includes(active_quiz.status);
  const showLeaderboard = active_quiz?.status === 'leaderboard';
  const showKaraoke = current_performance && !showQuiz && !showLeaderboard;

  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      {/* Main content */}
      {showLeaderboard ? (
        <LeaderboardScreen leaderboard={leaderboard} />
      ) : showQuiz ? (
        <QuizScreen quiz={active_quiz} quizResults={quizResults} />
      ) : showKaraoke ? (
        <KaraokeScreen 
          performance={current_performance} 
          isVoting={isVoting}
          voteResult={voteResult}
        />
      ) : (
        /* Idle screen */
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900 via-black to-pink-900 flex items-center justify-center">
          <div className="text-center">
            {pub.logo_url ? (
              <img src={pub.logo_url} alt={pub.name} className="w-32 h-32 mx-auto mb-6 rounded-xl" />
            ) : (
              <Music className="w-24 h-24 text-purple-500 mx-auto mb-6" />
            )}
            <h1 className="text-5xl font-bold text-white mb-4">{pub.name}</h1>
            <p className="text-2xl text-purple-300">In attesa...</p>
          </div>
        </div>
      )}

      {/* QR Code overlay */}
      <div className="absolute bottom-4 right-4 bg-white p-3 rounded-xl shadow-xl">
        <QRCodeSVG 
          value={`${window.location.origin}/join/${pubCode}`}
          size={100}
        />
        <p className="text-xs text-center mt-1 font-medium">Unisciti!</p>
      </div>

      {/* Latest message */}
      {latest_message && (
        <div className="absolute bottom-4 left-4 max-w-md bg-black/80 backdrop-blur-sm rounded-xl p-4 border border-purple-500/30">
          <div className="flex items-start gap-3">
            <MessageSquare className="w-5 h-5 text-purple-400 flex-shrink-0 mt-1" />
            <p className="text-white">{latest_message.text}</p>
          </div>
        </div>
      )}

      {/* Event name header */}
      <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-sm rounded-xl px-4 py-2">
        <p className="text-white font-medium">{pub.name}</p>
      </div>
    </div>
  );
};

export default PubDisplay;
