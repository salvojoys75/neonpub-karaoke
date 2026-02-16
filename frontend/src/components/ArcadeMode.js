// ============================================================
// 🎮 ARCADE MODE - Display Pubblico
// Mostra il gioco Arcade sullo schermo del pub
// ============================================================

import React from 'react';
import { Music, Trophy, Zap, Clock, Users } from 'lucide-react';

const ArcadeMode = ({ arcade, result }) => {
  
  // Se è in fase risultati, mostra il vincitore
  if (result && result.winner) {
    return (
      <div className="w-full h-full flex flex-col bg-gradient-to-br from-green-900 via-black to-black relative overflow-hidden">
        
        {/* Effetto confetti/celebrazione */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-green-500/20 rounded-full blur-[150px] animate-pulse"></div>
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-yellow-500/20 rounded-full blur-[150px] animate-pulse"></div>
        </div>

        <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-12">
          
          {/* Badge "RISPOSTA CORRETTA" */}
          <div className="bg-green-600/90 backdrop-blur-xl px-12 py-6 rounded-[3rem] mb-12 shadow-[0_0_100px_rgba(34,197,94,0.6)] border-4 border-green-400 animate-in zoom-in duration-500">
            <div className="text-white/80 uppercase font-bold tracking-widest text-2xl mb-2 text-center">
              ✅ Risposta Corretta!
            </div>
            <div className="text-6xl font-black text-white text-center leading-tight">
              {arcade.correct_answer}
            </div>
          </div>

          {/* Vincitore */}
          <div className="glass-panel p-10 rounded-[3rem] max-w-4xl w-full border-4 border-yellow-500/50">
            <div className="flex items-center justify-center gap-8 mb-8">
              <Trophy className="w-24 h-24 text-yellow-400 animate-bounce" />
              <div className="text-center">
                <div className="text-yellow-500/80 uppercase font-bold tracking-widest text-xl mb-2">
                  🏆 Vincitore
                </div>
                <div className="text-7xl font-black text-white">
                  {result.winner.nickname}
                </div>
              </div>
              <Trophy className="w-24 h-24 text-yellow-400 animate-bounce" />
            </div>

            {/* Avatar se presente */}
            {result.winner.avatar_url && (
              <div className="flex justify-center mb-6">
                <img 
                  src={result.winner.avatar_url} 
                  alt="winner" 
                  className="w-32 h-32 rounded-full border-4 border-yellow-500 shadow-2xl"
                />
              </div>
            )}

            {/* Punti */}
            <div className="text-center">
              <div className="text-6xl font-black text-yellow-400">
                +{arcade.points_reward} PUNTI
              </div>
            </div>
          </div>

          {/* Altri tentativi (se ci sono) */}
          {result.others && result.others.length > 0 && (
            <div className="mt-8 text-center text-zinc-400">
              <div className="text-sm uppercase tracking-widest mb-2">Hanno provato:</div>
              <div className="text-lg">
                {result.others.map(p => p.nickname).join(', ')}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Gioco in pausa
  if (arcade.status === 'paused') {
    return (
      <div className="w-full h-full flex flex-col bg-gradient-to-br from-zinc-900 via-black to-black items-center justify-center">
        <div className="text-zinc-600 text-8xl mb-6">⏸️</div>
        <div className="text-4xl font-bold text-zinc-400 uppercase tracking-widest">
          Gioco in Pausa
        </div>
      </div>
    );
  }

  // Qualcuno è al microfono (prenotazione attiva)
  if (arcade.current_booking) {
    const booking = arcade.current_booking;
    
    return (
      <div className="w-full h-full flex flex-col bg-gradient-to-br from-fuchsia-900 via-black to-black relative overflow-hidden">
        
        {/* Effetti luminosi */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-fuchsia-500/30 rounded-full blur-[150px] animate-pulse"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/30 rounded-full blur-[150px] animate-pulse"></div>
        </div>

        <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-12">
          
          {/* Badge "AL MICROFONO" */}
          <div className="bg-fuchsia-600/90 backdrop-blur-xl px-12 py-4 rounded-full mb-8 shadow-[0_0_60px_rgba(192,38,211,0.6)] border-2 border-white/20 animate-pulse">
            <div className="text-2xl font-black text-white uppercase tracking-[0.3em] flex items-center gap-4">
              <Zap className="w-8 h-8" />
              AL MICROFONO
              <Zap className="w-8 h-8" />
            </div>
          </div>

          {/* Card partecipante */}
          <div className="glass-panel p-12 rounded-[3rem] max-w-3xl w-full border-4 border-fuchsia-500/50 animate-in zoom-in duration-300">
            
            {/* Avatar + Nome */}
            <div className="flex flex-col items-center mb-8">
              {booking.participants?.avatar_url && (
                <img 
                  src={booking.participants.avatar_url} 
                  alt="avatar" 
                  className="w-40 h-40 rounded-full border-4 border-fuchsia-500 shadow-2xl mb-6 ring-8 ring-fuchsia-500/30"
                />
              )}
              <div className="text-8xl font-black text-white text-center leading-none">
                {booking.participants?.nickname || 'Partecipante'}
              </div>
            </div>

            {/* Messaggio */}
            <div className="text-center">
              <div className="text-2xl text-fuchsia-200 font-medium">
                Sta dando la risposta...
              </div>
            </div>
          </div>

          {/* Info punti */}
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

  // Gioco attivo - aspetta prenotazioni
  return (
    <div className="w-full h-full flex flex-col bg-gradient-to-br from-yellow-900 via-black to-black relative overflow-hidden">
      
      {/* Effetti luminosi animati */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/3 w-[600px] h-[600px] bg-yellow-500/20 rounded-full blur-[200px] animate-pulse"></div>
        <div className="absolute bottom-0 right-1/3 w-[600px] h-[600px] bg-orange-500/20 rounded-full blur-[200px] animate-pulse"></div>
      </div>

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-12">
        
        {/* Badge categoria */}
        <div className="bg-yellow-600/90 backdrop-blur-xl px-10 py-4 rounded-full mb-8 shadow-[0_0_60px_rgba(234,179,8,0.6)] border-2 border-white/20 transform -rotate-2">
          <div className="text-xl font-black text-white uppercase tracking-[0.3em]">
            🎵 Indovina la Canzone
          </div>
        </div>

        {/* Icona principale */}
        <div className="relative mb-12">
          <div className="absolute inset-0 bg-yellow-500 rounded-full blur-3xl animate-pulse opacity-40"></div>
          <Music className="w-48 h-48 text-white relative z-10 animate-bounce" style={{ animationDuration: '2s' }} />
        </div>

        {/* Call to action principale */}
        <div className="text-center mb-12">
          <div className="text-9xl font-black text-white mb-6 leading-none tracking-tight drop-shadow-2xl animate-in zoom-in duration-500">
            PRENOTA ORA!
          </div>
          <div className="text-4xl text-yellow-200 font-medium">
            👆 Usa l'app per prenotarti
          </div>
        </div>

        {/* Info gioco */}
        <div className="flex gap-8 items-center">
          <div className="glass-panel px-8 py-4 rounded-full border-2 border-yellow-500/30">
            <div className="text-3xl font-bold text-yellow-400 flex items-center gap-3">
              <Trophy className="w-8 h-8" />
              {arcade.points_reward} punti
            </div>
          </div>

          <div className="glass-panel px-8 py-4 rounded-full border-2 border-white/20">
            <div className="text-2xl font-bold text-white flex items-center gap-3">
              <Users className="w-7 h-7" />
              {arcade.attempts_count || 0}/{arcade.max_attempts} tentativi
            </div>
          </div>
        </div>

        {/* Countdown o animazione */}
        <div className="mt-12 text-center">
          <div className="text-6xl font-bold text-yellow-300 animate-pulse">
            🎶 ♪ ♫ ♪ 🎶
          </div>
        </div>
      </div>

      {/* Info in basso */}
      <div className="relative z-10 p-8 text-center">
        <div className="text-xl text-zinc-500 uppercase tracking-widest">
          Sii veloce! Il primo che prenota risponde
        </div>
      </div>
    </div>
  );
};

export default ArcadeMode;