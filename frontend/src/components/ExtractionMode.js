import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Music2, Mic2 } from 'lucide-react';

// ─── AUDIO ────────────────────────────────────────────────────────────────────

const mkCtx = () => new (window.AudioContext || window.webkitAudioContext)();

const playDrum = () => {
  try {
    const a = mkCtx();
    const buf = a.createBuffer(1, a.sampleRate * 0.3, a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 8);
    const src = a.createBufferSource();
    const g = a.createGain();
    src.buffer = buf; src.connect(g); g.connect(a.destination);
    g.gain.setValueAtTime(0.6, a.currentTime);
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
      const src = a.createBufferSource();
      const g = a.createGain();
      src.buffer = buf; src.connect(g); g.connect(a.destination);
      const t = a.currentTime + i * (0.08 / intensity);
      g.gain.setValueAtTime(0.3 * intensity, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      src.start(t);
    }
  } catch {}
};

const playStinger = () => {
  try {
    const a = mkCtx();
    [[0, 220], [0.05, 330], [0.1, 440], [0.18, 880], [0.25, 1320]].forEach(([delay, freq]) => {
      const o = a.createOscillator(); const g = a.createGain();
      o.connect(g); g.connect(a.destination);
      o.type = 'sawtooth'; o.frequency.value = freq;
      const t = a.currentTime + delay;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.2, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      o.start(t); o.stop(t + 0.2);
    });
  } catch {}
};

const playRevealFanfare = () => {
  try {
    const a = mkCtx();
    const melody = [[0,523],[0.1,659],[0.2,784],[0.3,1047],[0.45,784],[0.55,1047],[0.65,1319]];
    melody.forEach(([delay, freq]) => {
      const o = a.createOscillator(); const g = a.createGain();
      o.connect(g); g.connect(a.destination);
      o.type = 'square'; o.frequency.value = freq;
      const t = a.currentTime + delay;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.15, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      o.start(t); o.stop(t + 0.25);
    });
  } catch {}
};

// ─── PARTICLES ────────────────────────────────────────────────────────────────

const Particles = ({ active }) => {
  const canvasRef = useRef(null);
  const particlesRef = useRef([]);
  const rafRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const ctx = canvas.getContext('2d');

    if (active) {
      particlesRef.current = Array.from({ length: 120 }, () => ({
        x: Math.random() * canvas.width,
        y: canvas.height + 20,
        vx: (Math.random() - 0.5) * 6,
        vy: -(Math.random() * 12 + 6),
        size: Math.random() * 8 + 3,
        color: ['#ffd700','#ff6b9d','#c77dff','#48cae4','#ff9f1c','#ffffff'][Math.floor(Math.random() * 6)],
        life: 1,
        decay: Math.random() * 0.015 + 0.008,
        spin: (Math.random() - 0.5) * 0.3,
        angle: Math.random() * Math.PI * 2
      }));
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particlesRef.current = particlesRef.current.filter(p => p.life > 0);
      particlesRef.current.forEach(p => {
        p.x += p.vx; p.y += p.vy; p.vy += 0.2;
        p.life -= p.decay; p.angle += p.spin;
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.5);
        ctx.restore();
      });
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [active]);

  return <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 40 }} />;
};

// ─── SCANLINES / TV OVERLAY ───────────────────────────────────────────────────

const TVOverlay = () => (
  <div style={{
    position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 5,
    background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.04) 2px, rgba(0,0,0,0.04) 4px)',
    mixBlendMode: 'overlay'
  }} />
);

// ─── SPOTLIGHT BEAM ───────────────────────────────────────────────────────────

const Spotlight = ({ active }) => (
  <div style={{
    position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
    width: '80vw', height: '100vh',
    background: 'radial-gradient(ellipse 50% 80% at 50% 0%, rgba(255,220,100,0.18) 0%, rgba(255,180,50,0.08) 40%, transparent 70%)',
    opacity: active ? 1 : 0,
    transition: 'opacity 1.2s ease',
    pointerEvents: 'none', zIndex: 3
  }} />
);

