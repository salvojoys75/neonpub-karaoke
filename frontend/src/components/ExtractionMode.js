import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Music2, Trophy, Mic2, Star } from 'lucide-react';

// --- CONFIGURAZIONE ---
const SPIN_DURATION = 3000; // Durata rotazione partecipante
const SONG_DELAY = 1500;    // Ritardo partenza slot canzone
const REVEAL_DELAY = 500;   // Pausa drammatica prima del flash finale

// --- GESTIONE AUDIO (Web Audio API per suoni senza file esterni) ---
const audioCtxRef = { current: null };

const initAudio = () => {
  if (!audioCtxRef.current) {
    audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtxRef.current.state === 'suspended') {
    audioCtxRef.current.resume();
  }
  return audioCtxRef.current;
};

const playTickSound = () => {
  const ctx = initAudio();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  
  osc.connect(gain);
  gain.connect(ctx.destination);
  
  // Suono "Meccanico" tipo ruota della fortuna
  osc.frequency.setValueAtTime(150, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.05);
  osc.type = 'triangle';
  
  gain.gain.setValueAtTime(0.3, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);
  
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.05);
};

const playDrumRoll = (duration) => {
  const ctx = initAudio();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  
  osc.connect(gain);
  gain.connect(ctx.destination);
  
  osc.type = 'lowpass'; 
  osc.frequency.value = 100;
  
  // Rumore bianco simulato per rullante (semplificato)
  const bufferSize = ctx.sampleRate * duration;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  const noiseGain = ctx.createGain();
  noise.connect(noiseGain);
  noiseGain.connect(ctx.destination);
  
  noiseGain.gain.setValueAtTime(0.1, ctx.currentTime);
  noiseGain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + duration - 0.5);
  noiseGain.gain.linearRampToValueAtTime(0, ctx.currentTime + duration);
  
  noise.start(ctx.currentTime);
};

const playVictorySound = () => {
  const ctx = initAudio();
  
  // Accordo trionfale
  [261.63, 329.63, 392.00, 523.25].forEach((freq, i) => { // C Major
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.2, now + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 2);
    
    osc.start(now);
    osc.stop(now + 2);
  });
};

// --- COMPONENTI UI ---

