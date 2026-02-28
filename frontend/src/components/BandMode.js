import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

// ─── COSTANTI ────────────────────────────────────────────────────────────────
const PERF_WINDOW = 0.05;
const GOOD_WINDOW = 0.10;
const START_DELAY = 4000;
const DEFAULT_BPM = 126;

// Colori per ogni strumento (stesso ordine dell'assignment)
const INSTRUMENT_COLORS = {
  keys:   '#00d4ff',
  drums:  '#ff3b5c',
  bass:   '#39ff84',
  brass:  '#ffd100',
  guitar: '#ff8c00',
};

const INSTRUMENT_ICONS = {
  keys:   '🎹',
  drums:  '🥁',
  bass:   '🎸',
  brass:  '🎺',
  guitar: '🎸',
};

// ── Componente Spotlight (indicatore energia di un singolo strumentista) ──────
function Spotlight({ player, instrument, color, icon, side }) {
  const energyRef = useRef(0);
  const canvasRef = useRef(null);
  const animRef   = useRef(null);
  const energyPropRef = useRef(player?.energy || 0);

  // Aggiorna ref quando cambia prop
  useEffect(() => {
    energyPropRef.current = player?.energy || 0;
  }, [player?.energy]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const DPR = window.devicePixelRatio || 1;
    const W = canvas.offsetWidth;
    const H = canvas.offsetHeight;
    canvas.width  = W * DPR;
    canvas.height = H * DPR;
    const ctx = canvas.getContext('2d');
    ctx.scale(DPR, DPR);

    let energy = 0;
    let lastPerfect = 0;

    function draw(ts) {
      const target = energyPropRef.current;
      // Decay naturale
      energy += (target - energy) * 0.08;
      if (energy < 0.01) energy = 0;
      // Aggiorna anche il target verso 0 (decay)
      energyPropRef.current = Math.max(0, energyPropRef.current - 0.008);

      ctx.clearRect(0, 0, W, H);

      const cx = W / 2;
      const cy = H * 0.42;
      const baseR = Math.min(W, H) * 0.22;

      // Alone esterno pulsante
      if (energy > 0.05) {
        const glowR = baseR + energy * baseR * 1.2;
        const grd = ctx.createRadialGradient(cx, cy, baseR * 0.5, cx, cy, glowR);
        grd.addColorStop(0, color + Math.floor(energy * 180).toString(16).padStart(2,'0'));
        grd.addColorStop(1, color + '00');
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(cx, cy, glowR, 0, Math.PI * 2);
        ctx.fill();
      }

      // Cerchio principale
      const alpha = 0.15 + energy * 0.7;
      ctx.fillStyle = color + Math.floor(alpha * 255).toString(16).padStart(2,'0');
      ctx.strokeStyle = color + Math.floor((0.4 + energy * 0.6) * 255).toString(16).padStart(2,'0');
      ctx.lineWidth = 2 + energy * 4;
      ctx.beginPath();
      ctx.arc(cx, cy, baseR, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Icona strumento
      ctx.font = `${Math.floor(baseR * 0.9)}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.globalAlpha = 0.5 + energy * 0.5;
      ctx.fillText(icon, cx, cy);
      ctx.globalAlpha = 1;

      // Barra energia verticale
      const barW = 6;
      const barH = H * 0.22;
      const barX = side === 'left' ? W * 0.1 : W * 0.9 - barW;
      const barY = H * 0.62;
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.beginPath(); ctx.roundRect(barX, barY, barW, barH, 3); ctx.fill();
      const fillH = barH * energy;
      if (fillH > 1) {
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.roundRect(barX, barY + barH - fillH, barW, fillH, 3); ctx.fill();
        ctx.shadowBlur = 0;
      }

      animRef.current = requestAnimationFrame(draw);
    }

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [color, icon, side]);

  const nickname = player?.nickname || '---';
  const score    = player?.score    || 0;
  const combo    = player?.combo    || 0;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      width: '100%',
      height: '100%',
      padding: '12px 8px',
      gap: '6px',
    }}>
      {/* Canvas spotlight */}
      <canvas ref={canvasRef} style={{ width: '100%', flex: '1 1 0', minHeight: 0 }} />

      {/* Nome e strumento */}
      <div style={{ textAlign: 'center', lineHeight: 1.2 }}>
        <div style={{ fontSize: 'clamp(11px, 1.4vw, 18px)', fontWeight: 900, color: '#fff', textShadow: `0 0 12px ${color}` }}>
          {nickname}
        </div>
        <div style={{ fontSize: 'clamp(9px, 1vw, 13px)', color: color, letterSpacing: '0.15em', marginTop: '2px' }}>
          {instrument?.toUpperCase()}
        </div>
      </div>

      {/* Score */}
      <div style={{ fontSize: 'clamp(14px, 2vw, 28px)', fontWeight: 900, color, textShadow: `0 0 20px ${color}44` }}>
        {score.toLocaleString()}
      </div>

      {/* Combo */}
      {combo > 1 && (
        <div style={{ fontSize: 'clamp(10px, 1.2vw, 16px)', fontWeight: 700, color: '#ffd100', textShadow: '0 0 10px #ffd10088' }}>
          ×{combo} COMBO
        </div>
      )}
    </div>
  );
}

// ── Componente Karaoke Centrale ───────────────────────────────────────────────
function KaraokeDisplay({ lyrics, elapsed, songTitle, songArtist, gameState, countdown }) {
  if (!lyrics || lyrics.length === 0) return null;

  // Trova la riga attiva e la prossima
  let activeLine = null;
  let nextLine   = null;

  for (let i = 0; i < lyrics.length; i++) {
    const l = lyrics[i];
    const end = l.time + (l.duration || 3);
    if (elapsed >= l.time && elapsed < end) {
      activeLine = l;
      nextLine   = lyrics[i + 1] || null;
      break;
    }
    if (elapsed < l.time) {
      nextLine = l;
      break;
    }
  }

  // Progresso parola corrente (0-1)
  const progress = activeLine
    ? Math.min(1, (elapsed - activeLine.time) / (activeLine.duration || 3))
    : 0;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      width: '100%', height: '100%',
      padding: '16px',
      textAlign: 'center',
    }}>
      {/* Info canzone (sempre visibile sopra) */}
      <div style={{ marginBottom: '8px' }}>
        <div style={{ fontSize: 'clamp(10px, 1.1vw, 15px)', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.3em' }}>
          {songTitle} — {songArtist}
        </div>
      </div>

      {gameState === 'countdown' && (
        <div style={{ fontSize: 'clamp(80px, 14vw, 180px)', fontWeight: 900, color: '#fff', lineHeight: 1 }}>
          {countdown}
        </div>
      )}

      {gameState === 'playing' && (
        <>
          {/* Riga attiva con fill progress */}
          <div style={{ position: 'relative', display: 'inline-block', marginBottom: '12px' }}>
            {/* Testo base (grigio) */}
            <div style={{
              fontSize: 'clamp(28px, 5vw, 72px)',
              fontWeight: 900,
              color: 'rgba(255,255,255,0.18)',
              letterSpacing: '0.04em',
              lineHeight: 1.15,
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              {activeLine?.text || '♪'}
            </div>
            {/* Overlay fill (bianco brillante) */}
            {activeLine && (
              <div style={{
                position: 'absolute', top: 0, left: 0,
                overflow: 'hidden',
                width: `${progress * 100}%`,
                whiteSpace: 'nowrap',
              }}>
                <div style={{
                  fontSize: 'clamp(28px, 5vw, 72px)',
                  fontWeight: 900,
                  color: '#fff',
                  letterSpacing: '0.04em',
                  lineHeight: 1.15,
                  fontFamily: "'JetBrains Mono', monospace",
                  textShadow: '0 0 30px rgba(255,255,255,0.8), 0 0 60px rgba(255,255,255,0.4)',
                }}>
                  {activeLine.text}
                </div>
              </div>
            )}
          </div>

          {/* Prossima riga (più piccola, sfumata) */}
          {nextLine && (
            <div style={{
              fontSize: 'clamp(16px, 2.5vw, 36px)',
              fontWeight: 700,
              color: 'rgba(255,255,255,0.25)',
              letterSpacing: '0.04em',
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              {nextLine.text}
            </div>
          )}

          {/* Pausa musicale */}
          {!activeLine && !nextLine && (
            <div style={{ fontSize: 'clamp(20px, 3vw, 48px)', color: 'rgba(255,255,255,0.1)' }}>♪ ♫ ♪</div>
          )}
        </>
      )}

      {gameState === 'waiting' && (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px',
        }}>
          <div style={{ fontSize: 'clamp(32px, 6vw, 80px)', fontWeight: 900, color: '#ffd100', textShadow: '0 0 40px rgba(255,209,0,0.6)' }}>
            🎤 BAND TIME
          </div>
          <div style={{ fontSize: 'clamp(12px, 1.6vw, 22px)', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.25em' }}>
            IN ATTESA DEL SEGNALE DI START
          </div>
        </div>
      )}
    </div>
  );
}

// ── Componente Principale BandMode (TV Display) ───────────────────────────────
export default function BandMode({ session, pubCode }) {
  const [gameState, setGameState]   = useState('waiting');
  const [countdown, setCountdown]   = useState(null);
  const [players, setPlayers]       = useState({});       // { nickname: { score, combo, energy, instrument } }
  const [assignments, setAssignments] = useState([]);     // [{ nickname, instrument, userId }]
  const [lyrics, setLyrics]         = useState([]);
  const [elapsed, setElapsed]       = useState(0);
  const [connected, setConnected]   = useState(false);
  const [songMeta, setSongMeta]     = useState({ title: '---', artist: '---' });

  const channelRef    = useRef(null);
  const audioCtxRef   = useRef(null);
  const baseRef       = useRef(null);
  const startTimeRef  = useRef(null);
  const animRef       = useRef(null);
  const startTimerRef = useRef(null);
  const gameStateRef  = useRef('waiting');
  const playersRef    = useRef({});

  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  useEffect(() => { playersRef.current = players; },    [players]);

  const song = session?.song || 'deepdown';

  // ── Carica manifest e lyrics ──────────────────────────────────────────────
  useEffect(() => {
    fetch(`/audio/${song}/manifest.json`)
      .then(r => r.json())
      .then(m => setSongMeta({ title: m.title || song, artist: m.artist || '' }))
      .catch(() => {});

    fetch(`/audio/${song}/lyrics.json`)
      .then(r => r.json())
      .then(setLyrics)
      .catch(() => setLyrics([]));
  }, [song]);

  // ── Setup Audio ───────────────────────────────────────────────────────────
  const setupAudio = useCallback(() => {
    if (audioCtxRef.current) return;
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    audioCtxRef.current = ctx;
  }, []);

  const playClick = (ctx, time, isHigh) => {
    const osc = ctx.createOscillator();
    const g   = ctx.createGain();
    osc.connect(g); g.connect(ctx.destination);
    osc.frequency.value = isHigh ? 1200 : 800;
    g.gain.setValueAtTime(0.3, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
    osc.start(time); osc.stop(time + 0.15);
  };

  // ── Loop elapsed ─────────────────────────────────────────────────────────
  const startElapsedLoop = useCallback(() => {
    function tick() {
      if (!audioCtxRef.current || startTimeRef.current === null) {
        animRef.current = requestAnimationFrame(tick);
        return;
      }
      setElapsed(audioCtxRef.current.currentTime - startTimeRef.current);
      animRef.current = requestAnimationFrame(tick);
    }
    animRef.current = requestAnimationFrame(tick);
  }, []);

  // ── Start Sequence (ricevuta da band_setup) ───────────────────────────────
  const startSequence = useCallback(async (assignmentsData) => {
    if (gameStateRef.current !== 'waiting') return;
    setupAudio();
    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') await ctx.resume();

    const bpm = DEFAULT_BPM;
    const beatDuration = 60 / bpm;
    const now = ctx.currentTime;
    const musicStartTime = now + START_DELAY / 1000;

    for (let i = 0; i < 4; i++) {
      const clickTime = musicStartTime - (4 - i) * beatDuration;
      if (clickTime > now) playClick(ctx, clickTime, i === 3);
    }

    // Prepara audio base
    if (baseRef.current) {
      baseRef.current.currentTime = 0;
      if (!baseRef.current._connected) {
        const src = ctx.createMediaElementSource(baseRef.current);
        src.connect(ctx.destination);
        baseRef.current._connected = true;
      }
    }

    setGameState('countdown');
    setCountdown(4);
    let count = 4;
    const iv = setInterval(() => {
      count--;
      if (count > 0) setCountdown(count);
      else { clearInterval(iv); setCountdown('GO!'); }
    }, 1000);

    startTimerRef.current = setTimeout(async () => {
      if (baseRef.current) {
        baseRef.current.volume = 0.85;
        baseRef.current.play().catch(() => {});
      }
      startTimeRef.current = ctx.currentTime;
      setGameState('playing');
      setCountdown(null);
      startElapsedLoop();
    }, START_DELAY);

  }, [setupAudio, startElapsedLoop]);

  // ── Supabase ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const channel = supabase.channel(`band_game_${pubCode}`, {
      config: { broadcast: { self: false } }
    });

    // Ricezione setup banda dalla dashboard
    channel.on('broadcast', { event: 'band_setup' }, ({ payload }) => {
      // payload = { song, assignments: [{ userId, nickname, instrument }], startDelay }
      const ass = payload.assignments || [];
      setAssignments(ass);

      // Inizializza players
      const init = {};
      ass.forEach(a => {
        init[a.nickname] = { score: 0, combo: 0, energy: 0, instrument: a.instrument };
      });
      setPlayers(init);
      playersRef.current = init;
    });

    // START effettivo
    channel.on('broadcast', { event: 'band_start' }, ({ payload }) => {
      startSequence(payload.assignments || []);
    });

    // Hit dagli strumentisti
    channel.on('broadcast', { event: 'band_hit' }, ({ payload }) => {
      if (gameStateRef.current !== 'playing') return;
      const { nickname, accuracy, points } = payload;

      setPlayers(prev => {
        const pl = prev[nickname] || { score: 0, combo: 0, energy: 0, instrument: '' };
        return {
          ...prev,
          [nickname]: {
            ...pl,
            score:  pl.score + (points || 0),
            combo:  pl.combo + 1,
            // energy: picco massimo in base all'accuratezza
            energy: Math.min(1, (pl.energy || 0) + (
              accuracy < PERF_WINDOW ? 0.55 :
              accuracy < GOOD_WINDOW ? 0.35 : 0.18
            )),
          }
        };
      });
    });

    // Miss
    channel.on('broadcast', { event: 'band_miss' }, ({ payload }) => {
      if (gameStateRef.current !== 'playing') return;
      const { nickname } = payload;
      setPlayers(prev => {
        const pl = prev[nickname];
        if (!pl) return prev;
        return { ...prev, [nickname]: { ...pl, combo: 0, energy: Math.max(0, pl.energy - 0.2) } };
      });
    });

    channel.subscribe(status => setConnected(status === 'SUBSCRIBED'));
    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      cancelAnimationFrame(animRef.current);
      clearTimeout(startTimerRef.current);
      audioCtxRef.current?.close();
      audioCtxRef.current = null;
    };
  }, [pubCode, startSequence]);

  // ── Layout: dividi gli strumentisti in left/right ─────────────────────────
  const leftPlayers  = assignments.slice(0, Math.ceil(assignments.length / 2));
  const rightPlayers = assignments.slice(Math.ceil(assignments.length / 2));

  const totalScore = Object.values(players).reduce((s, p) => s + (p.score || 0), 0);

  return (
    <div style={{
      width: '100%', height: '100%',
      background: '#06060e',
      display: 'grid',
      gridTemplateColumns: leftPlayers.length > 0 ? '18% 1fr 18%' : '0 1fr 0',
      gridTemplateRows: '1fr auto',
      fontFamily: "'JetBrains Mono', monospace",
      color: '#fff',
      overflow: 'hidden',
    }}>

      {/* ── COLONNA SINISTRA: strumentisti ─────────────────────────────── */}
      <div style={{
        display: 'flex', flexDirection: 'column',
        borderRight: leftPlayers.length > 0 ? '1px solid rgba(255,255,255,0.05)' : 'none',
        background: 'rgba(0,0,0,0.3)',
        overflow: 'hidden',
      }}>
        {leftPlayers.map(a => (
          <div key={a.nickname} style={{ flex: 1, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <Spotlight
              player={players[a.nickname]}
              instrument={INSTRUMENT_ICONS[a.instrument] ? a.instrument : a.instrument}
              color={INSTRUMENT_COLORS[a.instrument] || '#ffffff'}
              icon={INSTRUMENT_ICONS[a.instrument] || '🎵'}
              side="left"
            />
          </div>
        ))}
      </div>

      {/* ── CENTRO: Karaoke ────────────────────────────────────────────── */}
      <div style={{ position: 'relative', overflow: 'hidden' }}>
        {/* Sfondo sfumato animato */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse at 50% 60%, rgba(255,255,255,0.03) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        {/* Score totale banda (piccolo, in alto) */}
        {gameState === 'playing' && totalScore > 0 && (
          <div style={{
            position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
            fontSize: 'clamp(10px, 1.2vw, 16px)', color: 'rgba(255,209,0,0.6)',
            fontWeight: 900, letterSpacing: '0.2em',
            zIndex: 5,
          }}>
            BANDA: {totalScore.toLocaleString()}
          </div>
        )}

        <KaraokeDisplay
          lyrics={lyrics}
          elapsed={elapsed}
          songTitle={songMeta.title}
          songArtist={songMeta.artist}
          gameState={gameState}
          countdown={countdown}
        />

        {/* Hit feedback in overlay (angolo basso centro) */}
        <div style={{ position: 'absolute', bottom: 24, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: '16px', pointerEvents: 'none', zIndex: 10 }}>
          {/* I feedback arrivano via setPlayers, il glow nei Spotlight li comunica */}
        </div>
      </div>

      {/* ── COLONNA DESTRA: strumentisti ───────────────────────────────── */}
      <div style={{
        display: 'flex', flexDirection: 'column',
        borderLeft: rightPlayers.length > 0 ? '1px solid rgba(255,255,255,0.05)' : 'none',
        background: 'rgba(0,0,0,0.3)',
        overflow: 'hidden',
      }}>
        {rightPlayers.map(a => (
          <div key={a.nickname} style={{ flex: 1, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <Spotlight
              player={players[a.nickname]}
              instrument={a.instrument}
              color={INSTRUMENT_COLORS[a.instrument] || '#ffffff'}
              icon={INSTRUMENT_ICONS[a.instrument] || '🎵'}
              side="right"
            />
          </div>
        ))}
      </div>

      {/* ── FOOTER: barra di stato ─────────────────────────────────────── */}
      <div style={{
        gridColumn: '1 / -1',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 20px',
        background: '#0a0a14',
        borderTop: '1px solid rgba(255,255,255,0.05)',
        fontSize: 'clamp(9px, 0.9vw, 12px)',
        color: 'rgba(255,255,255,0.25)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: connected ? '#39ff84' : '#ff3b5c' }} />
          {connected ? 'CONNESSO' : 'OFFLINE'}
        </div>
        <div>{songMeta.title} — {songMeta.artist}</div>
        <div>{assignments.length > 0 ? `${assignments.length} MUSICISTI` : 'IN ATTESA SETUP'}</div>
      </div>

      <audio ref={baseRef} src={`/audio/${song}/base.mp3`} preload="auto" crossOrigin="anonymous" />
    </div>
  );
}
