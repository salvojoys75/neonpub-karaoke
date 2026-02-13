import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Sparkles, Music2, Trophy, Mic2 } from 'lucide-react';

// ─── AUDIO ───────────────────────────────────────────────────────────────────

const ctx = () => new (window.AudioContext || window.webkitAudioContext)();

const playTick = () => {
  try {
    const a = ctx(); const o = a.createOscillator(); const g = a.createGain();
    o.connect(g); g.connect(a.destination);
    o.frequency.value = 600 + Math.random() * 400; o.type = 'sine';
    g.gain.setValueAtTime(0.15, a.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + 0.04);
    o.start(a.currentTime); o.stop(a.currentTime + 0.04);
  } catch {}
};

const playReveal = () => {
  try {
    const a = ctx();
    [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
      const o = a.createOscillator(); const g = a.createGain();
      o.connect(g); g.connect(a.destination);
      o.frequency.value = freq; o.type = 'sine';
      const t = a.currentTime + i * 0.12;
      g.gain.setValueAtTime(0.3, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      o.start(t); o.stop(t + 0.4);
    });
  } catch {}
};

// ─── CONFETTI ─────────────────────────────────────────────────────────────────

const Confetti = () => {
  const pieces = useMemo(() => Array.from({ length: 60 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 2.5,
    duration: 3 + Math.random() * 3,
    size: 8 + Math.random() * 10,
    color: ['#d946ef','#a855f7','#ec4899','#f59e0b','#10b981','#3b82f6'][Math.floor(Math.random() * 6)]
  })), []);
  return (
    <div style={{ position:'absolute', inset:0, pointerEvents:'none', overflow:'hidden', zIndex:50 }}>
      {pieces.map(p => (
        <div key={p.id} style={{
          position:'absolute', left:`${p.left}%`, top:'-20px',
          width:p.size, height:p.size, borderRadius:'2px',
          backgroundColor:p.color,
          animation:`confetti-fall ${p.duration}s ${p.delay}s linear forwards`
        }}/>
      ))}
    </div>
  );
};

// ─── WHEEL ────────────────────────────────────────────────────────────────────

