import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Music2 } from 'lucide-react';

// ─── FONTS & GLOBAL STYLES ────────────────────────────────────────────────────

const GLOBAL_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow+Condensed:wght@400;700;900&family=Barlow:wght@400;600&display=swap');

  @keyframes laser-spin {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }
  @keyframes laser-spin-rev {
    from { transform: rotate(360deg); }
    to   { transform: rotate(0deg); }
  }
  @keyframes strobe {
    0%,100% { opacity: 0; }
    50%     { opacity: 1; }
  }
  @keyframes float-up {
    0%   { transform: translateY(0px) scale(1); opacity: 1; }
    100% { transform: translateY(-120px) scale(0.4); opacity: 0; }
  }
  @keyframes reveal-up {
    from { opacity: 0; transform: translateY(60px) skewY(3deg); }
    to   { opacity: 1; transform: translateY(0) skewY(0deg); }
  }
  @keyframes reveal-scale {
    from { opacity: 0; transform: scale(0.6); }
    to   { opacity: 1; transform: scale(1); }
  }
  @keyframes ticker-h {
    from { transform: translateX(0); }
    to   { transform: translateX(-50%); }
  }
  @keyframes pulse-glow {
    0%,100% { filter: drop-shadow(0 0 8px currentColor); }
    50%     { filter: drop-shadow(0 0 30px currentColor) drop-shadow(0 0 60px currentColor); }
  }
  @keyframes scan-line {
    from { top: -4px; }
    to   { top: 100%; }
  }
  @keyframes count-slam {
    0%   { transform: scale(2.5); opacity: 0; }
    40%  { transform: scale(0.9); opacity: 1; }
    70%  { transform: scale(1.05); }
    100% { transform: scale(1); }
  }
  @keyframes bar-wave {
    0%,100% { transform: scaleY(0.3); }
    50%     { transform: scaleY(1); }
  }
  @keyframes name-appear {
    0%   { clip-path: inset(0 100% 0 0); }
    100% { clip-path: inset(0 0% 0 0); }
  }
  @keyframes shimmer {
    0%   { background-position: -200% center; }
    100% { background-position: 200% center; }
  }
  @keyframes ring-expand {
    0%   { transform: scale(0.8); opacity: 0.8; }
    100% { transform: scale(2.5); opacity: 0; }
  }
  @keyframes celebration-bounce {
    0%,100% { transform: translateY(0) scale(1); }
    30%     { transform: translateY(-20px) scale(1.05); }
    60%     { transform: translateY(-8px) scale(1.02); }
  }
  @keyframes confetti-fall {
    0%   { transform: translateY(-20px) rotate(0deg); opacity: 1; }
    100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
  }
  @keyframes slide-right {
    from { transform: translateX(-100%); opacity: 0; }
    to   { transform: translateX(0); opacity: 1; }
  }
  @keyframes gradient-shift {
    0%,100% { background-position: 0% 50%; }
    50%     { background-position: 100% 50%; }
  }

  .bebas { font-family: 'Bebas Neue', 'Impact', sans-serif; }
  .barlow-cond { font-family: 'Barlow Condensed', 'Arial Narrow', sans-serif; }
  .barlow { font-family: 'Barlow', sans-serif; }
