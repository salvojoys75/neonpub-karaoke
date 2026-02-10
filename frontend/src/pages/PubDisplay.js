import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { Mic2, Trophy, Star, MessageSquare, CheckCircle2, XCircle } from "lucide-react";
import api from "@/lib/api";
import { supabase } from "@/lib/supabase";
import QuizMediaFixed from "@/components/QuizMediaFixed";

// ===========================================
// QUIZ SCENES - PROFESSIONAL VERSION
// ===========================================

const QuizQuestionScene = ({ session, question, participantsCount }) => {
    const [timeLeft, setTimeLeft] = useState(30);
    const [liveStats, setLiveStats] = useState(null);

    useEffect(() => {
        if (session.state !== 'answers_open') return;

        // Countdown timer
        const startTime = new Date(session.answers_opened_at).getTime();
        const interval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - startTime) / 1000);
            const remaining = Math.max(0, session.time_per_question - elapsed);
            setTimeLeft(remaining);
            
            if (remaining === 0) {
                clearInterval(interval);
            }
        }, 100);

        return () => clearInterval(interval);
    }, [session.state, session.answers_opened_at, session.time_per_question]);

    useEffect(() => {
        if (session.state !== 'answers_open') return;

        // Poll live stats
        const fetchStats = async () => {
            try {
                const stats = await api.getQuizLiveStats(session.id, session.current_question_index);
                setLiveStats(stats);
            } catch (e) {
                console.error('Error fetching live stats:', e);
            }
        };

        fetchStats();
        const interval = setInterval(fetchStats, 2000);
        return () => clearInterval(interval);
    }, [session.state, session.id, session.current_question_index]);

    const showAnswers = session.state === 'answers_open';
    const answeredCount = liveStats?.total_answers || 0;

    return (
        <div className="absolute inset-0 flex flex-col">
            {/* Media Background */}
            <QuizMediaFixed 
                mediaUrl={question.media_url}
                mediaType={question.media_type}
                state={session.state}
                autoplay={true}
                volume={100}
            />

            {/* Question Overlay */}
            <div className="relative z-10 flex-1 flex flex-col p-12">
                {/* Header */}
                <div className="flex justify-between items-start mb-8">
                    <div className="bg-fuchsia-600 px-6 py-3 rounded-full text-white font-bold text-2xl">
                        DOMANDA {session.current_question_index + 1}/{session.total_questions}
                    </div>
                    {showAnswers && (
                        <div className="bg-white/10 backdrop-blur-md px-6 py-3 rounded-full border-2 border-white/30">
                            <div className="text-white text-3xl font-bold font-mono">
                                {timeLeft}s
                            </div>
                        </div>
                    )}
                    {showAnswers && (
                        <div className="bg-white/10 backdrop-blur-md px-6 py-3 rounded-full text-white text-xl">
                            {answeredCount}/{participantsCount} risposte
                        </div>
                    )}
                </div>

                {/* Question Text */}
                <div className="flex-1 flex items-center justify-center mb-8">
                    <div className="bg-black/60 backdrop-blur-lg p-12 rounded-3xl border-2 border-white/20 max-w-6xl w-full animate-slide-down">
                        <h2 className="text-6xl font-black text-white leading-tight text-center">
                            {question.question}
                        </h2>
                    </div>
                </div>

                {/* Answer Options */}
                {showAnswers && (
                    <div className="grid grid-cols-2 gap-6">
                        {question.options.map((opt, i) => {
                            const letter = ['A', 'B', 'C', 'D'][i];
                            const count = liveStats?.distribution?.[i] || 0;
                            const percentage = liveStats ? Math.round((count / answeredCount) * 100) || 0 : 0;
                            
                            return (
                                <div 
                                    key={i}
                                    className="relative bg-white/10 backdrop-blur-md border-2 border-white/30 rounded-2xl p-6 animate-pop-in"
                                    style={{ animationDelay: `${i * 100}ms` }}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="bg-fuchsia-600 text-white font-black text-4xl w-16 h-16 rounded-full flex items-center justify-center flex-shrink-0">
                                            {letter}
                                        </div>
                                        <div className="flex-1 text-white text-3xl font-bold">
                                            {opt}
                                        </div>
                                    </div>
                                    {session.show_live_stats && answeredCount > 0 && (
                                        <div className="mt-4 flex items-center gap-2">
                                            <div className="flex-1 bg-white/20 rounded-full h-4 overflow-hidden">
                                                <div 
                                                    className="bg-fuchsia-500 h-full transition-all duration-500"
                                                    style={{ width: `${percentage}%` }}
                                                />
                                            </div>
                                            <span className="text-white font-bold text-xl w-16 text-right">
                                                {percentage}%
                                            </span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Waiting Message */}
                {!showAnswers && (
                    <div className="text-center">
                        <div className="bg-yellow-500/20 text-yellow-500 px-8 py-4 rounded-full text-3xl font-bold inline-block animate-pulse">
                            Prepara la risposta...
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const QuizRevealScene = ({ session, question }) => {
    const correctOption = question.options[question.correct_index];
    const correctLetter = ['A', 'B', 'C', 'D'][question.correct_index];

    return (
        <div className="absolute inset-0 flex items-center justify-center">
            {/* Dimmed Media Background */}
            <QuizMediaFixed 
                mediaUrl={question.media_url}
                mediaType={question.media_type}
                state="reveal_answer"
                autoplay={false}
                volume={0}
            />

            {/* Reveal Content */}
            <div className="relative z-10 w-full max-w-5xl px-12 animate-zoom-in">
                <div className="bg-gradient-to-b from-green-600 to-green-800 p-12 rounded-[3rem] border-4 border-green-400 shadow-[0_0_60px_rgba(34,197,94,0.6)]">
                    {/* Checkmark Icon */}
                    <div className="flex justify-center mb-8">
                        <CheckCircle2 className="w-32 h-32 text-white animate-bounce" />
                    </div>

                    {/* Title */}
                    <h2 className="text-5xl font-black text-white text-center mb-8 uppercase tracking-wider">
                        Risposta Corretta
                    </h2>

                    {/* Correct Answer */}
                    <div className="bg-white/20 backdrop-blur-md rounded-3xl p-8 border-2 border-white/40">
                        <div className="flex items-center justify-center gap-6">
                            <div className="bg-white text-green-800 font-black text-6xl w-24 h-24 rounded-full flex items-center justify-center">
                                {correctLetter}
                            </div>
                            <div className="text-white text-5xl font-bold flex-1 text-center">
                                {correctOption}
                            </div>
                        </div>
                    </div>

                    {/* Confetti Effect Placeholder */}
                    <div className="absolute inset-0 pointer-events-none overflow-hidden">
                        {[...Array(20)].map((_, i) => (
                            <div
                                key={i}
                                className="absolute w-4 h-4 bg-yellow-400 animate-confetti"
                                style={{
                                    left: `${Math.random() * 100}%`,
                                    animationDelay: `${Math.random() * 0.5}s`,
                                    animationDuration: `${2 + Math.random()}s`
                                }}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

const QuizResultsScene = ({ session, question, stats }) => {
    const total = stats.total_answers || 0;
    const correctCount = stats.correct_count || 0;
    const correctPercentage = total > 0 ? Math.round((correctCount / total) * 100) : 0;

    return (
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-900 to-black flex flex-col p-12 animate-fade-in">
            {/* Title */}
            <div className="text-center mb-8">
                <h1 className="text-6xl font-black text-white uppercase">
                    Statistiche Risposte
                </h1>
                <p className="text-3xl text-zinc-400 mt-4">
                    {total} partecipanti hanno risposto
                </p>
            </div>

            {/* Answer Breakdown */}
            <div className="flex-1 flex flex-col justify-center max-w-6xl mx-auto w-full space-y-6">
                {question.options.map((opt, i) => {
                    const count = stats.distribution?.[i] || 0;
                    const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
                    const isCorrect = i === question.correct_index;
                    const letter = ['A', 'B', 'C', 'D'][i];

                    return (
                        <div 
                            key={i}
                            className={`relative overflow-hidden rounded-3xl p-6 border-4 transition-all animate-slide-in ${
                                isCorrect 
                                    ? 'bg-green-600/20 border-green-500' 
                                    : 'bg-white/5 border-white/10'
                            }`}
                            style={{ animationDelay: `${i * 100}ms` }}
                        >
                            <div className="relative z-10 flex items-center gap-6">
                                {/* Letter */}
                                <div className={`font-black text-5xl w-20 h-20 rounded-full flex items-center justify-center flex-shrink-0 ${
                                    isCorrect 
                                        ? 'bg-green-500 text-white' 
                                        : 'bg-white/10 text-white'
                                }`}>
                                    {letter}
                                </div>

                                {/* Option Text */}
                                <div className="flex-1">
                                    <div className="text-white text-3xl font-bold mb-2">
                                        {opt}
                                        {isCorrect && (
                                            <CheckCircle2 className="inline-block ml-4 w-8 h-8 text-green-400" />
                                        )}
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="flex-1 bg-white/10 rounded-full h-6 overflow-hidden">
                                            <div 
                                                className={`h-full transition-all duration-1000 ${
                                                    isCorrect ? 'bg-green-500' : 'bg-zinc-600'
                                                }`}
                                                style={{ width: `${percentage}%` }}
                                            />
                                        </div>
                                        <span className="text-white font-bold text-2xl w-20 text-right">
                                            {percentage}%
                                        </span>
                                        <span className="text-zinc-400 text-xl w-24 text-right">
                                            {count} voti
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Summary */}
            <div className="text-center mt-8">
                <div className="inline-flex items-center gap-8 bg-white/10 backdrop-blur-md px-12 py-6 rounded-full">
                    <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-10 h-10 text-green-500" />
                        <span className="text-white text-3xl font-bold">
                            {correctCount} corrette ({correctPercentage}%)
                        </span>
                    </div>
                    <div className="w-px h-12 bg-white/20" />
                    <div className="flex items-center gap-3">
                        <XCircle className="w-10 h-10 text-red-500" />
                        <span className="text-white text-3xl font-bold">
                            {total - correctCount} sbagliate ({100 - correctPercentage}%)
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

const QuizLeaderboardScene = ({ leaderboard }) => {
    const topThree = leaderboard.slice(0, 3);
    const rest = leaderboard.slice(3);

    return (
        <div className="absolute inset-0 bg-gradient-to-b from-yellow-900 to-black flex flex-col p-12 animate-fade-in">
            {/* Title */}
            <div className="text-center mb-12">
                <div className="flex items-center justify-center gap-4 mb-4">
                    <Trophy className="w-20 h-20 text-yellow-500 animate-bounce" />
                    <h1 className="text-7xl font-black text-yellow-500 uppercase drop-shadow-[0_0_20px_rgba(234,179,8,0.8)]">
                        Classifica
                    </h1>
                    <Trophy className="w-20 h-20 text-yellow-500 animate-bounce" />
                </div>
            </div>

            {/* Podium */}
            {topThree.length > 0 && (
                <div className="flex items-end justify-center gap-8 mb-12">
                    {/* 2nd Place */}
                    {topThree[1] && (
                        <div className="flex flex-col items-center animate-rise" style={{ animationDelay: '200ms' }}>
                            <div className="text-6xl mb-2">🥈</div>
                            <div className="bg-zinc-400 text-black font-black text-3xl w-24 h-24 rounded-full flex items-center justify-center mb-2 border-4 border-zinc-200">
                                2
                            </div>
                            <div className="text-white text-2xl font-bold mb-2 text-center max-w-xs truncate">
                                {topThree[1].nickname}
                            </div>
                            <div className="text-yellow-400 text-3xl font-mono font-bold">
                                {topThree[1].score}
                            </div>
                            <div className="bg-zinc-400 w-32 rounded-t-2xl" style={{ height: '140px' }} />
                        </div>
                    )}

                    {/* 1st Place */}
                    {topThree[0] && (
                        <div className="flex flex-col items-center animate-rise" style={{ animationDelay: '0ms' }}>
                            <div className="text-8xl mb-2">🥇</div>
                            <div className="bg-yellow-500 text-black font-black text-4xl w-32 h-32 rounded-full flex items-center justify-center mb-2 border-4 border-yellow-300 shadow-[0_0_40px_rgba(234,179,8,0.6)]">
                                1
                            </div>
                            <div className="text-white text-3xl font-bold mb-2 text-center max-w-xs truncate">
                                {topThree[0].nickname}
                            </div>
                            <div className="text-yellow-400 text-4xl font-mono font-bold">
                                {topThree[0].score}
                            </div>
                            <div className="bg-yellow-500 w-40 rounded-t-2xl" style={{ height: '180px' }} />
                        </div>
                    )}

                    {/* 3rd Place */}
                    {topThree[2] && (
                        <div className="flex flex-col items-center animate-rise" style={{ animationDelay: '400ms' }}>
                            <div className="text-6xl mb-2">🥉</div>
                            <div className="bg-amber-700 text-white font-black text-3xl w-24 h-24 rounded-full flex items-center justify-center mb-2 border-4 border-amber-500">
                                3
                            </div>
                            <div className="text-white text-2xl font-bold mb-2 text-center max-w-xs truncate">
                                {topThree[2].nickname}
                            </div>
                            <div className="text-yellow-400 text-3xl font-mono font-bold">
                                {topThree[2].score}
                            </div>
                            <div className="bg-amber-700 w-32 rounded-t-2xl" style={{ height: '120px' }} />
                        </div>
                    )}
                </div>
            )}

            {/* Rest of Leaderboard */}
            {rest.length > 0 && (
                <div className="flex-1 overflow-y-auto px-12">
                    <div className="grid grid-cols-2 gap-4">
                        {rest.map((player, i) => (
                            <div 
                                key={player.id}
                                className="flex items-center bg-white/5 p-4 rounded-xl animate-fade-in"
                                style={{ animationDelay: `${(i + 3) * 50}ms` }}
                            >
                                <span className="w-12 h-12 flex items-center justify-center bg-zinc-800 text-zinc-400 rounded-full mr-4 text-xl font-bold border-2 border-zinc-600">
                                    {i + 4}
                                </span>
                                <span className="flex-1 text-white text-2xl font-medium truncate">
                                    {player.nickname}
                                </span>
                                <span className="text-yellow-400 text-2xl font-mono font-bold">
                                    {player.score}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

// ===========================================
// KARAOKE SCREEN (mantieni esistente)
// ===========================================
const KaraokeScreen = ({ performance, isVoting, voteResult }) => {
    const playerRef = useRef(null);
    const prevStartedAt = useRef(performance?.started_at);

    useEffect(() => {
        if (!performance || isVoting || voteResult) return;
        const videoId = performance.youtube_url?.match(/(?:youtu\.be\/|v=)([^&#?]*)/)?.[1];
        if (!videoId) return;

        const onPlayerReady = (event) => {
            if (performance.status === 'live') event.target.playVideo();
            else if (performance.status === 'paused') event.target.pauseVideo();
        };

        if (!window.YT) {
            const tag = document.createElement('script');
            tag.src = "https://www.youtube.com/iframe_api";
            const firstScriptTag = document.getElementsByTagName('script')[0];
            firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
            
            window.onYouTubeIframeAPIReady = () => {
                createPlayer(videoId, onPlayerReady);
            };
        } else if (!playerRef.current) {
             createPlayer(videoId, onPlayerReady);
        } else {
             const currentVideoData = playerRef.current.getVideoData();
             if (currentVideoData && currentVideoData.video_id !== videoId) {
                 playerRef.current.loadVideoById(videoId);
             }
             
             if (playerRef.current && typeof playerRef.current.playVideo === 'function') {
                 if (performance.status === 'live') playerRef.current.playVideo();
                 else if (performance.status === 'paused') playerRef.current.pauseVideo();

                 if (performance.started_at !== prevStartedAt.current) {
                      prevStartedAt.current = performance.started_at; 
                      playerRef.current.seekTo(0);
                      playerRef.current.playVideo();
                 }
             }
        }
    }, [performance, isVoting, voteResult]);

    const createPlayer = (videoId, onReady) => {
        playerRef.current = new window.YT.Player('karaoke-player', {
            videoId: videoId,
            playerVars: { 
                autoplay: 1, controls: 0, disablekb: 1, fs: 0, iv_load_policy: 3, 
                modestbranding: 1, rel: 0, showinfo: 0, origin: window.location.origin 
            },
            events: { onReady: onReady }
        });
    };

    useEffect(() => {
        const el = document.getElementById('karaoke-player');
        if ((isVoting || voteResult) && playerRef.current && typeof playerRef.current.pauseVideo === 'function') {
            playerRef.current.pauseVideo();
            if(el) el.style.visibility = 'hidden';
        } else {
            if(el) el.style.visibility = 'visible';
        }
    }, [isVoting, voteResult]);

    return (
        <div className="absolute inset-0 bg-black flex flex-col justify-center overflow-hidden">
            <div id="karaoke-player" className="absolute inset-0 w-full h-full z-0 pointer-events-none" />
            
            {!isVoting && !voteResult && (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/80 to-transparent p-12 z-10 pb-20 animate-fade-in">
                    <h2 className="text-6xl font-black text-white mb-2 drop-shadow-lg">{performance.song_title}</h2>
                    <div className="flex items-end gap-6">
                        <p className="text-4xl text-zinc-300 font-medium">{performance.song_artist}</p>
                        <div className="bg-fuchsia-600 px-6 py-2 rounded-full flex items-center gap-3 animate-pulse">
                            <Mic2 className="w-8 h-8" />
                            <span className="text-2xl font-bold uppercase tracking-wider">{performance.user_nickname}</span>
                        </div>
                    </div>
                </div>
            )}

            {isVoting && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-zinc-900 animate-zoom-in">
                    <h2 className="text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-600 mb-8 animate-pulse drop-shadow-lg">VOTA ORA!</h2>
                    <div className="bg-white/10 p-16 rounded-full border-8 border-yellow-500 shadow-[0_0_100px_rgba(234,179,8,0.5)] animate-spin-slow">
                        <Star className="w-48 h-48 text-yellow-500 fill-yellow-500" />
                    </div>
                </div>
            )}

            {voteResult !== null && (
                <div className="absolute inset-0 z-25 flex flex-col items-center justify-center bg-black/95 animate-fade-in">
                    <h2 className="text-6xl text-white font-bold mb-8">MEDIA VOTO</h2>
                    <div className="flex items-center gap-6">
                        <Star className="w-32 h-32 text-yellow-400 fill-yellow-400 animate-bounce" />
                        <span className="text-[12rem] font-black text-white leading-none">{Number(voteResult).toFixed(1)}</span>
                    </div>
                </div>
            )}
        </div>
    );
};

// ===========================================
// MAIN COMPONENT
// ===========================================
export default function PubDisplay() {
  const { pubCode } = useParams();
  const [displayData, setDisplayData] = useState(null);
  const [ticker, setTicker] = useState("");
  
  const [floatingReactions, setFloatingReactions] = useState([]);
  const [flashMessages, setFlashMessages] = useState([]);
  
  const [voteResult, setVoteResult] = useState(null);
  
  // Quiz state
  const [quizSession, setQuizSession] = useState(null);
  const [quizLeaderboard, setQuizLeaderboard] = useState([]);
  const [quizStats, setQuizStats] = useState(null);
  const [participantsCount, setParticipantsCount] = useState(0);

  const loadDisplayData = useCallback(async () => {
    try {
      const { data } = await api.getDisplayData(pubCode);
      setDisplayData(data);
      
      // Ticker management
      if (data.queue?.length > 0) {
        setTicker(data.queue.slice(0, 5).map((s, i) => `${i + 1}. ${s.title} (${s.user_nickname})`).join(' • '));
      } else {
        setTicker("Inquadra il QR Code per cantare!");
      }

      // Vote result management
      if (data.current_performance?.status === 'ended' && !voteResult && data.current_performance.average_score > 0) {
         setVoteResult(data.current_performance.average_score);
         setTimeout(() => setVoteResult(null), 10000);
      }

      // Quiz session management
      if (data.active_module === 'quiz' && data.active_module_id) {
        loadQuizData(data.active_module_id);
      } else {
        setQuizSession(null);
      }
    } catch (error) { 
      console.error('Error loading display data:', error); 
    }
  }, [pubCode, voteResult]);

  const loadQuizData = async (sessionId) => {
    try {
      // Load session
      const session = await api.getActiveQuizSession();
      if (session) {
        setQuizSession(session);

        // Load leaderboard if in leaderboard state
        if (session.state === 'leaderboard') {
          const leaderboard = await api.getQuizLeaderboard(session.id);
          setQuizLeaderboard(leaderboard || []);
        }

        // Load stats if in show_results state
        if (session.state === 'show_results') {
          const stats = await api.getQuizLiveStats(session.id, session.current_question_index);
          setQuizStats(stats);
        }

        // Count participants
        const { data: participants } = await supabase
          .from('quiz_participants')
          .select('id', { count: 'exact', head: true })
          .eq('session_id', session.id);
        setParticipantsCount(participants || 0);
      }
    } catch (error) {
      console.error('Error loading quiz data:', error);
    }
  };

  useEffect(() => {
    loadDisplayData();
    const interval = setInterval(loadDisplayData, 3000);
    return () => clearInterval(interval);
  }, [loadDisplayData]);

  // Realtime subscriptions
  useEffect(() => {
    if (!displayData?.pub?.id) return;
    
    // Control channel
    const controlChannel = supabase.channel(`display_control_${pubCode}`)
        .on('broadcast', { event: 'control' }, (payload) => {
            if(payload.payload.command === 'mute') {
                const ytKaraoke = window.YT?.get?.('karaoke-player');
                const ytQuiz = window.YT?.get?.('quiz-media-player');
                
                if (ytKaraoke && typeof ytKaraoke.mute === 'function') {
                    payload.payload.value ? ytKaraoke.mute() : ytKaraoke.unMute();
                }
                if (ytQuiz && typeof ytQuiz.mute === 'function') {
                    payload.payload.value ? ytQuiz.mute() : ytQuiz.unMute();
                }
            }
        })
        .subscribe();

    // Reactions channel
    const reactionsChannel = supabase.channel(`pub_reactions_${displayData.pub.id}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reactions', filter: `event_id=eq.${displayData.pub.id}` }, 
            (payload) => {
                const newReaction = { id: Date.now(), emoji: payload.new.emoji, x: Math.random() * 90 + 5, y: 100 };
                setFloatingReactions(prev => [...prev, newReaction]);
                setTimeout(() => setFloatingReactions(prev => prev.filter(r => r.id !== newReaction.id)), 4000);
            })
        .subscribe();

    // Messages channel
    const messagesChannel = supabase.channel(`pub_messages_${displayData.pub.id}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `event_id=eq.${displayData.pub.id}` }, 
            (payload) => {
                if (payload.new.status === 'approved' && payload.old.status === 'pending') {
                    const newFlash = { id: Date.now(), text: payload.new.text };
                    setFlashMessages(prev => [...prev, newFlash]);
                    setTimeout(() => setFlashMessages(prev => prev.filter(m => m.id !== newFlash.id)), 10000);
                }
            })
        .subscribe();

    // Quiz state changes
    const quizChannel = supabase.channel(`quiz_state_${pubCode}`)
        .on('postgres_changes', { 
            event: 'UPDATE', 
            schema: 'public', 
            table: 'quiz_sessions',
            filter: `pub_code=eq.${pubCode}`
        }, () => {
            loadDisplayData();
        })
        .subscribe();

    return () => {
      controlChannel.unsubscribe();
      reactionsChannel.unsubscribe();
      messagesChannel.unsubscribe();
      quizChannel.unsubscribe();
    };
  }, [displayData?.pub?.id, pubCode, loadDisplayData]);

  if (!displayData) {
    return <div className="h-screen bg-black flex items-center justify-center text-white text-2xl">Caricamento...</div>;
  }

  const { pub, active_module, current_performance } = displayData;
  const isVoting = current_performance?.status === 'ended' && !voteResult;

  // Determine which scene to show
  let mainContent = null;

  if (quizSession && active_module === 'quiz') {
    const currentQuestion = quizSession.questions_data[quizSession.current_question_index];

    switch (quizSession.state) {
      case 'idle':
        mainContent = (
          <div className="absolute inset-0 bg-gradient-to-br from-purple-900 to-black flex items-center justify-center">
            <div className="text-center animate-pulse">
              <h1 className="text-8xl font-black text-fuchsia-500 mb-4">QUIZ</h1>
              <p className="text-4xl text-white">Preparati...</p>
            </div>
          </div>
        );
        break;

      case 'question_shown':
      case 'answers_open':
      case 'answers_closed':
        mainContent = (
          <QuizQuestionScene 
            session={quizSession}
            question={currentQuestion}
            participantsCount={participantsCount}
          />
        );
        break;

      case 'reveal_answer':
        mainContent = (
          <QuizRevealScene 
            session={quizSession}
            question={currentQuestion}
          />
        );
        break;

      case 'show_results':
        mainContent = (
          <QuizResultsScene 
            session={quizSession}
            question={currentQuestion}
            stats={quizStats || {}}
          />
        );
        break;

      case 'leaderboard':
        mainContent = (
          <QuizLeaderboardScene 
            leaderboard={quizLeaderboard}
          />
        );
        break;

      case 'finished':
        mainContent = (
          <div className="absolute inset-0 bg-gradient-to-br from-yellow-900 to-black flex flex-col items-center justify-center">
            <Trophy className="w-48 h-48 text-yellow-500 mb-8 animate-bounce" />
            <h1 className="text-8xl font-black text-yellow-500 mb-4">QUIZ TERMINATO!</h1>
            <p className="text-4xl text-white">Grazie a tutti i partecipanti</p>
          </div>
        );
        break;

      default:
        mainContent = (
          <div className="absolute inset-0 bg-black flex items-center justify-center">
            <p className="text-4xl text-white">Stato sconosciuto: {quizSession.state}</p>
          </div>
        );
    }
  } else if (current_performance) {
    mainContent = (
      <KaraokeScreen 
        performance={current_performance}
        isVoting={isVoting}
        voteResult={voteResult}
      />
    );
  } else {
    // Idle screen
    mainContent = (
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900 to-black flex flex-col items-center justify-center p-12">
        <div className="max-w-4xl w-full bg-black/40 backdrop-blur-lg p-12 rounded-3xl border-2 border-fuchsia-500/30">
          <h1 className="text-7xl font-black text-center mb-8 text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-500 to-purple-600">
            {pub.name || "KARAOKE NIGHT"}
          </h1>
          <div className="flex justify-center mb-12">
            <QRCodeSVG value={`${window.location.origin}/join/${pub.code}`} size={300} bgColor="white" fgColor="black" level="H" />
          </div>
          <p className="text-4xl text-center text-white font-bold">
            Inquadra il QR per partecipare!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden relative bg-black">
      {mainContent}

      {/* Ticker (hide during quiz) */}
      {(!quizSession || quizSession.state === 'idle') && ticker && (
        <div className="absolute bottom-0 left-0 right-0 bg-black/80 backdrop-blur-sm py-4 z-30 overflow-hidden">
          <div className="ticker-content text-white text-2xl font-bold whitespace-nowrap animate-ticker">
            {ticker}
          </div>
        </div>
      )}

      {/* Floating reactions */}
      {floatingReactions.map(reaction => (
        <div key={reaction.id} className="absolute z-50 text-8xl animate-float-up pointer-events-none" style={{ left: `${reaction.x}%`, bottom: `${reaction.y}%` }}>
          {reaction.emoji}
        </div>
      ))}

      {/* Flash messages */}
      {flashMessages.map(msg => (
        <div key={msg.id} className="absolute top-1/3 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 animate-flash-message">
          <div className="bg-cyan-600 text-white px-12 py-6 rounded-3xl text-4xl font-bold shadow-[0_0_40px_rgba(6,182,212,0.6)] border-4 border-cyan-400 flex items-center gap-4">
            <MessageSquare className="w-12 h-12" />
            <span>{msg.text}</span>
          </div>
        </div>
      ))}
    </div>
  );
}