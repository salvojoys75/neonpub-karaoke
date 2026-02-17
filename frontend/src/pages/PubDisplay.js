import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '@/lib/supabase';
import api from '@/lib/api';
import { Music, Trophy, Mic2, Crown, Star, Sparkles, VolumeX, MessageSquare, Users, Zap } from 'lucide-react';
import QuizMediaFixed from '@/components/QuizMediaFixed';
import FloatingReactions from '@/components/FloatingReactions';
import ArcadeMode from '@/components/ArcadeMode';

// ====================================================
// STYLES
// ====================================================
const DISPLAY_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;700&display=swap');
  .display-root { font-family: 'Outfit', sans-serif; overflow: hidden; background: #000; }
  .display-root .mono { font-family: 'JetBrains Mono', monospace; }

  @keyframes msg-slide {
    0% { transform: translateY(-120%); opacity: 0; }
    6% { transform: translateY(0); opacity: 1; }
    88% { transform: translateY(0); opacity: 1; }
    100% { transform: translateY(-120%); opacity: 0; }
  }
  .animate-msg { animation: msg-slide 8s cubic-bezier(.4,0,.2,1) forwards; }

  @keyframes glow-pulse {
    0%, 100% { opacity: 0.4; filter: blur(40px); }
    50% { opacity: 0.7; filter: blur(60px); }
  }
  .glow-pulse { animation: glow-pulse 4s ease-in-out infinite; }

  @keyframes live-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.2; } }
  .live-dot { animation: live-blink 1s ease-in-out infinite; }

  @keyframes score-reveal {
    0% { transform: scale(0.5) translateY(20px); opacity: 0; }
    60% { transform: scale(1.08) translateY(-5px); }
    100% { transform: scale(1) translateY(0); opacity: 1; }
  }
  .score-reveal { animation: score-reveal 0.6s cubic-bezier(.34,1.56,.64,1) forwards; }

  @keyframes slide-up {
    0% { transform: translateY(30px); opacity: 0; }
    100% { transform: translateY(0); opacity: 1; }
  }
  .slide-up { animation: slide-up 0.5s ease-out forwards; }

  @keyframes float-idle {
    0%, 100% { transform: translateY(0px) scale(1); }
    50% { transform: translateY(-12px) scale(1.02); }
  }
  .float-idle { animation: float-idle 5s ease-in-out infinite; }

  @keyframes ticker {
    0% { transform: translateX(0); }
    100% { transform: translateX(-50%); }
  }
  .ticker-scroll { animation: ticker 25s linear infinite; }

  @keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
  .shimmer {
    background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.05) 50%, transparent 100%);
    background-size: 200% 100%;
    animation: shimmer 3s linear infinite;
  }
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
    const m = url.match(/^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/);
    return (m && m[2].length === 11) ? m[2] : null;
  };

  useEffect(() => {
    if (!playerRef.current || !isPlayerReadyRef.current) return;
    try { if (isMuted) playerRef.current.mute(); else { playerRef.current.unMute(); playerRef.current.setVolume(100); } } catch (e) {}
  }, [isMuted]);

  useEffect(() => {
    if (!performance?.youtube_url) return;
    const videoId = getYoutubeId(performance.youtube_url);
    if (!videoId) return;
    const loadYT = () => new Promise(r => {
      if (window.YT?.Player) { r(); return; }
      if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) { const t = document.createElement('script'); t.src = 'https://www.youtube.com/iframe_api'; document.head.appendChild(t); }
      const c = setInterval(() => { if (window.YT?.Player) { clearInterval(c); r(); } }, 100);
    });
    const create = async () => {
      await loadYT();
      if (prevVideoIdRef.current === videoId && playerRef.current && isPlayerReadyRef.current) {
        if (performance.started_at !== prevStartedAtRef.current) { prevStartedAtRef.current = performance.started_at; playerRef.current.seekTo(0); playerRef.current.playVideo(); }
        if (isVoting || voteResult) playerRef.current.pauseVideo();
        else if (performance.status === 'live') playerRef.current.playVideo();
        else if (performance.status === 'paused') playerRef.current.pauseVideo();
        return;
      }
      prevVideoIdRef.current = videoId; prevStartedAtRef.current = performance.started_at; isPlayerReadyRef.current = false;
      if (playerRef.current) { try { playerRef.current.destroy(); } catch (e) {} playerRef.current = null; }
      if (!document.getElementById('karaoke-player')) return;
      playerRef.current = new window.YT.Player('karaoke-player', {
        videoId, playerVars: { autoplay:1, controls:0, disablekb:1, fs:0, iv_load_policy:3, modestbranding:1, rel:0, showinfo:0, playsinline:1, origin:window.location.origin },
        events: {
          onReady: (e) => { isPlayerReadyRef.current = true; e.target.setVolume(100); if (isMuted) e.target.mute(); if (performance.status==='live'&&!isVoting&&!voteResult) e.target.playVideo(); else e.target.pauseVideo(); },
          onStateChange: () => {}
        }
      });
    };
    create();
  }, [performance, isVoting, voteResult]);

  useEffect(() => () => { if (playerRef.current) { try { playerRef.current.destroy(); } catch(e){} playerRef.current=null; } prevVideoIdRef.current=null; isPlayerReadyRef.current=false; }, []);

  if (isVoting || voteResult) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-black">
        {/* Background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-yellow-500/20 glow-pulse" />
        <div className="text-center score-reveal relative z-10">
          {voteResult ? (<>
            <Crown className="w-28 h-28 text-yellow-400 mx-auto mb-6 drop-shadow-[0_0_30px_rgba(250,204,21,0.5)]" />
            <p className="text-xl text-white/50 font-medium tracking-[0.3em] uppercase mb-2">Punteggio</p>
            <p className="text-[120px] font-black text-yellow-400 leading-none" style={{textShadow:'0 0 60px rgba(250,204,21,0.3)'}}>{voteResult.toFixed(1)}</p>
            <div className="flex items-center justify-center gap-3 mt-6 bg-white/5 rounded-full px-6 py-2">
              <Mic2 className="w-5 h-5 text-fuchsia-400" />
              <p className="text-lg text-white/80">{performance?.user_nickname}</p>
            </div>
          </>) : (<>
            <div className="relative mb-8">
              <Star className="w-24 h-24 text-yellow-400 mx-auto animate-pulse drop-shadow-[0_0_40px_rgba(250,204,21,0.4)]" />
            </div>
            <h2 className="text-5xl font-black text-white mb-3 tracking-tight">VOTA ORA!</h2>
            <p className="text-xl text-white/50">{performance?.user_nickname}</p>
            <p className="text-sm text-white/20 mt-6 mono tracking-[0.2em]">DAL TUO TELEFONO</p>
          </>)}
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 bg-black">
      <div className="absolute inset-0 overflow-hidden">
        <div id="karaoke-player" className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" style={{width:'115%',height:'115%'}} />
      </div>
      <div className="absolute inset-0 pointer-events-none" style={{background:'linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 30%, transparent 85%, rgba(0,0,0,0.4) 100%)'}} />
      
      {/* Now playing bar */}
      <div className="absolute bottom-0 left-0 right-0 p-4 z-10">
        <div className="flex items-center gap-4 bg-black/50 backdrop-blur-xl rounded-2xl px-5 py-3 border border-white/[0.08] max-w-2xl">
          <div className="relative flex-shrink-0">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-fuchsia-500 to-violet-600 flex items-center justify-center">
              <Mic2 className="w-6 h-6 text-white" />
            </div>
            <div className="absolute -top-1 -right-1 flex items-center gap-1 bg-red-500 rounded-full px-1.5 py-0.5">
              <div className="w-1.5 h-1.5 rounded-full bg-white live-dot" />
              <span className="text-[9px] font-bold text-white">LIVE</span>
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-bold text-white truncate leading-tight">{performance?.song_title}</h3>
            <p className="text-sm text-white/40 truncate">{performance?.song_artist} <span className="text-fuchsia-400/80">&bull; {performance?.user_nickname}</span></p>
          </div>
        </div>
      </div>
    </div>
  );
});

