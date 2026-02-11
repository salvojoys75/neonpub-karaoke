import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '@/lib/supabase';
import api from '@/lib/api';
import { 
  Music, Users, Trophy, Mic2, MessageSquare, Crown, Star, Sparkles, 
  Clock, CheckCircle2, TrendingUp, Radio
} from 'lucide-react';
import QuizMediaFixed from './QuizMediaFixed';

// --- COMPONENTI UI STILE TV ---

const LogoDisplay = ({ url, name }) => (
  <div className="absolute top-6 left-8 z-50 flex items-center gap-4 animate-in slide-in-from-top duration-700">
    {url ? (
      <img src={url} alt="Logo" className="w-16 h-16 rounded-lg shadow-lg border-2 border-white/20" />
    ) : (
      <div className="w-16 h-16 bg-fuchsia-600 rounded-lg flex items-center justify-center shadow-lg">
        <Radio className="w-8 h-8 text-white" />
      </div>
    )}
    <div>
      <h1 className="text-2xl font-black text-white uppercase tracking-wider drop-shadow-md">{name}</h1>
      <div className="flex items-center gap-2">
         <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"/>
         <span className="text-xs text-red-400 font-bold tracking-widest">LIVE</span>
      </div>
    </div>
  </div>
);

const JoinCard = ({ code }) => (
  <div className="absolute bottom-8 right-8 z-50 bg-white/10 backdrop-blur-md border border-white/20 p-4 rounded-2xl shadow-2xl flex items-center gap-4 animate-in slide-in-from-right duration-700">
    <div className="bg-white p-2 rounded-xl">
      <QRCodeSVG value={`${window.location.origin}/join/${code}`} size={80} />
    </div>
    <div className="text-left">
      <p className="text-fuchsia-300 text-xs font-bold uppercase tracking-wider mb-1">Partecipa ora</p>
      <p className="text-white text-2xl font-black">{code}</p>
      <p className="text-white/60 text-xs">Scansiona o vai su neonpub.com</p>
    </div>
  </div>
);

const MessageTicker = ({ message }) => {
  if (!message) return null;
  return (
    <div className="absolute bottom-8 left-8 right-[300px] z-40 animate-in fade-in slide-in-from-bottom duration-500">
       <div className="bg-black/60 backdrop-blur-xl border-l-4 border-cyan-500 p-4 rounded-r-xl shadow-lg flex items-start gap-3 max-w-2xl">
          <MessageSquare className="w-6 h-6 text-cyan-400 shrink-0 mt-1" />
          <div>
            <p className="text-cyan-400 text-xs font-bold uppercase mb-1">Messaggio dalla Regia</p>
            <p className="text-white text-lg font-medium leading-tight">{message.text}</p>
          </div>
       </div>
    </div>
  );
};

// --- SCHERMATA KARAOKE ---
const KaraokeMode = ({ performance, isVoting, voteResult }) => (
  <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden">
    {/* Dynamic Background */}
    <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-900 via-indigo-950 to-black animate-gradient-slow" />
    <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20" />
    
    {/* YouTube Player Wrapper (Hidden/Background) */}
    {/* Note: In PubDisplay main logic we handle the player mounting, here we just show UI */}
    
    <div className="z-10 text-center w-full max-w-5xl px-4">
      {isVoting ? (
        <div className="animate-in zoom-in duration-500 bg-black/40 backdrop-blur-xl p-12 rounded-3xl border border-yellow-500/30 shadow-[0_0_100px_rgba(234,179,8,0.2)]">
            <Star className="w-24 h-24 text-yellow-400 mx-auto mb-6 animate-[spin_3s_linear_infinite]" />
            <h2 className="text-6xl font-black text-white mb-4 uppercase italic">Vota Ora!</h2>
            <p className="text-3xl text-yellow-200">Quanto ti è piaciuta l'esibizione?</p>
            <div className="mt-8 text-xl text-white/50 font-mono">{performance?.user_nickname}</div>
        </div>
      ) : voteResult ? (
        <div className="animate-in zoom-in duration-500 bg-black/40 backdrop-blur-xl p-12 rounded-3xl border border-fuchsia-500/30">
            <Crown className="w-24 h-24 text-fuchsia-400 mx-auto mb-6 animate-bounce" />
            <div className="text-2xl text-fuchsia-200 uppercase tracking-widest mb-2">Punteggio Finale</div>
            <div className="text-[120px] leading-none font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-fuchsia-400 drop-shadow-2xl">
              {voteResult.toFixed(1)}
            </div>
            <p className="text-4xl text-white font-bold mt-4">{performance?.user_nickname}</p>
        </div>
      ) : (
        <div className="flex flex-col items-center animate-in fade-in duration-1000">
           {/* Now Playing UI */}
           <div className="w-64 h-64 bg-gradient-to-br from-gray-800 to-black rounded-2xl shadow-2xl mb-8 flex items-center justify-center border border-white/10 relative group overflow-hidden">
              <div className="absolute inset-0 bg-fuchsia-600/20 blur-xl group-hover:bg-fuchsia-600/30 transition-all duration-1000"></div>
              <Music className="w-32 h-32 text-white/80 group-hover:scale-110 transition-transform duration-700" />
           </div>
           
           <h2 className="text-6xl md:text-7xl font-black text-white text-center leading-tight mb-4 drop-shadow-2xl">
             {performance?.song_title}
           </h2>
           <p className="text-3xl md:text-4xl text-fuchsia-400 font-bold text-center mb-8 uppercase tracking-wide">
             {performance?.song_artist}
           </p>
           
           <div className="bg-white/10 backdrop-blur-md px-8 py-3 rounded-full flex items-center gap-3 border border-white/20">
              <Mic2 className="w-6 h-6 text-red-500 animate-pulse" />
              <span className="text-xl text-white font-bold">ON STAGE: <span className="text-red-400">{performance?.user_nickname}</span></span>
           </div>
        </div>
      )}
    </div>
  </div>
);

