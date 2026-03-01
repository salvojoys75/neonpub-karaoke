import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

// ─── COSTANTI ────────────────────────────────────────────────────────────────
const PERF_WINDOW = 0.05;
const GOOD_WINDOW = 0.10;
const START_DELAY = 4000;
const DEFAULT_BPM = 126;
const HIT_SUSTAIN = 0.5;

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

const INSTRUMENT_AUDIO = {
  keys:   'organo.mp3',
  drums:  'drums.mp3',
  bass:   'bass.mp3',
  brass:  'brass.mp3',
  guitar: 'guitar.mp3',
};

// ── Spotlight ─────────────────────────────────────────────────────────────────
function Spotlight({ player, instrument, color, icon, side }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const energyPropRef = useRef(0);

  useEffect(() => {
    energyPropRef.current = player?.energy || 0;
  }, [player?.energy]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const DPR = window.devicePixelRatio || 1;
    const W = canvas.offsetWidth;
    const H = canvas.offsetHeight;
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    const ctx = canvas.getContext('2d');
    ctx.scale(DPR, DPR);

    let energy = 0;

    function draw() {
      const target = energyPropRef.current;
      energy += (target - energy) * 0.08;
      if (energy < 0.01) energy = 0;
      energyPropRef.current = Math.max(0, energyPropRef.current - 0.008);

      ctx.clearRect(0, 0, W, H);
      const cx = W / 2, cy = H * 0.42;
      const baseR = Math.min(W, H) * 0.22;

      if (energy > 0.05) {
        const glowR = baseR + energy * baseR * 1.2;
        const grd = ctx.createRadialGradient(cx, cy, baseR * 0.5, cx, cy, glowR);
        grd.addColorStop(0, color + Math.floor(energy * 180).toString(16).padStart(2, '0'));
        grd.addColorStop(1, color + '00');
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(cx, cy, glowR, 0, Math.PI * 2);
        ctx.fill();
      }

      const alpha = 0.15 + energy * 0.7;
      ctx.fillStyle = color + Math.floor(alpha * 255).toString(16).padStart(2, '0');
      ctx.strokeStyle = color + Math.floor((0.4 + energy * 0.6) * 255).toString(16).padStart(2, '0');
      ctx.lineWidth = 2 + energy * 4;
      ctx.beginPath();
      ctx.arc(cx, cy, baseR, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.font = `${Math.floor(baseR * 0.9)}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.globalAlpha = 0.5 + energy * 0.5;
      ctx.fillText(icon, cx, cy);
      ctx.globalAlpha = 1;

      // Barra energia
      const barW = 6, barH = H * 0.22;
      const barX = side === 'left' ? W * 0.1 : W * 0.9 - barW;
      const barY = H * 0.62;
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.beginPath();
      ctx.roundRect(barX, barY, barW, barH, 3);
      ctx.fill();
      const fillH = barH * energy;
      if (fillH > 1) {
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.roundRect(barX, barY + barH - fillH, barW, fillH, 3);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      animRef.current = requestAnimationFrame(draw);
    }
    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [color, icon, side]);

  const nickname = player?.nickname || '---';
  const score = player?.score || 0;
  const combo = player?.combo || 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', height: '100%', padding: '12px 8px', gap: '6px' }}>
      <canvas ref={canvasRef} style={{ width: '100%', flex: '1 1 0', minHeight: 0 }} />
      <div style={{ textAlign: 'center', lineHeight: 1.2 }}>
        <div style={{ fontSize: 'clamp(11px,1.4vw,18px)', fontWeight: 900, color: '#fff', textShadow: `0 0 12px ${color}` }}>{nickname}</div>
        <div style={{ fontSize: 'clamp(9px,1vw,13px)', color, letterSpacing: '0.15em', marginTop: '2px' }}>{instrument?.toUpperCase()}</div>
      </div>
      <div style={{ fontSize: 'clamp(14px,2vw,28px)', fontWeight: 900, color, textShadow: `0 0 20px ${color}44` }}>{score.toLocaleString()}</div>
      {combo > 1 && <div style={{ fontSize: 'clamp(10px,1.2vw,16px)', fontWeight: 700, color: '#ffd100', textShadow: '0 0 10px #ffd10088' }}>×{combo} COMBO</div>}
    </div>
  );
}

// ── Karaoke Display ───────────────────────────────────────────────────────────
function KaraokeDisplay({ lyrics, elapsed, songTitle, songArtist, gameState, countdown }) {
  let activeLine = null, nextLine = null;
  for (let i = 0; i < lyrics.length; i++) {
    const l = lyrics[i];
    const end = l.time + (l.duration || 3);
    if (elapsed >= l.time && elapsed < end) { activeLine = l; nextLine = lyrics[i + 1] || null; break; }
    if (elapsed < l.time) { nextLine = l; break; }
  }
  const progress = activeLine ? Math.min(1, (elapsed - activeLine.time) / (activeLine.duration || 3)) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', padding: '16px', textAlign: 'center' }}>
      <div style={{ marginBottom: '8px', fontSize: 'clamp(10px,1.1vw,15px)', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.3em' }}>
        {songTitle} — {songArtist}
      </div>

      {gameState === 'countdown' && (
        <div style={{ fontSize: 'clamp(80px,14vw,180px)', fontWeight: 900, color: '#fff', lineHeight: 1 }}>{countdown}</div>
      )}

      {gameState === 'playing' && (
        <>
          <div style={{ position: 'relative', display: 'inline-block', marginBottom: '12px' }}>
            <div style={{ fontSize: 'clamp(28px,5vw,72px)', fontWeight: 900, color: 'rgba(255,255,255,0.18)', letterSpacing: '0.04em', lineHeight: 1.15, fontFamily: "'JetBrains Mono',monospace" }}>
              {activeLine?.text || '♪'}
            </div>
            {activeLine && (
              <div style={{ position: 'absolute', top: 0, left: 0, overflow: 'hidden', width: `${progress * 100}%`, whiteSpace: 'nowrap' }}>
                <div style={{ fontSize: 'clamp(28px,5vw,72px)', fontWeight: 900, color: '#fff', letterSpacing: '0.04em', lineHeight: 1.15, fontFamily: "'JetBrains Mono',monospace", textShadow: '0 0 30px rgba(255,255,255,0.8), 0 0 60px rgba(255,255,255,0.4)' }}>
                  {activeLine.text}
                </div>
              </div>
            )}
          </div>
          {nextLine && (
            <div style={{ fontSize: 'clamp(16px,2.5vw,36px)', fontWeight: 700, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.04em', fontFamily: "'JetBrains Mono',monospace" }}>
              {nextLine.text}
            </div>
          )}
          {!activeLine && !nextLine && <div style={{ fontSize: 'clamp(20px,3vw,48px)', color: 'rgba(255,255,255,0.1)' }}>♪ ♫ ♪</div>}
        </>
      )}

      {gameState === 'waiting' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <div style={{ fontSize: 'clamp(32px,6vw,80px)', fontWeight: 900, color: '#ffd100', textShadow: '0 0 40px rgba(255,209,0,0.6)' }}>🎤 BAND TIME</div>
          <div style={{ fontSize: 'clamp(12px,1.6vw,22px)', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.25em' }}>IN ATTESA DEL SEGNALE DI START</div>
        </div>
      )}
    </div>
  );
}

// ── BandMode principale (TV) ──────────────────────────────────────────────────
export default function BandMode({ session, pubCode }) {
  const [gameState, setGameState] = useState('waiting');
  const [countdown, setCountdown] = useState(null);
  const [players, setPlayers] = useState({});
  const [assignments, setAssignments] = useState([]);
  const [lyrics, setLyrics] = useState([]);
  const [elapsed, setElapsed] = useState(0);
  const [connected, setConnected] = useState(false);
  const [songMeta, setSongMeta] = useState({ title: '---', artist: '---' });

  const channelRef = useRef(null);
  const audioCtxRef = useRef(null);
  const baseRef = useRef(null);
  const startTimeRef = useRef(null);
  const animRef = useRef(null);
  const startTimerRef = useRef(null);
  const countdownIntervalRef = useRef(null);
  const gameStateRef = useRef('waiting');
  const playersRef = useRef({});
  const instrGainsRef = useRef({});
  const sessionIdRef = useRef(null);

  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  useEffect(() => { playersRef.current = players; }, [players]);

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

  // ── Setup AudioContext ────────────────────────────────────────────────────
  const setupAudio = useCallback(async (ass) => {
    if (audioCtxRef.current) return;
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    audioCtxRef.current = ctx;
    
    // FIX: Resume audio context (richiesto da browser moderni)
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    // Connetti base.mp3
    if (baseRef.current && !baseRef.current._connected) {
      try {
        const src = ctx.createMediaElementSource(baseRef.current);
        src.connect(ctx.destination);
        baseRef.current._connected = true;
      } catch (e) {
        console.warn('Base audio già connesso:', e);
      }
    }

    // Per ogni strumento assegnato
    ass.forEach(a => {
      const audioFile = INSTRUMENT_AUDIO[a.instrument];
      if (!audioFile || instrGainsRef.current[a.instrument]) return;

      const el = document.createElement('audio');
      el.src = `/audio/${song}/${audioFile}`;
      el.crossOrigin = 'anonymous';
      el.preload = 'auto';
      el.loop = false;
      document.body.appendChild(el);

      try {
        const gain = ctx.createGain();
        gain.gain.value = 0;

        const src = ctx.createMediaElementSource(el);
        src.connect(gain);
        gain.connect(ctx.destination);

        instrGainsRef.current[a.instrument] = { gain, el };
      } catch (e) {
        console.warn('Errore setup strumento:', a.instrument, e);
      }
    });
  }, [song]);

  // ── Trigger strumento hit ─────────────────────────────────────────────────
  const triggerInstrumentHit = useCallback((instrument, accuracy) => {
    const ctx = audioCtxRef.current;
    const data = instrGainsRef.current[instrument];
    if (!ctx || !data) return;

    const vol = accuracy < PERF_WINDOW ? 1.0 : accuracy < GOOD_WINDOW ? 0.75 : 0.5;
    const g = data.gain.gain;
    const now = ctx.currentTime;

    try {
      g.cancelScheduledValues(now);
      g.setValueAtTime(vol, now);
      g.setValueAtTime(vol, now + HIT_SUSTAIN);
      g.exponentialRampToValueAtTime(0.001, now + HIT_SUSTAIN + 0.8);
    } catch (e) {
      console.warn('Errore trigger hit:', e);
    }
  }, []);

  // ── Metronomo ─────────────────────────────────────────────────────────────
  const playClick = useCallback((ctx, time, isHigh) => {
    try {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.connect(g);
      g.connect(ctx.destination);
      osc.frequency.value = isHigh ? 1200 : 800;
      g.gain.setValueAtTime(0.3, time);
      g.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
      osc.start(time);
      osc.stop(time + 0.15);
    } catch (e) {}
  }, []);

  // ── Loop elapsed ──────────────────────────────────────────────────────────
  const startElapsedLoop = useCallback(() => {
    function tick() {
      if (audioCtxRef.current && startTimeRef.current !== null) {
        setElapsed(audioCtxRef.current.currentTime - startTimeRef.current);
      }
      animRef.current = requestAnimationFrame(tick);
    }
    animRef.current = requestAnimationFrame(tick);
  }, []);

  // ── Start sequence ────────────────────────────────────────────────────────
  const startSequence = useCallback(async (ass, serverTime, startDelay) => {
    if (gameStateRef.current !== 'waiting') return;
    
    await setupAudio(ass);
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    // Calcola quando iniziare basandosi sul server time
    const now = Date.now();
    const targetStart = serverTime ? serverTime + startDelay : now + startDelay;
    const waitTime = Math.max(0, targetStart - now);
    
    const bpm = DEFAULT_BPM;
    const beatDuration = 60 / bpm;
    const ctxNow = ctx.currentTime;
    const musicStart = ctxNow + (waitTime / 1000) + (START_DELAY / 1000);

    // Schedule metronome clicks
    for (let i = 0; i < 4; i++) {
      const t = musicStart - (4 - i) * beatDuration;
      if (t > ctxNow) playClick(ctx, t, i === 3);
    }

    setGameState('countdown');
    setCountdown(4);
    let count = 4;
    
    countdownIntervalRef.current = setInterval(() => {
      count--;
      if (count > 0) {
        setCountdown(count);
      } else {
        clearInterval(countdownIntervalRef.current);
        setCountdown('GO!');
      }
    }, 1000);

    const totalDelay = waitTime + START_DELAY;
    
    startTimerRef.current = setTimeout(async () => {
      // Avvia audio
      if (baseRef.current) {
        baseRef.current.currentTime = 0;
        baseRef.current.volume = 0.85;
        baseRef.current.play().catch(() => {});
      }
      
      Object.values(instrGainsRef.current).forEach(({ el }) => {
        el.currentTime = 0;
        el.play().catch(() => {});
      });

      startTimeRef.current = ctx.currentTime;
      setGameState('playing');
      setCountdown(null);
      startElapsedLoop();
    }, totalDelay);
  }, [setupAudio, startElapsedLoop, playClick]);

  // Ref stabile
  const startSequenceRef = useRef(startSequence);
  useEffect(() => { startSequenceRef.current = startSequence; }, [startSequence]);

  // ── Reset game ────────────────────────────────────────────────────────────
  const resetGame = useCallback(() => {
    setGameState('waiting');
    setCountdown(null);
    setPlayers({});
    setAssignments([]);
    setElapsed(0);
    
    clearInterval(countdownIntervalRef.current);
    clearTimeout(startTimerRef.current);
    cancelAnimationFrame(animRef.current);
    
    if (baseRef.current) {
      baseRef.current.pause();
      baseRef.current.currentTime = 0;
    }
    
    Object.values(instrGainsRef.current).forEach(({ el }) => {
      el.pause();
      el.remove();
    });
    instrGainsRef.current = {};
    
    startTimeRef.current = null;
  }, []);

  // ── Supabase ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const channel = supabase.channel(`band_game_${pubCode}`, {
      config: { broadcast: { self: false } }
    });

    // FIX: Nuovo evento unificato
    channel.on('broadcast', { event: 'band_init' }, ({ payload }) => {
      if (payload.type === 'start') {
        const { assignments: ass, serverTime, startDelay, sessionId } = payload;
        
        sessionIdRef.current = sessionId;
        setAssignments(ass);
        
        // Inizializza players
        const init = {};
        ass.forEach(a => {
          init[a.nickname] = { score: 0, combo: 0, energy: 0, instrument: a.instrument };
        });
        setPlayers(init);
        playersRef.current = init;

        startSequenceRef.current(ass, serverTime, startDelay);
      } else if (payload.type === 'stop') {
        resetGame();
      }
    });

    // Compatibilità con vecchi eventi
    channel.on('broadcast', { event: 'band_setup' }, ({ payload }) => {
      const ass = payload.assignments || [];
      setAssignments(ass);
      const init = {};
      ass.forEach(a => { init[a.nickname] = { score: 0, combo: 0, energy: 0, instrument: a.instrument }; });
      setPlayers(init);
      playersRef.current = init;
    });

    channel.on('broadcast', { event: 'band_start' }, ({ payload }) => {
      const ass = payload.assignments || [];
      if (ass.length > 0) {
        setAssignments(ass);
        const init = {};
        ass.forEach(a => { init[a.nickname] = { score: 0, combo: 0, energy: 0, instrument: a.instrument }; });
        setPlayers(init);
        playersRef.current = init;
      }
      startSequenceRef.current(assignments.length > 0 ? assignments : ass, Date.now(), payload.startDelay || 4000);
    });

    channel.on('broadcast', { event: 'band_stop' }, () => {
      resetGame();
    });

    // Hit e miss
    channel.on('broadcast', { event: 'band_hit' }, ({ payload }) => {
      if (gameStateRef.current !== 'playing') return;
      const { nickname, instrument, accuracy, points } = payload;

      triggerInstrumentHit(instrument, accuracy);

      setPlayers(prev => {
        const pl = prev[nickname] || { score: 0, combo: 0, energy: 0, instrument: '' };
        return {
          ...prev,
          [nickname]: {
            ...pl,
            score: pl.score + (points || 0),
            combo: pl.combo + 1,
            energy: Math.min(1, (pl.energy || 0) + (accuracy < PERF_WINDOW ? 0.55 : accuracy < GOOD_WINDOW ? 0.35 : 0.18)),
          }
        };
      });
    });

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

    // Recovery: controlla sessione attiva
    if (session?.status === 'active' && session?.assignments) {
      setAssignments(session.assignments);
      const init = {};
      session.assignments.forEach(a => {
        init[a.nickname] = { score: 0, combo: 0, energy: 0, instrument: a.instrument };
      });
      setPlayers(init);
      
      // Se la sessione è già iniziata, parti subito
      if (session.serverStartTime) {
        const elapsed = Date.now() - session.serverStartTime;
        if (elapsed < 300000 && elapsed > START_DELAY) {
          // Sessione già in corso, parti immediatamente
          setTimeout(() => {
            startSequenceRef.current(session.assignments, session.serverStartTime, 0);
          }, 500);
        }
      }
    }

    return () => {
      supabase.removeChannel(channel);
      cancelAnimationFrame(animRef.current);
      clearTimeout(startTimerRef.current);
      clearInterval(countdownIntervalRef.current);
      Object.values(instrGainsRef.current).forEach(({ el }) => el.remove());
      instrGainsRef.current = {};
      audioCtxRef.current?.close();
      audioCtxRef.current = null;
    };
  }, [pubCode, session, triggerInstrumentHit, resetGame]);

  const leftPlayers = assignments.slice(0, Math.ceil(assignments.length / 2));
  const rightPlayers = assignments.slice(Math.ceil(assignments.length / 2));
  const totalScore = Object.values(players).reduce((s, p) => s + (p.score || 0), 0);

  return (
    <div style={{
      width: '100%',
      height: '100%',
      background: '#06060e',
      display: 'grid',
      gridTemplateColumns: leftPlayers.length > 0 ? '18% 1fr 18%' : '0 1fr 0',
      gridTemplateRows: '1fr auto',
      fontFamily: "'JetBrains Mono',monospace",
      color: '#fff',
      overflow: 'hidden'
    }}>
      {/* Sinistra */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        borderRight: leftPlayers.length > 0 ? '1px solid rgba(255,255,255,0.05)' : 'none',
        background: 'rgba(0,0,0,0.3)',
        overflow: 'hidden'
      }}>
        {leftPlayers.map(a => (
          <div key={a.nickname} style={{ flex: 1, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <Spotlight
              player={players[a.nickname]}
              instrument={a.instrument}
              color={INSTRUMENT_COLORS[a.instrument] || '#fff'}
              icon={INSTRUMENT_ICONS[a.instrument] || '🎵'}
              side="left"
            />
          </div>
        ))}
      </div>

      {/* Centro — Karaoke */}
      <div style={{ position: 'relative', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at 50% 60%, rgba(255,255,255,0.03) 0%, transparent 70%)',
          pointerEvents: 'none'
        }} />
        {gameState === 'playing' && totalScore > 0 && (
          <div style={{
            position: 'absolute',
            top: 12,
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: 'clamp(10px,1.2vw,16px)',
            color: 'rgba(255,209,0,0.6)',
            fontWeight: 900,
            letterSpacing: '0.2em',
            zIndex: 5
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
      </div>

      {/* Destra */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        borderLeft: rightPlayers.length > 0 ? '1px solid rgba(255,255,255,0.05)' : 'none',
        background: 'rgba(0,0,0,0.3)',
        overflow: 'hidden'
      }}>
        {rightPlayers.map(a => (
          <div key={a.nickname} style={{ flex: 1, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <Spotlight
              player={players[a.nickname]}
              instrument={a.instrument}
              color={INSTRUMENT_COLORS[a.instrument] || '#fff'}
              icon={INSTRUMENT_ICONS[a.instrument] || '🎵'}
              side="right"
            />
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{
        gridColumn: '1 / -1',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 20px',
        background: '#0a0a14',
        borderTop: '1px solid rgba(255,255,255,0.05)',
        fontSize: 'clamp(9px,0.9vw,12px)',
        color: 'rgba(255,255,255,0.25)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: connected ? '#39ff84' : '#ff3b5c'
          }} />
          {connected ? 'CONNESSO' : 'OFFLINE'}
        </div>
        <div>{songMeta.title} — {songMeta.artist}</div>
        <div>{assignments.length > 0 ? `${assignments.length} MUSICISTI` : 'IN ATTESA SETUP'}</div>
      </div>

      <audio ref={baseRef} src={`/audio/${song}/base.mp3`} preload="auto" crossOrigin="anonymous" />
    </div>
  );
}
