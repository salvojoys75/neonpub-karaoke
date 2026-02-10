import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { Mic2, Trophy, Star, MessageSquare, Clock, Music, CheckCircle2, XCircle } from "lucide-react";
import api from "@/lib/api";
import { supabase } from "@/lib/supabase";

// ===========================================
// UTILS
// ===========================================
const getYoutubeId = (url) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
};

// ===========================================
// COMPONENTE: KARAOKE SCREEN (Invariato nella logica, ottimizzato)
// ===========================================
const KaraokeScreen = ({ performance, isVoting, voteResult }) => {
    const playerRef = useRef(null);
    const prevStatus = useRef(performance?.status);

    useEffect(() => {
        if (!performance || isVoting || voteResult) return;
        const videoId = getYoutubeId(performance.youtube_url);
        if (!videoId) return;

        const onPlayerReady = (event) => {
            if (performance.status === 'live') event.target.playVideo();
            else event.target.pauseVideo();
        };

        if (!window.YT) return; // Gestito globalmente

        if (!playerRef.current) {
            playerRef.current = new window.YT.Player('karaoke-player', {
                videoId: videoId,
                playerVars: { autoplay: 1, controls: 0, disablekb: 1, fs: 0, iv_load_policy: 3, modestbranding: 1, rel: 0, showinfo: 0 },
                events: { onReady: onPlayerReady }
            });
        } else {
             // Se cambia canzone
             const currentData = playerRef.current.getVideoData();
             if(currentData && currentData.video_id !== videoId) {
                 playerRef.current.loadVideoById(videoId);
             }
             // Se cambia solo lo stato (pause/play)
             if (performance.status !== prevStatus.current) {
                 if (performance.status === 'live') playerRef.current.playVideo();
                 else if (performance.status === 'paused') playerRef.current.pauseVideo();
                 prevStatus.current = performance.status;
             }
        }
    }, [performance, isVoting, voteResult]);

    // Nascondi player durante voto
    useEffect(() => {
        const el = document.getElementById('karaoke-player');
        if (el) el.style.visibility = (isVoting || voteResult) ? 'hidden' : 'visible';
        if ((isVoting || voteResult) && playerRef.current?.pauseVideo) playerRef.current.pauseVideo();
    }, [isVoting, voteResult]);

    return (
        <div className="absolute inset-0 bg-black flex flex-col justify-center overflow-hidden">
            <div id="karaoke-player" className="absolute inset-0 w-full h-full z-0 pointer-events-none" />
            
            {!isVoting && !voteResult && (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/80 to-transparent p-12 z-10 pb-20 animate-fade-in">
                    <h2 className="text-6xl font-black text-white mb-2 drop-shadow-lg">{performance.song_title}</h2>
                    <div className="flex items-end gap-6">
                        <p className="text-4xl text-zinc-300 font-medium">{performance.song_artist}</p>
                        <div className="bg-fuchsia-600 px-6 py-2 rounded-full flex items-center gap-3 animate-pulse">
                            <Mic2 className="w-8 h-8" />
                            <span className="text-2xl font-bold uppercase tracking-wider">{performance.user_nickname}</span>
                        </div>
                    </div>
                </div>
            )}

            {isVoting && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-zinc-900 animate-zoom-in">
                    <h2 className="text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-600 mb-8 animate-pulse drop-shadow-lg">VOTA ORA!</h2>
                    <div className="bg-white/10 p-16 rounded-full border-8 border-yellow-500 shadow-[0_0_100px_rgba(234,179,8,0.5)] animate-spin-slow">
                        <Star className="w-48 h-48 text-yellow-500 fill-yellow-500" />
                    </div>
                </div>
            )}

            {voteResult !== null && (
                <div className="absolute inset-0 z-25 flex flex-col items-center justify-center bg-black/95 animate-fade-in">
                    <h2 className="text-6xl text-white font-bold mb-8">MEDIA VOTO</h2>
                    <div className="flex items-center gap-6">
                        <Star className="w-32 h-32 text-yellow-400 fill-yellow-400 animate-bounce" />
                        <span className="text-[12rem] font-black text-white leading-none">{Number(voteResult).toFixed(1)}</span>
                    </div>
                </div>
            )}
        </div>
    );
};

