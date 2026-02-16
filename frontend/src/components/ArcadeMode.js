// ============================================================
// 🎮 ARCADE MODE - Display Pubblico (maxischermo)
// Nessun player audio — solo animazione grafica
// ============================================================

import React from 'react';
import { Trophy } from 'lucide-react';

// Animazione onde musicali CSS inline
const WAVE_STYLES = `
  @keyframes wave1 { 0%,100%{height:20px} 50%{height:60px} }
  @keyframes wave2 { 0%,100%{height:40px} 50%{height:90px} }
  @keyframes wave3 { 0%,100%{height:30px} 50%{height:75px} }
  @keyframes wave4 { 0%,100%{height:55px} 50%{height:25px} }
  @keyframes wave5 { 0%,100%{height:25px} 50%{height:70px} }
  @keyframes wave6 { 0%,100%{height:45px} 50%{height:15px} }
  @keyframes wave7 { 0%,100%{height:35px} 50%{height:80px} }
  @keyframes wave8 { 0%,100%{height:15px} 50%{height:55px} }
  .bar1{animation:wave1 0.8s ease-in-out infinite}
  .bar2{animation:wave2 0.9s ease-in-out infinite 0.1s}
  .bar3{animation:wave3 0.7s ease-in-out infinite 0.2s}
  .bar4{animation:wave4 1.0s ease-in-out infinite 0.05s}
  .bar5{animation:wave5 0.85s ease-in-out infinite 0.15s}
  .bar6{animation:wave6 0.75s ease-in-out infinite 0.25s}
  .bar7{animation:wave7 0.95s ease-in-out infinite 0.3s}
  .bar8{animation:wave8 0.65s ease-in-out infinite 0.1s}
  @keyframes wavePaused { 0%,100%{height:8px} }
  .bar-paused { animation: wavePaused 1s ease-in-out infinite !important; opacity: 0.3; }
`;

const MusicWaves = ({ paused = false, size = 'large' }) => {
  const h = size === 'large' ? 120 : 60;
  const w = size === 'large' ? 18 : 9;
  const gap = size === 'large' ? 10 : 5;
  const bars = ['bar1','bar2','bar3','bar4','bar5','bar6','bar7','bar8'];
  const colors = ['#d946ef','#a855f7','#ec4899','#f59e0b','#d946ef','#a855f7','#ec4899','#f59e0b'];

  return (
    <div style={{ display:'flex', alignItems:'flex-end', height:`${h}px`, gap:`${gap}px` }}>
      {bars.map((cls, i) => (
        <div
          key={i}
          className={paused ? 'bar-paused' : cls}
          style={{
            width:`${w}px`,
            backgroundColor: colors[i],
            borderRadius:'4px',
            boxShadow: paused ? 'none' : `0 0 12px ${colors[i]}`,
          }}
        />
      ))}
    </div>
  );
};

