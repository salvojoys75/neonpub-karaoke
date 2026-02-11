import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  
  :root {
    --glass-bg: rgba(15, 15, 20, 0.7);
    --glass-border: rgba(255, 255, 255, 0.1);
  }

  body { 
    background: #000; 
    overflow: hidden; 
    font-family: 'Montserrat', sans-serif; 
    color: white; 
  }
  
  .glass-panel {
    background: var(--glass-bg);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid var(--glass-border);
    box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.5);
  }

  @keyframes ticker { 
    0% { transform: translateX(100%); } 
    100% { transform: translateX(-100%); } 
  }
  .ticker-wrap { width: 100%; overflow: hidden; }
  .ticker-content { display: inline-block; white-space: nowrap; animation: ticker 25s linear infinite; }

  @keyframes gradient-move {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }
  .animated-bg {
    background: linear-gradient(-45deg, #101010, #1a0b2e, #0f172a, #000);
    background-size: 400% 400%;
    animation: gradient-move 20s ease infinite;
  }
  
  .text-glow { text-shadow: 0 0 30px rgba(217,70,239, 0.6); }
`;

const TopBar = ({ pubName, logoUrl, onlineCount, messages, isMuted }) => {
  const messagesString = messages.map(m => `${m.nickname}: ${m.text}`).join('   •   ');
  
  return (
  <div className="absolute top-0 left-0 right-0 h-24 z-[100] flex items-center justify-between px-8 bg-gradient-to-b from-black/90 via-black/60 to-transparent">
      <div className="flex items-center gap-5">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="w-16 h-16 rounded-xl border-2 border-white/20 shadow-lg object-cover bg-black" />
          ) : (
            <div className="w-16 h-16 rounded-xl bg-fuchsia-600 flex items-center justify-center border-2 border-white/20 shadow-lg font-black text-xl">NP</div>
          )}
          <div>
              <h1 className="text-3xl font-black text-white tracking-wider drop-shadow-md uppercase">{pubName || "NEONPUB"}</h1>
              <div className="flex items-center gap-3">
                  <span className="bg-red-600 px-2 py-0.5 rounded text-[10px] font-bold tracking-widest uppercase animate-pulse shadow-[0_0_10px_red]">LIVE</span>
                  {isMuted && <span className="text-white bg-red-900 px-2 py-0.5 rounded text-[10px] font-bold tracking-widest border border-red-500">AUDIO OFF</span>}
              </div>
          </div>
      </div>
      
      <div className="flex-1 mx-16 h-14 glass-panel rounded-full flex items-center px-4 overflow-hidden relative">
          {messages && messages.length > 0 ? (
             <div className="ticker-wrap">
                 <div className="ticker-content text-white text-lg font-medium flex items-center gap-8">
                     <MessageSquare className="w-5 h-5 text-fuchsia-400 inline-block shrink-0"/>
                     <span>{messagesString}</span>
                     <span className="ml-8">{messagesString}</span>
                 </div>
             </div>
          ) : (
             <div className="ticker-wrap">
                 <div className="ticker-content text-white/40 text-sm font-medium uppercase tracking-widest flex items-center gap-8">
                     <span>🎵 Prenota la tua canzone</span>
                     <span>📸 Carica il tuo avatar</span>
                     <span>🏆 Scala la classifica</span>
                     <span>📱 Scansiona il QR Code</span>
                     <span>🎵 Prenota la tua canzone</span>
                     <span>📸 Carica il tuo avatar</span>
                     <span>🏆 Scala la classifica</span>
                     <span>📱 Scansiona il QR Code</span>
                 </div>
             </div>
          )}
      </div>

      <div className="flex flex-col items-end">
          <div className="glass-panel px-4 py-2 rounded-xl flex items-center gap-3">
              <Users className="w-5 h-5 text-fuchsia-400"/> 
              <span className="text-2xl font-mono font-bold">{onlineCount}</span>
          </div>
      </div>
  </div>
);};

const Sidebar = ({ pubCode, queue, leaderboard }) => (
  <div className="absolute top-28 right-6 bottom-6 w-[350px] z-[90] flex flex-col gap-6">
      <div className="glass-panel p-6 rounded-3xl flex flex-col items-center justify-center relative overflow-hidden">
          <div className="absolute inset-0 bg-fuchsia-600/10 blur-xl"></div>
          <div className="bg-white p-3 rounded-2xl mb-4 shadow-2xl relative z-10">
              <QRCodeSVG value={`${window.location.origin}/join/${pubCode}`} size={180} level="M" />
          </div>
          <div className="text-5xl font-black text-white tracking-widest font-mono drop-shadow-xl relative z-10">{pubCode}</div>
          <div className="text-xs text-white/60 uppercase mt-2 font-bold tracking-[0.2em] relative z-10">Scansiona per entrare</div>
      </div>
      
      <div className="glass-panel rounded-3xl flex flex-col overflow-hidden relative" style={{maxHeight: '45%'}}>
          <div className="bg-gradient-to-r from-fuchsia-600 to-purple-600 px-6 py-4 flex items-center justify-between border-b border-white/10 shrink-0">
              <div className="flex items-center gap-3">
                  <Disc className="w-6 h-6 text-white animate-spin" style={{animationDuration: '3s'}} />
                  <span className="font-black text-white text-xl uppercase tracking-wider">Coda</span>
              </div>
              <div className="bg-white/20 px-3 py-1 rounded-full">
                  <span className="text-white font-bold text-sm">{queue?.length || 0}</span>
              </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-fuchsia-600 scrollbar-track-transparent">
              {queue && queue.length > 0 ? (
                  queue.map((s, i) => (
                      <div key={s.id} className="bg-white/5 backdrop-blur-sm p-4 rounded-2xl border border-white/10 hover:bg-white/10 transition-all flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-fuchsia-600 to-purple-600 flex items-center justify-center text-white font-black text-lg shadow-lg shrink-0">
                              {i + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                              <div className="text-white font-bold text-lg truncate">{s.user_nickname}</div>
                              <div className="text-white/60 text-sm truncate">{s.song_title || 'Canzone senza titolo'}</div>
                          </div>
                          <Music className="w-5 h-5 text-fuchsia-400 shrink-0" />
                      </div>
                  ))
              ) : (
                  <div className="text-white/30 text-center py-8 italic">Nessuna canzone in coda</div>
              )}
          </div>
      </div>

      <div className="glass-panel rounded-3xl flex flex-col overflow-hidden relative flex-1">
          <div className="bg-gradient-to-r from-yellow-500 to-orange-500 px-6 py-4 flex items-center justify-between border-b border-white/10 shrink-0">
              <div className="flex items-center gap-3">
                  <Trophy className="w-6 h-6 text-white" />
                  <span className="font-black text-white text-xl uppercase tracking-wider">Classifica</span>
              </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-yellow-500 scrollbar-track-transparent">
              {leaderboard && leaderboard.length > 0 ? (
                  leaderboard.map((u, i) => (
                      <div key={u.id} className={`backdrop-blur-sm p-4 rounded-2xl border flex items-center gap-4 transition-all ${
                          i === 0 ? 'bg-gradient-to-r from-yellow-500/30 to-orange-500/30 border-yellow-400/50' :
                          i === 1 ? 'bg-white/10 border-gray-400/30' :
                          i === 2 ? 'bg-amber-700/20 border-amber-600/30' :
                          'bg-white/5 border-white/10'
                      }`}>
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg shadow-lg shrink-0 ${
                              i === 0 ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-black' :
                              i === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-500 text-black' :
                              i === 2 ? 'bg-gradient-to-br from-amber-600 to-amber-800 text-white' :
                              'bg-white/10 text-white'
                          }`}>
                              {i + 1}
                          </div>
                          <div className="text-white font-bold text-lg truncate flex-1">{u.nickname}</div>
                          <div className={`font-mono font-bold text-xl ${i < 3 ? 'text-yellow-300' : 'text-white'}`}>
                              {u.score || 0}
                          </div>
                      </div>
                  ))
              ) : (
                  <div className="text-white/30 text-center py-8 italic">Nessun punteggio</div>
              )}
          </div>
      </div>
  </div>
);