// ─── DRUM ROLL BAR ────────────────────────────────────────────────────────────

const DrumRollBar = ({ active }) => {
  const [bars, setBars] = useState(Array(32).fill(0));
  const intervalRef = useRef(null);

  useEffect(() => {
    if (active) {
      intervalRef.current = setInterval(() => {
        setBars(Array(32).fill(0).map(() => Math.random()));
      }, 80);
    } else {
      clearInterval(intervalRef.current);
      setBars(Array(32).fill(0));
    }
    return () => clearInterval(intervalRef.current);
  }, [active]);

  return (
    <div style={{
      display: 'flex', gap: '3px', alignItems: 'flex-end',
      height: 'clamp(30px, 5vh, 60px)', padding: '0 clamp(8px, 2vw, 24px)',
      opacity: active ? 1 : 0, transition: 'opacity 0.3s'
    }}>
      {bars.map((h, i) => (
        <div key={i} style={{
          flex: 1, borderRadius: '2px 2px 0 0',
          background: `hsl(${280 + i * 4}, 80%, ${50 + h * 30}%)`,
          height: `${15 + h * 85}%`,
          transition: 'height 0.07s ease',
          boxShadow: `0 0 ${h * 10}px hsl(${280 + i * 4}, 80%, 70%)`
        }} />
      ))}
    </div>
  );
};

// ─── NAME SCRAMBLE ────────────────────────────────────────────────────────────

const ScrambleText = ({ finalText, running, onDone }) => {
  const [display, setDisplay] = useState('');
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#@!?';
  const intervalRef = useRef(null);
  const countRef = useRef(0);

  useEffect(() => {
    if (!running || !finalText) return;
    countRef.current = 0;
    const total = 25;
    intervalRef.current = setInterval(() => {
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
        clearInterval(intervalRef.current);
        setDisplay(finalText);
        if (onDone) onDone();
      }
    }, 60);
    return () => clearInterval(intervalRef.current);
  }, [running, finalText]);

  return <span>{display || finalText}</span>;
};

// ─── PHASE: COUNTDOWN ────────────────────────────────────────────────────────

const PhaseCountdown = ({ onDone }) => {
  const [n, setN] = useState(3);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (n === 0) { setTimeout(onDone, 400); return; }
    playDrum();
    setFlash(true);
    const t1 = setTimeout(() => setFlash(false), 200);
    const t2 = setTimeout(() => setN(p => p - 1), 900);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [n]);

  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 'clamp(12px,3vh,32px)'
    }}>
      <div style={{
        fontSize: 'clamp(0.9rem,2vw,1.6rem)', fontWeight: 800, letterSpacing: '0.5em',
        color: 'rgba(255,220,80,0.9)', textTransform: 'uppercase',
        textShadow: '0 0 20px rgba(255,220,80,0.6)',
        animation: 'tv-flicker 4s ease-in-out infinite'
      }}>
        ★ Estrazione Casuale ★
      </div>
      {n > 0 && (
        <div style={{
          fontSize: 'clamp(10rem, 35vw, 32rem)',
          fontWeight: 900, lineHeight: 1,
          color: flash ? '#fff' : 'transparent',
          WebkitTextStroke: `clamp(2px,0.4vw,5px) ${flash ? '#fff' : 'rgba(255,220,80,0.8)'}`,
          textShadow: flash
            ? '0 0 80px #fff, 0 0 160px rgba(255,220,80,0.8)'
            : '0 0 40px rgba(255,220,80,0.4)',
          transition: 'color 0.1s, text-shadow 0.2s',
          fontFamily: 'Impact, "Arial Black", sans-serif',
          transform: flash ? 'scale(1.08)' : 'scale(1)',
          transitionProperty: 'transform, color, text-shadow',
          transitionDuration: '0.15s'
        }}>
          {n}
        </div>
      )}
    </div>
  );
};

// ─── PHASE: DRUM ROLL ─────────────────────────────────────────────────────────

