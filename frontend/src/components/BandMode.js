/**
 * BandMode.jsx — componente per PubDisplay
 *
 * Uso in PubDisplay.js:
 *   import BandMode from '@/components/BandMode';
 *   // Dentro getActiveMode(), aggiungi:
 *   if (data.active_band) return 'band';
 *   // Nel render, aggiungi:
 *   else if (isBand) Content = <BandMode session={data.active_band} pubCode={pubCode} />;
 *
 * File audio attesi in /public/audio/deepdown/:
 *   base.mp3, organo.mp3
 *
 * Chart atteso in /audio/deepdown/chart_organo.json
 * (oppure passalo come prop `chart`)
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

// ─── COSTANTI ────────────────────────────────────────────────────────────────
const HIT_WINDOW   = 0.18;  // ±180ms per un hit valido
const GOOD_WINDOW  = 0.09;  // ±90ms per "GOOD"
const PERF_WINDOW  = 0.045; // ±45ms per "PERFECT"
const NOTE_LEAD    = 3.0;   // secondi in anticipo visibili
const NOTE_SPEED   = 220;   // px per secondo (canvas height / NOTE_LEAD)
const COLORS       = ['#ff3b5c', '#00d4ff', '#39ff84'];
const LANE_LABELS  = ['LANE 0', 'LANE 1', 'LANE 2'];

// ─── HELPER: volume fade ─────────────────────────────────────────────────────
function fadeVolume(audioEl, from, to, durationMs) {
  const steps = 20;
  const interval = durationMs / steps;
  const delta = (to - from) / steps;
  let current = from;
  const id = setInterval(() => {
    current = Math.max(0, Math.min(1, current + delta));
    if (audioEl) audioEl.volume = current;
    if ((delta > 0 && current >= to) || (delta < 0 && current <= to)) clearInterval(id);
  }, interval);
}

// ─── COMPONENTE ──────────────────────────────────────────────────────────────
export default function BandMode({ session, pubCode, chart: chartProp }) {
  const [chart, setChart]           = useState(chartProp || null);
  const [gameState, setGameState]   = useState('waiting'); // waiting | playing | ended
  const [score, setScore]           = useState(0);
  const [combo, setCombo]           = useState(0);
  const [hitFeedback, setHitFeedback] = useState([]); // { id, text, lane, color }
  const [players, setPlayers]       = useState({});   // nickname → { score, combo }
  const [organLevel, setOrganLevel] = useState(0);    // 0-1 per UI

  const baseRef    = useRef(null);
  const organRef   = useRef(null);
  const canvasRef  = useRef(null);
  const startTimeRef = useRef(null); // audioCtx.currentTime al momento dello start
  const audioCtxRef  = useRef(null);
  const notesRef     = useRef([]);   // copia del chart con stato hit
  const animRef      = useRef(null);
  const channelRef   = useRef(null);
  const organGainRef = useRef(null); // GainNode per organo

  // ── 1. Carica chart se non passato come prop ─────────────────────────────
  useEffect(() => {
    if (chartProp) { setChart(chartProp); return; }
    const song = session?.song || 'deepdown';
    fetch(`/audio/${song}/chart_organo.json`)
      .then(r => r.json())
      .then(data => setChart(data))
      .catch(() => console.warn('Chart non trovata, usa prop'));
  }, [session, chartProp]);

  // ── 2. Setup audio (Web Audio API per volume granulare) ──────────────────
  const setupAudio = useCallback(() => {
    if (audioCtxRef.current) return;
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    audioCtxRef.current = ctx;

    // GainNode per organo (inizia a 0)
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(ctx.destination);
    organGainRef.current = gain;
  }, []);

  // ── 3. Avvia canzone e broadcast su Supabase ─────────────────────────────
const startSong = useCallback(async () => {
  if (!chart || gameState === 'playing') return;
  setupAudio();
  const ctx = audioCtxRef.current;
  if (ctx.state === 'suspended') await ctx.resume();

  notesRef.current = chart.map((n, i) => ({ ...n, id: i, hit: false, missed: false }));

  // Precarica entrambi e aspetta che siano pronti
  const waitReady = (el) => new Promise(resolve => {
    el.currentTime = 0;
    if (el.readyState >= 3) { resolve(); return; }
    el.addEventListener('canplaythrough', resolve, { once: true });
    el.load();
  });

  await Promise.all([
    waitReady(baseRef.current),
    waitReady(organRef.current),
if (!baseRef.current._connected) {
  const src = audioCtxRef.current.createMediaElementSource(baseRef.current);
  src.connect(audioCtxRef.current.destination);
  baseRef.current._connected = true;
}
if (!organRef.current._connected) {
  const src = audioCtxRef.current.createMediaElementSource(organRef.current);
  src.connect(organGainRef.current);
  organRef.current._connected = true;
}
  ]);

  // Partenza simultanea perfetta
  const serverNow = Date.now();
  await Promise.all([
    baseRef.current.play(),
    organRef.current.play(),
  ]);

  startTimeRef.current = serverNow;
  setGameState('playing');
  setScore(0);
  setCombo(0);

  // Broadcast DOPO che audio è partito, con timestamp preciso
  await channelRef.current?.send({
    type: 'broadcast',
    event: 'band_start',
    payload: {
      song: session?.song || 'deepdown',
      chart: chart,
      serverTime: serverNow,
    }
  });

  startLoop();
}, [chart, gameState, setupAudio, session, startLoop]);

  // ── 4. Game loop: disegna canvas + controlla miss ─────────────────────────
  const startLoop = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const lW = W / 3;
    const hitY = H * 0.82; // zona di colpo

    function draw() {
      if (!audioCtxRef.current || !startTimeRef.current) return;
      const elapsed = audioCtxRef.current.currentTime - startTimeRef.current;

      ctx.clearRect(0, 0, W, H);

      // Sfondo per lane
      for (let lane = 0; lane < 3; lane++) {
        const x = lane * lW;
        ctx.fillStyle = lane % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent';
        ctx.fillRect(x, 0, lW, H);
        // separatori
        ctx.strokeStyle = 'rgba(255,255,255,0.07)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      }

      // Linea di colpo
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 4]);
      ctx.beginPath(); ctx.moveTo(0, hitY); ctx.lineTo(W, hitY); ctx.stroke();
      ctx.setLineDash([]);

      // Note
      for (const note of notesRef.current) {
        if (note.hit || note.missed) continue;
        const timeToHit = note.time - elapsed;
        if (timeToHit > NOTE_LEAD + 0.2) continue;
        if (timeToHit < -HIT_WINDOW - 0.1) {
          note.missed = true;
          setCombo(0);
          continue;
        }

        const y = hitY - (timeToHit / NOTE_LEAD) * hitY;
        const cx = note.lane * lW + lW / 2;
        const col = COLORS[note.lane];

        // Glow
        ctx.shadowColor = col;
        ctx.shadowBlur = 18;
        // Diamante
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(cx, y - 14);
        ctx.lineTo(cx + 11, y);
        ctx.lineTo(cx, y + 14);
        ctx.lineTo(cx - 11, y);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // Label lane in basso
      for (let lane = 0; lane < 3; lane++) {
        const cx = lane * lW + lW / 2;
        ctx.fillStyle = COLORS[lane] + '88';
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(LANE_LABELS[lane], cx, H - 8);
      }

      animRef.current = requestAnimationFrame(draw);
    }

    animRef.current = requestAnimationFrame(draw);
  }, []);

  // ── 5. Supabase channel: riceve hit dai telefoni ─────────────────────────
  useEffect(() => {
    const channel = supabase.channel(`band_game_${pubCode}`, {
      config: { broadcast: { self: false } }
    });

    channel.on('broadcast', { event: 'band_hit' }, ({ payload }) => {
      const { nickname, lane, accuracy, points } = payload;

      // Aggiorna organo: ogni hit aggiunge volume temporaneamente
      if (organGainRef.current && gameState === 'playing') {
        const gain = organGainRef.current.gain;
        const now = audioCtxRef.current?.currentTime || 0;
        // Porta il volume a 1 e fai decadere
        gain.cancelScheduledValues(now);
        gain.setValueAtTime(Math.min(1, gain.value + 0.35), now);
        gain.exponentialRampToValueAtTime(0.01, now + 2.5);
        setOrganLevel(v => Math.min(1, v + 0.35));
      }

      // Feedback visivo
      const text = accuracy < PERF_WINDOW
        ? '✨ PERFECT' : accuracy < GOOD_WINDOW
        ? '⚡ GOOD' : '✓ HIT';
      const color = accuracy < PERF_WINDOW ? '#ffd100'
        : accuracy < GOOD_WINDOW ? '#39ff84' : '#00d4ff';

      const feedId = Date.now() + Math.random();
      setHitFeedback(prev => [...prev.slice(-8), { id: feedId, text, lane, color, nickname }]);
      setTimeout(() => setHitFeedback(prev => prev.filter(f => f.id !== feedId)), 900);

      // Score + players
      setScore(s => s + points);
      setCombo(c => c + 1);
      setPlayers(prev => {
        const p = prev[nickname] || { score: 0, combo: 0 };
        return { ...prev, [nickname]: { score: p.score + points, combo: p.combo + 1 } };
      });
    });

    channel.on('broadcast', { event: 'band_miss' }, ({ payload }) => {
      const { nickname } = payload;
      setPlayers(prev => {
        const p = prev[nickname] || { score: 0, combo: 0 };
        return { ...prev, [nickname]: { ...p, combo: 0 } };
      });
      setCombo(0);
    });

    channel.subscribe();
    channelRef.current = channel;
    return () => supabase.removeChannel(channel);
  }, [pubCode, gameState]);

  // ── Cleanup ───────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      cancelAnimationFrame(animRef.current);
      baseRef.current?.pause();
      organRef.current?.pause();
    };
  }, []);

  const song = session?.song || 'deepdown';

  return (
    <div style={{
      width: '100%', height: '100%', background: '#08080f',
      display: 'grid', gridTemplateColumns: '1fr 280px',
      fontFamily: "'JetBrains Mono', monospace", color: '#fff',
    }}>
      {/* ── Colonna sinistra: canvas note ── */}
      <div style={{ position: 'relative', overflow: 'hidden' }}>
        <canvas
          ref={canvasRef}
          width={900} height={600}
          style={{ width: '100%', height: '100%' }}
        />

        {/* Feedback hit flottanti */}
        {hitFeedback.map(f => (
          <div key={f.id} style={{
            position: 'absolute',
            left: `${f.lane * 33.3 + 10}%`,
            top: '70%',
            color: f.color,
            fontSize: '18px',
            fontWeight: 900,
            textShadow: `0 0 20px ${f.color}`,
            animation: 'hitPop 0.9s ease forwards',
            pointerEvents: 'none',
          }}>
            {f.text}
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', fontWeight: 400 }}>
              {f.nickname}
            </div>
          </div>
        ))}

        {/* Bottone start */}
        {gameState === 'waiting' && chart && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.75)',
          }}>
            <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)', marginBottom: '16px', letterSpacing: '0.3em', textTransform: 'uppercase' }}>
              {chart.length} note caricate
            </div>
            <button onClick={startSong} style={{
              padding: '18px 48px', fontSize: '22px', fontWeight: 900,
              background: '#ffd100', color: '#000', border: 'none',
              borderRadius: '12px', cursor: 'pointer', letterSpacing: '0.15em',
              boxShadow: '0 0 40px rgba(255,209,0,0.5)',
            }}>
              ▶ START
            </button>
          </div>
        )}

        {!chart && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.8)' }}>
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '14px' }}>Caricamento chart...</p>
          </div>
        )}
      </div>

      {/* ── Colonna destra: score + players ── */}
      <div style={{
        background: '#0d0d18', borderLeft: '1px solid rgba(255,255,255,0.07)',
        padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: '24px',
      }}>
        {/* Score totale */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.3em', marginBottom: '4px' }}>SCORE</div>
          <div style={{ fontSize: '42px', fontWeight: 900, color: '#ffd100', textShadow: '0 0 20px rgba(255,209,0,0.5)' }}>
            {score.toLocaleString()}
          </div>
          {combo > 1 && (
            <div style={{ fontSize: '13px', color: '#39ff84', fontWeight: 700 }}>
              x{combo} COMBO
            </div>
          )}
        </div>

        {/* Volume organo */}
        <div>
          <div style={{ fontSize: '10px', color: '#00d4ff', letterSpacing: '0.3em', marginBottom: '8px' }}>ORGANO</div>
          <div style={{ height: '8px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${organLevel * 100}%`,
              background: 'linear-gradient(to right, #00d4ff, #39ff84)',
              borderRadius: '4px', transition: 'width 0.1s',
            }} />
          </div>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.2)', marginTop: '4px' }}>
            colpisci le note per alzare il volume
          </div>
        </div>

        {/* Players */}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.3em', marginBottom: '12px' }}>GIOCATORI</div>
          {Object.entries(players).length === 0 && (
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.2)', textAlign: 'center', marginTop: '24px' }}>
              In attesa che i telefoni si connettano...
            </div>
          )}
          {Object.entries(players)
            .sort(([,a],[,b]) => b.score - a.score)
            .map(([nick, p]) => (
            <div key={nick} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '10px 12px', marginBottom: '6px',
              background: 'rgba(255,255,255,0.04)', borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.06)',
            }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700 }}>{nick}</div>
                {p.combo > 1 && <div style={{ fontSize: '10px', color: '#39ff84' }}>x{p.combo}</div>}
              </div>
              <div style={{ fontSize: '15px', fontWeight: 900, color: '#ffd100' }}>{p.score}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Audio elements (hidden) */}
      <audio ref={baseRef}   src={`/audio/${song}/base.mp3`}   preload="auto" />
      <audio ref={organRef}  src={`/audio/${song}/organo.mp3`} preload="auto" />

      <style>{`
        @keyframes hitPop {
          0%   { opacity: 1; transform: translateY(0) scale(1.2); }
          60%  { opacity: 1; transform: translateY(-30px) scale(1); }
          100% { opacity: 0; transform: translateY(-60px) scale(0.8); }
        }
      `}</style>
    </div>
  );
}
