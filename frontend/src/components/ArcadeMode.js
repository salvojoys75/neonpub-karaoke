// ============================================================
// 🎮 ARCADE MODE - Display Pubblico
// ============================================================

import React, { useEffect, useRef, useState } from 'react';
import { Trophy, Users, XCircle } from 'lucide-react';

const BOOKING_SOUND = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjWL0fPTgjMGHm7A7+OZUQ8Q');
BOOKING_SOUND.volume = 1.0;

const ERROR_SOUND = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAAD/////zJmZmZmZmWZmZmZmZmYzMzMzMzMzAAAAAAAAAP////+ZmZmZmZmZZmZmZmZmZjMzMzMzMzMAAAAAAAAAzMzMzMzMzJmZmZmZmZlmZmZmZmZmMzMzMzMzMwAAAAAAAAD/////zMzMzMzMzJmZmZmZmZlmZmZmZmZmMzMzMzMzMw==');
ERROR_SOUND.volume = 0.8;

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

  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    10%, 30%, 50%, 70%, 90% { transform: translateX(-10px); }
    20%, 40%, 60%, 80% { transform: translateX(10px); }
  }
  .shake-animation { animation: shake 0.5s; }

  @keyframes pulse-red {
    0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
    50% { box-shadow: 0 0 0 20px rgba(239, 68, 68, 0); }
  }
  .pulse-red-animation { animation: pulse-red 1s infinite; }
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

const HiddenSpotifyPlayer = ({ trackUrl, isPlaying }) => {
  const getSpotifyEmbedUrl = (url) => {
    if (!url) return null;
    if (url.includes('embed.spotify.com')) return url;
    const match = url.match(/track\/([a-zA-Z0-9]+)/);
    if (match) return `https://open.spotify.com/embed/track/${match[1]}?utm_source=generator`;
    return null;
  };

  const embedUrl = getSpotifyEmbedUrl(trackUrl);
  if (!embedUrl || !isPlaying) return null;

  return (
    <iframe
      src={embedUrl}
      width="0"
      height="0"
      frameBorder="0"
      allow="autoplay; encrypted-media"
      style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
    />
  );
};

