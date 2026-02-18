import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Music2 } from 'lucide-react';

// ─── GLOBAL STYLES ────────────────────────────────────────────────────────────

const GLOBAL_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow+Condensed:ital,wght@0,300;0,700;0,900;1,300&display=swap');

  @keyframes rotate-cw  { to { transform: rotate(360deg); } }
  @keyframes rotate-ccw { to { transform: rotate(-360deg); } }

  @keyframes count-slam {
    0%   { opacity:0; transform: scale(3) translateY(-10px); }
    45%  { opacity:1; transform: scale(0.92); }
    70%  { transform: scale(1.04); }
    100% { transform: scale(1); }
  }
  @keyframes count-exit {
    to { opacity:0; transform: scale(0.5); }
  }

  @keyframes fade-up {
    from { opacity:0; transform: translateY(32px); }
    to   { opacity:1; transform: translateY(0); }
  }
  @keyframes fade-in {
    from { opacity:0; }
    to   { opacity:1; }
  }

  @keyframes line-expand {
    from { transform: scaleX(0); }
    to   { transform: scaleX(1); }
  }

  @keyframes ring-pulse {
    0%,100% { opacity: 0.6; transform: scale(1); }
    50%     { opacity: 1;   transform: scale(1.03); }
  }
  @keyframes ring-ripple {
    0%   { transform: scale(1);   opacity: 0.8; }
    100% { transform: scale(1.8); opacity: 0; }
  }

  @keyframes bar-beat {
    0%,100% { transform: scaleY(0.25); }
    50%     { transform: scaleY(1); }
  }

  @keyframes ticker-scroll {
    from { transform: translateX(0); }
    to   { transform: translateX(-50%); }
  }

  @keyframes shimmer-line {
    0%   { background-position: -200% center; }
    100% { background-position:  200% center; }
  }

  @keyframes scan {
    from { top: 0; }
    to   { top: 100%; }
  }

  @keyframes glow-pulse {
    0%,100% { opacity: 0.6; }
    50%     { opacity: 1; }
  }

  @keyframes clip-reveal {
    from { clip-path: inset(0 100% 0 0); }
    to   { clip-path: inset(0 0%   0 0); }
  }
