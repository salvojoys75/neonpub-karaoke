import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { getEventState } from '@/lib/api';

// ── CONFIGURAZIONE SINCRONIZZAZIONE (Il cuore del problema) ───────────────────
// Indica quanti millisecondi il telefono deve "ritardare" per aspettare l'audio della TV.
// VALORI CONSIGLIATI:
// 200 - 300: TV standard o casse Bluetooth (Latenza media)
// 0   - 50:  Casse via cavo dirette PC (Latenza bassa)
// 400 - 500: Impianto audio complesso / Wi-Fi lento
const SYNC_DELAY = 400; 

// Tolleranza gioco (per renderlo divertente anche se non perfettamente sincrono)
const HIT_WINDOW  = 0.25; 
const GOOD_WINDOW = 0.12;
const PERF_WINDOW = 0.06;
const NOTE_LEAD   = 3.0; // Velocità discesa note (più basso = più veloce)
const POINTS      = { perfect: 100, good: 60, hit: 30 };

// Colori fissi per corsia — rosso, giallo, verde
const LANE_COLORS = ['#ff3b5c', '#ffd100', '#39ff84'];

// Config strumenti (solo UI, niente audio)
const INSTRUMENT_CONFIG = {
  keys:   { color: '#00d4ff', icon: '🎹', label: 'TASTIERA',  lanes: ['Do', 'Re', 'Mi']         },
  drums:  { color: '#ff3b5c', icon: '🥁', label: 'BATTERIA',  lanes: ['CASSA', 'RUL', 'PIATTO'] },
  bass:   { color: '#39ff84', icon: '🎸', label: 'BASSO',     lanes: ['L', 'M', 'H']            },
  brass:  { color: '#ffd100', icon: '🎺', label: 'FIATI',     lanes: ['LOW', 'MID', 'HIGH']     },
  guitar: { color: '#ff8c00', icon: '🎸', label: 'CHITARRA',  lanes: ['E', 'A', 'D']            },
};

const DEFAULT_CONFIG = { color: '#ffffff', icon: '🎵', label: 'STRUMENTO', lanes: ['1', '2', '3'] };

