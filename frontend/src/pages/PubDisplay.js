import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '@/lib/supabase';
import api from '@/lib/api';
import { Music, Trophy, Mic2, Crown, Star, VolumeX, MessageSquare, Users, Zap, Clock } from 'lucide-react';
import QuizMediaFixed from '@/components/QuizMediaFixed';
import FloatingReactions from '@/components/FloatingReactions';

// ====================================================
// STYLES & FONTS
// ====================================================
const DISPLAY_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Anton&family=Outfit:wght@300;400;600;800&display=swap');
  
  .tv-root { 
    font-family: 'Outfit', sans-serif; 
    overflow: hidden; 
    background: #000; 
    color: white;
  }
  .font-display { font-family: 'Anton', sans-serif; letter-spacing: 1px; }
  
  /* Animations */
  @keyframes slide-up-fade { from { transform: translateY(50px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
  .anim-entry { animation: slide-up-fade 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
  
  @keyframes pulse-soft { 0%, 100% { opacity: 1; } 50% { opacity: 0.7; } }
  .anim-pulse { animation: pulse-soft 2s infinite; }

  @keyframes scroll-ticker { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
  .ticker-track { animation: scroll-ticker 30s linear infinite; }

  @keyframes bg-pan { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
  .animated-bg { 
    background: linear-gradient(-45deg, #1a0b2e, #2e0b1f, #0f172a, #000000); 
    background-size: 400% 400%; 
    animation: bg-pan 15s ease infinite; 
  }

  .glass-panel {
    background: rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
  }
`;

// ====================================================
// COMPONENTS
// ====================================================

const LogoHeader = ({ pub, count, isMuted }) => (
  <div className="absolute top-8 left-8 z-50 flex items-center gap-4 anim-entry">
    {pub?.logo_url ? (
      <img src={pub.logo_url} className="w-16 h-16 rounded-xl object-cover shadow-2xl border border-white/20" alt="logo" />
    ) : (
      <div className="w-16 h-16 rounded-xl bg-fuchsia-600 flex items-center justify-center font-display text-2xl border border-white/20">NP</div>
    )}
    <div>
      <h1 className="text-2xl font-bold leading-none text-white drop-shadow-md">{pub?.name || "NEONPUB"}</h1>
      <div className="flex items-center gap-3 mt-1 text-white/60">
        <span className="flex items-center gap-1 text-sm bg-white/10 px-2 py-0.5 rounded-full"><Users className="w-3 h-3" /> {count} Online</span>
        {isMuted && <span className="flex items-center gap-1 text-red-400 text-sm bg-red-900/20 px-2 py-0.5 rounded-full"><VolumeX className="w-3 h-3" /> MUTED</span>}
      </div>
    </div>
  </div>
);

const QrCorner = ({ pubCode }) => (
  <div className="absolute top-8 right-8 z-50 flex flex-col items-center bg-white p-3 rounded-2xl shadow-[0_0_40px_rgba(255,255,255,0.2)] anim-entry" style={{animationDelay: '0.2s'}}>
    <QRCodeSVG value={`${window.location.origin}/join/${pubCode}`} size={120} />
    <div className="text-black font-display text-2xl mt-1 tracking-widest">{pubCode}</div>
    <div className="text-[10px] text-black/60 font-bold uppercase tracking-wider">Scansiona per partecipare</div>
  </div>
);

// --- KARAOKE LAYOUT ---
const KaraokeMode = memo(({ perf, nextSongs, isVoting, voteResult }) => {
  // YT Player logic integrata
  useEffect(() => {
    if (!perf?.youtube_url || isVoting || voteResult) return;
    const vidId = perf.youtube_url.match(/v=([^&]+)/)?.[1];
    if (!vidId) return;
    
    let player;
    const init = () => {
      if(!window.YT) return;
      player = new window.YT.Player('tv-player', {
        videoId: vidId,
        playerVars: { autoplay: 1, controls: 0, showinfo: 0, loop: 1, playlist: vidId, mute: 1 }, // Muted BG video
        events: { onReady: (e) => e.target.playVideo() }
      });
    };
    if(!window.YT) { const t = document.createElement('script'); t.src = 'https://www.youtube.com/iframe_api'; document.head.appendChild(t); window.onYouTubeIframeAPIReady = init; } else init();
    return () => { try { player?.destroy(); } catch(e){} };
  }, [perf?.id, isVoting, voteResult]);

  if (isVoting) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center relative z-20">
        <div className="absolute inset-0 bg-yellow-500/20 animate-pulse z-0"></div>
        <Star className="w-40 h-40 text-yellow-400 fill-yellow-400 mb-8 drop-shadow-[0_0_50px_rgba(250,204,21,0.6)] animate-bounce" />
        <h2 className="font-display text-[8rem] leading-none text-white drop-shadow-2xl mb-4">VOTA ORA!</h2>
        <p className="text-4xl text-white/80 font-light">Prendi il telefono e dai un voto a <span className="font-bold text-yellow-400">{perf.user_nickname}</span></p>
      </div>
    );
  }

  if (voteResult) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center relative z-20">
        <Crown className="w-32 h-32 text-yellow-400 mb-6" />
        <div className="font-display text-[15rem] leading-none text-yellow-400 drop-shadow-[0_0_60px_rgba(234,179,8,0.5)]">
          {voteResult.toFixed(1)}
        </div>
        <h2 className="text-5xl text-white font-bold mt-4">PUNTEGGIO FINALE</h2>
        <p className="text-2xl text-white/60 mt-2">{perf.song_title} - {perf.user_nickname}</p>
      </div>
    );
  }

  return (
    <div className="relative h-full flex flex-col justify-end pb-24 px-16 z-20">
      {/* Background Video Layer */}
      <div className="absolute inset-0 z-0 opacity-40 mix-blend-screen pointer-events-none overflow-hidden">
         <div id="tv-player" className="w-full h-full scale-[1.3]"></div> 
      </div>
      
      {/* Content */}
      <div className="relative z-10 w-full max-w-6xl anim-entry">
        <div className="flex items-center gap-4 mb-6">
            <span className="bg-red-600 text-white px-4 py-1 rounded font-bold tracking-widest text-lg animate-pulse">LIVE</span>
            <div className="flex items-center gap-2 bg-white/10 px-4 py-1 rounded-full backdrop-blur-md">
                <Mic2 className="w-6 h-6 text-fuchsia-400" />
                <span className="text-2xl font-semibold text-white">{perf.user_nickname}</span>
            </div>
        </div>
        
        <h1 className="font-display text-[7rem] leading-[0.9] text-white drop-shadow-xl mb-4 line-clamp-2">
          {perf.song_title}
        </h1>
        <h2 className="text-5xl text-fuchsia-300 font-light mb-12 drop-shadow-md">
          {perf.song_artist}
        </h2>

        {/* Next Up */}
        {nextSongs.length > 0 && (
          <div className="glass-panel rounded-2xl p-6 max-w-2xl">
            <h3 className="text-white/40 uppercase tracking-widest text-sm font-bold mb-4 flex items-center gap-2">
               <Clock className="w-4 h-4"/> Coming Next
            </h3>
            <div className="space-y-4">
               {nextSongs.slice(0, 2).map((s, i) => (
                 <div key={i} className="flex items-center gap-4">
                    <span className="font-display text-3xl text-white/20 w-8">{i+1}</span>
                    <div className="flex-1 overflow-hidden">
                       <div className="text-2xl font-bold truncate text-white">{s.title}</div>
                       <div className="text-lg text-white/50 truncate">{s.artist}</div>
                    </div>
                    <div className="bg-white/10 px-3 py-1 rounded text-sm text-fuchsia-300">{s.user_nickname}</div>
                 </div>
               ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

// --- QUIZ LAYOUT ---
const QuizMode = memo(({ quiz, result }) => {
  const colors = ['bg-blue-600', 'bg-red-600', 'bg-yellow-500', 'bg-green-600'];
  
  if (quiz.status === 'leaderboard') return null; // Handled by Main

  return (
    <div className="h-full flex flex-col pt-32 pb-12 px-16 relative z-20">
      <QuizMediaFixed mediaUrl={quiz.media_url} mediaType={quiz.media_type} isResult={!!result} />
      
      {/* Category Pill */}
      <div className="absolute top-8 left-1/2 -translate-x-1/2 glass-panel px-8 py-2 rounded-full z-30">
        <span className="text-fuchsia-400 font-bold tracking-[0.3em] uppercase">{quiz.category || "QUIZ"}</span>
      </div>

      <div className="flex-1 flex flex-col justify-center items-center text-center relative z-30">
         {result ? (
            <div className="anim-entry w-full max-w-5xl">
               <div className="text-3xl text-white/50 uppercase tracking-widest mb-6 font-bold">La risposta corretta è</div>
               <div className="bg-green-600 p-12 rounded-3xl shadow-[0_0_100px_rgba(22,163,74,0.4)] mb-12 border-4 border-green-400">
                  <span className="font-display text-[6rem] leading-none text-white">{result.correct_option}</span>
               </div>
               <div className="grid grid-cols-3 gap-8 text-center">
                  <div className="glass-panel p-6 rounded-2xl">
                     <div className="text-5xl font-bold text-white mb-2">{result.total_answers}</div>
                     <div className="text-sm uppercase text-white/40 font-bold">Risposte Totali</div>
                  </div>
                  <div className="glass-panel p-6 rounded-2xl">
                     <div className="text-5xl font-bold text-green-400 mb-2">{result.correct_count}</div>
                     <div className="text-sm uppercase text-white/40 font-bold">Corrette</div>
                  </div>
                  <div className="glass-panel p-6 rounded-2xl">
                     <div className="text-5xl font-bold text-yellow-400 mb-2">{quiz.points}</div>
                     <div className="text-sm uppercase text-white/40 font-bold">Punti in palio</div>
                  </div>
               </div>
            </div>
         ) : (
            <div className="w-full max-w-7xl anim-entry">
               <h2 className="font-display text-[5rem] leading-[1.1] text-white drop-shadow-lg mb-16 text-center">
                  {quiz.question}
               </h2>
               
               {quiz.status === 'closed' ? (
                  <div className="bg-red-900/80 p-8 rounded-2xl border border-red-500 animate-pulse inline-block">
                     <h3 className="text-4xl font-bold text-white uppercase tracking-widest">Tempo Scaduto!</h3>
                  </div>
               ) : (
                  <div className="grid grid-cols-2 gap-6 w-full">
                     {quiz.options?.map((opt, i) => (
                        <div key={i} className={`${colors[i%4]} p-8 rounded-2xl shadow-lg border-b-8 border-black/20 flex items-center gap-6`}>
                           <div className="w-16 h-16 bg-black/30 rounded-full flex items-center justify-center font-display text-4xl text-white">{String.fromCharCode(65+i)}</div>
                           <span className="text-4xl font-bold text-white text-left leading-tight">{opt}</span>
                        </div>
                     ))}
                  </div>
               )}
            </div>
         )}
      </div>
    </div>
  );
});

// --- LEADERBOARD ---
const LeaderboardMode = memo(({ list }) => (
   <div className="h-full pt-32 px-16 relative z-20 flex flex-col items-center">
      <h1 className="font-display text-[6rem] text-yellow-400 drop-shadow-[0_0_30px_rgba(234,179,8,0.6)] mb-8 uppercase">Classifica</h1>
      <div className="w-full max-w-4xl space-y-3">
         {list.slice(0, 7).map((p, i) => (
            <div key={i} className={`flex items-center p-4 rounded-xl border border-white/10 ${i===0?'bg-yellow-500/20 scale-105 shadow-xl':i===1?'bg-gray-400/20':i===2?'bg-orange-700/20':'bg-white/5'} anim-entry`} style={{animationDelay: `${i*0.1}s`}}>
               <div className={`font-display text-4xl w-20 text-center ${i===0?'text-yellow-400':i===1?'text-gray-300':i===2?'text-orange-400':'text-white/40'}`}>#{i+1}</div>
               <div className="flex-1 text-3xl font-bold text-white truncate px-4">{p.nickname}</div>
               <div className="font-mono text-4xl font-bold text-fuchsia-400">{p.score}</div>
            </div>
         ))}
      </div>
   </div>
));

// --- IDLE / SPLASH ---
const IdleMode = memo(({ pub }) => (
   <div className="h-full flex flex-col items-center justify-center relative z-20 text-center">
      <div className="w-[600px] h-[600px] bg-fuchsia-600/20 rounded-full blur-[100px] absolute z-0 animate-pulse"></div>
      <div className="relative z-10">
         {pub?.logo_url ? (
            <img src={pub.logo_url} className="w-64 h-64 rounded-3xl object-cover shadow-[0_0_60px_rgba(0,0,0,0.5)] border-4 border-white/20 mx-auto mb-12" alt="logo"/>
         ) : (
            <Music className="w-48 h-48 text-white/20 mx-auto mb-12" />
         )}
         <h1 className="font-display text-[8rem] leading-none text-white drop-shadow-2xl mb-4">{pub?.name}</h1>
         <div className="bg-white text-black px-12 py-4 rounded-full inline-block mt-8">
            <span className="font-bold text-2xl uppercase tracking-[0.4em]">Benvenuti</span>
         </div>
      </div>
   </div>
));

// --- MESSAGE TOAST ---
const AdminMessage = ({ msg }) => {
   const [show, setShow] = useState(false);
   const lastId = useRef(null);
   useEffect(() => {
      if(msg && msg.id !== lastId.current) { lastId.current = msg.id; setShow(true); setTimeout(() => setShow(false), 10000); }
   }, [msg]);
   
   if(!show || !msg) return null;
   return (
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/90 border-2 border-fuchsia-500 p-12 rounded-3xl z-[100] max-w-5xl w-full text-center shadow-[0_0_100px_rgba(0,0,0,0.8)] anim-entry">
         <MessageSquare className="w-24 h-24 text-fuchsia-500 mx-auto mb-6" />
         <div className="text-4xl font-bold text-white/60 mb-4 uppercase tracking-widest">Comunicazione di Servizio</div>
         <div className="text-6xl font-bold text-white leading-tight">{msg.text}</div>
      </div>
   );
};

// ====================================================
// MAIN COMPONENT
// ====================================================
export default function PubDisplay() {
  const { pubCode } = useParams();
  const [data, setData] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [newReaction, setNewReaction] = useState(null);
  
  // Quiz specific states for UI stability
  const [quizResults, setQuizResults] = useState(null);

  const load = useCallback(async () => {
     if(!pubCode) return;
     const res = await api.getDisplayData(pubCode);
     if(res.data) {
        setData(res.data);
        const q = res.data.active_quiz;
        if(q && (q.status === 'showing_results' || q.status === 'leaderboard')) {
           const r = await api.getQuizResults(q.id);
           setQuizResults(r.data);
        } else {
           setQuizResults(null);
        }
     }
  }, [pubCode]);

  useEffect(() => {
     load();
     const interval = setInterval(load, 3000);
     
     const sub = supabase.channel(`tv_${pubCode}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'performances' }, load)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'quizzes' }, load)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reactions' }, (p) => setNewReaction(p.new))
        .on('broadcast', { event: 'control' }, (p) => { if(p.payload.command === 'mute') setIsMuted(p.payload.value); })
        .subscribe();
        
     return () => { clearInterval(interval); supabase.removeChannel(sub); };
  }, [pubCode, load]);

  if (!data) return <div className="bg-black h-screen flex items-center justify-center text-white font-display text-4xl animate-pulse">NEONPUB LOADING...</div>;

  const { pub, current_performance: perf, queue, leaderboard, active_quiz: quiz, latest_message: msg } = data;
  
  // Decide Mode
  const isLeaderboard = quiz?.status === 'leaderboard';
  const isQuiz = quiz && ['active', 'closed', 'showing_results'].includes(quiz.status);
  const isKaraoke = !isQuiz && !isLeaderboard && perf && ['live', 'paused', 'voting', 'ended'].includes(perf.status);
  
  return (
    <div className="tv-root relative w-screen h-screen animated-bg">
      <style>{DISPLAY_STYLES}</style>
      
      {/* Background Overlay Texture */}
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20 pointer-events-none z-0 mix-blend-overlay"></div>
      
      {/* GLOBAL UI ELEMENTS */}
      <LogoHeader pub={pub} count={leaderboard?.length || 0} isMuted={isMuted} />
      <QrCorner pubCode={pubCode} />
      <FloatingReactions newReaction={newReaction} />
      <AdminMessage msg={msg} />

      {/* CONTENT LAYERS */}
      {isLeaderboard ? (
         <LeaderboardMode list={leaderboard} />
      ) : isQuiz ? (
         <QuizMode quiz={quiz} result={quizResults} />
      ) : isKaraoke ? (
         <KaraokeMode 
            perf={perf} 
            nextSongs={queue || []} 
            isVoting={perf.status === 'voting'} 
            voteResult={perf.status === 'ended' ? perf.average_score : null} 
         />
      ) : (
         <IdleMode pub={pub} />
      )}

      {/* FOOTER TICKER (Solo Karaoke/Idle) */}
      {!isQuiz && !isLeaderboard && (
         <div className="absolute bottom-0 w-full bg-black/80 backdrop-blur-md border-t border-white/10 py-3 z-50 overflow-hidden flex items-center">
             <div className="bg-fuchsia-600 px-6 py-1 mx-4 rounded text-sm font-bold tracking-widest uppercase shrink-0">In Coda</div>
             <div className="whitespace-nowrap overflow-hidden w-full mask-linear-fade">
                 <div className="ticker-track inline-block">
                     {queue?.length > 0 ? queue.map((s, i) => (
                        <span key={i} className="mx-8 text-xl text-white/70 font-light">
                           <span className="font-bold text-white">{s.user_nickname}</span> - {s.title}
                        </span>
                     )) : <span className="text-xl text-white/50">La coda è vuota. Scansiona il QR per cantare!</span>}
                     {/* Duplicate for loop */}
                     {queue?.length > 0 && queue.map((s, i) => (
                        <span key={`d-${i}`} className="mx-8 text-xl text-white/70 font-light">
                           <span className="font-bold text-white">{s.user_nickname}</span> - {s.title}
                        </span>
                     ))}
                 </div>
             </div>
         </div>
      )}
    </div>
  );
}