// ===========================================
// NUOVO COMPONENTE: QUIZ GAME SHOW
// ===========================================
const QuizGameShow = ({ quiz, quizResults, leaderboard }) => {
    const playerRef = useRef(null);
    const containerRef = useRef(null);
    // Usiamo ref per tracciare se il video è già caricato per evitare reload
    const currentVideoId = useRef(null);

    // 1. GESTIONE PLAYER (Video/Audio)
    useEffect(() => {
        if (!quiz || quiz.status === 'leaderboard') {
            // Se andiamo in classifica, mettiamo in pausa o nascondiamo, ma non necessariamente distruggiamo
             if(playerRef.current && typeof playerRef.current.pauseVideo === 'function') {
                 playerRef.current.pauseVideo();
             }
             return;
        }

        const videoId = getYoutubeId(quiz.media_url);
        const hasMedia = quiz.media_type === 'video' || (quiz.media_type === 'audio' && videoId);

        if (!hasMedia || !videoId) {
            if (playerRef.current) { 
                try { playerRef.current.destroy(); } catch(e){} 
                playerRef.current = null;
                currentVideoId.current = null;
            }
            return;
        }

        // Se il video è lo stesso, non fare nulla (evita reload)
        if (currentVideoId.current === videoId) {
             // Assicuriamoci solo che stia suonando se siamo in active
             if(quiz.status === 'active' && playerRef.current && typeof playerRef.current.playVideo === 'function') {
                 playerRef.current.playVideo();
             }
             return;
        }

        // Inizializza nuovo video
        currentVideoId.current = videoId;
        
        const onReady = (event) => {
            event.target.setVolume(100);
            if (quiz.status === 'active') event.target.playVideo();
            else event.target.pauseVideo(); // Se siamo in closed/results, magari vogliamo fermo
        };

        if (!window.YT) return; 

        // Pulisci vecchio player se esiste nel DOM ma React ha perso il ref
        const existingFrame = document.getElementById('quiz-player-frame');
        if(existingFrame && !playerRef.current) {
             // Forziamo ricreazione
             playerRef.current = new window.YT.Player('quiz-player-frame', {
                videoId: videoId,
                playerVars: { autoplay: 1, controls: 0, disablekb: 1, fs: 0, iv_load_policy: 3, modestbranding: 1, rel: 0, showinfo: 0 },
                events: { onReady }
            });
        } else if (!playerRef.current) {
             playerRef.current = new window.YT.Player('quiz-player-frame', {
                videoId: videoId,
                playerVars: { autoplay: 1, controls: 0, disablekb: 1, fs: 0, iv_load_policy: 3, modestbranding: 1, rel: 0, showinfo: 0 },
                events: { onReady }
            });
        } else {
            playerRef.current.loadVideoById(videoId);
        }

    }, [quiz.id, quiz.media_url, quiz.status]); // Dipendenze controllate

    // 2. RENDER SCENE
    const isVideo = quiz.media_type === 'video';
    const isAudio = quiz.media_type === 'audio';
    
    // Status Logic
    const showQuestion = quiz.status === 'active' || quiz.status === 'closed';
    const showResult = quiz.status === 'showing_results';
    const showLeaderboard = quiz.status === 'leaderboard';

    if (showLeaderboard) {
        return (
            <div className="absolute inset-0 bg-zinc-900 z-50 flex flex-col p-8 overflow-hidden animate-fade-in">
                <div className="text-center mb-6">
                    <h1 className="text-6xl font-black text-yellow-500 uppercase drop-shadow-[0_0_15px_rgba(234,179,8,0.5)]">CLASSIFICA GENERALE</h1>
                </div>
                <div className="flex-1 overflow-y-auto grid grid-cols-2 gap-x-12 gap-y-4 px-12 content-start custom-scrollbar">
                    {leaderboard.map((p, i) => (
                        <div key={p.id} className={`flex items-center p-4 rounded-xl text-3xl font-bold transform transition-all ${i<3 ? 'scale-105 bg-gradient-to-r from-yellow-600/30 to-transparent border border-yellow-500/50' : 'bg-white/5'}`}>
                            <span className={`w-16 h-16 flex items-center justify-center rounded-full mr-6 text-2xl border-4 ${i===0 ? 'bg-yellow-500 text-black border-yellow-300' : i===1 ? 'bg-zinc-400 text-black border-zinc-200' : i===2 ? 'bg-amber-700 text-white border-amber-500' : 'bg-zinc-800 text-zinc-500 border-zinc-600'}`}>
                                {i+1}
                            </span>
                            <span className="flex-1 truncate text-white">{p.nickname}</span>
                            <span className="text-yellow-400 font-mono">{p.score}</span>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="absolute inset-0 bg-black overflow-hidden flex flex-col items-center justify-center">
            
            {/* LAYER 0: MEDIA (Sempre montato ma nascosto o oscurato) */}
            <div className={`absolute inset-0 w-full h-full transition-opacity duration-1000 ${isVideo ? 'opacity-100' : 'opacity-0'}`}>
                 <div id="quiz-player-frame" className="w-full h-full pointer-events-none" />
                 {/* Overlay scuro per leggere testo sopra video */}
                 <div className="absolute inset-0 bg-black/60" />
            </div>

            {/* LAYER 0.5: AUDIO VISUALIZER (Se audio) */}
            {isAudio && (
                <div className="absolute inset-0 flex items-center justify-center animate-pulse opacity-30">
                    <Music className="w-96 h-96 text-fuchsia-600" />
                </div>
            )}

            {/* LAYER 1: DOMANDA & OPZIONI */}
            <div className={`z-10 w-full max-w-7xl p-8 transition-all duration-500 transform ${showQuestion ? 'scale-100 opacity-100' : 'scale-90 opacity-0 absolute pointer-events-none'}`}>
                <div className="flex justify-center mb-8">
                     <span className={`px-8 py-2 rounded-full text-2xl font-black uppercase tracking-widest shadow-xl border border-white/20 ${quiz.status === 'closed' ? 'bg-red-600 text-white' : 'bg-fuchsia-600 text-white animate-pulse'}`}>
                        {quiz.status === 'closed' ? "TEMPO SCADUTO!" : "IN ONDA"}
                     </span>
                </div>

                <div className="bg-black/70 backdrop-blur-md border border-white/10 rounded-[3rem] p-12 text-center shadow-2xl mb-12">
                    <h2 className="text-6xl font-black text-white leading-tight drop-shadow-xl">{quiz.question}</h2>
                </div>

                <div className="grid grid-cols-2 gap-8">
                    {quiz.options.map((opt, i) => (
                        <div key={i} className={`
                            relative overflow-hidden p-8 rounded-3xl text-4xl font-bold border-4 transition-all transform duration-300
                            ${quiz.status === 'closed' ? 'bg-zinc-900 border-zinc-700 text-zinc-500 scale-95 grayscale' : 'bg-gradient-to-br from-white/10 to-transparent border-white/20 text-white hover:scale-105 shadow-lg'}
                        `}>
                            <span className="text-fuchsia-500 mr-4 font-mono">{String.fromCharCode(65+i)}.</span> {opt}
                        </div>
                    ))}
                </div>
            </div>

            {/* LAYER 2: RISULTATO (Sovrapposto) */}
            {showResult && quizResults && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/80 backdrop-blur-xl animate-zoom-in p-10">
                    <div className="bg-gradient-to-br from-zinc-900 to-black border-4 border-green-500 p-16 rounded-[4rem] text-center shadow-[0_0_100px_rgba(34,197,94,0.4)] max-w-5xl w-full">
                        <Trophy className="w-32 h-32 text-yellow-400 mx-auto mb-6 animate-bounce" />
                        
                        <h3 className="text-3xl text-zinc-400 uppercase tracking-widest mb-4">La risposta esatta è</h3>
                        <div className="bg-green-600 text-white text-6xl font-black py-8 px-12 rounded-3xl mb-10 shadow-lg transform scale-110">
                            {quizResults.correct_option}
                        </div>

                        <div className="grid grid-cols-3 gap-4 text-center border-t border-white/10 pt-8">
                            <div>
                                <div className="text-4xl font-bold text-white">{quizResults.total_answers}</div>
                                <div className="text-sm text-zinc-500 uppercase">Risposte Totali</div>
                            </div>
                            <div>
                                <div className="text-4xl font-bold text-green-400">{quizResults.correct_count}</div>
                                <div className="text-sm text-zinc-500 uppercase">Indovinate</div>
                            </div>
                            <div>
                                <div className="text-4xl font-bold text-fuchsia-400">{quizResults.points}</div>
                                <div className="text-sm text-zinc-500 uppercase">Punti in palio</div>
                            </div>
                        </div>

                        {quizResults.winners.length > 0 && (
                            <div className="mt-8 pt-6 border-t border-white/10">
                                <p className="text-green-300 font-bold uppercase text-sm mb-2">I più veloci</p>
                                <p className="text-2xl text-white font-medium truncate">
                                    {quizResults.winners.slice(0, 3).join(' • ')}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

// ===========================================
// MAIN COMPONENT: PUB DISPLAY
// ===========================================
export default function PubDisplay() {
  const { pubCode } = useParams();
  const [displayData, setDisplayData] = useState(null);
  const [ticker, setTicker] = useState("");
  const [floatingReactions, setFloatingReactions] = useState([]);
  const [flashMessages, setFlashMessages] = useState([]);
  const [quizResults, setQuizResults] = useState(null);
  const [voteResult, setVoteResult] = useState(null);

  // Inizializza API YouTube una volta sola
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
      if(!data) return; // Evento scaduto o invalido

      setDisplayData(data);
      
      // Ticker logic
      if (data.queue?.length > 0) {
        setTicker(data.queue.slice(0, 5).map((s, i) => `${i + 1}. ${s.title} (${s.user_nickname})`).join(' • '));
      } else {
        setTicker("Inquadra il QR Code per cantare!");
      }

      // Vote Result Logic
      if (data.current_performance?.status === 'ended' && !voteResult && data.current_performance.average_score > 0) {
         setVoteResult(data.current_performance.average_score);
         setTimeout(() => setVoteResult(null), 10000);
      }
    } catch (error) { console.error(error); }
  }, [pubCode, voteResult]);

  // Polling e Realtime
  useEffect(() => {
    loadDisplayData();
    const interval = setInterval(loadDisplayData, 5000);

    const channel = supabase.channel(`display_realtime`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'performances', filter: `event_id=eq.${displayData?.pub?.id}` }, 
            (payload) => {
                // Aggiornamento immediato stato performance
                setDisplayData(prev => prev ? ({ ...prev, current_performance: payload.new }) : null);
                if (payload.new.status === 'voting' || payload.new.status === 'ended') loadDisplayData();
            }
        )
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reactions', filter: `event_id=eq.${displayData?.pub?.id}` }, 
            (payload) => addFloatingReaction(payload.new.emoji, payload.new.nickname)
        )
        .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `event_id=eq.${displayData?.pub?.id}` }, 
            async (payload) => {
                 if(payload.new.status === 'approved') {
                     let nick = "Regia";
                     if(payload.new.participant_id) {
                         const { data } = await supabase.from('participants').select('nickname').eq('id', payload.new.participant_id).single();
                         if(data) nick = data.nickname;
                     }
                     showFlashMessage({ text: payload.new.text, nickname: nick });
                 }
            }
        )
        .on('postgres_changes', { event: '*', schema: 'public', table: 'quizzes', filter: `event_id=eq.${displayData?.pub?.id}` }, 
            async (payload) => {
                const updatedQuiz = payload.new;
                // Aggiorna immediatamente lo stato del quiz locale per reattività
                setDisplayData(prev => {
                    if(!prev) return null;
                    // Se il quiz è finito, lo togliamo dopo un po'
                    if (updatedQuiz.status === 'ended') {
                         setTimeout(() => { 
                             setDisplayData(curr => ({ ...curr, active_quiz: null })); 
                             setQuizResults(null); 
                         }, 5000);
                         return { ...prev, active_quiz: updatedQuiz };
                    }
                    return { ...prev, active_quiz: updatedQuiz };
                });

                if (updatedQuiz.status === 'active' || updatedQuiz.status === 'closed') { 
                    setQuizResults(null); 
                } else if (updatedQuiz.status === 'showing_results' || updatedQuiz.status === 'leaderboard') {
                    // Fetch risultati
                    const res = await api.getQuizResults(updatedQuiz.id); 
                    setQuizResults(res.data);
                }
            }
        )
        .subscribe();

    return () => {
        clearInterval(interval);
        supabase.removeChannel(channel);
    };
  }, [displayData?.pub?.id, pubCode, loadDisplayData]);

  // Effects Helpers
  const showFlashMessage = (msg) => {
    const id = Date.now();
    setFlashMessages(prev => [...prev, { ...msg, internalId: id }]);
    setTimeout(() => setFlashMessages(prev => prev.filter(m => m.internalId !== id)), 10000);
  };

  const addFloatingReaction = (emoji, nickname) => {
    const id = Date.now() + Math.random();
    const left = Math.random() * 80 + 10;
    setFloatingReactions(prev => [...prev, { id, emoji, nickname, left }]);
    setTimeout(() => setFloatingReactions(prev => prev.filter(r => r.id !== id)), 4000);
  };

  // RENDER LOGIC
  const currentPerf = displayData?.current_performance;
  const activeQuiz = displayData?.active_quiz;
  const joinUrl = `${window.location.origin}/join/${pubCode}`;
  
  // Decide what to show: Quiz > Karaoke > Idle
  let ScreenComponent = null;
  const isLeaderboardMode = activeQuiz && activeQuiz.status === 'leaderboard';

  if (activeQuiz && activeQuiz.status !== 'ended') {
      ScreenComponent = <QuizGameShow quiz={activeQuiz} quizResults={quizResults} leaderboard={displayData?.leaderboard || []} />;
  } else if (currentPerf && (currentPerf.status === 'live' || currentPerf.status === 'paused' || currentPerf.status === 'voting' || voteResult)) {
      ScreenComponent = <KaraokeScreen performance={currentPerf} isVoting={currentPerf.status === 'voting'} voteResult={voteResult} />;
  } else {
      ScreenComponent = (
         <div className="flex flex-col items-center justify-center h-full z-10 bg-zinc-950 animate-fade-in relative">
            <h2 className="text-7xl font-bold mb-8 text-white">PROSSIMO CANTANTE... TU?</h2>
            <div className="bg-white p-6 rounded-3xl shadow-[0_0_50px_rgba(255,255,255,0.2)]">
                <QRCodeSVG value={joinUrl} size={300} />
            </div>
            <p className="text-4xl text-zinc-400 mt-8 font-mono tracking-widest">{pubCode}</p>
         </div>
      );
  }

  return (
    <div className="h-screen bg-black text-white overflow-hidden flex flex-col font-sans">
      
      {/* HEADER */}
      <div className="h-16 bg-zinc-900 flex items-center px-6 border-b border-zinc-800 z-50 relative shadow-xl">
         <div className="font-bold text-xl mr-8 text-fuchsia-500">{displayData?.pub?.name || "NEONPUB"}</div>
         <div className="flex-1 overflow-hidden relative h-full flex items-center">
            <div className="ticker-container w-full"><div className="ticker-content text-lg font-medium text-cyan-300">{ticker}</div></div>
         </div>
      </div>

      <div className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 relative bg-black flex flex-col justify-center overflow-hidden">
           {ScreenComponent}
        </div>

        {/* SIDEBAR (Nascosta durante leaderboard quiz) */}
        {!isLeaderboardMode && (
            <div className="w-[350px] bg-zinc-900/95 border-l border-zinc-800 flex flex-col z-30 shadow-2xl relative">
                <div className="p-6 flex flex-col items-center bg-white/5 border-b border-white/10">
                    <div className="bg-white p-3 rounded-xl mb-3 shadow-lg transform hover:scale-105 transition"><QRCodeSVG value={joinUrl} size={150} /></div>
                    <p className="font-mono text-3xl font-bold text-cyan-400 tracking-widest drop-shadow">{pubCode}</p>
                </div>
                
                <div className="flex-1 overflow-hidden flex flex-col p-8 items-center justify-center text-center space-y-6">
                    {displayData?.pub?.logo_url ? (
                        <img src={displayData.pub.logo_url} alt="Logo" className="w-40 h-40 object-contain drop-shadow-2xl"/>
                    ) : (
                        <div className="w-40 h-40 bg-zinc-800 rounded-full flex items-center justify-center text-zinc-600 text-4xl font-bold border-4 border-zinc-700">LOGO</div>
                    )}
                </div>

                <div className="h-[35%] border-t border-white/10 p-4 bg-gradient-to-b from-zinc-900 to-black">
                    <h3 className="text-lg font-bold text-yellow-500 mb-4 flex items-center gap-2 uppercase tracking-wider"><Trophy className="w-5 h-5"/> Top Player</h3>
                    <div className="space-y-2 overflow-y-auto custom-scrollbar h-full pb-4">
                        {(displayData?.leaderboard || []).slice(0, 5).map((p, i) => (
                            <div key={p.id} className={`flex justify-between items-center p-2 rounded ${i===0 ? 'bg-yellow-500/20 border border-yellow-500/30' : ''}`}>
                                <div className="flex items-center gap-3">
                                    <span className={`font-bold w-6 h-6 flex items-center justify-center rounded-full text-xs ${i===0 ? 'bg-yellow-500 text-black' : 'bg-zinc-800 text-zinc-400'}`}>{i+1}</span>
                                    <span className={`font-medium ${i===0 ? 'text-white' : 'text-zinc-300'}`}>{p.nickname}</span>
                                </div>
                                <span className="text-cyan-400 font-mono font-bold">{p.score}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )}
      </div>

      <div className="reactions-overlay pointer-events-none fixed inset-0 z-[100] overflow-hidden">
        {floatingReactions.map(r => (
            <div key={r.id} className="absolute flex flex-col items-center animate-float-up" style={{ left: `${r.left}%`, bottom: '-50px' }}>
              <span className="text-7xl filter drop-shadow-2xl">{r.emoji}</span>
              <span className="text-xl text-white font-bold mt-1 bg-black/70 px-4 py-1 rounded-full border border-white/20 shadow-xl">{r.nickname}</span>
            </div>
        ))}
      </div>

      {flashMessages.length > 0 && (
        <div className="fixed top-24 left-8 z-[110] w-2/3 max-w-4xl flex flex-col gap-4">
          {flashMessages.map(msg => (
            <div key={msg.internalId} className="bg-black/90 backdrop-blur-xl border-l-8 border-cyan-500 text-white p-6 rounded-r-2xl shadow-2xl animate-slide-in-left flex items-start gap-6">
              <div className="bg-cyan-500/20 p-4 rounded-full"><MessageSquare className="w-10 h-10 text-cyan-400" /></div>
              <div>
                <p className="text-sm text-cyan-400 font-bold uppercase tracking-widest mb-1">{msg.nickname === 'Regia' ? '📢 MESSAGGIO DALLA REGIA' : `Messaggio da ${msg.nickname}`}</p>
                <p className="text-4xl font-bold leading-tight">{msg.text}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <style jsx>{`
        .ticker-container { width: 100%; overflow: hidden; }
        .ticker-content { display: inline-block; white-space: nowrap; animation: ticker 30s linear infinite; }
        @keyframes ticker { 0% { transform: translateX(100%); } 100% { transform: translateX(-100%); } }
        .animate-float-up { animation: floatUp 4s ease-out forwards; }
        @keyframes floatUp { 0% { transform: translateY(0) scale(0.5); opacity: 0; } 10% { opacity: 1; } 90% { opacity: 1; } 100% { transform: translateY(-80vh) scale(1.5); opacity: 0; } }
        .animate-spin-slow { animation: spin 8s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
        .animate-slide-in-left { animation: slideInLeft 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
        @keyframes slideInLeft { from { transform: translateX(-100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        .animate-zoom-in { animation: zoomIn 0.4s ease-out; }
        @keyframes zoomIn { from { transform: scale(0.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .animate-fade-in { animation: fadeIn 0.5s ease-out; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #444; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
      `}</style>
    </div>
  );
}