const KaraokeMode = ({ perf, isMuted }) => (
    <div className="w-full h-full relative flex items-center justify-center overflow-hidden">
        <KaraokePlayer url={perf.video_url} status={perf.status} volume={100} isMuted={isMuted} startedAt={perf.started_at} />
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-50 mr-[175px]">
            <div className="glass-panel px-12 py-8 rounded-[2rem] text-center border-l-8 border-fuchsia-500">
                <div className="flex items-center gap-6 mb-4">
                    <Mic2 className="w-10 h-10 text-fuchsia-400" />
                    <div className="text-left">
                        <div className="text-5xl font-black text-white">{perf.user_nickname}</div>
                        <div className="text-2xl text-white/70 font-medium mt-1">{perf.song_title || 'Canzone'}</div>
                    </div>
                </div>
            </div>
        </div>
    </div>
);

const VotingMode = ({ perf }) => (
    <div className="w-full h-full flex items-center justify-center animated-bg relative overflow-hidden mr-[175px]">
        <div className="w-[800px] h-[800px] bg-fuchsia-600/20 rounded-full blur-[200px] absolute z-0 animate-pulse"></div>
        <div className="text-center relative z-10">
            <div className="mb-12">
                <Star className="w-40 h-40 text-yellow-400 mx-auto animate-pulse" style={{filter: 'drop-shadow(0 0 40px rgba(250,204,21,0.8))'}} />
            </div>
            <h1 className="text-9xl font-black text-white mb-8 uppercase tracking-tight drop-shadow-2xl">Vota Ora!</h1>
            <div className="glass-panel px-16 py-8 rounded-[3rem] inline-block border-4 border-fuchsia-500">
                <div className="text-4xl text-fuchsia-300 font-bold mb-4">Esibizione di</div>
                <div className="text-7xl font-black text-white">{perf.user_nickname}</div>
            </div>
            <div className="mt-12 text-3xl text-white/70 font-medium animate-pulse">Usa l'app per votare da 1 a 5 stelle</div>
        </div>
    </div>
);

