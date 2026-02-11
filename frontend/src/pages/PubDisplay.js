import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '@/lib/supabase';
import api from '@/lib/api';
import { 
  Music, Trophy, Mic2, MessageSquare, Star, 
  Sparkles, Crown, Loader2, Play 
} from 'lucide-react';

// ===========================================
// COMPONENTE INTERNO: PLAYER PERSISTENTE
// ===========================================
const PersistentGamePlayer = ({ mediaUrl, mediaType, isLeaderboard }) => {
    const playerRef = useRef(null);
    const currentVideoId = useRef(null);
    const [isLoading, setIsLoading] = useState(false);

    const getYoutubeId = (url) => {
        if (!url) return null;
        const regExp = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    };

    useEffect(() => {
        // Se siamo in classifica, mettiamo in pausa opzionalmente
        if (isLeaderboard && playerRef.current?.pauseVideo) {
            playerRef.current.pauseVideo();
            return;
        }

        const videoId = getYoutubeId(mediaUrl);
        const isYoutube = mediaType === 'video' || (mediaType === 'audio' && videoId);

        if (!isYoutube || !videoId) {
            if(playerRef.current) {
                try { playerRef.current.destroy(); } catch(e){}
                playerRef.current = null;
                currentVideoId.current = null;
            }
            return;
        }

        // Se il video è lo stesso, play e unmute (evita reload)
        if (currentVideoId.current === videoId && playerRef.current) {
             if (typeof playerRef.current.playVideo === 'function') {
                 playerRef.current.playVideo();
                 playerRef.current.unMute();
             }
             return;
        }

        // Caricamento Nuovo Video
        setIsLoading(true);
        currentVideoId.current = videoId;

        const onReady = (event) => {
            event.target.setVolume(100);
            event.target.unMute();
            event.target.playVideo();
            setIsLoading(false);
        };

        if (!window.YT) return;

        if (playerRef.current) {
            playerRef.current.loadVideoById(videoId);
            setIsLoading(false);
        } else {
            playerRef.current = new window.YT.Player('game-fixed-player', {
                videoId: videoId,
                playerVars: { 
                    autoplay: 1, controls: 0, disablekb: 1, fs: 0, 
                    iv_load_policy: 3, modestbranding: 1, rel: 0, showinfo: 0, 
                    loop: 1, playsinline: 1 
                },
                events: { onReady }
            });
        }
    }, [mediaUrl, mediaType, isLeaderboard]);

    if (!mediaUrl) return null;
    const isAudioOnly = mediaType === 'audio';

    return (
        <div className="w-full h-full relative bg-black overflow-hidden rounded-3xl border-4 border-zinc-800 shadow-2xl">
            <div id="game-fixed-player" className={`w-full h-full ${isAudioOnly ? 'opacity-0' : 'opacity-100'}`} />
            
            {isAudioOnly && (
                <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
                    <div className="animate-pulse flex flex-col items-center">
                        <div className="p-8 rounded-full bg-fuchsia-600/20 border-4 border-fuchsia-500">
                            <Music className="w-24 h-24 text-white" />
                        </div>
                        <p className="mt-4 text-white font-bold tracking-widest uppercase">Traccia Audio</p>
                    </div>
                </div>
            )}
            
            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-20">
                    <Loader2 className="w-12 h-12 text-fuchsia-500 animate-spin" />
                </div>
            )}
        </div>
    );
};

