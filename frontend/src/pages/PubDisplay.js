import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '@/lib/supabase';
import api from '@/lib/api';
import { Music, Trophy, Mic2, Crown, Star, Sparkles, Volume2, VolumeX, MessageSquare, Users, Zap } from 'lucide-react';
import QuizMediaFixed from '@/components/QuizMediaFixed';
import FloatingReactions from '@/components/FloatingReactions';

// ====================================================
// CSS ANIMATIONS
// ====================================================
const DISPLAY_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=Space+Mono:wght@400;700&display=swap');

  .display-root {
    font-family: 'Outfit', sans-serif;
    overflow: hidden;
  }
  .display-root .mono {
    font-family: 'Space Mono', monospace;
  }

  @keyframes msg-in-out {
    0% { transform: translateY(-100%); opacity: 0; }
    8% { transform: translateY(0); opacity: 1; }
    85% { transform: translateY(0); opacity: 1; }
    100% { transform: translateY(-100%); opacity: 0; }
  }
  .animate-msg {
    animation: msg-in-out 8s ease-in-out forwards;
  }

  @keyframes neon-pulse {
    0%, 100% { box-shadow: 0 0 5px rgba(168,85,247,0.4), 0 0 20px rgba(168,85,247,0.1); }
    50% { box-shadow: 0 0 15px rgba(168,85,247,0.6), 0 0 40px rgba(168,85,247,0.2); }
  }
  .neon-glow { animation: neon-pulse 3s ease-in-out infinite; }

  @keyframes live-blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }
  .live-dot { animation: live-blink 1.2s ease-in-out infinite; }

  @keyframes score-pop {
    0% { transform: scale(0.8); opacity: 0; }
    50% { transform: scale(1.1); }
    100% { transform: scale(1); opacity: 1; }
  }
  .score-pop { animation: score-pop 0.4s ease-out forwards; }

  @keyframes slide-in-right {
    0% { transform: translateX(100%); opacity: 0; }
    100% { transform: translateX(0); opacity: 1; }
  }
  .slide-in-right { animation: slide-in-right 0.5s ease-out forwards; }

  @keyframes idle-float {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-10px); }
  }
  .idle-float { animation: idle-float 4s ease-in-out infinite; }