const PhaseDrumRoll = ({ onDone, label }) => {
  const [intensity, setIntensity] = useState(0);
  const timerRef = useRef(null);
  const drumRef = useRef(null);

  useEffect(() => {
    let i = 0;
    const totalSteps = 20;
    const step = () => {
      i++;
      const t = i / totalSteps;
      setIntensity(t);
      playRoll(0.3 + t * 0.7);
      const delay = Math.max(40, 200 - t * 160);
      if (i < totalSteps) timerRef.current = setTimeout(step, delay);
      else {
        setTimeout(() => { playStinger(); onDone(); }, 200);
      }
    };
    timerRef.current = setTimeout(step, 300);
    return () => clearTimeout(timerRef.current);
  }, []);

  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 'clamp(16px,4vh,40px)'
    }}>
      <div style={{
        fontSize: 'clamp(1rem,2.5vw,2.2rem)', fontWeight: 900, letterSpacing: '0.4em',
        color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase'
      }}>
        {label}
      </div>
      {/* Big pulsing ring */}
      <div style={{
        width: 'clamp(120px,30vw,280px)', height: 'clamp(120px,30vw,280px)',
        borderRadius: '50%', position: 'relative',
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        {[0, 1, 2].map(ring => (
          <div key={ring} style={{
            position: 'absolute', inset: `${ring * -20}%`,
            borderRadius: '50%',
            border: `clamp(2px,0.3vw,4px) solid rgba(255,220,80,${0.6 - ring * 0.18})`,
            boxShadow: `0 0 ${20 + ring * 20}px rgba(255,220,80,${0.4 - ring * 0.1})`,
            animation: `ring-pulse ${0.6 + ring * 0.15}s ease-in-out infinite alternate`
          }} />
        ))}
        <div style={{
          width: '100%', height: '100%', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,220,80,0.15) 0%, transparent 70%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: 'ring-pulse 0.4s ease-in-out infinite alternate'
        }}>
          <div style={{
            fontSize: 'clamp(2rem,8vw,7rem)',
            animation: 'spin-slow 2s linear infinite'
          }}>🎰</div>
        </div>
      </div>
      <DrumRollBar active={true} />
    </div>
  );
};

// ─── PHASE: REVEAL ────────────────────────────────────────────────────────────

