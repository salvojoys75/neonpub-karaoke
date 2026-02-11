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
  @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;800;900&display=swap');
  :root { --glass-bg: rgba(15, 15, 20, 0.7); --glass-border: rgba(255, 255, 255, 0.1); }
  body { background: #000; overflow: hidden; font-family: 'Montserrat', sans-serif; color: white; }
  .glass-panel { background: var(--glass-bg); backdrop-filter: blur(20px); border: 1px solid var(--glass-border); }
  @keyframes ticker-scroll { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
  .ticker-container { display: flex; width: max-content; animation: ticker-scroll 35s linear infinite; }
  .ticker-item { display: flex; align-items: center; gap: 15px; margin-right: 80px; white-space: nowrap; }
  .animated-bg { background: linear-gradient(-45deg, #101010, #1a0b2e, #0f172a, #000); background-size: 400% 400%; animation: gradient-move 20s ease infinite; }
  @keyframes gradient-move { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
`;

const TopBar = ({ pubName, logoUrl, onlineCount, messages = [], isMuted }) => {
  const scrollMessages = messages.length > 0 ? [...messages, ...messages] : [];
  return (
    <div className="absolute top-0 left-0 right-0 h-24 z-[100] flex items-center justify-between px-8 bg-gradient-to-b from-black to-transparent">
      <div className="flex items-center gap-5">
        {logoUrl ? <img src={logoUrl} className="w-16 h-16 rounded-xl border-2 border-white/20 object-cover bg-black" /> : <div className="w-16 h-16 rounded-xl bg-fuchsia-600 flex items-center justify-center border-2 border-white/20 font-black text-xl">NP</div>}
        <h1 className="text-3xl font-black text-white tracking-wider uppercase">{pubName || "NEONPUB"}</h1>
      </div>
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
        ) : <div className="px-10 text-white/20 text-sm font-bold tracking-widest uppercase">In attesa di messaggi...</div>}
      </div>
      <div className="glass-panel px-6 py-2 rounded-xl flex items-center gap-3">
        <Users className="w-5 h-5 text-fuchsia-400"/> 
        <span className="text-2xl font-mono font-bold">{onlineCount}</span>
      </div>
    </div>
  );
};

const Sidebar = ({ pubCode, queue, leaderboard }) => (
  <div className="absolute top-28 right-6 bottom-6 w-[350px] z-[90] flex flex-col gap-6">
    <div className="glass-panel p-6 rounded-3xl flex flex-col items-center justify-center shadow-2xl">
      <div className="bg-white p-3 rounded-2xl mb-4"><QRCodeSVG value={`${window.location.origin}/join/${pubCode}`} size={180} /></div>
      <div className="text-5xl font-black text-white tracking-widest font-mono">{pubCode}</div>
    </div>
    <div className="glass-panel rounded-3xl flex flex-col overflow-hidden flex-1 max-h-[40%]">
      <div className="p-4 border-b border-white/10 bg-black/40 font-black uppercase text-xs tracking-widest flex items-center gap-2 text-fuchsia-400"><Clock className="w-4 h-4"/> In Arrivo</div>
      <div className="flex-1 p-4 space-y-3 overflow-y-auto custom-scrollbar">
        {queue?.slice(0, 5).map((req, i) => (
          <div key={i} className="bg-white/5 p-3 rounded-2xl border-l-4 border-fuchsia-600 flex items-center gap-4">
            <img src={req.user_avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${req.user_nickname}`} className="w-10 h-10 rounded-full" />
            <div className="overflow-hidden"><div className="text-white font-bold text-sm truncate">{req.user_nickname}</div><div className="text-white/50 text-xs truncate">{req.title}</div></div>
          </div>
        ))}
      </div>
    </div>
    <div className="glass-panel rounded-3xl flex flex-col overflow-hidden flex-1">
      <div className="p-4 border-b border-white/10 bg-black/40 font-black uppercase text-xs tracking-widest flex items-center gap-2 text-yellow-400"><Trophy className="w-4 h-4"/> Classifica</div>
      <div className="flex-1 p-4 space-y-2 overflow-y-auto custom-scrollbar">
        {leaderboard?.slice(0, 10).map((p, i) => (
          <div key={i} className="p-2 rounded-xl flex items-center gap-3 bg-white/5">
            <div className="font-mono font-bold w-6 text-center text-white/30">{i+1}</div>
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
      <div className="bg-fuchsia-600 text-white px-10 py-3 rounded-full font-black text-xl uppercase tracking-widest mb-12 shadow-2xl transform -rotate-2">{quiz.category || "SFIDA"}</div>
      {result ? (
        <div className="w-full max-w-5xl animate-in zoom-in duration-500">
          <div className="bg-green-600/90 p-10 rounded-[3rem] mb-12 text-center shadow-2xl border-4 border-green-400">
            <div className="text-white/60 uppercase font-bold text-sm mb-2 tracking-widest">Risposta Corretta</div>
            <span className="text-7xl font-black text-white">{result.correct_option}</span>
          </div>
          <div className="w-full glass-panel p-10 rounded-[3rem] border-t-8 border-fuchsia-500">
            <h3 className="text-fuchsia-400 font-black uppercase tracking-widest mb-8 text-3xl text-center"><Zap className="inline mr-2"/> VINCITORI</h3>
            <div className="grid grid-cols-2 gap-6">
              {result.winners?.map((w, i) => (
                <div key={i} className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/10">
                  <div className="bg-yellow-500 text-black font-black w-8 h-8 rounded-lg flex items-center justify-center">{i+1}</div>
                  <img src={w.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${w.nickname}`} className="w-14 h-14 rounded-full border-2 border-fuchsia-500/50" />
                  <span className="text-white font-black text-3xl truncate flex-1">{w.nickname}</span>
                  <div className="text-green-400 font-black text-2xl">+{w.points}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center">
          <h1 className="text-8xl font-black text-white mb-20 leading-tight">{quiz.question}</h1>
          <div className="grid grid-cols-2 gap-8">
            {quiz.options.map((opt, i) => (
              <div key={i} className="glass-panel border-l-[15px] border-fuchsia-600 p-10 rounded-r-3xl flex items-center gap-8 text-left">
                <div className="w-24 h-24 bg-black/40 rounded-2xl flex items-center justify-center text-5xl font-black">{String.fromCharCode(65+i)}</div>
                <div className="text-5xl font-bold">{opt}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  </div>
);

// ... KaraokeMode, VotingMode, ScoreMode, IdleMode (stessi layout precedenti) ...

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
        if(res.data.active_quiz?.status === 'showing_results') {
          const r = await api.getQuizResults(res.data.active_quiz.id);
          setQuizResult(r.data);
        } else setQuizResult(null);
      }
    } catch(e) { console.error(e); }
  }, [pubCode]);

  useEffect(() => {
    load(); const int = setInterval(load, 3000);
    const ch = supabase.channel('tv_ctrl').on('broadcast', {event: 'control'}, p => { if(p.payload.command === 'mute') setIsMuted(p.payload.value); }).on('postgres_changes', {event: 'INSERT', schema: 'public', table: 'reactions'}, p => setNewReaction(p.new)).subscribe();
    return () => { clearInterval(int); supabase.removeChannel(ch); };
  }, [pubCode, load]);

  if (!data) return <div className="h-screen bg-black flex items-center justify-center text-white font-black text-5xl">NEONPUB...</div>;

  const { pub, current_performance: perf, queue, active_quiz: quiz, leaderboard, approved_messages } = data;
  const isQuiz = quiz && ['active', 'closed', 'showing_results'].includes(quiz.status);
  let Content = <QuizMode quiz={quiz} result={quizResult} />; // Se quiz attivo
  if (!isQuiz) {
      if (perf?.status === 'voting') Content = <div className="text-center mr-[350px]"><Star className="w-64 h-64 text-yellow-400 mx-auto animate-bounce"/><h1 className="text-[12rem] font-black">VOTA!</h1><p className="text-5xl font-bold">Vota l'esibizione di {perf.user_nickname}</p></div>;
      else if (perf?.status === 'ended') Content = <div className="text-center mr-[350px]"><Trophy className="w-64 h-64 text-yellow-500 mx-auto"/><h2 className="text-5xl font-black">Risultato: {perf.average_score?.toFixed(1)}</h2></div>;
      else if (perf) Content = <div className="absolute inset-0 right-[380px]"><KaraokePlayer url={perf.youtube_url} status={perf.status} isMuted={isMuted}/></div>;
      else Content = <div className="text-center mr-[350px]"><h1 className="text-[10rem] font-black">{pub.name}</h1><span className="text-5xl uppercase tracking-[0.5em]">Benvenuti</span></div>;
  }

  return (
    <div className="w-screen h-screen relative bg-black overflow-hidden">
      <style>{STYLES}</style>
      <TopBar pubName={pub.name} logoUrl={pub.logo_url} onlineCount={leaderboard?.length || 0} messages={approved_messages} isMuted={isMuted} />
      <FloatingReactions newReaction={newReaction} />
      <div className="w-full h-full pt-24 relative z-10 flex items-center justify-center">{Content}</div>
      <Sidebar pubCode={pubCode} queue={queue} leaderboard={leaderboard} />
    </div>
  );
}