const Wheel = ({ items, isSpinning, finalIndex, onStop }) => {
  const canvasRef = useRef(null);
  const angleRef = useRef(0);
  const velRef = useRef(0);
  const rafRef = useRef(null);
  const stoppedRef = useRef(false);
  const tickAccRef = useRef(0);
  const prevAngleRef = useRef(0);

  const colors = [
    '#7c3aed','#c026d3','#db2777','#0891b2',
    '#059669','#d97706','#dc2626','#4f46e5',
    '#0d9488','#9333ea','#e11d48','#2563eb'
  ];

  const draw = (angle) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx2 = canvas.getContext('2d');
    const W = canvas.width; const H = canvas.height;
    const cx = W / 2; const cy = H / 2;
    const R = Math.min(cx, cy) - 4;
    const n = items.length;
    if (n === 0) return;
    const slice = (Math.PI * 2) / n;

    ctx2.clearRect(0, 0, W, H);

    // Ombre esterne
    ctx2.save();
    ctx2.shadowColor = 'rgba(217,70,239,0.6)';
    ctx2.shadowBlur = 40;
    ctx2.beginPath();
    ctx2.arc(cx, cy, R, 0, Math.PI * 2);
    ctx2.fillStyle = '#1a0030';
    ctx2.fill();
    ctx2.restore();

    // Fette
    items.forEach((item, i) => {
      const startAngle = angle + i * slice;
      const endAngle = startAngle + slice;
      const color = colors[i % colors.length];

      ctx2.beginPath();
      ctx2.moveTo(cx, cy);
      ctx2.arc(cx, cy, R, startAngle, endAngle);
      ctx2.closePath();
      ctx2.fillStyle = color;
      ctx2.fill();
      ctx2.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx2.lineWidth = 2;
      ctx2.stroke();

      // Testo
      ctx2.save();
      ctx2.translate(cx, cy);
      ctx2.rotate(startAngle + slice / 2);
      ctx2.textAlign = 'right';
      ctx2.fillStyle = 'white';
      const label = item.nickname || item.title || '?';
      const maxLen = 14;
      const text = label.length > maxLen ? label.substring(0, maxLen) + '\u2026' : label;
      const fontSize = Math.max(10, Math.min(18, R * 0.09));
      ctx2.font = `900 ${fontSize}px Montserrat, sans-serif`;
      ctx2.shadowColor = 'rgba(0,0,0,0.8)';
      ctx2.shadowBlur = 4;
      ctx2.fillText(text, R - 14, fontSize * 0.4);
      ctx2.restore();
    });

    // Cerchio centrale
    ctx2.beginPath();
    ctx2.arc(cx, cy, R * 0.12, 0, Math.PI * 2);
    const grad = ctx2.createRadialGradient(cx, cy, 0, cx, cy, R * 0.12);
    grad.addColorStop(0, '#f0abfc');
    grad.addColorStop(1, '#7c3aed');
    ctx2.fillStyle = grad;
    ctx2.shadowColor = 'rgba(217,70,239,0.8)';
    ctx2.shadowBlur = 20;
    ctx2.fill();
    ctx2.strokeStyle = 'white';
    ctx2.lineWidth = 3;
    ctx2.stroke();

    // Bordo esterno
    ctx2.beginPath();
    ctx2.arc(cx, cy, R, 0, Math.PI * 2);
    ctx2.strokeStyle = 'rgba(217,70,239,0.7)';
    ctx2.lineWidth = 5;
    ctx2.shadowColor = 'rgba(217,70,239,0.9)';
    ctx2.shadowBlur = 20;
    ctx2.stroke();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement;
      const size = Math.min(parent.clientWidth, parent.clientHeight) * 0.95;
      canvas.width = size;
      canvas.height = size;
      draw(angleRef.current);
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [items]);

  useEffect(() => {
    if (items.length === 0) return;
    const n = items.length;
    const slice = (Math.PI * 2) / n;

    if (isSpinning) {
      stoppedRef.current = false;
      velRef.current = 0.22 + Math.random() * 0.12;
      tickAccRef.current = 0;
      prevAngleRef.current = angleRef.current;

      const animate = () => {
        angleRef.current += velRef.current;
        const delta = Math.abs(angleRef.current - prevAngleRef.current);
        tickAccRef.current += delta;
        if (tickAccRef.current >= slice) {
          playTick();
          tickAccRef.current = 0;
        }
        prevAngleRef.current = angleRef.current;
        draw(angleRef.current);
        rafRef.current = requestAnimationFrame(animate);
      };
      rafRef.current = requestAnimationFrame(animate);
      return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };

    } else {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (stoppedRef.current) return;

      // Calcola angolo target: la fetta finalIndex punta verso il puntatore (top = -π/2)
      const targetAngle = -Math.PI / 2 - (finalIndex * slice + slice / 2);
      const fullSpins = Math.PI * 2 * (4 + Math.floor(Math.random() * 3));
      const currentNorm = ((angleRef.current % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      const targetNorm = ((targetAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      let delta = targetNorm - currentNorm;
      if (delta <= 0) delta += Math.PI * 2;
      const totalDelta = fullSpins + delta;
      const duration = 2400;
      const start = performance.now();
      const startAngle = angleRef.current;
      tickAccRef.current = 0;
      prevAngleRef.current = startAngle;

      const decelerate = (now) => {
        const elapsed = Math.min(now - start, duration);
        const progress = elapsed / duration;
        const eased = 1 - Math.pow(1 - progress, 3);
        angleRef.current = startAngle + totalDelta * eased;

        const d = Math.abs(angleRef.current - prevAngleRef.current);
        tickAccRef.current += d;
        if (tickAccRef.current >= slice * 0.7) { playTick(); tickAccRef.current = 0; }
        prevAngleRef.current = angleRef.current;

        draw(angleRef.current);

        if (progress < 1) {
          rafRef.current = requestAnimationFrame(decelerate);
        } else {
          stoppedRef.current = true;
          angleRef.current = startAngle + totalDelta;
          draw(angleRef.current);
          if (onStop) onStop();
        }
      };
      rafRef.current = requestAnimationFrame(decelerate);
      return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    }
  }, [isSpinning, finalIndex, items]);

  return (
    <div style={{ position:'relative', width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <canvas ref={canvasRef} style={{ display:'block', maxWidth:'100%', maxHeight:'100%', borderRadius:'50%' }} />
      {/* Puntatore */}
      <div style={{
        position:'absolute', top:'2%', left:'50%',
        transform:'translateX(-50%)',
        width:0, height:0,
        borderLeft:'clamp(10px,1.8vw,22px) solid transparent',
        borderRight:'clamp(10px,1.8vw,22px) solid transparent',
        borderTop:'clamp(22px,3.5vh,46px) solid #facc15',
        filter:'drop-shadow(0 0 10px rgba(250,204,21,0.9))',
        zIndex:10
      }}/>
    </div>
  );
};

// ─── REVEAL CARD ──────────────────────────────────────────────────────────────

const RevealCard = ({ item, icon, label, color }) => (
  <div style={{
    display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
    gap:'clamp(8px,2vh,20px)', animation:'reveal-pop 0.7s cubic-bezier(0.34,1.56,0.64,1) forwards'
  }}>
    <div style={{
      fontSize:'clamp(0.75rem,1.6vw,1.3rem)', fontWeight:900, textTransform:'uppercase',
      letterSpacing:'0.25em', color:'rgba(255,255,255,0.5)', display:'flex', alignItems:'center', gap:'8px'
    }}>
      {icon} {label}
    </div>
    {item.avatar_url ? (
      <img src={item.avatar_url} alt={item.nickname}
        style={{ width:'clamp(80px,13vw,150px)', height:'clamp(80px,13vw,150px)',
          borderRadius:'50%', border:`clamp(3px,0.4vw,6px) solid ${color}`,
          boxShadow:`0 0 40px ${color}80`, objectFit:'cover' }}
      />
    ) : item.title ? (
      <div style={{ width:'clamp(80px,13vw,150px)', height:'clamp(80px,13vw,150px)',
        borderRadius:'clamp(12px,2vw,24px)', background:'linear-gradient(135deg,#c026d3,#7c3aed)',
        display:'flex', alignItems:'center', justifyContent:'center',
        border:`clamp(3px,0.4vw,6px) solid ${color}`, boxShadow:`0 0 40px ${color}80` }}>
        <Music2 style={{ width:'50%', height:'50%', color:'white' }}/>
      </div>
    ) : (
      <div style={{ width:'clamp(80px,13vw,150px)', height:'clamp(80px,13vw,150px)',
        borderRadius:'50%', background:'linear-gradient(135deg,#c026d3,#7c3aed)',
        display:'flex', alignItems:'center', justifyContent:'center',
        border:`clamp(3px,0.4vw,6px) solid ${color}`, boxShadow:`0 0 40px ${color}80`,
        fontSize:'clamp(2rem,5vw,4.5rem)', fontWeight:900, color:'white' }}>
        {(item.nickname||'?').charAt(0).toUpperCase()}
      </div>
    )}
    <div style={{
      fontSize:'clamp(1.6rem,4.5vw,4.5rem)', fontWeight:900, color:'white',
      textShadow:`0 0 30px ${color}`, lineHeight:1.1, textAlign:'center',
      maxWidth:'80vw', wordBreak:'break-word'
    }}>
      {item.nickname || item.title || '???'}
    </div>
    {item.artist && (
      <div style={{ fontSize:'clamp(0.9rem,2.2vw,2rem)', fontWeight:700, color, textAlign:'center' }}>
        {item.artist}
      </div>
    )}
  </div>
);

// ─── MAIN ─────────────────────────────────────────────────────────────────────

export default function ExtractionMode({ extractionData, participants, songs, onComplete }) {
  const [phase, setPhase] = useState('participant-spin');
  const [participantSpinning, setParticipantSpinning] = useState(true);
  const [songSpinning, setSongSpinning] = useState(false);

  const participant = extractionData?.participant;
  const song = extractionData?.song;

  const participantIndex = useMemo(() => {
    if (!participants || !participant) return 0;
    const i = participants.findIndex(p => p.id === participant.id || p.nickname === participant.nickname);
    return i !== -1 ? i : 0;
  }, [participants, participant]);

  const songIndex = useMemo(() => {
    if (!songs || !song) return 0;
    const i = songs.findIndex(s => s.id === song.id || s.title === song.title);
    return i !== -1 ? i : 0;
  }, [songs, song]);

  // Stop ruota partecipante dopo 3.5s
  useEffect(() => {
    if (phase !== 'participant-spin') return;
    const t = setTimeout(() => setParticipantSpinning(false), 3500);
    return () => clearTimeout(t);
  }, [phase]);

  const handleParticipantStopped = () => {
    playReveal();
    setPhase('participant-reveal');
    setTimeout(() => setPhase('transition'), 2500);
  };

  useEffect(() => {
    if (phase !== 'transition') return;
    const t = setTimeout(() => {
      setPhase('song-spin');
      setSongSpinning(true);
      setTimeout(() => setSongSpinning(false), 3500);
    }, 900);
    return () => clearTimeout(t);
  }, [phase]);

  const handleSongStopped = () => {
    playReveal();
    setPhase('song-reveal');
    setTimeout(() => setPhase('celebration'), 2500);
  };

  useEffect(() => {
    if (phase !== 'celebration') return;
    const t = setTimeout(() => { if (onComplete) onComplete(); }, 3500);
    return () => clearTimeout(t);
  }, [phase, onComplete]);

  const isSongPhase = ['song-spin','song-reveal','celebration'].includes(phase);
  const isTransition = phase === 'transition';

  return (
    <div style={{
      position:'absolute', inset:0, display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'center', overflow:'hidden',
      background:'radial-gradient(ellipse at center, #1a0030 0%, #080010 60%, #000 100%)'
    }}>
      <style>{`
        @keyframes confetti-fall {
          0%   { transform: translateY(0) rotate(0deg); opacity:1; }
          100% { transform: translateY(105vh) rotate(720deg); opacity:0; }
        }
        @keyframes reveal-pop {
          0%   { transform: scale(0.3) rotate(-10deg); opacity:0; }
          60%  { transform: scale(1.08) rotate(2deg); }
          100% { transform: scale(1) rotate(0deg); opacity:1; }
        }
        @keyframes slide-in-right {
          from { transform: translateX(110%); opacity:0; }
          to   { transform: translateX(0);    opacity:1; }
        }
        @keyframes fade-pulse {
          0%,100% { opacity:0.6; }
          50%      { opacity:1; }
        }
        @keyframes spin-ring {
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* BG glow */}
      <div style={{
        position:'absolute', top:'50%', left:'50%',
        transform:'translate(-50%,-50%)',
        width:'70vw', height:'70vw', maxWidth:800, maxHeight:800,
        background:'rgba(124,58,237,0.15)', borderRadius:'50%',
        filter:'blur(100px)', pointerEvents:'none',
        animation:'fade-pulse 3s ease-in-out infinite'
      }}/>

      {phase === 'celebration' && <Confetti />}

      {/* ── SCHERMATA PARTECIPANTE ── */}
      {!isSongPhase && !isTransition && (
        <div style={{
          position:'absolute', inset:0, display:'flex', flexDirection:'column',
          alignItems:'center', justifyContent:'center',
          padding:'clamp(12px,2vh,28px) clamp(16px,3vw,40px)', gap:'clamp(8px,2vh,20px)'
        }}>
          <div style={{
            display:'flex', alignItems:'center', gap:'clamp(6px,1.2vw,14px)',
            padding:'clamp(6px,1vh,12px) clamp(14px,2.2vw,28px)',
            background:'rgba(217,70,239,0.15)', backdropFilter:'blur(20px)',
            borderRadius:9999, border:'2px solid rgba(217,70,239,0.6)', flexShrink:0
          }}>
            <Trophy style={{ width:'clamp(16px,2.2vw,28px)', height:'clamp(16px,2.2vw,28px)', color:'#facc15' }}/>
            <span style={{ fontSize:'clamp(0.8rem,1.8vw,1.5rem)', fontWeight:900, color:'white', textTransform:'uppercase', letterSpacing:'0.25em' }}>
              Chi canta?
            </span>
            <Trophy style={{ width:'clamp(16px,2.2vw,28px)', height:'clamp(16px,2.2vw,28px)', color:'#facc15' }}/>
          </div>

          {phase === 'participant-spin' && (
            <div style={{ width:'min(62vw,62vh)', height:'min(62vw,62vh)', flexShrink:0 }}>
              <Wheel
                items={participants || []}
                isSpinning={participantSpinning}
                finalIndex={participantIndex}
                onStop={handleParticipantStopped}
              />
            </div>
          )}

          {phase === 'participant-reveal' && participant && (
            <RevealCard item={participant} label="Il Cantante" icon={<Mic2 style={{width:'1em',height:'1em'}}/>} color="#d946ef" />
          )}
        </div>
      )}

      {/* ── TRANSIZIONE ── */}
      {isTransition && (
        <div style={{
          position:'absolute', inset:0, display:'flex', alignItems:'center',
          justifyContent:'center', flexDirection:'column', gap:'clamp(10px,2.5vh,24px)'
        }}>
          <div style={{
            width:'clamp(36px,6vw,72px)', height:'clamp(36px,6vw,72px)',
            border:'clamp(3px,0.4vw,6px) solid rgba(217,70,239,0.3)',
            borderTop:'clamp(3px,0.4vw,6px) solid #d946ef',
            borderRadius:'50%', animation:'spin-ring 0.7s linear infinite'
          }}/>
          <div style={{
            fontSize:'clamp(0.9rem,2.2vw,1.8rem)', fontWeight:900,
            color:'rgba(255,255,255,0.6)', textTransform:'uppercase',
            letterSpacing:'0.3em', animation:'fade-pulse 0.8s ease-in-out infinite'
          }}>
            E la canzone è...
          </div>
        </div>
      )}

      {/* ── SCHERMATA CANZONE ── */}
      {isSongPhase && (
        <div style={{
          position:'absolute', inset:0, display:'flex', flexDirection:'column',
          alignItems:'center', justifyContent:'center',
          padding:'clamp(12px,2vh,28px) clamp(16px,3vw,40px)', gap:'clamp(8px,2vh,20px)',
          animation:'slide-in-right 0.5s cubic-bezier(0.34,1.2,0.64,1) forwards'
        }}>
          <div style={{
            display:'flex', alignItems:'center', gap:'clamp(6px,1.2vw,14px)',
            padding:'clamp(6px,1vh,12px) clamp(14px,2.2vw,28px)',
            background:'rgba(168,85,247,0.15)', backdropFilter:'blur(20px)',
            borderRadius:9999, border:'2px solid rgba(168,85,247,0.6)', flexShrink:0
          }}>
            <Music2 style={{ width:'clamp(16px,2.2vw,28px)', height:'clamp(16px,2.2vw,28px)', color:'#e879f9' }}/>
            <span style={{ fontSize:'clamp(0.8rem,1.8vw,1.5rem)', fontWeight:900, color:'white', textTransform:'uppercase', letterSpacing:'0.25em' }}>
              La Canzone
            </span>
            <Music2 style={{ width:'clamp(16px,2.2vw,28px)', height:'clamp(16px,2.2vw,28px)', color:'#e879f9' }}/>
          </div>

          {phase === 'song-spin' && (
            <div style={{ width:'min(62vw,62vh)', height:'min(62vw,62vh)', flexShrink:0 }}>
              <Wheel
                items={songs || []}
                isSpinning={songSpinning}
                finalIndex={songIndex}
                onStop={handleSongStopped}
              />
            </div>
          )}

          {(phase === 'song-reveal' || phase === 'celebration') && song && (
            <RevealCard item={song} label="La Canzone" icon={<Music2 style={{width:'1em',height:'1em'}}/>} color="#a855f7" />
          )}

          {phase === 'celebration' && participant && (
            <div style={{
              flexShrink:0,
              display:'inline-flex', alignItems:'center', gap:'clamp(6px,1.2vw,18px)',
              padding:'clamp(8px,1.5vh,16px) clamp(14px,2.5vw,36px)',
              background:'linear-gradient(to right,#c026d3,#7c3aed)',
              borderRadius:9999, border:'3px solid rgba(255,255,255,0.25)',
              boxShadow:'0 0 60px rgba(217,70,239,0.7)',
              animation:'reveal-pop 0.6s cubic-bezier(0.34,1.56,0.64,1) forwards'
            }}>
              <Sparkles style={{ width:'clamp(14px,2vw,28px)', height:'clamp(14px,2vw,28px)', color:'#fde047', animation:'fade-pulse 1s ease-in-out infinite' }}/>
              <span style={{ fontSize:'clamp(0.8rem,2.2vw,2rem)', fontWeight:900, color:'white', textTransform:'uppercase', letterSpacing:'0.08em' }}>
                {participant.nickname} — Preparati a cantare! 🎤
              </span>
              <Sparkles style={{ width:'clamp(14px,2vw,28px)', height:'clamp(14px,2vw,28px)', color:'#fde047', animation:'fade-pulse 1s ease-in-out infinite' }}/>
            </div>
          )}
        </div>
      )}
    </div>
  );
}