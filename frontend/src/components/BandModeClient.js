import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

// ── CONFIGURAZIONE ────────────────────────────────────────────────────────────
const OFFSET_LATENZA = 400;
const HIT_WINDOW  = 0.20;
const GOOD_WINDOW = 0.10;
const PERF_WINDOW = 0.05;
const NOTE_LEAD   = 3.0;
const POINTS      = { perfect: 100, good: 60, hit: 30 };

// Colori e icone per strumento
const INSTRUMENT_CONFIG = {
  keys:   { color: '#00d4ff', icon: '🎹', label: 'TASTIERA',  lanes: ['Do', 'Re', 'Mi'] },
  drums:  { color: '#ff3b5c', icon: '🥁', label: 'BATTERIA',  lanes: ['CASSA', 'RUL', 'PIATTO'] },
  bass:   { color: '#39ff84', icon: '🎸', label: 'BASSO',     lanes: ['L', 'M', 'H'] },
  brass:  { color: '#ffd100', icon: '🎺', label: 'FIATI',     lanes: ['LOW', 'MID', 'HIGH'] },
  guitar: { color: '#ff8c00', icon: '🎸', label: 'CHITARRA',  lanes: ['E', 'A', 'D'] },
};

const DEFAULT_CONFIG = { color: '#ffffff', icon: '🎵', label: 'STRUMENTO', lanes: ['1', '2', '3'] };

