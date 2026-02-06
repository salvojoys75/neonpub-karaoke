import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Mic2, Music, Trophy, QrCode } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import api from "@/lib/api";
import { supabase } from "@/lib/supabase";

export default function PubDisplay() {
  const { pubCode } = useParams();
  const [pubData, setPubData] = useState(null);
  const [currentPerformance, setCurrentPerformance] = useState(null);
  const [queue, setQueue] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [floatingReactions, setFloatingReactions] = useState([]);

  // Carica i dati iniziali
  useEffect(() => {
    const loadData = async () => {
      try {
        // Usa getDisplayData che è pubblico in api.js
        const { data } = await api.getDisplayData(pubCode);
        setPubData(data.pub);
        setCurrentPerformance(data.current_performance);
        setQueue(data.queue || []);
        setLeaderboard(data.leaderboard || []);
      } catch (error) {
        console.error("Errore caricamento display:", error);
      }
    };
    loadData();
  }, [pubCode]);

  // Connessione Realtime
  useEffect(() => {
    if (!pubData?.id) return;

    const channel = supabase
      .channel(`display:${pubData.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'performances', filter: `event_id=eq.${pubData.id}` }, 
        (payload) => {
           if (payload.new.status === 'live' || payload.new.status === 'voting') setCurrentPerformance(payload.new);
           else if (payload.new.status === 'ended') setCurrentPerformance(null);
           else setCurrentPerformance(payload.new);
        })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'song_requests', filter: `event_id=eq.${pubData.id}` }, 
        async () => {
           const { data } = await api.getDisplayData(pubCode);
           setQueue(data.queue);
        })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reactions', filter: `event_id=eq.${pubData.id}` }, 
        (payload) => addFloatingReaction(payload.new.emoji))
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [pubData?.id, pubCode]);

  const addFloatingReaction = (emoji) => {
    const id = Date.now() + Math.random();
    const left = Math.random() * 80 + 10;
    setFloatingReactions(prev => [...prev, { id, emoji, left }]);
    setTimeout(() => setFloatingReactions(prev => prev.filter(r => r.id !== id)), 2000);
  };

  if (!pubData) return <div className="min-h-screen bg-black text-white flex items-center justify-center">Caricamento Display...</div>;

  const joinUrl = `${window.location.origin}/join/${pubCode}`;

  return (
    <div className="min-h-screen bg-black text-white p-8 overflow-hidden relative font-sans">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-900/20 to-cyan-900/20 pointer-events-none" />

      {/* Floating Reactions */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-50">
        {floatingReactions.map(r => (
          <div key={r.id} className="absolute text-6xl animate-float-up" style={{ left: `${r.left}%`, bottom: '-50px' }}>
            {r.emoji}
          </div>
        ))}
      </div>

      <header className="flex justify-between items-start mb-10 relative z-10">
        <div className="flex items-center gap-6">
          <div className="bg-white p-3 rounded-xl">
            <QRCodeSVG value={joinUrl} size={120} />
          </div>
          <div>
            <h1 className="text-5xl font-bold mb-2">Inquadra per Cantare!</h1>
            <p className="text-2xl text-cyan-400 font-mono tracking-widest">CODICE: {pubCode}</p>
          </div>
        </div>
        <div className="text-right">
          <h2 className="text-4xl font-bold text-fuchsia-500">{pubData.name}</h2>
          <div className="flex items-center justify-end gap-2 mt-2 text-zinc-400">
            <Mic2 className="w-6 h-6" />
            <span className="text-xl">Karaoke Night</span>
          </div>
        </div>
      </header>

      <main className="grid grid-cols-12 gap-8 relative z-10 h-[calc(100vh-240px)]">
        {/* Left Column: Current Performance or Queue */}
        <div className="col-span-8 flex flex-col gap-6">
          {currentPerformance ? (
            <div className="flex-1 glass rounded-3xl p-10 flex flex-col justify-center items-center text-center neon-border animate-pulse-slow relative overflow-hidden">
              <div className="absolute inset-0 bg-fuchsia-600/10 blur-3xl"></div>
              <span className="bg-red-600 text-white px-6 py-2 rounded-full text-xl font-bold mb-8 animate-bounce">
                {currentPerformance.status === 'voting' ? 'VOTAZIONE IN CORSO' : 'LIVE ON STAGE'}
              </span>
              <h2 className="text-7xl font-bold mb-6 leading-tight">{currentPerformance.song_title}</h2>
              <p className="text-4xl text-zinc-300 mb-8">{currentPerformance.song_artist}</p>
              <div className="flex items-center gap-4 bg-white/10 px-8 py-4 rounded-full">
                <Mic2 className="w-8 h-8 text-cyan-400" />
                <span className="text-3xl font-bold text-cyan-400">{currentPerformance.user_nickname}</span>
              </div>
            </div>
          ) : (
            <div className="flex-1 glass rounded-3xl p-10 flex flex-col justify-center items-center text-center">
              <Music className="w-32 h-32 text-zinc-600 mb-6" />
              <h2 className="text-5xl font-bold text-zinc-500">Il palco è vuoto...</h2>
              <p className="text-2xl text-zinc-600 mt-4">Richiedi una canzone scansionando il QR code!</p>
            </div>
          )}
        </div>

        {/* Right Column: Up Next & Leaderboard */}
        <div className="col-span-4 flex flex-col gap-6">
          {/* Queue */}
          <div className="glass rounded-3xl p-6 flex-1 overflow-hidden flex flex-col">
            <h3 className="text-2xl font-bold mb-6 flex items-center gap-3 border-b border-white/10 pb-4">
              <Music className="text-fuchsia-400" /> Prossimi Cantanti
            </h3>
            <div className="space-y-4 overflow-y-auto pr-2">
              {queue.length === 0 ? (
                <p className="text-zinc-500 italic">Coda vuota</p>
              ) : (
                queue.map((song, i) => (
                  <div key={i} className="flex items-center gap-4 p-3 bg-white/5 rounded-xl">
                    <span className="font-mono text-2xl font-bold text-fuchsia-500 w-8">{i + 1}</span>
                    <div className="min-w-0">
                      <p className="font-bold truncate text-lg">{song.title}</p>
                      <p className="text-sm text-zinc-400 truncate">🎤 {song.nickname || song.user_nickname}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Leaderboard */}
          <div className="glass rounded-3xl p-6 h-1/3 flex flex-col">
            <h3 className="text-2xl font-bold mb-4 flex items-center gap-3 border-b border-white/10 pb-4">
              <Trophy className="text-yellow-500" /> Top Quiz
            </h3>
            <div className="space-y-3 overflow-y-auto pr-2">
              {leaderboard.map((p, i) => (
                <div key={i} className="flex justify-between items-center p-2 rounded-lg bg-white/5">
                  <div className="flex items-center gap-3">
                    <span className="text-yellow-500 font-bold">#{i + 1}</span>
                    <span className="font-medium">{p.nickname}</span>
                  </div>
                  <span className="font-mono text-cyan-400 font-bold">{p.score}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}