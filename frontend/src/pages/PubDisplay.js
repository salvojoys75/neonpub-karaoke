import React, { useState, useEffect, useRef, memo } from 'react';
import { useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '@/lib/supabase';
import api from '@/lib/api';
import { Music, Mic2, Star, Trophy, Users, Volume2, MessageSquare } from 'lucide-react';

// ===========================================
// STYLES
// ===========================================
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700;900&display=swap');
  body { background: #000; overflow: hidden; font-family: 'Montserrat', sans-serif; color: white; }
  .glass-box { background: rgba(20, 20, 20, 0.85); backdrop-filter: blur(16px); border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 8px 32px rgba(0,0,0,0.5); }
  @keyframes pulse-glow { 0%, 100% { box-shadow: 0 0 20px rgba(217,70,239,0.2); } 50% { box-shadow: 0 0 40px rgba(217,70,239,0.6); } }
  .glow-border { animation: pulse-glow 3s infinite; }
`;

// ===========================================
// COMPONENTS
// ===========================================

const TopBar = ({ pubName, onlineCount, msg }) => (
  <div className="absolute top-0 left-0 right-0 h-20 bg-black/90 flex items-center px-8 z-50 border-b border-white/10 justify-between">
      <div className="flex items-center gap-4">
          <div className="bg-fuchsia-600 px-4 py-1 rounded font-black text-xl tracking-wider">LIVE</div>
          <h1 className="text-2xl font-bold text-white/90 uppercase tracking-widest">{pubName || "NEONPUB"}</h1>
      </div>
      <div className="flex-1 mx-12 h-12 glass-box rounded-full flex items-center px-6 overflow-hidden relative">
          {msg ? (
             <div className="flex items-center gap-3 text-fuchsia-300 font-bold w-full animate-pulse">
                 <MessageSquare className="w-5 h-5 shrink-0"/>
                 <span className="text-lg truncate">{msg.text}</span>
             </div>
          ) : (
             <div className="text-white/30 text-sm font-medium flex items-center gap-2">
                 <Music className="w-4 h-4"/> PRENOTA LA TUA CANZONE
             </div>
          )}
      </div>
      <div className="flex items-center gap-4 text-white/50 font-mono">
          <Users className="w-5 h-5"/> {onlineCount}
      </div>
  </div>
);

const Sidebar = ({ pubCode, queue }) => (
  <div className="absolute top-20 right-0 bottom-0 w-80 bg-[#080808] border-l border-white/10 flex flex-col z-40">
      <div className="p-8 flex flex-col items-center border-b border-white/10 bg-[#111]">
          <div className="bg-white p-2 rounded-xl mb-4">
              <QRCodeSVG value={`${window.location.origin}/join/${pubCode}`} size={160} />
          </div>
          <div className="text-3xl font-black text-white tracking-widest">{pubCode}</div>
          <div className="text-xs text-white/40 uppercase mt-2 font-bold">Scansiona per Cantare</div>
      </div>
      <div className="flex-1 overflow-hidden flex flex-col">
          <div className="p-4 bg-fuchsia-900/20 text-fuchsia-400 font-bold text-sm uppercase tracking-wider text-center border-b border-fuchsia-500/20">Prossimi Cantanti</div>
          <div className="flex-1 p-4 space-y-3 overflow-y-auto custom-scrollbar">
              {queue.length === 0 && <div className="text-center text-white/20 mt-10 italic">Coda vuota...</div>}
              {queue.map((req, i) => (
                  <div key={i} className="bg-white/5 p-3 rounded-lg border-l-4 border-fuchsia-600">
                      <div className="text-white font-bold text-sm truncate">{req.user_nickname}</div>
                      <div className="text-white/50 text-xs truncate">{req.title}</div>
                  </div>
              ))}
          </div>
      </div>
  </div>
);

const KaraokePlayer = ({ perf, isMuted }) => {
    const playerRef = useRef(null);
    const [blocked, setBlocked] = useState(false);

    useEffect(() => {
        if (!perf?.youtube_url) return;
        const vidId = perf.youtube_url.match(/v=([^&]+)/)?.[1];
        if(!vidId) return;
        const init = () => {
            if(!window.YT) return;
            playerRef.current = new window.YT.Player('yt-embed', {
                videoId: vidId, width: '100%', height: '100%',
                playerVars: { autoplay: 1, controls: 0, disablekb: 1, fs: 0, iv_load_policy: 3, modestbranding: 1, rel: 0, showinfo: 0, mute: 0 },
                events: {
                    onReady: (e) => { e.target.playVideo(); if(!isMuted) e.target.unMute(); },
                    onStateChange: (e) => { if(e.data === 1 && e.target.isMuted()) setBlocked(true); else setBlocked(false); }
                }
            });
        };
        if(!window.YT) { const t=document.createElement('script'); t.src='https://www.youtube.com/iframe_api'; document.head.appendChild(t); window.onYouTubeIframeAPIReady=init; } else init();
        return () => { try{playerRef.current?.destroy()}catch(e){} };
    }, [perf?.id, perf?.youtube_url]);

    useEffect(() => { if(playerRef.current && playerRef.current.unMute) isMuted ? playerRef.current.mute() : playerRef.current.unMute(); }, [isMuted]);

    return (
        <div className="relative w-full h-full flex flex-col">
            <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
                <div id="yt-embed" className="w-full h-full absolute inset-0"></div>
                {blocked && !isMuted && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80">
                         <button onClick={()=>{playerRef.current.unMute(); setBlocked(false)}} className="bg-red-600 text-white px-8 py-4 rounded-full font-bold text-2xl animate-bounce flex gap-2"><Volume2 className="w-8 h-8"/> ATTIVA AUDIO</button>
                    </div>
                )}
            </div>
            <div className="h-32 bg-gradient-to-r from-zinc-900 to-black border-t-4 border-fuchsia-600 flex items-center px-10 relative z-30">
                <div className="w-24 h-24 bg-zinc-800 rounded-full flex items-center justify-center border-4 border-white/10 -mt-12 shadow-xl"><Mic2 className="w-10 h-10 text-fuchsia-500"/></div>
                <div className="ml-6 flex-1"><h2 className="text-4xl font-black text-white leading-none mb-1">{perf.song_title}</h2><h3 className="text-xl text-fuchsia-400 font-bold uppercase">{perf.song_artist}</h3></div>
                <div className="text-right"><div className="text-xs text-white/40 uppercase font-bold tracking-widest mb-1">Cantante</div><div className="text-3xl font-bold text-white">{perf.user_nickname}</div></div>
            </div>
        </div>
    );
};

const VotingScreen = ({ perf }) => (
    <div className="flex-1 flex flex-col items-center justify-center bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] relative overflow-hidden">
        <div className="absolute inset-0 bg-fuchsia-900/20 animate-pulse"></div>
        <div className="relative z-10 text-center">
            <Star className="w-48 h-48 text-yellow-400 fill-yellow-400 mx-auto mb-8 animate-bounce drop-shadow-[0_0_50px_rgba(234,179,8,0.6)]" />
            <h1 className="text-8xl font-black text-white mb-4 uppercase italic transform -skew-x-6">VOTA ORA!</h1>
            <p className="text-3xl text-white/70">Dai un voto a <strong className="text-fuchsia-400">{perf.user_nickname}</strong></p>
        </div>
    </div>
);

const ScoreScreen = ({ perf }) => (
    <div className="flex-1 flex flex-col items-center justify-center bg-black relative">
        <div className="absolute inset-0 bg-gradient-to-b from-black via-fuchsia-900/20 to-black"></div>
        <Trophy className="w-40 h-40 text-yellow-500 mb-6 relative z-10" />
        <h2 className="text-4xl text-white/60 font-bold uppercase tracking-widest relative z-10">Punteggio Finale</h2>
        <div className="text-[12rem] font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 to-yellow-600 leading-none relative z-10 drop-shadow-2xl">{perf.average_score?.toFixed(1) || "0.0"}</div>
        <p className="text-2xl text-white mt-8 font-bold bg-white/10 px-6 py-2 rounded-full backdrop-blur-md relative z-10">{perf.song_title}</p>
    </div>
);

const QuizScreen = ({ quiz, result }) => (
    <div className="flex-1 flex flex-col bg-[#0a0a0a] relative p-12 overflow-hidden">
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center">
            <div className="bg-fuchsia-600 text-white px-6 py-2 rounded-full font-black uppercase tracking-[0.3em] mb-12 shadow-lg glow-border">{quiz.category || "QUIZ TIME"}</div>
            {result ? (
                <div className="text-center w-full max-w-5xl animate-in zoom-in duration-500">
                    <h3 className="text-2xl text-white/50 uppercase font-bold mb-4">La risposta esatta era</h3>
                    <div className="bg-green-600 p-10 rounded-3xl mb-12 shadow-[0_0_60px_rgba(22,163,74,0.4)] border-4 border-green-400"><span className="text-7xl font-black text-white">{result.correct_option}</span></div>
                    <div className="flex justify-center gap-10"><div className="bg-zinc-800 p-6 rounded-2xl w-48 text-center border border-white/10"><div className="text-4xl font-bold text-white mb-1">{result.correct_count}</div><div className="text-xs uppercase text-white/40 font-bold">Indovinato</div></div><div className="bg-zinc-800 p-6 rounded-2xl w-48 text-center border border-white/10"><div className="text-4xl font-bold text-white mb-1">{result.total_answers}</div><div className="text-xs uppercase text-white/40 font-bold">Risposte</div></div></div>
                </div>
            ) : (
                <div className="w-full max-w-6xl text-center">
                    <h1 className="text-6xl font-black text-white leading-tight mb-16 drop-shadow-xl">{quiz.question}</h1>
                    {quiz.status === 'closed' ? (
                         <div className="bg-red-600 p-8 rounded-2xl inline-block animate-pulse"><h2 className="text-4xl font-bold text-white uppercase">Tempo Scaduto!</h2></div>
                    ) : (
                        <div className="grid grid-cols-2 gap-6">{quiz.options.map((opt, i) => (<div key={i} className="bg-white/5 border-l-8 border-fuchsia-600 p-8 rounded-r-xl flex items-center gap-6 text-left"><div className="w-16 h-16 bg-black/40 rounded-lg flex items-center justify-center text-3xl font-bold text-white shrink-0">{String.fromCharCode(65+i)}</div><div className="text-4xl font-bold text-white">{opt}</div></div>))}</div>
                    )}
                </div>
            )}
        </div>
    </div>
);

export default function PubDisplay() {
    const { pubCode } = useParams();
    const [data, setData] = useState(null);
    const [isMuted, setIsMuted] = useState(false);
    const [quizResult, setQuizResult] = useState(null);

    const load = async () => {
        try {
            const res = await api.getDisplayData(pubCode);
            if(res.data) {
                setData(res.data);
                const q = res.data.active_quiz;
                if(q && (q.status === 'showing_results' || q.status === 'leaderboard')) { const r = await api.getQuizResults(q.id); setQuizResult(r.data); } else { setQuizResult(null); }
            }
        } catch(e) { console.error(e); }
    };

    useEffect(() => {
        load(); const int = setInterval(load, 3000);
        const ch = supabase.channel('tv_ctrl').on('broadcast', {event: 'control'}, p => { if(p.payload.command === 'mute') setIsMuted(p.payload.value); }).subscribe();
        return () => { clearInterval(int); supabase.removeChannel(ch); };
    }, [pubCode]);

    if (!data) return <div className="bg-black h-screen flex items-center justify-center text-fuchsia-600 text-4xl font-bold animate-pulse">NEONPUB LOADING...</div>;

    const { pub, current_performance: perf, queue, active_quiz: quiz, latest_message: msg, leaderboard } = data;
    const isQuiz = quiz && ['active', 'closed', 'showing_results'].includes(quiz.status);
    const isKaraoke = !isQuiz && perf && ['live', 'paused'].includes(perf.status);
    const isVoting = !isQuiz && perf && perf.status === 'voting';
    const isScore = !isQuiz && perf && perf.status === 'ended';
    
    let Content = null;
    if (isQuiz) Content = <QuizScreen quiz={quiz} result={quizResult} />;
    else if (isVoting) Content = <VotingScreen perf={perf} />;
    else if (isScore) Content = <ScoreScreen perf={perf} />;
    else if (isKaraoke) Content = <KaraokePlayer perf={perf} isMuted={isMuted} />;
    else Content = (<div className="flex-1 flex flex-col items-center justify-center bg-black"><div className="w-64 h-64 rounded-full bg-fuchsia-900/20 blur-[80px] absolute"></div><h1 className="text-6xl font-black text-white relative z-10">{pub.name}</h1><p className="text-xl text-white/50 mt-4 font-bold tracking-widest uppercase">In Attesa di Musica</p></div>);

    return (
        <div className="w-screen h-screen flex flex-col relative overflow-hidden bg-black">
            <style>{STYLES}</style>
            <TopBar pubName={pub.name} onlineCount={leaderboard?.length || 0} msg={msg} />
            <div className="flex-1 flex relative pt-20"><div className="flex-1 relative flex flex-col border-r border-white/10 mr-80">{Content}</div><Sidebar pubCode={pubCode} queue={queue} /></div>
        </div>
    );
}