`;

// ====================================================
// KARAOKE SCREEN
// ====================================================
const KaraokeScreen = memo(({ performance, isVoting, voteResult, isMuted }) => {
  const playerRef = useRef(null);
  const prevVideoIdRef = useRef(null);
  const prevStartedAtRef = useRef(null);
  const isPlayerReadyRef = useRef(false);

  const getYoutubeId = (url) => {
    if (!url) return null;
    const match = url.match(/^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  // Mute/unmute separato
  useEffect(() => {
    if (!playerRef.current || !isPlayerReadyRef.current) return;
    try {
      if (isMuted) { playerRef.current.mute(); }
      else { playerRef.current.unMute(); playerRef.current.setVolume(100); }
    } catch (e) {}
  }, [isMuted]);

  useEffect(() => {
    if (!performance?.youtube_url) return;
    const videoId = getYoutubeId(performance.youtube_url);
    if (!videoId) return;

    const loadYouTubeAPI = () => new Promise((resolve) => {
      if (window.YT && window.YT.Player) { resolve(); return; }
      if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(tag);
      }
      const checkYT = setInterval(() => {
        if (window.YT && window.YT.Player) { clearInterval(checkYT); resolve(); }
      }, 100);
    });

    const createPlayer = async () => {
      await loadYouTubeAPI();

      if (prevVideoIdRef.current === videoId && playerRef.current && isPlayerReadyRef.current) {
        if (performance.started_at !== prevStartedAtRef.current) {
          prevStartedAtRef.current = performance.started_at;
          playerRef.current.seekTo(0);
          playerRef.current.playVideo();
        }
        if (isVoting || voteResult) { playerRef.current.pauseVideo(); }
        else if (performance.status === 'live') { playerRef.current.playVideo(); }
        else if (performance.status === 'paused') { playerRef.current.pauseVideo(); }
        return;
      }

      prevVideoIdRef.current = videoId;
      prevStartedAtRef.current = performance.started_at;
      isPlayerReadyRef.current = false;
      if (playerRef.current) { try { playerRef.current.destroy(); } catch (e) {} playerRef.current = null; }

      const container = document.getElementById('karaoke-player');
      if (!container) return;

      playerRef.current = new window.YT.Player('karaoke-player', {
        videoId, playerVars: {
          autoplay: 1, controls: 0, disablekb: 1, fs: 0, iv_load_policy: 3,
          modestbranding: 1, rel: 0, showinfo: 0, playsinline: 1, origin: window.location.origin
        },
        events: {
          onReady: (event) => {
            isPlayerReadyRef.current = true;
            event.target.setVolume(100);
            if (isMuted) event.target.mute();
            if (performance.status === 'live' && !isVoting && !voteResult) event.target.playVideo();
            else event.target.pauseVideo();
          },
          onStateChange: () => {}
        }
      });
    };

    createPlayer();
    return () => {};
  }, [performance, isVoting, voteResult]);

  useEffect(() => () => {
    if (playerRef.current) { try { playerRef.current.destroy(); } catch (e) {} playerRef.current = null; }
    prevVideoIdRef.current = null; isPlayerReadyRef.current = false;
  }, []);

  if (isVoting || voteResult) {
    return (
      <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #1a0533 0%, #0a0a0a 40%, #33051a 100%)' }}>
        <div className="text-center score-pop">
          {voteResult ? (
            <>
              <div className="relative inline-block mb-6">
                <Crown className="w-24 h-24 text-yellow-400 mx-auto" />
                <div className="absolute inset-0 bg-yellow-400/20 rounded-full blur-3xl" />
              </div>
              <h2 className="text-3xl font-semibold text-white/80 mb-4 tracking-wide">PUNTEGGIO</h2>
              <p className="text-8xl font-black text-yellow-400 mb-4" style={{ textShadow: '0 0 40px rgba(250,204,21,0.4)' }}>{voteResult.toFixed(1)}</p>
              <div className="flex items-center justify-center gap-2 mt-4">
                <Mic2 className="w-5 h-5 text-purple-400" />
                <p className="text-2xl text-purple-300 font-medium">{performance?.user_nickname}</p>
              </div>
            </>
          ) : (
            <>
              <div className="relative inline-block mb-6">
                <Star className="w-20 h-20 text-yellow-400 mx-auto animate-pulse" />
                <div className="absolute inset-0 bg-yellow-400/20 rounded-full blur-3xl animate-pulse" />
              </div>
              <h2 className="text-4xl font-bold text-white mb-3">VOTA ORA!</h2>
              <p className="text-xl text-purple-300 font-medium">{performance?.user_nickname}</p>
              <p className="text-sm text-white/40 mt-4 mono tracking-wider">USA IL TUO TELEFONO</p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 bg-black">
      <div className="absolute inset-0 overflow-hidden">
        <div id="karaoke-player" className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" style={{ width: '110%', height: '110%' }} />
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30 pointer-events-none" />
      <div className="absolute bottom-0 left-0 right-0 p-5 z-10">
        <div className="flex items-center gap-4 bg-black/60 backdrop-blur-md rounded-2xl px-5 py-3 border border-white/10 max-w-xl">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-fuchsia-500 to-pink-500 flex items-center justify-center flex-shrink-0">
            <Mic2 className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-bold text-white truncate">{performance?.song_title}</h3>
            <p className="text-sm text-white/60 truncate">{performance?.song_artist} &middot; <span className="text-fuchsia-400">{performance?.user_nickname}</span></p>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-red-500 live-dot" />
            <span className="text-xs mono text-red-400 font-bold">LIVE</span>
          </div>
        </div>
      </div>
    </div>
  );
});

// ====================================================
// QUIZ MEDIA WRAPPER
// ====================================================
const QuizMediaWrapper = memo(({ mediaUrl, mediaType, isResult }) => {
  if (!mediaUrl || mediaType === 'text') return null;
  return <QuizMediaFixed mediaUrl={mediaUrl} mediaType={mediaType} isResult={isResult} />;
}, (prev, next) => prev.mediaUrl === next.mediaUrl && prev.mediaType === next.mediaType && prev.isResult === next.isResult);

// ====================================================
// QUIZ SCREEN
// ====================================================
const QuizScreen = memo(({ quizId, question, category, points, options, mediaUrl, mediaType, quizStatus, quizResults }) => {
  const isShowingResults = quizStatus === 'showing_results' || quizStatus === 'leaderboard';
  const colors = ['from-blue-500 to-cyan-500', 'from-fuchsia-500 to-pink-500', 'from-amber-500 to-orange-500', 'from-emerald-500 to-teal-500'];

  return (
    <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, #0c0520 0%, #0a0a0a 50%, #1a0a2e 100%)' }}>
      <QuizMediaWrapper mediaUrl={mediaUrl} mediaType={mediaType} isResult={isShowingResults} />
      <div className="absolute inset-0 flex flex-col z-10">
        <div className="flex items-center justify-between px-6 py-4 bg-black/50 backdrop-blur-sm border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center">
              <Zap className="w-5 h-5 text-black" />
            </div>
            <span className="text-lg font-bold text-white tracking-wide uppercase">{category || 'Quiz'}</span>
          </div>
          <div className="flex items-center gap-2 bg-yellow-500/20 border border-yellow-500/30 rounded-full px-4 py-1.5">
            <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
            <span className="text-yellow-400 font-bold mono text-sm">{points || 10} PT</span>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-5xl w-full">
            {quizResults ? (
              <div className="text-center score-pop">
                <h2 className="text-3xl font-semibold text-white/70 mb-6 tracking-wider uppercase">Risposta Corretta</h2>
                <div className="bg-emerald-500/20 border-2 border-emerald-400 rounded-2xl p-8 mb-8 inline-block mx-auto" style={{ boxShadow: '0 0 30px rgba(52,211,153,0.2)' }}>
                  <p className="text-4xl font-black text-emerald-400">{quizResults.correct_option}</p>
                </div>
                <div className="flex justify-center gap-12 text-xl mb-8">
                  <div className="text-center"><span className="text-4xl font-black text-white block">{quizResults.correct_count}</span><span className="text-sm text-white/50 uppercase tracking-wider">corrette</span></div>
                  <div className="text-center"><span className="text-4xl font-black text-white block">{quizResults.total_answers}</span><span className="text-sm text-white/50 uppercase tracking-wider">partecipanti</span></div>
                </div>
                {quizResults.winners && quizResults.winners.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm text-white/40 mb-3 uppercase tracking-wider">Vincitori</p>
                    <div className="flex flex-wrap justify-center gap-2">
                      {quizResults.winners.slice(0, 5).map((w, i) => (
                        <span key={i} className="bg-yellow-500/20 text-yellow-300 px-4 py-1.5 rounded-full text-sm font-medium border border-yellow-500/30">{w}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <>
                <h2 className="text-4xl md:text-5xl font-bold text-white text-center mb-10 leading-tight" style={{ textShadow: '0 2px 20px rgba(0,0,0,0.5)' }}>{question}</h2>
                <div className="grid grid-cols-2 gap-4">
                  {options?.map((option, index) => (
                    <div key={index} className={`bg-gradient-to-r ${colors[index % 4]} rounded-xl p-[2px]`}>
                      <div className="bg-black/80 backdrop-blur-sm rounded-[10px] p-5 h-full flex items-center gap-4">
                        <span className={`w-11 h-11 rounded-lg bg-gradient-to-br ${colors[index % 4]} flex items-center justify-center text-white font-black text-lg flex-shrink-0`}>{String.fromCharCode(65 + index)}</span>
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
}, (prev, next) => prev.quizId === next.quizId && prev.question === next.question && prev.quizStatus === next.quizStatus && prev.mediaUrl === next.mediaUrl && prev.quizResults === next.quizResults);

// ====================================================
// LEADERBOARD SCREEN
// ====================================================
const LeaderboardScreen = ({ leaderboard }) => {
  const medals = ['🥇', '🥈', '🥉'];
  return (
    <div className="absolute inset-0 p-8 flex flex-col" style={{ background: 'linear-gradient(135deg, #1a0a00 0%, #0a0a0a 50%, #1a1a00 100%)' }}>
      <div className="flex items-center justify-center gap-4 mb-8">
        <Trophy className="w-10 h-10 text-yellow-400" />
        <h2 className="text-4xl font-black text-white tracking-tight">CLASSIFICA</h2>
      </div>
      <div className="max-w-2xl mx-auto space-y-2 flex-1 overflow-hidden w-full">
        {leaderboard?.slice(0, 10).map((player, index) => (
          <div key={player.id || index}
               className={`flex items-center gap-4 p-4 rounded-xl slide-in-right ${
                 index === 0 ? 'bg-yellow-500/15 border border-yellow-500/40' :
                 index === 1 ? 'bg-gray-400/10 border border-gray-400/30' :
                 index === 2 ? 'bg-amber-600/10 border border-amber-600/30' : 'bg-white/5 border border-white/5'
               }`} style={{ animationDelay: `${index * 0.1}s` }}>
            <span className="text-2xl w-10 text-center">{index < 3 ? medals[index] : <span className="text-white/30 mono font-bold">{index + 1}</span>}</span>
            <span className="flex-1 text-xl text-white font-semibold truncate">{player.nickname}</span>
            <span className="text-2xl font-black text-yellow-400 mono">{player.score || 0}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ====================================================
// IDLE SCREEN
// ====================================================
const IdleScreen = ({ pub }) => (
  <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0c0520 0%, #050505 40%, #1a0a2e 100%)' }}>
    <div className="text-center idle-float">
      {pub.logo_url ? (
        <img src={pub.logo_url} alt={pub.name} className="w-36 h-36 mx-auto mb-8 rounded-2xl object-cover border-2 border-white/10 neon-glow" />
      ) : (
        <div className="w-36 h-36 mx-auto mb-8 rounded-2xl bg-gradient-to-br from-fuchsia-600/30 to-purple-600/30 flex items-center justify-center border border-fuchsia-500/30 neon-glow">
          <Music className="w-16 h-16 text-fuchsia-400" />
        </div>
      )}
      <h1 className="text-5xl font-black text-white mb-3 tracking-tight">{pub.name}</h1>
      <p className="text-lg text-white/30 tracking-widest uppercase mono">In attesa dello show</p>
    </div>
  </div>
);

// ====================================================
// MESSAGE TOAST - Appare in alto, scompare dopo 8s
// ====================================================
const MessageToast = memo(({ message }) => {
  const [visible, setVisible] = useState(false);
  const [currentMsg, setCurrentMsg] = useState(null);
  const timeoutRef = useRef(null);
  const lastMsgIdRef = useRef(null);

  useEffect(() => {
    if (message && message.id !== lastMsgIdRef.current) {
      lastMsgIdRef.current = message.id;
      setCurrentMsg(message);
      setVisible(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setVisible(false), 8000);
    }
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, [message]);

  if (!visible || !currentMsg) return null;

  return (
    <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 animate-msg max-w-2xl w-full px-4">
      <div className="bg-black/80 backdrop-blur-xl rounded-2xl px-6 py-4 border border-purple-500/30 flex items-start gap-3" style={{ boxShadow: '0 0 30px rgba(168,85,247,0.15)' }}>
        <MessageSquare className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
        <p className="text-white text-lg font-medium">{currentMsg.text}</p>
      </div>
    </div>
  );
});

// ====================================================
// MINI LEADERBOARD SIDEBAR
// ====================================================
const MiniLeaderboard = memo(({ leaderboard }) => {
  if (!leaderboard || leaderboard.length === 0) return null;
  return (
    <div className="absolute top-20 right-4 z-30 w-52">
      <div className="bg-black/70 backdrop-blur-md rounded-xl border border-white/10 overflow-hidden">
        <div className="px-3 py-2 border-b border-white/10 flex items-center gap-2">
          <Trophy className="w-3.5 h-3.5 text-yellow-400" />
          <span className="text-xs font-bold text-white/70 uppercase tracking-wider">Top 5</span>
        </div>
        <div className="p-2 space-y-1">
          {leaderboard.slice(0, 5).map((player, index) => (
            <div key={player.id || index} className="flex items-center gap-2 px-2 py-1 rounded-lg">
              <span className={`text-xs font-bold w-5 text-center mono ${index === 0 ? 'text-yellow-400' : index === 1 ? 'text-gray-400' : index === 2 ? 'text-amber-600' : 'text-white/30'}`}>{index + 1}</span>
              <span className="text-sm text-white/80 flex-1 truncate">{player.nickname}</span>
              <span className="text-xs font-bold text-yellow-400/80 mono">{player.score || 0}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

// ====================================================
// MAIN PUB DISPLAY
// ====================================================
const PubDisplay = () => {
  const { pubCode } = useParams();
  
  const [pub, setPub] = useState(null);
  const [currentPerformance, setCurrentPerformance] = useState(null);
  const [latestMessage, setLatestMessage] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [newReaction, setNewReaction] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [participantCount, setParticipantCount] = useState(0);

  const [quizId, setQuizId] = useState(null);
  const [quizQuestion, setQuizQuestion] = useState(null);
  const [quizCategory, setQuizCategory] = useState(null);
  const [quizPoints, setQuizPoints] = useState(null);
  const [quizOptions, setQuizOptions] = useState(null);
  const [quizMediaUrl, setQuizMediaUrl] = useState(null);
  const [quizMediaType, setQuizMediaType] = useState(null);
  const [quizStatus, setQuizStatus] = useState(null);
  const [quizResults, setQuizResults] = useState(null);

  const lastDataHashRef = useRef('');
  const lastQuizIdRef = useRef(null);
  const lastQuizStatusRef = useRef(null);
  const pollIntervalRef = useRef(null);
  const isFetchingRef = useRef(false);

  const makeHash = (data) => {
    if (!data) return '';
    try {
      const p = data.current_performance;
      const q = data.active_quiz;
      return [data.pub?.id, data.pub?.name, data.pub?.logo_url, p?.id, p?.status, p?.started_at, p?.average_score, q?.id, q?.status, data.latest_message?.id, data.leaderboard?.length].join('|');
    } catch { return ''; }
  };

  const loadDisplayData = useCallback(async () => {
    if (!pubCode || isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      const { data } = await api.getDisplayData(pubCode);
      if (!data) { setPub(null); isFetchingRef.current = false; return; }

      const newHash = makeHash(data);
      if (newHash === lastDataHashRef.current) { isFetchingRef.current = false; return; }
      lastDataHashRef.current = newHash;

      setPub(prev => (!prev || prev.id !== data.pub.id || prev.name !== data.pub.name || prev.logo_url !== data.pub.logo_url) ? data.pub : prev);

      setCurrentPerformance(prev => {
        const n = data.current_performance;
        if (!prev && !n) return prev;
        if (!prev || !n) return n || null;
        if (prev.id === n.id && prev.status === n.status && prev.started_at === n.started_at && prev.average_score === n.average_score) return prev;
        return n;
      });

      setLatestMessage(prev => {
        const n = data.latest_message;
        if (!prev && !n) return prev;
        if (!prev || !n) return n || null;
        if (prev.id === n.id) return prev;
        return n;
      });

      setLeaderboard(data.leaderboard || []);
      setParticipantCount(data.leaderboard?.length || 0);

      const quiz = data.active_quiz;
      if (quiz) {
        if (lastQuizIdRef.current !== quiz.id) {
          lastQuizIdRef.current = quiz.id;
          lastQuizStatusRef.current = quiz.status;
          setQuizId(quiz.id); setQuizQuestion(quiz.question); setQuizCategory(quiz.category);
          setQuizPoints(quiz.points); setQuizOptions(quiz.options); setQuizMediaUrl(quiz.media_url);
          setQuizMediaType(quiz.media_type); setQuizStatus(quiz.status); setQuizResults(null);
          if (quiz.status === 'showing_results' || quiz.status === 'leaderboard') {
            try { const { data: r } = await api.getQuizResults(quiz.id); setQuizResults(r); } catch (e) {}
          }
        } else if (lastQuizStatusRef.current !== quiz.status) {
          lastQuizStatusRef.current = quiz.status;
          setQuizStatus(quiz.status);
          if (quiz.status === 'showing_results' || quiz.status === 'leaderboard') {
            try { const { data: r } = await api.getQuizResults(quiz.id); setQuizResults(r); } catch (e) {}
          }
        }
      } else if (lastQuizIdRef.current !== null) {
        lastQuizIdRef.current = null; lastQuizStatusRef.current = null;
        setQuizId(null); setQuizQuestion(null); setQuizCategory(null); setQuizPoints(null);
        setQuizOptions(null); setQuizMediaUrl(null); setQuizMediaType(null); setQuizStatus(null); setQuizResults(null);
      }
    } catch (error) {
      console.error('Errore caricamento display:', error);
    } finally { setIsLoading(false); isFetchingRef.current = false; }
  }, [pubCode]);

  // Polling
  useEffect(() => {
    loadDisplayData();
    pollIntervalRef.current = setInterval(loadDisplayData, 3000);
    return () => { if (pollIntervalRef.current) clearInterval(pollIntervalRef.current); };
  }, [loadDisplayData]);

  // Realtime DB
  useEffect(() => {
    if (!pubCode) return;
    const channel = supabase.channel(`display_${pubCode}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'performances' }, () => loadDisplayData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quizzes' }, () => loadDisplayData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => loadDisplayData())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reactions' }, (payload) => setNewReaction(payload.new))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [pubCode, loadDisplayData]);

  // MUTE BROADCAST LISTENER
  useEffect(() => {
    if (!pubCode) return;
    const controlChannel = supabase.channel(`display_control_${pubCode}`)
      .on('broadcast', { event: 'control' }, (payload) => {
        if (payload.payload?.command === 'mute') setIsMuted(payload.payload.value);
      })
      .subscribe();
    return () => { supabase.removeChannel(controlChannel); };
  }, [pubCode]);

  // RENDER
  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center display-root">
        <style>{DISPLAY_STYLES}</style>
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full border-2 border-purple-500/30 border-t-purple-500 animate-spin" />
          <p className="text-lg text-white/40 mono">Connessione...</p>
        </div>
      </div>
    );
  }

  if (!pub) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center display-root">
        <style>{DISPLAY_STYLES}</style>
        <p className="text-2xl text-red-400">Evento non trovato o terminato</p>
      </div>
    );
  }

  const isVoting = currentPerformance?.status === 'voting';
  const voteResult = currentPerformance?.status === 'ended' ? currentPerformance.average_score : null;
  const showQuiz = quizId && ['active', 'closed', 'showing_results'].includes(quizStatus);
  const showLeaderboard = quizStatus === 'leaderboard';
  const showKaraoke = currentPerformance && !showQuiz && !showLeaderboard;

  return (
    <div className="min-h-screen bg-black relative overflow-hidden display-root">
      <style>{DISPLAY_STYLES}</style>

      {/* MAIN CONTENT */}
      {showLeaderboard ? <LeaderboardScreen leaderboard={leaderboard} />
       : showQuiz ? <QuizScreen quizId={quizId} question={quizQuestion} category={quizCategory} points={quizPoints} options={quizOptions} mediaUrl={quizMediaUrl} mediaType={quizMediaType} quizStatus={quizStatus} quizResults={quizResults} />
       : showKaraoke ? <KaraokeScreen performance={currentPerformance} isVoting={isVoting} voteResult={voteResult} isMuted={isMuted} />
       : <IdleScreen pub={pub} />}

      {/* OVERLAYS */}
      <FloatingReactions newReaction={newReaction} />
      <MessageToast message={latestMessage} />

      {/* HEADER */}
      <div className="absolute top-4 left-4 z-40 flex items-center gap-3">
        <div className="bg-black/70 backdrop-blur-md rounded-xl px-4 py-2 border border-white/10 flex items-center gap-3">
          {pub.logo_url && <img src={pub.logo_url} alt="" className="w-7 h-7 rounded-lg object-cover" />}
          <span className="text-white font-semibold text-sm">{pub.name}</span>
          <div className="w-px h-4 bg-white/20" />
          <div className="flex items-center gap-1">
            <Users className="w-3.5 h-3.5 text-white/40" />
            <span className="text-xs text-white/40 mono">{participantCount}</span>
          </div>
          {isMuted && (<><div className="w-px h-4 bg-white/20" /><VolumeX className="w-4 h-4 text-red-400" /></>)}
        </div>
      </div>

      {/* MINI LEADERBOARD */}
      {(showKaraoke || (!showQuiz && !showLeaderboard)) && leaderboard.length > 0 && <MiniLeaderboard leaderboard={leaderboard} />}

      {/* QR CODE */}
      <div className="absolute bottom-4 right-4 z-40">
        <div className="bg-white rounded-xl p-2.5 shadow-2xl" style={{ boxShadow: '0 0 30px rgba(0,0,0,0.5)' }}>
          <QRCodeSVG value={`${window.location.origin}/join/${pubCode}`} size={90} />
          <div className="text-center mt-1">
            <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Unisciti</p>
            <p className="text-xs font-bold text-black mono">{pubCode}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PubDisplay;