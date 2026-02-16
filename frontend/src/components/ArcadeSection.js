// ============================================================
// 🎮 ARCADE SECTION - App Partecipante
// Da integrare in ClientApp.js
// ============================================================

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Trophy, Zap, Clock, CheckCircle, XCircle, Music } from 'lucide-react';
import { toast } from 'sonner';
import * as api from '@/lib/api';

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
    
    // Polling ogni 2 secondi
    const interval = setInterval(loadArcadeData, 2000);
    return () => clearInterval(interval);
  }, [participant?.id]);

  const loadArcadeData = async () => {
    try {
      const { data: game } = await api.getActiveArcadeGame();
      setActiveGame(game);

      if (game && participant?.id) {
        // Cerca la mia prenotazione
        const { data: bookings } = await api.getArcadeBookings(game.id);
        const mine = bookings?.find(b => b.participant_id === participant.id && b.status === 'pending');
        setMyBooking(mine || null);

        // Calcola penalità se presente
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
    if (!activeGame || !participant?.id) return;

    setLoading(true);
    try {
      await api.bookArcadeAnswer(activeGame.id, participant.id);
      toast.success('🎤 Sei prenotato!');
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

        {/* Card info */}
        <div className="glass-panel p-6 rounded-2xl border-2 border-fuchsia-500/50">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Posizione:</span>
              <span className="text-2xl font-bold text-fuchsia-400">
                #{myBooking.booking_order}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Punti in palio:</span>
              <span className="text-2xl font-bold text-yellow-400 flex items-center gap-2">
                <Trophy className="w-5 h-5" />
                {activeGame.points_reward}
              </span>
            </div>
          </div>
        </div>

        {/* Istruzioni */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
          <p className="text-zinc-300 text-center text-sm">
            📢 Quando il DJ ti chiama, dai la tua risposta al microfono!
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

        {/* Info */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
          <p className="text-zinc-400 text-center text-sm">
            💡 Usa questo tempo per pensare meglio alla risposta!
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
        <div className="w-20 h-20 rounded-full bg-yellow-600 flex items-center justify-center mx-auto mb-4 animate-bounce">
          <Music className="w-10 h-10 text-white" />
        </div>
        <h2 className="text-3xl font-black text-white mb-2">
          Indovina la Canzone
        </h2>
        <p className="text-yellow-300 text-lg">
          🎵 Ascolta e prenota!
        </p>
      </div>

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

      {/* Bottone PRENOTA */}
      <Button
        onClick={handleBook}
        disabled={loading}
        className="w-full h-24 text-3xl font-black rounded-2xl bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-500 hover:to-orange-500 shadow-[0_0_60px_rgba(234,179,8,0.4)] border-4 border-yellow-400/50 animate-pulse"
      >
        {loading ? (
          <>
            <div className="spinner mr-3"></div>
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
          ⚡ Il primo che prenota va al microfono!
        </p>
        <p className="text-zinc-500 text-center text-xs">
          Se sbagli, dovrai aspettare {activeGame.penalty_seconds} secondi prima di riprovare
        </p>
      </div>

      {/* Progress bar visivo */}
      <div className="relative h-2 bg-zinc-800 rounded-full overflow-hidden">
        <div 
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-yellow-600 to-orange-600 animate-pulse"
          style={{ 
            width: `${((activeGame.attempts_count || 0) / activeGame.max_attempts) * 100}%`,
            transition: 'width 0.5s ease'
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