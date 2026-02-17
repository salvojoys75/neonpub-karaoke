// ============================================================
// 🎮 ARCADE PANEL - Sezione Arcade per AdminDashboard
// ============================================================

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Play, Square, Check, X, Trophy, 
  Users, Zap, AlertCircle, Pause, Volume2, VolumeX
} from 'lucide-react';
import { toast } from 'sonner';
import * as api from '@/lib/api';

export default function ArcadePanel({ 
  quizCatalog = [],
  onRefresh 
}) {
  const [activeGame, setActiveGame] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [currentBooking, setCurrentBooking] = useState(null);
  const [loading, setLoading] = useState(false);
  
  const [isPlayerVisible, setIsPlayerVisible] = useState(true);
  const [newBookingAlert, setNewBookingAlert] = useState(false);
  const prevBookingIdRef = useRef(null);

  const [showSetup, setShowSetup] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredTracks, setFilteredTracks] = useState([]);

  useEffect(() => {
    loadArcadeData();
    const interval = setInterval(loadArcadeData, 2000);
    return () => clearInterval(interval);
  }, []);

  const loadArcadeData = async () => {
    try {
      const { data: game } = await api.getActiveArcadeGame();
      setActiveGame(game);
      
      if (game) {
        const { data: allBookings } = await api.getArcadeBookings(game.id);
        setBookings(allBookings || []);
        const { data: current } = await api.getCurrentBooking(game.id);
        
        if (current && current.id !== prevBookingIdRef.current) {
          prevBookingIdRef.current = current.id;
          setIsPlayerVisible(false); 
          setNewBookingAlert(true);
          toast.info(`🎤 ${current.participants?.nickname} si è prenotato!`);
        }
        setCurrentBooking(current);
      } else {
        setBookings([]);
        setCurrentBooking(null);
        prevBookingIdRef.current = null;
        setNewBookingAlert(false);
      }
    } catch (error) { console.error(error); }
  };

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
        quizCatalog.filter(q => q.media_url && (q.media_type === 'spotify' || q.media_type === 'audio')).slice(0, 20)
      );
    }
  }, [searchQuery, quizCatalog]);

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
      await api.startArcadeGame(data.id);
      toast.success('🎮 Gioco avviato!');
    } catch (error) { toast.error('Errore: ' + error.message); } finally { setLoading(false); }
  };

  const handleStartGame = async () => { await api.startArcadeGame(activeGame.id); toast.success('🎮 Gioco avviato!'); loadArcadeData(); };
  const handlePauseGame = async () => { await api.pauseArcadeGame(activeGame.id); setIsPlayerVisible(false); toast.info('⏸️ Gioco in pausa'); loadArcadeData(); };
  const handleResumeGame = async () => { await api.resumeArcadeGame(activeGame.id); setIsPlayerVisible(true); setNewBookingAlert(false); toast.success('▶️ Gioco ripreso!'); loadArcadeData(); };
  
  // FIX: Se il gioco è già ended (es. qualcuno ha vinto), non chiamare endArcadeGame che resetta il timer
  const handleEndGame = async () => {
    if (!confirm('Chiudere il gioco?')) return;
    try {
      // Se non è già finito, lo chiudiamo
      if (activeGame?.status !== 'ended') {
          await api.endArcadeGame(activeGame.id);
      }
      toast.info('🛑 Gioco chiuso');
      setActiveGame(null);
      setBookings([]);
      setCurrentBooking(null);
      setIsPlayerVisible(true);
      setNewBookingAlert(false);
      prevBookingIdRef.current = null;
    } catch (error) { toast.error('Errore: ' + error.message); }
  };

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
      }
      setTimeout(loadArcadeData, 500);
    } catch (error) { toast.error('Errore: ' + error.message); }
  };

  const getSpotifyEmbedUrl = (url) => {
    if (!url) return null;
    const match = url.match(/(?:track\/)([a-zA-Z0-9]+)/);
    const id = match ? match[1] : (/^[a-zA-Z0-9]{22}$/.test(url) ? url : null);
    return id ? `https://open.spotify.com/embed/track/${id}?utm_source=generator&theme=0` : null;
  };

  const renderPlayer = (game) => {
    if (!game?.track_url) return null;
    const spotifyUrl = getSpotifyEmbedUrl(game.track_url);
    return (
      <div className={`mb-3 rounded-lg overflow-hidden border transition-all duration-300 ${newBookingAlert ? 'border-red-500 shadow-red-500/50 shadow-lg' : 'border-zinc-700'}`}>
        <div className={`flex items-center justify-between px-3 py-2 text-xs font-bold uppercase tracking-widest ${newBookingAlert ? 'bg-red-900/40 text-red-400' : 'bg-zinc-900 text-zinc-400'}`}>
          <div className="flex items-center gap-2">
            {isPlayerVisible ? <Volume2 className="w-3 h-3 text-green-400" /> : <VolumeX className="w-3 h-3 text-red-400" />}
            <span>{isPlayerVisible ? 'MUSICA IN RIPRODUZIONE' : 'MUSICA FERMA'}</span>
          </div>
          <button onClick={() => { setIsPlayerVisible(!isPlayerVisible); if(!isPlayerVisible) setNewBookingAlert(false); }} className="text-zinc-500 hover:text-white underline">
            {isPlayerVisible ? 'ferma' : 'riavvia'}
          </button>
        </div>
        {isPlayerVisible && spotifyUrl && (
          <iframe key={spotifyUrl} src={spotifyUrl} width="100%" height="80" frameBorder="0" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" className="block" />
        )}
        {!isPlayerVisible && (
          <div className="bg-zinc-950 p-6 text-center border-t border-zinc-800">
            <VolumeX className="w-10 h-10 mx-auto text-zinc-700 mb-2" />
            <p className="text-zinc-600 text-sm font-bold">🎵 Player Fermato</p>
          </div>
        )}
      </div>
    );
  };

  if (!activeGame) {
    const previewGame = selectedTrack ? { id: 'preview', track_url: selectedTrack.media_url } : null;
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-zinc-400 uppercase flex items-center gap-2"><Trophy className="w-4 h-4 text-yellow-500" /> Arcade</h3>
          <Button size="sm" onClick={() => setShowSetup(!showSetup)} className="bg-green-600 hover:bg-green-500 h-8"><Play className="w-3 h-3 mr-1" /> Nuovo Gioco</Button>
        </div>
        {previewGame && renderPlayer(previewGame)}
        {showSetup ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-3">
            <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Cerca brano..." className="bg-zinc-950 border-zinc-700 text-sm" />
            <ScrollArea className="h-64 border border-zinc-800 rounded">
              <div className="space-y-1 p-2">
                {filteredTracks.map((track) => (
                  <button key={track.id} onClick={() => setSelectedTrack(track)} className={`w-full text-left p-2 rounded text-sm ${selectedTrack?.id === track.id ? 'bg-fuchsia-900/30 border border-fuchsia-600' : 'bg-zinc-800 border border-transparent'}`}>
                    <div className="font-bold text-white truncate">{track.options[track.correct_index]}</div>
                    <div className="text-xs text-zinc-500">{track.category}</div>
                  </button>
                ))}
              </div>
            </ScrollArea>
            <Button size="sm" onClick={handleCreateGame} disabled={!selectedTrack || loading} className="w-full bg-green-600">{loading ? '...' : 'Crea & Avvia'}</Button>
          </div>
        ) : (
          <div className="text-center py-12 text-zinc-600"><p className="text-sm">Nessun gioco attivo</p></div>
        )}
      </div>
    );
  }

  const completedBookings = bookings.filter(b => b.status !== 'pending');

  return (
    <div className="space-y-3">
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
        <div className="flex justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full animate-pulse ${activeGame.status === 'active' ? 'bg-green-500' : activeGame.status === 'paused' ? 'bg-yellow-500' : 'bg-red-500'}`} />
            <span className="text-xs uppercase font-bold text-zinc-400">{activeGame.status === 'active' ? 'IN ONDA' : activeGame.status === 'ended' ? 'TERMINATO' : 'PAUSA'}</span>
          </div>
          <div className="text-xs text-zinc-500"><Users className="w-3 h-3 inline mr-1"/>{bookings.length}</div>
        </div>
        <div className="text-sm font-bold text-white truncate">{activeGame.track_title}</div>
        <div className="text-xs text-green-400 mt-1 font-mono">Risposta: {activeGame.correct_answer}</div>
      </div>

      {/* Se il gioco è finito, non mostrare il player o i controlli di validazione, ma solo la cronologia e il tasto termina */}
      {activeGame.status !== 'ended' && renderPlayer(activeGame)}

      {activeGame.status === 'ended' && (
          <div className="bg-green-900/20 border border-green-500 p-4 rounded-lg text-center animate-in zoom-in">
              <Trophy className="w-12 h-12 text-yellow-400 mx-auto mb-2"/>
              <h3 className="text-xl font-bold text-white">VINCITORE!</h3>
              <p className="text-zinc-400 text-xs">Il display sta mostrando la schermata vincitore</p>
          </div>
      )}

      {currentBooking && activeGame.status !== 'ended' && (
        <div className={`border-2 rounded-lg p-3 transition-all ${newBookingAlert ? 'bg-red-900/20 border-red-500 animate-pulse' : 'bg-fuchsia-900/20 border-fuchsia-600'}`}>
          <div className="text-xs uppercase font-bold text-fuchsia-400 mb-2 flex items-center gap-2"><Zap className="w-4 h-4" /> AL MICROFONO</div>
          <div className="flex items-center gap-3 mb-3">
            {currentBooking.participants?.avatar_url && <img src={currentBooking.participants.avatar_url} alt="av" className="w-12 h-12 rounded-full border-2 border-fuchsia-500" />}
            <div><div className="text-xl font-black text-white">{currentBooking.participants?.nickname}</div></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button size="lg" onClick={() => handleValidate(false)} className="bg-red-600 hover:bg-red-500 font-bold"><X className="w-5 h-5 mr-1" /> NO</Button>
            <Button size="lg" onClick={() => handleValidate(true)} className="bg-green-600 hover:bg-green-500 font-bold"><Check className="w-5 h-5 mr-1" /> SÌ</Button>
          </div>
        </div>
      )}

      {completedBookings.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
          <div className="text-xs uppercase font-bold text-zinc-500 mb-2">📜 Cronologia</div>
          <ScrollArea className="h-28">
            <div className="space-y-1">
              {completedBookings.map((b) => (
                <div key={b.id} className={`flex justify-between p-2 rounded text-sm ${b.status === 'correct' ? 'bg-green-900/20 text-green-400' : 'bg-red-900/20 text-red-400'}`}>
                  <span>{b.booking_order}. {b.participants?.nickname}</span>
                  <span>{b.status === 'correct' ? '✅' : '❌'}</span>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      <div className="flex gap-2 mt-4">
        {/* Se il gioco è ended, mostriamo solo il tasto per chiudere definitivamente/pulire */}
        {activeGame.status === 'ended' ? (
             <Button size="sm" variant="destructive" onClick={handleEndGame} className="w-full h-10 font-bold">
               <Square className="w-4 h-4 mr-2" /> Termina
             </Button>
        ) : (
            <>
                {!isPlayerVisible && activeGame.status === 'active' && <Button size="sm" onClick={() => { setIsPlayerVisible(true); setNewBookingAlert(false); }} className="flex-1 bg-green-600"><Play className="w-3 h-3 mr-1" /> PLAY MUSIC</Button>}
                {activeGame.status === 'active' ? <Button size="sm" variant="outline" onClick={handlePauseGame} className="flex-1"><Pause className="w-3 h-3 mr-1" /> Pausa</Button> : <Button size="sm" onClick={handleResumeGame} className="flex-1 bg-green-600"><Play className="w-3 h-3 mr-1" /> Riprendi</Button>}
                <Button size="sm" variant="destructive" onClick={handleEndGame} className="flex-1"><Square className="w-3 h-3 mr-1" /> Termina</Button>
            </>
        )}
      </div>
    </div>
  );
}