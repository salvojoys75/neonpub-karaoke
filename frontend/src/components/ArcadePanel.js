// ============================================================
// 🎮 ARCADE PANEL - Sezione Arcade per AdminDashboard
// ============================================================

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Play, Square, Check, X, Trophy,
  Users, Zap, AlertCircle, Pause, Volume2, VolumeX, RotateCcw
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase'; // ✅ IMPORTANTE: Importiamo supabase per archiviare
import * as api from '@/lib/api';

export default function ArcadePanel({
  quizCatalog = [],
  onRefresh
}) {
  const [activeGame, setActiveGame] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [currentBooking, setCurrentBooking] = useState(null);
  const [loading, setLoading] = useState(false);

  // Player
  const [isPlayerVisible, setIsPlayerVisible] = useState(true);
  const [newBookingAlert, setNewBookingAlert] = useState(false);
  const prevBookingIdRef = useRef(null);
  
  // Lista di ID giochi da ignorare localmente mentre il DB si aggiorna
  const ignoredGamesRef = useRef(new Set());

  // Setup nuovo gioco
  const [showSetup, setShowSetup] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredTracks, setFilteredTracks] = useState([]);

  // ============================================================
  // CARICAMENTO DATI
  // ============================================================

  useEffect(() => {
    loadArcadeData();
    const interval = setInterval(loadArcadeData, 2000);
    return () => clearInterval(interval);
  }, []);

  const loadArcadeData = async () => {
    try {
      const { data: game } = await api.getActiveArcadeGame();
      
      // Se il gioco è nella lista ignorati o è archiviato, resettiamo la vista locale
      if (game && (ignoredGamesRef.current.has(game.id) || game.status === 'archived')) {
          setActiveGame(null);
          setBookings([]);
          setCurrentBooking(null);
          return;
      }

      setActiveGame(game);

      if (game && game.status !== 'ended') {
        const { data: allBookings } = await api.getArcadeBookings(game.id);
        setBookings(allBookings || []);

        const { data: current } = await api.getCurrentBooking(game.id);

        if (current && current.id !== prevBookingIdRef.current) {
          prevBookingIdRef.current = current.id;
          setIsPlayerVisible(false);
          setNewBookingAlert(true);
          toast.info(`🎤 ${current.participants?.nickname} si è prenotato!`);
        }

        if (!current && prevBookingIdRef.current !== null) {
          prevBookingIdRef.current = null;
          setNewBookingAlert(false);
        }

        setCurrentBooking(current);
      } else {
        // Se è ended
        setBookings([]);
        setCurrentBooking(null);
        prevBookingIdRef.current = null;
        setNewBookingAlert(false);
      }
    } catch (error) {
      console.error('Errore caricamento arcade:', error);
    }
  };

  // ============================================================
  // FILTRO CATALOGO
  // ============================================================

  useEffect(() => {
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const filtered = quizCatalog.filter(q =>
        q.question?.toLowerCase().includes(query) ||
        q.category?.toLowerCase().includes(query) ||
        (q.media_url && q.media_type === 'spotify')
      );
      setFilteredTracks(filtered.slice(0, 20));
    } else {
      setFilteredTracks(
        quizCatalog
          .filter(q => q.media_url && (q.media_type === 'spotify' || q.media_type === 'audio'))
          .slice(0, 20)
      );
    }
  }, [searchQuery, quizCatalog]);

  // ============================================================
  // CREA GIOCO
  // ============================================================

  const handleCreateGame = async () => {
    if (!selectedTrack) { toast.error('Seleziona una traccia!'); return; }
    setLoading(true);

    try {
      const correctAnswer = selectedTrack.options[selectedTrack.correct_index];

      const { data } = await api.createArcadeGame({
        gameType: 'song_guess',
        trackId: selectedTrack.media_url,
        trackTitle: correctAnswer,
        trackArtist: '',
        trackUrl: selectedTrack.media_url,
        correctAnswer: correctAnswer.toLowerCase().trim(),
        pointsReward: selectedTrack.points || 100,
        maxAttempts: 5,
        penaltySeconds: 10,
        mediaType: selectedTrack.media_type === 'spotify' ? 'spotify' : 'youtube',
        category: selectedTrack.category || 'Generale',
        question: selectedTrack.question || 'Indovina la canzone!',
        options: selectedTrack.options || []
      });

      setActiveGame(data);
      setShowSetup(false);
      setSelectedTrack(null);
      setSearchQuery('');
      setIsPlayerVisible(true); // Reset player

      await handleStartGame(data.id);
      toast.success('🎮 Gioco avviato!');
    } catch (error) {
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
      loadArcadeData();
    } catch (error) { toast.error('Errore: ' + error.message); }
  };

  const handlePauseGame = async () => {
    try {
      await api.pauseArcadeGame(activeGame.id);
      setIsPlayerVisible(false);
      toast.info('⏸️ Gioco in pausa');
      loadArcadeData();
    } catch (error) { toast.error('Errore: ' + error.message); }
  };

  const handleResumeGame = async () => {
    try {
      await api.resumeArcadeGame(activeGame.id);
      setIsPlayerVisible(true);
      setNewBookingAlert(false);
      toast.success('▶️ Gioco ripreso!');
      loadArcadeData();
    } catch (error) { toast.error('Errore: ' + error.message); }
  };

  const handleEndGame = async () => {
    if (!confirm('Terminare il gioco?')) return;
    try {
      await api.endArcadeGame(activeGame.id);
      toast.info('🛑 Gioco terminato');
      
      setActiveGame(null); 
      setBookings([]);
      setCurrentBooking(null);
      setIsPlayerVisible(true);
      setNewBookingAlert(false);
      prevBookingIdRef.current = null;
    } catch (error) { toast.error('Errore: ' + error.message); }
  };

  // ✅ FIX DEFINITIVO: Archivia il gioco nel DB per nasconderlo dal Display
  const handleCloseEndedGame = async () => {
      if (activeGame?.id) {
          // 1. Ignoralo subito localmente per feedback istantaneo
          ignoredGamesRef.current.add(activeGame.id);
          setActiveGame(null);
          setBookings([]);
          setCurrentBooking(null);

          try {
              // 2. Aggiorna il DB: status 'archived' fa sparire il gioco dal Display
              const { error } = await supabase
                  .from('arcade_games')
                  .update({ status: 'archived' })
                  .eq('id', activeGame.id);
              
              if (error) throw error;
              toast.success("Schermata vincitore chiusa!");
          } catch (e) {
              console.error("Errore archiviazione:", e);
              // Fallback se 'archived' non è un enum valido: usiamo un flag o delete
              toast.error("Errore chiusura remota, riprova.");
          }
      }
  };

  // ============================================================
  // VALIDAZIONE RISPOSTA
  // ============================================================

  const handleValidate = async (isCorrect) => {
    if (!currentBooking) return;
    try {
      await api.validateArcadeAnswer(currentBooking.id, isCorrect, null);

      if (isCorrect) {
        toast.success(`🎉 ${currentBooking.participants?.nickname} ha vinto!`);
        setIsPlayerVisible(false);
        setNewBookingAlert(false);
      } else {
        toast.error('❌ Risposta sbagliata');
        setNewBookingAlert(false);
        prevBookingIdRef.current = null;
      }

      setTimeout(loadArcadeData, 500);
    } catch (error) {
      toast.error('Errore: ' + error.message);
    }
  };

  // ============================================================
  // HELPER PLAYER
  // ============================================================

  const getSpotifyEmbedUrl = (url) => {
    if (!url) return null;
    const match = url.match(/(?:track\/)([a-zA-Z0-9]+)/);
    const id = match ? match[1] : (/^[a-zA-Z0-9]{22}$/.test(url) ? url : null);
    if (!id) return null;
    return `https://open.spotify.com/embed/track/${id}?utm_source=generator&theme=0`;
  };

  const getYoutubeEmbedUrl = (url) => {
    if (!url) return null;
    const match = url.match(/(?:youtu\.be\/|v\/|watch\?v=|&v=)([^#&?]{11})/);
    return match ? `https://www.youtube.com/embed/${match[1]}?controls=1` : null;
  };

  const renderPlayer = (game) => {
    if (!game?.track_url) return null;

    const spotifyUrl = getSpotifyEmbedUrl(game.track_url);
    const youtubeUrl = getYoutubeEmbedUrl(game.track_url);

    return (
      <div className={`mb-3 rounded-lg overflow-hidden border transition-all duration-300 ${
        newBookingAlert
          ? 'border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.5)]'
          : 'border-zinc-700'
      }`}>
        <div className={`flex items-center justify-between px-3 py-2 text-xs font-bold uppercase tracking-widest ${
          newBookingAlert ? 'bg-red-900/40 text-red-400' : 'bg-zinc-900 text-zinc-400'
        }`}>
          <div className="flex items-center gap-2">
            {isPlayerVisible
              ? <Volume2 className="w-3 h-3 text-green-400" />
              : <VolumeX className="w-3 h-3 text-red-400" />
            }
            <span>{isPlayerVisible ? 'MUSICA IN RIPRODUZIONE' : newBookingAlert ? '⚡ PRENOTAZIONE ARRIVATA — MUSICA FERMA' : 'MUSICA FERMA'}</span>
          </div>
          <button
            onClick={() => {
              setIsPlayerVisible(!isPlayerVisible);
              if (!isPlayerVisible) setNewBookingAlert(false);
            }}
            className="text-zinc-500 hover:text-white transition text-[10px] underline"
          >
            {isPlayerVisible ? 'ferma' : 'riavvia'}
          </button>
        </div>

        {isPlayerVisible && (
          <div>
            {spotifyUrl ? (
              <iframe
                key={spotifyUrl}
                src={spotifyUrl}
                width="100%"
                height="80"
                frameBorder="0"
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                className="block"
              />
            ) : youtubeUrl ? (
              <div className="relative w-full" style={{ paddingTop: '30%' }}>
                <iframe
                  key={youtubeUrl}
                  src={youtubeUrl}
                  className="absolute top-0 left-0 w-full h-full"
                  frameBorder="0"
                  allow="autoplay; encrypted-media"
                  allowFullScreen
                />
              </div>
            ) : (
              <div className="text-xs text-zinc-500 text-center py-3">
                URL non riconosciuto: {game.track_url}
              </div>
            )}
          </div>
        )}

        {!isPlayerVisible && (
          <div className="bg-zinc-950 p-6 text-center border-t border-zinc-800">
            <VolumeX className="w-10 h-10 mx-auto text-zinc-700 mb-2" />
            <p className="text-zinc-600 text-sm font-bold mb-1">🎵 Player Fermato</p>
            <p className="text-zinc-700 text-xs">Click "riavvia" o "RIPRENDI MUSICA" per ripartire</p>
          </div>
        )}
      </div>
    );
  };

  // ============================================================
  // RENDER: NESSUN GIOCO ATTIVO (o GIOCO ENDED che vogliamo resettare)
  // ============================================================

  if (activeGame && activeGame.status === 'ended') {
      return (
          <div className="space-y-4">
               <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-6 text-center">
                   <Trophy className="w-12 h-12 text-yellow-500 mx-auto mb-3 opacity-50"/>
                   <h3 className="text-lg font-bold text-white mb-1">Gioco Terminato</h3>
                   <p className="text-sm text-zinc-500 mb-4">La sessione precedente "{activeGame.track_title}" è finita.</p>
                   
                   <Button 
                     onClick={handleCloseEndedGame}
                     className="bg-red-600 hover:bg-red-500 font-bold w-full h-12"
                   >
                     <RotateCcw className="w-5 h-5 mr-2"/> CHIUDI E APRI NUOVO GIOCO
                   </Button>
               </div>
          </div>
      );
  }

  if (!activeGame) {
    const previewGame = selectedTrack ? {
      id: 'preview',
      track_url: selectedTrack.media_url,
      track_title: selectedTrack.options[selectedTrack.correct_index]
    } : null;

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

        {previewGame && renderPlayer(previewGame)}

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
                    Nessuna traccia trovata.<br/>
                    <span className="text-xs text-zinc-700">Assicurati che le domande abbiano media_type spotify o audio</span>
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
                        {track.category} • {track.points || 100} punti • {track.media_type}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </ScrollArea>

            {selectedTrack && (
              <div className="bg-fuchsia-900/20 border border-fuchsia-600 rounded-lg p-3">
                <div className="text-xs text-fuchsia-400 uppercase tracking-wider mb-1">Traccia Selezionata:</div>
                <div className="font-bold text-white text-sm">{selectedTrack.options[selectedTrack.correct_index]}</div>
                <div className="text-xs text-zinc-500 mt-1">{selectedTrack.category} • {selectedTrack.points || 100} punti</div>
                <div className="mt-2 pt-2 border-t border-fuchsia-800">
                  <p className="text-xs text-fuchsia-300">
                    💡 Fai PLAY sul player Spotify sopra prima di cliccare "Crea & Avvia"
                  </p>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setShowSetup(false); setSelectedTrack(null); }}
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
    <div className="space-y-3">

      {/* HEADER STATO */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full animate-pulse ${
              activeGame.status === 'active' ? 'bg-green-500' :
              activeGame.status === 'paused' ? 'bg-yellow-500' :
              'bg-zinc-600'
            }`} />
            <span className="text-xs uppercase font-bold text-zinc-400">
              {activeGame.status === 'active' ? '🔴 IN ONDA' :
               activeGame.status === 'paused' ? '⏸️ IN PAUSA' : '⏳'}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <Users className="w-3 h-3" />
            {bookings.length} tentativi • 🏆 {activeGame.points_reward}pt • 🎯 {activeGame.attempts_count || 0}/{activeGame.max_attempts}
          </div>
        </div>
        <div className="text-sm font-bold text-white truncate">{activeGame.track_title}</div>
        <div className="text-xs text-green-400 mt-1 font-mono">
          Risposta: {activeGame.correct_answer}
        </div>
      </div>

      {/* PLAYER */}
      {renderPlayer(activeGame)}

      {/* PRENOTAZIONE CORRENTE */}
      {currentBooking ? (
        <div className={`border-2 rounded-lg p-3 transition-all ${
          newBookingAlert ? 'bg-red-900/20 border-red-500 animate-pulse' : 'bg-fuchsia-900/20 border-fuchsia-600'
        }`}>
          <div className="text-xs uppercase font-bold text-fuchsia-400 mb-2 flex items-center gap-2">
            <Zap className="w-4 h-4" />
            AL MICROFONO
          </div>

          <div className="flex items-center gap-3 mb-3">
            {currentBooking.participants?.avatar_url && (
              <img
                src={currentBooking.participants.avatar_url}
                alt="avatar"
                className="w-12 h-12 rounded-full border-2 border-fuchsia-500"
              />
            )}
            <div className="flex-1">
              <div className="text-xl font-black text-white">
                {currentBooking.participants?.nickname}
              </div>
              <div className="text-xs text-zinc-400">
                Prenotato {Math.floor((new Date() - new Date(currentBooking.booked_at)) / 1000)}s fa
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              size="lg"
              onClick={() => handleValidate(false)}
              className="bg-red-600 hover:bg-red-500 h-12 text-base font-bold"
            >
              <X className="w-5 h-5 mr-1" /> SBAGLIATO
            </Button>
            <Button
              size="lg"
              onClick={() => handleValidate(true)}
              className="bg-green-600 hover:bg-green-500 h-12 text-base font-bold"
            >
              <Check className="w-5 h-5 mr-1" /> CORRETTO
            </Button>
          </div>
        </div>
      ) : activeGame.status === 'active' ? (
        <div className="bg-yellow-900/20 border border-yellow-600 rounded-lg p-3 text-center">
          <AlertCircle className="w-6 h-6 text-yellow-500 mx-auto mb-1" />
          <div className="text-sm font-bold text-yellow-400">In attesa di prenotazioni...</div>
          <div className="text-xs text-zinc-500 mt-1">
            La musica sta suonando — i partecipanti possono prenotarsi dall'app
          </div>
        </div>
      ) : null}

      {/* CRONOLOGIA */}
      {completedBookings.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
          <div className="text-xs uppercase font-bold text-zinc-500 mb-2">📜 Cronologia</div>
          <ScrollArea className="h-28">
            <div className="space-y-1">
              {completedBookings.map((booking) => (
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
                    <span>{booking.participants?.nickname}</span>
                  </div>
                  <span>{booking.status === 'correct' ? '✅' : '❌'}</span>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* CONTROLLI */}
      <div className="flex gap-2">
        {!isPlayerVisible && activeGame.status === 'active' && (
          <Button
            size="sm"
            onClick={() => {
              setIsPlayerVisible(true);
              setNewBookingAlert(false);
              toast.success('▶️ Musica ripresa!');
            }}
            className="flex-1 bg-green-600 hover:bg-green-500 font-bold"
          >
            <Play className="w-3 h-3 mr-1" /> RIPRENDI MUSICA
          </Button>
        )}

        {activeGame.status === 'active' ? (
          <Button size="sm" variant="outline" onClick={handlePauseGame} className="flex-1">
            <Pause className="w-3 h-3 mr-1" /> Pausa
          </Button>
        ) : activeGame.status === 'paused' ? (
          <Button size="sm" onClick={handleResumeGame} className="flex-1 bg-green-600">
            <Play className="w-3 h-3 mr-1" /> Riprendi
          </Button>
        ) : null}

        <Button size="sm" variant="destructive" onClick={handleEndGame} className="flex-1">
          <Square className="w-3 h-3 mr-1" /> Termina
        </Button>
      </div>
    </div>
  );
}