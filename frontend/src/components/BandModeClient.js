import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { getEventState } from '@/lib/api';

// ── CONFIGURAZIONE ────────────────────────────────────────────────────────────
// Latenza audio: 0 = note allineate al beat TV. Aumentare (es. 100) solo se
// il locale è molto grande e il suono impiega tempo ad arrivare al giocatore.
const OFFSET_LATENZA = 0;
const HIT_WINDOW  = 0.20;
const GOOD_WINDOW = 0.10;
const PERF_WINDOW = 0.05;
const NOTE_LEAD   = 3.0;
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
  const songNameRef  = useRef(null);

  // ── Refs stabili per evitare che il canale Supabase si ricroei ogni render ──
  // Il problema: se startGame (o qualunque altro callback) è in deps dell'useEffect
  // del canale, ogni cambio di stato ricrea il canale esattamente mentre arrivano
  // i broadcast — causando la perdita degli eventi (race condition deterministica).
  const laneLabelsRef  = useRef([]);   // aggiornato quando myRole cambia
  const startGameRef   = useRef(null); // aggiornato quando startGame cambia
  const nicknameRef    = useRef(null); // costante per sessione
  const userIdRef      = useRef(null); // costante per sessione

  const nickname = participant?.nickname || participant?.name || 'Player';
  const userId   = participant?.id || participant?.user_id || null;

  const instrConfig = myRole ? (INSTRUMENT_CONFIG[myRole] || DEFAULT_CONFIG) : DEFAULT_CONFIG;
  const { color: instrColor, icon: instrIcon, label: instrLabel, lanes: laneLabels } = instrConfig;

  // Sync refs che non dipendono da funzioni dichiarate più avanti
  useEffect(() => { laneLabelsRef.current = laneLabels; }, [laneLabels]);
  useEffect(() => { nicknameRef.current   = nickname; },   [nickname]);
  useEffect(() => { userIdRef.current     = userId; },     [userId]);
  // startGameRef.current viene sincronizzato subito dopo la dichiarazione di startGame

  const getElapsed = useCallback(() => {
    if (!startTimeRef.current) return -999;
    return (Date.now() - startTimeRef.current) / 1000;
  }, []);

  // ── Polling DB ogni 2s — fonte di verità unica per game start/stop ─────────
  // DESIGN: Non usiamo Supabase broadcast per il game start perché channel.send()
  // può cadere su REST fallback, che NON consegna ai subscriber WebSocket.
  // Il polling sul DB è deterministico, affidabile, e gestisce anche reload/reconnect.
  useEffect(() => {
    // activeStartAt: tiene traccia dell'ultima sessione avviata.
    // Se cambia → nuova sessione. Se torna null → sessione terminata.
    const activeStartAtRef = { current: null };
    const isLoadingRef    = { current: false };

    const poll = async () => {
      try {
        const state = await getEventState();
        const activeBand = state?.active_module === 'band' ? state?.active_band : null;

        if (activeBand?.status === 'active' && activeBand?.startAt) {
          // Verifica se è una nuova sessione (startAt diverso da prima)
          if (activeStartAtRef.current !== activeBand.startAt && !isLoadingRef.current) {
            activeStartAtRef.current = activeBand.startAt;

            // Trova il ruolo di questo giocatore
            const assignments = activeBand.assignments || [];
            const mine = assignments.find(a =>
              (userIdRef.current && a.userId === userIdRef.current) ||
              a.nickname === nicknameRef.current
            );

            if (mine) {
              const role = mine.instrument;
              setMyRole(role);
              myRoleRef.current   = role;
              songNameRef.current = activeBand.song;
              setIsSpectator(false);
              setGameState('loading');
              isLoadingRef.current = true;

              // Carica la chart e avvia il gioco
              try {
                const res = await fetch(`/audio/${activeBand.song}/chart_${role}.json`);
                if (!res.ok) throw new Error(`chart_${role}.json non trovata`);
                const chartData = await res.json();
                // Passa startAt diretto — startGame calcola il timing ancorato all'UTC del DB
                startGameRef.current?.(chartData, activeBand.startAt);
              } catch (err) {
                console.error('BandModeClient: errore caricamento chart', err);
                setFeedback({ text: 'ERRORE CHART', color: '#ff3b5c', lane: 1 });
                setGameState('assigned');
              } finally {
                isLoadingRef.current = false;
              }
            } else if (assignments.length > 0) {
              // Band attiva ma non sei tra i partecipanti
              setIsSpectator(true);
              setGameState('waiting');
              isLoadingRef.current = false;
            }
          } else if (activeStartAtRef.current === null) {
            // Band attiva ma startAt non ancora impostato → in attesa
            const assignments = activeBand.assignments || [];
            const mine = assignments.find(a =>
              (userIdRef.current && a.userId === userIdRef.current) ||
              a.nickname === nicknameRef.current
            );
            if (mine) {
              if (myRoleRef.current !== mine.instrument) {
                setMyRole(mine.instrument);
                myRoleRef.current   = mine.instrument;
                setIsSpectator(false);
                setGameState('assigned');
              }
            } else if (assignments.length > 0) {
              setIsSpectator(true);
              setGameState('waiting');
            }
          }
        } else if (!activeBand) {
          // Band terminata o non attiva — reset completo
          if (activeStartAtRef.current !== null || myRoleRef.current !== null) {
            activeStartAtRef.current = null;
            isLoadingRef.current     = false;
            cancelAnimationFrame(animRef.current);
            startTimeRef.current = null;
            notesRef.current     = [];
            scoreRef.current     = 0;
            comboRef.current     = 0;
            myRoleRef.current    = null;
            setGameState('waiting');
            setMyRole(null);
            setScore(0);
            setCombo(0);
            setIsSpectator(false);
            setFeedback(null);
          }
        }
      } catch {
        // Silenzioso — non interrompe il polling
      }
    };

    poll(); // Esegui subito al mount
    const interval = setInterval(poll, 500); // 500ms: rilevamento rapido, carico DB minimo
    return () => clearInterval(interval);
  }, [pubCode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Render Loop ────────────────────────────────────────────────────────────
  // IMPORTANTE: le dimensioni vengono rilette ogni frame, NON catturate all'avvio.
  // Motivo: quando startDrawLoop viene chiamato, il canvas potrebbe essere dentro
  // un div con display:none (ClientApp nasconde BandModeClient quando activeTab !== 'band').
  // In quel caso offsetWidth = 0 → lW = 0 → note disegnate a x=0 invisibili.
  // Rileggere ogni frame garantisce che appena il tab diventa visibile, le note appaiono.
  const startDrawLoop = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    function draw() {
      const elapsed = getElapsed();

      // Rileggi dimensioni ogni frame — gestisce display:none → block e rotazione schermo
      const DPR = window.devicePixelRatio || 1;
      const cW  = canvas.offsetWidth;
      const cH  = canvas.offsetHeight;
      if (cW === 0 || cH === 0) {
        animRef.current = requestAnimationFrame(draw);
        return; // canvas non ancora visibile, aspetta
      }
      if (canvas.width !== cW * DPR || canvas.height !== cH * DPR) {
        canvas.width  = cW * DPR;
        canvas.height = cH * DPR;
        ctx.scale(DPR, DPR);
      }
      const lW = cW / 3, hitY = cH * 0.82;

      ctx.clearRect(0, 0, cW, cH);

      // COUNTDOWN
      if (elapsed < 0) {
        const sec  = Math.ceil(Math.abs(elapsed));
        const text = sec > 0 ? String(sec) : 'GO!';
        for (let l = 0; l < 3; l++) {
          ctx.fillStyle = `${LANE_COLORS[l]}11`;
          ctx.fillRect(l * lW, 0, lW, cH);
          if (l > 0) { ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(l*lW,0); ctx.lineTo(l*lW,cH); ctx.stroke(); }
        }
        ctx.fillStyle = '#fff'; ctx.font = 'bold 80px monospace';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(text, cW / 2, cH / 2);
        animRef.current = requestAnimationFrame(draw);
        return;
      }

      // Sfondo corsie
      for (let l = 0; l < 3; l++) {
        ctx.fillStyle = `${LANE_COLORS[l]}0d`;
        ctx.fillRect(l * lW, 0, lW, cH);
      }
      ctx.lineWidth = 1;
      for (let l = 1; l < 3; l++) {
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.beginPath(); ctx.moveTo(l*lW, 0); ctx.lineTo(l*lW, cH); ctx.stroke();
      }

      // Hit line
      ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 2; ctx.setLineDash([5,4]);
      ctx.beginPath(); ctx.moveTo(0, hitY); ctx.lineTo(cW, hitY); ctx.stroke();
      ctx.setLineDash([]);

      // Cerchi tasti
      for (let l = 0; l < 3; l++) {
        const cx = l * lW + lW / 2;
        ctx.strokeStyle = LANE_COLORS[l] + '66'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(cx, hitY, 14, 0, Math.PI * 2); ctx.stroke();
      }

      // Note — rombi colorati per corsia
      for (const note of notesRef.current) {
        if (note.hit || note.missed) continue;
        const tti = note.time - elapsed;
        if (tti > NOTE_LEAD + 0.1) continue;
        if (tti < -HIT_WINDOW - 0.1) { note.missed = true; comboRef.current = 0; setCombo(0); continue; }

        const y   = (1 - tti / NOTE_LEAD) * hitY;
        const cx  = note.lane * lW + lW / 2;
        const col = LANE_COLORS[note.lane];

        ctx.save();
        ctx.shadowColor = col; ctx.shadowBlur = 16; ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(cx, y-12); ctx.lineTo(cx+10, y); ctx.lineTo(cx, y+12); ctx.lineTo(cx-10, y);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1; ctx.stroke();
        ctx.restore();
      }

      // Label corsie
      ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center';
      for (let l = 0; l < 3; l++) {
        ctx.fillStyle = LANE_COLORS[l] + 'aa';
        ctx.fillText(laneLabelsRef.current[l] || String(l+1), l*lW + lW/2, cH - 4);
      }

      animRef.current = requestAnimationFrame(draw);
    }
    animRef.current = requestAnimationFrame(draw);
  }, [getElapsed]); // laneLabels tolto dai deps — letto da laneLabelsRef per stabilità

  // ── Start Game ─────────────────────────────────────────────────────────────
  // Riceve startAt (ISO string assoluto dal DB) invece di delay.
  // MOTIVO: delay calcolato prima del download della chart porta a un errore
  // sistematico pari al tempo di download (200-800ms). Ancorando direttamente
  // a startAt, startTimeRef è invariante rispetto a quando viene chiamata questa
  // funzione — il telefono è sempre sincronizzato all'UTC del DB.
  const startGame = useCallback((chartData, startAt) => {
    // startTimeRef = punto zero del tempo di gioco
    // elapsed = (Date.now() - startTimeRef) / 1000
    // OFFSET_LATENZA compensa la propagazione audio TV→orecchie del giocatore
    startTimeRef.current = new Date(startAt).getTime() - OFFSET_LATENZA;
    notesRef.current = chartData.map((n, i) => ({ ...n, id: i, hit: false, missed: false }));
    scoreRef.current = 0; comboRef.current = 0;
    setScore(0); setCombo(0);
    setGameState('playing');
    startDrawLoop();
  }, [startDrawLoop]);

  // startGameRef sempre aggiornato — usato nel canale Supabase (che non si ricrea)
  useEffect(() => { startGameRef.current = startGame; }, [startGame]);

  // ── Hit Handler — manda segnale al PC, nessun audio locale ───────────────
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
      const col   = isPerfect ? '#ffd100'     : isGood ? '#39ff84' : LANE_COLORS[lane];
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
  }, [gameState, getElapsed, nickname]);

  // ── Supabase channel — SOLO per band_hit e band_miss (effetti real-time TV) ─
  // band_start / band_stop / band_setup NON passano più da qui:
  // usano il polling DB (vedi useEffect sopra) che è deterministico e affidabile.
  // Il broadcast WebSocket non è adatto per segnali critici perché channel.send()
  // può cadere su REST fallback che NON consegna ai subscriber WebSocket.
  useEffect(() => {
    const ch = supabase.channel(`band_game_${pubCode}`);
    ch.subscribe(status => setConnected(status === 'SUBSCRIBED'));
    channelRef.current = ch;
    return () => {
      supabase.removeChannel(ch);
      cancelAnimationFrame(animRef.current);
    };
  }, [pubCode]);

  // ── UI ─────────────────────────────────────────────────────────────────────
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
      <div style={{ fontSize:'11px', color:'rgba(255,255,255,0.3)', textAlign:'center' }}>Non sei stato selezionato.<br/>Goditi lo show!</div>
    </div>
  );

  const renderAssigned = () => (
    <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'20px', padding:'24px' }}>
      <div style={{ fontSize:'72px' }}>{instrIcon}</div>
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

      {/* Canvas */}
      {(gameState === 'playing' || gameState === 'loading') && (
        <div style={{ flex:'0 0 30vh', position:'relative' }}>
          <canvas ref={canvasRef} style={{ width:'100%', height:'100%', display:'block' }} />
          {gameState === 'loading' && (
            <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(8,8,15,0.9)' }}>
              <div style={{ width:'32px', height:'32px', border:`3px solid ${instrColor}44`, borderTopColor:instrColor, borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
            </div>
          )}
          {feedback && (
            <div style={{ position:'absolute', left:`${feedback.lane*33.3+16.6}%`, top:'50%', transform:'translateX(-50%)', fontSize:'15px', fontWeight:900, color:feedback.color, textShadow:`0 0 14px ${feedback.color}`, animation:'feedPop 0.6s ease forwards', pointerEvents:'none', whiteSpace:'nowrap' }}>
              {feedback.text}
            </div>
          )}
        </div>
      )}

      {/* Stati attesa */}
      {gameState === 'waiting'  && !isSpectator && renderWaiting()}
      {gameState === 'waiting'  && isSpectator  && renderSpectator()}
      {gameState === 'assigned' && renderAssigned()}

      {/* Tasti */}
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
                style={{ background: isPress ? `${col}40` : `${col}10`, border:`3px solid ${col}${isPress?'ff':'44'}`, borderRadius:'16px', color:col, cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'6px', WebkitTapHighlightColor:'transparent', touchAction:'none', transition:'background 0.06s, border-color 0.06s', boxShadow: isPress ? `0 0 30px ${col}55` : 'none' }}
              >
                <div style={{ fontSize:'40px', fontWeight:900 }}>{['F','G','H'][l]}</div>
                <div style={{ fontSize:'10px', opacity:0.6, letterSpacing:'0.15em' }}>{laneLabels[l]}</div>
              </button>
            );
          })}
        </div>
      )}

      <style>{`
        @keyframes feedPop { 0% { opacity:1; transform:translateX(-50%) scale(1.2); } 100% { opacity:0; transform:translateX(-50%) translateY(-25px) scale(0.9); } }
        @keyframes spin { to { transform:rotate(360deg); } }
      `}</style>
    </div>
  );
}