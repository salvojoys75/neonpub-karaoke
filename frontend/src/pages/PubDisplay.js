import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '@/lib/supabase';
import api from '@/lib/api';
import { 
  Music, Trophy, Mic2, MessageSquare, Star, 
  Sparkles, Clock, Crown, ListMusic, User 
} from 'lucide-react';
import QuizMediaFixed from '@/components/QuizMediaFixed';

// ===========================================
// COMPONENTI UI STILI "TV SHOW"
// ===========================================

// 1. KARAOKE SCREEN
const KaraokeScreen = ({ performance, isVoting, voteResult }) => {
  const playerRef = useRef(null);

  useEffect(() => {
    if (!performance?.youtube_url) return;
    
    const getYoutubeId = (url) => {
        const match = url.match(/^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/);
        return (match && match[2].length === 11) ? match[2] : null;
    };
    const videoId = getYoutubeId(performance.youtube_url);
    if(!videoId) return;

    if (!window.YT) return; // Gestito nel main

    const onReady = (e) => {
        if(performance.status === 'live' && !isVoting) e.target.playVideo();
        else e.target.pauseVideo();
    };

    if (!playerRef.current) {
      playerRef.current = new window.YT.Player('karaoke-player', {
        videoId: videoId,
        playerVars: { autoplay: 1, controls: 0, disablekb: 1, fs: 0, iv_load_policy: 3, modestbranding: 1, rel: 0, showinfo: 0 },
        events: { onReady }
      });
    } else {
        // Se cambia video o stato
        if (performance.status === 'live' && !isVoting) playerRef.current.playVideo();
        else playerRef.current.pauseVideo();
    }
  }, [performance, isVoting]);

  return (
    <div className="absolute inset-0 bg-black overflow-hidden">
      {/* BACKGROUND VIDEO */}
      <div id="karaoke-player" className={`absolute inset-0 w-full h-full pointer-events-none transition-opacity duration-500 ${isVoting || voteResult ? 'opacity-20 blur-sm' : 'opacity-100'}`} />

      {/* OVERLAY INFO CANZONE (Solo se non si vota) */}
      {!isVoting && !voteResult && (
        <div className="absolute bottom-0 left-0 right-0 p-12 bg-gradient-to-t from-black via-black/80 to-transparent z-10">
           <div className="flex items-end gap-8 animate-slide-up">
              <div className="bg-white/10 p-6 rounded-full backdrop-blur-md border border-white/20">
                  <Mic2 className="w-16 h-16 text-fuchsia-500" />
              </div>
              <div>
                  <h1 className="text-6xl font-black text-white mb-2 drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)] uppercase leading-tight">{performance.song_title}</h1>
                  <p className="text-4xl text-cyan-300 font-bold">{performance.song_artist}</p>
                  <div className="mt-4 flex items-center gap-3">
                      <span className="text-xl text-zinc-400 uppercase tracking-widest">Cantante:</span>
                      <span className="bg-fuchsia-600 px-4 py-1 rounded text-2xl font-bold text-white uppercase">{performance.user_nickname}</span>
                  </div>
              </div>
           </div>
        </div>
      )}

      {/* MODALITA' VOTAZIONE */}
      {isVoting && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
              <div className="bg-gradient-to-br from-yellow-600/20 to-orange-600/20 p-20 rounded-[3rem] border-4 border-yellow-500 shadow-[0_0_100px_rgba(234,179,8,0.4)] text-center">
                  <Star className="w-32 h-32 text-yellow-400 mx-auto mb-8 animate-spin-slow" />
                  <h2 className="text-8xl font-black text-white mb-4 drop-shadow-lg">VOTA ORA!</h2>
                  <p className="text-3xl text-yellow-200">Dai un voto a <span className="font-bold text-white uppercase">{performance.user_nickname}</span></p>
              </div>
          </div>
      )}

      {/* RISULTATO VOTO */}
      {voteResult && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/90 animate-zoom-in">
              <Crown className="w-40 h-40 text-yellow-400 mb-8 animate-bounce" />
              <h2 className="text-5xl font-bold text-zinc-400 uppercase tracking-widest mb-4">Punteggio Finale</h2>
              <div className="text-[12rem] font-black text-white leading-none drop-shadow-[0_0_50px_rgba(255,255,255,0.5)]">
                  {voteResult.toFixed(1)}
              </div>
          </div>
      )}
    </div>
  );
};

