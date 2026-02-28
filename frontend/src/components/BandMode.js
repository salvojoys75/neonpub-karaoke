import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

// ─── COSTANTI ────────────────────────────────────────────────────────────────
const HIT_WINDOW   = 0.18;
const GOOD_WINDOW  = 0.09;
const PERF_WINDOW  = 0.045;
const NOTE_LEAD    = 3.0;
const COLORS       = ['#ff3b5c', '#00d4ff', '#39ff84'];
const LANE_LABELS  = ['LANE 0', 'LANE 1', 'LANE 2'];
const START_DELAY  = 4000; // 4 secondi di countdown per dare tempo ai telefoni

export default function BandMode({ session, pubCode, chart: chartProp }) {
  const [chart, setChart]           = useState(chartProp || null);
  const [gameState, setGameState]   = useState('waiting'); 
  const [countdown, setCountdown]   = useState(null);
  const [score, setScore]           = useState(0);
  const [combo, setCombo]           = useState(0);
  const [hitFeedback, setHitFeedback] = useState([]);
  const [players, setPlayers]       = useState({});
  const [organLevel, setOrganLevel] = useState(0);

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

  // 1. Carica chart (Host)
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
    gain.gain.value = 0; // Parte muto, si alza quando suonano
    gain.connect(ctx.destination);
    organGainRef.current = gain;
  }, []);

  // 3. Start Sequence
  const startSequence = useCallback(async () => {
    if (!chart || gameState === 'playing' || gameState === 'countdown') return;
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

    // Connessione nodi audio se non già fatto
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

    // ─── QUI LA MODIFICA FONDAMENTALE ───
    // Inviamo SOLO il nome della canzone, non tutta la chart pesante
    await channelRef.current?.send({
      type: 'broadcast',
      event: 'band_start',
      payload: {
        song: session?.song || 'deepdown',
        // chart: chart, // RIMOSSO PER EVITARE BLOCCHI
        startDelay: START_DELAY 
      }
    });

    // Avvia countdown locale (Display)
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

    // Timer preciso per start audio
    startTimerRef.current = setTimeout(async () => {
      if(baseRef.current) baseRef.current.volume = 0.8; // Base un po' più bassa
      
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

  }, [chart, gameState, setupAudio, session]);

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

      // Sfondo e Linee
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
        
        // Disegna solo note visibili
        if (timeToHit > NOTE_LEAD + 0.2) continue;
        if (timeToHit < -HIT_WINDOW - 0.1) { 
          note.missed = true; 
          setCombo(0); 
          continue; 
        }

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

  // 5. Supabase Events (Ricezione dai telefoni)
  useEffect(() => {
    const channel = supabase.channel(`band_game_${pubCode}`, { config: { broadcast: { self: false } } });
    
    channel.on('broadcast', { event: 'band_hit' }, ({ payload }) => {
      const { nickname, lane, accuracy, points } = payload;
      
      // Logica volume dinamico organo
      if (organGainRef.current && gameState === 'playing') {
        const gain = organGainRef.current.gain;
        const now = audioCtxRef.current?.currentTime || 0;
        gain.cancelScheduledValues(now);
        gain.setValueAtTime(Math.min(1, gain.value + 0.35), now);
        gain.exponentialRampToValueAtTime(0.01, now + 2.5);
        setOrganLevel(v => Math.min(1, v + 0.35));
      }

      // Feedback grafico
      const text = accuracy < PERF_WINDOW ? '✨ PERFECT' : accuracy < GOOD_WINDOW ? '⚡ GOOD' : '✓ HIT';
      const color = accuracy < PERF_WINDOW ? '#ffd100' : accuracy < GOOD_WINDOW ? '#39ff84' : '#00d4ff';
      const feedId = Date.now() + Math.random();
      
      setHitFeedback(p => [...p.slice(-8), { id: feedId, text, lane, color, nickname }]);
      setTimeout(() => setHitFeedback(p => p.filter(f => f.id !== feedId)), 900);
      
      setScore(s => s + points); 
      setCombo(c => c + 1);
      
      // Classifica live
      setPlayers(p => { 
        const pl = p[nickname] || { score: 0, combo: 0 }; 
        return { ...p, [nickname]: { score: pl.score + points, combo: pl.combo + 1 } }; 
      });
    });

    channel.on('broadcast', { event: 'band_miss' }, ({ payload }) => {
      setPlayers(p => { 
        const pl = p[payload.nickname] || { score: 0, combo: 0 }; 
        return { ...p, [payload.nickname]: { ...pl, combo: 0 } }; 
      });
      setCombo(0);
    });

    channel.subscribe();
    channelRef.current = channel;
    return () => supabase.removeChannel(channel);
  }, [pubCode, gameState]);

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
      {/* Area Gioco (Sinistra) */}
      <div style={{ position: 'relative', overflow: 'hidden', display: 'flex' }}>
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
        
        {/* Feedback Colpi */}
        {hitFeedback.map(f => (
          <div key={f.id} style={{ position: 'absolute', left: `${f.lane * 33.3 + 16.6}%`, top: '70%', transform: 'translateX(-50%)', color: f.color, fontSize: '18px', fontWeight: 900, textShadow: `0 0 20px ${f.color}`, animation: 'hitPop 0.9s ease forwards', pointerEvents: 'none', textAlign: 'center', zIndex: 10 }}>
            {f.text}<div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', fontWeight: 400 }}>{f.nickname}</div>
          </div>
        ))}

        {/* Countdown */}
        {gameState === 'countdown' && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', zIndex: 30 }}>
            <div style={{ fontSize: '120px', fontWeight: 900, color: '#fff', animation: 'ping 1s infinite' }}>{countdown}</div>
          </div>
        )}

        {/* Start Button */}
        {gameState === 'waiting' && chart && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.75)', zIndex: 20 }}>
            <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)', marginBottom: '16px', letterSpacing: '0.3em' }}>{chart.length} NOTE CARICATE</div>
            <button onClick={startSequence} style={{ padding: '18px 48px', fontSize: '22px', fontWeight: 900, background: '#ffd100', color: '#000', border: 'none', borderRadius: '12px', cursor: 'pointer', boxShadow: '0 0 40px rgba(255,209,0,0.5)' }}>▶ START BAND</button>
          </div>
        )}
      </div>

      {/* Sidebar (Destra) */}
      <div style={{ background: '#0d0d18', borderLeft: '1px solid rgba(255,255,255,0.07)', padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: '24px', zIndex: 5 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.3em' }}>PUNTI TOTALI</div>
          <div style={{ fontSize: '42px', fontWeight: 900, color: '#ffd100', textShadow: '0 0 20px rgba(255,209,0,0.5)' }}>{score.toLocaleString()}</div>
          {combo > 1 && <div style={{ fontSize: '13px', color: '#39ff84', fontWeight: 700 }}>x{combo} COMBO</div>}
        </div>
        
        <div>
          <div style={{ fontSize: '10px', color: '#00d4ff', letterSpacing: '0.3em', marginBottom: '8px' }}>VOLUME ORGANO</div>
          <div style={{ height: '8px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${organLevel * 100}%`, background: 'linear-gradient(to right, #00d4ff, #39ff84)', transition: 'width 0.1s' }} />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.3em', marginBottom: '12px' }}>MUSICISTI</div>
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