const ScoreMode = ({ perf }) => {
    const avgScore = perf.average_score ? parseFloat(perf.average_score).toFixed(1) : '0.0';
    const stars = Math.round(parseFloat(avgScore));
    
    return (
        <div className="w-full h-full flex items-center justify-center animated-bg relative overflow-hidden mr-[175px]">
            <div className="w-[900px] h-[900px] bg-yellow-500/20 rounded-full blur-[200px] absolute z-0 animate-pulse"></div>
            <div className="text-center relative z-10">
                <div className="glass-panel px-20 py-12 rounded-[4rem] border-8 border-yellow-500 shadow-[0_0_100px_rgba(234,179,8,0.5)]">
                    <div className="text-4xl uppercase text-yellow-300 font-bold tracking-widest mb-6">Punteggio Finale</div>
                    <div className="text-6xl font-bold text-white mb-8">{perf.user_nickname}</div>
                    <div className="flex justify-center gap-4 mb-8">
                        {[1,2,3,4,5].map(i => (
                            <Star key={i} className={`w-20 h-20 ${i <= stars ? 'text-yellow-400 fill-yellow-400' : 'text-white/20'}`} style={i <= stars ? {filter: 'drop-shadow(0 0 20px rgba(250,204,21,0.8))'} : {}} />
                        ))}
                    </div>
                    <div className="text-9xl font-black text-yellow-400 font-mono drop-shadow-2xl">{avgScore}</div>
                    <div className="text-2xl text-white/60 mt-6 font-medium">{perf.vote_count || 0} voti ricevuti</div>
                </div>
            </div>
        </div>
    );
};

