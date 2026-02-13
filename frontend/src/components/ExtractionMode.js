import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Zap, Music2, Mic2 } from 'lucide-react';

// --- CONFIGURAZIONE ---
const SPIN_DURATION = 4000;      // Durata totale tensione
const REVEAL_STAGGER = 1500;     // Ritardo tra concorrente e canzone
const AUTO_CLOSE_DELAY = 6000;   // Tempo per godersi la vittoria prima di chiudere

// --- AUDIO ENGINE (CINEMATIC) ---
// Genera suoni profondi e riverberati via codice
const playCinematicSound = (type) => {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  const ctx = new AudioContext();
  const now = ctx.currentTime;

  const createOsc = (freq, type, duration, vol) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.start(now);
    osc.stop(now + duration);
    return osc;
  };

  if (type === 'tick') {
    // Tick metallico ad alta frequenza
    createOsc(800, 'square', 0.05, 0.05);
  } else if (type === 'impact') {
    // "BOOM" profondo (impatto tipo trailer)
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.5);
    gain.gain.setValueAtTime(1, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 1);
    osc.start(now);
    osc.stop(now + 1);
  } else if (type === 'win') {
    // Accordo trionfale etereo
    [261.63, 329.63, 392.00, 523.25, 783.99].forEach((f, i) => {
      setTimeout(() => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'triangle';
        osc.frequency.value = f;
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 4);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 4);
      }, i * 50);
    });
  }
};

// --- PARTICELLE DORATE ---
const GoldDust = () => (
  <div className="absolute inset-0 pointer-events-none overflow-hidden">
    {Array.from({ length: 40 }).map((_, i) => (
      <div
        key={i}
        className="absolute rounded-full bg-gradient-to-r from-yellow-200 to-yellow-600 animate-float-dust"
        style={{
          width: Math.random() * 4 + 1 + 'px',
          height: Math.random() * 4 + 1 + 'px',
          top: Math.random() * 100 + '%',
          left: Math.random() * 100 + '%',
          opacity: Math.random() * 0.5 + 0.2,
          animationDuration: Math.random() * 10 + 5 + 's',
          animationDelay: Math.random() * 5 + 's',
        }}
      />
    ))}
  </div>
);

// --- COMPONENTE CARTA "STAGE" ---
const StageCard = ({ label, value, subValue, isSpinning, isLocked, delay = 0, icon: Icon }) => {
  return (
    <div className={`
      relative w-full max-w-[500px] aspect-[4/5] md:aspect-[3/4] mx-auto
      flex flex-col items-center justify-center
      transition-all duration-300 transform perspective-1000
      ${isLocked ? 'scale-105 z-20' : 'scale-100 z-10'}
    `}>
      
      {/* GLOW EFFECT DIETRO LA CARTA */}
      {isLocked && (
        <div className="absolute inset-0 bg-blue-500/30 blur-[60px] animate-pulse-slow rounded-full" />
      )}

      {/* CORPO DELLA CARTA (VETRO SCURO) */}
      <div className={`
        relative w-full h-full rounded-2xl overflow-hidden
        border-2 backdrop-blur-xl transition-all duration-500
        flex flex-col items-center justify-between p-6
        ${isLocked 
          ? 'bg-black/60 border-blue-400 shadow-[0_0_50px_rgba(59,130,246,0.5)]' 
          : 'bg-black/40 border-white/10'}
      `}>
        
        {/* Label in alto */}
        <div className="w-full flex justify-between items-center border-b border-white/10 pb-4">
          <span className="text-xs font-black tracking-[0.2em] text-white/40 uppercase flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isLocked ? 'bg-red-500 animate-ping' : 'bg-gray-600'}`} />
            LIVE CAM 0{delay + 1}
          </span>
          <Icon className={`w-5 h-5 ${isLocked ? 'text-blue-400' : 'text-white/20'}`} />
        </div>

        {/* CONTENUTO CENTRALE */}
        <div className="flex-1 w-full flex flex-col items-center justify-center relative">
          
          {/* Immagine / Avatar con Cerchio Neon */}
          <div className={`
            relative w-32 h-32 md:w-48 md:h-48 rounded-full mb-6
            flex items-center justify-center bg-black
            border-4 transition-all duration-300
            ${isSpinning ? 'border-white/10' : isLocked ? 'border-blue-500 shadow-[0_0_30px_#3b82f6]' : 'border-white/5'}
          `}>
             {/* Cerchio rotante durante lo spin */}
             {isSpinning && (
               <div className="absolute inset-[-10px] rounded-full border-t-4 border-blue-500 animate-spin" />
             )}

             {/* Immagine */}
             <div className="w-full h-full rounded-full overflow-hidden bg-gray-900 relative z-10">
               {isSpinning ? (
                 <div className="w-full h-full flex items-center justify-center animate-pulse">
                   <Zap className="w-12 h-12 text-white/20" />
                 </div>
               ) : value?.avatar_url ? (
                 <img src={value.avatar_url} className="w-full h-full object-cover animate-zoom-in" alt="" />
               ) : (
                 <div className="w-full h-full flex items-center justify-center text-4xl font-bold text-white">
                    {value?.nickname?.charAt(0) || '?'}
                 </div>
               )}
             </div>
          </div>

          {/* Testo Principale (Nome) */}
          <div className="relative w-full h-20 flex items-center justify-center overflow-hidden">
             <h2 className={`
               text-center font-black uppercase tracking-tighter text-white leading-none
               transition-all duration-100
               ${isSpinning ? 'text-4xl blur-[2px] opacity-70 translate-y-1' : 'text-4xl md:text-5xl drop-shadow-[0_2px_10px_rgba(0,0,0,1)] scale-110'}
             `}>
               {isSpinning ? 'SCANNING...' : (value?.nickname || value?.title)}
             </h2>
          </div>

          {/* Sottotitolo (Artista) */}
          <div className="h-8 flex items-center justify-center">
            {!isSpinning && subValue && (
               <span className="text-blue-300 font-bold tracking-widest text-lg uppercase animate-fade-in-up">
                 {subValue}
               </span>
            )}
          </div>
        </div>

        {/* Footer Tech */}
        <div className="w-full flex justify-between items-end border-t border-white/10 pt-4">
           <div className="flex gap-1">
             {[1,2,3,4].map(i => (
               <div key={i} className={`w-1 h-3 rounded-full ${isLocked ? 'bg-blue-500' : 'bg-gray-800'}`} />
             ))}
           </div>
           <div className="text-[10px] text-white/30 font-mono">
             ID: {Math.random().toString(36).substr(2, 6).toUpperCase()}
           </div>
        </div>
      </div>
    </div>
  );
};