const ArcadeMode = ({ arcade, result, bookingQueue = [], lastError = null }) => {
  const prevBookingCountRef = useRef(0);
  const [showError, setShowError] = useState(false);

  useEffect(() => {
    if (bookingQueue.length > prevBookingCountRef.current) {
      prevBookingCountRef.current = bookingQueue.length;
      BOOKING_SOUND.currentTime = 0;
      BOOKING_SOUND.play().catch(e => console.log('Audio beep failed:', e));
    }
    if (bookingQueue.length === 0) {
      prevBookingCountRef.current = 0;
    }
  }, [bookingQueue]);

  useEffect(() => {
    if (lastError) {
      setShowError(true);
      ERROR_SOUND.currentTime = 0;
      ERROR_SOUND.play().catch(e => console.log('Error sound failed:', e));
      const timer = setTimeout(() => setShowError(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [lastError]);

  // ✅ FIX: VINCITORE - Controlla result.winner
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
            <div className="text-6xl font-black text-white text-center leading-tight">{arcade?.correct_answer || ''}</div>
          </div>

          <div className="p-10 rounded-[3rem] max-w-4xl w-full border-4 border-yellow-500/50" style={{background: 'rgba(15, 15, 20, 0.7)', backdropFilter: 'blur(20px)'}}>
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
              <div className="text-6xl font-black text-yellow-400">+{arcade?.points_reward || 100} PUNTI</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // GIOCO ATTIVO
  const hasBookings = bookingQueue && bookingQueue.length > 0;
  const isPlaying = !hasBookings;

  return (
    <div className="w-full h-full flex flex-col bg-gradient-to-br from-[#0d0d1a] via-black to-[#0d0d1a] relative overflow-hidden">
      <style>{WAVE_STYLES}</style>

      {arcade?.track_url && <HiddenSpotifyPlayer trackUrl={arcade.track_url} isPlaying={isPlaying} />}

      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/4 w-[500px] h-[500px] bg-fuchsia-600/15 rounded-full blur-[180px] animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-purple-600/15 rounded-full blur-[180px] animate-pulse" style={{animationDelay:'1s'}}></div>
      </div>

      {showError && lastError && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-red-900/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-red-600/90 backdrop-blur-xl px-16 py-8 rounded-[3rem] border-4 border-red-400 shadow-[0_0_100px_rgba(239,68,68,0.8)] shake-animation">
            <div className="flex items-center gap-6">
              <XCircle className="w-24 h-24 text-white pulse-red-animation" />
              <div>
                <div className="text-4xl font-black text-white mb-2">❌ SBAGLIATO!</div>
                <div className="text-2xl text-red-100">{lastError.participants?.nickname}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-8">

        {arcade?.question && (
          <div className="bg-fuchsia-600/90 backdrop-blur-xl px-12 py-6 rounded-[3rem] mb-8 shadow-[0_0_60px_rgba(192,38,211,0.6)] border-4 border-fuchsia-400 max-w-5xl w-full">
            <div className="text-5xl font-black text-white text-center leading-tight">
              {arcade.question}
            </div>
          </div>
        )}

        {arcade?.options && arcade.options.length > 0 && (
          <div className="grid grid-cols-2 gap-6 mb-8 max-w-5xl w-full">
            {arcade.options.map((option, index) => (
              <div
                key={index}
                className="px-8 py-6 rounded-2xl border-2 border-white/20"
                style={{background: 'rgba(15, 15, 20, 0.7)', backdropFilter: 'blur(20px)'}}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-fuchsia-600 flex items-center justify-center text-2xl font-black text-white shrink-0">
                    {String.fromCharCode(65 + index)}
                  </div>
                  <div className="text-2xl font-bold text-white">
                    {option}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {hasBookings ? (
          <div className="p-6 rounded-2xl border-4 border-fuchsia-500 max-w-4xl w-full mb-6" style={{background: 'rgba(15, 15, 20, 0.7)', backdropFilter: 'blur(20px)'}}>
            <div className="flex items-center gap-3 mb-4">
              <Users className="w-8 h-8 text-fuchsia-400" />
              <div className="text-2xl font-black text-white uppercase">
                🎤 Prenotati ({bookingQueue.length})
              </div>
            </div>

            <div className="space-y-3">
              {bookingQueue.slice(0, 5).map((booking, index) => (
                <div
                  key={booking.id}
                  className={`flex items-center gap-4 p-4 rounded-xl ${
                    index === 0
                      ? 'bg-fuchsia-600/50 border-2 border-fuchsia-400 animate-pulse'
                      : 'bg-white/5'
                  }`}
                >
                  <div className="w-12 h-12 rounded-full bg-yellow-500 flex items-center justify-center text-2xl font-black text-black shrink-0">
                    {index + 1}
                  </div>

                  {booking.participants?.avatar_url && (
                    <img
                      src={booking.participants.avatar_url}
                      alt="avatar"
                      className="w-16 h-16 rounded-full border-2 border-white/30"
                    />
                  )}

                  <div className="flex-1">
                    <div className="text-3xl font-black text-white">
                      {booking.participants?.nickname || 'Partecipante'}
                    </div>
                    {index === 0 && (
                      <div className="text-lg text-fuchsia-200 font-medium mt-1">
                        👉 Al microfono adesso!
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="mb-8">
              <MusicWaves paused={false} size="large" />
            </div>

            <div className="text-center mb-8">
              <div
                className="font-black text-white mb-6 leading-none tracking-tight drop-shadow-2xl"
                style={{ fontSize: 'clamp(4rem, 10vw, 8rem)' }}
              >
                PRENOTA ORA!
              </div>
              <div className="text-3xl text-fuchsia-200 font-medium">
                📱 Usa l'app per prenotarti
              </div>
            </div>
          </>
        )}

        <div className="flex gap-6 items-center flex-wrap justify-center">
          <div className="px-8 py-4 rounded-full border-2 border-fuchsia-500/40" style={{background: 'rgba(15, 15, 20, 0.7)', backdropFilter: 'blur(20px)'}}>
            <div className="text-3xl font-bold text-fuchsia-300 flex items-center gap-3">
              <Trophy className="w-8 h-8 text-yellow-400" />
              {arcade?.points_reward || 100} punti
            </div>
          </div>
          <div className="px-8 py-4 rounded-full border-2 border-white/20" style={{background: 'rgba(15, 15, 20, 0.7)', backdropFilter: 'blur(20px)'}}>
            <div className="text-2xl font-bold text-white">
              🎯 {arcade?.attempts_count || 0}/{arcade?.max_attempts || 5} tentativi
            </div>
          </div>
        </div>
      </div>

      <div className="relative z-10 p-6 text-center">
        <div className="text-lg text-zinc-600 uppercase tracking-widest">
          {hasBookings ? '🎤 Ascolta le risposte dei concorrenti' : '🎵 Ascolta la canzone e prenota quando sei pronto!'}
        </div>
      </div>
    </div>
  );
};

export default ArcadeMode;
