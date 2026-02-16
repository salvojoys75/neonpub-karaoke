// ============================================================
// 🎮 ARCADE PANEL - Sezione Arcade per AdminDashboard
// Da integrare come nuovo tab in AdminDashboard.js
// ============================================================

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Play, Square, Check, X, Music, Trophy, 
  Clock, Users, Zap, AlertCircle, Pause 
} from 'lucide-react';
import { toast } from 'sonner';
import * as api from '@/lib/api';

// ============================================================
// COMPONENTE PRINCIPALE
// ============================================================

export default function ArcadePanel({ 
  quizCatalog = [], // Catalogo quiz esistente (con Spotify/YouTube)
  onRefresh 
}) {
  const [activeGame, setActiveGame] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [currentBooking, setCurrentBooking] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // Setup nuovo gioco
  const [showSetup, setShowSetup] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Filtro catalogo
  const [filteredTracks, setFilteredTracks] = useState([]);

  // ============================================================
  // CARICAMENTO DATI
  // ============================================================

  useEffect(() => {
    loadArcadeData();
    
    // Polling ogni 2 secondi per aggiornamenti real-time
    const interval = setInterval(loadArcadeData, 2000);
    return () => clearInterval(interval);
  }, []);

  const loadArcadeData = async () => {
    try {
      // Carica gioco attivo
      const { data: game } = await api.getActiveArcadeGame();
      setActiveGame(game);
      
      // Se c'è un gioco attivo, carica le prenotazioni
      if (game) {
        const { data: allBookings } = await api.getArcadeBookings(game.id);
        setBookings(allBookings || []);
        
        // Trova la prenotazione corrente (pending)
        const { data: current } = await api.getCurrentBooking(game.id);
        setCurrentBooking(current);
      } else {
        setBookings([]);
        setCurrentBooking(null);
      }
    } catch (error) {
      console.error('Errore caricamento arcade:', error);
    }
  };

  // ============================================================
  // GESTIONE NUOVO GIOCO
  // ============================================================

  useEffect(() => {
    // Filtra catalogo quando cambia la ricerca
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const filtered = quizCatalog.filter(q => 
        q.question?.toLowerCase().includes(query) ||
        q.category?.toLowerCase().includes(query) ||
        (q.media_url && q.media_type === 'spotify')
      );
      setFilteredTracks(filtered.slice(0, 20)); // Max 20 risultati
    } else {
      // Mostra solo tracce con media (Spotify/YouTube)
      setFilteredTracks(
        quizCatalog
          .filter(q => q.media_url && (q.media_type === 'spotify' || q.media_type === 'audio'))
          .slice(0, 20)
      );
    }
  }, [searchQuery, quizCatalog]);

  const handleCreateGame = async () => {
    if (!selectedTrack) {
      toast.error('Seleziona una traccia!');
      return;
    }

    setLoading(true);
    try {
      // Estrai titolo dalla domanda (es: "Indovina questa canzone" → usa opzione corretta)
      const correctAnswer = selectedTrack.options[selectedTrack.correct_index];
      
      const { data } = await api.createArcadeGame({
        gameType: 'song_guess',
        trackId: selectedTrack.media_url,
        trackTitle: correctAnswer, // Titolo corretto dalla risposta
        trackArtist: '', // Non abbiamo artist nel catalogo, usa vuoto
        trackUrl: selectedTrack.media_url,
        correctAnswer: correctAnswer.toLowerCase().trim(),
        pointsReward: selectedTrack.points || 100,
        maxAttempts: 5,
        penaltySeconds: 10,
        mediaType: selectedTrack.media_type === 'spotify' ? 'spotify' : 'youtube',
        category: selectedTrack.category || 'Generale'
      });

      toast.success('Gioco creato!');
      setActiveGame(data);
      setShowSetup(false);
      setSelectedTrack(null);
      setSearchQuery('');
      
      // Avvia automaticamente
      await handleStartGame(data.id);
    } catch (error) {
      console.error('Errore creazione gioco:', error);
      toast.error('Errore: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // CONTROLLI GIOCO
  // ============================================================

  const handleStartGame = async (gameId) => {
    try {
      await api.startArcadeGame(gameId || activeGame.id);
      toast.success('🎮 Gioco avviato!');
      loadArcadeData();
    } catch (error) {
      toast.error('Errore: ' + error.message);
    }
  };

  const handlePauseGame = async () => {
    try {
      await api.pauseArcadeGame(activeGame.id);
      toast.info('⏸️ Gioco in pausa');
      loadArcadeData();
    } catch (error) {
      toast.error('Errore: ' + error.message);
    }
  };

  const handleResumeGame = async () => {
    try {
      await api.resumeArcadeGame(activeGame.id);
      toast.success('▶️ Gioco ripreso!');
      loadArcadeData();
    } catch (error) {
      toast.error('Errore: ' + error.message);
    }
  };

  const handleEndGame = async () => {
    if (!confirm('Terminare il gioco?')) return;
    
    try {
      await api.endArcadeGame(activeGame.id);
      toast.info('🛑 Gioco terminato');
      setActiveGame(null);
      setBookings([]);
      setCurrentBooking(null);
    } catch (error) {
      toast.error('Errore: ' + error.message);
    }
  };

  // ============================================================
  // VALIDAZIONE RISPOSTA
  // ============================================================

  const handleValidate = async (isCorrect) => {
    if (!currentBooking) return;

    try {
      const { data, isCorrect: validated } = await api.validateArcadeAnswer(
        currentBooking.id,
        isCorrect,
        null // givenAnswer - opzionale, l'operatore ascolta a voce
      );

      if (validated) {
        toast.success(`🎉 ${currentBooking.participants.nickname} ha vinto!`);
      } else {
        toast.error(`❌ Risposta sbagliata`);
      }

      // Ricarica dati
      setTimeout(loadArcadeData, 500);
    } catch (error) {
      console.error('Errore validazione:', error);
      toast.error('Errore: ' + error.message);
    }
  };

  // ============================================================
  // RENDER: NESSUN GIOCO ATTIVO
  // ============================================================

  if (!activeGame) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-zinc-400 uppercase flex items-center gap-2">
            <Trophy className="w-4 h-4 text-yellow-500" />
            Arcade - Indovina la Canzone
          </h3>
          <Button
            size="sm"
            onClick={() => setShowSetup(!showSetup)}
            className="bg-green-600 hover:bg-green-500 h-8"
          >
            <Play className="w-3 h-3 mr-1" />
            Nuovo Gioco
          </Button>
        </div>

        {showSetup ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-3">
            <div>
              <label className="text-xs text-zinc-500 mb-2 block">Cerca Traccia</label>
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cerca per titolo o categoria..."
                className="bg-zinc-950 border-zinc-700 text-sm"
              />
            </div>

            <ScrollArea className="h-64 border border-zinc-800 rounded">
              <div className="space-y-1 p-2">
                {filteredTracks.length === 0 ? (
                  <div className="text-center py-8 text-zinc-600 text-sm">
                    Nessuna traccia trovata
                  </div>
                ) : (
                  filteredTracks.map((track) => (
                    <button
                      key={track.id}
                      onClick={() => setSelectedTrack(track)}
                      className={`w-full text-left p-2 rounded text-sm transition-all ${
                        selectedTrack?.id === track.id
                          ? 'bg-fuchsia-900/30 border-2 border-fuchsia-600'
                          : 'bg-zinc-800 hover:bg-zinc-700 border-2 border-transparent'
                      }`}
                    >
                      <div className="font-bold text-white truncate">
                        {track.options[track.correct_index]}
                      </div>
                      <div className="text-xs text-zinc-500">
                        {track.category} • {track.points || 100} punti
                      </div>
                    </button>
                  ))
                )}
              </div>
            </ScrollArea>

            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowSetup(false);
                  setSelectedTrack(null);
                }}
                className="flex-1"
              >
                Annulla
              </Button>
              <Button
                size="sm"
                onClick={handleCreateGame}
                disabled={!selectedTrack || loading}
                className="flex-1 bg-green-600 hover:bg-green-500"
              >
                {loading ? 'Creazione...' : 'Crea & Avvia'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 text-zinc-600">
            <Trophy className="w-16 h-16 mx-auto mb-4 opacity-20" />
            <p className="text-sm">Nessun gioco attivo</p>
            <p className="text-xs text-zinc-700 mt-1">Clicca "Nuovo Gioco" per iniziare</p>
          </div>
        )}
      </div>
    );
  }

  // ============================================================
  // RENDER: GIOCO ATTIVO
  // ============================================================

  const pendingBookings = bookings.filter(b => b.status === 'pending');
  const completedBookings = bookings.filter(b => b.status !== 'pending');

  return (
    <div className="space-y-4">
      {/* HEADER */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full animate-pulse ${
              activeGame.status === 'active' ? 'bg-green-500' :
              activeGame.status === 'paused' ? 'bg-yellow-500' :
              'bg-zinc-600'
            }`} />
            <span className="text-xs uppercase font-bold text-zinc-400">
              {activeGame.status === 'active' ? '🔴 IN ONDA' :
               activeGame.status === 'paused' ? '⏸️ IN PAUSA' :
               '⏳ IN ATTESA'}
            </span>
          </div>
          
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <Users className="w-3 h-3" />
            {bookings.length} tentativi
          </div>
        </div>

        <div className="text-lg font-bold text-white mb-1">
          {activeGame.track_title}
        </div>
        <div className="text-sm text-zinc-400 flex items-center gap-4">
          <span>🎵 {activeGame.media_type === 'spotify' ? 'Spotify' : 'YouTube'}</span>
          <span>🏆 {activeGame.points_reward} punti</span>
          <span>🎯 {activeGame.attempts_count}/{activeGame.max_attempts} tentativi</span>
        </div>
      </div>

      {/* PRENOTAZIONE CORRENTE */}
      {currentBooking ? (
        <div className="bg-fuchsia-900/20 border-2 border-fuchsia-600 rounded-lg p-4">
          <div className="text-xs uppercase font-bold text-fuchsia-400 mb-3 flex items-center gap-2">
            <Zap className="w-4 h-4" />
            AL MICROFONO
          </div>

          <div className="flex items-center gap-4 mb-4">
            {currentBooking.participants.avatar_url && (
              <img
                src={currentBooking.participants.avatar_url}
                alt="avatar"
                className="w-16 h-16 rounded-full border-2 border-fuchsia-500"
              />
            )}
            <div className="flex-1">
              <div className="text-2xl font-black text-white">
                {currentBooking.participants.nickname}
              </div>
              <div className="text-xs text-zinc-400">
                Prenotato {Math.floor((new Date() - new Date(currentBooking.booked_at)) / 1000)}s fa
              </div>
            </div>
          </div>

          <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 mb-4">
            <div className="text-xs text-zinc-500 mb-1">Risposta Corretta:</div>
            <div className="text-lg font-bold text-green-400">
              {activeGame.correct_answer}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button
              size="lg"
              onClick={() => handleValidate(false)}
              className="bg-red-600 hover:bg-red-500 h-14 text-lg font-bold"
            >
              <X className="w-6 h-6 mr-2" />
              SBAGLIATO
            </Button>
            <Button
              size="lg"
              onClick={() => handleValidate(true)}
              className="bg-green-600 hover:bg-green-500 h-14 text-lg font-bold"
            >
              <Check className="w-6 h-6 mr-2" />
              CORRETTO
            </Button>
          </div>
        </div>
      ) : activeGame.status === 'active' ? (
        <div className="bg-yellow-900/20 border border-yellow-600 rounded-lg p-4 text-center">
          <AlertCircle className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
          <div className="text-sm font-bold text-yellow-400">
            In attesa di prenotazioni...
          </div>
          <div className="text-xs text-zinc-500 mt-1">
            I partecipanti possono prenotarsi dall'app
          </div>
        </div>
      ) : null}

      {/* CRONOLOGIA PRENOTAZIONI */}
      {completedBookings.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
          <div className="text-xs uppercase font-bold text-zinc-500 mb-2">
            📜 Cronologia
          </div>
          <ScrollArea className="h-32">
            <div className="space-y-1">
              {completedBookings.map((booking, idx) => (
                <div
                  key={booking.id}
                  className={`flex items-center justify-between p-2 rounded text-sm ${
                    booking.status === 'correct'
                      ? 'bg-green-900/20 text-green-400'
                      : 'bg-red-900/20 text-red-400'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs">{booking.booking_order}.</span>
                    <span>{booking.participants.nickname}</span>
                  </div>
                  <span className="text-xs">
                    {booking.status === 'correct' ? '✅' : '❌'}
                  </span>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* CONTROLLI */}
      <div className="flex gap-2">
        {activeGame.status === 'active' ? (
          <Button
            size="sm"
            variant="outline"
            onClick={handlePauseGame}
            className="flex-1"
          >
            <Pause className="w-3 h-3 mr-1" />
            Pausa
          </Button>
        ) : activeGame.status === 'paused' ? (
          <Button
            size="sm"
            onClick={handleResumeGame}
            className="flex-1 bg-green-600"
          >
            <Play className="w-3 h-3 mr-1" />
            Riprendi
          </Button>
        ) : null}
        
        <Button
          size="sm"
          variant="destructive"
          onClick={handleEndGame}
          className="flex-1"
        >
          <Square className="w-3 h-3 mr-1" />
          Termina Gioco
        </Button>
      </div>
    </div>
  );
}