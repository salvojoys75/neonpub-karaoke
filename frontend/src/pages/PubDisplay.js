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

const TopBar = ({ pubName, logoUrl, onlineCount, messages, isMuted }) => {
  const messagesString = messages && messages.length > 0 ? messages.map(m => `${m.nickname}: ${m.text}`).join('   •   ') : '';
  
  return (
  <div className="dj-topbar absolute top-0 left-0 right-0 z-[100] flex items-center justify-between px-8 bg-gradient-to-b from-black/90 via-black/60 to-transparent">
      <div className="flex items-center gap-5">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="h-[5vh] w-[5vh] rounded-xl border-2 border-white/20 shadow-lg object-contain bg-black p-1" />
          ) : (
            <div className="h-[5vh] w-[5vh] rounded-xl bg-fuchsia-600 flex items-center justify-center border-2 border-white/20 shadow-lg font-black text-[2vh]">DJ</div>
          )}
          <div>
              <h1 className="text-[2.5vh] font-black text-white tracking-wider drop-shadow-md uppercase">{pubName || "DISCOJOYS"}</h1>
              <div className="flex items-center gap-3">
                  <span className="bg-red-600 px-2 py-0.5 rounded text-[1vh] font-bold tracking-widest uppercase animate-pulse shadow-[0_0_10px_red]">LIVE</span>
                  {isMuted && <span className="text-white bg-red-900 px-2 py-0.5 rounded text-[1vh] font-bold tracking-widest border border-red-500">AUDIO OFF</span>}
              </div>
          </div>
      </div>
      
      <div className="flex-1 mx-8 h-[4.5vh] glass-panel rounded-full flex items-center px-4 overflow-hidden relative">
          {messagesString ? (
             <div className="ticker-wrap">
                 <div className="ticker-content text-white text-[1.8vh] font-medium flex items-center gap-8">
                     <MessageSquare className="w-[2vh] h-[2vh] text-fuchsia-400 inline-block shrink-0"/>
                     <span>{messagesString}</span>
                     <span className="ml-8">{messagesString}</span>
                 </div>
             </div>
          ) : (
             <div className="ticker-wrap">
                 <div className="ticker-content text-white/40 text-[1.4vh] font-medium uppercase tracking-widest flex items-center gap-8">
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
              <Users className="w-[2vh] h-[2vh] text-fuchsia-400"/> 
              <span className="text-[2.5vh] font-mono font-bold">{onlineCount}</span>
          </div>
      </div>
  </div>
);};

const AdminMessageOverlay = ({ message }) => {
    if (!message) return null;

    return (
        <div className="absolute inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="glass-panel p-12 rounded-[3rem] max-w-5xl text-center border-4 border-fuchsia-500 shadow-[0_0_100px_rgba(217,70,239,0.5)] transform animate-bounce-in">
                <div className="flex justify-center mb-6">
                    <Megaphone className="w-24 h-24 text-fuchsia-400 animate-pulse" />
                </div>
                <h2 className="text-4xl text-fuchsia-200 font-bold uppercase tracking-[0.5em] mb-8">Comunicazione Regia</h2>
                <p className="text-7xl font-black text-white leading-tight drop-shadow-2xl">{message.text}</p>
            </div>
        </div>
    );
};