`;

// ─── AUDIO ────────────────────────────────────────────────────────────────────

const mkCtx = () => new (window.AudioContext || window.webkitAudioContext)();

const playDrum = () => {
  try {
    const a = mkCtx();
    const buf = a.createBuffer(1, a.sampleRate * 0.3, a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 8);
    const src = a.createBufferSource(); const g = a.createGain();
    src.buffer = buf; src.connect(g); g.connect(a.destination);
    g.gain.setValueAtTime(0.8, a.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + 0.25);
    src.start();
  } catch {}
};

const playRoll = (intensity = 1) => {
  try {
    const a = mkCtx();
    const steps = Math.floor(4 + intensity * 6);
    for (let i = 0; i < steps; i++) {
      const buf = a.createBuffer(1, a.sampleRate * 0.05, a.sampleRate);
      const d = buf.getChannelData(0);
      for (let j = 0; j < d.length; j++) d[j] = (Math.random() * 2 - 1) * Math.pow(1 - j / d.length, 5);
      const src = a.createBufferSource(); const g = a.createGain();
      src.buffer = buf; src.connect(g); g.connect(a.destination);
      const t = a.currentTime + i * (0.08 / intensity);
      g.gain.setValueAtTime(0.4 * intensity, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      src.start(t);
    }
  } catch {}
};

const playStinger = () => {
  try {
    const a = mkCtx();
    [[0, 220],[0.05, 330],[0.1, 440],[0.18, 880],[0.25, 1320]].forEach(([delay, freq]) => {
      const o = a.createOscillator(); const g = a.createGain();
      o.connect(g); g.connect(a.destination);
      o.type = 'sawtooth'; o.frequency.value = freq;
      const t = a.currentTime + delay;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.25, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      o.start(t); o.stop(t + 0.22);
    });
  } catch {}
};

const playFanfare = () => {
  try {
    const a = mkCtx();
    [[0,523],[0.08,659],[0.16,784],[0.26,1047],[0.38,784],[0.46,1047],[0.56,1319],[0.7,1047],[0.8,1319],[0.92,1568]].forEach(([delay, freq]) => {
      const o = a.createOscillator(); const g = a.createGain();
      o.connect(g); g.connect(a.destination);
      o.type = 'square'; o.frequency.value = freq;
      const t = a.currentTime + delay;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.18, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      o.start(t); o.stop(t + 0.28);
    });
  } catch {}
};

// ─── LASER BEAMS BACKGROUND ───────────────────────────────────────────────────

const LaserBeams = ({ active, color1 = '#ff006e', color2 = '#3a86ff' }) => (
  <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 2, opacity: active ? 1 : 0, transition: 'opacity 1s ease' }}>
    {/* Rotating laser rings */}
    {[0,1,2].map(i => (
      <div key={i} style={{
        position: 'absolute',
        top: '50%', left: '50%',
        width: `${60 + i * 25}vw`, height: `${60 + i * 25}vw`,
        marginLeft: `-${(60 + i * 25) / 2}vw`, marginTop: `-${(60 + i * 25) / 2}vw`,
        borderRadius: '50%',
        border: `1px solid ${i % 2 === 0 ? color1 : color2}22`,
        boxShadow: `0 0 20px ${i % 2 === 0 ? color1 : color2}15`,
        animation: `${i % 2 === 0 ? 'laser-spin' : 'laser-spin-rev'} ${8 + i * 4}s linear infinite`,
      }} />
    ))}
    {/* Radial laser lines */}
    {[0,45,90,135].map((angle, i) => (
      <div key={`line-${i}`} style={{
        position: 'absolute',
        top: '50%', left: '50%',
        width: '120vw', height: '1px',
        background: `linear-gradient(to right, transparent 20%, ${i % 2 === 0 ? color1 : color2}20 50%, transparent 80%)`,
        transformOrigin: 'left center',
        transform: `rotate(${angle}deg)`,
        animation: `laser-spin ${12 + i * 3}s linear infinite`,
      }} />
    ))}
    {/* Corner spotlights */}
    <div style={{
      position: 'absolute', top: 0, left: 0,
      width: '50vw', height: '60vh',
      background: `radial-gradient(ellipse 60% 80% at 0% 0%, ${color1}18 0%, transparent 70%)`,
    }} />
    <div style={{
      position: 'absolute', top: 0, right: 0,
      width: '50vw', height: '60vh',
      background: `radial-gradient(ellipse 60% 80% at 100% 0%, ${color2}18 0%, transparent 70%)`,
    }} />
  </div>
);

// ─── STAGE FLOOR ──────────────────────────────────────────────────────────────

const StageFloor = ({ hot }) => (
  <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1 }}>
    {/* Deep gradient base */}
    <div style={{
      position: 'absolute', inset: 0,
      background: hot
        ? 'radial-gradient(ellipse at 50% 110%, #1a0005 0%, #0a0008 40%, #000 80%)'
        : 'radial-gradient(ellipse at 50% 110%, #00051a 0%, #010010 40%, #000 80%)',
      transition: 'background 2s ease',
    }} />
    {/* Stage floor reflection */}
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0, height: '35%',
      background: hot
        ? 'linear-gradient(to top, rgba(255,20,80,0.08) 0%, transparent 100%)'
        : 'linear-gradient(to top, rgba(20,80,255,0.08) 0%, transparent 100%)',
      transition: 'background 2s ease',
    }} />
    {/* Horizon glow line */}
    <div style={{
      position: 'absolute', bottom: '25%', left: '10%', right: '10%',
      height: '1px',
      background: hot
        ? 'linear-gradient(to right, transparent, rgba(255,20,80,0.4), transparent)'
        : 'linear-gradient(to right, transparent, rgba(20,100,255,0.4), transparent)',
      boxShadow: hot ? '0 0 30px rgba(255,20,80,0.3)' : '0 0 30px rgba(20,100,255,0.3)',
      transition: 'all 2s ease',
    }} />
    {/* Top vignette */}
    <div style={{
      position: 'absolute', inset: 0,
      background: 'linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 30%, transparent 70%, rgba(0,0,0,0.8) 100%)',
    }} />
    {/* Side vignette */}
    <div style={{
      position: 'absolute', inset: 0,
      background: 'linear-gradient(to right, rgba(0,0,0,0.6) 0%, transparent 20%, transparent 80%, rgba(0,0,0,0.6) 100%)',
    }} />
    {/* CRT scanline */}
    <div style={{
      position: 'absolute', inset: 0,
      background: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.03) 3px, rgba(0,0,0,0.03) 4px)',
    }} />
    {/* Moving scan */}
    <div style={{
      position: 'absolute', left: 0, right: 0, height: '4px',
      background: 'linear-gradient(to bottom, transparent, rgba(255,255,255,0.03), transparent)',
      animation: 'scan-line 6s linear infinite',
    }} />
    {/* Bottom stage light bar */}
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0, height: '4px',
      background: hot
        ? 'linear-gradient(to right, transparent, #ff006e, #ff4d00, #ff006e, transparent)'
        : 'linear-gradient(to right, transparent, #3a86ff, #8338ec, #3a86ff, transparent)',
      boxShadow: hot ? '0 0 40px rgba(255,0,110,0.8), 0 -10px 40px rgba(255,0,110,0.3)' : '0 0 40px rgba(58,134,255,0.8), 0 -10px 40px rgba(58,134,255,0.3)',
      transition: 'all 2s ease',
    }} />
  </div>
);

// ─── CONFETTI ─────────────────────────────────────────────────────────────────

const Confetti = ({ active }) => {
  const pieces = useMemo(() => active ? Array.from({ length: 80 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    delay: Math.random() * 1.5,
    duration: 2.5 + Math.random() * 2,
    color: ['#ff006e','#ffd700','#3a86ff','#8338ec','#06d6a0','#ff9f1c','#ffffff'][Math.floor(Math.random() * 7)],
    size: 6 + Math.random() * 8,
    rotate: Math.random() * 360,
  })) : [], [active]);

  if (!active) return null;
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 50, overflow: 'hidden' }}>
      {pieces.map(p => (
        <div key={p.id} style={{
          position: 'absolute',
          left: `${p.x}%`, top: '-20px',
          width: `${p.size}px`, height: `${p.size * 0.5}px`,
          background: p.color,
          borderRadius: '2px',
          animation: `confetti-fall ${p.duration}s ${p.delay}s ease-in forwards`,
          transform: `rotate(${p.rotate}deg)`,
          boxShadow: `0 0 6px ${p.color}80`,
        }} />
      ))}
    </div>
  );
};

// ─── AUDIO BARS ───────────────────────────────────────────────────────────────

const AudioBars = ({ active, color = '#ff006e', count = 24 }) => {
  const [heights, setHeights] = useState(Array(count).fill(0.2));
  const ref = useRef(null);

  useEffect(() => {
    if (!active) { setHeights(Array(count).fill(0.1)); return; }
    ref.current = setInterval(() => {
      setHeights(Array(count).fill(0).map(() => 0.15 + Math.random() * 0.85));
    }, 80);
    return () => clearInterval(ref.current);
  }, [active, count]);

  return (
    <div style={{ display: 'flex', gap: '3px', alignItems: 'flex-end', height: '60px' }}>
      {heights.map((h, i) => (
        <div key={i} style={{
          flex: 1, minWidth: '4px',
          borderRadius: '2px 2px 0 0',
          background: `linear-gradient(to top, ${color}, ${color}88)`,
          height: `${h * 100}%`,
          transition: 'height 0.08s ease',
          boxShadow: `0 0 ${h * 8}px ${color}`,
          opacity: 0.7 + h * 0.3,
        }} />
      ))}
    </div>
  );
};

// ─── SCRAMBLE TEXT ────────────────────────────────────────────────────────────

const ScrambleText = ({ finalText, running, onDone }) => {
  const [display, setDisplay] = useState('');
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const ref = useRef(null);
  const countRef = useRef(0);

  useEffect(() => {
    if (!running || !finalText) return;
    countRef.current = 0;
    const total = 28;
    ref.current = setInterval(() => {
      countRef.current++;
      const progress = countRef.current / total;
      const revealed = Math.floor(progress * finalText.length);
      const scrambled = finalText.split('').map((ch, i) => {
        if (i < revealed) return ch;
        if (ch === ' ') return ' ';
        return chars[Math.floor(Math.random() * chars.length)];
      }).join('');
      setDisplay(scrambled);
      if (countRef.current >= total) {
        clearInterval(ref.current);
        setDisplay(finalText);
        if (onDone) onDone();
      }
    }, 55);
    return () => clearInterval(ref.current);
  }, [running, finalText]);

  return <span>{display || finalText}</span>;
};

// ─── BROADCAST TICKER ─────────────────────────────────────────────────────────

const BroadcastTicker = ({ text, color = '#ff006e' }) => (
  <div style={{
    position: 'absolute', bottom: '12%', left: 0, right: 0,
    overflow: 'hidden', zIndex: 20,
  }}>
    <div style={{
      background: `linear-gradient(to right, ${color}ee, ${color}cc)`,
      padding: '8px 0',
      display: 'flex',
      alignItems: 'center',
    }}>
      {/* Label badge */}
      <div style={{
        background: 'rgba(0,0,0,0.5)',
        padding: '2px 16px',
        marginRight: '16px',
        flexShrink: 0,
        fontSize: 'clamp(0.6rem,1.2vw,0.9rem)',
        fontWeight: 900,
        letterSpacing: '0.3em',
        color: '#fff',
        fontFamily: 'Barlow Condensed, sans-serif',
        whiteSpace: 'nowrap',
      }}>
        LIVE
      </div>
      {/* Scrolling text */}
      <div style={{ overflow: 'hidden', flex: 1 }}>
        <div style={{
          display: 'inline-block',
          whiteSpace: 'nowrap',
          animation: 'ticker-h 12s linear infinite',
          fontFamily: 'Barlow Condensed, sans-serif',
          fontWeight: 700,
          fontSize: 'clamp(0.75rem,1.5vw,1.1rem)',
          letterSpacing: '0.15em',
          color: '#fff',
        }}>
          {[text, text, text, text].map((t, i) => (
            <span key={i} style={{ marginRight: '6em' }}>{t}</span>
          ))}
        </div>
      </div>
    </div>
  </div>
);

// ─── SHOW LOGO ────────────────────────────────────────────────────────────────

const ShowLogo = ({ visible }) => (
  <div style={{
    position: 'absolute', top: 'clamp(16px,3vh,40px)', left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 30,
    opacity: visible ? 1 : 0,
    transition: 'opacity 0.8s ease',
    textAlign: 'center',
  }}>
    <div className="bebas" style={{
      fontSize: 'clamp(1rem,2vw,1.6rem)',
      letterSpacing: '0.6em',
      color: 'rgba(255,255,255,0.25)',
      lineHeight: 1,
    }}>
      ★ DISCOJOYS ★
    </div>
    <div className="bebas" style={{
      fontSize: 'clamp(0.65rem,1.2vw,1rem)',
      letterSpacing: '0.4em',
      color: 'rgba(255,255,255,0.12)',
      marginTop: '2px',
    }}>
      TALENT SHOW
    </div>
  </div>
);

// ─── PHASE: COUNTDOWN ────────────────────────────────────────────────────────

const PhaseCountdown = ({ onDone }) => {
  const [n, setN] = useState(3);
  const [slam, setSlam] = useState(false);

  useEffect(() => {
    if (n === 0) { setTimeout(onDone, 500); return; }
    playDrum();
    setSlam(true);
    const t1 = setTimeout(() => setSlam(false), 300);
    const t2 = setTimeout(() => setN(p => p - 1), 1000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [n]);

  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
    }}>
      <LaserBeams active={true} color1="#3a86ff" color2="#8338ec" />

      <div className="barlow-cond" style={{
        fontSize: 'clamp(0.8rem,1.8vw,1.4rem)',
        fontWeight: 900, letterSpacing: '0.8em',
        color: 'rgba(255,255,255,0.4)',
        textTransform: 'uppercase',
        marginBottom: 'clamp(16px,4vh,48px)',
      }}>
        ★ &nbsp; Estrazione Casuale &nbsp; ★
      </div>

      {n > 0 && (
        <div className="bebas" style={{
          fontSize: 'clamp(12rem,40vw,36rem)',
          lineHeight: 0.85,
          color: '#fff',
          textShadow: slam
            ? '0 0 0 #fff, 0 0 60px #3a86ff, 0 0 120px #8338ec'
            : '0 0 40px rgba(58,134,255,0.5)',
          animation: slam ? 'count-slam 0.3s ease-out' : 'none',
          transition: 'text-shadow 0.2s',
          WebkitTextStroke: slam ? '0px' : '2px rgba(58,134,255,0.3)',
          userSelect: 'none',
        }}>
          {n}
        </div>
      )}

      <AudioBars active={true} color="#3a86ff" count={32} />
    </div>
  );
};

// ─── PHASE: DRUM ROLL ────────────────────────────────────────────────────────

const PhaseDrumRoll = ({ onDone, label, color = '#ff006e' }) => {
  const [intensity, setIntensity] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    let i = 0; const total = 22;
    const step = () => {
      i++;
      const t = i / total;
      setIntensity(t);
      playRoll(0.3 + t * 0.7);
      const delay = Math.max(35, 200 - t * 165);
      if (i < total) timerRef.current = setTimeout(step, delay);
      else setTimeout(() => { playStinger(); onDone(); }, 150);
    };
    timerRef.current = setTimeout(step, 200);
    return () => clearTimeout(timerRef.current);
  }, []);

  const size = `${180 + intensity * 80}px`;

  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 'clamp(16px,4vh,40px)',
    }}>
      <LaserBeams active={true} color1={color} color2="#ffd700" />

      <div className="barlow-cond" style={{
        fontSize: 'clamp(1rem,2.5vw,2rem)',
        fontWeight: 900, letterSpacing: '0.5em',
        color: 'rgba(255,255,255,0.5)',
        textTransform: 'uppercase',
        animation: `pulse-glow 0.5s ease-in-out infinite`,
        color: 'rgba(255,255,255,0.6)',
      }}>
        {label}
      </div>

      {/* Central pulsing orb */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {/* Expanding rings on beat */}
        {[0,1,2].map(i => (
          <div key={i} style={{
            position: 'absolute',
            width: size, height: size,
            borderRadius: '50%',
            border: `2px solid ${color}`,
            opacity: 0,
            animation: `ring-expand ${0.6 / (0.5 + intensity)}s ${i * 0.2}s ease-out infinite`,
          }} />
        ))}
        <div style={{
          width: `clamp(100px,20vw,200px)`,
          height: `clamp(100px,20vw,200px)`,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${color}40 0%, ${color}10 50%, transparent 70%)`,
          border: `3px solid ${color}`,
          boxShadow: `0 0 ${40 + intensity * 60}px ${color}, inset 0 0 ${20 + intensity * 40}px ${color}30`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 'clamp(2.5rem,6vw,5rem)',
          transition: 'box-shadow 0.1s',
        }}>
          🎰
        </div>
      </div>

      <AudioBars active={true} color={color} count={28} />
    </div>
  );
};

