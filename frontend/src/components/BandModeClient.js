import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

// ─── COSTANTI ────────────────────────────────────────────────────────────────
const OFFSET_LATENZA = 0.08;  // Compensazione latenza client
const HIT_WINDOW     = 0.18;  // Finestra totale per hit valido
const GOOD_WINDOW    = 0.10;  // Finestra per "GOOD"
const PERF_WINDOW    = 0.05;  // Finestra per "PERFECT"
const NOTE_LEAD      = 2.0;   // Secondi di anticipo per visualizzare le note

const POINTS = {
  perfect: 100,
  good:    70,
  hit:     40,
};

const LANE_COLORS = ['#00d4ff', '#39ff84', '#ffd100'];

const INSTRUMENT_CONFIG = {
  keys:   { label: 'Tastiera', icon: '🎹', color: '#00d4ff', lanes: ['Do', 'Re', 'Mi'] },
  drums:  { label: 'Batteria', icon: '🥁', color: '#ff3b5c', lanes: ['Cassa', 'Rull', 'Piatto'] },
  bass:   { label: 'Basso',    icon: '🎸', color: '#39ff84', lanes: ['L', 'M', 'H'] },
  brass:  { label: 'Fiati',    icon: '🎺', color: '#ffd100', lanes: ['1', '2', '3'] },
  guitar: { label: 'Chitarra', icon: '🎸', color: '#ff8c00', lanes: ['L', 'M', 'H'] },
};