const QuizMode = ({ quiz, result }) => {
    const isResult = quiz.status === 'showing_results';
    const isLeaderboard = quiz.status === 'leaderboard';

    return (
        <div className="w-full h-full relative flex items-center justify-center overflow-hidden">
            <QuizMediaFixed mediaUrl={quiz.media_url} mediaType={quiz.media_type} isResult={isResult} />
            
            {isLeaderboard ? (
                <div className="absolute inset-0 z-50 flex items-center justify-center animated-bg mr-[175px]">
                    <div className="w-full max-w-5xl glass-panel p-12 rounded-[3rem] border-4 border-yellow-500">
                        <div className="flex items-center justify-center gap-6 mb-12">
                            <Trophy className="w-20 h-20 text-yellow-400" />
                            <h1 className="text-7xl font-black text-white uppercase">Classifica Quiz</h1>
                        </div>
                        <div className="space-y-4 max-h-[600px] overflow-y-auto scrollbar-thin scrollbar-thumb-yellow-500 scrollbar-track-transparent">
                            {quiz.leaderboard && quiz.leaderboard.length > 0 ? (
                                quiz.leaderboard.map((p, i) => (
                                    <div key={p.id} className={`backdrop-blur-sm p-6 rounded-2xl border flex items-center gap-6 ${
                                        i === 0 ? 'bg-gradient-to-r from-yellow-500/30 to-orange-500/30 border-yellow-400/50' :
                                        i === 1 ? 'bg-white/10 border-gray-400/30' :
                                        i === 2 ? 'bg-amber-700/20 border-amber-600/30' :
                                        'bg-white/5 border-white/10'
                                    }`}>
                                        <div className={`w-14 h-14 rounded-xl flex items-center justify-center font-black text-2xl shadow-lg ${
                                            i === 0 ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-black' :
                                            i === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-500 text-black' :
                                            i === 2 ? 'bg-gradient-to-br from-amber-600 to-amber-800 text-white' :
                                            'bg-white/10 text-white'
                                        }`}>
                                            {i + 1}
                                        </div>
                                        <div className="text-white font-bold text-3xl flex-1">{p.nickname}</div>
                                        <div className={`font-mono font-bold text-4xl ${i < 3 ? 'text-yellow-300' : 'text-white'}`}>
                                            {p.score || 0}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-white/30 text-center py-12 text-2xl italic">Nessun punteggio disponibile</div>
                            )}
                        </div>
                    </div>
                </div>
            ) : isResult && result ? (
                <div className="absolute inset-0 z-50 flex items-center justify-center p-16 mr-[175px]">
                    <div className="w-full max-w-7xl grid grid-cols-2 gap-12">
                        <div className="glass-panel p-8 rounded-3xl flex flex-col">
                            <div className="text-3xl uppercase text-fuchsia-400 font-bold tracking-widest mb-6 text-center">Chi ha Risposto</div>
                            <div className="flex-1 overflow-y-auto space-y-4 scrollbar-thin scrollbar-thumb-fuchsia-600 scrollbar-track-transparent">
                                {result.winners && result.winners.length > 0 ? (
                                    result.winners.map((w, i) => (
                                        <div key={i} className="bg-white/5 backdrop-blur-sm p-4 rounded-2xl border border-white/10 flex items-center gap-4">
                                            <div className="bg-green-500 text-white font-black w-8 h-8 rounded-lg flex items-center justify-center text-lg">✓</div>
                                            {w.avatar && <img src={w.avatar} className="w-10 h-10 rounded-full object-cover border border-white/20" alt="avt" />}
                                            {!w.avatar && <div className="w-10 h-10 rounded-full bg-fuchsia-600 flex items-center justify-center text-white font-bold border border-white/20">{w.nickname.charAt(0).toUpperCase()}</div>}
                                            <span className="text-white font-bold text-xl truncate flex-1">{w.nickname}</span>
                                            <div className="text-green-400 font-mono font-bold text-lg">+{w.points}</div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-white/30 italic text-center py-4">Nessuno ha indovinato in tempo!</div>
                                )}
                            </div>
                        </div>

                        <div className="glass-panel p-8 rounded-3xl flex flex-col items-center justify-center border-l-8 border-fuchsia-500">
                            <div className="text-3xl uppercase text-white/50 font-bold tracking-widest mb-4">Risposta Corretta</div>
                            <div className="text-7xl font-black text-white mb-6 text-center leading-tight">{result.correct_option}</div>
                            <div className="w-32 h-32 bg-green-500 rounded-full flex items-center justify-center text-7xl font-black text-white font-mono shadow-[0_0_50px_rgba(34,197,94,0.5)]">
                                {result.correct_index !== undefined ? String.fromCharCode(65 + result.correct_index) : '?'}
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="w-full max-w-7xl text-center">
                    <h1 className="text-8xl font-black text-white leading-tight mb-20 drop-shadow-2xl">{quiz.question}</h1>
                    
                    {quiz.status === 'closed' ? (
                         <div className="bg-red-600 p-12 rounded-[3rem] inline-block animate-pulse shadow-[0_0_80px_rgba(220,38,38,0.8)] border-4 border-red-400">
                             <h2 className="text-6xl font-black text-white uppercase italic">TEMPO SCADUTO!</h2>
                         </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-8">
                            {quiz.options.map((opt, i) => (
                                <div key={i} className="glass-panel border-l-[12px] border-fuchsia-600 p-10 rounded-r-3xl flex items-center gap-8 text-left transform transition hover:scale-105 duration-300">
                                    <div className="w-24 h-24 bg-black/40 rounded-2xl flex items-center justify-center text-5xl font-black text-white shrink-0 font-mono shadow-inner border border-white/10">
                                        {String.fromCharCode(65+i)}
                                    </div>
                                    <div className="text-5xl font-bold text-white leading-tight">{opt}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const IdleMode = ({ pub }) => (
    <div className="w-full h-full flex flex-col items-center justify-center animated-bg relative overflow-hidden">
        <div className="w-[1000px] h-[1000px] bg-fuchsia-600/10 rounded-full blur-[150px] absolute z-0 animate-pulse"></div>
        
        <div className="relative z-10 text-center mr-[350px]">
            {pub.logo_url ? (
                 <img src={pub.logo_url} className="w-80 h-80 rounded-[3rem] mb-12 mx-auto shadow-[0_0_80px_rgba(0,0,0,0.8)] border-4 border-white/10 object-cover bg-black" alt="logo" />
            ) : (
                 <div className="w-64 h-64 rounded-full bg-gradient-to-br from-zinc-800 to-black flex items-center justify-center mx-auto mb-10 border-4 border-white/10">
                    <Music className="w-32 h-32 text-white/20" />
                 </div>
            )}
            <h1 className="text-9xl font-black text-white tracking-tighter drop-shadow-2xl mb-8">{pub.name}</h1>
            <div className="glass-panel px-16 py-6 rounded-full inline-block border border-white/20">
                <span className="text-3xl text-white/90 font-bold uppercase tracking-[0.4em]">Benvenuti</span>
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
                if(q && q.status === 'showing_results') {
                    const r = await api.getQuizResults(q.id);
                    setQuizResult(r.data);
                } else if(q && q.status === 'leaderboard') {
                    const lb = await api.getAdminLeaderboard();
                    setData(prev => ({
                        ...prev,
                        active_quiz: {
                            ...q,
                            leaderboard: lb.data
                        }
                    }));
                    setQuizResult(null);
                } else {
                    setQuizResult(null);
                }
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

    if (!data) return (
        <div className="w-screen h-screen bg-black flex flex-col items-center justify-center">
             <div className="w-20 h-20 border-8 border-fuchsia-600 border-t-transparent rounded-full animate-spin mb-6"></div>
             <div className="text-white text-3xl font-black font-mono tracking-[0.5em] animate-pulse">CARICAMENTO...</div>
        </div>
    );

    const { pub, current_performance: perf, queue, active_quiz: quiz, latest_message: msg, leaderboard, approved_messages } = data;

    const recentMessages = approved_messages ? approved_messages.slice(0, 5) : [];

    const isQuiz = quiz && ['active', 'closed', 'showing_results', 'leaderboard'].includes(quiz.status);
    const isKaraoke = !isQuiz && perf && ['live', 'paused'].includes(perf.status);
    const isVoting = !isQuiz && perf && perf.status === 'voting';
    const isScore = !isQuiz && perf && perf.status === 'ended';
    
    let Content = null;
    if (isQuiz) Content = <QuizMode quiz={quiz} result={quizResult} />;
    else if (isVoting) Content = <VotingMode perf={perf} />;
    else if (isScore) Content = <ScoreMode perf={perf} />;
    else if (isKaraoke) Content = <KaraokeMode perf={perf} isMuted={isMuted} />;
    else Content = <IdleMode pub={pub} />;

    return (
        <div className="w-screen h-screen relative bg-black overflow-hidden">
            <style>{STYLES}</style>
            
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 pointer-events-none z-0"></div>

            <TopBar pubName={pub.name} logoUrl={pub.logo_url} onlineCount={leaderboard?.length || 0} messages={recentMessages} isMuted={isMuted} />
            <FloatingReactions newReaction={newReaction} />
            
            <div className="w-full h-full pt-24 pb-0 relative z-10">
                {Content}
            </div>
            
            <Sidebar pubCode={pubCode} queue={queue} leaderboard={leaderboard} />
        </div>
    );
}