const Sidebar = ({ pubCode, queue, leaderboard }) => (
  <div className="dj-sidebar absolute z-[90] flex flex-col gap-[1.5vh]">
      {/* QR CODE */}
      <div className="glass-panel px-4 py-3 rounded-2xl flex items-center gap-4 relative overflow-hidden shrink-0">
          <div className="absolute inset-0 bg-fuchsia-600/5 blur-xl"></div>
          <div className="bg-white p-2 rounded-xl shadow-2xl relative z-10 shrink-0">
              <QRCodeSVG value={`${window.location.origin}/join/${pubCode}`} size={Math.round(window.innerWidth * 0.07)} level="M" />
          </div>
          <div className="relative z-10 flex flex-col">
              <div className="text-[2vw] font-black text-white tracking-widest font-mono drop-shadow-xl">{pubCode}</div>
              <div className="text-[0.8vw] text-white/50 uppercase font-bold tracking-[0.15em]">Scansiona per entrare</div>
          </div>
      </div>
      
      {/* CODA */}
      <div className="glass-panel rounded-3xl flex flex-col overflow-hidden relative shrink-0">
          <div className="bg-gradient-to-r from-fuchsia-600 to-purple-600 px-4 py-3 flex items-center justify-between border-b border-white/10">
              <div className="flex items-center gap-2">
                  <Disc className="w-[2vh] h-[2vh] text-white animate-spin" style={{animationDuration: '3s'}} />
                  <span className="font-black text-white text-[1.8vh] uppercase tracking-wider">Coda</span>
              </div>
              <div className="bg-white/20 px-3 py-1 rounded-full">
                  <span className="font-mono text-white text-[1.4vh] font-bold">{queue?.filter(s => s.status === 'queued').length || 0}</span>
              </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2 min-h-0" style={{maxHeight: '25vh'}}>
              {queue && queue.filter(s => s.status === 'queued').slice(0, 5).map((song, idx) => (
                  <div key={song.id} className="mb-2 bg-white/5 backdrop-blur-sm rounded-xl p-3 border border-white/10 hover:bg-white/10 transition-all">
                      <div className="flex items-center gap-3">
                          <div className="bg-fuchsia-600 rounded-lg w-[3vh] h-[3vh] flex items-center justify-center font-black text-white text-[1.4vh] shrink-0 font-mono">
                              {idx + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                              <div className="font-bold text-white text-[1.4vh] truncate leading-tight">{song.title}</div>
                              <div className="text-white/60 text-[1.1vh] truncate">{song.artist}</div>
                          </div>
                      </div>
                      <div className="flex items-center gap-2 mt-2 text-[1vh]">
                          <Mic2 className="w-[1.2vh] h-[1.2vh] text-cyan-400 shrink-0" />
                          <span className="text-cyan-400 font-medium truncate">{song.user_nickname}</span>
                      </div>
                  </div>
              ))}
              {(!queue || queue.filter(s => s.status === 'queued').length === 0) && (
                  <div className="text-center py-8 text-white/30 text-[1.2vh]">
                      <Music className="w-8 h-8 mx-auto mb-2 opacity-20" />
                      <p>Nessuna canzone in coda</p>
                  </div>
              )}
          </div>
      </div>

      {/* CLASSIFICA */}
      <div className="glass-panel rounded-3xl flex flex-col overflow-hidden flex-1 min-h-0">
          <div className="bg-gradient-to-r from-yellow-600 to-orange-600 px-4 py-3 flex items-center justify-between border-b border-white/10 shrink-0">
              <div className="flex items-center gap-2">
                  <Trophy className="w-[2vh] h-[2vh] text-white" />
                  <span className="font-black text-white text-[1.8vh] uppercase tracking-wider">Classifica</span>
              </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2 min-h-0">
              {leaderboard && leaderboard.slice(0, 10).map((player, idx) => (
                  <div key={idx} className={`mb-2 rounded-xl p-3 flex items-center gap-3 transition-all ${
                      idx === 0 ? 'bg-gradient-to-r from-yellow-600/30 to-yellow-800/30 border-2 border-yellow-500/50' : 
                      idx === 1 ? 'bg-gradient-to-r from-zinc-400/20 to-zinc-600/20 border border-zinc-400/30' :
                      idx === 2 ? 'bg-gradient-to-r from-orange-700/20 to-orange-900/20 border border-orange-600/30' :
                      'bg-white/5 border border-white/10'
                  }`}>
                      <div className={`rounded-lg w-[3vh] h-[3vh] flex items-center justify-center font-black text-[1.4vh] shrink-0 font-mono ${
                          idx === 0 ? 'bg-yellow-500 text-black' :
                          idx === 1 ? 'bg-zinc-400 text-black' :
                          idx === 2 ? 'bg-orange-600 text-white' :
                          'bg-white/10 text-white/60'
                      }`}>
                          #{idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                          <div className="font-bold text-white text-[1.4vh] truncate">{player.nickname}</div>
                      </div>
                      <div className={`font-mono font-black text-[1.6vh] ${
                          idx === 0 ? 'text-yellow-400' :
                          idx === 1 ? 'text-zinc-300' :
                          idx === 2 ? 'text-orange-400' :
                          'text-cyan-400'
                      }`}>
                          {player.score}
                      </div>
                  </div>
              ))}
              {(!leaderboard || leaderboard.length === 0) && (
                  <div className="text-center py-8 text-white/30 text-[1.2vh]">
                      <Trophy className="w-8 h-8 mx-auto mb-2 opacity-20" />
                      <p>Nessun partecipante</p>
                  </div>
              )}
          </div>
      </div>
  </div>
);

// ========== KARAOKE MODE ==========
const KaraokeMode = ({ perf, isMuted }) => {
    if (!perf) return null;
    
    return (
        <div className="w-full h-full relative">
            {/* Barra info cantante in alto */}
            <div className="dj-karaoke-bar absolute bottom-0 left-0 right-0 z-20 glass-panel border-t-2 border-fuchsia-500/50">
                <div className="h-full flex items-center justify-between px-8">
                    <div className="flex items-center gap-6">
                        <div className="w-[7vh] h-[7vh] rounded-full bg-gradient-to-br from-fuchsia-600 to-purple-600 flex items-center justify-center border-4 border-white/20 shadow-xl">
                            <Mic2 className="w-[4vh] h-[4vh] text-white" />
                        </div>
                        <div>
                            <div className="text-[2vh] font-black text-white uppercase tracking-wider">{perf.user_nickname}</div>
                            <div className="flex items-center gap-3">
                                <span className={`px-3 py-1 rounded-full text-[1.2vh] font-bold uppercase ${
                                    perf.status === 'live' ? 'bg-red-600 text-white animate-pulse' : 'bg-yellow-600 text-black'
                                }`}>
                                    {perf.status === 'live' ? '🔴 IN ONDA' : '⏸ PAUSA'}
                                </span>
                            </div>
                        </div>
                    </div>
                    
                    <div className="text-right">
                        <div className="text-[3vh] font-black text-white leading-tight">{perf.song_title}</div>
                        <div className="text-[1.8vh] text-white/70 font-medium">{perf.song_artist}</div>
                    </div>
                </div>
            </div>

            {/* Video player karaoke */}
            <div className="dj-karaoke-player absolute top-0 left-0 right-0 z-10">
                <KaraokePlayer 
                    youtubeUrl={perf.youtube_url} 
                    isPaused={perf.status === 'paused'} 
                    isMuted={isMuted}
                />
            </div>
        </div>
    );
};

// ========== VOTING MODE ==========
const VotingMode = ({ perf }) => {
    if (!perf) return null;
    
    return (
        <div className="w-full h-full flex flex-col items-center justify-center animated-bg relative overflow-hidden">
            <div className="w-[800px] h-[800px] bg-yellow-500/20 rounded-full blur-[200px] absolute z-0 animate-pulse"></div>
            
            <div className="relative z-10 text-center max-w-4xl">
                <Trophy className="w-32 h-32 text-yellow-400 mx-auto mb-8 animate-bounce" />
                
                <div className="mb-12">
                    <h1 className="text-8xl font-black text-white mb-4 drop-shadow-2xl">VOTA ORA!</h1>
                    <p className="text-3xl text-white/80 font-medium">Apri l'app e dai il tuo voto</p>
                </div>
                
                <div className="glass-panel p-8 rounded-3xl border-2 border-yellow-500/50 mb-8">
                    <div className="text-5xl font-black text-white mb-2">{perf.song_title}</div>
                    <div className="text-3xl text-white/70 mb-4">{perf.song_artist}</div>
                    <div className="flex items-center justify-center gap-3 pt-4 border-t border-white/10">
                        <Mic2 className="w-8 h-8 text-fuchsia-400" />
                        <span className="text-4xl font-bold text-fuchsia-400">{perf.user_nickname}</span>
                    </div>
                </div>
                
                <div className="flex justify-center gap-3">
                    {[1, 2, 3, 4, 5].map(star => (
                        <Star key={star} className="w-16 h-16 text-yellow-400 fill-yellow-400 animate-pulse" 
                              style={{animationDelay: `${star * 0.1}s`}} />
                    ))}
                </div>
            </div>
        </div>
    );
};

// ========== SCORE MODE ==========
const ScoreMode = ({ perf }) => {
    if (!perf) return null;
    
    const avgScore = perf.avg_score || 0;
    const voteCount = perf.vote_count || 0;
    
    return (
        <div className="w-full h-full flex flex-col items-center justify-center animated-bg relative overflow-hidden">
            <div className="w-[800px] h-[800px] bg-fuchsia-600/20 rounded-full blur-[200px] absolute z-0 animate-pulse"></div>
            
            <div className="relative z-10 text-center max-w-5xl">
                <Zap className="w-32 h-32 text-fuchsia-400 mx-auto mb-8 animate-pulse" />
                
                <div className="mb-12">
                    <h1 className="text-7xl font-black text-white mb-6 drop-shadow-2xl uppercase tracking-wider">Risultato</h1>
                </div>
                
                <div className="glass-panel p-12 rounded-3xl border-2 border-fuchsia-500/50 mb-12">
                    <div className="text-5xl font-black text-white mb-3">{perf.song_title}</div>
                    <div className="text-3xl text-white/70 mb-6">{perf.song_artist}</div>
                    <div className="flex items-center justify-center gap-3 pt-6 border-t border-white/10 mb-8">
                        <Mic2 className="w-10 h-10 text-fuchsia-400" />
                        <span className="text-5xl font-bold text-fuchsia-400">{perf.user_nickname}</span>
                    </div>
                    
                    <div className="bg-gradient-to-r from-yellow-600/30 to-orange-600/30 rounded-2xl p-8 border-2 border-yellow-500/50">
                        <div className="flex items-center justify-center gap-2 mb-4">
                            {[1, 2, 3, 4, 5].map(star => (
                                <Star 
                                    key={star} 
                                    className={`w-16 h-16 ${star <= Math.round(avgScore) ? 'text-yellow-400 fill-yellow-400' : 'text-white/20'}`}
                                />
                            ))}
                        </div>
                        <div className="text-8xl font-black text-yellow-400 mb-2">{avgScore.toFixed(1)}</div>
                        <div className="text-2xl text-white/60">{voteCount} {voteCount === 1 ? 'voto' : 'voti'}</div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ========== QUIZ MODE ==========
const QuizMode = ({ quiz, result }) => {
    if (!quiz) return null;

    return (
    <div className="w-full h-full relative overflow-hidden">
        <div className="absolute inset-0 animated-bg z-0"></div>
        
        <div className="absolute inset-0 z-10 flex items-center justify-center p-4">
            {quiz.status === 'leaderboard' ? (
                <div className="w-full h-full flex flex-col items-center justify-center">
                    <Trophy className="w-40 h-40 text-yellow-400 mb-8 animate-bounce" />
                    <h1 className="text-8xl font-black text-white mb-12 text-center drop-shadow-2xl">CLASSIFICA</h1>
                    <div className="w-full max-w-4xl glass-panel rounded-3xl p-8 border-2 border-yellow-500/50">
                        {quiz.leaderboard && quiz.leaderboard.slice(0, 5).map((player, idx) => (
                            <div key={idx} className={`flex items-center gap-6 p-6 rounded-2xl mb-4 ${
                                idx === 0 ? 'bg-gradient-to-r from-yellow-600/40 to-yellow-800/40 border-2 border-yellow-500' :
                                idx === 1 ? 'bg-gradient-to-r from-zinc-400/30 to-zinc-600/30 border-2 border-zinc-400' :
                                idx === 2 ? 'bg-gradient-to-r from-orange-700/30 to-orange-900/30 border-2 border-orange-600' :
                                'bg-white/10 border border-white/20'
                            }`}>
                                <div className={`text-6xl font-black font-mono ${
                                    idx === 0 ? 'text-yellow-400' :
                                    idx === 1 ? 'text-zinc-300' :
                                    idx === 2 ? 'text-orange-400' :
                                    'text-white/60'
                                }`}>
                                    #{idx + 1}
                                </div>
                                <div className="flex-1">
                                    <div className="text-4xl font-bold text-white">{player.nickname}</div>
                                </div>
                                <div className={`text-6xl font-black font-mono ${
                                    idx === 0 ? 'text-yellow-400' :
                                    idx === 1 ? 'text-zinc-300' :
                                    idx === 2 ? 'text-orange-400' :
                                    'text-cyan-400'
                                }`}>
                                    {player.score}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : quiz.status === 'showing_results' && result ? (
                <div className="w-full h-full flex flex-col items-center justify-center">
                    <div className="mb-8">
                        <h1 className="text-6xl font-black text-white text-center mb-4">Risposta Corretta:</h1>
                        {quiz.media_url && quiz.media_type !== 'text' && (
                            <div className="mb-6">
                                <QuizMediaFixed url={quiz.media_url} type={quiz.media_type} />
                            </div>
                        )}
                    </div>
                    
                    <div className="glass-panel rounded-3xl p-12 border-4 border-green-500 bg-green-600/20 mb-8 max-w-4xl">
                        <div className="text-7xl font-black text-white text-center">{result.correct_option}</div>
                    </div>
                    
                    <div className="text-3xl text-white/70 mb-8">{result.total_answers} partecipanti hanno risposto</div>
                    
                    <div className="w-full max-w-4xl">
                        <h2 className="text-4xl font-bold text-white mb-6 text-center">Chi ha indovinato:</h2>
                        <div className="glass-panel rounded-2xl p-6">
                            {result.correct_answers && result.correct_answers.length > 0 ? (
                                <div className="grid grid-cols-3 gap-4">
                                    {result.correct_answers.slice(0, 9).map((ans, i) => (
                                        <div key={i} className="bg-green-600/20 border border-green-500/50 rounded-xl p-4 flex items-center gap-3">
                                            <div className="w-12 h-12 rounded-full bg-green-600 flex items-center justify-center text-white font-black text-xl">
                                                ✓
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-xl font-bold text-white truncate">{ans.nickname}</div>
                                                <div className="text-sm text-green-400">+{ans.points_earned} pt</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-white/30 italic text-center py-4 text-2xl">Nessuno ha indovinato in tempo!</div>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="w-full h-full flex flex-col justify-center gap-4 px-4 overflow-hidden">
                    {quiz.media_url && quiz.media_type !== 'text' && (
                        <div className="flex justify-center mb-4">
                            <QuizMediaFixed url={quiz.media_url} type={quiz.media_type} />
                        </div>
                    )}
                    
                    <h1 style={{fontSize: 'clamp(1.5rem, 4vw, 4rem)', lineHeight: 1.2}} className="font-black text-white drop-shadow-2xl text-center">{quiz.question}</h1>
                    
                    {quiz.status === 'closed' ? (
                         <div className="bg-red-600 rounded-[2rem] animate-pulse shadow-[0_0_80px_rgba(220,38,38,0.8)] border-4 border-red-400 mx-auto px-10 py-6">
                             <h2 style={{fontSize: 'clamp(2rem, 4vw, 4rem)'}} className="font-black text-white uppercase italic">TEMPO SCADUTO!</h2>
                         </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-3 flex-1 min-h-0">
                            {quiz.options.map((opt, i) => (
                                <div key={i} className="glass-panel border-l-[8px] border-fuchsia-600 px-4 rounded-r-2xl flex items-center gap-4 text-left overflow-hidden">
                                    <div style={{fontSize: 'clamp(1.2rem, 2.5vw, 2.5rem)', minWidth: '2.5em', minHeight: '2.5em'}} className="bg-black/40 rounded-xl flex items-center justify-center font-black text-white shrink-0 font-mono border border-white/10 aspect-square">
                                        {String.fromCharCode(65+i)}
                                    </div>
                                    <div style={{fontSize: 'clamp(1rem, 2vw, 2rem)'}} className="font-bold text-white leading-tight line-clamp-3">{opt}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    </div>
)};

// ========== IDLE MODE ==========
const IdleMode = ({ pub }) => (
    <div className="w-full h-full flex flex-col items-center justify-center animated-bg relative overflow-hidden">
        <div className="w-[1000px] h-[1000px] bg-fuchsia-600/10 rounded-full blur-[150px] absolute z-0 animate-pulse"></div>
        
        <div className="relative z-10 text-center">
            {pub.logo_url ? (
                 <img src={pub.logo_url} className="w-80 h-80 rounded-[3rem] mb-12 mx-auto shadow-[0_0_80px_rgba(0,0,0,0.8)] border-4 border-white/10 object-contain bg-black p-8" alt="logo" />
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

// ========== MAIN COMPONENT ==========
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