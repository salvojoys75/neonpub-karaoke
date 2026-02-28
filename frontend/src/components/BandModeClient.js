import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

// ── SYNC CONFIG ──
// Compensiamo il tempo che il messaggio ci mette ad arrivare dal server (es. 250ms)
const NETWORK_LATENCY_COMPENSATION = 250; 
// ─────────────────

const HIT_WINDOW  = 0.18;
const GOOD_WINDOW = 0.09;
const PERF_WINDOW = 0.045;
const NOTE_LEAD   = 3.0;
const COLORS      = ['#ff3b5c', '#00d4ff', '#39ff84'];
const POINTS      = { perfect: 100, good: 60, hit: 30 };

export default function BandModeClient({ pubCode, participant }) {
  const [gameState, setGameState] = useState('waiting'); // waiting | playing
  const [countdown, setCountdown] = useState(null);      // Per visualizzare -3, -2...
  const [score, setScore]         = useState(0);
  const [combo, setCombo]         = useState(0);
  const [feedback, setFeedback]   = useState(null);
  const [pressing, setPressing]   = useState([false, false, false]);

  const channelRef   = useRef(null);
  const notesRef     = useRef([]);
  const startTimeRef = useRef(null);
  const canvasRef    = useRef(null);
  const animRef      = useRef(null);
  const scoreRef     = useRef(0);
  const comboRef     = useRef(0);

  const nickname = participant?.nickname || 'Player';

  // Calcola tempo trascorso. 
  // Se restituisce un numero negativo (es. -3.5), siamo nel countdown.
  // Se positivo, la canzone è iniziata.
  const getElapsed = useCallback(() => {
    if (!startTimeRef.current) return -999;
    return (Date.now() - startTimeRef.current) / 1000;
  }, []);

  // ── Render Loop ───────────────────────────────────────────────────────────
  const startDrawLoop = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const DPR = window.devicePixelRatio || 1;
    const cW = canvas.offsetWidth;
    const cH = canvas.offsetHeight;
    canvas.width  = cW * DPR; canvas.height = cH * DPR;
    const ctx = canvas.getContext('2d');
    ctx.scale(DPR, DPR);
    const lW = cW / 3, hitY = cH * 0.82;

    function draw() {
      const elapsed = getElapsed();
      ctx.clearRect(0, 0, cW, cH);

      // ── FASE COUNTDOWN (Tempo Negativo) ──
      if (elapsed < 0) {
        const sec = Math.ceil(Math.abs(elapsed));
        setCountdown(sec > 0 ? sec : "GO!");
        
        // Disegna sfondo statico
        for (let l = 0; l < 3; l++) {
          ctx.fillStyle = l % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent';
          ctx.fillRect(l * lW, 0, lW, cH);
          if (l > 0) { ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.beginPath(); ctx.moveTo(l*lW,0); ctx.lineTo(l*lW,cH); ctx.stroke(); }
        }
        // Testo gigante
        ctx.fillStyle = "white"; ctx.font = "bold 80px monospace"; ctx.textAlign = "center";
        ctx.fillText(sec, cW / 2, cH / 2);
        
        animRef.current = requestAnimationFrame(draw);
        return;
      }

      // ── FASE GIOCO ──
      if (countdown !== null) setCountdown(null);

      // Sfondo
      for (let l = 0; l < 3; l++) {
        ctx.fillStyle = l % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent';
        ctx.fillRect(l * lW, 0, lW, cH);
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 1;
      for (let l = 1; l < 3; l++) { ctx.beginPath(); ctx.moveTo(l * lW, 0); ctx.lineTo(l * lW, cH); ctx.stroke(); }
      
      // Hit Line
      ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 2; ctx.setLineDash([5, 4]);
      ctx.beginPath(); ctx.moveTo(0, hitY); ctx.lineTo(cW, hitY); ctx.stroke(); ctx.setLineDash([]);
      
      // Cerchi tasti
      for (let l = 0; l < 3; l++) {
        const cx = l * lW + lW / 2;
        ctx.strokeStyle = COLORS[l] + '55'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(cx, hitY, 14, 0, Math.PI * 2); ctx.stroke();
      }

      // Note
      for (const note of notesRef.current) {
        if (note.hit || note.missed) continue;
        const tti = note.time - elapsed;
        
        // Disegna solo note visibili
        if (tti > NOTE_LEAD + 0.1) continue;
        
        // Miss logic
        if (tti < -HIT_WINDOW - 0.05) { note.missed = true; comboRef.current = 0; setCombo(0); continue; }

        const y = (1 - tti / NOTE_LEAD) * hitY;
        const cx = note.lane * lW + lW / 2;
        const col = COLORS[note.lane];

        ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = 14; ctx.fillStyle = col;
        ctx.beginPath(); ctx.moveTo(cx, y - 11); ctx.lineTo(cx + 9, y); ctx.lineTo(cx, y + 11); ctx.lineTo(cx - 9, y);
        ctx.closePath(); ctx.fill(); ctx.restore();
      }
      animRef.current = requestAnimationFrame(draw);
    }
    animRef.current = requestAnimationFrame(draw);
  }, [getElapsed, countdown]);

  // ── Start Game Logic ──
  const startGame = useCallback((chart, delay) => {
    // SYNC FIX: Impostiamo l'orario di inizio nel futuro (es. tra 4 sec)
    // Sottraiamo la latenza stimata per essere più precisi
    const adjustedDelay = Math.max(0, delay - NETWORK_LATENCY_COMPENSATION);
    
    // startTimeRef.current diventa un timestamp nel futuro.
    // Finché Date.now() < startTimeRef, getElapsed() sarà negativo -> Countdown
    startTimeRef.current = Date.now() + adjustedDelay;
    
    notesRef.current = chart.map((n, i) => ({ ...n, id: i, hit: false, missed: false }));
    scoreRef.current = 0; comboRef.current = 0; setScore(0); setCombo(0);
    setGameState('playing');
    startDrawLoop();
  }, [startDrawLoop]);

  // ── Hit Handler ──
  const handleHit = useCallback(async (lane) => {
    if (gameState !== 'playing') return;
    const elapsed = getElapsed();
    
    // Impedisci di premere note se il countdown non è finito (elapsed negativo)
    if (elapsed < 0) return; 

    let best = null, bestDist = Infinity;
    for (const note of notesRef.current) {
      if (note.hit || note.missed || note.lane !== lane) continue;
      const d = Math.abs(note.time - elapsed);
      if (d < HIT_WINDOW && d < bestDist) { best = note; bestDist = d; }
    }

    if (best) {
      best.hit = true;
      const isPerfect = bestDist < PERF_WINDOW, isGood = bestDist < GOOD_WINDOW;
      const label = isPerfect ? '✨ PERFECT!' : isGood ? '⚡ GOOD!' : '✓ HIT';
      const color = isPerfect ? '#ffd100' : isGood ? '#39ff84' : '#00d4ff';
      const pts = isPerfect ? POINTS.perfect : isGood ? POINTS.good : POINTS.hit;

      scoreRef.current += pts; comboRef.current += 1;
      setScore(scoreRef.current); setCombo(comboRef.current);
      setFeedback({ text: label, color, lane }); setTimeout(() => setFeedback(null), 600);
      await channelRef.current?.send({ type: 'broadcast', event: 'band_hit', payload: { nickname, lane, accuracy: bestDist, points: pts } });
    } else {
      comboRef.current = 0; setCombo(0);
      setFeedback({ text: '✗ MISS', color: '#ff3b5c88', lane }); setTimeout(() => setFeedback(null), 400);
      await channelRef.current?.send({ type: 'broadcast', event: 'band_miss', payload: { nickname, lane } });
    }
  }, [gameState, getElapsed, nickname]);

  // ── Supabase Listener ──
  useEffect(() => {
    const ch = supabase.channel(`band_game_${pubCode}`, { config: { broadcast: { self: true } } });
    ch.on('broadcast', { event: 'band_start' }, ({ payload }) => {
      // Riceviamo la chart e il ritardo (es. 4000ms)
      startGame(payload.chart, payload.startDelay);
    });
    ch.subscribe();
    channelRef.current = ch;
    return () => { supabase.removeChannel(ch); cancelAnimationFrame(animRef.current); };
  }, [pubCode, startGame]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#08080f', fontFamily: "'JetBrains Mono', monospace", overflow: 'hidden', userSelect: 'none', WebkitUserSelect: 'none' }}>
      {/* Top Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 16px', background: '#0d0d18', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
        <div style={{ fontSize: '18px', fontWeight: 900, color: '#ffd100' }}>{score.toLocaleString()}</div>
        {combo > 1 && <div style={{ fontSize: '13px', fontWeight: 900, color: '#39ff84', textShadow: '0 0 10px #39ff84' }}>x{combo}</div>}
        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>{gameState === 'playing' ? '● LIVE' : '⏳ attesa...'}</div>
      </div>
      
      {/* Canvas Area */}
      <div style={{ flex: '0 0 28vh', position: 'relative' }}>
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
        {gameState === 'waiting' && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(8,8,15,0.9)' }}>
            <div style={{ width: '32px', height: '32px', border: '3px solid #ffd100', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginBottom: '12px' }} />
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.25em' }}>IN ATTESA...</div>
          </div>
        )}
        {feedback && <div style={{ position: 'absolute', left: `${feedback.lane * 33.3 + 16.6}%`, top: '55%', transform: 'translateX(-50%)', fontSize: '15px', fontWeight: 900, color: feedback.color, textShadow: `0 0 14px ${feedback.color}`, animation: 'feedPop 0.6s ease forwards', pointerEvents: 'none', whiteSpace: 'nowrap' }}>{feedback.text}</div>}
      </div>

      {/* Buttons */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px', padding: '4px', background: '#050508' }}>
        {[0, 1, 2].map(l => (
          <button key={l} onPointerDown={e => { e.preventDefault(); setPressing(p => { const n = [...p]; n[l] = true; return n; }); handleHit(l); }} onPointerUp={() => setPressing(p => { const n = [...p]; n[l] = false; return n; })} onPointerCancel={() => setPressing(p => { const n = [...p]; n[l] = false; return n; })}
            style={{ background: pressing[l] ? `${COLORS[l]}40` : `${COLORS[l]}12`, border: `3px solid ${COLORS[l]}${pressing[l] ? 'ff' : '55'}`, borderRadius: '16px', color: COLORS[l], fontSize: '44px', fontWeight: 900, cursor: 'pointer', WebkitTapHighlightColor: 'transparent', touchAction: 'none', transition: 'background 0.06s, border-color 0.06s', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: pressing[l] ? `0 0 30px ${COLORS[l]}66` : 'none' }}>
            {['F', 'G', 'H'][l]}
          </button>
        ))}
      </div>
      <style>{`@keyframes feedPop { 0% { opacity: 1; transform: translateX(-50%) scale(1.2); } 100% { opacity: 0; transform: translateX(-50%) translateY(-25px) scale(0.9); } } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}