// 2. QUIZ GAME SHOW (Stabile e Bello)
const QuizGameShow = ({ quiz, quizResults, leaderboard }) => {
    // Stati della scena
    const isLeaderboard = quiz.status === 'leaderboard';
    const isResult = quiz.status === 'showing_results';
    const isQuestion = quiz.status === 'active' || quiz.status === 'closed';

    return (
        <div className="absolute inset-0 bg-zinc-950 overflow-hidden font-sans">
            {/* LAYER 0: MEDIA FIXED (Sempre sotto) */}
            <div className={`absolute inset-0 transition-all duration-700 ${isLeaderboard ? 'opacity-0 scale-90' : 'opacity-100 scale-100'}`}>
                 <QuizMediaFixed mediaUrl={quiz.media_url} mediaType={quiz.media_type} />
                 {/* Overlay scuro per leggere meglio */}
                 <div className="absolute inset-0 bg-black/40" />
            </div>

            {/* LAYER 1: DOMANDA */}
            <div className={`absolute inset-0 z-10 flex flex-col items-center justify-center p-12 transition-all duration-500 
                ${isQuestion ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-10 pointer-events-none'}`}>
                
                <div className="mb-10 animate-bounce">
                    <span className={`px-12 py-4 rounded-full text-3xl font-black uppercase tracking-widest shadow-2xl border-2 border-white/20
                        ${quiz.status === 'closed' ? 'bg-red-600 text-white' : 'bg-fuchsia-600 text-white animate-pulse'}`}>
                        {quiz.status === 'closed' ? "TEMPO SCADUTO" : "IN ONDA"}
                    </span>
                </div>

                <div className="w-full max-w-7xl bg-black/60 backdrop-blur-xl border border-white/10 p-12 rounded-[3rem] text-center shadow-2xl mb-12">
                    <h2 className="text-6xl font-black text-white leading-tight drop-shadow-xl">{quiz.question}</h2>
                </div>

                <div className="grid grid-cols-2 gap-8 w-full max-w-6xl">
                    {quiz.options.map((opt, i) => (
                        <div key={i} className={`relative p-8 rounded-2xl text-4xl font-bold border-4 transition-all duration-300 transform
                            ${quiz.status === 'closed' ? 'bg-zinc-800 border-zinc-600 text-zinc-500 scale-95 grayscale' : 'bg-white/10 border-white/20 text-white hover:scale-105 hover:bg-white/20 shadow-lg'}`}>
                            <span className="text-fuchsia-400 mr-4 font-mono">{String.fromCharCode(65+i)}.</span> {opt}
                        </div>
                    ))}
                </div>
            </div>

            {/* LAYER 2: RISULTATO */}
            <div className={`absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/85 backdrop-blur-xl transition-all duration-500 
                ${isResult ? 'opacity-100 scale-100' : 'opacity-0 scale-110 pointer-events-none'}`}>
                
                {quizResults && (
                    <div className="relative bg-gradient-to-br from-zinc-900 to-black border-4 border-green-500 p-16 rounded-[4rem] text-center shadow-[0_0_150px_rgba(34,197,94,0.3)] max-w-5xl w-full animate-zoom-in">
                        <div className="absolute -top-16 left-1/2 -translate-x-1/2 bg-green-600 p-6 rounded-full border-8 border-black">
                            <Trophy className="w-20 h-20 text-white animate-pulse" />
                        </div>
                        
                        <h3 className="text-3xl text-zinc-400 uppercase tracking-widest mt-8 mb-4">La risposta esatta è</h3>
                        <div className="bg-green-600 text-white text-7xl font-black py-8 px-12 rounded-3xl mb-10 shadow-lg transform scale-105">
                            {quizResults.correct_option}
                        </div>

                        <div className="grid grid-cols-3 gap-8 text-center border-t border-white/10 pt-8">
                            <div className="bg-white/5 p-4 rounded-xl"><div className="text-5xl font-bold text-white">{quizResults.total_answers}</div><div className="text-xs text-zinc-500 uppercase mt-2">Risposte</div></div>
                            <div className="bg-green-900/20 p-4 rounded-xl border border-green-500/30"><div className="text-5xl font-bold text-green-400">{quizResults.correct_count}</div><div className="text-xs text-green-500 uppercase mt-2">Esatte</div></div>
                            <div className="bg-white/5 p-4 rounded-xl"><div className="text-5xl font-bold text-fuchsia-400">{quizResults.points}</div><div className="text-xs text-zinc-500 uppercase mt-2">Punti</div></div>
                        </div>

                        {quizResults.winners.length > 0 && (
                            <div className="mt-8 pt-6 border-t border-white/10">
                                <p className="text-green-300 font-bold uppercase text-sm mb-2">🏆 I Più Veloci 🏆</p>
                                <div className="text-2xl text-white font-medium flex flex-wrap justify-center gap-2">
                                    {quizResults.winners.slice(0, 3).map((w, i) => (
                                        <span key={i} className="bg-white/10 px-4 py-1 rounded-full border border-white/10">{w}</span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* LAYER 3: CLASSIFICA (Full Screen Overlay) */}
            <div className={`absolute inset-0 z-50 bg-zinc-950 flex flex-col transition-transform duration-700 ${isLeaderboard ? 'translate-y-0' : 'translate-y-full'}`}>
                <div className="h-24 bg-zinc-900 border-b border-zinc-800 flex items-center justify-center shadow-2xl z-10">
                    <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500 uppercase tracking-widest drop-shadow-sm flex items-center gap-4">
                        <Trophy className="w-12 h-12 text-yellow-500" /> Classifica Generale
                    </h1>
                </div>
                <div className="flex-1 overflow-y-auto p-12 grid grid-cols-2 gap-x-16 gap-y-6 content-start custom-scrollbar">
                    {leaderboard.map((p, i) => (
                        <div key={p.id} className={`flex items-center p-6 rounded-2xl text-4xl font-bold transition-all transform 
                            ${i<3 ? 'bg-gradient-to-r from-yellow-900/30 to-black border-l-8 border-yellow-500 pl-8 scale-105 shadow-xl' : 'bg-white/5 border-l-4 border-zinc-700'}`}>
                            <span className={`w-20 text-right mr-8 font-mono ${i===0?'text-yellow-400 text-6xl':i===1?'text-zinc-300 text-5xl':i===2?'text-amber-600 text-5xl':'text-zinc-600 text-4xl'}`}>#{i+1}</span>
                            <span className="flex-1 truncate text-white tracking-tight">{p.nickname}</span>
                            <span className="text-yellow-500 font-mono bg-black/30 px-6 py-2 rounded-lg">{p.score}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

// ===========================================
// COMPONENTE PRINCIPALE PUB DISPLAY
// ===========================================
const PubDisplay = () => {
  const { pubCode } = useParams();
  const [displayData, setDisplayData] = useState(null);
  const [ticker, setTicker] = useState("");
  
  // Stati per effetti effimeri
  const [flashMessages, setFlashMessages] = useState([]); // Coda messaggi a scomparsa
  const [floatingReactions, setFloatingReactions] = useState([]);
  
  const [quizResults, setQuizResults] = useState(null);
  const [voteResult, setVoteResult] = useState(null);

  // Load YouTube API
  useEffect(() => {
    if (!window.YT) {
        const tag = document.createElement('script');
        tag.src = "https://www.youtube.com/iframe_api";
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    }
  }, []);

  const loadDisplayData = useCallback(async () => {
    try {
      const { data } = await api.getDisplayData(pubCode);
      if(!data) return;

      setDisplayData(data);
      
      // TICKER CODA
      if (data.queue?.length > 0) {
        setTicker(data.queue.map((s, i) => `${i + 1}. ${s.title} (${s.user_nickname})`).join('  •  '));
      } else {
        setTicker("SCANSIONA IL QR CODE PER PRENOTARE UNA CANZONE!  •  KARAOKE NIGHT  •  NEONPUB");
      }

      // AUTO SHOW VOTE RESULT
      if (data.current_performance?.status === 'ended' && !voteResult && data.current_performance.average_score > 0) {
         setVoteResult(data.current_performance.average_score);
         setTimeout(() => setVoteResult(null), 10000);
      }
    } catch (error) { console.error(error); }
  }, [pubCode, voteResult]);

  // Gestione Messaggi a Scomparsa
  const addFlashMessage = (msg) => {
      const id = Date.now();
      const text = msg.text;
      const nickname = msg.nickname || "Regia";
      
      setFlashMessages(prev => [...prev, { id, text, nickname }]);
      
      // Rimuovi dopo 10 secondi
      setTimeout(() => {
          setFlashMessages(prev => prev.filter(m => m.id !== id));
      }, 10000);
  };

  const addReaction = (emoji, nickname) => {
      const id = Date.now() + Math.random();
      setFloatingReactions(prev => [...prev, { id, emoji, nickname, left: Math.random() * 80 + 10 }]);
      setTimeout(() => setFloatingReactions(prev => prev.filter(r => r.id !== id)), 4000);
  };

  // REALTIME
  useEffect(() => {
    loadDisplayData();
    const interval = setInterval(loadDisplayData, 5000);

    const channel = supabase.channel(`display_realtime`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'performances', filter: `event_id=eq.${displayData?.pub?.id}` }, 
            (payload) => {
                setDisplayData(prev => prev ? ({ ...prev, current_performance: payload.new }) : null);
                if (payload.new.status === 'voting' || payload.new.status === 'ended') loadDisplayData();
            }
        )
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reactions', filter: `event_id=eq.${displayData?.pub?.id}` }, 
            (payload) => addReaction(payload.new.emoji, payload.new.nickname)
        )
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `event_id=eq.${displayData?.pub?.id}` }, 
            async (payload) => {
                 if(payload.new.status === 'approved') {
                     let nick = "Regia";
                     if(payload.new.participant_id) {
                         const { data } = await supabase.from('participants').select('nickname').eq('id', payload.new.participant_id).single();
                         if(data) nick = data.nickname;
                     }
                     addFlashMessage({ text: payload.new.text, nickname: nick });
                 }
            }
        )
        .on('postgres_changes', { event: '*', schema: 'public', table: 'quizzes', filter: `event_id=eq.${displayData?.pub?.id}` }, 
            async (payload) => {
                const updatedQuiz = payload.new;
                setDisplayData(prev => {
                     if(!prev) return null;
                     if(updatedQuiz.status === 'ended') {
                         setTimeout(() => { 
                             setDisplayData(curr => ({ ...curr, active_quiz: null })); 
                             setQuizResults(null); 
                         }, 5000);
                     }
                     return { ...prev, active_quiz: updatedQuiz };
                });

                if (updatedQuiz.status === 'active' || updatedQuiz.status === 'closed') { setQuizResults(null); }
                else if (updatedQuiz.status === 'showing_results' || updatedQuiz.status === 'leaderboard') {
                    const res = await api.getQuizResults(updatedQuiz.id); 
                    setQuizResults(res.data);
                }
            }
        )
        .subscribe();

    return () => { clearInterval(interval); supabase.removeChannel(channel); };
  }, [displayData?.pub?.id, pubCode]);

  // LOGICA DI RENDERING PRINCIPALE
  const currentPerf = displayData?.current_performance;
  const activeQuiz = displayData?.active_quiz;
  const joinUrl = `${window.location.origin}/join/${pubCode}`;
  
  const isQuizMode = activeQuiz && activeQuiz.status !== 'ended';
  const isKaraokeMode = !isQuizMode && currentPerf && (currentPerf.status === 'live' || currentPerf.status === 'paused' || currentPerf.status === 'voting' || voteResult);

  // Sidebar: Nascondila se siamo in leaderboard fullscreen quiz
  const showSidebar = !isQuizMode || (activeQuiz && activeQuiz.status !== 'leaderboard');

  return (
    <div className="h-screen bg-black text-white overflow-hidden flex flex-col font-sans select-none">
      
      {/* HEADER BAR */}
      <div className="h-16 bg-zinc-900 flex items-center px-6 border-b border-zinc-800 z-50 shadow-2xl relative">
         <div className="flex items-center gap-3 mr-8">
            <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse shadow-[0_0_10px_red]"></div>
            <div className="font-black text-2xl text-white tracking-tighter">NEON<span className="text-fuchsia-500">PUB</span></div>
         </div>
         {/* TICKER */}
         <div className="flex-1 overflow-hidden relative h-full flex items-center bg-zinc-950/50 rounded-lg border border-white/5 mx-4">
            <div className="ticker-container w-full">
                <div className="ticker-content text-lg font-bold text-cyan-300 font-mono flex items-center gap-8">
                   {ticker}
                </div>
            </div>
         </div>
         <div className="text-zinc-500 font-mono text-sm bg-zinc-800 px-3 py-1 rounded">
             ROOM: <span className="text-white font-bold">{pubCode}</span>
         </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 relative bg-black flex flex-col justify-center overflow-hidden">
           
           {/* IDLE SCREEN */}
           {!isQuizMode && !isKaraokeMode && (
             <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-zinc-800 via-zinc-950 to-black animate-fade-in">
                <div className="bg-white p-8 rounded-3xl shadow-[0_0_80px_rgba(255,255,255,0.15)] mb-12 animate-float">
                    <QRCodeSVG value={joinUrl} size={350} />
                </div>
                <h2 className="text-7xl font-black text-white mb-4 tracking-tight">CANTA CON NOI</h2>
                <p className="text-3xl text-zinc-400 font-light">Inquadra il QR Code per scegliere una canzone</p>
                <div className="mt-12 flex gap-4 text-zinc-600 font-mono text-xl">
                    <span>{pubCode}</span> • <span>neonpub.com</span>
                </div>
             </div>
           )}

           {/* MODES */}
           {isKaraokeMode && <KaraokeScreen performance={currentPerf} isVoting={currentPerf.status === 'voting'} voteResult={voteResult} />}
           {isQuizMode && <QuizGameShow quiz={activeQuiz} quizResults={quizResults} leaderboard={displayData?.leaderboard || []} />}
        </div>

        {/* SIDEBAR (QR & MINI LEADERBOARD) */}
        {showSidebar && (
            <div className="w-[400px] bg-zinc-900 border-l border-zinc-800 flex flex-col z-40 shadow-2xl relative transition-all duration-500">
                {/* QR AREA */}
                <div className="p-8 flex flex-col items-center bg-zinc-800/50 border-b border-white/5">
                    <div className="bg-white p-4 rounded-2xl mb-4 shadow-lg"><QRCodeSVG value={joinUrl} size={160} /></div>
                    <p className="font-black text-4xl text-fuchsia-500 tracking-widest drop-shadow-md mb-1">{pubCode}</p>
                    <p className="text-xs text-zinc-400 uppercase tracking-widest">Codice Stanza</p>
                </div>
                
                {/* LOGO AREA */}
                <div className="flex-1 flex flex-col items-center justify-center p-8 opacity-50 grayscale hover:grayscale-0 transition-all duration-1000">
                     {displayData?.pub?.logo_url ? 
                        <img src={displayData.pub.logo_url} className="w-48 h-48 object-contain drop-shadow-2xl"/> : 
                        <div className="text-6xl font-black text-zinc-800">LOGO</div>
                     }
                </div>

                {/* MINI CLASSIFICA */}
                <div className="h-[40%] border-t border-white/10 flex flex-col bg-gradient-to-b from-zinc-900 to-black">
                    <div className="p-4 border-b border-white/5 bg-white/5 flex items-center gap-2">
                        <Trophy className="w-5 h-5 text-yellow-500"/>
                        <span className="font-bold text-white uppercase tracking-wider text-sm">Top 5 Players</span>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                        {(displayData?.leaderboard || []).slice(0, 5).map((p, i) => (
                            <div key={p.id} className={`flex justify-between items-center p-3 rounded-lg ${i===0 ? 'bg-gradient-to-r from-yellow-900/40 to-transparent border border-yellow-500/20' : 'hover:bg-white/5'}`}>
                                <div className="flex items-center gap-3">
                                    <span className={`font-black w-6 h-6 flex items-center justify-center rounded text-xs ${i===0 ? 'bg-yellow-500 text-black' : 'bg-zinc-800 text-zinc-500'}`}>{i+1}</span>
                                    <span className={`text-sm font-bold truncate max-w-[150px] ${i===0?'text-white':'text-zinc-400'}`}>{p.nickname}</span>
                                </div>
                                <span className="text-fuchsia-500 font-mono font-bold text-sm">{p.score}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )}
      </div>

      {/* OVERLAY: REAZIONI (Floating Emojis) */}
      <div className="pointer-events-none fixed inset-0 z-[100] overflow-hidden">
        {floatingReactions.map(r => (
            <div key={r.id} className="absolute flex flex-col items-center animate-float-up" style={{ left: `${r.left}%`, bottom: '-50px' }}>
              <span className="text-8xl filter drop-shadow-2xl">{r.emoji}</span>
              <span className="text-xl text-white font-bold mt-1 bg-black/60 backdrop-blur px-4 py-1 rounded-full border border-white/10 shadow-xl">{r.nickname}</span>
            </div>
        ))}
      </div>

      {/* OVERLAY: MESSAGGI REGIA (Flash Messages Queue) */}
      <div className="fixed top-24 left-8 z-[110] w-full max-w-3xl flex flex-col gap-4 pointer-events-none">
          {flashMessages.map(msg => (
            <div key={msg.id} className="bg-zinc-900/90 backdrop-blur-xl border-l-8 border-cyan-500 text-white p-6 rounded-r-2xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] animate-slide-in-left flex items-start gap-6 border-y border-r border-white/10">
              <div className="bg-cyan-500/20 p-4 rounded-full border border-cyan-500/50 shadow-[0_0_20px_rgba(6,182,212,0.3)]">
                  <MessageSquare className="w-10 h-10 text-cyan-400" />
              </div>
              <div>
                <p className="text-xs text-cyan-400 font-bold uppercase tracking-widest mb-1 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"/>
                    {msg.nickname === 'Regia' ? 'COMUNICAZIONE UFFICIALE' : `Messaggio da ${msg.nickname}`}
                </p>
                <p className="text-4xl font-black leading-tight">{msg.text}</p>
              </div>
            </div>
          ))}
      </div>

      {/* ANIMAZIONI CSS */}
      <style jsx>{`
        .ticker-container { width: 100%; overflow: hidden; white-space: nowrap; }
        .ticker-content { display: inline-block; padding-left: 100%; animation: ticker 20s linear infinite; }
        @keyframes ticker { 0% { transform: translateX(0); } 100% { transform: translateX(-100%); } }
        
        .animate-float-up { animation: floatUp 3s ease-in forwards; }
        @keyframes floatUp { 0% { transform: translateY(0) scale(0.5); opacity: 0; } 10% { opacity: 1; } 100% { transform: translateY(-90vh) scale(1.5); opacity: 0; } }
        
        .animate-slide-in-left { animation: slideInLeft 0.5s cubic-bezier(0.2, 0.8, 0.2, 1); }
        @keyframes slideInLeft { from { transform: translateX(-100px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }

        .animate-slide-up { animation: slideUp 0.8s ease-out; }
        @keyframes slideUp { from { transform: translateY(50px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

        .animate-spin-slow { animation: spin 8s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
        
        .animate-fade-in { animation: fadeIn 0.5s ease-out; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        
        .animate-zoom-in { animation: zoomIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1); }
        @keyframes zoomIn { from { transform: scale(0.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }

        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #555; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
      `}</style>
    </div>
  );
};

export default PubDisplay;