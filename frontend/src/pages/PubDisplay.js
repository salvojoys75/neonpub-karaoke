"import { useState, useEffect, useCallback, useRef } from \"react\";
import { useParams } from \"react-router-dom\";
import { QRCodeSVG } from \"qrcode.react\";
import { Mic2, Trophy, Star, MessageSquare, Crown, Sparkles, Zap, Music2, Film, Award } from \"lucide-react\";
import api from \"@/lib/api\";
import { supabase } from \"@/lib/supabase\";
import QuizMediaFixed from \"@/components/QuizMediaFixed\";

const getYoutubeId = (url) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
};

window.karaokePlayerRef = null;

const KaraokeScreen = ({ performance, isVoting, voteResult }) => {
    const playerRef = useRef(null);
    const prevVideoIdRef = useRef(null);
    const prevStartedAtRef = useRef(null);
    const isPlayerReadyRef = useRef(false);

    useEffect(() => {
        if (!performance?.youtube_url) return;
        if (isVoting || voteResult) {
            const el = document.getElementById('karaoke-player');
            if (el) el.style.visibility = 'hidden';
            if (playerRef.current && typeof playerRef.current.pauseVideo === 'function') {
                playerRef.current.pauseVideo();
            }
            return;
        }

        const videoId = getYoutubeId(performance.youtube_url);
        if (!videoId) return;

        const el = document.getElementById('karaoke-player');
        if (el) el.style.visibility = 'visible';

        const loadYouTubeAPI = () => {
            return new Promise((resolve) => {
                if (window.YT && window.YT.Player) { resolve(); return; }
                if (!document.querySelector('script[src*=\"youtube.com/iframe_api\"]')) {
                    const tag = document.createElement('script');
                    tag.src = 'https://www.youtube.com/iframe_api';
                    document.head.appendChild(tag);
                }
                const checkYT = setInterval(() => {
                    if (window.YT && window.YT.Player) { clearInterval(checkYT); resolve(); }
                }, 100);
            });
        };

        const createOrUpdatePlayer = async () => {
            await loadYouTubeAPI();

            if (prevVideoIdRef.current === videoId && playerRef.current && isPlayerReadyRef.current) {
                if (performance.started_at !== prevStartedAtRef.current) {
                    prevStartedAtRef.current = performance.started_at;
                    playerRef.current.seekTo(0);
                    playerRef.current.playVideo();
                    return;
                }
                if (performance.status === 'live') playerRef.current.playVideo();
                else if (performance.status === 'paused') playerRef.current.pauseVideo();
                return;
            }

            prevVideoIdRef.current = videoId;
            prevStartedAtRef.current = performance.started_at;
            isPlayerReadyRef.current = false;

            if (playerRef.current) {
                try { playerRef.current.destroy(); } catch (e) {}
                playerRef.current = null;
                window.karaokePlayerRef = null;
            }

            const container = document.getElementById('karaoke-player');
            if (!container) return;

            playerRef.current = new window.YT.Player('karaoke-player', {
                videoId: videoId,
                playerVars: {
                    autoplay: 1, controls: 0, disablekb: 1, fs: 0, iv_load_policy: 3,
                    modestbranding: 1, rel: 0, showinfo: 0, playsinline: 1, origin: window.location.origin
                },
                events: {
                    onReady: (event) => {
                        isPlayerReadyRef.current = true;
                        window.karaokePlayerRef = playerRef.current;
                        event.target.setVolume(100);
                        if (performance.status === 'live') event.target.playVideo();
                        else event.target.pauseVideo();
                    }
                }
            });
        };

        createOrUpdatePlayer();
    }, [performance, isVoting, voteResult]);

    useEffect(() => {
        return () => {
            if (playerRef.current) {
                try { playerRef.current.destroy(); } catch (e) {}
                playerRef.current = null;
                window.karaokePlayerRef = null;
            }
        };
    }, []);

    if (isVoting) {
        return (
            <div className=\"absolute inset-0 flex flex-col items-center justify-center overflow-hidden\">
                <div className=\"absolute inset-0 bg-gradient-to-br from-amber-900 via-orange-900 to-red-900\">
                    <div className=\"absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(251,191,36,0.3),transparent_70%)] animate-pulse\" />
                </div>
                <div className=\"relative z-10 text-center\">
                    <div className=\"mb-8\">
                        <h2 className=\"text-[8rem] font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-orange-400 to-yellow-300 animate-pulse leading-none tracking-tighter\">
                            VOTA!
                        </h2>
                    </div>
                    <div className=\"relative\">
                        <div className=\"absolute inset-0 bg-yellow-500/20 rounded-full blur-3xl scale-150 animate-pulse\" />
                        <div className=\"relative bg-gradient-to-br from-yellow-500 to-orange-600 p-12 rounded-full border-8 border-yellow-300 shadow-[0_0_100px_rgba(234,179,8,0.6)]\">
                            <Star className=\"w-40 h-40 text-white fill-white drop-shadow-2xl\" />
                        </div>
                    </div>
                    <p className=\"mt-8 text-4xl font-bold text-yellow-200\">
                        Vota <span className=\"text-white\">{performance?.user_nickname}</span>
                    </p>
                </div>
            </div>
        );
    }

    if (voteResult !== null) {
        const score = Number(voteResult).toFixed(1);
        return (
            <div className=\"absolute inset-0 flex flex-col items-center justify-center overflow-hidden\">
                <div className=\"absolute inset-0 bg-gradient-to-br from-purple-900 via-indigo-900 to-black\">
                    <div className=\"absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(139,92,246,0.4),transparent_60%)]\" />
                </div>
                <div className=\"relative z-10 text-center\">
                    <Crown className=\"w-24 h-24 text-yellow-400 mx-auto mb-4 animate-bounce\" />
                    <h2 className=\"text-5xl font-bold text-white mb-8 tracking-wider\">PUNTEGGIO</h2>
                    <div className=\"relative\">
                        <div className=\"absolute inset-0 bg-gradient-to-r from-yellow-400 to-orange-500 blur-3xl opacity-50 scale-150\" />
                        <div className=\"relative bg-black/40 backdrop-blur-xl border-4 border-yellow-500/50 rounded-3xl px-20 py-12\">
                            <div className=\"flex items-center justify-center gap-6\">
                                <Star className=\"w-20 h-20 text-yellow-400 fill-yellow-400 animate-pulse\" />
                                <span className=\"text-[10rem] font-black text-white leading-none\">
                                    {score}
                                </span>
                            </div>
                        </div>
                    </div>
                    <p className=\"mt-8 text-3xl text-purple-200 font-medium\">{performance?.user_nickname}</p>
                </div>
            </div>
        );
    }

    return (
        <div className=\"absolute inset-0 bg-black flex flex-col justify-center overflow-hidden\">
            <div id=\"karaoke-player\" className=\"absolute inset-0 w-full h-full z-0 pointer-events-none\" />
            <div className=\"absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/80 to-transparent p-8 z-10 pb-16\">
                <div className=\"flex items-end justify-between\">
                    <div>
                        <h2 className=\"text-5xl font-black text-white mb-2 drop-shadow-2xl\">{performance.song_title}</h2>
                        <p className=\"text-3xl text-zinc-300 font-medium\">{performance.song_artist}</p>
                    </div>
                    <div className=\"bg-gradient-to-r from-fuchsia-600 to-pink-600 px-8 py-4 rounded-2xl flex items-center gap-4 shadow-2xl shadow-fuchsia-500/30 animate-pulse\">
                        <Mic2 className=\"w-10 h-10\" />
                        <span className=\"text-3xl font-bold uppercase tracking-wider\">{performance.user_nickname}</span>
                    </div>
                </div>
            </div>
            <div className=\"absolute top-6 left-6 z-10\">
                <div className=\"bg-red-600 px-6 py-2 rounded-full flex items-center gap-2 animate-pulse shadow-lg shadow-red-500/50\">
                    <div className=\"w-3 h-3 bg-white rounded-full animate-ping\" />
                    <span className=\"text-lg font-bold tracking-widest\">LIVE</span>
                </div>
            </div>
        </div>
    );
};