export default function PrimeTimeExtraction({ extractionData, participants, songs, onComplete }) {
  const [phase, setPhase] = useState('countdown'); // countdown, spin_all, lock_p, lock_s, celebration
  const [count, setCount] = useState(3);
  const [tempP, setTempP] = useState(participants[0]);
  const [tempS, setTempS] = useState(songs[0]);
  
  // Effetti visivi globali
  const [shake, setShake] = useState(false);
  const [flash, setFlash] = useState(false);

  // Trigger shake effect
  const triggerImpact = () => {
    setShake(true);
    setFlash(true);
    playCinematicSound('impact');
    setTimeout(() => {
      setShake(false);
      setFlash(false);
    }, 300);
  };

  useEffect(() => {
    let timer, loopP, loopS;

    // 1. COUNTDOWN
    if (phase === 'countdown') {
      timer = setInterval(() => {
        setCount(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            setPhase('spin_all');
            return 0;
          }
          playCinematicSound('tick');
          return prev - 1;
        });
      }, 1000);
    }

    // 2. SPINNING (Tutto gira)
    if (phase === 'spin_all') {
      loopP = setInterval(() => setTempP(participants[Math.floor(Math.random() * participants.length)]), 60);
      loopS = setInterval(() => setTempS(songs[Math.floor(Math.random() * songs.length)]), 60);

      // Ferma Partecipante
      setTimeout(() => {
        clearInterval(loopP);
        setTempP(extractionData.participant);
        setPhase('lock_p');
        triggerImpact();
      }, SPIN_DURATION);
    }

    // 3. LOCK PARTECIPANTE (La canzone gira ancora)
    if (phase === 'lock_p') {
      // Dobbiamo mantenere il loop della canzone attivo, o ricrearlo se React ha pulito
      loopS = setInterval(() => setTempS(songs[Math.floor(Math.random() * songs.length)]), 60);
      
      setTimeout(() => {
        clearInterval(loopS);
        setTempS(extractionData.song);
        setPhase('lock_s'); // Vittoria
        triggerImpact();
        playCinematicSound('win');
      }, REVEAL_STAGGER);
    }

    // 4. CELEBRATION
    if (phase === 'lock_s') {
      const closeTimer = setTimeout(() => {
        if (onComplete) onComplete();
      }, AUTO_CLOSE_DELAY);
      return () => clearTimeout(closeTimer);
    }

    return () => {
      clearInterval(timer);
      if (loopP) clearInterval(loopP);
      if (loopS) clearInterval(loopS);
    };
  }, [phase, participants, songs, extractionData, onComplete]);

  const isSpinP = phase === 'spin_all';
  const isSpinS = phase === 'spin_all' || phase === 'lock_p';
  const isLockedP = phase !== 'countdown' && phase !== 'spin_all';
  const isLockedS = phase === 'lock_s';
  const isWinner = phase === 'lock_s';

  return (
    <div className="fixed inset-0 z-[999] bg-black text-white font-sans overflow-hidden">
      <style>{`
        @keyframes spotlight-rotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes camera-shake {
          0% { transform: translate(1px, 1px) rotate(0deg); }
          10% { transform: translate(-1px, -2px) rotate(-1deg); }
          20% { transform: translate(-3px, 0px) rotate(1deg); }
          30% { transform: translate(3px, 2px) rotate(0deg); }
          40% { transform: translate(1px, -1px) rotate(1deg); }
          50% { transform: translate(-1px, 2px) rotate(-1deg); }
          60% { transform: translate(-3px, 1px) rotate(0deg); }
          70% { transform: translate(3px, 1px) rotate(-1deg); }
          80% { transform: translate(-1px, -1px) rotate(1deg); }
          90% { transform: translate(1px, 2px) rotate(0deg); }
          100% { transform: translate(1px, -2px) rotate(-1deg); }
        }
        .animate-shake {
          animation: camera-shake 0.3s cubic-bezier(.36,.07,.19,.97) both;
        }
        .animate-zoom-in {
          animation: zoomIn 0.5s ease-out forwards;
        }
        @keyframes zoomIn {
          from { transform: scale(1.5); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        @keyframes float-dust {
          0%, 100% { transform: translateY(0) translateX(0); opacity: 0; }
          50% { opacity: 1; }
          100% { transform: translateY(-100px) translateX(20px); opacity: 0; }
        }
      `}</style>

      {/* --- BACKGROUND CINEMATICO --- */}
      <div className={`absolute inset-0 transition-transform duration-100 ${shake ? 'animate-shake' : ''}`}>
        
        {/* Gradiente Base Profondo */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-900 via-[#050510] to-black" />
        
        {/* "Fari" rotanti (Spotlights) */}
        <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] opacity-30 animate-[spotlight-rotate_20s_linear_infinite]">
          <div className="absolute inset-0 bg-[conic-gradient(from_0deg_at_50%_50%,transparent_0deg,rgba(59,130,246,0.1)_60deg,transparent_100deg,transparent_180deg,rgba(59,130,246,0.1)_240deg,transparent_280deg)]" />
        </div>

        {/* Effetto Flash Bianco all'impatto */}
        <div className={`absolute inset-0 bg-white mix-blend-overlay transition-opacity duration-300 ${flash ? 'opacity-40' : 'opacity-0'}`} />
        
        {/* Particelle (solo alla fine) */}
        {isWinner && <GoldDust />}
      </div>

      {/* --- CONTENUTO CENTRALE --- */}
      <div className="relative z-10 w-full h-full flex flex-col items-center justify-center p-4">
        
        {/* Countdown Gigante */}
        {phase === 'countdown' ? (
           <div className="relative flex items-center justify-center scale-150 md:scale-[3]">
             <div className="absolute inset-0 bg-blue-500 blur-[80px] animate-pulse opacity-50" />
             <span className="relative text-[12rem] font-black text-white tracking-tighter" 
                   style={{ textShadow: '0 0 50px rgba(255,255,255,0.8)' }}>
               {count}
             </span>
           </div>
        ) : (
          /* Griglia Carte */
          <div className={`
             w-full max-w-6xl grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-8 items-center
             transition-transform duration-300 ${shake ? 'scale-[1.02]' : 'scale-100'}
          `}>
            
            {/* 1. PARTECIPANTE */}
            <StageCard 
              label="The Voice"
              icon={Mic2}
              value={tempP}
              isSpinning={isSpinP}
              isLocked={isLockedP}
              delay={0}
            />

            {/* ELEMENTO "VS" (Divider) */}
            <div className="hidden md:flex flex-col items-center justify-center relative z-0">
               <div className="h-32 w-[1px] bg-gradient-to-b from-transparent via-white/20 to-transparent" />
               <div className={`
                 w-16 h-16 rounded-full border-2 flex items-center justify-center
                 backdrop-blur-md transition-all duration-500 my-4
                 ${isWinner 
                   ? 'border-yellow-400 bg-yellow-400/20 shadow-[0_0_40px_rgba(250,204,21,0.5)] scale-125' 
                   : 'border-white/20 bg-black/50'}
               `}>
                 <span className={`text-xl font-black italic ${isWinner ? 'text-yellow-400' : 'text-white/50'}`}>VS</span>
               </div>
               <div className="h-32 w-[1px] bg-gradient-to-b from-transparent via-white/20 to-transparent" />
            </div>

            {/* 2. CANZONE */}
            <StageCard 
              label="The Song"
              icon={Music2}
              value={tempS}
              subValue={tempS?.artist}
              isSpinning={isSpinS}
              isLocked={isLockedS}
              delay={1}
            />

          </div>
        )}

        {/* OVERLAY VITTORIA */}
        {isWinner && (
          <div className="absolute bottom-10 md:bottom-20 animate-[zoomIn_0.5s_ease-out_both]">
             <div className="flex flex-col items-center gap-2">
               <div className="bg-gradient-to-r from-blue-600 via-blue-400 to-blue-600 h-[1px] w-64 md:w-96" />
               <h3 className="text-3xl md:text-5xl font-black uppercase tracking-[0.2em] text-transparent bg-clip-text bg-gradient-to-b from-white to-blue-200 drop-shadow-2xl">
                 Official Match
               </h3>
               <div className="flex items-center gap-2 text-blue-300 text-sm font-mono tracking-widest mt-2">
                 <Sparkles className="w-4 h-4 animate-spin-slow" />
                 SAVING RESULT TO DATABASE...
                 <Sparkles className="w-4 h-4 animate-spin-slow" />
               </div>
             </div>
          </div>
        )}

      </div>
    </div>
  );
}