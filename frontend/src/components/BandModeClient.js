/**
 * BandModeClient.js
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

// ── TWEAK SYNC HERE ──
const OFFSET_MS   = 0;     // Aggiungi +/- secondi se vuoi anticipare/ritardare i telefoni manualmente
// ─────────────────────

const HIT_WINDOW  = 0.18;
const GOOD_WINDOW = 0.09;
const PERF_WINDOW = 0.045;
const NOTE_LEAD   = 3.0;
const COLORS      = ['#ff3b5c', '#00d4ff', '#39ff84'];
const POINTS      = { perfect: 100, good: 60, hit: 30 };

export default function BandModeClient({ pubCode, participant }) {
  const [gameState, setGameState] = useState('waiting'); // waiting | playing
  const [countdown, setCountdown] = useState(null);      // Per visualizzare il -3, -2...
  const [score, setScore]         = useState(0);
  const [combo, setCombo]         = useState(0);
  const [feedback, setFeedback]   = useState(null);
  const [pressing, setPressing]   = useState([false, false, false]);

  const channelRef   = useRef(null);
  const notesRef     = useRef([]);
  const startTimeRef = useRef(null); // Questo sarà il timestamp FUTURO inviato dal server
  const canvasRef    = useRef(null);
  const animRef      = useRef(null);
  const scoreRef     = useRef(0);
  const comboRef     = useRef(0);

  const nickname = participant?.nickname || 'Player';

  // Calcola il tempo passato rispetto allo Start Time stabilito dal server
  const getElapsed = useCallback(() => {
    if (!startTimeRef.current) return -999;
    const now = Date.now();
    // (Adesso - StartTimeFissato) / 1000 = secondi passati dall'inizio della canzone
    // Se è negativo, significa che siamo ancora nel countdown
    return ((now - startTimeRef.current) / 1000) + OFFSET_MS;
  }, []);

  // ── Draw Loop ─────────────────────────────────────────────────────────────
  const startDrawLoop = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const DPR = window.devicePixelRatio || 1;
    const cW = canvas.offsetWidth;
    const cH = canvas.offsetHeight;
    canvas.width  = cW * DPR;
    canvas.height = cH * DPR;
    const ctx = canvas.getContext('2d');
    ctx.scale(DPR, DPR);

    const lW  = cW / 3;
    const hitY = cH * 0.82;

    function draw() {
      const elapsed = getElapsed();
      ctx.clearRect(0, 0, cW, cH);

      // SE SIAMO NEL COUNTDOWN (Tempo negativo)
      if (elapsed < 0) {
        const secondsLeft = Math.ceil(Math.abs(elapsed));
        setCountdown(secondsLeft > 0 ? secondsLeft : "GO!");
        
        // Disegna comunque lo sfondo
        for (let l = 0; l < 3; l++) {
          ctx.fillStyle = l % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent';
          ctx.fillRect(l * lW, 0, lW, cH);
          if(l>0) { ctx.beginPath(); ctx.moveTo(l*lW, 0); ctx.lineTo(l*lW, cH); ctx.stroke(); }
        }
        
        // Testo countdown gigante su canvas
        ctx.fillStyle = "white";
        ctx.font = "bold 60px monospace";
        ctx.textAlign = "center";
        ctx.fillText(secondsLeft, cW/2, cH/2);
        
        animRef.current = requestAnimationFrame(draw);
        return;
      }
      
      // Countdown finito
      if (countdown !== null) setCountdown(null);

      // Sfondo
      for (let l = 0; l < 3; l++) {
        ctx.fillStyle = l % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent';
        ctx.fillRect(l * lW, 0, lW, cH);
      }
      // Linee
      ctx.strokeStyle = 'rgba(255,255,255,0.07)';
      ctx.lineWidth = 1;
      for (let l = 1; l < 3; l++) {
        ctx.beginPath(); ctx.moveTo(l * lW, 0); ctx.lineTo(l * lW, cH); ctx.stroke();
      }
      // Hit Line
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      ctx.beginPath(); ctx.moveTo(0, hitY); ctx.lineTo(cW, hitY); ctx.stroke();
      ctx.setLineDash([]);
      
      // Cerchi
      for (let l = 0; l < 3; l++) {
        const cx = l * lW + lW / 2;
        ctx.strokeStyle = COLORS[l] + '55';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(cx, hitY, 14, 0, Math.PI * 2); ctx.stroke();
      }

      // Note
      for (const note of notesRef.current) {
        if (note.hit || note.missed) continue;
        const tti = note.time - elapsed;
        
        if (tti > NOTE_LEAD + 0.1) continue;
        if (tti < -HIT_WINDOW - 0.05) { note.missed = true; comboRef.current = 0; setCombo(0); continue; }

        const y = (1 - tti / NOTE_LEAD) * hitY;
        const cx = note.lane * lW + lW / 2;
        const col = COLORS[note.lane];

        ctx.save();
        ctx.shadowColor = col; ctx.shadowBlur = 14;
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(cx, y - 11); ctx.lineTo(cx + 9, y);
        ctx.lineTo(cx, y + 11); ctx.lineTo(cx - 9, y);
        ctx.closePath(); ctx.fill();
        ctx.restore();
      }

      animRef.current = requestAnimationFrame(draw);
    }
    animRef.current = requestAnimationFrame(draw);
  }, [getElapsed, countdown]);

  // ── Start Game ────────────────────────────────────────────────────────────
  const startGame = useCallback((chart, startTime) => {
    // Riceviamo startTime che è nel futuro (es. tra 3 sec)
    // Non dobbiamo calcolare latenza qui, perché startTime è un orario assoluto "universale"
    startTimeRef.current = startTime;
    
    notesRef.current = chart.map((n, i) => ({ ...n, id: i, hit: false, missed: false }));
    scoreRef.current = 0; 
    comboRef.current = 0;
    setScore(0); 
    setCombo(0);
    setGameState('playing');
    startDrawLoop();
  }, [startDrawLoop]);

  // ── Hit Handler ───────────────────────────────────────────────────────────
  const handleHit = useCallback(async (lane) => {
    if (gameState !== 'playing') return;
    const elapsed = getElapsed();
    if (elapsed < 0) return; // Non accettare input durante countdown

    let best = null, bestDist = Infinity;
    for (const note of notesRef.current) {
      if (note.hit || note.missed || note.lane !== lane) continue;
      const d = Math.abs(note.time - elapsed);
      if (d < HIT_WINDOW && d < bestDist) { best = note; bestDist = d; }
    }

    if (best) {
      best.hit = true;
      const isPerfect = bestDist < PERF_WINDOW;
      const isGood    = bestDist < GOOD_WINDOW;
      const label = isPerfect ? '✨ PERFECT!' : isGood ? '⚡ GOOD!' : '✓ HIT';
      const color = isPerfect ? '#ffd100' : isGood ? '#39ff84' : '#00d4ff';
      const pts   = isPerfect ? POINTS.perfect : isGood ? POINTS.good : POINTS.hit;

      scoreRef.current += pts; comboRef.current += 1;
      setScore(scoreRef.current); setCombo(comboRef.current);
      setFeedback({ text: label, color, lane });
      setTimeout(() => setFeedback(null), 600);

      await channelRef.current?.send({
        type: 'broadcast', event: 'band_hit',
        payload: { nickname, lane, accuracy: bestDist, points: pts },
      });
    } else {
      comboRef.current = 0; setCombo(0);
      setFeedback({ text: '✗ MISS', color: '#ff3b5c88', lane });
      setTimeout(() => setFeedback(null), 400);
      await channelRef.current?.send({
        type: 'broadcast', event: 'band_miss',
        payload: { nickname, lane },
      });
    }
  }, [gameState, getElapsed, nickname]);

  // ── Supabase ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const ch = supabase.channel(`band_game_${pubCode}`, {
      config: { broadcast: { self: true } }
    });
    ch.on('broadcast', { event: 'band_start' }, ({ payload }) => {
      // Payload contiene { startTime: 1234567890 } che è nel futuro
      startGame(payload.chart, payload.startTime);
    });
    ch.subscribe();
    channelRef.current = ch;
    return () => { supabase.removeChannel(ch); cancelAnimationFrame(animRef.current); };
  }, [pubCode, startGame]);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100vh', background: '#08080f',
      fontFamily: "'JetBrains Mono', monospace", overflow: 'hidden', userSelect: 'none', WebkitUserSelect: 'none',
    }}>
      {/* Score bar */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 16px',
        background: '#0d0d18', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0,
      }}>
        <div style={{ fontSize: '18px', fontWeight: 900, color: '#ffd100' }}>{score.toLocaleString()}</div>
        {combo > 1 && <div style={{ fontSize: '13px', fontWeight: 900, color: '#39ff84', textShadow: '0 0 10px #39ff84' }}>x{combo}</div>}
        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>{gameState === 'playing' ? '● LIVE' : '⏳ attesa...'}</div>
      </div>

      {/* Canvas */}
      <div style={{ flex: '0 0 28vh', position: 'relative' }}>
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
        
        {/* Waiting Screen */}
        {gameState === 'waiting' && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', background: 'rgba(8,8,15,0.9)',
          }}>
            <div style={{
              width: '32px', height: '32px', border: '3px solid #ffd100', borderTopColor: 'transparent',
              borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginBottom: '12px',
            }} />
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.25em' }}>IN ATTESA DEL VENUE...</div>
          </div>
        )}

        {/* Feedback */}
        {feedback && (
          <div style={{
            position: 'absolute', left: `${feedback.lane * 33.3 + 16.6}%`, top: '55%', transform: 'translateX(-50%)',
            fontSize: '15px', fontWeight: 900, color: feedback.color, textShadow: `0 0 14px ${feedback.color}`,
            animation: 'feedPop 0.6s ease forwards', pointerEvents: 'none', whiteSpace: 'nowrap',
          }}>
            {feedback.text}
          </div>
        )}
      </div>

      {/* Buttons */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px', padding: '4px', background: '#050508' }}>
        {[0, 1, 2].map(lane => (
          <button key={lane}
            onPointerDown={e => { e.preventDefault(); setPressing(p => { const n=[...p]; n[lane]=true; return n; }); handleHit(lane); }}
            onPointerUp={() => setPressing(p => { const n=[...p]; n[lane]=false; return n; })}
            onPointerCancel={() => setPressing(p => { const n=[...p]; n[lane]=false; return n; })}
            style={{
              background: pressing[lane] ? `${COLORS[lane]}40` : `${COLORS[lane]}12`,
              border: `3px solid ${COLORS[lane]}${pressing[lane] ? 'ff' : '55'}`,
              borderRadius: '16px', color: COLORS[lane], fontSize: '44px', fontWeight: 900,
              cursor: 'pointer', WebkitTapHighlightColor: 'transparent', touchAction: 'none',
              transition: 'background 0.06s, border-color 0.06s',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: pressing[lane] ? `0 0 30px ${COLORS[lane]}66` : 'none',
            }}
          >
            {['F', 'G', 'H'][lane]}
          </button>
        ))}
      </div>
      <style>{`
        @keyframes feedPop { 0% { opacity: 1; transform: translateX(-50%) scale(1.2); } 100% { opacity: 0; transform: translateX(-50%) translateY(-25px) scale(0.9); } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}