// --- SCHERMATA QUIZ (The Core Improvement) ---
const QuizMode = ({ quiz, results }) => {
  const isResult = quiz.status === 'showing_results' || quiz.status === 'leaderboard';
  
  return (
    <div className="relative w-full h-full">
      {/* 
         CRITICAL FIX: 
         QuizMediaFixed is positioned absolutely in the back. 
         It does NOT unmount when switching from Question -> Results 
         because it is rendered inside this container persistently.
      */}
      <QuizMediaFixed 
        mediaUrl={quiz.media_url} 
        mediaType={quiz.media_type} 
        isResult={isResult} // This prop helps dim or hide visuals if needed, but component stays mounted
      />

      {/* QUIZ UI OVERLAY */}
      <div className="absolute inset-0 z-20 flex flex-col p-8 md:p-16">
        
        {/* Header Question Info */}
        {!isResult && (
          <div className="flex justify-between items-start animate-in slide-in-from-top duration-500">
             <div className="bg-black/60 backdrop-blur-md px-6 py-2 rounded-full border border-fuchsia-500/50">
                <span className="text-fuchsia-400 font-bold uppercase tracking-wider text-sm flex items-center gap-2">
                  <Sparkles className="w-4 h-4" /> {quiz.category || 'Quiz'}
                </span>
             </div>
             <div className="bg-yellow-500 text-black font-black px-4 py-2 rounded-lg shadow-lg rotate-3 transform">
                {quiz.points} PT
             </div>
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 flex flex-col justify-end pb-20">
           
           {isResult && results ? (
             /* RESULT VIEW */
             <div className="self-center w-full max-w-4xl text-center animate-in zoom-in duration-500">
                <h2 className="text-5xl font-black text-white mb-8 drop-shadow-lg uppercase italic">La risposta giusta è:</h2>
                
                <div className="bg-green-600/90 backdrop-blur-xl border-4 border-green-400 p-8 rounded-3xl shadow-[0_0_50px_rgba(34,197,94,0.4)] mb-8 transform scale-110">
                   <p className="text-5xl font-bold text-white">{results.correct_option}</p>
                </div>

                <div className="grid grid-cols-2 gap-4 max-w-2xl mx-auto">
                   <div className="bg-black/50 backdrop-blur rounded-xl p-4 border border-white/10">
                      <div className="text-4xl font-black text-green-400">{results.correct_count}</div>
                      <div className="text-xs text-white/60 uppercase">Indovinate</div>
                   </div>
                   <div className="bg-black/50 backdrop-blur rounded-xl p-4 border border-white/10">
                      <div className="text-4xl font-black text-white">{results.total_answers}</div>
                      <div className="text-xs text-white/60 uppercase">Risposte Totali</div>
                   </div>
                </div>
             </div>
           ) : (
             /* QUESTION VIEW */
             <div className="w-full max-w-5xl mx-auto animate-in slide-in-from-bottom duration-700">
                {/* Question Text */}
                <div className="bg-black/70 backdrop-blur-xl border border-white/10 p-8 rounded-3xl shadow-2xl mb-6 relative overflow-hidden">
                   <div className="absolute top-0 left-0 w-2 h-full bg-fuchsia-500" />
                   <h2 className="text-4xl md:text-5xl font-bold text-white leading-tight drop-shadow-md">
                     {quiz.question}
                   </h2>
                </div>

                {/* Options Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {quiz.options?.map((opt, i) => (
                    <div key={i} className="bg-white/10 backdrop-blur-md border border-white/10 hover:bg-white/20 transition-colors p-6 rounded-xl flex items-center gap-4 group">
                       <div className="w-12 h-12 rounded-full bg-black/50 border-2 border-white/30 flex items-center justify-center text-xl font-bold text-white group-hover:border-fuchsia-400 group-hover:text-fuchsia-400 transition-colors">
                         {['A','B','C','D'][i]}
                       </div>
                       <span className="text-2xl text-white font-medium shadow-black drop-shadow-sm">{opt}</span>
                    </div>
                  ))}
                </div>
             </div>
           )}
        </div>
      </div>
    </div>
  );
};

// --- SCHERMATA CLASSIFICA ---
const LeaderboardMode = ({ leaderboard }) => (
  <div className="relative w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-yellow-900 to-black">
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20" />
      <div className="z-10 w-full max-w-3xl p-4">
         <h2 className="text-5xl font-black text-white text-center mb-10 flex items-center justify-center gap-4">
            <Trophy className="w-16 h-16 text-yellow-500" />
            TOP PLAYERS
         </h2>
         <div className="space-y-3">
            {leaderboard?.slice(0, 5).map((user, i) => (
              <div key={i} 
                   className="flex items-center gap-4 bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/5 animate-in slide-in-from-bottom duration-500"
                   style={{ animationDelay: `${i * 100}ms` }}>
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center font-black text-xl 
                      ${i===0 ? 'bg-yellow-500 text-black shadow-[0_0_20px_rgba(234,179,8,0.5)]' : 
                        i===1 ? 'bg-gray-300 text-black' : 
                        i===2 ? 'bg-orange-600 text-white' : 'bg-black/50 text-white'}`}>
                      {i+1}
                  </div>
                  <div className="flex-1">
                     <div className="text-2xl font-bold text-white">{user.nickname}</div>
                  </div>
                  <div className="text-3xl font-black text-yellow-500">{user.score}</div>
              </div>
            ))}
         </div>
      </div>
  </div>
);

// --- MAIN CONTAINER ---
const PubDisplay = () => {
  const { pubCode } = useParams();
  const [data, setData] = useState(null);
  const [quizResults, setQuizResults] = useState(null);
  
  // Refs per evitare loop e re-fetch inutili
  const lastQuizIdRef = useRef(null);

  const loadData = useCallback(async () => {
    try {
      const res = await api.getDisplayData(pubCode);
      if (res.data) {
        setData(res.data);
        
        // Logica Risultati Quiz
        const q = res.data.active_quiz;
        if (q && (q.status === 'showing_results' || q.status === 'leaderboard')) {
            if (lastQuizIdRef.current !== q.id || !quizResults) {
                const r = await api.getQuizResults(q.id);
                setQuizResults(r.data);
                lastQuizIdRef.current = q.id;
            }
        } else if (q && q.status === 'active') {
            setQuizResults(null); // Reset per nuova domanda
        }
      }
    } catch (e) { console.error(e); }
  }, [pubCode, quizResults]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 3000); // Polling di sicurezza
    
    // Setup Realtime
    const ch = supabase.channel('display_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'performances' }, loadData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quizzes' }, loadData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, loadData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, loadData)
      .subscribe();

    return () => { clearInterval(interval); supabase.removeChannel(ch); };
  }, [loadData]);

  if (!data) return <div className="h-screen bg-black flex items-center justify-center text-white animate-pulse">CARICAMENTO SEGNALE...</div>;

  const { pub, current_performance, active_quiz, leaderboard, latest_message } = data;
  
  // STATO LOGICO
  const showLeaderboard = active_quiz?.status === 'leaderboard';
  const showQuiz = active_quiz && ['active', 'closed', 'showing_results'].includes(active_quiz.status);
  const showKaraoke = current_performance && !showQuiz && !showLeaderboard;

  return (
    <div className="h-screen w-screen bg-black overflow-hidden font-sans select-none relative">
       {/* GLOBAL OVERLAYS */}
       <LogoDisplay url={pub?.logo_url} name={pub?.name} />
       <JoinCard code={pubCode} />
       <MessageTicker message={latest_message} />

       {/* MAIN CONTENT SWITCHER */}
       <div className="absolute inset-0 z-0">
          {showLeaderboard ? (
             <LeaderboardMode leaderboard={leaderboard} />
          ) : showQuiz ? (
             <QuizMode quiz={active_quiz} results={quizResults} />
          ) : showKaraoke ? (
             <KaraokeMode 
                performance={current_performance} 
                isVoting={current_performance.status === 'voting'} 
                voteResult={current_performance.status === 'ended' ? current_performance.average_score : null}
             />
          ) : (
             // IDLE SCREEN
             <div className="h-full flex flex-col items-center justify-center relative">
                <div className="absolute inset-0 bg-gradient-to-t from-fuchsia-900/40 via-black to-black" />
                <div className="z-10 text-center animate-in fade-in duration-1000">
                    <img src={pub?.logo_url || "https://placehold.co/400x400/1a1a1a/FFF?text=NEON+PUB"} className="w-48 h-48 mx-auto rounded-full mb-8 shadow-2xl border-4 border-fuchsia-600 object-cover" />
                    <h1 className="text-7xl font-black text-white mb-4 tracking-tighter uppercase">{pub?.name}</h1>
                    <p className="text-2xl text-fuchsia-400 font-bold uppercase tracking-[0.5em] animate-pulse">In attesa dell'evento...</p>
                </div>
             </div>
          )}
       </div>
    </div>
  );
};

export default PubDisplay;