// ====================================================
// QUIZ COMPONENTS
// ====================================================
const QuizMediaWrapper = memo(({ mediaUrl, mediaType, isResult }) => {
  if (!mediaUrl || mediaType === 'text') return null;
  return <QuizMediaFixed mediaUrl={mediaUrl} mediaType={mediaType} isResult={isResult} />;
}, (p, n) => p.mediaUrl===n.mediaUrl && p.mediaType===n.mediaType && p.isResult===n.isResult);

const QuizScreen = memo(({ quizId, question, category, points, options, mediaUrl, mediaType, quizStatus, quizResults }) => {
  const isShowingResults = quizStatus==='showing_results'||quizStatus==='leaderboard';
  const optColors = [
    {bg:'from-blue-600 to-blue-500', text:'text-blue-100'},
    {bg:'from-rose-600 to-pink-500', text:'text-rose-100'},
    {bg:'from-amber-600 to-yellow-500', text:'text-amber-100'},
    {bg:'from-emerald-600 to-green-500', text:'text-emerald-100'}
  ];

  return (
    <div className="absolute inset-0 bg-black">
      <QuizMediaWrapper mediaUrl={mediaUrl} mediaType={mediaType} isResult={isShowingResults} />
      
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 z-[5]" style={{background:'linear-gradient(135deg, rgba(88,28,135,0.3) 0%, rgba(0,0,0,0.7) 50%, rgba(157,23,77,0.2) 100%)'}} />
      
      <div className="absolute inset-0 flex flex-col z-10">
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-3 bg-black/40 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <Zap className="w-6 h-6 text-yellow-400" />
            <span className="text-sm font-bold text-white/70 tracking-[0.15em] uppercase">{category || 'Quiz'}</span>
          </div>
          <div className="flex items-center gap-1.5 bg-white/10 rounded-full px-3 py-1">
            <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
            <span className="text-yellow-400 font-bold mono text-xs">{points || 10}</span>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-5xl w-full">
            {quizResults ? (
              <div className="text-center score-reveal">
                <p className="text-lg text-white/40 font-medium tracking-[0.3em] uppercase mb-4">Risposta Corretta</p>
                <div className="inline-block bg-emerald-500/15 border border-emerald-400/50 rounded-2xl px-10 py-6 mb-8" style={{boxShadow:'0 0 40px rgba(52,211,153,0.15)'}}>
                  <p className="text-4xl font-black text-emerald-400">{quizResults.correct_option}</p>
                </div>
                <div className="flex justify-center gap-16 mb-8">
                  <div><span className="text-5xl font-black text-white block">{quizResults.correct_count}</span><span className="text-xs text-white/40 uppercase tracking-wider">corrette</span></div>
                  <div><span className="text-5xl font-black text-white block">{quizResults.total_answers}</span><span className="text-xs text-white/40 uppercase tracking-wider">risposte</span></div>
                </div>
                {quizResults.winners?.length > 0 && (
                  <div className="flex flex-wrap justify-center gap-2">
                    {quizResults.winners.slice(0,5).map((w,i) => (
                      <span key={i} className="bg-yellow-400/10 text-yellow-300 px-4 py-1.5 rounded-full text-sm font-medium border border-yellow-400/20">{w}</span>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <>
                <h2 className="text-4xl md:text-5xl font-bold text-white text-center mb-10 leading-tight" style={{textShadow:'0 4px 30px rgba(0,0,0,0.5)'}}>{question}</h2>
                <div className="grid grid-cols-2 gap-3">
                  {options?.map((option, i) => (
                    <div key={i} className={`bg-gradient-to-r ${optColors[i%4].bg} rounded-xl p-5 flex items-center gap-4 shadow-lg slide-up`} style={{animationDelay:`${i*0.1}s`}}>
                      <span className="w-10 h-10 rounded-lg bg-black/30 flex items-center justify-center text-white font-black text-lg flex-shrink-0">{String.fromCharCode(65+i)}</span>
                      <span className={`text-xl font-semibold ${optColors[i%4].text}`}>{option}</span>
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
}, (p,n) => p.quizId===n.quizId && p.question===n.question && p.quizStatus===n.quizStatus && p.mediaUrl===n.mediaUrl && p.quizResults===n.quizResults);

// ====================================================
// LEADERBOARD
// ====================================================
const LeaderboardScreen = ({ leaderboard }) => {
  const medals = ['🥇','🥈','🥉'];
  return (
    <div className="absolute inset-0 flex flex-col bg-black">
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-yellow-500/10 glow-pulse" />
      <div className="flex items-center justify-center gap-4 pt-10 pb-6 relative z-10">
        <Trophy className="w-10 h-10 text-yellow-400 drop-shadow-[0_0_20px_rgba(250,204,21,0.4)]" />
        <h2 className="text-4xl font-black text-white tracking-tight">CLASSIFICA</h2>
      </div>
      <div className="max-w-2xl mx-auto flex-1 overflow-hidden w-full px-6 relative z-10">
        {leaderboard?.slice(0,10).map((player, i) => (
          <div key={player.id||i} className={`flex items-center gap-4 p-4 mb-2 rounded-xl slide-up ${
            i===0?'bg-yellow-400/10 border border-yellow-400/30':i===1?'bg-white/5 border border-white/10':i===2?'bg-amber-500/5 border border-amber-500/20':'bg-white/[0.03] border border-white/[0.05]'
          }`} style={{animationDelay:`${i*0.08}s`}}>
            <span className="text-2xl w-10 text-center">{i<3?medals[i]:<span className="text-white/20 mono font-bold text-lg">{i+1}</span>}</span>
            <span className="flex-1 text-xl text-white font-semibold truncate">{player.nickname}</span>
            <span className={`text-2xl font-black mono ${i===0?'text-yellow-400':'text-white/60'}`}>{player.score||0}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ====================================================
// IDLE
// ====================================================
const IdleScreen = ({ pub }) => (
  <div className="absolute inset-0 flex items-center justify-center bg-black">
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-fuchsia-600/10 glow-pulse" />
    <div className="text-center float-idle relative z-10">
      {pub.logo_url ? (
        <img src={pub.logo_url} alt={pub.name} className="w-40 h-40 mx-auto mb-8 rounded-2xl object-cover border border-white/10 shadow-[0_0_40px_rgba(168,85,247,0.15)]" />
      ) : (
        <div className="w-40 h-40 mx-auto mb-8 rounded-2xl bg-gradient-to-br from-fuchsia-600/20 to-violet-600/20 flex items-center justify-center border border-fuchsia-500/20">
          <Music className="w-16 h-16 text-fuchsia-400/60" />
        </div>
      )}
      <h1 className="text-5xl font-black text-white mb-3 tracking-tight">{pub.name}</h1>
      <div className="shimmer rounded-full px-6 py-2 inline-block">
        <p className="text-base text-white/25 tracking-[0.3em] uppercase mono">Scansiona il QR per unirti</p>
      </div>
    </div>
  </div>
);

// ====================================================
// MESSAGE TOAST
// ====================================================
const MessageToast = memo(({ message }) => {
  const [visible, setVisible] = useState(false);
  const [currentMsg, setCurrentMsg] = useState(null);
  const lastIdRef = useRef(null);
  const tRef = useRef(null);
  useEffect(() => {
    if (message && message.id !== lastIdRef.current) {
      lastIdRef.current = message.id; setCurrentMsg(message); setVisible(true);
      if (tRef.current) clearTimeout(tRef.current);
      tRef.current = setTimeout(() => setVisible(false), 8000);
    }
    return () => { if (tRef.current) clearTimeout(tRef.current); };
  }, [message]);
  if (!visible || !currentMsg) return null;
  return (
    <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 animate-msg max-w-2xl w-full px-4">
      <div className="bg-black/80 backdrop-blur-xl rounded-2xl px-6 py-4 border border-white/10 flex items-start gap-3 shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
        <MessageSquare className="w-5 h-5 text-fuchsia-400 flex-shrink-0 mt-0.5" />
        <p className="text-white text-lg">{currentMsg.text}</p>
      </div>
    </div>
  );
});

// ====================================================
// MINI LEADERBOARD
// ====================================================
const MiniLeaderboard = memo(({ leaderboard }) => {
  if (!leaderboard || leaderboard.length === 0) return null;
  return (
    <div className="absolute top-20 right-4 z-30 w-48">
      <div className="bg-black/60 backdrop-blur-md rounded-xl border border-white/[0.08] overflow-hidden">
        <div className="px-3 py-2 border-b border-white/[0.06] flex items-center gap-2">
          <Trophy className="w-3 h-3 text-yellow-400/80" />
          <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider">Classifica</span>
        </div>
        <div className="p-1.5">
          {leaderboard.slice(0,5).map((p,i) => (
            <div key={p.id||i} className="flex items-center gap-2 px-2 py-1">
              <span className={`text-[10px] font-bold w-4 text-center mono ${i===0?'text-yellow-400':i===1?'text-white/40':i===2?'text-amber-600/60':'text-white/15'}`}>{i+1}</span>
              <span className="text-xs text-white/60 flex-1 truncate">{p.nickname}</span>
              <span className="text-[10px] font-bold text-white/30 mono">{p.score||0}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

// ====================================================
// QUEUE TICKER
// ====================================================
const QueueTicker = memo(({ queue }) => {
  if (!queue || queue.length === 0) return null;
  const items = [...queue, ...queue]; // Duplica per loop continuo
  return (
    <div className="absolute bottom-0 left-0 right-0 z-20 bg-black/60 backdrop-blur-sm border-t border-white/[0.05] h-8 flex items-center overflow-hidden">
      <div className="flex-shrink-0 px-3 bg-fuchsia-600 h-full flex items-center z-10">
        <span className="text-[10px] font-bold text-white tracking-wider">PROSSIMI</span>
      </div>
      <div className="flex-1 overflow-hidden">
        <div className="ticker-scroll flex items-center gap-8 whitespace-nowrap">
          {items.map((s,i) => (
            <span key={i} className="text-xs text-white/50 flex items-center gap-2">
              <span className="text-fuchsia-400/60">{s.user_nickname}</span>
              <span className="text-white/30">&bull;</span>
              <span className="text-white/40">{s.title}</span>
            </span>
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
  const [queue, setQueue] = useState([]);
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

  // ── ARCADE ──
  const [arcadeGame, setArcadeGame] = useState(null);
  const [arcadeWinner, setArcadeWinner] = useState(null);
  const arcadeWinnerTimer = useRef(null);
  const lastArcadeGameId = useRef(null);
  const lastArcadeData = useRef(null);
  const eventIdRef = useRef(null);

  const lastDataHashRef = useRef('');
  const lastQuizIdRef = useRef(null);
  const lastQuizStatusRef = useRef(null);
  const pollRef = useRef(null);
  const fetchingRef = useRef(false);

  const makeHash = (d) => {
    if (!d) return '';
    try { const p=d.current_performance,q=d.active_quiz; return [d.pub?.id,d.pub?.name,d.pub?.logo_url,p?.id,p?.status,p?.started_at,p?.average_score,q?.id,q?.status,d.latest_message?.id,d.leaderboard?.length,d.queue?.length].join('|'); } catch { return ''; }
  };

  const loadDisplayData = useCallback(async () => {
    if (!pubCode || fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const { data } = await api.getDisplayData(pubCode);
      if (!data) { setPub(null); fetchingRef.current=false; return; }
      const h = makeHash(data);
      if (h === lastDataHashRef.current) { fetchingRef.current=false; return; }
      lastDataHashRef.current = h;

      setPub(prev => (!prev||prev.id!==data.pub.id||prev.name!==data.pub.name||prev.logo_url!==data.pub.logo_url) ? data.pub : prev);
      setCurrentPerformance(prev => { const n=data.current_performance; if(!prev&&!n)return prev; if(!prev||!n)return n||null; if(prev.id===n.id&&prev.status===n.status&&prev.started_at===n.started_at&&prev.average_score===n.average_score)return prev; return n; });
      setLatestMessage(prev => { const n=data.latest_message; if(!prev&&!n)return prev; if(!prev||!n)return n||null; if(prev.id===n.id)return prev; return n; });
      setLeaderboard(data.leaderboard||[]);
      setQueue(data.queue||[]);
      setParticipantCount(data.leaderboard?.length||0);

      const quiz = data.active_quiz;
      if (quiz) {
        if (lastQuizIdRef.current !== quiz.id) {
          lastQuizIdRef.current=quiz.id; lastQuizStatusRef.current=quiz.status;
          setQuizId(quiz.id); setQuizQuestion(quiz.question); setQuizCategory(quiz.category); setQuizPoints(quiz.points); setQuizOptions(quiz.options); setQuizMediaUrl(quiz.media_url); setQuizMediaType(quiz.media_type); setQuizStatus(quiz.status); setQuizResults(null);
          if(quiz.status==='showing_results'||quiz.status==='leaderboard'){try{const{data:r}=await api.getQuizResults(quiz.id);setQuizResults(r);}catch(e){}}
        } else if (lastQuizStatusRef.current !== quiz.status) {
          lastQuizStatusRef.current=quiz.status; setQuizStatus(quiz.status);
          if(quiz.status==='showing_results'||quiz.status==='leaderboard'){try{const{data:r}=await api.getQuizResults(quiz.id);setQuizResults(r);}catch(e){}}
        }
      } else if (lastQuizIdRef.current!==null) {
        lastQuizIdRef.current=null; lastQuizStatusRef.current=null;
        setQuizId(null);setQuizQuestion(null);setQuizCategory(null);setQuizPoints(null);setQuizOptions(null);setQuizMediaUrl(null);setQuizMediaType(null);setQuizStatus(null);setQuizResults(null);
      }
      // ── eventId per filtro reazioni ──
      if (data.pub?.id) eventIdRef.current = data.pub.id;

      // ── ARCADE ──
      const arcade = data.active_arcade;
      if (arcade?.id) lastArcadeData.current = arcade;
      setArcadeGame(arcade || null);

      if (arcade && arcade.status === 'ended' && arcade.winner_id) {
        if (lastArcadeGameId.current !== arcade.id) {
          lastArcadeGameId.current = arcade.id;
          let winnerData = null;
          try {
            const { data: wd } = await supabase
              .from('participants')
              .select('id, nickname, avatar_url')
              .eq('id', arcade.winner_id)
              .single();
            winnerData = wd;
          } catch(e) {}
          if (!winnerData) winnerData = { id: arcade.winner_id, nickname: 'Vincitore!', avatar_url: null };
          if (arcadeWinnerTimer.current) clearTimeout(arcadeWinnerTimer.current);
          setArcadeWinner({ game_id: arcade.id, winner: winnerData });
          arcadeWinnerTimer.current = setTimeout(() => {
            setArcadeWinner(null);
            lastArcadeGameId.current = null;
          }, 15000);
        }
      } else if (!arcade || ['active', 'setup', 'waiting'].includes(arcade.status)) {
        if (lastArcadeGameId.current !== null && (!arcade || arcade.id !== lastArcadeGameId.current)) {
          if (arcadeWinnerTimer.current) clearTimeout(arcadeWinnerTimer.current);
          setArcadeWinner(null);
          lastArcadeGameId.current = null;
        }
      }

    } catch(e){console.error('Display error:',e);} finally{setIsLoading(false);fetchingRef.current=false;}
  }, [pubCode]);

  useEffect(() => { loadDisplayData(); pollRef.current=setInterval(loadDisplayData,3000); return()=>{if(pollRef.current)clearInterval(pollRef.current);}; }, [loadDisplayData]);

  useEffect(() => {
    if (!pubCode) return;
    const ch = supabase.channel(`display_${pubCode}`)
      .on('postgres_changes',{event:'*',schema:'public',table:'performances'},()=>loadDisplayData())
      .on('postgres_changes',{event:'*',schema:'public',table:'quizzes'},()=>loadDisplayData())
      .on('postgres_changes',{event:'*',schema:'public',table:'events'},()=>loadDisplayData())
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'reactions'},(p)=>{
        const r = p.new;
        if (eventIdRef.current && r.event_id !== eventIdRef.current) return;
        if (!r.emoji) return;
        setNewReaction({ emoji: r.emoji, nickname: r.nickname || '', _t: Date.now() });
        setTimeout(() => setNewReaction(null), 100);
      })
      .on('postgres_changes',{event:'*',schema:'public',table:'arcade_games'},()=>loadDisplayData())
      .on('postgres_changes',{event:'*',schema:'public',table:'arcade_bookings'},()=>loadDisplayData())
      .subscribe();
    return()=>{supabase.removeChannel(ch);};
  }, [pubCode, loadDisplayData]);

  useEffect(() => {
    if (!pubCode) return;
    const ctrl = supabase.channel(`display_control_${pubCode}`)
      .on('broadcast',{event:'control'},(p)=>{if(p.payload?.command==='mute')setIsMuted(p.payload.value);})
      .subscribe();
    return()=>{supabase.removeChannel(ctrl);};
  }, [pubCode]);

  if (isLoading) return (<div className="min-h-screen bg-black flex items-center justify-center display-root"><style>{DISPLAY_STYLES}</style><div className="w-12 h-12 rounded-full border-2 border-fuchsia-500/30 border-t-fuchsia-500 animate-spin"/></div>);
  if (!pub) return (<div className="min-h-screen bg-black flex items-center justify-center display-root"><style>{DISPLAY_STYLES}</style><p className="text-xl text-white/30">Evento non trovato</p></div>);

  const isArcade = !quizId && (
    (arcadeGame && ['active', 'paused'].includes(arcadeGame.status)) ||
    arcadeWinner !== null
  );
  const isVoting = currentPerformance?.status==='voting';
  const voteResult = currentPerformance?.status==='ended'?currentPerformance.average_score:null;
  const showQuiz = quizId&&['active','closed','showing_results'].includes(quizStatus);
  const showLb = quizStatus==='leaderboard';
  const showK = currentPerformance&&!showQuiz&&!showLb;

  return (
    <div className="min-h-screen bg-black relative overflow-hidden display-root">
      <style>{DISPLAY_STYLES}</style>

      {showLb ? <LeaderboardScreen leaderboard={leaderboard} />
       : showQuiz ? <QuizScreen quizId={quizId} question={quizQuestion} category={quizCategory} points={quizPoints} options={quizOptions} mediaUrl={quizMediaUrl} mediaType={quizMediaType} quizStatus={quizStatus} quizResults={quizResults} />
       : isArcade ? <ArcadeMode
           arcade={arcadeGame || lastArcadeData.current || {}}
           result={arcadeWinner ? { winner: arcadeWinner.winner } : null}
           bookingQueue={arcadeGame?.booking_queue || []}
           lastError={arcadeGame?.last_error}
         />
       : showK ? <KaraokeScreen performance={currentPerformance} isVoting={isVoting} voteResult={voteResult} isMuted={isMuted} />
       : <IdleScreen pub={pub} />}

      <FloatingReactions newReaction={newReaction} />
      <MessageToast message={latestMessage} />

      {/* Header */}
      <div className="absolute top-3 left-3 z-40">
        <div className="bg-black/50 backdrop-blur-md rounded-xl px-3 py-1.5 border border-white/[0.06] flex items-center gap-2.5">
          {pub.logo_url && <img src={pub.logo_url} alt="" className="w-6 h-6 rounded-md object-cover" />}
          <span className="text-white/70 font-medium text-sm">{pub.name}</span>
          <span className="text-white/15">|</span>
          <Users className="w-3 h-3 text-white/25" />
          <span className="text-[10px] text-white/25 mono">{participantCount}</span>
          {isMuted && <><span className="text-white/15">|</span><VolumeX className="w-3.5 h-3.5 text-red-400/70" /></>}
        </div>
      </div>

      {/* Mini Leaderboard durante karaoke/idle */}
      {(showK||(!showQuiz&&!showLb))&&leaderboard.length>0 && <MiniLeaderboard leaderboard={leaderboard} />}

      {/* Queue ticker durante karaoke */}
      {showK && <QueueTicker queue={queue} />}

      {/* QR */}
      <div className="absolute bottom-10 right-4 z-40">
        <div className="bg-white rounded-xl p-2 shadow-[0_4px_30px_rgba(0,0,0,0.8)]">
          <QRCodeSVG value={`${window.location.origin}/join/${pubCode}`} size={80} />
          <p className="text-[9px] text-center mt-1 text-gray-500 font-bold mono tracking-wider">{pubCode}</p>
        </div>
      </div>
    </div>
  );
};

export default PubDisplay;