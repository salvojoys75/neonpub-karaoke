// ============================================================
// ARCADE PANEL - Sezione Arcade per AdminDashboard
// ============================================================

import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Play,
  Square,
  Check,
  X,
  Trophy,
  Users,
  Zap,
  AlertCircle,
  Pause,
  Volume2,
  VolumeX,
} from "lucide-react";
import { toast } from "sonner";
import * as api from "@/lib/api";

export default function ArcadePanel({ quizCatalog = [], onRefresh }) {
  const [activeGame, setActiveGame] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [currentBooking, setCurrentBooking] = useState(null);
  const [loading, setLoading] = useState(false);

  const [isPlayerVisible, setIsPlayerVisible] = useState(true);
  const [newBookingAlert, setNewBookingAlert] = useState(false);
  const prevBookingIdRef = useRef(null);

  const [showSetup, setShowSetup] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
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
      setActiveGame(game);

      if (game) {
        const { data: allBookings } = await api.getArcadeBookings(game.id);
        setBookings(allBookings || []);

        const { data: current } = await api.getCurrentBooking(game.id);

        if (current && current.id !== prevBookingIdRef.current) {
          prevBookingIdRef.current = current.id;
          setIsPlayerVisible(false);
          setNewBookingAlert(true);
          toast.info(`${current.participants?.nickname} si è prenotato!`);
        }

        if (!current && prevBookingIdRef.current !== null) {
          prevBookingIdRef.current = null;
          setNewBookingAlert(false);
        }

        setCurrentBooking(current);
      } else {
        setBookings([]);
        setCurrentBooking(null);
        prevBookingIdRef.current = null;
        setNewBookingAlert(false);
      }
    } catch (error) {
      console.error("Errore caricamento arcade:", error);
    }
  };

  // ============================================================
  // FILTRO CATALOGO
  // ============================================================

  useEffect(() => {
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const filtered = quizCatalog.filter(
        (q) =>
          q.question?.toLowerCase().includes(query) ||
          q.category?.toLowerCase().includes(query)
      );
      setFilteredTracks(filtered.slice(0, 20));
    } else {
      setFilteredTracks(quizCatalog.slice(0, 20));
    }
  }, [searchQuery, quizCatalog]);

  // ============================================================
  // PLAYER
  // ============================================================

  const renderPlayer = (game) => {
    if (!game?.track_url) return null;

    return (
      <div className="mb-3 rounded-lg overflow-hidden border border-zinc-700">
        <div className="flex items-center justify-between px-3 py-2 text-xs font-bold uppercase bg-zinc-900 text-zinc-400">
          <div className="flex items-center gap-2">
            {isPlayerVisible ? (
              <Volume2 className="w-3 h-3 text-green-400" />
            ) : (
              <VolumeX className="w-3 h-3 text-red-400" />
            )}
            <span>
              {isPlayerVisible ? "MUSICA IN RIPRODUZIONE" : "MUSICA FERMA"}
            </span>
          </div>

          <button
            onClick={() => setIsPlayerVisible(!isPlayerVisible)}
            className="text-zinc-500 hover:text-white underline text-[10px]"
          >
            {isPlayerVisible ? "ferma" : "riavvia"}
          </button>
        </div>

        {isPlayerVisible && (
          <iframe
            src={game.track_url}
            width="100%"
            height="80"
            frameBorder="0"
            allow="autoplay; encrypted-media"
            title="player"
          />
        )}
      </div>
    );
  };

  // ============================================================
  // CONTROLLI GIOCO
  // ============================================================

  const handleEndGame = async () => {
    if (!activeGame) return;
    try {
      await api.endArcadeGame(activeGame.id);
      setActiveGame(null);
      setBookings([]);
      setCurrentBooking(null);
      setIsPlayerVisible(true);
      setNewBookingAlert(false);
      prevBookingIdRef.current = null;
      toast.info("Gioco terminato");
    } catch (error) {
      toast.error(error.message);
    }
  };

  // ============================================================
  // RENDER
  // ============================================================

  if (!activeGame) {
    return (
      <div className="space-y-4">
        <div className="text-center py-12 text-zinc-600">
          <Trophy className="w-16 h-16 mx-auto mb-4 opacity-20" />
          <p className="text-sm">Nessun gioco attivo</p>
        </div>
      </div>
    );
  }

  const pendingBookings = bookings.filter((b) => b.status === "pending");

  return (
    <div className="space-y-3">
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs uppercase font-bold text-zinc-400">
            {activeGame.status}
          </span>
          <div className="text-xs text-zinc-500">
            {bookings.length} tentativi
          </div>
        </div>
        <div className="text-sm font-bold text-white">
          {activeGame.track_title}
        </div>
      </div>

      {renderPlayer(activeGame)}

      {pendingBookings.length > 0 && (
        <div className="bg-fuchsia-900/20 border border-fuchsia-600 rounded-lg p-3">
          <div className="text-xs uppercase font-bold text-fuchsia-400 mb-2">
            AL MICROFONO
          </div>
          <div className="text-xl font-black text-white">
            {pendingBookings[0].participants?.nickname}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <Button
          size="sm"
          variant="destructive"
          onClick={handleEndGame}
          className="flex-1"
        >
          <Square className="w-3 h-3 mr-1" /> Termina
        </Button>
      </div>
    </div>
  );
}
