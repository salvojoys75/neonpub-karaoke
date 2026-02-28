import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

// ─── COSTANTI ────────────────────────────────────────────────────────────────
const HIT_WINDOW   = 0.18;
const GOOD_WINDOW  = 0.09;
const PERF_WINDOW  = 0.045;
const NOTE_LEAD    = 3.0;
const COLORS       = ['#ff3b5c', '#00d4ff', '#39ff84'];
const LANE_LABELS  = ['LANE 0', 'LANE 1', 'LANE 2'];
const START_DELAY  = 4000; 

export default function BandMode({ session, pubCode, chart: chartProp }) {
  const [chart, setChart]           = useState(chartProp || null);
  const [gameState, setGameState]   = useState('waiting'); 
  const [countdown, setCountdown]   = useState(null);
  const [score, setScore]           = useState(0);
  const [combo, setCombo]           = useState(0);
  const [hitFeedback, setHitFeedback] = useState([]);
  const [players, setPlayers]       = useState({});
  const [organLevel, setOrganLevel] = useState(0);
  const [connected, setConnected]   = useState(false); // Feedback visivo connessione

  // Refs per gestire lo stato senza riavviare la connessione
  const baseRef    = useRef(null);
  const organRef   = useRef(null);
  const canvasRef  = useRef(null);
  const startTimeRef = useRef(null);
  const audioCtxRef  = useRef(null);
  const notesRef     = useRef([]);
  const animRef      = useRef(null);
  const channelRef   = useRef(null);
  const organGainRef = useRef(null);
  const startTimerRef = useRef(null);
  const gameStateRef = useRef('waiting'); // Importante per la stabilità

  // Sincronizza Ref con State
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);

  // 1. Carica chart
  useEffect(() => {
    if (chartProp) { setChart(chartProp); return; }
    const song = session?.song || 'deepdown';
    fetch(`/audio/${song}/chart_organo.json`)
      .then(r => r.json())
      .then(data => setChart(data))
      .catch(() => console.warn('Chart non trovata'));
  }, [session, chartProp]);

  // 2. Setup Audio
  const setupAudio = useCallback(() => {
    if (audioCtxRef.current) return;
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    audioCtxRef.current = ctx;
    const gain = ctx.createGain();
    gain.gain.value = 0; 
    gain.connect(ctx.destination);
    organGainRef.current = gain;
  }, []);

  // 3. Start Sequence
  const startSequence = useCallback(async () => {
    if (!chart || gameStateRef.current !== 'waiting') return;
    
    // Setup immediato
    setupAudio();
    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') await ctx.resume();

    notesRef.current = chart.map((n, i) => ({ ...n, id: i, hit: false, missed: false }));

    // Preload Audio
    const waitReady = (el) => new Promise(resolve => {
      el.currentTime = 0;
      if (el.readyState >= 3) { resolve(); return; }
      el.addEventListener('canplaythrough', resolve, { once: true });
      el.load();
    });

    await Promise.all([waitReady(baseRef.current), waitReady(organRef.current)]);

    if (!baseRef.current._connected) {
      const src = ctx.createMediaElementSource(baseRef.current);
      src.connect(ctx.destination);
      baseRef.current._connected = true;
    }
    if (!organRef.current._connected) {
      const src = ctx.createMediaElementSource(organRef.current);
      src.connect(organGainRef.current);
      organRef.current._connected = true;
    }

    // INVIO SEGNALE START (Ora sicuro perché il canale non si resetta)
    console.log("INVIO START AL TELEFONO...");
    await channelRef.current?.send({
      type: 'broadcast',
      event: 'band_start',
      payload: {
        song: session?.song || 'deepdown',
        startDelay: START_DELAY 
      }
    });

    // Avvia countdown locale
    setGameState('countdown');
    setCountdown(4);
    
    let count = 4;
    const interval = setInterval(() => {
      count--;
      if (count > 0) {
        setCountdown(count);
      } else {
        clearInterval(interval);
        setCountdown("GO!");
      }
    }, 1000);

    startTimerRef.current = setTimeout(async () => {
      if(baseRef.current) baseRef.current.volume = 0.8;
      
      await Promise.all([
        baseRef.current.play(),
        organRef.current.play(),
      ]);
      startTimeRef.current = ctx.currentTime;
      setGameState('playing');
      setScore(0);
      setCombo(0);
      setCountdown(null);
      startLoop();
    }, START_DELAY);

  }, [chart, setupAudio, session]);

  // 4. Game Loop
  const startLoop = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width; canvas.height = rect.height;
    const W = canvas.width, H = canvas.height;
    const lW = W / 3, hitY = H * 0.82;

    function draw() {
      if (!audioCtxRef.current || startTimeRef.current === null) return;
      const elapsed = audioCtxRef.current.currentTime - startTimeRef.current;
      ctx.clearRect(0, 0, W, H);

      // Sfondo
      for (let l = 0; l < 3; l++) {
        ctx.fillStyle = l % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent';
        ctx.fillRect(l * lW, 0, lW, H);
        ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(l * lW, 0); ctx.lineTo(l * lW, H); ctx.stroke();
      }
      
      // Hit Line
      ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 2; ctx.setLineDash([8, 4]);
      ctx.beginPath(); ctx.moveTo(0, hitY); ctx.lineTo(W, hitY); ctx.stroke(); ctx.setLineDash([]);

      // Note
      for (const note of notesRef.current) {
        if (note.hit || note.missed) continue;
        const timeToHit = note.time - elapsed;
        if (timeToHit > NOTE_LEAD + 0.2) continue;
        if (timeToHit < -HIT_WINDOW - 0.1) { note.missed = true; setCombo(0); continue; }

        const y = hitY - (timeToHit / NOTE_LEAD) * hitY;
        const cx = note.lane * lW + lW / 2;
        const col = COLORS[note.lane];

        ctx.shadowColor = col; ctx.shadowBlur = 18; ctx.fillStyle = col;
        ctx.beginPath(); ctx.moveTo(cx, y - 14); ctx.lineTo(cx + 11, y); ctx.lineTo(cx, y + 14); ctx.lineTo(cx - 11, y);
        ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0;
      }
      
      // Labels
      for (let l = 0; l < 3; l++) {
        ctx.fillStyle = COLORS[l] + '88'; ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center';
        ctx.fillText(LANE_LABELS[l], l * lW + lW / 2, H - 8);
      }
      animRef.current = requestAnimationFrame(draw);
    }
    animRef.current = requestAnimationFrame(draw);
  }, []);

  // 5. Supabase Events (CORRETTO: Dependency array pulito)
  useEffect(() => {
    console.log("Connessione canale Supabase...", pubCode);
    const channel = supabase.channel(`band_game_${pubCode}`, { config: { broadcast: { self: false } } });
    
    channel.on('broadcast', { event: 'band_hit' }, ({ payload }) => {
      // Usa gameStateRef invece di gameState per evitare stale closures
      if (gameStateRef.current !== 'playing') return;

      const { nickname, lane, accuracy, points } = payload;
      
      if (organGainRef.current) {
        const gain = organGainRef.current.gain;
        const now = audioCtxRef.current?.currentTime || 0;
        gain.cancelScheduledValues(now);
        gain.setValueAtTime(Math.min(1, gain.value + 0.35), now);
        gain.exponentialRampToValueAtTime(0.01, now + 2.5);
        setOrganLevel(v => Math.min(1, v + 0.35));
      }

      const text = accuracy < PERF_WINDOW ? '✨ PERFECT' : accuracy < GOOD_WINDOW ? '⚡ GOOD' : '✓ HIT';
      const color = accuracy < PERF_WINDOW ? '#ffd100' : accuracy < GOOD_WINDOW ? '#39ff84' : '#00d4ff';
      const feedId = Date.now() + Math.random();
      
      setHitFeedback(p => [...p.slice(-8), { id: feedId, text, lane, color, nickname }]);
      setTimeout(() => setHitFeedback(p => p.filter(f => f.id !== feedId)), 900);
      setScore(s => s + points); setCombo(c => c + 1);
      setPlayers(p => { 
        const pl = p[nickname] || { score: 0, combo: 0 }; 
        return { ...p, [nickname]: { score: pl.score + points, combo: pl.combo + 1 } }; 
      });
    });

    channel.on('broadcast', { event: 'band_miss' }, ({ payload }) => {
      if (gameStateRef.current !== 'playing') return;
      setPlayers(p => { 
        const pl = p[payload.nickname] || { score: 0, combo: 0 }; 
        return { ...p, [payload.nickname]: { ...pl, combo: 0 } }; 
      });
      setCombo(0);
    });

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') setConnected(true);
      else setConnected(false);
    });

    channelRef.current = channel;
    // NON rimuoviamo il canale finché il componente non viene smontato del tutto
    return () => {
      supabase.removeChannel(channel);
    };
  }, [pubCode]); // Rimosso gameState dalle dipendenze!

  useEffect(() => {
    return () => { 
      cancelAnimationFrame(animRef.current); 
      clearTimeout(startTimerRef.current); 
      baseRef.current?.pause(); 
      organRef.current?.pause(); 
      audioCtxRef.current?.close(); 
    };
  }, []);

  const song = session?.song || 'deepdown';

  return (
    <div style={{ width: '100%', height: '100%', background: '#08080f', display: 'grid', gridTemplateColumns: '1fr 280px', fontFamily: "'JetBrains Mono', monospace", color: '#fff' }}>
      <div style={{ position: 'relative', overflow: 'hidden', display: 'flex' }}>
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
        
        {/* Indicatore Connessione */}
        <div style={{ position: 'absolute', top: 10, left: 10, display: 'flex', alignItems: 'center', gap: 6, zIndex: 50, background: 'rgba(0,0,0,0.5)', padding: '4px 8px', borderRadius: 4 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: connected ? '#39ff84' : '#ff3b5c' }} />
          <span style={{ fontSize: 10, color: 'white' }}>{connected ? 'ONLINE' : 'OFFLINE'}</span>
        </div>

        {hitFeedback.map(f => (
          <div key={f.id} style={{ position: 'absolute', left: `${f.lane * 33.3 + 16.6}%`, top: '70%', transform: 'translateX(-50%)', color: f.color, fontSize: '18px', fontWeight: 900, textShadow: `0 0 20px ${f.color}`, animation: 'hitPop 0.9s ease forwards', pointerEvents: 'none', textAlign: 'center', zIndex: 10 }}>
            {f.text}<div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', fontWeight: 400 }}>{f.nickname}</div>
          </div>
        ))}
        {gameState === 'countdown' && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', zIndex: 30 }}>
            <div style={{ fontSize: '120px', fontWeight: 900, color: '#fff', animation: 'ping 1s infinite' }}>{countdown}</div>
          </div>
        )}
        {gameState === 'waiting' && chart && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.75)', zIndex: 20 }}>
            <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)', marginBottom: '16px', letterSpacing: '0.3em' }}>{chart.length} NOTE CARICATE</div>
            <button onClick={startSequence} disabled={!connected} style={{ padding: '18px 48px', fontSize: '22px', fontWeight: 900, background: connected ? '#ffd100' : '#555', color: '#000', border: 'none', borderRadius: '12px', cursor: connected ? 'pointer' : 'not-allowed', boxShadow: '0 0 40px rgba(255,209,0,0.5)' }}>
              {connected ? '▶ START BAND' : 'CONNETTO...'}
            </button>
          </div>
        )}
      </div>
      <div style={{ background: '#0d0d18', borderLeft: '1px solid rgba(255,255,255,0.07)', padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: '24px', zIndex: 5 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.3em' }}>SCORE</div>
          <div style={{ fontSize: '42px', fontWeight: 900, color: '#ffd100', textShadow: '0 0 20px rgba(255,209,0,0.5)' }}>{score.toLocaleString()}</div>
          {combo > 1 && <div style={{ fontSize: '13px', color: '#39ff84', fontWeight: 700 }}>x{combo} COMBO</div>}
        </div>
        <div><div style={{ fontSize: '10px', color: '#00d4ff', letterSpacing: '0.3em', marginBottom: '8px' }}>ORGANO</div><div style={{ height: '8px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', overflow: 'hidden' }}><div style={{ height: '100%', width: `${organLevel * 100}%`, background: 'linear-gradient(to right, #00d4ff, #39ff84)', transition: 'width 0.1s' }} /></div></div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.3em', marginBottom: '12px' }}>GIOCATORI</div>
          {Object.entries(players).sort(([,a],[,b]) => b.score - a.score).map(([nick, p]) => (
            <div key={nick} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', marginBottom: '6px', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div><div style={{ fontSize: '13px', fontWeight: 700 }}>{nick}</div>{p.combo > 1 && <div style={{ fontSize: '10px', color: '#39ff84' }}>x{p.combo}</div>}</div>
              <div style={{ fontSize: '15px', fontWeight: 900, color: '#ffd100' }}>{p.score}</div>
            </div>
          ))}
        </div>
      </div>
      <audio ref={baseRef} src={`/audio/${song}/base.mp3`} preload="auto" crossOrigin="anonymous" />
      <audio ref={organRef} src={`/audio/${song}/organo.mp3`} preload="auto" crossOrigin="anonymous" />
      <style>{`@keyframes hitPop { 0% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1.2); } 100% { opacity: 0; transform: translateX(-50%) translateY(-60px) scale(0.8); } } @keyframes ping { 0% { transform: scale(0.8); opacity: 0.5; } 100% { transform: scale(1.5); opacity: 0; } }`}</style>
    </div>
  );
}