const PhaseReveal = ({ item, type, onDone }) => {
  const [stage, setStage] = useState(0); // 0=flash 1=spotlight 2=scramble 3=done
  const isParticipant = type === 'participant';

  useEffect(() => {
    const t0 = setTimeout(() => setStage(1), 300);
    const t1 = setTimeout(() => setStage(2), 900);
    return () => { clearTimeout(t0); clearTimeout(t1); };
  }, []);

  const handleScrambleDone = () => {
    playRevealFanfare();
    setStage(3);
    setTimeout(onDone, 2800);
  };

  const accentColor = isParticipant ? '#ffd700' : '#c77dff';
  const name = item?.nickname || item?.title || '???';
  const sub = item?.artist || null;

  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 0,
      overflow: 'hidden'
    }}>
      {/* Flash frame */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'white',
        opacity: stage === 0 ? 1 : 0,
        transition: 'opacity 0.4s ease',
        pointerEvents: 'none', zIndex: 20
      }} />

      <Spotlight active={stage >= 1} />
      {stage >= 3 && <Particles active={true} />}

      {/* Label */}
      <div style={{
        fontSize: 'clamp(0.7rem,1.5vw,1.2rem)', fontWeight: 900,
        letterSpacing: '0.5em', textTransform: 'uppercase',
        color: accentColor, opacity: stage >= 1 ? 1 : 0,
        transition: 'opacity 0.6s ease 0.3s',
        marginBottom: 'clamp(8px,2vh,24px)',
        textShadow: `0 0 20px ${accentColor}`
      }}>
        {isParticipant ? '— Il Cantante —' : '— La Canzone —'}
      </div>

      {/* Avatar / icon */}
      <div style={{
        opacity: stage >= 1 ? 1 : 0,
        transform: stage >= 1 ? 'scale(1) translateY(0)' : 'scale(0.5) translateY(40px)',
        transition: 'all 0.7s cubic-bezier(0.34,1.4,0.64,1) 0.2s',
        marginBottom: 'clamp(12px,2.5vh,28px)'
      }}>
        {item?.avatar_url ? (
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <div style={{
              position: 'absolute', inset: '-8px', borderRadius: '50%',
              background: `conic-gradient(${accentColor}, transparent, ${accentColor})`,
              animation: 'spin-slow 3s linear infinite'
            }} />
            <img src={item.avatar_url} alt={name} style={{
              width: 'clamp(80px,14vw,160px)', height: 'clamp(80px,14vw,160px)',
              borderRadius: '50%', objectFit: 'cover', position: 'relative',
              border: `clamp(3px,0.4vw,6px) solid ${accentColor}`,
              boxShadow: `0 0 60px ${accentColor}80, 0 0 120px ${accentColor}30`,
              display: 'block'
            }} />
          </div>
        ) : (
          <div style={{
            width: 'clamp(80px,14vw,160px)', height: 'clamp(80px,14vw,160px)',
            borderRadius: isParticipant ? '50%' : 'clamp(16px,2vw,28px)',
            background: isParticipant
              ? `radial-gradient(circle, rgba(255,220,80,0.3), rgba(0,0,0,0.8))`
              : `radial-gradient(circle, rgba(199,125,255,0.3), rgba(0,0,0,0.8))`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: `clamp(3px,0.4vw,6px) solid ${accentColor}`,
            boxShadow: `0 0 60px ${accentColor}60`,
            fontSize: isParticipant ? 'clamp(2.5rem,6vw,5rem)' : undefined
          }}>
            {isParticipant
              ? <span style={{ fontWeight: 900, color: accentColor }}>{name.charAt(0).toUpperCase()}</span>
              : <Music2 style={{ width: '50%', height: '50%', color: accentColor }} />
            }
          </div>
        )}
      </div>

      {/* Big name — scramble effect */}
      <div style={{
        fontSize: 'clamp(2.5rem,7vw,7rem)', fontWeight: 900,
        color: '#ffffff', textAlign: 'center',
        fontFamily: 'Impact, "Arial Black", sans-serif',
        letterSpacing: '0.05em', lineHeight: 1,
        textShadow: stage >= 3
          ? `0 0 40px ${accentColor}, 0 0 80px ${accentColor}60`
          : `0 0 20px rgba(255,255,255,0.3)`,
        transition: 'text-shadow 0.5s ease',
        maxWidth: '88vw', wordBreak: 'break-word',
        opacity: stage >= 2 ? 1 : 0,
        transform: stage >= 2 ? 'none' : 'translateY(20px)',
        transitionProperty: 'opacity, transform, text-shadow',
        transitionDuration: '0.5s'
      }}>
        <ScrambleText finalText={name.toUpperCase()} running={stage >= 2} onDone={handleScrambleDone} />
      </div>

      {/* Sub (artist) */}
      {sub && (
        <div style={{
          fontSize: 'clamp(1rem,2.5vw,2.2rem)', fontWeight: 600,
          color: accentColor, marginTop: 'clamp(6px,1.2vh,14px)',
          opacity: stage >= 3 ? 1 : 0, transition: 'opacity 0.5s ease 0.3s',
          letterSpacing: '0.1em'
        }}>
          {sub}
        </div>
      )}

      {/* Bottom accent bar */}
      {stage >= 3 && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 'clamp(4px,0.6vh,8px)',
          background: `linear-gradient(to right, transparent, ${accentColor}, transparent)`,
          animation: 'bar-expand 0.6s cubic-bezier(0.34,1.4,0.64,1) forwards',
          boxShadow: `0 0 20px ${accentColor}`
        }} />
      )}
    </div>
  );
};

// ─── PHASE: TRANSITION ────────────────────────────────────────────────────────

