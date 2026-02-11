import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '@/lib/supabase';
import api from '@/lib/api';
import { Music, Mic2, Star, Trophy, Users, MessageSquare, Clock, Disc, Zap } from 'lucide-react';
import KaraokePlayer from '@/components/KaraokePlayer';
import QuizMediaFixed from '@/components/QuizMediaFixed';
import FloatingReactions from '@/components/FloatingReactions';

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;800;900&family=JetBrains+Mono:wght@500&display=swap');
  :root { --glass-bg: rgba(15, 15, 20, 0.7); --glass-border: rgba(255, 255, 255, 0.1); }
  body { background: #000; overflow: hidden; font-family: 'Montserrat', sans-serif; color: white; }
  .glass-panel { background: var(--glass-bg); backdrop-filter: blur(20px); border: 1px solid var(--glass-border); box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.5); }
  
  /* Animazione Ticker Messaggi (A nastro infinito) */
  @keyframes ticker-scroll { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
  .ticker-container { display: flex; width: max-content; animation: ticker-scroll 40s linear infinite; }
  .ticker-item { display: flex; align-items: center; gap: 15px; margin-right: 80px; white-space: nowrap; }

  @keyframes gradient-move { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
  .animated-bg { background: linear-gradient(-45deg, #101010, #1a0b2e, #0f172a, #000); background-size: 400% 400%; animation: gradient-move 20s ease infinite; }
  .text-glow { text-shadow: 0 0 30px rgba(217,70,239, 0.6); }
`;

const TopBar = ({ pubName, logoUrl, onlineCount, messages = [], isMuted }) => {
  // Duplichiamo i messaggi per creare l'effetto infinito nel nastro
  const scrollMessages = messages.length > 0 ? [...messages, ...messages] : [];

  return (
    <div className="absolute top-0 left-0 right-0 h-24 z-[100] flex items-center justify-between px-8 bg-gradient-to-b from-black/90 via-black/60 to-transparent">
      <div className="flex items-center gap-5">
        {logoUrl ? <img src={logoUrl} className="w-16 h-16 rounded-xl border-2 border-white/20 object-cover bg-black" /> : <div className="w-16 h-16 rounded-xl bg-fuchsia-600 flex items-center justify-center border-2 border-white/20 font-black text-xl">NP</div>}
        <div>
          <h1 className="text-3xl font-black text-white tracking-wider uppercase">{pubName || "NEONPUB"}</h1>
          <div className="flex items-center gap-3">
            <span className="bg-red-600 px-2 py-0.5 rounded text-[10px] font-bold animate-pulse uppercase">LIVE</span>
            {onlineCount > 0 && <span className="text-fuchsia-400 font-bold text-xs">● {onlineCount} ONLINE</span>}
            {isMuted && <span className="bg-red-900 border border-red-500 px-2 py-0.5 rounded text-[10px] font-bold">AUDIO OFF</span>}
          </div>
        </div>
      </div>
      
      {/* TICKER MESSAGGI (IL NASTRO CONTINUO) */}
      <div className="flex-1 mx-16 h-14 glass-panel rounded-full flex items-center overflow-hidden">
        {scrollMessages.length > 0 ? (
          <div className="ticker-container">
            {scrollMessages.map((m, i) => (
              <div key={i} className="ticker-item">
                <MessageSquare className="w-5 h-5 text-fuchsia-400" />
                <span className="text-fuchsia-300 font-bold">{m.nickname}:</span>
                <span className="text-lg text-white font-medium">{m.text}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-10 text-white/30 text-sm font-bold tracking-widest uppercase">In attesa di messaggi dalla sala...</div>
        )}
      </div>

      <div className="glass-panel px-6 py-2 rounded-xl flex flex-col items-center justify-center">
         <span className="text-[10px] text-fuchsia-400 font-bold uppercase tracking-widest">Ora al</span>
         <span className="text-xl font-black">{pubName || "NeonPub"}</span>
      </div>
    </div>
  );
};

const Sidebar = ({ pubCode, queue, leaderboard }) => (
  <div className="absolute top-28 right-6 bottom-6 w-[350px] z-[90] flex flex-col gap-6">
    <div className="glass-panel p-6 rounded-3xl flex flex-col items-center justify-center relative overflow-hidden">
      <div className="bg-white p-3 rounded-2xl mb-4 relative z-10 shadow-2xl">
        <QRCodeSVG value={`${window.location.origin}/join/${pubCode}`} size={180} />
      </div>
      <div className="text-5xl font-black text-white tracking-widest font-mono relative z-10 drop-shadow-xl">{pubCode}</div>
      <div className="text-xs text-white/60 uppercase mt-2 font-bold tracking-widest relative z-10">Scansiona e partecipa</div>
    </div>
    
    <div className="glass-panel rounded-3xl flex flex-col overflow-hidden flex-1 max-h-[40%]">
      <div className="p-4 border-b border-white/10 bg-black/40 sticky top-0 z-10">
        <div className="flex items-center gap-2 text-fuchsia-400 font-black uppercase text-xs tracking-widest">
          <Clock className="w-4 h-4"/> In Arrivo
        </div>
      </div>
      <div className="flex-1 p-4 space-y-3 overflow-y-auto custom-scrollbar">
        {queue?.length > 0 ? queue.slice(0, 5).map((req, i) => (
          <div key={i} className="bg-white/5 p-3 rounded-2xl border-l-4 border-fuchsia-600 flex items-center gap-4">
            <img src={req.user_avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${req.user_nickname}`} className="w-10 h-10 rounded-full border border-white/10" />
            <div className="overflow-hidden">
              <div className="text-white font-bold text-sm truncate">{req.user_nickname}</div>
              <div className="text-white/50 text-xs truncate">{req.title}</div>
            </div>
          </div>
        )) : <div className="text-center text-white/10 p-10 italic text-sm">Coda vuota...</div>}
      </div>
    </div>

    <div className="glass-panel rounded-3xl flex flex-col overflow-hidden flex-1">
      <div className="p-4 border-b border-white/10 bg-black/40 sticky top-0 z-10">
        <div className="flex items-center gap-2 text-yellow-400 font-black uppercase text-xs tracking-widest">
          <Trophy className="w-4 h-4"/> Classifica Generale
        </div>
      </div>
      <div className="flex-1 p-4 space-y-2 overflow-y-auto custom-scrollbar">
        {leaderboard?.slice(0, 10).map((p, i) => (
          <div key={i} className={`p-2.5 rounded-xl flex items-center gap-3 ${i === 0 ? 'bg-yellow-500/10 border border-yellow-500/20' : 'bg-white/5'}`}>
            <div className={`font-mono font-bold w-6 text-center ${i === 0 ? 'text-yellow-400' : 'text-white/30'}`}>{i+1}</div>
            <img src={p.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.nickname}`} className="w-8 h-8 rounded-full" />
            <div className="flex-1 truncate font-bold text-sm text-white">{p.nickname}</div>
            <div className="font-mono text-cyan-400 font-bold">{Math.floor(p.score || 0)}</div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const QuizMode = ({ quiz, result }) => (
  <div className="w-full h-full flex flex-col bg-[#080808] relative p-12 overflow-hidden">
    <QuizMediaFixed mediaUrl={quiz.media_url} mediaType={quiz.media_type} isResult={!!result} />
    <div className="absolute inset-0 bg-black/70 z-10 pointer-events-none"></div>
    <div className="relative z-20 flex-1 flex flex-col items-center justify-center mr-[350px]">
      <div className="bg-fuchsia-600 text-white px-10 py-3 rounded-full font-black text-xl uppercase tracking-widest mb-12 shadow-2xl border-2 border-white/20 transform -rotate-2">
        {quiz.category || "SFIDA MUSICALE"}
      </div>

      {result ? (
        <div className="w-full max-w-5xl animate-in zoom-in duration-500 flex flex-col items-center">
          <div className="bg-green-600/90 backdrop-blur-md p-10 rounded-[3rem] mb-12 border-4 border-green-400 text-center w-full shadow-2xl">
            <div className="text-white/60 uppercase font-bold tracking-widest text-sm mb-2">Risposta Corretta</div>
            <span className="text-7xl font-black text-white leading-tight">{result.correct_option}</span>
          </div>

          <div className="w-full glass-panel p-10 rounded-[3rem] border-t-8 border-fuchsia-500">
            <h3 className="text-fuchsia-400 font-black uppercase tracking-widest mb-8 flex items-center gap-4 text-3xl justify-center">
              <Zap className="w-8 h-8"/> CHI HA INDOVINATO
            </h3>
            <div className="grid grid-cols-2 gap-6">
              {result.winners?.length > 0 ? result.winners.map((w, i) => (
                <div key={i} className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/10">
                  <div className="bg-yellow-500 text-black font-black w-8 h-8 rounded-lg flex items-center justify-center text-lg">{i+1}</div>
                  <img src={w.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${w.nickname}`} className="w-14 h-14 rounded-full border-2 border-fuchsia-500/50 object-cover" />
                  <span className="text-white font-black text-3xl truncate flex-1">{w.nickname}</span>
                  <div className="text-green-400 font-mono font-black text-2xl">+{w.points}</div>
                </div>
              )) : <div className="col-span-2 text-center text-white/20 italic text-2xl py-10">Nessuno ha indovinato!</div>}
            </div>
          </div>
        </div>
      ) : (
        <div className="w-full max-w-7xl text-center">
          <h1 className="text-8xl font-black text-white leading-tight mb-20 drop-shadow-2xl">{quiz.question}</h1>
          <div className="grid grid-cols-2 gap-8">
            {quiz.options.map((opt, i) => (
              <div key={i} className="glass-panel border-l-[15px] border-fuchsia-600 p-10 rounded-r-3xl flex items-center gap-8 text-left transition-all hover:scale-105 duration-300">
                <div className="w-24 h-24 bg-black/40 rounded-2xl flex items-center justify-center text-5xl font-black text-white shrink-0 font-mono border border-white/10">
                  {String.fromCharCode(65+i)}
                </div>
                <div className="text-5xl font-bold text-white leading-tight">{opt}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  </div>
);

const KaraokeMode = ({ perf, isMuted }) => (
  <div className="w-full h-full relative">
    <div className="absolute inset-0 right-[380px] bg-black">
      <KaraokePlayer key={perf.id} url={perf.youtube_url} status={perf.status} isMuted={isMuted} />
    </div>
    <div className="absolute bottom-10 left-10 right-[420px] z-[80]">
      <div className="glass-panel p-6 rounded-2xl border-l-[12px] border-fuchsia-500 flex items-end gap-6 shadow-2xl">
        <div className="relative">
          <div className="absolute inset-0 bg-fuchsia-500 blur-2xl opacity-40 rounded-full"></div>
          <img src={perf.user_avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${perf.user_nickname}`} className="w-24 h-24 rounded-full border-4 border-white/20 relative z-10 bg-zinc-900 shadow-2xl" />
          <div className="absolute -bottom-2 -right-2 bg-red-600 text-white text-xs font-black px-3 py-1 rounded-full z-20 border-2 border-white/20 animate-pulse">LIVE</div>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Mic2 className="w-5 h-5 text-fuchsia-400" />
            <span className="text-2xl font-black text-white tracking-wide">{perf.user_nickname}</span>
          </div>
          <h1 className="text-5xl font-black text-white leading-none line-clamp-1 text-glow mb-1">{perf.song_title}</h1>
          <h2 className="text-2xl text-white/60 font-bold uppercase tracking-widest">{perf.song_artist}</h2>
        </div>
      </div>
    </div>
  </div>
);

const VotingMode = ({ perf }) => (
  <div className="w-full h-full flex flex-col items-center justify-center bg-black relative overflow-hidden">
    <div className="absolute inset-0 bg-fuchsia-900/30 animate-pulse"></div>
    <div className="relative z-10 text-center mr-[350px]">
      <Star className="w-64 h-64 text-yellow-400 fill-yellow-400 mx-auto mb-10 animate-bounce drop-shadow-[0_0_80px_rgba(234,179,8,0.8)]" />
      <h1 className="text-[12rem] font-black text-white leading-none transform -skew-x-6 drop-shadow-2xl">VOTA ORA!</h1>
      <div className="glass-panel px-16 py-8 rounded-full mt-10 border-4 border-yellow-500/50">
        <p className="text-5xl text-white font-black">Vota l'esibizione di <span className="text-yellow-400 underline decoration-fuchsia-500 decoration-8">{perf.user_nickname}</span></p>
      </div>
    </div>
  </div>
);

const ScoreMode = ({ perf }) => (
  <div className="w-full h-full flex flex-col items-center justify-center bg-black relative">
    <div className="relative z-10 mr-[350px] text-center">
      <Trophy className="w-64 h-64 text-yellow-500 mx-auto mb-8 drop-shadow-[0_0_80px_rgba(234,179,8,0.4)]" />
      <h2 className="text-5xl text-white/50 font-black uppercase tracking-[0.3em] mb-6">Punteggio Finale</h2>
      <div className="text-[20rem] font-black text-white leading-none drop-shadow-2xl scale-110">
        {perf.average_score?.toFixed(1) || "0.0"}
      </div>
    </div>
  </div>
);

const IdleMode = ({ pub }) => (
  <div className="w-full h-full flex flex-col items-center justify-center animated-bg relative">
    <div className="relative z-10 text-center mr-[350px]">
      {pub.logo_url && <img src={pub.logo_url} className="w-80 h-80 rounded-[4rem] mb-12 mx-auto shadow-[0_0_100px_rgba(0,0,0,0.8)] border-4 border-white/20 object-cover bg-black" />}
      <h1 className="text-[10rem] font-black text-white tracking-tighter leading-none mb-10 drop-shadow-2xl">{pub.name}</h1>
      <div className="glass-panel px-20 py-8 rounded-full inline-block border-2 border-white/20">
        <span className="text-5xl text-white/90 font-black uppercase tracking-[0.5em]">Si comincia tra poco...</span>
      </div>
    </div>
  </div>
);

export default function PubDisplay() {
  const { pubCode } = useParams();
  const [data, setData] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [quizResult, setQuizResult] = useState(null);
  const [newReaction, setNewReaction] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await api.getDisplayData(pubCode);
      if(res.data) {
        setData(res.data);
        const q = res.data.active_quiz;
        if(q && (q.status === 'showing_results' || q.status === 'leaderboard')) {
          setQuizResult((await api.getQuizResults(q.id)).data);
        } else { setQuizResult(null); }
      }
    } catch(e) { console.error(e); }
  }, [pubCode]);

  useEffect(() => {
    load();
    const int = setInterval(load, 3000);
    const ch = supabase.channel('tv_ctrl')
      .on('broadcast', {event: 'control'}, p => { if(p.payload.command === 'mute') setIsMuted(p.payload.value); })
      .on('postgres_changes', {event: 'INSERT', schema: 'public', table: 'reactions'}, p => setNewReaction(p.new))
      .on('postgres_changes', {event: '*', schema: 'public', table: 'performances'}, load)
      .on('postgres_changes', {event: '*', schema: 'public', table: 'quizzes'}, load)
      .subscribe();
    return () => { clearInterval(int); supabase.removeChannel(ch); };
  }, [pubCode, load]);

  if (!data) return <div className="w-screen h-screen bg-black flex items-center justify-center text-white font-black text-5xl animate-pulse">CARICAMENTO NEONPUB...</div>;

  const { pub, current_performance: perf, queue, active_quiz: quiz, leaderboard, approved_messages } = data;
  const isQuiz = quiz && ['active', 'closed', 'showing_results'].includes(quiz.status);
  const isVoting = !isQuiz && perf && perf.status === 'voting';
  const isScore = !isQuiz && perf && perf.status === 'ended';
  const isKaraoke = !isQuiz && perf && ['live', 'paused'].includes(perf.status);
  
  let Content = <IdleMode pub={pub} />;
  if (isQuiz) Content = <QuizMode quiz={quiz} result={quizResult} />;
  else if (isVoting) Content = <VotingMode perf={perf} />;
  else if (isScore) Content = <ScoreMode perf={perf} />;
  else if (isKaraoke) Content = <KaraokeMode perf={perf} isMuted={isMuted} />;

  return (
    <div className="w-screen h-screen relative bg-black overflow-hidden">
      <style>{STYLES}</style>
      <TopBar pubName={pub.name} logoUrl={pub.logo_url} onlineCount={leaderboard?.length || 0} messages={approved_messages} isMuted={isMuted} />
      <FloatingReactions newReaction={newReaction} />
      <div className="w-full h-full pt-24 relative z-10">{Content}</div>
      <Sidebar pubCode={pubCode} queue={queue} leaderboard={leaderboard} />
    </div>
  );
}