// ─── PHASE: REVEAL ────────────────────────────────────────────────────────────

const PhaseReveal = ({ item, type, onDone }) => {
  const [stage, setStage] = useState(0);
  const isParticipant = type === 'participant';
  const color = isParticipant ? '#ffd700' : '#ff006e';
  const colorAlt = isParticipant ? '#ff9f1c' : '#8338ec';

  useEffect(() => {
    const t0 = setTimeout(() => setStage(1), 200);
    const t1 = setTimeout(() => setStage(2), 800);
    return () => { clearTimeout(t0); clearTimeout(t1); };
  }, []);

  const handleDone = () => {
    playFanfare();
    setStage(3);
    setTimeout(onDone, 3000);
  };

  const name = item?.nickname || item?.title || '???';
  const sub = item?.artist || null;

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {/* White flash */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 100,
        background: '#fff',
        opacity: stage === 0 ? 1 : 0,
        transition: 'opacity 0.5s ease',
        pointerEvents: 'none',
      }} />

      <StageFloor hot={isParticipant} />
      <LaserBeams active={stage >= 1} color1={color} color2={colorAlt} />
      {stage >= 3 && <Confetti active={true} />}

      <ShowLogo visible={stage >= 1} />

      <div style={{
        position: 'absolute', inset: 0, zIndex: 10,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 0,
      }}>
        {/* Category label */}
        <div className="barlow-cond" style={{
          fontSize: 'clamp(0.65rem,1.4vw,1.1rem)',
          fontWeight: 700, letterSpacing: '0.7em',
          color: color,
          textTransform: 'uppercase',
          opacity: stage >= 1 ? 1 : 0,
          transform: stage >= 1 ? 'none' : 'translateY(-10px)',
          transition: 'all 0.6s ease 0.2s',
          textShadow: `0 0 20px ${color}`,
          marginBottom: 'clamp(12px,3vh,36px)',
        }}>
          {isParticipant ? '— Il Cantante della Serata —' : '— La Canzone Assegnata —'}
        </div>

        {/* Avatar / icon */}
        <div style={{
          opacity: stage >= 1 ? 1 : 0,
          transform: stage >= 1 ? 'translateY(0) scale(1)' : 'translateY(40px) scale(0.6)',
          transition: 'all 0.7s cubic-bezier(0.34,1.4,0.64,1) 0.15s',
          marginBottom: 'clamp(16px,3.5vh,44px)',
          position: 'relative',
        }}>
          {/* Spinning gradient ring */}
          <div style={{
            position: 'absolute', inset: '-10px',
            borderRadius: isParticipant ? '50%' : '22px',
            background: `conic-gradient(${color}, ${colorAlt}, ${color})`,
            animation: 'laser-spin 3s linear infinite',
            opacity: stage >= 2 ? 1 : 0,
            transition: 'opacity 0.5s ease',
          }} />
          <div style={{
            position: 'absolute', inset: '-10px',
            borderRadius: isParticipant ? '50%' : '22px',
            background: '#000',
            inset: '-6px',
          }} />

          {item?.avatar_url ? (
            <img src={item.avatar_url} alt={name} style={{
              width: 'clamp(100px,16vw,180px)',
              height: 'clamp(100px,16vw,180px)',
              borderRadius: '50%',
              objectFit: 'cover',
              position: 'relative', zIndex: 1,
              boxShadow: `0 0 0 3px ${color}, 0 0 60px ${color}60, 0 20px 60px rgba(0,0,0,0.8)`,
              display: 'block',
            }} />
          ) : (
            <div style={{
              width: 'clamp(100px,16vw,180px)',
              height: 'clamp(100px,16vw,180px)',
              borderRadius: isParticipant ? '50%' : '20px',
              background: `radial-gradient(135deg, ${color}30, #000)`,
              border: `3px solid ${color}`,
              boxShadow: `0 0 60px ${color}50, 0 20px 60px rgba(0,0,0,0.8)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              position: 'relative', zIndex: 1,
              fontSize: isParticipant ? 'clamp(2.5rem,6vw,5.5rem)' : undefined,
            }}>
              {isParticipant
                ? <span className="bebas" style={{ color, lineHeight: 1 }}>{name.charAt(0).toUpperCase()}</span>
                : <Music2 style={{ width: '45%', height: '45%', color }} />
              }
            </div>
          )}
        </div>

        {/* Name — huge, with scramble */}
        <div style={{
          opacity: stage >= 2 ? 1 : 0,
          transform: stage >= 2 ? 'none' : 'translateY(30px)',
          transition: 'all 0.5s ease',
          textAlign: 'center',
          maxWidth: '90vw',
          padding: '0 clamp(16px,4vw,48px)',
        }}>
          <div className="bebas" style={{
            fontSize: 'clamp(3rem,9vw,10rem)',
            lineHeight: 0.9,
            color: stage >= 3 ? color : '#fff',
            textShadow: stage >= 3
              ? `0 0 60px ${color}, 0 0 120px ${color}60, 0 4px 0 rgba(0,0,0,0.8)`
              : '0 4px 0 rgba(0,0,0,0.8), 0 0 30px rgba(255,255,255,0.2)',
            transition: 'color 0.5s ease, text-shadow 0.5s ease',
            wordBreak: 'break-word',
            letterSpacing: '0.03em',
          }}>
            <ScrambleText finalText={name.toUpperCase()} running={stage >= 2} onDone={handleDone} />
          </div>

          {sub && (
            <div className="barlow-cond" style={{
              fontSize: 'clamp(1.2rem,2.8vw,2.8rem)',
              fontWeight: 700,
              color: colorAlt,
              letterSpacing: '0.15em',
              marginTop: 'clamp(4px,1vh,12px)',
              opacity: stage >= 3 ? 1 : 0,
              transform: stage >= 3 ? 'none' : 'translateY(10px)',
              transition: 'all 0.5s ease 0.2s',
              textShadow: `0 0 20px ${colorAlt}80`,
            }}>
              {sub.toUpperCase()}
            </div>
          )}
        </div>

        {/* Shimmer underline */}
        {stage >= 3 && (
          <div style={{
            width: 'clamp(80px,25vw,300px)',
            height: '3px',
            marginTop: 'clamp(12px,2.5vh,28px)',
            background: `linear-gradient(to right, transparent, ${color}, ${colorAlt}, ${color}, transparent)`,
            backgroundSize: '200% auto',
            animation: 'shimmer 2s linear infinite',
            boxShadow: `0 0 20px ${color}`,
          }} />
        )}
      </div>

      {stage >= 3 && (
        <BroadcastTicker
          text={isParticipant ? `CANTANTE ESTRATTO: ${name.toUpperCase()}` : `CANZONE ASSEGNATA: ${name.toUpperCase()}${sub ? ` — ${sub.toUpperCase()}` : ''}`}
          color={isParticipant ? '#cc8800' : '#cc0050'}
        />
      )}
    </div>
  );
};

// ─── PHASE: TRANSITION ────────────────────────────────────────────────────────

const PhaseTransition = ({ participant, onDone }) => {
  useEffect(() => {
    playDrum();
    setTimeout(onDone, 1000);
  }, []);

  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <StageFloor hot={false} />
      <div style={{ textAlign: 'center', zIndex: 10, position: 'relative' }}>
        <div className="bebas" style={{
          fontSize: 'clamp(1.5rem,4vw,4rem)',
          color: 'rgba(255,255,255,0.4)',
          letterSpacing: '0.3em',
        }}>
          {participant?.nickname?.toUpperCase() || ''}
        </div>
        <div className="bebas" style={{
          fontSize: 'clamp(2rem,5vw,5rem)',
          color: 'rgba(255,255,255,0.15)',
          letterSpacing: '0.2em',
        }}>
          canterà...
        </div>
      </div>
    </div>
  );
};

// ─── PHASE: CELEBRATION ──────────────────────────────────────────────────────

const PhaseCelebration = ({ participant, song, onDone }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setTimeout(() => setVisible(true), 100);
    setTimeout(onDone, 5000);
  }, []);

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <StageFloor hot={true} />
      <LaserBeams active={true} color1="#ffd700" color2="#ff006e" />
      <Confetti active={true} />

      <ShowLogo visible={true} />

      <div style={{
        position: 'absolute', inset: 0, zIndex: 10,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 0,
      }}>
        {/* ON STAGE badge */}
        <div style={{
          opacity: visible ? 1 : 0,
          transform: visible ? 'none' : 'translateY(-20px)',
          transition: 'all 0.6s ease',
          marginBottom: 'clamp(8px,2vh,24px)',
        }}>
          <div className="barlow-cond" style={{
            display: 'inline-block',
            background: 'linear-gradient(135deg, #ff006e, #ff4d00)',
            padding: 'clamp(4px,0.8vh,8px) clamp(20px,3vw,40px)',
            borderRadius: '4px',
            fontSize: 'clamp(0.7rem,1.4vw,1.1rem)',
            fontWeight: 900,
            letterSpacing: '0.5em',
            color: '#fff',
            textTransform: 'uppercase',
            boxShadow: '0 0 30px rgba(255,0,110,0.6)',
            animation: 'pulse-glow 1.5s ease-in-out infinite',
          }}>
            ★ On Stage ★
          </div>
        </div>

        {/* Participant name — massive */}
        <div style={{
          opacity: visible ? 1 : 0,
          transform: visible ? 'none' : 'translateY(40px)',
          transition: 'all 0.8s cubic-bezier(0.34,1.2,0.64,1) 0.1s',
          textAlign: 'center',
          animation: visible ? 'celebration-bounce 3s ease-in-out infinite 0.5s' : 'none',
        }}>
          <div className="bebas" style={{
            fontSize: 'clamp(4rem,12vw,13rem)',
            lineHeight: 0.85,
            color: '#ffd700',
            textShadow: '0 0 80px rgba(255,215,0,0.8), 0 0 160px rgba(255,215,0,0.4), 0 6px 0 rgba(0,0,0,0.9)',
            letterSpacing: '0.03em',
            wordBreak: 'break-word',
            maxWidth: '90vw',
            textAlign: 'center',
          }}>
            {(participant?.nickname || '').toUpperCase()}
          </div>
        </div>

        {/* Mic icon */}
        <div style={{
          fontSize: 'clamp(2rem,5vw,5rem)',
          opacity: visible ? 1 : 0,
          transition: 'opacity 0.5s ease 0.4s',
          margin: 'clamp(4px,1vh,12px) 0',
          filter: 'drop-shadow(0 0 20px rgba(255,215,0,0.8))',
        }}>🎤</div>

        {/* Divider */}
        <div style={{
          width: 'clamp(60px,18vw,200px)', height: '3px',
          background: 'linear-gradient(to right, transparent, #ff006e, #ffd700, #ff006e, transparent)',
          backgroundSize: '200% auto',
          animation: 'shimmer 1.5s linear infinite',
          boxShadow: '0 0 20px rgba(255,0,110,0.6)',
          marginBottom: 'clamp(8px,1.5vh,20px)',
          opacity: visible ? 1 : 0,
          transition: 'opacity 0.5s ease 0.5s',
        }} />

        {/* Song title */}
        <div style={{
          opacity: visible ? 1 : 0,
          transform: visible ? 'none' : 'translateY(20px)',
          transition: 'all 0.7s ease 0.6s',
          textAlign: 'center',
          maxWidth: '80vw',
        }}>
          <div className="barlow-cond" style={{
            fontSize: 'clamp(1.6rem,4vw,4.5rem)',
            fontWeight: 900,
            color: 'rgba(255,255,255,0.95)',
            letterSpacing: '0.08em',
            lineHeight: 1,
            textShadow: '0 0 30px rgba(255,255,255,0.3), 0 3px 0 rgba(0,0,0,0.8)',
          }}>
            {(song?.title || '').toUpperCase()}
          </div>
          {song?.artist && (
            <div className="barlow-cond" style={{
              fontSize: 'clamp(1rem,2.2vw,2.2rem)',
              fontWeight: 700,
              color: '#ff006e',
              letterSpacing: '0.2em',
              marginTop: 'clamp(4px,0.8vh,10px)',
              textShadow: '0 0 20px rgba(255,0,110,0.6)',
            }}>
              {song.artist.toUpperCase()}
            </div>
          )}
        </div>

        {/* "Preparati" tag */}
        <div style={{
          marginTop: 'clamp(16px,3vh,36px)',
          opacity: visible ? 1 : 0,
          transition: 'opacity 0.5s ease 0.9s',
        }}>
          <div className="barlow-cond" style={{
            display: 'inline-block',
            border: '2px solid rgba(255,215,0,0.5)',
            padding: 'clamp(6px,1vh,12px) clamp(20px,3vw,40px)',
            borderRadius: '4px',
            fontSize: 'clamp(0.75rem,1.5vw,1.2rem)',
            fontWeight: 900,
            letterSpacing: '0.4em',
            color: '#ffd700',
            textTransform: 'uppercase',
            background: 'rgba(255,215,0,0.08)',
            boxShadow: '0 0 30px rgba(255,215,0,0.2)',
            animation: 'pulse-glow 1.5s ease-in-out infinite',
          }}>
            Preparati a Cantare
          </div>
        </div>
      </div>

      <BroadcastTicker
        text={`${(participant?.nickname || '').toUpperCase()} canta: ${(song?.title || '').toUpperCase()}${song?.artist ? ` — ${song.artist.toUpperCase()}` : ''}`}
        color="#aa6600"
      />
    </div>
  );
};

// ─── MAIN ─────────────────────────────────────────────────────────────────────

export default function ExtractionMode({ extractionData, participants, songs, onComplete }) {
  const [phase, setPhase] = useState('countdown');
  const participant = extractionData?.participant;
  const song = extractionData?.song;

  return (
    <div style={{
      position: 'absolute', inset: 0, overflow: 'hidden',
      background: '#000',
    }}>
      <style>{GLOBAL_STYLES}</style>

      {phase === 'countdown' && (
        <PhaseCountdown onDone={() => setPhase('drumroll-participant')} />
      )}
      {phase === 'drumroll-participant' && (
        <PhaseDrumRoll label="Chi canta?" color="#ffd700" onDone={() => setPhase('reveal-participant')} />
      )}
      {phase === 'reveal-participant' && (
        <PhaseReveal item={participant} type="participant" onDone={() => setPhase('transition')} />
      )}
      {phase === 'transition' && (
        <PhaseTransition participant={participant} onDone={() => setPhase('drumroll-song')} />
      )}
      {phase === 'drumroll-song' && (
        <PhaseDrumRoll label="La Canzone" color="#ff006e" onDone={() => setPhase('reveal-song')} />
      )}
      {phase === 'reveal-song' && (
        <PhaseReveal item={song} type="song" onDone={() => setPhase('celebration')} />
      )}
      {phase === 'celebration' && (
        <PhaseCelebration participant={participant} song={song} onDone={() => { if (onComplete) onComplete(); }} />
      )}
    </div>
  );
}