// ─── COMPONENTE PRINCIPALE ───────────────────────────────────────────────────
export default function BandModeClient({ pubCode, participant }) {
  // Stati di gioco
  const [gameState, setGameState] = useState('waiting'); // waiting | assigned | loading | playing
  const [myRole, setMyRole] = useState(null);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [feedback, setFeedback] = useState(null);
  const [pressing, setPressing] = useState([false, false, false]);
  const [connected, setConnected] = useState(false);
  const [sessionId, setSessionId] = useState(null);

  // Refs per valori stabili (evita ricreazione canale)
  const channelRef     = useRef(null);
  const notesRef       = useRef([]);
  const startTimeRef   = useRef(null);
  const animFrameRef   = useRef(null);
  const canvasRef      = useRef(null);
  const myRoleRef      = useRef(null);
  const nicknameRef    = useRef(participant?.nickname || '');
  const userIdRef      = useRef(participant?.id || '');
  const scoreRef       = useRef(0);
  const comboRef       = useRef(0);
  const laneLabelsRef  = useRef(['1', '2', '3']);
  const gameStateRef   = useRef('waiting');
  const sessionIdRef   = useRef(null);
  const assignmentsRef = useRef([]);

  // Aggiorna refs quando cambiano gli stati
  useEffect(() => { myRoleRef.current = myRole; }, [myRole]);
  useEffect(() => { scoreRef.current = score; }, [score]);
  useEffect(() => { comboRef.current = combo; }, [combo]);
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);
  useEffect(() => {
    nicknameRef.current = participant?.nickname || '';
    userIdRef.current = participant?.id || '';
  }, [participant]);

  // Calcola tempo trascorso
  const getElapsed = useCallback(() => {
    if (startTimeRef.current === null) return 0;
    return (Date.now() - startTimeRef.current) / 1000;
  }, []);

  // ─── FUNZIONE START GAME ─────────────────────────────────────────────────
  const startGame = useCallback(async (role, song, startDelay, serverTime) => {
    if (gameStateRef.current === 'playing') return;
    
    setGameState('loading');
    myRoleRef.current = role;
    setMyRole(role);

    // Configura labels per le corsie
    const cfg = INSTRUMENT_CONFIG[role];
    if (cfg?.lanes) laneLabelsRef.current = cfg.lanes;

    try {
      // Carica il chart
      const chartUrl = `/audio/${song}/chart_${role}.json`;
      const res = await fetch(chartUrl);
      if (!res.ok) throw new Error(`Chart non trovato: ${chartUrl}`);
      const chartData = await res.json();
      
      notesRef.current = chartData.map(n => ({ ...n, hit: false, missed: false }));

      // Calcola quando iniziare basandosi sul serverTime
      // Questo sincronizza tutti i client
      const now = Date.now();
      const targetStart = serverTime + startDelay;
      const waitTime = Math.max(0, targetStart - now);

      setTimeout(() => {
        startTimeRef.current = Date.now() + OFFSET_LATENZA * 1000;
        setGameState('playing');
        startDrawLoop();
      }, waitTime);

    } catch (err) {
      console.error('Errore caricamento chart:', err);
      setFeedback({ type: 'error', text: 'ERRORE CHART' });
      setGameState('assigned');
    }
  }, []);

  // Ref stabile per startGame
  const startGameRef = useRef(startGame);
  useEffect(() => { startGameRef.current = startGame; }, [startGame]);

  // ─── TROVA IL RUOLO DELL'UTENTE ──────────────────────────────────────────
  const findMyRole = useCallback((assignments) => {
    if (!assignments || !Array.isArray(assignments)) return null;
    const match = assignments.find(a => 
      a.odecluttererId === userIdRef.current || a.nickname === nicknameRef.current
    );
    return match?.instrument || null;
  }, []);

  // ─── CONNESSIONE SUPABASE ────────────────────────────────────────────────
  useEffect(() => {
    if (!pubCode) return;

    const channel = supabase.channel(`band_game_${pubCode}`, {
      config: { broadcast: { self: false } }
    });

    // FIX: Singolo evento unificato per setup + start
    channel.on('broadcast', { event: 'band_init' }, ({ payload }) => {
      if (payload.type === 'start') {
        const { assignments, song, serverTime, startDelay, sessionId: sid } = payload;
        
        // Salva sessionId per verifiche
        sessionIdRef.current = sid;
        setSessionId(sid);
        assignmentsRef.current = assignments;

        // Trova il ruolo
        const role = findMyRole(assignments);
        
        if (role) {
          setMyRole(role);
          myRoleRef.current = role;
          startGameRef.current(role, song, startDelay, serverTime);
        } else {
          // Utente non assegnato = spettatore
          setGameState('waiting');
        }
      } else if (payload.type === 'stop') {
        // Reset completo
        setGameState('waiting');
        setMyRole(null);
        myRoleRef.current = null;
        setScore(0);
        setCombo(0);
        scoreRef.current = 0;
        comboRef.current = 0;
        notesRef.current = [];
        startTimeRef.current = null;
        cancelAnimationFrame(animFrameRef.current);
      }
    });

    // Mantieni compatibilità con vecchi eventi (fallback)
    channel.on('broadcast', { event: 'band_setup' }, ({ payload }) => {
      const role = findMyRole(payload.assignments);
      if (role) {
        setMyRole(role);
        myRoleRef.current = role;
        assignmentsRef.current = payload.assignments;
        if (gameStateRef.current === 'waiting') {
          setGameState('assigned');
        }
      }
    });

    channel.on('broadcast', { event: 'band_start' }, ({ payload }) => {
      const { song, assignments, startDelay } = payload;
      let role = myRoleRef.current;
      
      // Se non abbiamo ancora il ruolo, proviamo a trovarlo
      if (!role && assignments) {
        role = findMyRole(assignments);
        if (role) {
          setMyRole(role);
          myRoleRef.current = role;
        }
      }

      if (role && gameStateRef.current !== 'playing') {
        startGameRef.current(role, song, startDelay, Date.now());
      }
    });

    channel.on('broadcast', { event: 'band_stop' }, () => {
      setGameState('waiting');
      setMyRole(null);
      myRoleRef.current = null;
      setScore(0);
      setCombo(0);
      notesRef.current = [];
      startTimeRef.current = null;
      cancelAnimationFrame(animFrameRef.current);
    });

    channel.subscribe((status) => {
      setConnected(status === 'SUBSCRIBED');
    });

    channelRef.current = channel;

    // Recovery: controlla se c'è una sessione attiva nel DB
    const checkActiveSession = async () => {
      try {
        const { data } = await supabase
          .from('events')
          .select('active_band')
          .eq('code', pubCode.toUpperCase())
          .single();

        if (data?.active_band?.status === 'active') {
          const { assignments, song, serverStartTime, sessionId: sid } = data.active_band;
          const role = findMyRole(assignments);
          
          if (role) {
            // Calcola quanto tempo è passato dall'inizio
            const elapsed = Date.now() - serverStartTime;
            if (elapsed < 300000) { // Max 5 minuti per recovery
              setMyRole(role);
              myRoleRef.current = role;
              sessionIdRef.current = sid;
              setSessionId(sid);
              // Inizia immediatamente (già in corso)
              startGameRef.current(role, song, 0, serverStartTime);
            }
          }
        }
      } catch (e) {
        console.error('Recovery check failed:', e);
      }
    };

    // Delay per permettere al canale di connettersi
    setTimeout(checkActiveSession, 500);

    return () => {
      supabase.removeChannel(channel);
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [pubCode, findMyRole]);

  // ─── DRAW LOOP ───────────────────────────────────────────────────────────
  const startDrawLoop = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    function draw() {
      const W = canvas.offsetWidth;
      const H = canvas.offsetHeight;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.scale(dpr, dpr);

      ctx.fillStyle = '#0a0a14';
      ctx.fillRect(0, 0, W, H);

      const elapsed = getElapsed();
      const laneW = W / 3;
      const hitY = H * 0.85;

      // Disegna corsie
      for (let i = 0; i < 3; i++) {
        const x = i * laneW;
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + laneW, 0);
        ctx.lineTo(x + laneW, H);
        ctx.stroke();

        // Label corsia
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.font = '12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(laneLabelsRef.current[i] || '', x + laneW / 2, 20);
      }

      // Linea di hit
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fillRect(0, hitY - 2, W, 4);

      // Disegna note
      const notes = notesRef.current;
      for (const note of notes) {
        if (note.hit || note.missed) continue;

        const dt = note.time - elapsed;
        if (dt > NOTE_LEAD || dt < -HIT_WINDOW) {
          // Marca come missed se è passata
          if (dt < -HIT_WINDOW) note.missed = true;
          continue;
        }

        const progress = 1 - (dt / NOTE_LEAD);
        const y = progress * hitY;
        const x = note.lane * laneW + laneW / 2;
        const size = 24;

        // Rombo
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(Math.PI / 4);
        ctx.fillStyle = LANE_COLORS[note.lane] || '#fff';
        ctx.shadowColor = LANE_COLORS[note.lane] || '#fff';
        ctx.shadowBlur = 15;
        ctx.fillRect(-size / 2, -size / 2, size, size);
        ctx.restore();
      }

      animFrameRef.current = requestAnimationFrame(draw);
    }

    animFrameRef.current = requestAnimationFrame(draw);
  }, [getElapsed]);

  // ─── HANDLE HIT ──────────────────────────────────────────────────────────
  const handleHit = useCallback((lane) => {
    if (gameStateRef.current !== 'playing') return;

    const elapsed = getElapsed();
    const notes = notesRef.current;

    let bestNote = null;
    let bestDist = Infinity;

    for (const note of notes) {
      if (note.lane !== lane || note.hit || note.missed) continue;
      const d = Math.abs(note.time - elapsed);
      if (d < HIT_WINDOW && d < bestDist) {
        bestDist = d;
        bestNote = note;
      }
    }

    if (bestNote) {
      bestNote.hit = true;

      let type, pts;
      if (bestDist < PERF_WINDOW) {
        type = 'PERFECT!';
        pts = POINTS.perfect;
      } else if (bestDist < GOOD_WINDOW) {
        type = 'GOOD!';
        pts = POINTS.good;
      } else {
        type = 'OK';
        pts = POINTS.hit;
      }

      const newCombo = comboRef.current + 1;
      const bonus = Math.floor(newCombo / 10) * 10;
      const finalPts = pts + bonus;

      scoreRef.current += finalPts;
      comboRef.current = newCombo;
      setScore(scoreRef.current);
      setCombo(newCombo);
      setFeedback({ type, pts: finalPts });
      setTimeout(() => setFeedback(null), 400);

      // Invia hit al server
      channelRef.current?.send({
        type: 'broadcast',
        event: 'band_hit',
        payload: {
          nickname: nicknameRef.current,
          instrument: myRoleRef.current,
          lane,
          accuracy: bestDist,
          points: finalPts,
        },
      });
    } else {
      // Miss
      comboRef.current = 0;
      setCombo(0);
      setFeedback({ type: 'MISS', pts: 0 });
      setTimeout(() => setFeedback(null), 400);

      channelRef.current?.send({
        type: 'broadcast',
        event: 'band_miss',
        payload: { nickname: nicknameRef.current },
      });
    }
  }, [getElapsed]);

  // ─── KEYBOARD INPUT ──────────────────────────────────────────────────────
  useEffect(() => {
    const keyMap = { f: 0, g: 1, h: 2 };

    const onKeyDown = (e) => {
      const lane = keyMap[e.key.toLowerCase()];
      if (lane !== undefined && gameStateRef.current === 'playing') {
        setPressing(p => { const n = [...p]; n[lane] = true; return n; });
        handleHit(lane);
      }
    };

    const onKeyUp = (e) => {
      const lane = keyMap[e.key.toLowerCase()];
      if (lane !== undefined) {
        setPressing(p => { const n = [...p]; n[lane] = false; return n; });
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [handleHit]);

  // ─── RENDER ──────────────────────────────────────────────────────────────
  const config = INSTRUMENT_CONFIG[myRole] || {};
  const isSpectator = gameState === 'waiting' && !myRole;

  return (
    <div style={{
      width: '100%',
      height: '100%',
      background: '#0a0a14',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: "'JetBrains Mono', monospace",
      color: '#fff',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        background: 'rgba(0,0,0,0.5)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: connected ? '#39ff84' : '#ff3b5c',
          }} />
          <span style={{ fontSize: '14px', color: config.color || '#888' }}>
            {config.icon} {config.label || 'BAND MODE'}
          </span>
        </div>
        <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#ffd100' }}>
          {score.toLocaleString()}
        </div>
      </div>

      {/* Game Area */}
      <div style={{ flex: 1, position: 'relative' }}>
        {gameState === 'playing' ? (
          <canvas
            ref={canvasRef}
            style={{ width: '100%', height: '100%', display: 'block' }}
          />
        ) : (
          <div style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '16px',
          }}>
            {gameState === 'waiting' && (
              <>
                <div style={{ fontSize: '48px' }}>🎸</div>
                <div style={{ fontSize: '18px', color: '#888' }}>
                  {isSpectator ? 'Sei uno spettatore' : 'In attesa del DJ...'}
                </div>
              </>
            )}
            {gameState === 'assigned' && (
              <>
                <div style={{ fontSize: '64px' }}>{config.icon}</div>
                <div style={{ fontSize: '24px', color: config.color }}>
                  {config.label}
                </div>
                <div style={{ fontSize: '14px', color: '#888' }}>
                  Preparati a suonare!
                </div>
              </>
            )}
            {gameState === 'loading' && (
              <>
                <div style={{ fontSize: '48px' }}>⏳</div>
                <div style={{ fontSize: '18px', color: '#888' }}>
                  Caricamento...
                </div>
              </>
            )}
          </div>
        )}

        {/* Feedback overlay */}
        {feedback && (
          <div style={{
            position: 'absolute',
            top: '30%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            fontSize: '32px',
            fontWeight: 'bold',
            color: feedback.type === 'PERFECT!' ? '#ffd100' :
                   feedback.type === 'GOOD!' ? '#39ff84' :
                   feedback.type === 'MISS' ? '#ff3b5c' : '#fff',
            textShadow: '0 0 20px currentColor',
            animation: 'pop 0.3s ease-out',
          }}>
            {feedback.type}
            {feedback.pts > 0 && <div style={{ fontSize: '16px' }}>+{feedback.pts}</div>}
          </div>
        )}

        {/* Combo */}
        {combo > 1 && gameState === 'playing' && (
          <div style={{
            position: 'absolute',
            top: '10px',
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: '16px',
            fontWeight: 'bold',
            color: '#ffd100',
            textShadow: '0 0 10px #ffd10088',
          }}>
            ×{combo} COMBO
          </div>
        )}
      </div>

      {/* Touch Buttons */}
      {gameState === 'playing' && (
        <div style={{
          display: 'flex',
          height: '120px',
          borderTop: '1px solid rgba(255,255,255,0.1)',
        }}>
          {[0, 1, 2].map((lane) => (
            <div
              key={lane}
              onPointerDown={() => {
                setPressing(p => { const n = [...p]; n[lane] = true; return n; });
                handleHit(lane);
              }}
              onPointerUp={() => {
                setPressing(p => { const n = [...p]; n[lane] = false; return n; });
              }}
              onPointerLeave={() => {
                setPressing(p => { const n = [...p]; n[lane] = false; return n; });
              }}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: pressing[lane]
                  ? LANE_COLORS[lane] + '40'
                  : 'rgba(255,255,255,0.05)',
                borderRight: lane < 2 ? '1px solid rgba(255,255,255,0.1)' : 'none',
                transition: 'background 0.1s',
                cursor: 'pointer',
                userSelect: 'none',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <div style={{
                fontSize: '24px',
                fontWeight: 'bold',
                color: LANE_COLORS[lane],
                opacity: pressing[lane] ? 1 : 0.5,
              }}>
                {laneLabelsRef.current[lane]}
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`
        @keyframes pop {
          0% { transform: translate(-50%, -50%) scale(0.5); opacity: 0; }
          50% { transform: translate(-50%, -50%) scale(1.2); }
          100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
