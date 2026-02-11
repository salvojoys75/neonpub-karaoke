import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '@/lib/supabase';
import api from '@/lib/api';
import { Music, Trophy, Mic2, Crown, Star, VolumeX, Volume2, MessageSquare, Users, Zap, Clock } from 'lucide-react';
import QuizMediaFixed from '@/components/QuizMediaFixed';
import FloatingReactions from '@/components/FloatingReactions';

const DISPLAY_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Anton&family=Outfit:wght@300;400;600;800&display=swap');
  .tv-root { font-family: 'Outfit', sans-serif; overflow: hidden; background: #000; color: white; }
  .font-display { font-family: 'Anton', sans-serif; letter-spacing: 1px; }
  @keyframes slide-up-fade { from { transform: translateY(50px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
  .anim-entry { animation: slide-up-fade 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
  @keyframes scroll-ticker { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
  .ticker-track { animation: scroll-ticker 30s linear infinite; }
  @keyframes bg-pan { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
  .animated-bg { background: linear-gradient(-45deg, #1a0b2e, #2e0b1f, #0f172a, #000000); background-size: 400% 400%; animation: bg-pan 15s ease infinite; }
  .glass-panel { background: rgba(255, 255, 255, 0.05); backdrop-filter: blur(20px); border: 1px solid rgba(255, 255, 255, 0.1); box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37); }
`;

const LogoHeader = ({ pub, count, isMuted }) => (
  <div className="absolute top-8 left-8 z-50 flex items-center gap-4 anim-entry">
    {pub?.logo_url ? (<img src={pub.logo_url} className="w-16 h-16 rounded-xl object-cover border border-white/20" alt="logo" />) : (<div className="w-16 h-16 rounded-xl bg-fuchsia-600 flex items-center justify-center font-display text-2xl border border-white/20">NP</div>)}
    <div><h1 className="text-2xl font-bold leading-none text-white">{pub?.name || "NEONPUB"}</h1><div className="flex items-center gap-3 mt-1 text-white/60"><span className="flex items-center gap-1 text-sm bg-white/10 px-2 py-0.5 rounded-full"><Users className="w-3 h-3" /> {count} Online</span>{isMuted && <span className="flex items-center gap-1 text-red-400 text-sm bg-red-900/20 px-2 py-0.5 rounded-full"><VolumeX className="w-3 h-3" /> MUTED</span>}</div></div>
  </div>
);

const QrCorner = ({ pubCode }) => (
  <div className="absolute top-8 right-8 z-50 flex flex-col items-center bg-white p-3 rounded-2xl shadow-xl anim-entry" style={{animationDelay: '0.2s'}}>
    <QRCodeSVG value={`${window.location.origin}/join/${pubCode}`} size={120} /><div className="text-black font-display text-2xl mt-1 tracking-widest">{pubCode}</div>
  </div>
);

const KaraokeMode = memo(({ perf, nextSongs, isVoting, voteResult }) => {
  const [audioBlocked, setAudioBlocked] = useState(false);
  const playerRef = useRef(null);

  useEffect(() => {
    if (!perf?.youtube_url || isVoting || voteResult) return;
    const vidId = perf.youtube_url.match(/v=([^&]+)/)?.[1];
    if (!vidId) return;
    
    const init = () => {
      if(!window.YT) return;
      // FIX: mute: 0 per audio
      playerRef.current = new window.YT.Player('tv-player', {
        videoId: vidId,
        width: '100%', height: '100%',
        playerVars: { autoplay: 1, controls: 0, showinfo: 0, loop: 1, playlist: vidId, mute: 0, start: 0, origin: window.location.origin },
        events: { 
            onReady: (e) => { e.target.playVideo(); e.target.unMute(); e.target.setVolume(100); },
            onStateChange: (e) => { if (e.data === 1 && e.target.isMuted()) setAudioBlocked(true); else setAudioBlocked(false); }
        }
      });
    };
    if(!window.YT) { const t = document.createElement('script'); t.src = 'https://www.youtube.com/iframe_api'; document.head.appendChild(t); window.onYouTubeIframeAPIReady = init; } else init();
    return () => { try { playerRef.current?.destroy(); } catch(e){} };
  }, [perf?.id, isVoting, voteResult, perf?.youtube_url]);

  const unlockAudio = () => { if(playerRef.current) { playerRef.current.unMute(); playerRef.current.playVideo(); setAudioBlocked(false); } };

  if (isVoting) return (<div className="flex flex-col items-center justify-center h-full text-center relative z-20"><Star className="w-40 h-40 text-yellow-400 fill-yellow-400 mb-8 animate-bounce" /><h2 className="font-display text-[8rem] leading-none text-white mb-4">VOTA ORA!</h2><p className="text-4xl text-white/80">Vota per <span className="font-bold text-yellow-400">{perf.user_nickname}</span></p></div>);
  if (voteResult) return (<div className="flex flex-col items-center justify-center h-full text-center relative z-20"><Crown className="w-32 h-32 text-yellow-400 mb-6" /><div className="font-display text-[15rem] leading-none text-yellow-400">{Number(voteResult).toFixed(1)}</div><h2 className="text-5xl text-white font-bold mt-4">PUNTEGGIO FINALE</h2><p className="text-2xl text-white/60 mt-2">{perf.song_title}</p></div>);

  return (
    <div className="relative h-full flex flex-col justify-end pb-24 px-16 z-20">
      {/* FIX: Removed scale-125 to fit screen better */}
      <div className="absolute inset-0 z-0 opacity-60 pointer-events-none overflow-hidden"><div id="tv-player" className="w-full h-full"></div></div>
      {audioBlocked && <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-auto"><button onClick={unlockAudio} className="bg-red-600 text-white px-8 py-4 rounded-full font-bold text-2xl animate-bounce shadow-xl border-4 border-white flex items-center gap-2"><Volume2 className="w-8 h-8"/> ATTIVA AUDIO</button></div>}
      <div className="relative z-10 w-full max-w-6xl anim-entry bg-black/40 p-8 rounded-3xl backdrop-blur-sm border border-white/10">
        <div className="flex items-center gap-4 mb-6"><span className="bg-red-600 text-white px-4 py-1 rounded font-bold tracking-widest text-lg animate-pulse">LIVE</span><div className="flex items-center gap-2 bg-white/10 px-4 py-1 rounded-full"><Mic2 className="w-6 h-6 text-fuchsia-400" /><span className="text-2xl font-semibold text-white">{perf.user_nickname}</span></div></div>
        <h1 className="font-display text-[6rem] leading-[0.9] text-white drop-shadow-xl mb-4 line-clamp-2">{perf.song_title}</h1><h2 className="text-4xl text-fuchsia-300 font-light mb-8 drop-shadow-md">{perf.song_artist}</h2>
        {nextSongs.length > 0 && (<div className="glass-panel rounded-2xl p-4 max-w-xl"><h3 className="text-white/40 uppercase tracking-widest text-sm font-bold mb-2 flex items-center gap-2"><Clock className="w-4 h-4"/> Next Up</h3>{nextSongs.slice(0, 1).map((s, i) => (<div key={i} className="flex items-center gap-4"><div className="flex-1 overflow-hidden"><div className="text-xl font-bold truncate text-white">{s.title}</div></div><div className="bg-white/10 px-3 py-1 rounded text-sm text-fuchsia-300">{s.user_nickname}</div></div>))}</div>)}
      </div>
    </div>
  );
});

const QuizMode = memo(({ quiz, result }) => {
  if (quiz.status === 'leaderboard') return null;
  return (
    <div className="h-full flex flex-col pt-32 pb-12 px-16 relative z-20">
      <QuizMediaFixed mediaUrl={quiz.media_url} mediaType={quiz.media_type} isResult={!!result} />
      <div className="absolute top-8 left-1/2 -translate-x-1/2 glass-panel px-8 py-2 rounded-full z-30"><span className="text-fuchsia-400 font-bold tracking-[0.3em] uppercase">{quiz.category || "QUIZ"}</span></div>
      <div className="flex-1 flex flex-col justify-center items-center text-center relative z-30">
         {result ? (
            <div className="anim-entry w-full max-w-5xl">
               <div className="text-3xl text-white/50 uppercase tracking-widest mb-6 font-bold">La risposta corretta è</div>
               <div className="bg-green-600 p-12 rounded-3xl mb-12 border-4 border-green-400"><span className="font-display text-[6rem] leading-none text-white">{result.correct_option}</span></div>
               <div className="grid grid-cols-3 gap-8 text-center"><div className="glass-panel p-6 rounded-2xl"><div className="text-5xl font-bold text-white mb-2">{result.total_answers}</div><div className="text-sm uppercase text-white/40 font-bold">Risposte</div></div><div className="glass-panel p-6 rounded-2xl"><div className="text-5xl font-bold text-green-400 mb-2">{result.correct_count}</div><div className="text-sm uppercase text-white/40 font-bold">Corrette</div></div><div className="glass-panel p-6 rounded-2xl"><div className="text-5xl font-bold text-yellow-400 mb-2">{quiz.points}</div><div className="text-sm uppercase text-white/40 font-bold">Punti</div></div></div>
            </div>
         ) : (
            <div className="w-full max-w-7xl anim-entry">
               <h2 className="font-display text-[5rem] leading-[1.1] text-white drop-shadow-lg mb-16 text-center">{quiz.question}</h2>
               {quiz.status === 'closed' ? (<div className="bg-red-900/80 p-8 rounded-2xl border border-red-500 animate-pulse inline-block"><h3 className="text-4xl font-bold text-white uppercase tracking-widest">Tempo Scaduto!</h3></div>) : (<div className="grid grid-cols-2 gap-6 w-full">{quiz.options?.map((opt, i) => (<div key={i} className={`bg-white/10 p-8 rounded-2xl border-l-8 border-fuchsia-500 flex items-center gap-6`}><div className="w-16 h-16 bg-black/30 rounded-full flex items-center justify-center font-display text-4xl text-white">{String.fromCharCode(65+i)}</div><span className="text-4xl font-bold text-white text-left leading-tight">{opt}</span></div>))}</div>)}
            </div>
         )}
      </div>
    </div>
  );
});

const LeaderboardMode = memo(({ list }) => (
   <div className="h-full pt-32 px-16 relative z-20 flex flex-col items-center">
      <h1 className="font-display text-[6rem] text-yellow-400 mb-8 uppercase">Classifica</h1>
      <div className="w-full max-w-4xl space-y-3">
         {list.slice(0, 7).map((p, i) => (<div key={i} className={`flex items-center p-4 rounded-xl border border-white/10 ${i===0?'bg-yellow-500/20 scale-105':i===1?'bg-gray-400/20':i===2?'bg-orange-700/20':'bg-white/5'} anim-entry`}><div className={`font-display text-4xl w-20 text-center ${i===0?'text-yellow-400':'text-white/40'}`}>#{i+1}</div><div className="flex-1 text-3xl font-bold text-white truncate px-4">{p.nickname}</div><div className="font-mono text-4xl font-bold text-fuchsia-400">{p.score}</div></div>))}
      </div>
   </div>
));

const IdleMode = memo(({ pub }) => (<div className="h-full flex flex-col items-center justify-center relative z-20 text-center"><div className="w-[600px] h-[600px] bg-fuchsia-600/20 rounded-full blur-[100px] absolute z-0 animate-pulse"></div><div className="relative z-10">{pub?.logo_url ? (<img src={pub.logo_url} className="w-64 h-64 rounded-3xl object-cover shadow-2xl border-4 border-white/20 mx-auto mb-12" alt="logo"/>) : (<Music className="w-48 h-48 text-white/20 mx-auto mb-12" />)}<h1 className="font-display text-[8rem] leading-none text-white drop-shadow-2xl mb-4">{pub?.name}</h1><div className="bg-white text-black px-12 py-4 rounded-full inline-block mt-8"><span className="font-bold text-2xl uppercase tracking-[0.4em]">Benvenuti</span></div></div></div>));

// FIX: Font size reduced from 6xl to 4xl
const AdminMessage = ({ msg }) => {
   const [show, setShow] = useState(false); const lastId = useRef(null);
   useEffect(() => { if(msg && msg.id !== lastId.current) { lastId.current = msg.id; setShow(true); setTimeout(() => setShow(false), 10000); } }, [msg]);
   if(!show || !msg) return null;
   return (<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/95 border border-fuchsia-500 p-8 rounded-3xl z-[100] max-w-4xl w-full text-center shadow-2xl anim-entry"><MessageSquare className="w-16 h-16 text-fuchsia-500 mx-auto mb-4" /><div className="text-2xl font-bold text-white/60 mb-2 uppercase tracking-widest">Messaggio dalla Regia</div><div className="text-4xl font-bold text-white leading-tight">{msg.text}</div></div>);
};

export default function PubDisplay() {
  const { pubCode } = useParams();
  const [data, setData] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [newReaction, setNewReaction] = useState(null);
  const [quizResults, setQuizResults] = useState(null);

  const load = useCallback(async () => {
     if(!pubCode) return;
     const res = await api.getDisplayData(pubCode);
     if(res.data) {
        setData(res.data);
        const q = res.data.active_quiz;
        if(q && (q.status === 'showing_results' || q.status === 'leaderboard')) { const r = await api.getQuizResults(q.id); setQuizResults(r.data); } else { setQuizResults(null); }
     }
  }, [pubCode]);

  useEffect(() => {
     load(); const interval = setInterval(load, 3000);
     const sub = supabase.channel(`tv_${pubCode}`).on('postgres_changes', { event: '*', schema: 'public', table: 'performances' }, load).on('postgres_changes', { event: '*', schema: 'public', table: 'quizzes' }, load).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reactions' }, (p) => setNewReaction(p.new)).on('broadcast', { event: 'control' }, (p) => { if(p.payload.command === 'mute') setIsMuted(p.payload.value); }).subscribe();
     return () => { clearInterval(interval); supabase.removeChannel(sub); };
  }, [pubCode, load]);

  if (!data) return <div className="bg-black h-screen flex items-center justify-center text-white font-display text-4xl animate-pulse">NEONPUB...</div>;
  const { pub, current_performance: perf, queue, leaderboard, active_quiz: quiz, latest_message: msg } = data;
  const isLeaderboard = quiz?.status === 'leaderboard';
  const isQuiz = quiz && ['active', 'closed', 'showing_results'].includes(quiz.status);
  
  // FIX: Include 'ended' status for karaoke to show the Score screen properly
  const isKaraoke = !isQuiz && !isLeaderboard && perf && ['live', 'paused', 'voting', 'ended'].includes(perf.status);
  
  return (
    <div className="tv-root relative w-screen h-screen animated-bg">
      <style>{DISPLAY_STYLES}</style>
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20 pointer-events-none z-0 mix-blend-overlay"></div>
      <LogoHeader pub={pub} count={leaderboard?.length || 0} isMuted={isMuted} />
      <QrCorner pubCode={pubCode} />
      <FloatingReactions newReaction={newReaction} />
      <AdminMessage msg={msg} />
      {isLeaderboard ? (<LeaderboardMode list={leaderboard} />) : isQuiz ? (<QuizMode quiz={quiz} result={quizResults} />) : isKaraoke ? (<KaraokeMode perf={perf} nextSongs={queue || []} isVoting={perf.status === 'voting'} voteResult={perf.status === 'ended' ? perf.average_score : null} />) : (<IdleMode pub={pub} />)}
      {!isQuiz && !isLeaderboard && (<div className="absolute bottom-0 w-full bg-black/80 backdrop-blur-md border-t border-white/10 py-3 z-50 overflow-hidden flex items-center"><div className="bg-fuchsia-600 px-6 py-1 mx-4 rounded text-sm font-bold tracking-widest uppercase shrink-0">In Coda</div><div className="whitespace-nowrap overflow-hidden w-full mask-linear-fade"><div className="ticker-track inline-block">{queue?.length > 0 ? queue.map((s, i) => (<span key={i} className="mx-8 text-xl text-white/70 font-light"><span className="font-bold text-white">{s.user_nickname}</span> - {s.title}</span>)) : <span className="text-xl text-white/50">Coda vuota. Scansiona il QR per cantare!</span>}</div></div></div>)}
    </div>
  );
}