`;

// ─── AUDIO — minimal, cinematic ───────────────────────────────────────────────

const mkCtx = () => new (window.AudioContext || window.webkitAudioContext)();

const playTick = () => {
  try {
    const a = mkCtx();
    const o = a.createOscillator(); const g = a.createGain();
    o.connect(g); g.connect(a.destination);
    o.type = 'sine'; o.frequency.value = 880;
    g.gain.setValueAtTime(0, a.currentTime);
    g.gain.linearRampToValueAtTime(0.18, a.currentTime + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + 0.12);
    o.start(a.currentTime); o.stop(a.currentTime + 0.15);
  } catch {}
};

const playImpact = () => {
  try {
    const a = mkCtx();
    // Low thud
    const buf = a.createBuffer(1, a.sampleRate * 0.4, a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++)
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 6) * (i < 100 ? i / 100 : 1);
    const src = a.createBufferSource(); const g = a.createGain();
    src.buffer = buf; src.connect(g); g.connect(a.destination);
    g.gain.setValueAtTime(0.5, a.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + 0.35);
    src.start();
    // High sine ping
    const o = a.createOscillator(); const g2 = a.createGain();
    o.connect(g2); g2.connect(a.destination);
    o.type = 'sine'; o.frequency.setValueAtTime(1200, a.currentTime);
    o.frequency.exponentialRampToValueAtTime(300, a.currentTime + 0.4);
    g2.gain.setValueAtTime(0.12, a.currentTime);
    g2.gain.exponentialRampToValueAtTime(0.001, a.currentTime + 0.4);
    o.start(); o.stop(a.currentTime + 0.45);
  } catch {}
};

const playRise = () => {
  try {
    const a = mkCtx();
    const o = a.createOscillator(); const g = a.createGain();
    o.connect(g); g.connect(a.destination);
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(80, a.currentTime);
    o.frequency.exponentialRampToValueAtTime(1800, a.currentTime + 1.2);
    g.gain.setValueAtTime(0, a.currentTime);
    g.gain.linearRampToValueAtTime(0.07, a.currentTime + 0.3);
    g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + 1.3);
    o.start(); o.stop(a.currentTime + 1.4);
  } catch {}
};

const playReveal = () => {
  try {
    const a = mkCtx();
    [[0,220],[0.07,440],[0.14,660],[0.22,880],[0.32,1320]].forEach(([t, f]) => {
      const o = a.createOscillator(); const g = a.createGain();
      o.connect(g); g.connect(a.destination);
      o.type = 'triangle'; o.frequency.value = f;
      const start = a.currentTime + t;
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(0.12, start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, start + 0.22);
      o.start(start); o.stop(start + 0.25);
    });
  } catch {}
};

// ─── BACKGROUND ───────────────────────────────────────────────────────────────

const Background = ({ phase }) => {
  const isWarm = ['reveal-participant', 'celebration'].includes(phase);
  const isMid  = ['drumroll-participant'].includes(phase);

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 0, overflow: 'hidden' }}>
      {/* Base */}
      <div style={{
        position: 'absolute', inset: 0,
        background: isWarm
          ? 'radial-gradient(ellipse at 50% 100%, #120800 0%, #060004 50%, #000 100%)'
          : 'radial-gradient(ellipse at 50% 100%, #00050f 0%, #000410 50%, #000 100%)',
        transition: 'background 1.5s ease',
      }} />
      {/* Floor glow */}
      <div style={{
        position: 'absolute', bottom: '-5%', left: '15%', right: '15%', height: '40%',
        background: isWarm
          ? 'radial-gradient(ellipse, rgba(255,160,0,0.07) 0%, transparent 70%)'
          : 'radial-gradient(ellipse, rgba(0,120,255,0.07) 0%, transparent 70%)',
        filter: 'blur(30px)',
        transition: 'background 1.5s ease',
      }} />
      {/* Scan line */}
      <div style={{
        position: 'absolute', left: 0, right: 0, height: '2px',
        background: 'linear-gradient(to bottom, transparent, rgba(255,255,255,0.015), transparent)',
        animation: 'scan 7s linear infinite',
        pointerEvents: 'none',
      }} />
      {/* Vignette */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.7) 100%)',
      }} />
      {/* Stage bottom bar */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: '3px',
        background: isWarm
          ? 'linear-gradient(to right, transparent, rgba(255,160,0,0.6) 30%, rgba(255,80,0,0.8) 50%, rgba(255,160,0,0.6) 70%, transparent)'
          : 'linear-gradient(to right, transparent, rgba(0,120,255,0.6) 30%, rgba(80,0,255,0.8) 50%, rgba(0,120,255,0.6) 70%, transparent)',
        boxShadow: isWarm
          ? '0 0 40px rgba(255,120,0,0.5)'
          : '0 0 40px rgba(0,80,255,0.5)',
        transition: 'all 1.5s ease',
      }} />
    </div>
  );
};

// ─── ROTATING RING SYSTEM ─────────────────────────────────────────────────────

const RingSystem = ({ active, color, size = 300 }) => {
  if (!active) return null;
  const rings = [
    { r: size * 0.5,  w: 1,   spd: 18, dir: 'cw',  op: 0.5 },
    { r: size * 0.7,  w: 0.5, spd: 28, dir: 'ccw', op: 0.3 },
    { r: size * 0.9,  w: 1,   spd: 22, dir: 'cw',  op: 0.25 },
    { r: size * 1.15, w: 0.5, spd: 35, dir: 'ccw', op: 0.15 },
  ];

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2 }}>
      {rings.map((ring, i) => (
        <div key={i} style={{
          position: 'absolute',
          top: '50%', left: '50%',
          width: `${ring.r * 2}px`, height: `${ring.r * 2}px`,
          marginLeft: `-${ring.r}px`, marginTop: `-${ring.r}px`,
          borderRadius: '50%',
          border: `${ring.w}px solid ${color}`,
          opacity: ring.op,
          animation: `rotate-${ring.dir} ${ring.spd}s linear infinite`,
          // Dashes on some rings
          ...(i % 2 === 1 ? {
            border: 'none',
            background: `transparent`,
            boxShadow: `0 0 0 ${ring.w}px ${color}`,
            WebkitMaskImage: 'none',
          } : {}),
        }}>
          {/* Tick marks */}
          {i === 0 && Array.from({ length: 12 }).map((_, t) => (
            <div key={t} style={{
              position: 'absolute',
              top: '50%', left: '50%',
              width: '8px', height: `${ring.w + 0.5}px`,
              background: color,
              opacity: 0.8,
              transformOrigin: `${-ring.r + 4}px 50%`,
              transform: `rotate(${t * 30}deg) translateX(-${ring.r}px)`,
              marginTop: '-0.5px',
            }} />
          ))}
        </div>
      ))}
      {/* Ripple rings */}
      {[0, 0.6, 1.2].map((delay, i) => (
        <div key={`rip-${i}`} style={{
          position: 'absolute',
          top: '50%', left: '50%',
          width: `${size}px`, height: `${size}px`,
          marginLeft: `-${size / 2}px`, marginTop: `-${size / 2}px`,
          borderRadius: '50%',
          border: `1px solid ${color}`,
          opacity: 0,
          animation: `ring-ripple 2.4s ${delay}s ease-out infinite`,
        }} />
      ))}
    </div>
  );
};

// ─── AUDIO BARS ───────────────────────────────────────────────────────────────

const AudioBars = ({ active, color, count = 32, height = 48 }) => {
  const [h, setH] = useState(() => Array(count).fill(0.1));
  const ref = useRef(null);

  useEffect(() => {
    if (!active) { setH(Array(count).fill(0.05)); return; }
    ref.current = setInterval(() => {
      setH(Array(count).fill(0).map((_, i) => {
        const center = count / 2;
        const dist = Math.abs(i - center) / center;
        return (0.1 + Math.random() * 0.9) * (1 - dist * 0.4);
      }));
    }, 80);
    return () => clearInterval(ref.current);
  }, [active, count]);

  return (
    <div style={{ display: 'flex', gap: '3px', alignItems: 'flex-end', height: `${height}px` }}>
      {h.map((v, i) => (
        <div key={i} style={{
          flex: 1, minWidth: '3px',
          borderRadius: '1px 1px 0 0',
          background: color,
          height: `${v * 100}%`,
          transition: 'height 0.07s ease',
          opacity: 0.3 + v * 0.7,
          boxShadow: v > 0.7 ? `0 0 6px ${color}` : 'none',
        }} />
      ))}
    </div>
  );
};

// ─── SCRAMBLE TEXT ────────────────────────────────────────────────────────────

const ScrambleText = ({ text, running, onDone }) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const [display, setDisplay] = useState(text);
  const ref = useRef(null);
  const step = useRef(0);

  useEffect(() => {
    if (!running || !text) return;
    step.current = 0;
    const total = 24;
    ref.current = setInterval(() => {
      step.current++;
      const prog = step.current / total;
      const revealed = Math.floor(prog * text.length);
      setDisplay(text.split('').map((ch, i) => {
        if (i < revealed) return ch;
        if (ch === ' ') return ' ';
        return chars[Math.floor(Math.random() * chars.length)];
      }).join(''));
      if (step.current >= total) {
        clearInterval(ref.current);
        setDisplay(text);
        onDone?.();
      }
    }, 55);
    return () => clearInterval(ref.current);
  }, [running, text]);

  return <>{display}</>;
};

// ─── TICKER ───────────────────────────────────────────────────────────────────

const Ticker = ({ text, color }) => (
  <div style={{
    position: 'absolute', bottom: '8%', left: 0, right: 0,
    zIndex: 20, overflow: 'hidden',
  }}>
    <div style={{
      background: `linear-gradient(to right, ${color}dd, ${color}bb)`,
      display: 'flex', alignItems: 'center',
      borderTop: `1px solid rgba(255,255,255,0.15)`,
      borderBottom: `1px solid rgba(0,0,0,0.3)`,
    }}>
      <div style={{
        background: 'rgba(0,0,0,0.35)',
        padding: '7px 18px',
        fontFamily: 'Barlow Condensed, sans-serif',
        fontWeight: 900, fontSize: 'clamp(0.55rem,1.1vw,0.85rem)',
        letterSpacing: '0.35em', color: '#fff',
        whiteSpace: 'nowrap', flexShrink: 0,
        borderRight: '1px solid rgba(255,255,255,0.15)',
      }}>
        LIVE
      </div>
      <div style={{ overflow: 'hidden', flex: 1 }}>
        <div style={{
          display: 'inline-block', whiteSpace: 'nowrap',
          animation: 'ticker-scroll 14s linear infinite',
          fontFamily: 'Barlow Condensed, sans-serif',
          fontWeight: 700, fontSize: 'clamp(0.65rem,1.3vw,1rem)',
          letterSpacing: '0.18em', color: '#fff', padding: '7px 0',
        }}>
          {[text, text, text, text].map((t, i) => (
            <span key={i} style={{ marginRight: '5em' }}>{t}</span>
          ))}
        </div>
      </div>
    </div>
  </div>
);

// ─── SHOW LOGO ────────────────────────────────────────────────────────────────

const ShowLogo = () => (
  <div style={{
    position: 'absolute', top: 'clamp(14px,2.5vh,36px)', left: '50%',
    transform: 'translateX(-50%)', zIndex: 30, textAlign: 'center',
  }}>
    <div style={{
      fontFamily: 'Barlow Condensed, sans-serif',
      fontWeight: 300, fontStyle: 'italic',
      fontSize: 'clamp(0.6rem,1.1vw,0.85rem)',
      letterSpacing: '0.55em',
      color: 'rgba(255,255,255,0.18)',
      textTransform: 'uppercase',
    }}>
      Discojoys &nbsp;/&nbsp; Talent Show
    </div>
  </div>
);

// ─── PHASE: COUNTDOWN ────────────────────────────────────────────────────────

const PhaseCountdown = ({ onDone }) => {
  const [n, setN] = useState(3);
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (n === 0) { setTimeout(onDone, 600); return; }
    playTick();
    setActive(true);
    const t1 = setTimeout(() => setActive(false), 400);
    const t2 = setTimeout(() => setN(p => p - 1), 1000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [n]);

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <Background phase="countdown" />
      <RingSystem active={true} color="rgba(80,120,255,0.4)" size={320} />

      <div style={{
        position: 'absolute', inset: 0, zIndex: 10,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          fontFamily: 'Barlow Condensed, sans-serif',
          fontWeight: 300, fontSize: 'clamp(0.7rem,1.4vw,1.1rem)',
          letterSpacing: '0.8em', color: 'rgba(255,255,255,0.3)',
          textTransform: 'uppercase', marginBottom: 'clamp(20px,5vh,60px)',
          animation: 'fade-in 0.8s ease forwards',
        }}>
          Estrazione Casuale
        </div>

        {n > 0 && (
          <div style={{
            fontFamily: 'Bebas Neue, sans-serif',
            fontSize: 'clamp(14rem,42vw,38rem)',
            lineHeight: 0.85,
            color: active ? '#fff' : 'transparent',
            WebkitTextStroke: active ? '0px' : '2px rgba(80,120,255,0.4)',
            textShadow: active
              ? '0 0 80px rgba(100,140,255,0.5), 0 0 160px rgba(100,140,255,0.2)'
              : 'none',
            animation: active ? 'count-slam 0.3s ease-out forwards' : 'count-exit 0.4s ease-in forwards',
            transition: 'color 0.1s, WebkitTextStroke 0.1s',
            userSelect: 'none',
          }}>
            {n}
          </div>
        )}

        <div style={{ marginTop: 'clamp(24px,5vh,60px)', width: 'clamp(200px,40vw,500px)' }}>
          <AudioBars active={true} color="rgba(80,120,255,0.6)" count={32} height={40} />
        </div>
      </div>
    </div>
  );
};

// ─── PHASE: DRUM ROLL ────────────────────────────────────────────────────────

const PhaseDrumRoll = ({ label, color, onDone }) => {
  const [intensity, setIntensity] = useState(0);
  const ref = useRef(null);

  useEffect(() => {
    playRise();
    let i = 0; const total = 22;
    const step = () => {
      i++;
      const t = i / total;
      setIntensity(t);
      const delay = Math.max(35, 200 - t * 165);
      if (i < total) ref.current = setTimeout(step, delay);
      else setTimeout(() => { playImpact(); onDone(); }, 100);
    };
    ref.current = setTimeout(step, 300);
    return () => clearTimeout(ref.current);
  }, []);

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <Background phase="drumroll" />
      <RingSystem active={true} color={`${color}55`} size={280 + intensity * 80} />

      <div style={{
        position: 'absolute', inset: 0, zIndex: 10,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 'clamp(20px,5vh,60px)',
      }}>
        <div style={{
          fontFamily: 'Barlow Condensed, sans-serif',
          fontWeight: 300, fontSize: 'clamp(0.8rem,1.8vw,1.5rem)',
          letterSpacing: '0.7em', color: 'rgba(255,255,255,0.35)',
          textTransform: 'uppercase',
        }}>
          {label}
        </div>

        {/* Central orb — pure light, no objects */}
        <div style={{
          position: 'relative',
          width: 'clamp(100px,18vw,180px)',
          height: 'clamp(100px,18vw,180px)',
        }}>
          <div style={{
            position: 'absolute', inset: 0,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${color}30 0%, ${color}08 50%, transparent 70%)`,
            border: `1px solid ${color}60`,
            boxShadow: `0 0 ${30 + intensity * 80}px ${color}40, inset 0 0 ${20 + intensity * 40}px ${color}20`,
            animation: 'ring-pulse 0.5s ease-in-out infinite',
          }} />
          {/* Inner cross */}
          <div style={{
            position: 'absolute', top: '50%', left: '10%', right: '10%',
            height: '1px', background: `${color}40`,
            transform: 'translateY(-50%)',
          }} />
          <div style={{
            position: 'absolute', left: '50%', top: '10%', bottom: '10%',
            width: '1px', background: `${color}40`,
            transform: 'translateX(-50%)',
          }} />
          <div style={{
            position: 'absolute', inset: '40%',
            borderRadius: '50%',
            background: color,
            opacity: 0.4 + intensity * 0.6,
            boxShadow: `0 0 ${intensity * 40}px ${color}`,
          }} />
        </div>

        <div style={{ width: 'clamp(200px,40vw,500px)' }}>
          <AudioBars active={true} color={`${color}99`} count={28} height={48} />
        </div>
      </div>
    </div>
  );
};

