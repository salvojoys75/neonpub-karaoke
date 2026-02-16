import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '@/lib/supabase';
import api from '@/lib/api';
import { Music, Mic2, Star, Trophy, Users, MessageSquare, Disc, Zap, Megaphone } from 'lucide-react';
import ArcadeMode from '@/components/ArcadeMode';
import KaraokePlayer from '@/components/KaraokePlayer';
import QuizMediaFixed from '@/components/QuizMediaFixed';
import FloatingReactions from '@/components/FloatingReactions';
import ExtractionMode from '@/components/ExtractionMode';

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;800;900&family=JetBrains+Mono:wght@500&display=swap');
  
  :root {
    --glass-bg: rgba(15, 15, 20, 0.7);
    --glass-border: rgba(255, 255, 255, 0.1);
    --sidebar-w: 24vw;
    --topbar-h: 7vh;
    --karaoke-bar-h: 10vh;
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

  /* Layout responsivo */
  .dj-topbar     { height: var(--topbar-h); }
  .dj-sidebar    { width: var(--sidebar-w); top: calc(var(--topbar-h) + 1vh); right: 1vw; bottom: 1vh; }
  .dj-content    { top: var(--topbar-h); right: calc(var(--sidebar-w) + 1.5vw); bottom: 0; left: 0; }
  .dj-karaoke-bar { height: var(--karaoke-bar-h); }
  .dj-karaoke-player { bottom: var(--karaoke-bar-h); }
`;

// (All other component definitions: TopBar, Sidebar, KaraokeMode, VotingMode, ScoreMode, QuizMode, IdleMode remain unchanged from your file)
// I'm only showing the key changes in PubDisplay component

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
                let finalData = res.data;

                const q = finalData.active_quiz;

                if(q && q.status === 'showing_results') {
                    const r = await api.getQuizResults(q.id);
                    setQuizResult(r.data);
                } else {
                    setQuizResult(null);
                }

                if(q && q.status === 'leaderboard') {
                    finalData = {
                        ...finalData,
                        active_quiz: {
                            ...q,
                            leaderboard: finalData.leaderboard
                        }
                    };
                }

                // ── ARCADE: carica dati arcade ──
                const arcade = finalData.active_arcade;
                
                // Vincitore se terminato
                if (arcade && arcade.status === 'ended' && arcade.winner_id) {
                    const { data: winner } = await supabase
                        .from('participants')
                        .select('id, nickname, avatar_url')
                        .eq('id', arcade.winner_id)
                        .single();
                    
                    finalData = {
                        ...finalData,
                        arcade_result: { winner }
                    };
                }

                // Prenotazione corrente se attivo
                if (arcade && arcade.status === 'active') {
                    const { data: currentBooking } = await api.getCurrentBooking(arcade.id);
                    finalData = {
                        ...finalData,
                        active_arcade: {
                            ...arcade,
                            current_booking: currentBooking
                        }
                    };
                }
                
                setData(finalData);
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
            .on('postgres_changes', {event: 'UPDATE', schema: 'public', table: 'events'}, load)
            .subscribe();
            
        return () => { clearInterval(int); supabase.removeChannel(ch); };
    }, [pubCode, load]);

    if (!data) return (
        <div className="w-screen h-screen bg-black flex flex-col items-center justify-center">
             <div className="w-20 h-20 border-8 border-fuchsia-600 border-t-transparent rounded-full animate-spin mb-6"></div>
             <div className="text-white text-3xl font-black font-mono tracking-[0.5em] animate-pulse">CARICAMENTO...</div>
        </div>
    );

    const { pub, current_performance: perf, queue, active_quiz: quiz, admin_message, leaderboard, approved_messages, extraction_data } = data;

    const recentMessages = approved_messages ? approved_messages.slice(0, 10) : [];

    const isQuiz = quiz && ['active', 'closed', 'showing_results', 'leaderboard'].includes(quiz.status);
    const isArcade = data.active_arcade && ['active', 'paused', 'ended'].includes(data.active_arcade.status);
    const isKaraoke = !isQuiz && !isArcade && perf && ['live', 'paused'].includes(perf.status);
    const isVoting = !isQuiz && !isArcade && perf && perf.status === 'voting';
    const isScore = !isQuiz && !isArcade && perf && perf.status === 'ended';
    
    let Content = null;
    if (isQuiz) Content = <QuizMode quiz={quiz} result={quizResult} />;
    else if (isArcade) Content = <ArcadeMode arcade={data.active_arcade} result={data.arcade_result} />;
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
            <AdminMessageOverlay message={admin_message} />

            {extraction_data && (
                <div className="absolute inset-0 z-[300]">
                    <ExtractionMode
                        extractionData={extraction_data}
                        participants={leaderboard || []}
                        songs={extraction_data.song ? [extraction_data.song] : []}
                        onComplete={() => api.clearExtraction(pubCode)}
                    />
                </div>
            )}
            
            <div className="dj-content absolute z-10">
                {Content}
            </div>
            
            <Sidebar pubCode={pubCode} queue={queue} leaderboard={leaderboard} />
        </div>
    );
}

// Placeholder components - replace with your actual implementations
const TopBar = () => <div></div>;
const AdminMessageOverlay = () => null;
const Sidebar = () => <div></div>;
const KaraokeMode = () => <div></div>;
const VotingMode = () => <div></div>;
const ScoreMode = () => <div></div>;
const QuizMode = () => <div></div>;
const IdleMode = () => <div></div>;