const QuizScreen = ({ quiz, quizResults, leaderboard }) => {
    const quizIdRef = useRef(null);
    if (quiz && quiz.id !== quizIdRef.current) {
        quizIdRef.current = quiz.id;
    }

    if (quiz.status === 'leaderboard') {
        return (
            <div className=\"absolute inset-0 overflow-hidden\">
                <div className=\"absolute inset-0 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900\">
                    <div className=\"absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(251,191,36,0.15),transparent_50%)]\" />
                </div>
                <div className=\"relative z-10 flex flex-col h-full p-8\">
                    <div className=\"text-center mb-8\">
                        <div className=\"inline-flex items-center gap-4 bg-gradient-to-r from-yellow-600/20 via-yellow-500/30 to-yellow-600/20 px-12 py-4 rounded-full border border-yellow-500/30 mb-4\">
                            <Trophy className=\"w-10 h-10 text-yellow-400\" />
                            <h1 className=\"text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-amber-500 uppercase tracking-widest\">
                                Classifica
                            </h1>
                            <Trophy className=\"w-10 h-10 text-yellow-400\" />
                        </div>
                    </div>
                    <div className=\"flex-1 overflow-hidden\">
                        <div className=\"grid grid-cols-2 gap-x-8 gap-y-3 px-8 h-full overflow-y-auto custom-scrollbar content-start\">
                            {leaderboard.map((p, i) => (
                                <div key={p.id} 
                                    className={`flex items-center p-4 rounded-2xl transition-all transform hover:scale-[1.02] ${
                                        i === 0 ? 'bg-gradient-to-r from-yellow-600/40 to-amber-600/20 border-2 border-yellow-500 shadow-lg shadow-yellow-500/20' :
                                        i === 1 ? 'bg-gradient-to-r from-slate-400/30 to-slate-500/10 border border-slate-400/50' :
                                        i === 2 ? 'bg-gradient-to-r from-amber-700/30 to-orange-600/10 border border-amber-600/50' :
                                        'bg-white/5 border border-white/10'
                                    }`}
                                >
                                    <span className={`w-14 h-14 flex items-center justify-center rounded-full mr-4 text-2xl font-black ${
                                        i === 0 ? 'bg-gradient-to-br from-yellow-400 to-amber-600 text-black shadow-lg' :
                                        i === 1 ? 'bg-gradient-to-br from-slate-300 to-slate-500 text-black' :
                                        i === 2 ? 'bg-gradient-to-br from-amber-600 to-orange-700 text-white' :
                                        'bg-zinc-800 text-zinc-400'
                                    }`}>
                                        {i === 0 ? <Crown className=\"w-7 h-7\" /> : i + 1}
                                    </span>
                                    <span className={`flex-1 text-2xl font-bold truncate ${i < 3 ? 'text-white' : 'text-zinc-300'}`}>
                                        {p.nickname}
                                    </span>
                                    <span className={`text-3xl font-black font-mono ${
                                        i === 0 ? 'text-yellow-400' : i < 3 ? 'text-amber-400' : 'text-cyan-400'
                                    }`}>
                                        {p.score}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className=\"absolute inset-0 overflow-hidden\">
            <div className=\"absolute inset-0 bg-gradient-to-b from-indigo-950 via-purple-900 to-black\">
                <div className=\"absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(139,92,246,0.3),transparent_50%)]\" />
            </div>
            
            {quiz.media_url && quiz.media_type !== 'text' && (
                <QuizMediaFixed 
                    key={`quiz-media-${quizIdRef.current}`}
                    mediaUrl={quiz.media_url} 
                    mediaType={quiz.media_type} 
                    isResult={!!quizResults} 
                />
            )}

            <div className=\"absolute inset-0 z-10 flex flex-col\">
                <div className=\"p-6\">
                    <div className=\"flex justify-between items-center\">
                        <div className=\"flex items-center gap-3\">
                            {quiz.media_type === 'audio' && <Music2 className=\"w-8 h-8 text-yellow-400\" />}
                            {quiz.media_type === 'video' && <Film className=\"w-8 h-8 text-blue-400\" />}
                            <span className=\"text-2xl font-bold text-white/80 uppercase tracking-wider\">
                                {quiz.category || 'Quiz'}
                            </span>
                        </div>
                        <div className=\"flex items-center gap-2 bg-gradient-to-r from-yellow-600 to-amber-600 px-6 py-2 rounded-full shadow-lg shadow-yellow-500/30\">
                            <Zap className=\"w-6 h-6 text-white\" />
                            <span className=\"text-2xl font-black text-white\">{quiz.points || 10} PT</span>
                        </div>
                    </div>
                </div>
                
                <div className=\"px-6 mb-4\">
                    <div className={`inline-flex items-center gap-3 px-8 py-3 rounded-full text-2xl font-black uppercase tracking-widest ${
                        quiz.status === 'closed' 
                            ? 'bg-red-600 text-white shadow-lg shadow-red-500/50' 
                            : 'bg-fuchsia-600 text-white shadow-lg shadow-fuchsia-500/50 animate-pulse'
                    }`}>
                        <Sparkles className=\"w-6 h-6\" />
                        {quiz.status === 'closed' ? \"STOP TELEVOTO!\" : \"RISPONDI ORA\"}
                    </div>
                </div>

                <div className=\"flex-1 flex items-center justify-center p-6\">
                    <div className=\"w-full max-w-6xl\">
                        {!quizResults ? (
                            <>
                                <div className=\"mb-10\">
                                    <div className=\"bg-black/60 backdrop-blur-xl border-2 border-white/20 rounded-3xl p-8 shadow-2xl\">
                                        <h2 className=\"text-5xl font-black text-white text-center leading-tight\">
                                            {quiz.question}
                                        </h2>
                                    </div>
                                </div>
                                
                                <div className=\"grid grid-cols-2 gap-6\">
                                    {quiz.options.map((opt, i) => {
                                        const colors = [
                                            'from-blue-600 to-blue-800 border-blue-400',
                                            'from-orange-600 to-orange-800 border-orange-400',
                                            'from-green-600 to-green-800 border-green-400',
                                            'from-pink-600 to-pink-800 border-pink-400'
                                        ];
                                        return (
                                            <div key={i} 
                                                className={`relative overflow-hidden rounded-2xl border-2 transition-all ${
                                                    quiz.status === 'closed' 
                                                        ? 'opacity-60 border-zinc-700' 
                                                        : colors[i].split(' ')[2] + ' hover:scale-[1.02]'
                                                }`}
                                            >
                                                <div className={`bg-gradient-to-r ${quiz.status === 'closed' ? 'from-zinc-800 to-zinc-900' : colors[i].split(' ').slice(0,2).join(' ')} p-6`}>
                                                    <div className=\"flex items-center gap-4\">
                                                        <span className=\"w-12 h-12 rounded-full bg-black/30 flex items-center justify-center text-2xl font-black text-white border-2 border-white/30\">
                                                            {String.fromCharCode(65 + i)}
                                                        </span>
                                                        <span className=\"text-3xl font-bold text-white flex-1\">{opt}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </>
                        ) : (
                            <div className=\"text-center animate-zoom-in\">
                                <div className=\"bg-black/70 backdrop-blur-xl rounded-[3rem] p-12 border-2 border-green-500/50 shadow-2xl shadow-green-500/20\">
                                    <Award className=\"w-32 h-32 text-green-400 mx-auto mb-6 animate-bounce\" />
                                    <h2 className=\"text-5xl font-black text-white mb-8\">RISPOSTA CORRETTA</h2>
                                    
                                    <div className=\"bg-gradient-to-r from-green-600 to-emerald-600 text-white px-12 py-8 rounded-3xl mb-10 inline-block shadow-lg shadow-green-500/30\">
                                        <p className=\"text-5xl font-black\">{quizResults.correct_option}</p>
                                    </div>
                                    
                                    <div className=\"grid grid-cols-2 gap-8 max-w-xl mx-auto mb-8\">
                                        <div className=\"bg-white/10 rounded-2xl p-6\">
                                            <p className=\"text-5xl font-black text-green-400\">{quizResults.correct_count}</p>
                                            <p className=\"text-lg text-zinc-400\">Risposte esatte</p>
                                        </div>
                                        <div className=\"bg-white/10 rounded-2xl p-6\">
                                            <p className=\"text-5xl font-black text-cyan-400\">{quizResults.total_answers}</p>
                                            <p className=\"text-lg text-zinc-400\">Partecipanti</p>
                                        </div>
                                    </div>
                                    
                                    {quizResults.winners?.length > 0 && (
                                        <div>
                                            <p className=\"text-xl text-green-300 uppercase tracking-widest mb-4\">I Piu Veloci</p>
                                            <p className=\"text-3xl text-white font-bold\">
                                                {quizResults.winners.slice(0, 5).join(' - ')}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default function PubDisplay() {
  const { pubCode } = useParams();
  const [displayData, setDisplayData] = useState(null);
  const [ticker, setTicker] = useState(\"\");
  const [floatingReactions, setFloatingReactions] = useState([]);
  const [flashMessages, setFlashMessages] = useState([]);
  const [quizResults, setQuizResults] = useState(null);
  const [voteResult, setVoteResult] = useState(null);
  const lastQuizIdRef = useRef(null);

  const loadDisplayData = useCallback(async () => {
    try {
      const { data } = await api.getDisplayData(pubCode);
      setDisplayData(data);

      if (data?.queue?.length > 0) {
        setTicker(data.queue.slice(0, 5).map((s, i) => (i + 1) + \". \" + s.title + \" (\" + s.user_nickname + \")\").join(' - '));
      } else {
        setTicker(\"Inquadra il QR Code per partecipare!\");
      }

      if (data?.current_performance?.status === 'ended' && !voteResult && data.current_performance.average_score > 0) {
         setVoteResult(data.current_performance.average_score);
         setTimeout(() => setVoteResult(null), 10000);
      }
    } catch (error) { console.error(error); }
  }, [pubCode, voteResult]);

  useEffect(() => {
    loadDisplayData();
    const interval = setInterval(loadDisplayData, 5000);
    return () => clearInterval(interval);
  }, [loadDisplayData]);

  useEffect(() => {
    if (!displayData?.pub?.id) return;

    const controlChannel = supabase.channel('display_control_' + pubCode)
        .on('broadcast', { event: 'control' }, (payload) => {
            if(payload.payload.command === 'mute') {
                const shouldMute = payload.payload.value;
                console.log('[Display] Comando MUTE ricevuto:', shouldMute);
                
                if (window.karaokePlayerRef && typeof window.karaokePlayerRef.mute === 'function') {
                    if (shouldMute) {
                        window.karaokePlayerRef.mute();
                    } else {
                        window.karaokePlayerRef.unMute();
                    }
                }
                
                if (window.quizPlayerRef && typeof window.quizPlayerRef.mute === 'function') {
                    if (shouldMute) {
                        window.quizPlayerRef.mute();
                    } else {
                        window.quizPlayerRef.unMute();
                    }
                }
            }
        })
        .subscribe();

    const channel = supabase.channel('display_realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'performances', filter: 'event_id=eq.' + displayData.pub.id },
            (payload) => {
                setDisplayData(prev => ({ ...prev, current_performance: payload.new }));
                if (payload.new.status === 'voting' || payload.new.status === 'ended') loadDisplayData();
            }
        )
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reactions', filter: 'event_id=eq.' + displayData.pub.id },
            (payload) => addFloatingReaction(payload.new.emoji, payload.new.nickname)
        )
        .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: 'event_id=eq.' + displayData.pub.id },
            async (payload) => {
                 if(payload.new.status === 'approved') {
                     let nick = \"Regia\";
                     if(payload.new.participant_id) {
                         const { data } = await supabase.from('participants').select('nickname').eq('id', payload.new.participant_id).single();
                         if(data) nick = data.nickname;
                     }
                     showFlashMessage({ text: payload.new.text, nickname: nick });
                 }
            }
        )
        .on('postgres_changes', { event: '*', schema: 'public', table: 'quizzes', filter: 'event_id=eq.' + displayData.pub.id },
            async (payload) => {
                const updatedQuiz = payload.new;
                setDisplayData(prev => ({ ...prev, active_quiz: updatedQuiz }));

                if (updatedQuiz.status === 'active' || updatedQuiz.status === 'closed') {
                    if (updatedQuiz.id !== lastQuizIdRef.current) {
                        lastQuizIdRef.current = updatedQuiz.id;
                        setQuizResults(null);
                    }
                } else if (updatedQuiz.status === 'showing_results') {
                    const res = await api.getQuizResults(updatedQuiz.id);
                    setQuizResults(res.data);
                } else if (updatedQuiz.status === 'ended') {
                    setTimeout(() => {
                        setDisplayData(prev => ({ ...prev, active_quiz: null }));
                        setQuizResults(null);
                        lastQuizIdRef.current = null;
                    }, 5000);
                }
            }
        )
        .subscribe();

    return () => {
        supabase.removeChannel(channel);
        supabase.removeChannel(controlChannel);
    }
  }, [displayData?.pub?.id, pubCode, loadDisplayData]);

  const showFlashMessage = (msg) => {
    const id = Date.now();
    setFlashMessages(prev => [...prev, { ...msg, internalId: id }]);
    setTimeout(() => setFlashMessages(prev => prev.filter(m => m.internalId !== id)), 10000);
  };

  const addFloatingReaction = (emoji, nickname) => {
    const id = Date.now() + Math.random();
    const left = Math.random() * 80 + 10;
    setFloatingReactions(prev => [...prev, { id, emoji, nickname, left }]);
    setTimeout(() => setFloatingReactions(prev => prev.filter(r => r.id !== id)), 4000);
  };

  const currentPerf = displayData?.current_performance;
  const activeQuiz = displayData?.active_quiz;
  const joinUrl = window.location.origin + \"/join/\" + pubCode;

  let ScreenComponent = null;
  const isLeaderboardMode = activeQuiz && activeQuiz.status === 'leaderboard';

  if (activeQuiz && activeQuiz.status !== 'ended') {
      ScreenComponent = <QuizScreen quiz={activeQuiz} quizResults={quizResults} leaderboard={displayData?.leaderboard || []} />;
  } else if (currentPerf && (currentPerf.status === 'live' || currentPerf.status === 'paused' || currentPerf.status === 'voting' || voteResult)) {
      ScreenComponent = <KaraokeScreen performance={currentPerf} isVoting={currentPerf.status === 'voting'} voteResult={voteResult} />;
  } else {
      ScreenComponent = (
         <div className=\"absolute inset-0 flex flex-col items-center justify-center overflow-hidden\">
            <div className=\"absolute inset-0 bg-gradient-to-br from-purple-900 via-indigo-900 to-black\">
                <div className=\"absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(139,92,246,0.3),transparent_40%)]\" />
                <div className=\"absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(236,72,153,0.2),transparent_40%)]\" />
            </div>
            <div className=\"relative z-10 text-center\">
                <h2 className=\"text-6xl font-black text-white mb-6\">PROSSIMO CANTANTE...</h2>
                <h1 className=\"text-[10rem] font-black text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 via-pink-500 to-cyan-400 leading-none mb-8\">
                    TU?
                </h1>
                <div className=\"bg-white p-6 rounded-3xl shadow-2xl shadow-white/20 inline-block\">
                    <QRCodeSVG value={joinUrl} size={250} />
                </div>
                <p className=\"text-4xl text-zinc-400 mt-8 font-mono tracking-[0.3em]\">{pubCode}</p>
            </div>
         </div>
      );
  }

  return (
    <div className=\"h-screen bg-black text-white overflow-hidden flex flex-col font-sans\">
      <div className=\"h-14 bg-zinc-900/95 backdrop-blur-sm flex items-center px-6 border-b border-zinc-800 z-50 relative shadow-xl\">
         <div className=\"font-bold text-xl mr-8 text-fuchsia-400\">{displayData?.pub?.name || \"NEONPUB\"}</div>
         <div className=\"flex-1 overflow-hidden relative h-full flex items-center\">
            <div className=\"ticker-container w-full\">
                <div className=\"ticker-content text-lg font-medium text-cyan-300\">{ticker}</div>
            </div>
         </div>
      </div>

      <div className=\"flex-1 flex overflow-hidden relative\">
        <div className=\"flex-1 relative bg-black flex flex-col justify-center overflow-hidden\">
           {ScreenComponent}
        </div>

        {!isLeaderboardMode && (
            <div className=\"w-[320px] bg-zinc-900/95 backdrop-blur-sm border-l border-zinc-800 flex flex-col z-30 shadow-2xl relative\">
                <div className=\"p-5 flex flex-col items-center bg-gradient-to-b from-white/5 to-transparent border-b border-white/10\">
                    <div className=\"bg-white p-3 rounded-xl mb-3 shadow-lg\">
                        <QRCodeSVG value={joinUrl} size={130} />
                    </div>
                    <p className=\"font-mono text-2xl font-bold text-cyan-400 tracking-widest\">{pubCode}</p>
                </div>

                <div className=\"flex-1 flex flex-col p-6 items-center justify-center text-center\">
                    {displayData?.pub?.logo_url ? (
                        <img src={displayData.pub.logo_url} alt=\"Logo\" className=\"w-32 h-32 object-contain drop-shadow-2xl mb-4\"/>
                    ) : (
                        <div className=\"w-32 h-32 bg-zinc-800 rounded-full flex items-center justify-center text-zinc-600 text-3xl font-bold border-4 border-zinc-700 mb-4\">
                            LOGO
                        </div>
                    )}
                    <h2 className=\"text-2xl font-black text-white uppercase tracking-wider\">{displayData?.pub?.name || \"NEONPUB\"}</h2>
                </div>

                <div className=\"h-[35%] border-t border-white/10 p-4 bg-gradient-to-b from-zinc-900 to-black\">
                    <h3 className=\"text-sm font-bold text-yellow-500 mb-3 flex items-center gap-2 uppercase tracking-wider\">
                        <Trophy className=\"w-4 h-4\"/> Top Player
                    </h3>
                    <div className=\"space-y-2 overflow-y-auto custom-scrollbar h-[calc(100%-2rem)]\">
                        {(displayData?.leaderboard || []).slice(0, 5).map((p, i) => (
                            <div key={p.id} className={\"flex justify-between items-center p-2 rounded-lg \" + (i===0 ? 'bg-yellow-500/20 border border-yellow-500/30' : 'bg-white/5')}>
                                <div className=\"flex items-center gap-2\">
                                    <span className={\"font-bold w-6 h-6 flex items-center justify-center rounded-full text-xs \" + (i===0 ? 'bg-yellow-500 text-black' : 'bg-zinc-800 text-zinc-400')}>
                                        {i+1}
                                    </span>
                                    <span className={\"font-medium text-sm truncate \" + (i===0 ? 'text-white' : 'text-zinc-300')}>{p.nickname}</span>
                                </div>
                                <span className=\"text-cyan-400 font-mono font-bold text-sm\">{p.score}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )}
      </div>

      <div className=\"reactions-overlay pointer-events-none fixed inset-0 z-[100] overflow-hidden\">
        {floatingReactions.map(r => (
            <div key={r.id} className=\"absolute flex flex-col items-center animate-float-up\" style={{ left: r.left + '%', bottom: '-50px' }}>
              <span className=\"text-7xl filter drop-shadow-2xl\">{r.emoji}</span>
              <span className=\"text-lg text-white font-bold mt-1 bg-black/70 px-3 py-1 rounded-full border border-white/20 shadow-xl\">{r.nickname}</span>
            </div>
        ))}
      </div>

      {flashMessages.length > 0 && (
        <div className=\"fixed top-20 left-6 z-[110] w-2/3 max-w-3xl flex flex-col gap-3\">
          {flashMessages.map(msg => (
            <div key={msg.internalId} className=\"bg-black/90 backdrop-blur-xl border-l-8 border-cyan-500 text-white p-5 rounded-r-2xl shadow-2xl animate-slide-in-left flex items-start gap-4\">
              <div className=\"bg-cyan-500/20 p-3 rounded-full\">
                <MessageSquare className=\"w-8 h-8 text-cyan-400\" />
              </div>
              <div>
                <p className=\"text-xs text-cyan-400 font-bold uppercase tracking-widest mb-1\">
                    {msg.nickname === 'Regia' ? 'MESSAGGIO DALLA REGIA' : 'Messaggio da ' + msg.nickname}
                </p>
                <p className=\"text-3xl font-bold leading-tight\">{msg.text}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`
        .ticker-container { width: 100%; overflow: hidden; }
        .ticker-content { display: inline-block; white-space: nowrap; animation: ticker 25s linear infinite; }
        @keyframes ticker { 0% { transform: translateX(100%); } 100% { transform: translateX(-100%); } }
        .animate-float-up { animation: floatUp 4s ease-out forwards; }
        @keyframes floatUp { 
            0% { transform: translateY(0) scale(0.5); opacity: 0; } 
            10% { opacity: 1; } 
            90% { opacity: 1; } 
            100% { transform: translateY(-85vh) scale(1.3); opacity: 0; } 
        }
        .animate-slide-in-left { animation: slideInLeft 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
        @keyframes slideInLeft { from { transform: translateX(-100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        .animate-zoom-in { animation: zoomIn 0.5s ease-out; }
        @keyframes zoomIn { from { transform: scale(0.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #444; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
      `}</style>
    </div>
  );
}
"