const SlotCard = ({ title, icon: Icon, item, isSpinning, isRevealed, colorClass, delay = 0 }) => {
  const [displayItem, setDisplayItem] = useState(item);
  
  return (
    <div className={`
      relative group flex flex-col items-center justify-center p-6 
      rounded-3xl border-2 transition-all duration-500 overflow-hidden
      w-full max-w-md mx-auto h-full min-h-[250px]
      ${isRevealed 
        ? `bg-black/60 border-${colorClass}-400 shadow-[0_0_50px_rgba(var(--${colorClass}-rgb),0.5)] scale-105` 
        : 'bg-black/30 border-white/10 scale-100'}
    `}>
      {/* Background Glow */}
      <div className={`absolute inset-0 bg-gradient-to-b from-${colorClass}-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700`} />
      
      {/* Icona Header */}
      <div className="absolute top-4 left-0 right-0 flex justify-center">
        <div className={`px-4 py-1 rounded-full bg-${colorClass}-500/20 border border-${colorClass}-500/50 backdrop-blur-md flex items-center gap-2`}>
          <Icon className={`w-4 h-4 text-${colorClass}-300`} />
          <span className={`text-xs font-bold uppercase tracking-widest text-${colorClass}-200`}>{title}</span>
        </div>
      </div>

      {/* Contenuto Principale */}
      <div className="relative z-10 flex flex-col items-center justify-center w-full mt-6 space-y-4">
        {/* Avatar / Icona */}
        <div className={`
          relative w-32 h-32 md:w-40 md:h-40 rounded-full border-4 
          flex items-center justify-center shadow-2xl overflow-hidden bg-gray-900
          transition-all duration-300
          ${isSpinning ? 'border-white/30 animate-pulse' : `border-${colorClass}-500 shadow-[0_0_30px_rgba(var(--${colorClass}-rgb),0.6)]`}
        `}>
          {isSpinning ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center animate-spin-fast blur-sm opacity-50">
               <Icon className="w-12 h-12 text-white/50" />
            </div>
          ) : (
            displayItem?.avatar_url ? (
               <img src={displayItem.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
               <div className={`text-4xl md:text-5xl font-black text-white`}>
                 {displayItem?.nickname?.charAt(0).toUpperCase() || <Icon className="w-16 h-16" />}
               </div>
            )
          )}
        </div>

        {/* Testo */}
        <div className="text-center w-full px-2">
          <h2 className={`
            font-black text-white uppercase tracking-tight leading-none
            transition-all duration-300 drop-shadow-lg
            ${isSpinning ? 'text-2xl blur-[2px] opacity-70' : 'text-3xl md:text-4xl scale-110'}
          `}>
            {isSpinning ? '...' : (displayItem?.nickname || displayItem?.title || '???')}
          </h2>
          {!isSpinning && displayItem?.artist && (
            <p className={`text-${colorClass}-300 font-medium text-lg mt-1 animate-fadeIn`}>
              {displayItem.artist}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default function ExtractionModeTV({ extractionData, participants, songs, onComplete }) {
  const [phase, setPhase] = useState('intro'); // intro, spinning, locked, reveal
  const [countdown, setCountdown] = useState(3);
  
  // Stati visuali temporanei per l'animazione
  const [tempParticipant, setTempParticipant] = useState(participants?.[0]);
  const [tempSong, setTempSong] = useState(songs?.[0]);
  
  const [pSpinning, setPSpinning] = useState(false);
  const [sSpinning, setSSpinning] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  // Helper per scegliere elemento random durante lo spin
  const getRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

  useEffect(() => {
    let intervalP, intervalS;

    // FASE 1: Countdown
    if (phase === 'intro') {
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            setPhase('spinning');
            return 0;
          }
          playTickSound();
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }

    // FASE 2: Spinning
    if (phase === 'spinning') {
      setPSpinning(true);
      setSSpinning(true);
      playDrumRoll(SPIN_DURATION / 1000);

      // Loop visivo veloce Partecipante
      intervalP = setInterval(() => {
        setTempParticipant(getRandom(participants));
      }, 80);

      // Loop visivo veloce Canzone
      intervalS = setInterval(() => {
        setTempSong(getRandom(songs));
      }, 80);

      // Stop Partecipante
      setTimeout(() => {
        clearInterval(intervalP);
        setTempParticipant(extractionData.participant);
        setPSpinning(false);
        playTickSound(); // Suono "Lock"
        
        // Stop Canzone dopo ritardo
        setTimeout(() => {
          clearInterval(intervalS);
          setTempSong(extractionData.song);
          setSSpinning(false);
          setPhase('locked');
        }, SONG_DELAY);
        
      }, SPIN_DURATION);
    }

    // FASE 3: Locked -> Reveal (Flash)
    if (phase === 'locked') {
      setTimeout(() => {
        setPhase('reveal');
        playVictorySound();
        setShowConfetti(true);
      }, REVEAL_DELAY);
    }
    
    // FASE 4: Completamento
    if (phase === 'reveal') {
       const endTimer = setTimeout(() => {
         if (onComplete) onComplete();
       }, 5000);
       return () => clearTimeout(endTimer);
    }

    return () => {
      if (intervalP) clearInterval(intervalP);
      if (intervalS) clearInterval(intervalS);
    };
  }, [phase, participants, songs, extractionData, onComplete]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-black text-white font-sans">
      <style>{`
        /* Variabili colore dinamiche per Tailwind JIT o custom */
        :root {
          --fuchsia-rgb: 217, 70, 239;
          --cyan-rgb: 34, 211, 238;
        }
        @keyframes spotlight {
          0% { transform: rotate(45deg) translateX(-20%); opacity: 0.4; }
          50% { transform: rotate(35deg) translateX(0%); opacity: 0.8; }
          100% { transform: rotate(45deg) translateX(-20%); opacity: 0.4; }
        }
        @keyframes spotlight-r {
          0% { transform: rotate(-45deg) translateX(20%); opacity: 0.4; }
          50% { transform: rotate(-35deg) translateX(0%); opacity: 0.8; }
          100% { transform: rotate(-45deg) translateX(20%); opacity: 0.4; }
        }
        @keyframes spin-fast {
          0% { transform: translateY(-10%); }
          100% { transform: translateY(10%); }
        }
        .animate-spin-fast {
          animation: spin-fast 0.1s linear infinite alternate;
        }
        .bg-grid-pattern {
          background-image: linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px);
          background-size: 40px 40px;
        }
      `}</style>

      {/* --- BACKGROUND LAYER --- */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-900 via-black to-black"></div>
      <div className="absolute inset-0 bg-grid-pattern opacity-20"></div>
      
      {/* Riflettori */}
      <div className="absolute top-[-50%] left-[-20%] w-[80vh] h-[200vh] bg-white/5 blur-[80px] origin-top animate-[spotlight_8s_ease-in-out_infinite]" />
      <div className="absolute top-[-50%] right-[-20%] w-[80vh] h-[200vh] bg-fuchsia-500/10 blur-[80px] origin-top animate-[spotlight-r_8s_ease-in-out_infinite]" />
      
      {/* Confetti (Semplificati CSS) */}
      {showConfetti && (
        <div className="absolute inset-0 pointer-events-none">
          {Array.from({ length: 50 }).map((_, i) => (
            <div 
              key={i}
              className="absolute w-2 h-2 bg-yellow-400 rounded-full animate-pulse"
              style={{
                top: '-10px',
                left: `${Math.random() * 100}%`,
                animation: `fall ${2 + Math.random() * 3}s linear forwards`,
                backgroundColor: ['#FFD700', '#FF00FF', '#00FFFF'][Math.floor(Math.random() * 3)]
              }}
            />
          ))}
          <style>{`
            @keyframes fall {
              to { transform: translateY(110vh) rotate(720deg); }
            }
          `}</style>
        </div>
      )}

      {/* --- CONTENT LAYER --- */}
      <div className="relative z-10 w-full max-w-7xl h-full flex flex-col justify-center items-center px-4 py-6 md:py-12">
        
        {/* Header Logo */}
        <div className="absolute top-6 md:top-12 flex flex-col items-center">
          <div className="flex items-center gap-3 mb-2">
            <Star className="w-6 h-6 text-yellow-400 fill-yellow-400 animate-spin-slow" />
            <h1 className="text-2xl md:text-3xl font-black tracking-[0.5em] uppercase text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-yellow-400 to-yellow-200 drop-shadow-sm">
              Talent Show
            </h1>
            <Star className="w-6 h-6 text-yellow-400 fill-yellow-400 animate-spin-slow" />
          </div>
          <div className="h-1 w-32 bg-gradient-to-r from-transparent via-yellow-500 to-transparent"></div>
        </div>

        {/* FASE COUNTDOWN */}
        {phase === 'intro' && (
          <div className="flex items-center justify-center scale-150">
            <div className="text-[12rem] md:text-[20rem] font-black text-white leading-none relative">
              <span className="absolute inset-0 blur-3xl text-fuchsia-600 animate-pulse">{countdown}</span>
              <span className="relative bg-gradient-to-b from-white to-gray-400 bg-clip-text text-transparent">
                {countdown}
              </span>
            </div>
          </div>
        )}

        {/* FASE ESTRAZIONE */}
        {phase !== 'intro' && (
          <div className="w-full flex flex-col md:flex-row items-center justify-center gap-6 md:gap-12 mt-12 md:mt-0 flex-1">
            
            {/* Slot Partecipante */}
            <div className="w-full h-[40vh] md:h-auto md:flex-1 flex justify-center">
              <SlotCard 
                title="Concorrente"
                icon={Mic2}
                item={tempParticipant}
                isSpinning={pSpinning}
                isRevealed={phase === 'reveal'}
                colorClass="fuchsia"
              />
            </div>

            {/* VS Badge (Desktop) / Divider (Mobile) */}
            <div className="shrink-0 flex items-center justify-center">
               <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-gradient-to-br from-yellow-400 to-orange-600 flex items-center justify-center shadow-[0_0_30px_rgba(234,179,8,0.6)] border-4 border-black z-20">
                 <span className="font-black text-black text-xl md:text-2xl italic">VS</span>
               </div>
            </div>

            {/* Slot Canzone */}
            <div className="w-full h-[40vh] md:h-auto md:flex-1 flex justify-center">
              <SlotCard 
                title="Canzone Assegnata"
                icon={Music2}
                item={tempSong}
                isSpinning={sSpinning}
                isRevealed={phase === 'reveal'}
                colorClass="cyan" // Usa un colore diverso per contrasto
              />
            </div>

          </div>
        )}

        {/* MESSAGGIO VITTORIA */}
        {phase === 'reveal' && (
          <div className="absolute bottom-10 md:bottom-20 animate-bounce-in">
             <div className="bg-white/10 backdrop-blur-md border border-white/20 px-8 py-4 rounded-full shadow-[0_0_50px_rgba(255,255,255,0.2)]">
               <span className="text-xl md:text-3xl font-bold text-white uppercase tracking-widest flex items-center gap-4">
                 <Trophy className="w-8 h-8 text-yellow-400" />
                 Abbinamento Confermato!
                 <Trophy className="w-8 h-8 text-yellow-400" />
               </span>
             </div>
          </div>
        )}

      </div>
    </div>
  );
}