export default function BandModeClient({ pubCode, participant }) {
  const [gameState, setGameState] = useState('waiting');   // waiting | assigned | loading | playing
  const [myRole,    setMyRole]    = useState(null);        // 'keys' | 'drums' | 'bass' | null
  const [score,     setScore]     = useState(0);
  const [combo,     setCombo]     = useState(0);
  const [feedback,  setFeedback]  = useState(null);
  const [pressing,  setPressing]  = useState([false, false, false]);
  const [connected, setConnected] = useState(false);
  const [isSpectator, setIsSpectator] = useState(false);

  const channelRef   = useRef(null);
  const notesRef     = useRef([]);
  const startTimeRef = useRef(null);
  const canvasRef    = useRef(null);
  const animRef      = useRef(null);
  const scoreRef     = useRef(0);
  const comboRef     = useRef(0);
  const myRoleRef    = useRef(null);

  const nickname = participant?.nickname || participant?.name || 'Player';
  const userId   = participant?.id || participant?.user_id || null;

  // ── Config dello strumento corrente ──────────────────────────────────────
  const instrConfig = myRole ? (INSTRUMENT_CONFIG[myRole] || DEFAULT_CONFIG) : DEFAULT_CONFIG;
  const { color: instrColor, icon: instrIcon, label: instrLabel, lanes: laneLabels } = instrConfig;

  const COLORS = [instrColor, instrColor + 'bb', instrColor + '88'];

  const getElapsed = useCallback(() => {
    if (!startTimeRef.current) return -999;
    return (Date.now() - startTimeRef.current) / 1000;
  }, []);

  // ── Render Loop ────────────────────────────────────────────────────────
  const startDrawLoop = useCallback((colorMain) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const DPR = window.devicePixelRatio || 1;
    const cW = canvas.offsetWidth;
    const cH = canvas.offsetHeight;
    canvas.width  = cW * DPR;
    canvas.height = cH * DPR;
    const ctx = canvas.getContext('2d');
    ctx.scale(DPR, DPR);
    const lW = cW / 3, hitY = cH * 0.82;

    const laneColors = [colorMain, colorMain + 'cc', colorMain + '99'];

    function draw() {
      const elapsed = getElapsed();
      ctx.clearRect(0, 0, cW, cH);

      if (elapsed < 0) {
        // Countdown
        const sec = Math.ceil(Math.abs(elapsed));
        const text = sec > 0 ? String(sec) : 'GO!';
        for (let l = 0; l < 3; l++) {
          ctx.fillStyle = 'rgba(255,255,255,0.02)';
          ctx.fillRect(l * lW, 0, lW, cH);
          if (l > 0) {
            ctx.strokeStyle = 'rgba(255,255,255,0.08)';
            ctx.beginPath(); ctx.moveTo(l*lW,0); ctx.lineTo(l*lW,cH); ctx.stroke();
          }
        }
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 80px monospace';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(text, cW/2, cH/2);
        animRef.current = requestAnimationFrame(draw);
        return;
      }

      // Sfondo corsie
      for (let l = 0; l < 3; l++) {
        ctx.fillStyle = l % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'transparent';
        ctx.fillRect(l*lW, 0, lW, cH);
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1;
      for (let l = 1; l < 3; l++) {
        ctx.beginPath(); ctx.moveTo(l*lW,0); ctx.lineTo(l*lW,cH); ctx.stroke();
      }

      // Hit line
      ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 2; ctx.setLineDash([5,4]);
      ctx.beginPath(); ctx.moveTo(0,hitY); ctx.lineTo(cW,hitY); ctx.stroke();
      ctx.setLineDash([]);

      // Cerchi tasti
      for (let l = 0; l < 3; l++) {
        const cx = l*lW + lW/2;
        ctx.strokeStyle = laneColors[l] + '55'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(cx, hitY, 14, 0, Math.PI*2); ctx.stroke();
      }

      // Note
      for (const note of notesRef.current) {
        if (note.hit || note.missed) continue;
        const tti = note.time - elapsed;
        if (tti > NOTE_LEAD + 0.1) continue;
        if (tti < -HIT_WINDOW - 0.1) {
          note.missed = true;
          comboRef.current = 0;
          setCombo(0);
          continue;
        }

        const y   = (1 - tti / NOTE_LEAD) * hitY;
        const cx  = note.lane * lW + lW / 2;
        const col = laneColors[note.lane] || colorMain;

        ctx.save();
        ctx.shadowColor = col; ctx.shadowBlur = 14; ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(cx, y-11); ctx.lineTo(cx+9, y); ctx.lineTo(cx, y+11); ctx.lineTo(cx-9, y);
        ctx.closePath(); ctx.fill();
        ctx.restore();
      }

      // Label corsie (in basso)
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      for (let l = 0; l < 3; l++) {
        ctx.fillText(laneLabels[l] || String(l+1), l*lW + lW/2, cH - 4);
      }

      animRef.current = requestAnimationFrame(draw);
    }
    animRef.current = requestAnimationFrame(draw);
  }, [getElapsed, laneLabels]);

  // ── Start Game ────────────────────────────────────────────────────────
  const startGame = useCallback((chartData, delay, role) => {
    const adjustedStart = Date.now() + delay - OFFSET_LATENZA;
    startTimeRef.current = adjustedStart;
    notesRef.current = chartData.map((n, i) => ({ ...n, id: i, hit: false, missed: false }));
    scoreRef.current = 0; comboRef.current = 0;
    setScore(0); setCombo(0);
    setGameState('playing');
    const config = INSTRUMENT_CONFIG[role] || DEFAULT_CONFIG;
    startDrawLoop(config.color);
  }, [startDrawLoop]);

  // ── Hit Handler ───────────────────────────────────────────────────────
  const handleHit = useCallback(async (lane) => {
    if (gameState !== 'playing') return;
    const elapsed = getElapsed();
    if (elapsed < -1.0) return;

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
      const col   = isPerfect ? '#ffd100'     : isGood ? '#39ff84' : instrColor;
      const pts   = isPerfect ? POINTS.perfect : isGood ? POINTS.good : POINTS.hit;

      scoreRef.current += pts; comboRef.current += 1;
      setScore(scoreRef.current); setCombo(comboRef.current);
      setFeedback({ text: label, color: col, lane });
      setTimeout(() => setFeedback(null), 600);

      await channelRef.current?.send({
        type: 'broadcast', event: 'band_hit',
        payload: { nickname, instrument: myRoleRef.current, lane, accuracy: bestDist, points: pts }
      });
    } else {
      comboRef.current = 0; setCombo(0);
      setFeedback({ text: '✗ MISS', color: '#ff3b5c88', lane });
      setTimeout(() => setFeedback(null), 400);
      await channelRef.current?.send({
        type: 'broadcast', event: 'band_miss',
        payload: { nickname, instrument: myRoleRef.current, lane }
      });
    }
  }, [gameState, getElapsed, nickname, instrColor]);

  // ── Supabase ──────────────────────────────────────────────────────────
  useEffect(() => {
    const ch = supabase.channel(`band_game_${pubCode}`, {
      config: { broadcast: { self: true } }
    });

    // Ricezione assegnazioni
    ch.on('broadcast', { event: 'band_setup' }, ({ payload }) => {
      const assignments = payload.assignments || [];
      // Cerca il mio ruolo per userId o nickname
      const mine = assignments.find(a =>
        (userId && a.userId === userId) || a.nickname === nickname
      );

      if (mine) {
        setMyRole(mine.instrument);
        myRoleRef.current = mine.instrument;
        setIsSpectator(false);
        setGameState('assigned');
      } else {
        // Sono spettatore
        setIsSpectator(true);
        setMyRole(null);
        myRoleRef.current = null;
        setGameState('waiting');
      }
    });

    // Start effettivo
    ch.on('broadcast', { event: 'band_start' }, async ({ payload }) => {
      const role = myRoleRef.current;
      if (!role) return; // Spettatore: ignora

      setGameState('loading');
      const songName = payload.song || 'deepdown';
      const chartFile = `chart_${role}.json`;

      try {
        const res = await fetch(`/audio/${songName}/${chartFile}`);
        if (!res.ok) throw new Error(`Chart ${chartFile} non trovata`);
        const chartData = await res.json();
        startGame(chartData, payload.startDelay, role);
      } catch (err) {
        console.error('Errore caricamento chart:', err);
        setFeedback({ text: 'ERRORE CHART', color: 'red', lane: 1 });
        setGameState('assigned');
      }
    });

    ch.subscribe(status => setConnected(status === 'SUBSCRIBED'));
    channelRef.current = ch;

    return () => {
      supabase.removeChannel(ch);
      cancelAnimationFrame(animRef.current);
    };
  }, [pubCode, nickname, userId, startGame]);

  // ── UI ─────────────────────────────────────────────────────────────────
  const renderWaiting = () => (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', padding: '24px' }}>
      <div style={{ fontSize: '48px' }}>🎵</div>
      <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.3em', textAlign: 'center' }}>
        IN ATTESA<br/>DEL DJ
      </div>
      <div style={{ width: '32px', height: '32px', border: '3px solid rgba(255,255,255,0.2)', borderTopColor: '#ffd100', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  );

  const renderSpectator = () => (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', padding: '24px' }}>
      <div style={{ fontSize: '48px' }}>👀</div>
      <div style={{ fontSize: '16px', fontWeight: 900, color: '#ffd100' }}>SPETTATORE</div>
      <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>
        Non sei stato selezionato.<br/>Goditi lo show!
      </div>
    </div>
  );

  const renderAssigned = () => (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px', padding: '24px' }}>
      <div style={{ fontSize: '72px' }}>{instrIcon}</div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.3em', marginBottom: '4px' }}>IL TUO RUOLO</div>
        <div style={{ fontSize: '28px', fontWeight: 900, color: instrColor, textShadow: `0 0 20px ${instrColor}` }}>
          {instrLabel}
        </div>
      </div>
      <div style={{ width: '32px', height: '32px', border: `3px solid ${instrColor}44`, borderTopColor: instrColor, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)', letterSpacing: '0.2em' }}>
        IN ATTESA DEL VIA...
      </div>
    </div>
  );

  const renderLoading = () => (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
      <div style={{ width: '32px', height: '32px', border: `3px solid ${instrColor}44`, borderTopColor: instrColor, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.25em' }}>CARICO LA CHART...</div>
    </div>
  );

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100vh',
      background: '#08080f',
      fontFamily: "'JetBrains Mono', monospace",
      overflow: 'hidden',
      userSelect: 'none',
      WebkitUserSelect: 'none',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '8px 16px',
        background: '#0d0d18',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '20px' }}>{instrIcon}</span>
          <div>
            <div style={{ fontSize: '11px', color: instrColor, fontWeight: 700, letterSpacing: '0.2em' }}>
              {myRole ? instrLabel : 'BAND MODE'}
            </div>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)' }}>{nickname}</div>
          </div>
        </div>
        {gameState === 'playing' && (
          <div style={{ fontSize: '20px', fontWeight: 900, color: '#ffd100' }}>
            {score.toLocaleString()}
          </div>
        )}
        {combo > 1 && gameState === 'playing' && (
          <div style={{ fontSize: '13px', fontWeight: 900, color: '#39ff84', textShadow: '0 0 10px #39ff84' }}>
            ×{combo}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: connected ? '#39ff84' : '#ff3b5c' }} />
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)' }}>
            {gameState === 'playing' ? 'LIVE' : connected ? 'OK' : 'OFF'}
          </div>
        </div>
      </div>

      {/* Area canvas (solo durante il gioco) */}
      {(gameState === 'playing' || gameState === 'loading') && (
        <div style={{ flex: '0 0 30vh', position: 'relative' }}>
          <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
          {gameState === 'loading' && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(8,8,15,0.9)' }}>
              <div style={{ width: '32px', height: '32px', border: `3px solid ${instrColor}44`, borderTopColor: instrColor, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            </div>
          )}
          {feedback && (
            <div style={{
              position: 'absolute',
              left: `${feedback.lane * 33.3 + 16.6}%`,
              top: '50%',
              transform: 'translateX(-50%)',
              fontSize: '15px', fontWeight: 900,
              color: feedback.color,
              textShadow: `0 0 14px ${feedback.color}`,
              animation: 'feedPop 0.6s ease forwards',
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
            }}>
              {feedback.text}
            </div>
          )}
        </div>
      )}

      {/* Stato non-playing */}
      {gameState === 'waiting'  && !isSpectator && renderWaiting()}
      {gameState === 'waiting'  && isSpectator  && renderSpectator()}
      {gameState === 'assigned' && renderAssigned()}
      {gameState === 'loading'  && !canvasRef.current && renderLoading()}

      {/* Tasti (solo durante il gioco) */}
      {gameState === 'playing' && (
        <div style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: '4px',
          padding: '4px',
          background: '#050508',
        }}>
          {[0, 1, 2].map(l => {
            const col = INSTRUMENT_CONFIG[myRole]?.color || '#ffffff';
            const isPress = pressing[l];
            return (
              <button
                key={l}
                onPointerDown={e => {
                  e.preventDefault();
                  setPressing(p => { const n=[...p]; n[l]=true; return n; });
                  handleHit(l);
                }}
                onPointerUp={() => setPressing(p => { const n=[...p]; n[l]=false; return n; })}
                onPointerCancel={() => setPressing(p => { const n=[...p]; n[l]=false; return n; })}
                style={{
                  background:   isPress ? `${col}40` : `${col}10`,
                  border:       `3px solid ${col}${isPress ? 'ff' : '44'}`,
                  borderRadius: '16px',
                  color:        col,
                  cursor:       'pointer',
                  display:      'flex',
                  flexDirection:'column',
                  alignItems:   'center',
                  justifyContent:'center',
                  gap:          '6px',
                  WebkitTapHighlightColor: 'transparent',
                  touchAction:  'none',
                  transition:   'background 0.06s, border-color 0.06s',
                  boxShadow:    isPress ? `0 0 30px ${col}55` : 'none',
                }}
              >
                <div style={{ fontSize: '40px', fontWeight: 900 }}>
                  {['F','G','H'][l]}
                </div>
                <div style={{ fontSize: '10px', opacity: 0.6, letterSpacing: '0.15em' }}>
                  {laneLabels[l]}
                </div>
              </button>
            );
          })}
        </div>
      )}

      <style>{`
        @keyframes feedPop {
          0%   { opacity:1; transform:translateX(-50%) scale(1.2); }
          100% { opacity:0; transform:translateX(-50%) translateY(-25px) scale(0.9); }
        }
        @keyframes spin { to { transform:rotate(360deg); } }
      `}</style>
    </div>
  );
}