export default function BandModeClient({ pubCode, participant }) {
  const [gameState,   setGameState]   = useState('waiting');
  const [myRole,      setMyRole]      = useState(null);
  const [score,       setScore]       = useState(0);
  const [combo,       setCombo]       = useState(0);
  const [feedback,    setFeedback]    = useState(null);
  const [pressing,    setPressing]    = useState([false, false, false]);
  const [connected,   setConnected]   = useState(false);
  const [isSpectator, setIsSpectator] = useState(false);

  const channelRef   = useRef(null);
  const notesRef     = useRef([]);
  const startTimeRef = useRef(null);
  const canvasRef    = useRef(null);
  const animRef      = useRef(null);
  const scoreRef     = useRef(0);
  const comboRef     = useRef(0);
  const myRoleRef    = useRef(null);
  const laneLabelsRef  = useRef([]);   
  const startGameRef   = useRef(null); 
  const nicknameRef    = useRef(null); 
  const userIdRef      = useRef(null); 

  const nickname = participant?.nickname || participant?.name || 'Player';
  const userId   = participant?.id || participant?.user_id || null;

  const instrConfig = myRole ? (INSTRUMENT_CONFIG[myRole] || DEFAULT_CONFIG) : DEFAULT_CONFIG;
  const { color: instrColor, icon: instrIcon, label: instrLabel, lanes: laneLabels } = instrConfig;

  useEffect(() => { laneLabelsRef.current = laneLabels; }, [laneLabels]);
  useEffect(() => { nicknameRef.current   = nickname; },   [nickname]);
  useEffect(() => { userIdRef.current     = userId; },     [userId]);

  const getElapsed = useCallback(() => {
    if (!startTimeRef.current) return -999;
    return (Date.now() - startTimeRef.current) / 1000;
  }, []);

  // ── Polling DB ogni 1s ─────────────────────────────────────────────────────
  useEffect(() => {
    const activeStartAtRef = { current: null };
    const isLoadingRef    = { current: false };

    const poll = async () => {
      try {
        const state = await getEventState();
        const activeBand = state?.active_module === 'band' ? state?.active_band : null;

        if (activeBand?.status === 'active' && activeBand?.startAt) {
          if (activeStartAtRef.current !== activeBand.startAt && !isLoadingRef.current) {
            activeStartAtRef.current = activeBand.startAt;

            const assignments = activeBand.assignments || [];
            const mine = assignments.find(a =>
              (userIdRef.current && a.userId === userIdRef.current) ||
              a.nickname === nicknameRef.current
            );

            if (mine) {
              const role = mine.instrument;
              setMyRole(role);
              myRoleRef.current = role;
              setIsSpectator(false);
              setGameState('loading');
              isLoadingRef.current = true;

              try {
                const res = await fetch(`/audio/${activeBand.song}/chart_${role}.json`);
                if (!res.ok) throw new Error(`chart_${role}.json non trovata`);
                const chartData = await res.json();
                startGameRef.current?.(chartData, activeBand.startAt);
              } catch (err) {
                console.error('Chart load error', err);
                setFeedback({ text: 'ERRORE CHART', color: '#ff3b5c', lane: 1 });
                setGameState('assigned');
              } finally {
                isLoadingRef.current = false;
              }
            } else if (assignments.length > 0) {
              setIsSpectator(true);
              setGameState('waiting');
              isLoadingRef.current = false;
            }
          } 
        } else if (!activeBand) {
          if (activeStartAtRef.current !== null || myRoleRef.current !== null) {
            activeStartAtRef.current = null;
            isLoadingRef.current = false;
            cancelAnimationFrame(animRef.current);
            setGameState('waiting');
            setMyRole(null);
            myRoleRef.current = null;
            setScore(0);
            setIsSpectator(false);
          }
        }
      } catch {}
    };

    poll(); 
    const interval = setInterval(poll, 1000); 
    return () => clearInterval(interval);
  }, [pubCode]); 

  // ── Start Game con CORREZIONE LATENZA ──────────────────────────────────────
  const startGame = useCallback((chartData, startAt) => {
    // 1. Prendo l'orario di start del SERVER (es. 22:00:00.000)
    // 2. Aggiungo SYNC_DELAY (es. +250ms) -> 22:00:00.250
    //    Questo significa che per il telefono, il "tempo zero" è 250ms DOPO.
    //    Quindi le note appariranno 250ms più tardi, allineandosi con l'audio lento della TV.
    const serverStartTime = new Date(startAt).getTime();
    startTimeRef.current = serverStartTime + SYNC_DELAY; 

    notesRef.current = chartData.map((n, i) => ({ ...n, id: i, hit: false, missed: false }));
    scoreRef.current = 0; comboRef.current = 0;
    setScore(0); setCombo(0);
    setGameState('playing');
    startDrawLoop();
  }, [startDrawLoop]);

  useEffect(() => { startGameRef.current = startGame; }, [startGame]);

  // ── Render Loop ────────────────────────────────────────────────────────────
  const startDrawLoop = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    function draw() {
      const elapsed = getElapsed();
      
      // Gestione resize/visibilità dinamica
      const DPR = window.devicePixelRatio || 1;
      const cW = canvas.offsetWidth;
      const cH = canvas.offsetHeight;
      if (cW === 0 || cH === 0) { animRef.current = requestAnimationFrame(draw); return; }
      
      if (canvas.width !== cW * DPR || canvas.height !== cH * DPR) {
        canvas.width = cW * DPR; canvas.height = cH * DPR;
        ctx.scale(DPR, DPR);
      }
      const lW = cW / 3, hitY = cH * 0.82;

      ctx.clearRect(0, 0, cW, cH);

      // Sfondo corsie
      for (let l = 0; l < 3; l++) {
        ctx.fillStyle = `${LANE_COLORS[l]}0d`;
        ctx.fillRect(l * lW, 0, lW, cH);
      }
      // Linee divisorie
      ctx.lineWidth = 1;
      for (let l = 1; l < 3; l++) {
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.beginPath(); ctx.moveTo(l*lW, 0); ctx.lineTo(l*lW, cH); ctx.stroke();
      }

      // Hit line
      ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 2; ctx.setLineDash([6,4]);
      ctx.beginPath(); ctx.moveTo(0, hitY); ctx.lineTo(cW, hitY); ctx.stroke(); ctx.setLineDash([]);

      // Tasti (Cerchi)
      for (let l = 0; l < 3; l++) {
        const cx = l * lW + lW / 2;
        ctx.strokeStyle = LANE_COLORS[l] + '66'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(cx, hitY, 16, 0, Math.PI * 2); ctx.stroke();
      }

      // Note
      for (const note of notesRef.current) {
        if (note.hit || note.missed) continue;
        const tti = note.time - elapsed;
        
        // Non disegnare note troppo future
        if (tti > NOTE_LEAD + 0.1) continue;
        
        // Missed (troppo tardi)
        if (tti < -HIT_WINDOW - 0.15) { 
            note.missed = true; 
            comboRef.current = 0; 
            setCombo(0); 
            continue; 
        }

        const y   = (1 - tti / NOTE_LEAD) * hitY;
        const cx  = note.lane * lW + lW / 2;
        const col = LANE_COLORS[note.lane];

        ctx.save();
        ctx.shadowColor = col; ctx.shadowBlur = 15; ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(cx, y-14); ctx.lineTo(cx+12, y); ctx.lineTo(cx, y+14); ctx.lineTo(cx-12, y);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2; ctx.stroke();
        ctx.restore();
      }

      // Labels
      ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center';
      for (let l = 0; l < 3; l++) {
        ctx.fillStyle = LANE_COLORS[l] + 'aa';
        ctx.fillText(laneLabelsRef.current[l] || String(l+1), l*lW + lW/2, cH - 6);
      }

      animRef.current = requestAnimationFrame(draw);
    }
    animRef.current = requestAnimationFrame(draw);
  }, [getElapsed]);

  // ── Hit Handler ────────────────────────────────────────────────────────────
  const handleHit = useCallback(async (lane) => {
    if (gameState !== 'playing') return;
    const elapsed = getElapsed();
    
    // Ignora tap prima che la canzone inizi davvero
    if (elapsed < -0.5) return;

    let best = null, bestDist = Infinity;
    for (const note of notesRef.current) {
      if (note.hit || note.missed || note.lane !== lane) continue;
      const d = Math.abs(note.time - elapsed);
      // Cerchiamo la nota più vicina in assoluto
      if (d < HIT_WINDOW && d < bestDist) { best = note; bestDist = d; }
    }

    if (best) {
      best.hit = true;
      const isPerfect = bestDist < PERF_WINDOW;
      const isGood    = bestDist < GOOD_WINDOW;
      
      const label = isPerfect ? '✨ PERFECT!' : isGood ? '⚡ GOOD!' : '✓ HIT';
      const col   = isPerfect ? '#ffd100'     : isGood ? '#39ff84' : LANE_COLORS[lane];
      const pts   = isPerfect ? POINTS.perfect : isGood ? POINTS.good : POINTS.hit;

      scoreRef.current += pts; 
      comboRef.current += 1;
      setScore(scoreRef.current); 
      setCombo(comboRef.current);
      
      setFeedback({ text: label, color: col, lane });
      setTimeout(() => setFeedback(null), 600);

      await channelRef.current?.send({
        type: 'broadcast', event: 'band_hit',
        payload: { nickname, instrument: myRoleRef.current, lane, accuracy: bestDist, points: pts }
      });
    } else {
      // Miss se preme a vuoto (ma solo se non ci sono note vicine, per essere gentili)
      // Qui penalizziamo sempre per evitare spam
      comboRef.current = 0; 
      setCombo(0);
      setFeedback({ text: '✗ MISS', color: '#ff3b5c88', lane });
      setTimeout(() => setFeedback(null), 400);
      await channelRef.current?.send({
        type: 'broadcast', event: 'band_miss',
        payload: { nickname, instrument: myRoleRef.current, lane }
      });
    }
  }, [gameState, getElapsed, nickname]);

  // ── Channel Supabase (Solo output) ─────────────────────────────────────────
  useEffect(() => {
    const ch = supabase.channel(`band_game_${pubCode}`);
    ch.subscribe(status => setConnected(status === 'SUBSCRIBED'));
    channelRef.current = ch;
    return () => { supabase.removeChannel(ch); cancelAnimationFrame(animRef.current); };
  }, [pubCode]);

  // ── Render UI Stati ────────────────────────────────────────────────────────
  const renderWaiting = () => (
    <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'16px', padding:'24px' }}>
      <div style={{ fontSize:'48px' }}>🎵</div>
      <div style={{ fontSize:'13px', color:'rgba(255,255,255,0.35)', letterSpacing:'0.3em', textAlign:'center' }}>IN ATTESA<br/>DEL DJ</div>
      <div style={{ width:'32px', height:'32px', border:'3px solid rgba(255,255,255,0.2)', borderTopColor:'#ffd100', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
    </div>
  );

  const renderSpectator = () => (
    <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'16px', padding:'24px' }}>
      <div style={{ fontSize:'48px' }}>👀</div>
      <div style={{ fontSize:'16px', fontWeight:900, color:'#ffd100' }}>SPETTATORE</div>
      <div style={{ fontSize:'11px', color:'rgba(255,255,255,0.3)', textAlign:'center' }}>La band sta suonando.<br/>Goditi lo show!</div>
    </div>
  );

  const renderAssigned = () => (
    <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'20px', padding:'24px' }}>
      <div style={{ fontSize:'72px', filter:'drop-shadow(0 0 20px rgba(255,255,255,0.2))' }}>{instrIcon}</div>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:'11px', color:'rgba(255,255,255,0.3)', letterSpacing:'0.3em', marginBottom:'4px' }}>IL TUO RUOLO</div>
        <div style={{ fontSize:'28px', fontWeight:900, color:instrColor, textShadow:`0 0 20px ${instrColor}` }}>{instrLabel}</div>
      </div>
      <div style={{ width:'32px', height:'32px', border:`3px solid ${instrColor}44`, borderTopColor:instrColor, borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
      <div style={{ fontSize:'11px', color:'rgba(255,255,255,0.25)', letterSpacing:'0.2em' }}>IN ATTESA DEL VIA...</div>
    </div>
  );

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', background:'#08080f', fontFamily:"'JetBrains Mono',monospace", overflow:'hidden', userSelect:'none', WebkitUserSelect:'none' }}>

      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 16px', background:'#0d0d18', borderBottom:'1px solid rgba(255,255,255,0.07)', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
          <span style={{ fontSize:'20px' }}>{instrIcon}</span>
          <div>
            <div style={{ fontSize:'11px', color:instrColor, fontWeight:700, letterSpacing:'0.2em' }}>{myRole ? instrLabel : 'BAND MODE'}</div>
            <div style={{ fontSize:'10px', color:'rgba(255,255,255,0.25)' }}>{nickname}</div>
          </div>
        </div>
        {gameState === 'playing' && <div style={{ fontSize:'20px', fontWeight:900, color:'#ffd100' }}>{score.toLocaleString()}</div>}
        {combo > 1 && gameState === 'playing' && <div style={{ fontSize:'13px', fontWeight:900, color:'#39ff84' }}>×{combo}</div>}
        <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
          <div style={{ width:8, height:8, borderRadius:'50%', background: connected ? '#39ff84' : '#ff3b5c' }} />
          <div style={{ fontSize:'10px', color:'rgba(255,255,255,0.25)' }}>{gameState === 'playing' ? 'LIVE' : connected ? 'OK' : 'OFF'}</div>
        </div>
      </div>

      {/* Canvas Area */}
      {(gameState === 'playing' || gameState === 'loading') && (
        <div style={{ flex:'0 0 32vh', position:'relative' }}>
          <canvas ref={canvasRef} style={{ width:'100%', height:'100%', display:'block' }} />
          {gameState === 'loading' && (
            <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(8,8,15,0.9)' }}>
              <div style={{ width:'32px', height:'32px', border:`3px solid ${instrColor}44`, borderTopColor:instrColor, borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
            </div>
          )}
          {feedback && (
            <div style={{ position:'absolute', left:`${feedback.lane*33.3+16.6}%`, top:'55%', transform:'translateX(-50%)', fontSize:'16px', fontWeight:900, color:feedback.color, textShadow:`0 0 14px ${feedback.color}`, animation:'feedPop 0.5s ease forwards', pointerEvents:'none', whiteSpace:'nowrap' }}>
              {feedback.text}
            </div>
          )}
        </div>
      )}

      {/* Stati non giocabili */}
      {gameState === 'waiting'  && !isSpectator && renderWaiting()}
      {gameState === 'waiting'  && isSpectator  && renderSpectator()}
      {gameState === 'assigned' && renderAssigned()}

      {/* Controller Tasti */}
      {gameState === 'playing' && (
        <div style={{ flex:1, display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'4px', padding:'4px', background:'#050508' }}>
          {[0,1,2].map(l => {
            const col     = LANE_COLORS[l];
            const isPress = pressing[l];
            return (
              <button key={l}
                onPointerDown={e => { e.preventDefault(); setPressing(p => { const n=[...p]; n[l]=true; return n; }); handleHit(l); }}
                onPointerUp={()     => setPressing(p => { const n=[...p]; n[l]=false; return n; })}
                onPointerCancel={() => setPressing(p => { const n=[...p]; n[l]=false; return n; })}
                style={{ background: isPress ? `${col}40` : `${col}10`, border:`3px solid ${col}${isPress?'ff':'44'}`, borderRadius:'16px', color:col, cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'6px', WebkitTapHighlightColor:'transparent', touchAction:'none', transition:'all 0.05s', transform: isPress ? 'scale(0.96)' : 'scale(1)', boxShadow: isPress ? `0 0 30px ${col}55` : 'none' }}
              >
                <div style={{ fontSize:'40px', fontWeight:900 }}>{['F','G','H'][l]}</div>
                <div style={{ fontSize:'10px', opacity:0.6, letterSpacing:'0.15em' }}>{laneLabelsRef.current[l] || (l+1)}</div>
              </button>
            );
          })}
        </div>
      )}

      <style>{`
        @keyframes feedPop { 0% { opacity:1; transform:translateX(-50%) scale(1.2); } 100% { opacity:0; transform:translateX(-50%) translateY(-30px) scale(0.9); } }
        @keyframes spin { to { transform:rotate(360deg); } }
      `}</style>
    </div>
  );
}