const PhaseTransition = ({ participant, onDone }) => {
  useEffect(() => {
    playDrum();
    setTimeout(onDone, 1200);
  }, []);

  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 'clamp(8px,2vh,20px)'
    }}>
      <div style={{
        fontSize: 'clamp(0.8rem,1.8vw,1.4rem)', fontWeight: 900, letterSpacing: '0.4em',
        color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase'
      }}>
        {participant?.nickname || ''}
      </div>
      <div style={{
        fontSize: 'clamp(1.4rem,3.5vw,3rem)', fontWeight: 900,
        color: 'rgba(255,255,255,0.7)', letterSpacing: '0.2em',
        textTransform: 'uppercase', animation: 'tv-flicker 0.3s ease-in-out infinite'
      }}>
        canterà...
      </div>
      <div style={{
        width: 'clamp(40px,8vw,80px)', height: 'clamp(3px,0.4vh,5px)',
        background: 'linear-gradient(to right, transparent, #c77dff, transparent)',
        animation: 'bar-expand 0.8s ease forwards',
        boxShadow: '0 0 20px #c77dff'
      }} />
    </div>
  );
};

// ─── PHASE: CELEBRATION ──────────────────────────────────────────────────────

const PhaseCelebration = ({ participant, song, onDone }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setTimeout(() => setVisible(true), 100);
    setTimeout(onDone, 4000);
  }, []);

  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 'clamp(8px,2.5vh,28px)',
      overflow: 'hidden'
    }}>
      <Spotlight active={true} />
      <Particles active={true} />

      <div style={{
        opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(30px)',
        transition: 'all 0.8s cubic-bezier(0.34,1.2,0.64,1)',
        textAlign: 'center'
      }}>
        {/* NOME CANTANTE — grande */}
        <div style={{
          fontSize: 'clamp(3rem,8vw,8rem)', fontWeight: 900, lineHeight: 1,
          fontFamily: 'Impact, "Arial Black", sans-serif',
          color: '#ffd700',
          textShadow: '0 0 60px rgba(255,215,0,0.8), 0 0 120px rgba(255,215,0,0.4)',
          letterSpacing: '0.04em', marginBottom: 'clamp(4px,1vh,12px)'
        }}>
          {(participant?.nickname || '').toUpperCase()}
        </div>

        {/* Mic icon */}
        <div style={{ fontSize: 'clamp(1.5rem,4vw,3.5rem)', marginBottom: 'clamp(4px,1vh,12px)', lineHeight: 1 }}>🎤</div>

        {/* Divider */}
        <div style={{
          width: 'clamp(80px,20vw,240px)', height: 'clamp(2px,0.3vh,4px)', margin: '0 auto clamp(8px,1.5vh,18px)',
          background: 'linear-gradient(to right, transparent, #c77dff, transparent)',
          boxShadow: '0 0 20px #c77dff'
        }} />

        {/* TITOLO CANZONE */}
        <div style={{
          fontSize: 'clamp(1.4rem,3.5vw,3.5rem)', fontWeight: 700,
          color: 'rgba(255,255,255,0.9)', letterSpacing: '0.06em',
          marginBottom: sub => sub ? 'clamp(2px,0.5vh,8px)' : 0
        }}>
          {(song?.title || '').toUpperCase()}
        </div>
        {song?.artist && (
          <div style={{
            fontSize: 'clamp(0.9rem,2vw,1.8rem)', fontWeight: 500,
            color: '#c77dff', letterSpacing: '0.1em'
          }}>
            {song.artist}
          </div>
        )}

        {/* TAG "PREPARATI" */}
        <div style={{
          display: 'inline-block', marginTop: 'clamp(12px,2.5vh,28px)',
          padding: 'clamp(6px,1.2vh,12px) clamp(16px,3vw,36px)',
          background: 'linear-gradient(135deg, rgba(255,215,0,0.2), rgba(199,125,255,0.2))',
          border: '2px solid rgba(255,215,0,0.5)',
          borderRadius: '4px',
          fontSize: 'clamp(0.75rem,1.5vw,1.2rem)', fontWeight: 900,
          letterSpacing: '0.3em', textTransform: 'uppercase',
          color: '#ffd700',
          boxShadow: '0 0 30px rgba(255,215,0,0.2)',
          animation: 'pulse-gold 1.5s ease-in-out infinite'
        }}>
          Preparati a Cantare
        </div>
      </div>
    </div>
  );
};

