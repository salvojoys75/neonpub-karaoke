import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '@/lib/supabase';
import api from '@/lib/api';
import { 
  Music, Trophy, Mic2, MessageSquare, Crown, Star, Sparkles, 
  Radio, VolumeX, User, Music2, Flame, Zap
} from 'lucide-react';

import QuizMediaFixed from '@/components/QuizMediaFixed';
import KaraokePlayer from '@/components/KaraokePlayer';
import FloatingReactions from '@/components/FloatingReactions';

// ===========================================
// SIDEBAR DESTRA - Design X-Factor
// ===========================================
const SidebarRight = ({ pub, code, leaderboard }) => (
  <div className="h-full w-80 bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950 border-l border-white/20 flex flex-col items-center py-8 px-4 z-50 shadow-2xl relative overflow-hidden">
      {/* Effetto Shimmer Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-950/20 via-transparent to-purple-950/20 animate-pulse-slow"></div>
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-5 pointer-events-none"></div>

      {/* LOGO LOCALE */}
      <div className="mb-8 flex flex-col items-center w-full relative z-10">
          {pub?.logo_url ? (
            <div className="relative">
              <div className="absolute inset-0 bg-fuchsia-600 rounded-full blur-2xl opacity-40 animate-pulse"></div>
              <img 
                src={pub.logo_url} 
                className="relative w-32 h-32 rounded-full border-4 border-fuchsia-500 shadow-[0_0_40px_rgba(217,70,239,0.6)] object-cover bg-black" 
                alt="Logo"
              />
            </div>
          ) : (
            <div className="w-32 h-32 rounded-full bg-gradient-to-br from-fuchsia-900 to-purple-900 flex items-center justify-center border-4 border-fuchsia-500/50 shadow-lg">
               <Music className="w-14 h-14 text-fuchsia-300"/>
            </div>
          )}
          <h1 className="text-2xl font-black text-white text-center uppercase leading-tight drop-shadow-[0_0_10px_rgba(255,255,255,0.5)] mt-4 tracking-wider">
            {pub?.name}
          </h1>
          <div className="flex items-center gap-2 mt-2">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
            <span className="text-xs text-red-400 font-bold uppercase tracking-widest">Live</span>
          </div>
      </div>

      {/* CLASSIFICA TOP 10 */}
      <div className="flex-1 w-full overflow-hidden flex flex-col mb-6 bg-black/30 rounded-2xl p-3 border border-fuchsia-500/20 backdrop-blur-sm relative z-10">
          <div className="flex items-center gap-2 mb-4 justify-center">
             <Trophy className="w-5 h-5 text-yellow-400" />
             <h2 className="text-sm font-black text-white uppercase tracking-[0.2em]">Classifica</h2>
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto pr-2 custom-scrollbar">
              {leaderboard?.slice(0, 10).map((u, i) => (
                  <div 
                    key={i} 
                    className={`relative flex items-center p-3 rounded-xl transition-all duration-300 group
                      ${i===0 ? 'bg-gradient-to-r from-yellow-900/50 to-yellow-800/30 border border-yellow-500/50 shadow-lg' : 
                        i===1 ? 'bg-gradient-to-r from-zinc-700/50 to-zinc-600/30 border border-zinc-400/30' :
                        i===2 ? 'bg-gradient-to-r from-amber-900/50 to-amber-800/30 border border-amber-600/30' :
                        'bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/20'}`}
                  >
                      {/* Posizione */}
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black mr-3 relative z-10
                          ${i===0 ? 'bg-yellow-500 text-black shadow-lg' :
                            i===1 ? 'bg-zinc-400 text-black' :
                            i===2 ? 'bg-amber-700 text-white' :
                            'bg-zinc-800 text-zinc-400'}`}>
                          {i===0 ? '👑' : i+1}
                      </div>
                      
                      {/* Info Utente */}
                      <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold text-white truncate">{u.nickname}</div>
                          <div className="text-[10px] text-zinc-400">{u.songs_sung || 0} canzoni</div>
                      </div>
                      
                      {/* Punteggio */}
                      <div className={`text-base font-black font-mono ${i===0 ? 'text-yellow-300' : i===1 ? 'text-zinc-300' : i===2 ? 'text-amber-400' : 'text-fuchsia-400'}`}>
                          {u.score}
                      </div>
                      
                      {/* Badge Top 3 */}
                      {i < 3 && (
                        <div className="absolute -top-1 -right-1">
                          <Sparkles className="w-3 h-3 text-yellow-400 animate-pulse" />
                        </div>
                      )}
                  </div>
              ))}
          </div>
      </div>

      {/* QR CODE - Design X-Factor */}
      <div className="bg-white p-5 rounded-2xl shadow-[0_0_50px_rgba(217,70,239,0.4)] w-full flex flex-col items-center border-4 border-fuchsia-500 relative z-10">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-fuchsia-600 text-white text-[10px] font-black px-4 py-1 rounded-full uppercase tracking-wider shadow-lg">
            Partecipa
          </div>
          <QRCodeSVG 
            value={`${window.location.origin}/join/${code}`} 
            size={150} 
            level="H"
            bgColor="white"
            fgColor="black"
          />
          <div className="text-black font-black text-3xl mt-3 tracking-[0.3em]">{code}</div>
          <div className="text-[11px] text-zinc-600 uppercase font-bold tracking-wider mt-1">Scansiona per giocare</div>
      </div>
  </div>
);

// ===========================================
// BANNER INFERIORE - Design X-Factor
// ===========================================
const BottomBanner = ({ current, queue }) => {
    const nextSingers = queue ? queue.filter(q => q.id !== current?.song_request_id).slice(0, 5) : [];

    return (
        <div className="h-32 bg-gradient-to-r from-black via-zinc-900 to-black border-t border-fuchsia-500/30 flex items-center px-8 z-40 absolute bottom-0 left-0 right-80 shadow-[0_-10px_60px_rgba(217,70,239,0.3)] overflow-hidden">
            
            {/* Effetto Glow Animato */}
            <div className="absolute inset-0 bg-gradient-to-r from-fuchsia-600/10 via-purple-600/10 to-fuchsia-600/10 animate-pulse-slow"></div>
            
            {/* ORA IN ONDA */}
            <div className="flex-[2] flex items-center gap-6 border-r border-fuchsia-500/20 pr-8 h-full relative z-10">
                <div className="relative">
                    {/* Glow Effect */}
                    <div className="absolute inset-0 bg-fuchsia-600 rounded-2xl blur-xl opacity-60 animate-pulse"></div>
                    
                    {/* Icon Container */}
                    <div className="relative w-20 h-20 bg-gradient-to-br from-fuchsia-600 via-fuchsia-700 to-purple-800 rounded-2xl flex items-center justify-center shadow-2xl border-2 border-fuchsia-400">
                        <Mic2 className="w-10 h-10 text-white animate-pulse" />
                    </div>
                    
                    {/* Live Badge */}
                    <div className="absolute -top-2 -right-2 bg-red-600 text-white text-[9px] font-black px-2 py-1 rounded-full uppercase animate-pulse border-2 border-white">
                        Live
                    </div>
                </div>
                
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3 mb-2">
                        <span className="text-[10px] font-black bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white px-3 py-1 rounded-full uppercase tracking-wider shadow-lg">
                            On Stage
                        </span>
                        {current && (
                          <Flame className="w-4 h-4 text-orange-500 animate-pulse" />
                        )}
                    </div>
                    <h3 className="text-2xl font-black text-white uppercase truncate drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)] mb-1">
                        {current?.user_nickname || "IN ATTESA..."}
                    </h3>
                    {current ? (
                        <div className="text-sm text-zinc-300 truncate w-full flex items-center gap-2">
                            <Music2 className="w-4 h-4 text-fuchsia-400" />
                            <span className="font-semibold">{current.song_title}</span>
                            <span className="text-zinc-500">•</span>
                            <span className="text-zinc-400">{current.song_artist}</span>
                        </div>
                    ) : (
                        <div className="text-xs text-zinc-500 uppercase tracking-widest">Nessuna esibizione in corso</div>
                    )}
                </div>
            </div>

            {/* PROSSIMI IN SCALETTA */}
            <div className="flex-[3] pl-8 h-full flex items-center overflow-hidden relative z-10">
                <div className="mr-6 flex flex-col justify-center border-r border-fuchsia-500/10 pr-6 h-1/2">
                    <span className="text-fuchsia-400 text-[11px] font-black uppercase tracking-widest flex items-center gap-2">
                        <Zap className="w-3 h-3" />
                        Prossimi
                    </span>
                    <span className="text-white text-sm font-black uppercase tracking-wider">In Scaletta</span>
                </div>
                
                <div className="flex-1 flex gap-4 overflow-x-auto custom-scrollbar-horizontal items-center py-2">
                    {nextSingers.length === 0 ? (
                        <div className="text-zinc-600 text-sm italic">Nessuno in coda...</div>
                    ) : (
                        nextSingers.map((s, i) => (
                            <div key={s.id} className="flex-shrink-0 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-fuchsia-500/30 rounded-xl p-3 min-w-[200px] transition-all duration-300 group">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-fuchsia-900/50 rounded-lg flex items-center justify-center text-fuchsia-300 font-bold text-sm border border-fuchsia-500/30">
                                        {i + 1}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-white text-sm font-bold truncate group-hover:text-fuchsia-300 transition-colors">{s.user_nickname}</div>
                                        <div className="text-zinc-500 text-[11px] truncate">{s.title}</div>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

// ===========================================
// AREA CENTRALE - Karaoke/Quiz/Leaderboard
// ===========================================
const CentralStage = ({ 
    active_module, current_performance, active_quiz, quizResults, 
    leaderboard, isMuted 
}) => {
    const showKaraoke = active_module === 'karaoke' && current_performance;
    const showQuiz = active_module === 'quiz' && active_quiz;
    const showLeaderboard = active_module === 'leaderboard';
    
    const isVoting = current_performance?.status === 'voting';
    const voteResult = current_performance?.status === 'ended' ? current_performance.average_score : null;

    return (
        <div className="absolute top-0 left-0 right-80 bottom-32 bg-black overflow-hidden">
            {/* LAYER MEDIA - Video Background */}
            
            {/* Quiz Media */}
            <div className={`absolute inset-0 transition-opacity duration-700 ${showQuiz ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
                <QuizMediaFixed 
                    mediaUrl={active_quiz?.media_url} 
                    mediaType={active_quiz?.media_type} 
                    isResult={active_quiz?.status === 'showing_results'} 
                />
            </div>
            
            {/* Karaoke Media */}
            <div className={`absolute inset-0 transition-opacity duration-700 ${showKaraoke ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
                <KaraokePlayer 
                    url={current_performance?.youtube_url} 
                    status={current_performance?.status}
                    startedAt={current_performance?.started_at} 
                    isMuted={isMuted}
                />
            </div>

            {/* Fallback Background - X-Factor Style */}
            <div className={`absolute inset-0 bg-gradient-to-br from-fuchsia-950 via-purple-950 to-black -z-10 transition-opacity duration-1000 ${(!showQuiz && !showKaraoke) ? 'opacity-100' : 'opacity-0'}`}>
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
                {/* Animated Lights */}
                <div className="absolute top-0 left-0 w-96 h-96 bg-fuchsia-600 rounded-full blur-[150px] opacity-20 animate-pulse-slow"></div>
                <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-600 rounded-full blur-[150px] opacity-20 animate-pulse-slow" style={{animationDelay: '1s'}}></div>
            </div>

            {/* LAYER UI CENTRALE */}
            <div className="absolute inset-0 z-20 flex flex-col justify-center items-center p-12">
                
                {/* ========== QUIZ ========== */}
                {showQuiz && (
                    <div className="w-full max-w-5xl text-center animate-in zoom-in duration-500">
                        {/* Risultati Quiz */}
                        {active_quiz.status === 'showing_results' && quizResults ? (
                            <div className="bg-black/95 backdrop-blur-2xl p-12 rounded-[3rem] border-4 border-green-500 shadow-[0_0_80px_rgba(34,197,94,0.6)]">
                                <div className="flex justify-center mb-6">
                                    <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center animate-bounce">
                                        <Trophy className="w-10 h-10 text-white" />
                                    </div>
                                </div>
                                <h2 className="text-4xl text-green-400 mb-8 uppercase tracking-[0.3em] font-black">Risposta Corretta</h2>
                                <div className="text-7xl font-black text-white mb-10 drop-shadow-[0_0_30px_rgba(34,197,94,0.8)] bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
                                    {quizResults.correct_option}
                                </div>
                                <div className="grid grid-cols-2 gap-6 max-w-lg mx-auto">
                                    <div className="bg-green-900/30 border border-green-500/50 p-6 rounded-2xl">
                                        <div className="text-5xl font-black text-green-400">{quizResults.correct_count}</div>
                                        <div className="text-xs uppercase text-green-300 tracking-widest mt-2">Corrette</div>
                                    </div>
                                    <div className="bg-white/5 border border-white/10 p-6 rounded-2xl">
                                        <div className="text-5xl font-black text-white">{quizResults.total_answers}</div>
                                        <div className="text-xs uppercase text-zinc-400 tracking-widest mt-2">Totali</div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            /* Domanda Quiz */
                            <>
                                <div className="bg-black/90 backdrop-blur-2xl p-10 rounded-3xl border-2 border-fuchsia-500/50 mb-8 shadow-2xl relative overflow-hidden">
                                    {/* Glow Effect */}
                                    <div className="absolute inset-0 bg-gradient-to-r from-fuchsia-600/10 via-purple-600/10 to-fuchsia-600/10 animate-pulse-slow"></div>
                                    
                                    <h2 className="relative z-10 text-5xl md:text-6xl font-black text-white leading-tight drop-shadow-[0_0_20px_rgba(255,255,255,0.3)]">
                                        {active_quiz.question}
                                    </h2>
                                    
                                    {/* Badge Punti */}
                                    <div className="absolute -top-5 -right-5 bg-gradient-to-br from-yellow-400 to-orange-500 text-black font-black px-6 py-3 rounded-xl shadow-xl border-4 border-white rotate-6 animate-bounce">
                                        <span className="text-2xl">{active_quiz.points}</span>
                                        <span className="text-sm ml-1">PT</span>
                                    </div>
                                </div>
                                
                                {/* Opzioni */}
                                <div className="grid grid-cols-2 gap-5">
                                    {active_quiz.options.map((opt, i) => (
                                        <div 
                                            key={i} 
                                            className="group bg-gradient-to-br from-zinc-900/95 to-zinc-800/95 backdrop-blur-xl hover:from-fuchsia-900/50 hover:to-purple-900/50 p-8 rounded-2xl border-2 border-white/20 hover:border-fuchsia-500 flex items-center gap-5 transition-all duration-300 shadow-xl hover:shadow-[0_0_40px_rgba(217,70,239,0.4)] hover:scale-105"
                                        >
                                            <div className="w-14 h-14 bg-gradient-to-br from-fuchsia-600 to-purple-700 group-hover:from-fuchsia-500 group-hover:to-purple-600 rounded-xl flex items-center justify-center font-black text-2xl text-white shadow-lg border-2 border-white/30 transition-all">
                                                {['A','B','C','D'][i]}
                                            </div>
                                            <span className="text-2xl font-bold text-white text-left group-hover:text-fuchsia-200 transition-colors">
                                                {opt}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* ========== KARAOKE OVERLAYS ========== */}
                {showKaraoke && (
                    <>
                        {/* Overlay Votazione */}
                        {isVoting && (
                            <div className="bg-black/95 backdrop-blur-2xl p-20 rounded-[4rem] border-4 border-yellow-500 text-center animate-in zoom-in duration-500 shadow-[0_0_120px_rgba(234,179,8,0.5)]">
                                <div className="relative">
                                    <div className="absolute inset-0 bg-yellow-500 rounded-full blur-3xl opacity-40 animate-pulse"></div>
                                    <Star className="relative w-32 h-32 text-yellow-400 mx-auto mb-6 animate-spin-slow"/>
                                </div>
                                <h2 className="text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-orange-500 to-yellow-400 mb-4 uppercase italic drop-shadow-2xl animate-pulse">
                                    VOTA ORA!
                                </h2>
                                <p className="text-3xl text-yellow-300 uppercase tracking-[0.5em] font-black">
                                    {current_performance?.user_nickname}
                                </p>
                            </div>
                        )}
                        
                        {/* Overlay Risultato Voto */}
                        {voteResult && (
                            <div className="bg-black/95 backdrop-blur-2xl p-20 rounded-[4rem] border-4 border-fuchsia-500 text-center animate-in zoom-in duration-500 shadow-[0_0_120px_rgba(217,70,239,0.5)]">
                                <Crown className="w-32 h-32 text-fuchsia-400 mx-auto mb-6 animate-bounce"/>
                                <div className="text-[10rem] font-black text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 via-purple-500 to-fuchsia-400 leading-none mb-6 drop-shadow-2xl">
                                    {voteResult.toFixed(1)}
                                </div>
                                <div className="flex items-center justify-center gap-3 mb-4">
                                    {[...Array(5)].map((_, i) => (
                                        <Star 
                                            key={i} 
                                            className={`w-8 h-8 ${i < Math.floor(voteResult) ? 'text-yellow-400 fill-yellow-400' : 'text-zinc-600'}`}
                                        />
                                    ))}
                                </div>
                                <p className="text-3xl text-fuchsia-300 uppercase tracking-[0.5em] font-black">Punteggio</p>
                            </div>
                        )}
                    </>
                )}

                {/* ========== IDLE ========== */}
                {!showQuiz && !showKaraoke && !showLeaderboard && (
                    <div className="text-center animate-in fade-in duration-1000">
                         <div className="relative mb-8">
                            <div className="absolute inset-0 bg-fuchsia-600 rounded-full blur-3xl opacity-20 animate-pulse"></div>
                            <Music2 className="relative w-32 h-32 mx-auto text-fuchsia-500/50 animate-pulse"/>
                         </div>
                         <h2 className="text-5xl font-black text-zinc-600 uppercase tracking-[0.3em] mb-4">In Attesa...</h2>
                         <p className="text-xl text-zinc-700 tracking-widest">Preparati a cantare!</p>
                    </div>
                )}
            </div>
        </div>
    );
};

// ===========================================
// COMPONENTE ROOT
// ===========================================
const PubDisplay = () => {
  const { pubCode } = useParams();
  const [data, setData] = useState(null);
  const [quizResults, setQuizResults] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [newReaction, setNewReaction] = useState(null);
  const loadingRef = useRef(false);

  // Load Display Data
  const loadData = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    
    try {
      const res = await api.getDisplayData(pubCode);
      setData(res.data);
      
      // Quiz Results Management
      if (res.data.active_quiz?.status === 'showing_results' && !quizResults) {
        setQuizResults(res.data.quiz_results);
        setTimeout(() => setQuizResults(null), 8000);
      }
    } catch (err) {
      console.error('Load error:', err);
    } finally {
      loadingRef.current = false;
    }
  }, [pubCode, quizResults]);

  // Initial load + polling
  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 3000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Real-time Subscriptions
  useEffect(() => {
    if (!data?.pub?.id) return;

    // Control Channel (Mute)
    const controlCh = supabase.channel(`control_${pubCode}`)
      .on('broadcast', { event: 'control' }, (payload) => {
        if (payload.payload.command === 'mute') {
          setIsMuted(payload.payload.value);
        }
      })
      .subscribe();

    // Reactions Channel
    const reactionsCh = supabase.channel(`reactions_${data.pub.id}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'reactions', 
        filter: `event_id=eq.${data.pub.id}` 
      }, (payload) => {
        setNewReaction({ emoji: payload.new.emoji, nickname: payload.new.nickname });
      })
      .subscribe();

    return () => {
      controlCh.unsubscribe();
      reactionsCh.unsubscribe();
    };
  }, [data?.pub?.id, pubCode]);

  if (!data) {
    return (
      <div className="h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <Music className="w-16 h-16 text-fuchsia-500 mx-auto mb-4 animate-spin" />
          <p className="text-white text-xl">Caricamento...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden relative bg-black">
      {/* Main Stage */}
      <CentralStage 
        active_module={data.active_module}
        current_performance={data.current_performance}
        active_quiz={data.active_quiz}
        quizResults={quizResults}
        leaderboard={data.leaderboard}
        isMuted={isMuted}
      />

      {/* Bottom Banner */}
      <BottomBanner 
        current={data.current_performance}
        queue={data.queue}
      />

      {/* Sidebar Right */}
      <SidebarRight 
        pub={data.pub}
        code={pubCode}
        leaderboard={data.leaderboard}
      />

      {/* Floating Reactions */}
      <FloatingReactions newReaction={newReaction} />

      {/* Custom Scrollbar Styles */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(217,70,239,0.5); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(217,70,239,0.8); }
        
        .custom-scrollbar-horizontal::-webkit-scrollbar { height: 6px; }
        .custom-scrollbar-horizontal::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); border-radius: 10px; }
        .custom-scrollbar-horizontal::-webkit-scrollbar-thumb { background: rgba(217,70,239,0.5); border-radius: 10px; }
        
        @keyframes pulse-slow {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.6; }
        }
        .animate-pulse-slow { animation: pulse-slow 4s ease-in-out infinite; }
        
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow { animation: spin-slow 8s linear infinite; }
      `}</style>
    </div>
  );
};

export default PubDisplay;