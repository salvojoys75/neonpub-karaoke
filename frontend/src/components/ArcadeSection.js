// ============================================================
// 🎮 ARCADE SECTION - App Partecipante CON DOMANDA E RISPOSTE
// La musica si sente dall'ambiente (casse del locale)
// ============================================================

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Trophy, Zap, XCircle, Music } from 'lucide-react';
import { toast } from 'sonner';
import * as api from '@/lib/api';

// 🔊 Suono di conferma prenotazione
const BOOKING_SOUND = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjWL0fPTgjMGHm7A7+OZUQ8Q');
BOOKING_SOUND.volume = 1.0;

const ArcadeSection = ({ participant }) => {
  const [activeGame, setActiveGame] = useState(null);
  const [myBooking, setMyBooking] = useState(null);
  const [loading, setLoading] = useState(false);
  const [penaltyRemaining, setPenaltyRemaining] = useState(0);

  // ============================================================
  // CARICAMENTO DATI
  // ============================================================

  useEffect(() => {
    loadArcadeData();
    const interval = setInterval(loadArcadeData, 2000);
    return () => clearInterval(interval);
  }, [participant?.id]);

  const loadArcadeData = async () => {
    try {
      const { data: game } = await api.getActiveArcadeGame();
      setActiveGame(game);

      if (game && participant?.id) {
        const { data: bookings } = await api.getArcadeBookings(game.id);
        const mine = bookings?.find(b => b.participant_id === participant.id && b.status === 'pending');
        setMyBooking(mine || null);

        // Penalità
        const lastWrong = bookings?.find(
          b => b.participant_id === participant.id && b.status === 'wrong'
        );
        
        if (lastWrong && lastWrong.validated_at) {
          const penaltyEnd = new Date(lastWrong.validated_at);
          penaltyEnd.setSeconds(penaltyEnd.getSeconds() + game.penalty_seconds);
          const remaining = Math.max(0, Math.ceil((penaltyEnd - new Date()) / 1000));
          setPenaltyRemaining(remaining);
        } else {
          setPenaltyRemaining(0);
        }
      }
    } catch (error) {
      console.error('Errore caricamento arcade:', error);
    }
  };

  // ============================================================
  // PRENOTAZIONE
  // ============================================================

  const handleBook = async () => {
    if (!activeGame) {
      toast.error('Nessun gioco attivo!');
      return;
    }
    
    if (!participant?.id) {
      toast.error('Errore autenticazione!');
      return;
    }

    setLoading(true);
    try {
      await api.bookArcadeAnswer(activeGame.id, participant.id);
      
      // 🔊 Suono conferma
      BOOKING_SOUND.currentTime = 0;
      BOOKING_SOUND.play().catch(e => console.log('Audio failed:', e));
      
      toast.success('🎤 Sei prenotato! Preparati al microfono!');
      loadArcadeData();
    } catch (error) {
      console.error('Errore prenotazione:', error);
      toast.error(error.message || 'Errore prenotazione');
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // RENDER: NESSUN GIOCO
  // ============================================================

  if (!activeGame || activeGame.status !== 'active') {
    return (
      <div className="text-center py-16 px-4">
        <div className="w-24 h-24 rounded-full bg-zinc-800 flex items-center justify-center mx-auto mb-6">
          <Trophy className="w-12 h-12 text-zinc-600" />
        </div>
        <h3 className="text-xl font-bold text-white mb-2">
          Nessun Gioco Attivo
        </h3>
        <p className="text-zinc-400 text-sm">
          L'Arcade partirà presto!
        </p>
      </div>
    );
  }

  // ============================================================
  // RENDER: HO GIÀ PRENOTATO
  // ============================================================

  if (myBooking) {
    return (
      <div className="p-6 space-y-6 animate-in fade-in duration-500">
        
        {/* Header */}
        <div className="text-center">
          <div className="w-20 h-20 rounded-full bg-fuchsia-600 flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Zap className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-3xl font-black text-white mb-2">
            SEI PRENOTATO!
          </h2>
          <p className="text-fuchsia-300 text-lg">
            🎤 Preparati a rispondere
          </p>
        </div>

        {/* 🎵 DOMANDA */}
        {activeGame.question && (
          <div className="bg-fuchsia-900/30 border-2 border-fuchsia-500 rounded-2xl p-6">
            <div className="text-sm text-fuchsia-300 uppercase tracking-widest mb-2">Domanda:</div>
            <div className="text-2xl font-black text-white">
              {activeGame.question}
            </div>
          </div>
        )}

        {/* 📝 OPZIONI */}
        {activeGame.options && activeGame.options.length > 0 && (
          <div className="space-y-3">
            <div className="text-xs text-zinc-500 uppercase tracking-widest">Opzioni:</div>
            {activeGame.options.map((option, index) => (
              <div
                key={index}
                className="glass-panel px-4 py-3 rounded-xl border border-white/20"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-fuchsia-600 flex items-center justify-center text-sm font-black text-white shrink-0">
                    {String.fromCharCode(65 + index)}
                  </div>
                  <div className="text-base font-bold text-white">
                    {option}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Info punti */}
        <div className="glass-panel p-4 rounded-xl border-2 border-yellow-500/30 text-center">
          <div className="text-zinc-400 text-sm mb-1">Punti in palio:</div>
          <div className="text-3xl font-bold text-yellow-400 flex items-center justify-center gap-2">
            <Trophy className="w-6 h-6" />
            {activeGame.points_reward}
          </div>
        </div>

        {/* Istruzioni */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
          <p className="text-zinc-300 text-center text-sm">
            📢 Quando il DJ ti chiama, vai al microfono e dai la tua risposta!
          </p>
        </div>

        {/* Loader */}
        <div className="flex justify-center">
          <div className="flex gap-2">
            <div className="w-3 h-3 bg-fuchsia-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-3 h-3 bg-fuchsia-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-3 h-3 bg-fuchsia-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================
  // RENDER: PENALITÀ ATTIVA
  // ============================================================

  if (penaltyRemaining > 0) {
    return (
      <div className="p-6 space-y-6">
        
        {/* Header */}
        <div className="text-center">
          <div className="w-20 h-20 rounded-full bg-red-600 flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-3xl font-black text-white mb-2">
            Risposta Sbagliata
          </h2>
          <p className="text-red-300 text-lg">
            Aspetta prima di riprovare
          </p>
        </div>

        {/* Countdown */}
        <div className="glass-panel p-8 rounded-2xl border-2 border-red-500/50 text-center">
          <div className="text-zinc-400 text-sm uppercase tracking-widest mb-2">
            Penalità
          </div>
          <div className="text-7xl font-black text-red-400 mb-2">
            {penaltyRemaining}
          </div>
          <div className="text-zinc-500 text-sm">
            secondi rimanenti
          </div>
        </div>

        {/* Mostra comunque domanda e risposte */}
        {activeGame.question && (
          <div className="bg-zinc-900/50 border border-zinc-700 rounded-xl p-4">
            <div className="text-xs text-zinc-500 uppercase tracking-widest mb-2">Domanda:</div>
            <div className="text-lg font-bold text-zinc-300 mb-4">
              {activeGame.question}
            </div>
            {activeGame.options && activeGame.options.length > 0 && (
              <div className="space-y-2">
                {activeGame.options.map((option, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm text-zinc-400">
                    <span className="font-mono font-bold">{String.fromCharCode(65 + index)}:</span>
                    <span>{option}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Info */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
          <p className="text-zinc-400 text-center text-sm">
            💡 Usa questo tempo per ascoltare meglio la canzone!
          </p>
        </div>
      </div>
    );
  }

  // ============================================================
  // RENDER: POSSO PRENOTARE
  // ============================================================

  return (
    <div className="p-6 space-y-6 animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="text-center">
        <div className="w-20 h-20 rounded-full bg-fuchsia-600 flex items-center justify-center mx-auto mb-4">
          <Music className="w-10 h-10 text-white animate-pulse" />
        </div>
        <h2 className="text-3xl font-black text-white mb-2">
          Indovina la Canzone
        </h2>
        <p className="text-fuchsia-300 text-lg">
          🎵 Ascolta e prenota!
        </p>
      </div>

      {/* 🎵 DOMANDA */}
      {activeGame.question && (
        <div className="bg-fuchsia-900/30 border-2 border-fuchsia-500 rounded-2xl p-6">
          <div className="text-sm text-fuchsia-300 uppercase tracking-widest mb-2">Domanda:</div>
          <div className="text-2xl font-black text-white">
            {activeGame.question}
          </div>
        </div>
      )}

      {/* 📝 OPZIONI DI RISPOSTA */}
      {activeGame.options && activeGame.options.length > 0 && (
        <div className="space-y-3">
          <div className="text-xs text-zinc-500 uppercase tracking-widest">Opzioni:</div>
          {activeGame.options.map((option, index) => (
            <div
              key={index}
              className="glass-panel px-4 py-3 rounded-xl border border-white/20 hover:border-fuchsia-500/50 transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-fuchsia-600 flex items-center justify-center text-sm font-black text-white shrink-0">
                  {String.fromCharCode(65 + index)}
                </div>
                <div className="text-base font-bold text-white">
                  {option}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info gioco */}
      <div className="glass-panel p-6 rounded-2xl border-2 border-yellow-500/30">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-zinc-400">Punti:</span>
            <span className="text-3xl font-bold text-yellow-400 flex items-center gap-2">
              <Trophy className="w-6 h-6" />
              {activeGame.points_reward}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-zinc-400">Tentativi:</span>
            <span className="text-xl font-bold text-white">
              {activeGame.attempts_count || 0} / {activeGame.max_attempts}
            </span>
          </div>
        </div>
      </div>

      {/* Indicatore audio */}
      <div className="bg-fuchsia-900/20 border-2 border-fuchsia-500/30 rounded-xl p-4">
        <div className="flex items-center gap-3 justify-center">
          <Music className="w-6 h-6 text-fuchsia-400 animate-pulse" />
          <p className="text-fuchsia-200 text-center text-sm font-medium">
            🔊 Ascolta la musica dalle casse del locale
          </p>
        </div>
      </div>

      {/* Bottone PRENOTA */}
      <Button
        onClick={handleBook}
        disabled={loading}
        className="w-full h-24 text-3xl font-black rounded-2xl bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-500 hover:to-orange-500 shadow-[0_0_60px_rgba(234,179,8,0.4)] border-4 border-yellow-400/50 animate-pulse"
      >
        {loading ? (
          <>
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mr-3"></div>
            Prenotazione...
          </>
        ) : (
          <>
            <Zap className="w-10 h-10 mr-3" />
            PRENOTA RISPOSTA
          </>
        )}
      </Button>

      {/* Info aggiuntive */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 space-y-2">
        <p className="text-zinc-300 text-center text-sm font-medium">
          ⚡ Primi 5 che prenotano vanno in coda!
        </p>
        <p className="text-zinc-500 text-center text-xs">
          Se sbagli, aspetterai {activeGame.penalty_seconds} secondi prima di riprovare
        </p>
      </div>

      {/* Progress bar visivo */}
      <div className="relative h-2 bg-zinc-800 rounded-full overflow-hidden">
        <div 
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-yellow-600 to-orange-600 transition-all duration-500"
          style={{ 
            width: `${((activeGame.attempts_count || 0) / activeGame.max_attempts) * 100}%`
          }}
        ></div>
      </div>
      <p className="text-center text-xs text-zinc-600">
        Tentativi utilizzati
      </p>
    </div>
  );
};

export default ArcadeSection;