// ─── BACKGROUND ───────────────────────────────────────────────────────────────

const Background = ({ phase }) => {
  const isHot = ['reveal-participant','celebration'].includes(phase);
  const isCool = ['transition','drumroll-song','reveal-song'].includes(phase);

  return (
    <>
      {/* Deep base */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at 50% 100%, #0d001a 0%, #000 60%)',
        zIndex: 0
      }} />
      {/* Warm glow */}
      <div style={{
        position: 'absolute', bottom: '-20%', left: '50%', transform: 'translateX(-50%)',
        width: '80vw', height: '60vh',
        background: isHot
          ? 'radial-gradient(ellipse, rgba(255,180,30,0.18) 0%, transparent 70%)'
          : isCool
          ? 'radial-gradient(ellipse, rgba(140,60,255,0.18) 0%, transparent 70%)'
          : 'radial-gradient(ellipse, rgba(80,0,120,0.12) 0%, transparent 70%)',
        filter: 'blur(40px)',
        transition: 'background 1.5s ease',
        zIndex: 1
      }} />
      {/* Stage edge lights */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: '3px',
        background: isHot
          ? 'linear-gradient(to right, transparent, rgba(255,215,0,0.8), transparent)'
          : 'linear-gradient(to right, transparent, rgba(140,60,255,0.8), transparent)',
        boxShadow: isHot ? '0 0 30px rgba(255,215,0,0.6)' : '0 0 30px rgba(140,60,255,0.6)',
        transition: 'all 1s ease', zIndex: 6
      }} />
      {/* Left/right curtain vignette */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none',
        background: 'linear-gradient(to right, rgba(0,0,0,0.7) 0%, transparent 15%, transparent 85%, rgba(0,0,0,0.7) 100%)'
      }} />
      {/* Top vignette */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none',
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.8) 0%, transparent 20%, transparent 80%, rgba(0,0,0,0.5) 100%)'
      }} />
    </>
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
      fontFamily: '"Montserrat", "Arial Black", sans-serif'
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;800;900&display=swap');
        @keyframes ring-pulse {
          from { transform: scale(0.96); opacity: 0.7; }
          to   { transform: scale(1.04); opacity: 1; }
        }
        @keyframes spin-slow {
          to { transform: rotate(360deg); }
        }
        @keyframes tv-flicker {
          0%,100% { opacity:1; } 92% { opacity:1; } 93% { opacity:0.7; } 94% { opacity:1; }
        }
        @keyframes bar-expand {
          from { transform: scaleX(0); opacity:0; }
          to   { transform: scaleX(1); opacity:1; }
        }
        @keyframes pulse-gold {
          0%,100% { box-shadow: 0 0 20px rgba(255,215,0,0.2); }
          50%      { box-shadow: 0 0 50px rgba(255,215,0,0.5); }
        }
      `}</style>

      <Background phase={phase} />
      <TVOverlay />

      {/* ── PHASES ── */}
      {phase === 'countdown' && (
        <PhaseCountdown onDone={() => setPhase('drumroll-participant')} />
      )}

      {phase === 'drumroll-participant' && (
        <PhaseDrumRoll label="Chi canta?" onDone={() => setPhase('reveal-participant')} />
      )}

      {phase === 'reveal-participant' && (
        <PhaseReveal
          item={participant}
          type="participant"
          onDone={() => setPhase('transition')}
        />
      )}

      {phase === 'transition' && (
        <PhaseTransition
          participant={participant}
          onDone={() => setPhase('drumroll-song')}
        />
      )}

      {phase === 'drumroll-song' && (
        <PhaseDrumRoll label="La Canzone" onDone={() => setPhase('reveal-song')} />
      )}

      {phase === 'reveal-song' && (
        <PhaseReveal
          item={song}
          type="song"
          onDone={() => setPhase('celebration')}
        />
      )}

      {phase === 'celebration' && (
        <PhaseCelebration
          participant={participant}
          song={song}
          onDone={() => { if (onComplete) onComplete(); }}
        />
      )}
    </div>
  );
}