// ─── PHASE: REVEAL ────────────────────────────────────────────────────────────

const PhaseReveal = ({ item, type, onDone }) => {
  const [stage, setStage] = useState(0);
  const isP = type === 'participant';
  const color     = isP ? '#e8a020' : '#4080ff';
  const colorDim  = isP ? 'rgba(232,160,32,0.3)'  : 'rgba(64,128,255,0.3)';

  useEffect(() => {
    const t0 = setTimeout(() => setStage(1), 250);
    const t1 = setTimeout(() => setStage(2), 900);
    return () => { clearTimeout(t0); clearTimeout(t1); };
  }, []);

  const handleDone = () => {
    playReveal();
    setStage(3);
    setTimeout(onDone, 3200);
  };

  const name = item?.nickname || item?.title || '---';
  const sub  = item?.artist || null;

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {/* Flash */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 100,
        background: '#fff', pointerEvents: 'none',
        opacity: stage === 0 ? 1 : 0, transition: 'opacity 0.5s ease',
      }} />

      <Background phase={isP ? 'reveal-participant' : 'reveal-song'} />
      <RingSystem active={stage >= 1} color={colorDim} size={340} />
      <ShowLogo />

      <div style={{
        position: 'absolute', inset: 0, zIndex: 10,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
        {/* Label */}
        <div style={{
          fontFamily: 'Barlow Condensed, sans-serif',
          fontWeight: 300, fontStyle: 'italic',
          fontSize: 'clamp(0.65rem,1.3vw,1rem)',
          letterSpacing: '0.6em', color,
          textTransform: 'uppercase',
          opacity: stage >= 1 ? 0.8 : 0,
          transform: stage >= 1 ? 'none' : 'translateY(-8px)',
          transition: 'all 0.6s ease 0.2s',
          marginBottom: 'clamp(12px,3vh,40px)',
        }}>
          {isP ? 'Il Cantante' : 'La Canzone'}
        </div>

        {/* Avatar */}
        {item?.avatar_url && (
          <div style={{
            opacity: stage >= 1 ? 1 : 0,
            transform: stage >= 1 ? 'none' : 'scale(0.7)',
            transition: 'all 0.7s cubic-bezier(0.34,1.3,0.64,1) 0.15s',
            marginBottom: 'clamp(16px,3.5vh,44px)',
            position: 'relative',
          }}>
            {/* Spinning border */}
            <div style={{
              position: 'absolute', inset: '-3px',
              borderRadius: '50%',
              background: `conic-gradient(${color}, transparent 60%, ${color})`,
              animation: 'rotate-cw 4s linear infinite',
              opacity: stage >= 2 ? 1 : 0,
              transition: 'opacity 0.5s ease',
            }} />
            <div style={{
              position: 'absolute', inset: '0px',
              borderRadius: '50%', background: '#000',
            }} />
            <img src={item.avatar_url} alt="" style={{
              width: 'clamp(90px,14vw,160px)',
              height: 'clamp(90px,14vw,160px)',
              borderRadius: '50%', objectFit: 'cover',
              display: 'block', position: 'relative', zIndex: 1,
              boxShadow: `0 0 60px ${color}40, 0 20px 60px rgba(0,0,0,0.9)`,
            }} />
          </div>
        )}

        {/* No avatar — just initials, clean */}
        {!item?.avatar_url && isP && (
          <div style={{
            opacity: stage >= 1 ? 1 : 0,
            transform: stage >= 1 ? 'none' : 'scale(0.7)',
            transition: 'all 0.7s cubic-bezier(0.34,1.3,0.64,1) 0.15s',
            marginBottom: 'clamp(16px,3.5vh,44px)',
            width: 'clamp(90px,14vw,160px)',
            height: 'clamp(90px,14vw,160px)',
            borderRadius: '50%',
            border: `1px solid ${color}60`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 0 60px ${color}30`,
          }}>
            <span style={{
              fontFamily: 'Bebas Neue, sans-serif',
              fontSize: 'clamp(2.5rem,6vw,5.5rem)',
              color, lineHeight: 1,
            }}>
              {name.charAt(0).toUpperCase()}
            </span>
          </div>
        )}

        {/* Name */}
        <div style={{
          textAlign: 'center',
          maxWidth: '88vw',
          padding: '0 clamp(16px,4vw,60px)',
          opacity: stage >= 2 ? 1 : 0,
          transform: stage >= 2 ? 'none' : 'translateY(24px)',
          transition: 'all 0.55s ease',
        }}>
          <div style={{
            fontFamily: 'Bebas Neue, sans-serif',
            fontSize: 'clamp(3.5rem,10vw,11rem)',
            lineHeight: 0.88,
            color: stage >= 3 ? color : '#fff',
            textShadow: stage >= 3
              ? `0 0 80px ${color}60, 0 0 160px ${color}20`
              : '0 0 40px rgba(255,255,255,0.1)',
            transition: 'color 0.6s ease, text-shadow 0.6s ease',
            wordBreak: 'break-word',
            letterSpacing: '0.02em',
          }}>
            <ScrambleText text={name.toUpperCase()} running={stage >= 2} onDone={handleDone} />
          </div>

          {sub && (
            <div style={{
              fontFamily: 'Barlow Condensed, sans-serif',
              fontWeight: 700,
              fontSize: 'clamp(1rem,2.5vw,2.5rem)',
              letterSpacing: '0.2em',
              color: `${color}cc`,
              marginTop: 'clamp(4px,0.8vh,12px)',
              opacity: stage >= 3 ? 1 : 0,
              transform: stage >= 3 ? 'none' : 'translateY(8px)',
              transition: 'all 0.5s ease 0.2s',
            }}>
              {sub.toUpperCase()}
            </div>
          )}
        </div>

        {/* Underline */}
        {stage >= 3 && (
          <div style={{
            width: 'clamp(60px,20vw,240px)',
            height: '1px',
            marginTop: 'clamp(12px,2.5vh,30px)',
            background: `linear-gradient(to right, transparent, ${color}, transparent)`,
            backgroundSize: '200% auto',
            animation: 'shimmer-line 2.5s linear infinite',
            boxShadow: `0 0 12px ${color}80`,
          }} />
        )}
      </div>

      {stage >= 3 && (
        <Ticker
          text={isP ? `Cantante: ${name.toUpperCase()}` : `Canzone: ${name.toUpperCase()}${sub ? `  —  ${sub.toUpperCase()}` : ''}`}
          color={isP ? '#8a5a00' : '#003080'}
        />
      )}
    </div>
  );
};

// ─── PHASE: TRANSITION ────────────────────────────────────────────────────────

const PhaseTransition = ({ participant, onDone }) => {
  useEffect(() => {
    setTimeout(onDone, 1000);
  }, []);

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <Background phase="transition" />
      <div style={{
        position: 'absolute', inset: 0, zIndex: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: '0.3em',
      }}>
        <div style={{
          fontFamily: 'Bebas Neue, sans-serif',
          fontSize: 'clamp(2rem,5vw,5rem)',
          color: 'rgba(255,255,255,0.25)',
          letterSpacing: '0.1em',
        }}>
          {participant?.nickname?.toUpperCase() || ''}
        </div>
        <div style={{
          fontFamily: 'Barlow Condensed, sans-serif',
          fontWeight: 300, fontStyle: 'italic',
          fontSize: 'clamp(1rem,2vw,2rem)',
          color: 'rgba(255,255,255,0.12)',
          letterSpacing: '0.4em',
          textTransform: 'uppercase',
        }}>
          canterà
        </div>
      </div>
    </div>
  );
};

// ─── PHASE: CELEBRATION ──────────────────────────────────────────────────────

const PhaseCelebration = ({ participant, song, onDone }) => {
  const [vis, setVis] = useState(false);

  useEffect(() => {
    setTimeout(() => setVis(true), 80);
    setTimeout(onDone, 6000);
  }, []);

  const name  = (participant?.nickname || '').toUpperCase();
  const title = (song?.title || '').toUpperCase();
  const artist = song?.artist?.toUpperCase() || null;

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <Background phase="celebration" />
      <RingSystem active={true} color="rgba(232,160,32,0.25)" size={400} />
      <ShowLogo />

      <div style={{
        position: 'absolute', inset: 0, zIndex: 10,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
        {/* "On Stage" label */}
        <div style={{
          fontFamily: 'Barlow Condensed, sans-serif',
          fontWeight: 700,
          fontSize: 'clamp(0.6rem,1.2vw,0.95rem)',
          letterSpacing: '0.6em',
          color: 'rgba(232,160,32,0.7)',
          textTransform: 'uppercase',
          marginBottom: 'clamp(8px,2vh,24px)',
          opacity: vis ? 1 : 0,
          transition: 'opacity 0.8s ease',
          animation: vis ? 'glow-pulse 2.5s ease-in-out infinite' : 'none',
        }}>
          On Stage
        </div>

        {/* Participant name — maximum impact */}
        <div style={{
          fontFamily: 'Bebas Neue, sans-serif',
          fontSize: 'clamp(5rem,14vw,15rem)',
          lineHeight: 0.85,
          color: '#e8a020',
          textShadow: '0 0 100px rgba(232,160,32,0.6), 0 0 200px rgba(232,160,32,0.2), 0 6px 0 rgba(0,0,0,0.9)',
          letterSpacing: '0.02em',
          wordBreak: 'break-word',
          textAlign: 'center',
          maxWidth: '92vw',
          opacity: vis ? 1 : 0,
          transform: vis ? 'none' : 'translateY(50px)',
          transition: 'all 0.9s cubic-bezier(0.34,1.2,0.64,1) 0.05s',
          animation: vis ? 'glow-pulse 3s ease-in-out infinite 0.5s' : 'none',
        }}>
          {name}
        </div>

        {/* Divider */}
        <div style={{
          width: vis ? 'clamp(60px,18vw,220px)' : '0px',
          height: '1px',
          background: 'linear-gradient(to right, transparent, rgba(232,160,32,0.8), transparent)',
          transition: 'width 1s ease 0.6s',
          boxShadow: '0 0 12px rgba(232,160,32,0.5)',
          margin: 'clamp(12px,2.5vh,30px) 0',
        }} />

        {/* Song title */}
        <div style={{
          textAlign: 'center', maxWidth: '80vw',
          opacity: vis ? 1 : 0,
          transform: vis ? 'none' : 'translateY(20px)',
          transition: 'all 0.8s ease 0.7s',
        }}>
          <div style={{
            fontFamily: 'Barlow Condensed, sans-serif',
            fontWeight: 900,
            fontSize: 'clamp(1.8rem,4.5vw,5rem)',
            letterSpacing: '0.06em',
            color: 'rgba(255,255,255,0.92)',
            textShadow: '0 0 30px rgba(255,255,255,0.15), 0 3px 0 rgba(0,0,0,0.8)',
            lineHeight: 1,
          }}>
            {title}
          </div>
          {artist && (
            <div style={{
              fontFamily: 'Barlow Condensed, sans-serif',
              fontWeight: 300, fontStyle: 'italic',
              fontSize: 'clamp(1rem,2.2vw,2.2rem)',
              letterSpacing: '0.25em',
              color: 'rgba(232,160,32,0.7)',
              marginTop: 'clamp(4px,0.8vh,10px)',
            }}>
              {artist}
            </div>
          )}
        </div>

        {/* "Preparati" tag */}
        <div style={{
          marginTop: 'clamp(20px,4vh,48px)',
          opacity: vis ? 1 : 0,
          transition: 'opacity 0.6s ease 1.1s',
        }}>
          <div style={{
            fontFamily: 'Barlow Condensed, sans-serif',
            fontWeight: 700,
            fontSize: 'clamp(0.65rem,1.3vw,1rem)',
            letterSpacing: '0.5em',
            color: 'rgba(232,160,32,0.5)',
            textTransform: 'uppercase',
            borderTop: '1px solid rgba(232,160,32,0.2)',
            borderBottom: '1px solid rgba(232,160,32,0.2)',
            padding: 'clamp(6px,1vh,12px) clamp(20px,3vw,40px)',
          }}>
            Preparati a Cantare
          </div>
        </div>
      </div>

      <Ticker
        text={`${name}  —  ${title}${artist ? `  /  ${artist}` : ''}`}
        color="#6a3800"
      />
    </div>
  );
};

// ─── MAIN ─────────────────────────────────────────────────────────────────────

export default function ExtractionMode({ extractionData, participants, songs, onComplete }) {
  const [phase, setPhase] = useState('countdown');
  const participant = extractionData?.participant;
  const song        = extractionData?.song;

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: '#000' }}>
      <style>{GLOBAL_STYLES}</style>

      {phase === 'countdown' && (
        <PhaseCountdown onDone={() => setPhase('drumroll-participant')} />
      )}
      {phase === 'drumroll-participant' && (
        <PhaseDrumRoll label="Chi canta?" color="#e8a020" onDone={() => setPhase('reveal-participant')} />
      )}
      {phase === 'reveal-participant' && (
        <PhaseReveal item={participant} type="participant" onDone={() => setPhase('transition')} />
      )}
      {phase === 'transition' && (
        <PhaseTransition participant={participant} onDone={() => setPhase('drumroll-song')} />
      )}
      {phase === 'drumroll-song' && (
        <PhaseDrumRoll label="La Canzone" color="#4080ff" onDone={() => setPhase('reveal-song')} />
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