const ArcadeMode = ({ arcade, result }) => {
  
  // ── VINCITORE ──
  if (result && result.winner) {
    return (
      <div className="w-full h-full flex flex-col bg-gradient-to-br from-green-900 via-black to-black relative overflow-hidden">
        <style>{WAVE_STYLES}</style>
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-green-500/20 rounded-full blur-[150px] animate-pulse"></div>
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-yellow-500/20 rounded-full blur-[150px] animate-pulse"></div>
        </div>

        <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-12">
          <div className="bg-green-600/90 backdrop-blur-xl px-12 py-6 rounded-[3rem] mb-12 shadow-[0_0_100px_rgba(34,197,94,0.6)] border-4 border-green-400 animate-in zoom-in duration-500">
            <div className="text-white/80 uppercase font-bold tracking-widest text-2xl mb-2 text-center">✅ Risposta Corretta!</div>
            <div className="text-6xl font-black text-white text-center leading-tight">{arcade.correct_answer}</div>
          </div>

          <div className="glass-panel p-10 rounded-[3rem] max-w-4xl w-full border-4 border-yellow-500/50">
            <div className="flex items-center justify-center gap-8 mb-8">
              <Trophy className="w-24 h-24 text-yellow-400 animate-bounce" />
              <div className="text-center">
                <div className="text-yellow-500/80 uppercase font-bold tracking-widest text-xl mb-2">🏆 Vincitore</div>
                <div className="text-7xl font-black text-white">{result.winner.nickname}</div>
              </div>
              <Trophy className="w-24 h-24 text-yellow-400 animate-bounce" />
            </div>
            {result.winner.avatar_url && (
              <div className="flex justify-center mb-6">
                <img src={result.winner.avatar_url} alt="winner" className="w-32 h-32 rounded-full border-4 border-yellow-500 shadow-2xl" />
              </div>
            )}
            <div className="text-center">
              <div className="text-6xl font-black text-yellow-400">+{arcade.points_reward} PUNTI</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── IN PAUSA ──
  if (arcade.status === 'paused') {
    return (
      <div className="w-full h-full flex flex-col bg-gradient-to-br from-zinc-900 via-black to-black items-center justify-center">
        <style>{WAVE_STYLES}</style>
        <div className="flex flex-col items-center gap-8">
          <MusicWaves paused={true} size="large" />
          <div className="text-4xl font-bold text-zinc-400 uppercase tracking-widest">Gioco in Pausa</div>
        </div>
      </div>
    );
  }

  // ── QUALCUNO AL MICROFONO ──
  if (arcade.current_booking) {
    const booking = arcade.current_booking;
    return (
      <div className="w-full h-full flex flex-col bg-gradient-to-br from-fuchsia-900 via-black to-black relative overflow-hidden">
        <style>{WAVE_STYLES}</style>
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-fuchsia-500/30 rounded-full blur-[150px] animate-pulse"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/30 rounded-full blur-[150px] animate-pulse"></div>
        </div>

        <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-12">
          {/* Onde in pausa */}
          <div className="mb-8">
            <MusicWaves paused={true} size="large" />
          </div>

          <div className="bg-fuchsia-600/90 backdrop-blur-xl px-12 py-4 rounded-full mb-8 shadow-[0_0_60px_rgba(192,38,211,0.6)] border-2 border-white/20 animate-pulse">
            <div className="text-2xl font-black text-white uppercase tracking-[0.3em]">
              🎤 AL MICROFONO
            </div>
          </div>

          <div className="glass-panel p-12 rounded-[3rem] max-w-3xl w-full border-4 border-fuchsia-500/50">
            <div className="flex flex-col items-center mb-6">
              {booking.participants?.avatar_url && (
                <img src={booking.participants.avatar_url} alt="avatar"
                  className="w-40 h-40 rounded-full border-4 border-fuchsia-500 shadow-2xl mb-6 ring-8 ring-fuchsia-500/30" />
              )}
              <div className="text-8xl font-black text-white text-center leading-none">
                {booking.participants?.nickname || 'Partecipante'}
              </div>
              <div className="text-2xl text-fuchsia-200 font-medium mt-4">Sta dando la risposta...</div>
            </div>
          </div>

          <div className="mt-8 glass-panel px-8 py-4 rounded-full border-2 border-yellow-500/30">
            <div className="text-3xl font-bold text-yellow-400 flex items-center gap-3">
              <Trophy className="w-8 h-8" />
              {arcade.points_reward} punti in palio
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── GIOCO ATTIVO — aspetta prenotazioni ──
  return (
    <div className="w-full h-full flex flex-col bg-gradient-to-br from-[#0d0d1a] via-black to-[#0d0d1a] relative overflow-hidden">
      <style>{WAVE_STYLES}</style>

      {/* Sfondo glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/4 w-[500px] h-[500px] bg-fuchsia-600/15 rounded-full blur-[180px] animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-purple-600/15 rounded-full blur-[180px] animate-pulse" style={{animationDelay:'1s'}}></div>
      </div>

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-12">

        {/* Badge categoria */}
        <div className="bg-fuchsia-600/80 backdrop-blur-xl px-10 py-3 rounded-full mb-10 border border-white/20 transform -rotate-1">
          <div className="text-xl font-black text-white uppercase tracking-[0.3em]">
            🎵 Indovina la Canzone
          </div>
        </div>

        {/* Onde musicali animate — GRANDI */}
        <div className="mb-12">
          <MusicWaves paused={false} size="large" />
        </div>

        {/* Call to action */}
        <div className="text-center mb-12">
          <div
            className="font-black text-white mb-6 leading-none tracking-tight drop-shadow-2xl"
            style={{ fontSize: 'clamp(4rem, 10vw, 9rem)' }}
          >
            PRENOTA ORA!
          </div>
          <div className="text-3xl text-fuchsia-200 font-medium">
            👆 Usa l'app per prenotarti
          </div>
        </div>

        {/* Info gioco */}
        <div className="flex gap-8 items-center flex-wrap justify-center">
          <div className="glass-panel px-8 py-4 rounded-full border-2 border-fuchsia-500/40">
            <div className="text-3xl font-bold text-fuchsia-300 flex items-center gap-3">
              <Trophy className="w-8 h-8 text-yellow-400" />
              {arcade.points_reward} punti
            </div>
          </div>
          <div className="glass-panel px-8 py-4 rounded-full border-2 border-white/20">
            <div className="text-2xl font-bold text-white">
              🎯 {arcade.attempts_count || 0}/{arcade.max_attempts} tentativi
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="relative z-10 p-6 text-center">
        <div className="text-lg text-zinc-600 uppercase tracking-widest">
          Il primo che prenota risponde al microfono
        </div>
      </div>
    </div>
  );
};

export default ArcadeMode;