// ===========================================
// COMPONENTE INTERNO: QUIZ SPLIT LAYOUT
// ===========================================
const QuizGameShow = ({ quiz, quizResults, leaderboard }) => {
    const isLeaderboard = quiz.status === 'leaderboard';
    const isResult = quiz.status === 'showing_results';
    const isQuestion = quiz.status === 'active' || quiz.status === 'closed';

    // OVERLAY CLASSIFICA (Fullscreen)
    if (isLeaderboard) {
        return (
            <div className="absolute inset-0 z-50 bg-zinc-950 flex flex-col p-8 animate-fade-in">
                <div className="text-center mb-6">
                    <h1 className="text-6xl font-black text-yellow-500 uppercase flex justify-center items-center gap-4">
                        <Trophy className="w-16 h-16"/> CLASSIFICA
                    </h1>
                </div>
                <div className="flex-1 overflow-y-auto grid grid-cols-2 gap-x-12 gap-y-4 px-12 content-start custom-scrollbar">
                    {leaderboard.map((p, i) => (
                        <div key={p.id} className={`flex items-center p-6 rounded-2xl text-4xl font-bold transition-all 
                            ${i<3 ? 'bg-gradient-to-r from-yellow-900/40 to-black border-l-8 border-yellow-500 pl-8 scale-105 shadow-xl' : 'bg-white/5 border-l-4 border-zinc-700'}`}>
                            <span className={`w-20 text-right mr-8 font-mono ${i===0?'text-yellow-400':i===1?'text-zinc-300':i===2?'text-amber-600':'text-zinc-600'}`}>#{i+1}</span>
                            <span className="flex-1 truncate text-white tracking-tight">{p.nickname}</span>
                            <span className="text-yellow-500 font-mono bg-black/30 px-6 py-2 rounded-lg">{p.score}</span>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="absolute inset-0 bg-zinc-950 flex flex-col p-6 gap-6">
            
            {/* --- ZONA SUPERIORE: MEDIA (45%) --- */}
            <div className="h-[45%] flex gap-6">
                <div className="flex-1 relative">
                    {quiz.media_url ? (
                        <PersistentGamePlayer 
                            mediaUrl={quiz.media_url} 
                            mediaType={quiz.media_type} 
                            isLeaderboard={false} 
                        />
                    ) : (
                        <div className="w-full h-full bg-zinc-900 rounded-3xl border-4 border-zinc-800 flex items-center justify-center shadow-inner">
                            <Sparkles className="w-32 h-32 text-zinc-800" />
                        </div>
                    )}
                    
                    <div className="absolute top-4 left-4 z-10">
                        <span className={`px-6 py-2 rounded-full text-xl font-black uppercase tracking-widest shadow-xl border-2 border-black/50
                            ${quiz.status === 'closed' ? 'bg-red-600 text-white' : 'bg-fuchsia-600 text-white animate-pulse'}`}>
                            {quiz.status === 'closed' ? "STOP AL TELEVOTO" : "IN ONDA"}
                        </span>
                    </div>
                </div>

                {/* Box Punti Laterale */}
                <div className="w-[300px] bg-zinc-900 rounded-3xl border-2 border-zinc-800 p-6 flex flex-col items-center justify-center text-center shadow-xl">
                    <p className="text-zinc-500 text-sm uppercase tracking-widest mb-2">Punti in palio</p>
                    <div className="text-7xl font-black text-yellow-500 mb-6">{quiz.points}</div>
                    <div className="w-full h-1 bg-zinc-800 rounded-full mb-6"></div>
                    <p className="text-zinc-500 text-sm uppercase tracking-widest mb-2">Categoria</p>
                    <div className="text-2xl font-bold text-white px-4 py-1 bg-white/10 rounded-lg">{quiz.category || "Generale"}</div>
                </div>
            </div>

            {/* --- ZONA INFERIORE: DOMANDA & RISULTATI (55%) --- */}
            <div className="flex-1 relative bg-zinc-900 rounded-[3rem] border border-white/10 overflow-hidden shadow-2xl">
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
                
                <div className="absolute inset-0 flex flex-col items-center justify-center p-8 z-10">
                    
                    {/* SCENA 1: DOMANDA */}
                    {isQuestion && (
                        <div className="w-full h-full flex flex-col animate-fade-in">
                            <div className="flex-1 flex items-center justify-center mb-8">
                                <h2 className="text-5xl md:text-6xl font-black text-white text-center leading-tight drop-shadow-lg max-w-5xl">
                                    {quiz.question}
                                </h2>
                            </div>
                            <div className="grid grid-cols-2 gap-6 w-full">
                                {quiz.options.map((opt, i) => (
                                    <div key={i} className={`p-6 rounded-2xl text-3xl font-bold border-2 transition-all transform flex items-center
                                        ${quiz.status === 'closed' ? 'bg-zinc-800 border-zinc-700 text-zinc-500' : 'bg-white/5 border-white/10 text-white hover:bg-white/10 hover:border-fuchsia-500/50'}`}>
                                        <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center mr-4 text-fuchsia-400 font-mono text-xl border border-white/10">
                                            {String.fromCharCode(65+i)}
                                        </div>
                                        {opt}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* SCENA 2: RISULTATO */}
                    {isResult && quizResults && (
                        <div className="w-full h-full flex flex-col items-center justify-center animate-zoom-in">
                            <h3 className="text-2xl text-zinc-400 uppercase tracking-widest mb-4">La risposta corretta è</h3>
                            
                            <div className="bg-green-600 text-white text-6xl font-black py-8 px-16 rounded-3xl mb-8 shadow-[0_0_60px_rgba(34,197,94,0.4)] transform scale-110 border-4 border-green-400">
                                {quizResults.correct_option}
                            </div>

                            <div className="grid grid-cols-3 gap-12 text-center w-full max-w-4xl border-t border-white/10 pt-8 mt-4">
                                <div><div className="text-5xl font-bold text-white">{quizResults.total_answers}</div><div className="text-sm text-zinc-500 uppercase mt-1">Risposte</div></div>
                                <div><div className="text-5xl font-bold text-green-400">{quizResults.correct_count}</div><div className="text-sm text-green-600 uppercase mt-1">Esatte</div></div>
                                <div>
                                    <div className="text-2xl text-white font-medium flex flex-wrap justify-center gap-2 mt-1">
                                        {quizResults.winners.length > 0 ? quizResults.winners.slice(0,3).map((w,i)=><span key={i} className="bg-white/10 px-3 py-1 rounded text-sm">{w}</span>) : "-"}
                                    </div>
                                    <div className="text-sm text-zinc-500 uppercase mt-2">I più veloci</div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ===========================================
// COMPONENTE INTERNO: KARAOKE SCREEN
// ===========================================
const KaraokeScreen = ({ performance, isVoting, voteResult }) => {
    const playerRef = useRef(null);

    useEffect(() => {
        if (!performance?.youtube_url) return;
        const videoId = performance.youtube_url.match(/^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/)?.[2];
        if(!videoId) return;

        if (!window.YT) return;

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
             if (performance.status === 'live' && !isVoting) playerRef.current.playVideo();
             else playerRef.current.pauseVideo();
        }
    }, [performance, isVoting]);

    return (
        <div className="absolute inset-0 bg-black overflow-hidden">
             <div id="karaoke-player" className={`absolute inset-0 w-full h-full pointer-events-none transition-opacity duration-500 ${isVoting || voteResult ? 'opacity-20 blur-sm' : 'opacity-100'}`} />
             
             {!isVoting && !voteResult && (
                <div className="absolute bottom-0 left-0 right-0 p-12 bg-gradient-to-t from-black via-black/80 to-transparent z-10">
                   <div className="flex items-end gap-8 animate-slide-up">
                      <div className="bg-white/10 p-6 rounded-full backdrop-blur-md border border-white/20"><Mic2 className="w-16 h-16 text-fuchsia-500" /></div>
                      <div>
                          <h1 className="text-6xl font-black text-white mb-2 uppercase leading-tight">{performance.song_title}</h1>
                          <p className="text-4xl text-cyan-300 font-bold">{performance.song_artist}</p>
                          <div className="mt-4 flex items-center gap-3"><span className="text-xl text-zinc-400 uppercase tracking-widest">Cantante:</span><span className="bg-fuchsia-600 px-4 py-1 rounded text-2xl font-bold text-white uppercase">{performance.user_nickname}</span></div>
                      </div>
                   </div>
                </div>
             )}

             {isVoting && (
                  <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
                      <div className="bg-gradient-to-br from-yellow-600/20 to-orange-600/20 p-20 rounded-[3rem] border-4 border-yellow-500 shadow-[0_0_100px_rgba(234,179,8,0.4)] text-center">
                          <Star className="w-32 h-32 text-yellow-400 mx-auto mb-8 animate-spin-slow" />
                          <h2 className="text-8xl font-black text-white mb-4 drop-shadow-lg">VOTA ORA!</h2>
                      </div>
                  </div>
             )}

             {voteResult && (
                  <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/90 animate-zoom-in">
                      <Crown className="w-40 h-40 text-yellow-400 mb-8 animate-bounce" />
                      <h2 className="text-5xl font-bold text-zinc-400 uppercase tracking-widest mb-4">Punteggio Finale</h2>
                      <div className="text-[12rem] font-black text-white leading-none">{voteResult.toFixed(1)}</div>
                  </div>
             )}
        </div>
    );
};

// ===========================================
// MAIN PUB DISPLAY COMPONENT
// ===========================================
export default function PubDisplay() {
  const { pubCode } = useParams();
  const [displayData, setDisplayData] = useState(null);
  const [ticker, setTicker] = useState("");
  const [flashMessages, setFlashMessages] = useState([]);
  const [floatingReactions, setFloatingReactions] = useState([]);
  const [quizResults, setQuizResults] = useState(null);
  const [voteResult, setVoteResult] = useState(null);

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

      if (data.queue?.length > 0) setTicker(data.queue.map((s, i) => `${i + 1}. ${s.title} (${s.user_nickname})`).join('  •  '));
      else setTicker("SCANSIONA IL QR CODE PER PRENOTARE UNA CANZONE!  •  KARAOKE NIGHT");

      if (data.current_performance?.status === 'ended' && !voteResult && data.current_performance.average_score > 0) {
         setVoteResult(data.current_performance.average_score);
         setTimeout(() => setVoteResult(null), 10000);
      }
    } catch (error) { console.error(error); }
  }, [pubCode, voteResult]);

  const addFlashMessage = (msg) => {
      const id = Date.now();
      setFlashMessages(prev => [...prev, { id, text: msg.text, nickname: msg.nickname || "Regia" }]);
      setTimeout(() => setFlashMessages(prev => prev.filter(m => m.id !== id)), 10000);
  };

  const addReaction = (emoji, nickname) => {
      const id = Date.now() + Math.random();
      setFloatingReactions(prev => [...prev, { id, emoji, nickname, left: Math.random() * 80 + 10 }]);
      setTimeout(() => setFloatingReactions(prev => prev.filter(r => r.id !== id)), 4000);
  };

  useEffect(() => {
    loadDisplayData();
    const interval = setInterval(loadDisplayData, 5000);

    const channel = supabase.channel(`display_realtime`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'performances', filter: `event_id=eq.${displayData?.pub?.id}` }, (payload) => {
            setDisplayData(prev => prev ? ({ ...prev, current_performance: payload.new }) : null);
            if (payload.new.status === 'voting' || payload.new.status === 'ended') loadDisplayData();
        })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reactions', filter: `event_id=eq.${displayData?.pub?.id}` }, (payload) => {
            addReaction(payload.new.emoji, payload.new.nickname);
        })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `event_id=eq.${displayData?.pub?.id}` }, async (payload) => {
             if(payload.new.status === 'approved') {
                 let nick = "Regia";
                 if(payload.new.participant_id) {
                     const { data } = await supabase.from('participants').select('nickname').eq('id', payload.new.participant_id).single();
                     if(data) nick = data.nickname;
                 }
                 addFlashMessage({ text: payload.new.text, nickname: nick });
             }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'quizzes', filter: `event_id=eq.${displayData?.pub?.id}` }, async (payload) => {
            const updatedQuiz = payload.new;
            setDisplayData(prev => {
                 if(!prev) return null;
                 if(updatedQuiz.status === 'ended') { setTimeout(() => { setDisplayData(curr => ({ ...curr, active_quiz: null })); setQuizResults(null); }, 5000); }
                 return { ...prev, active_quiz: updatedQuiz };
            });
            if (updatedQuiz.status === 'active' || updatedQuiz.status === 'closed') { setQuizResults(null); }
            else if (updatedQuiz.status === 'showing_results' || updatedQuiz.status === 'leaderboard') {
                const res = await api.getQuizResults(updatedQuiz.id); 
                setQuizResults(res.data);
            }
        })
        .subscribe();
    return () => { clearInterval(interval); supabase.removeChannel(channel); };
  }, [displayData?.pub?.id, pubCode]);

  const currentPerf = displayData?.current_performance;
  const activeQuiz = displayData?.active_quiz;
  const joinUrl = `${window.location.origin}/join/${pubCode}`;
  
  const isQuizMode = activeQuiz && activeQuiz.status !== 'ended';
  const isKaraokeMode = !isQuizMode && currentPerf && (currentPerf.status === 'live' || currentPerf.status === 'paused' || currentPerf.status === 'voting' || voteResult);
  const showSidebar = !isQuizMode || (activeQuiz && activeQuiz.status !== 'leaderboard');

  return (
    <div className="h-screen bg-black text-white overflow-hidden flex flex-col font-sans select-none">
      
      {/* HEADER */}
      <div className="h-16 bg-zinc-900 flex items-center px-6 border-b border-zinc-800 z-50 shadow-2xl relative">
         <div className="font-black text-2xl text-white mr-8">NEON<span className="text-fuchsia-500">PUB</span></div>
         <div className="flex-1 overflow-hidden relative h-full flex items-center bg-zinc-950/50 rounded-lg border border-white/5 mx-4">
            <div className="ticker-container w-full"><div className="ticker-content text-lg font-bold text-cyan-300 font-mono flex items-center gap-8">{ticker}</div></div>
         </div>
         <div className="text-zinc-500 font-mono text-sm bg-zinc-800 px-3 py-1 rounded">ROOM: <span className="text-white font-bold">{pubCode}</span></div>
      </div>

      <div className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 relative bg-black flex flex-col justify-center overflow-hidden">
           
           {!isQuizMode && !isKaraokeMode && (
             <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-zinc-950 animate-fade-in">
                <div className="bg-white p-6 rounded-3xl mb-8 shadow-[0_0_80px_rgba(255,255,255,0.1)]"><QRCodeSVG value={joinUrl} size={300} /></div>
                <h2 className="text-6xl font-black text-white mb-4">CANTA CON NOI</h2>
                <p className="text-2xl text-zinc-400 font-mono">{pubCode}</p>
             </div>
           )}

           {isKaraokeMode && <KaraokeScreen performance={currentPerf} isVoting={currentPerf.status === 'voting'} voteResult={voteResult} />}
           {isQuizMode && <QuizGameShow quiz={activeQuiz} quizResults={quizResults} leaderboard={displayData?.leaderboard || []} />}
        </div>
        
        {showSidebar && (
            <div className="w-[350px] bg-zinc-900 border-l border-zinc-800 flex flex-col z-40 shadow-2xl relative">
                <div className="p-6 flex flex-col items-center bg-zinc-800/50 border-b border-white/5">
                    <div className="bg-white p-3 rounded-xl mb-2"><QRCodeSVG value={joinUrl} size={120} /></div>
                    <p className="font-black text-3xl text-fuchsia-500">{pubCode}</p>
                </div>
                <div className="flex-1 flex flex-col items-center justify-center p-8 opacity-50">
                     {displayData?.pub?.logo_url ? <img src={displayData.pub.logo_url} className="w-40 h-40 object-contain"/> : <div className="text-4xl font-black text-zinc-800">LOGO</div>}
                </div>
                <div className="h-[40%] border-t border-white/10 flex flex-col bg-zinc-950">
                    <div className="p-4 border-b border-white/5 bg-white/5 flex items-center gap-2"><Trophy className="w-4 h-4 text-yellow-500"/><span className="font-bold text-sm uppercase">Top Players</span></div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                        {(displayData?.leaderboard || []).slice(0, 5).map((p, i) => (
                            <div key={p.id} className="flex justify-between items-center p-3 rounded hover:bg-white/5"><div className="flex items-center gap-3"><span className="font-bold text-zinc-500 text-xs">{i+1}</span><span className="text-sm font-bold text-white truncate max-w-[120px]">{p.nickname}</span></div><span className="text-fuchsia-500 font-mono font-bold text-sm">{p.score}</span></div>
                        ))}
                    </div>
                </div>
            </div>
        )}
      </div>

      <div className="pointer-events-none fixed inset-0 z-[100] overflow-hidden">
        {floatingReactions.map(r => (
            <div key={r.id} className="absolute flex flex-col items-center animate-float-up" style={{ left: `${r.left}%`, bottom: '-50px' }}>
              <span className="text-7xl filter drop-shadow-2xl">{r.emoji}</span>
              <span className="text-xl text-white font-bold mt-1 bg-black/70 px-4 py-1 rounded-full border border-white/20 shadow-xl">{r.nickname}</span>
            </div>
        ))}
      </div>

      <div className="fixed top-24 left-8 z-[110] w-full max-w-2xl flex flex-col gap-4 pointer-events-none">
          {flashMessages.map(msg => (
            <div key={msg.id} className="bg-zinc-900/95 backdrop-blur-xl border-l-8 border-cyan-500 text-white p-6 rounded-r-2xl shadow-xl animate-slide-in-left flex items-start gap-4">
              <div className="bg-cyan-500/20 p-3 rounded-full"><MessageSquare className="w-6 h-6 text-cyan-400" /></div>
              <div><p className="text-xs text-cyan-400 font-bold uppercase mb-1">{msg.nickname === 'Regia' ? 'REGIA' : msg.nickname}</p><p className="text-2xl font-bold">{msg.text}</p></div>
            </div>
          ))}
      </div>

      <style jsx>{`
        .ticker-container { width: 100%; overflow: hidden; white-space: nowrap; }
        .ticker-content { display: inline-block; padding-left: 100%; animation: ticker 25s linear infinite; }
        @keyframes ticker { 0% { transform: translateX(0); } 100% { transform: translateX(-100%); } }
        .animate-float-up { animation: floatUp 4s ease-out forwards; }
        @keyframes floatUp { 0% { transform: translateY(0) scale(0.5); opacity: 0; } 10% { opacity: 1; } 100% { transform: translateY(-80vh) scale(1.5); opacity: 0; } }
        .animate-slide-in-left { animation: slideInLeft 0.5s cubic-bezier(0.2, 0.8, 0.2, 1); }
        @keyframes slideInLeft { from { transform: translateX(-50px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        .animate-fade-in { animation: fadeIn 0.5s ease-out; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .animate-zoom-in { animation: zoomIn 0.4s ease-out; }
        @keyframes zoomIn { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .animate-slide-up { animation: slideUp 0.6s ease-out; }
        @keyframes slideUp { from { transform: translateY(30px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .animate-spin-slow { animation: spin 10s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #444; border-radius: 4px; }
      `}</style>
    </div>
  );
};