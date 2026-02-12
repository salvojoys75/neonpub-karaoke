import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Music, User, Zap, Radio } from 'lucide-react';

// --- CONFIGURAZIONE TEMPI ---
const COUNTDOWN_TIME = 3;       // Secondi di countdown
const SPIN_DURATION_P = 2000;   // Quanto gira il partecipante
const SPIN_DURATION_S = 3500;   // Quanto gira la canzone (finisce dopo il partecipante)
const AUTO_CLOSE_DELAY = 4000;  // Secondi di attesa dopo il risultato prima di chiudere

// --- AUDIO ENGINE (Senza file esterni) ---
const playSound = (type) => {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  const ctx = new AudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);

  const now = ctx.currentTime;

  if (type === 'tick') {
    // Click meccanico veloce
    osc.type = 'square';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.05);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
    osc.start(now);
    osc.stop(now + 0.05);
  } else if (type === 'lock') {
    // Suono basso di "stop"
    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(50, now + 0.3);
    gain.gain.setValueAtTime(0.5, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.3);
    osc.start(now);
    osc.stop(now + 0.3);
  } else if (type === 'win') {
    // Fanfara sintetica
    const frequencies = [523.25, 659.25, 783.99, 1046.50]; // Do Magg
    frequencies.forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g);
      g.connect(ctx.destination);
      o.type = 'triangle';
      o.frequency.value = f;
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(0.2, now + 0.1 + (i*0.05));
      g.gain.exponentialRampToValueAtTime(0.001, now + 2);
      o.start(now);
      o.stop(now + 2);
    });
  }
};

// --- COMPONENTE CARTA ---
const ExtractionCard = ({ label, icon: Icon, data, isSpinning, isLocked, delayIndex }) => {
  return (
    <div className={`
      relative flex-1 w-full max-w-md mx-auto
      flex flex-col items-center justify-center
      p-6 rounded-2xl border transition-all duration-500
      ${isLocked 
        ? 'bg-gradient-to-br from-indigo-900/80 to-blue-900/80 border-blue-400 shadow-[0_0_40px_rgba(59,130,246,0.6)] transform scale-105' 
        : 'bg-black/40 border-white/10 scale-100'}
    `}>
      {/* Etichetta in alto */}
      <div className="absolute -top-3 bg-black border border-white/20 px-4 py-1 rounded-full flex items-center gap-2 shadow-lg z-10">
        <Icon className={`w-4 h-4 ${isLocked ? 'text-blue-400' : 'text-gray-400'}`} />
        <span className={`text-xs font-bold uppercase tracking-wider ${isLocked ? 'text-white' : 'text-gray-400'}`}>
          {label}
        </span>
      </div>

      {/* Contenuto */}
      <div className="flex flex-col items-center gap-4 mt-2 text-center w-full">
        {/* Cerchio Avatar/Icona */}
        <div className={`
          w-28 h-28 md:w-40 md:h-40 rounded-full border-4 flex items-center justify-center overflow-hidden bg-gray-900 relative
          ${isSpinning ? 'border-white/20' : isLocked ? 'border-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.5)]' : 'border-gray-700'}
        `}>
          {isSpinning ? (
            <div className="animate-spin duration-700">
              <Zap className="w-10 h-10 text-white/30" />
            </div>
          ) : (
            data.avatar_url ? (
              <img src={data.avatar_url} alt="" className="w-full h-full object-cover animate-fade-in" />
            ) : (
              <div className="text-4xl font-black text-white">{data.nickname?.charAt(0) || <Icon />}</div>
            )
          )}
          
          {/* Effetto Flash quando si ferma */}
          {isLocked && <div className="absolute inset-0 bg-white/50 animate-ping-once rounded-full" />}
        </div>

        {/* Testo */}
        <div className="w-full min-h-[5rem] flex flex-col items-center justify-center">
          <h2 className={`
            font-black uppercase tracking-tight leading-none transition-all duration-300
            ${isSpinning ? 'text-3xl text-white/50 blur-[2px]' : 'text-4xl md:text-5xl text-white drop-shadow-xl'}
          `}>
            {isSpinning ? '...' : (data.nickname || data.title)}
          </h2>
          {!isSpinning && data.artist && (
            <p className="text-blue-300 font-medium text-lg mt-1 animate-slide-up">
              {data.artist}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default function BroadcastExtraction({ extractionData, participants, songs, onComplete }) {
  const [phase, setPhase] = useState('countdown'); // countdown, spinning, lock1, lock2, end
  const [count, setCount] = useState(COUNTDOWN_TIME);
  
  // Dati temporanei per l'animazione
  const [tempParticipant, setTempParticipant] = useState(participants[0]);
  const [tempSong, setTempSong] = useState(songs[0]);

  // Gestione stato animazione
  useEffect(() => {
    let timer;
    let spinIntervalP;
    let spinIntervalS;

    // --- FASE 1: COUNTDOWN ---
    if (phase === 'countdown') {
      timer = setInterval(() => {
        setCount((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            setPhase('spinning');
            return 0;
          }
          playSound('tick');
          return prev - 1;
        });
      }, 1000);
    }

    // --- FASE 2: SPINNING ---
    if (phase === 'spinning') {
      // Slot 1 (Partecipante) gira veloce
      spinIntervalP = setInterval(() => {
        setTempParticipant(participants[Math.floor(Math.random() * participants.length)]);
      }, 80);
      
      // Slot 2 (Canzone) gira veloce
      spinIntervalS = setInterval(() => {
        setTempSong(songs[Math.floor(Math.random() * songs.length)]);
      }, 80);

      // Ferma Partecipante
      setTimeout(() => {
        clearInterval(spinIntervalP);
        setTempParticipant(extractionData.participant);
        setPhase('lock1');
        playSound('lock');
      }, SPIN_DURATION_P);
    }

    // --- FASE 3: BLOCCA PARTECIPANTE, ASPETTA CANZONE ---
    if (phase === 'lock1') {
      // La canzone sta ancora girando (spinIntervalS è ancora attivo nel cleanup del 'spinning' effect? 
      // No, in React dobbiamo gestire l'intervallo in modo persistente o ricrearlo.
      // Soluzione più pulita: ricreare l'intervallo solo per la canzone qui o usare refs. 
      // Per semplicità, qui facciamo ripartire un intervallo solo per la canzone.
      spinIntervalS = setInterval(() => {
        setTempSong(songs[Math.floor(Math.random() * songs.length)]);
      }, 80);

      setTimeout(() => {
        clearInterval(spinIntervalS);
        setTempSong(extractionData.song);
        setPhase('lock2'); // Tutto fermo
        playSound('lock');
      }, SPIN_DURATION_S - SPIN_DURATION_P);
    }

    // --- FASE 4: VITTORIA & CHIUSURA ---
    if (phase === 'lock2') {
      setTimeout(() => {
        setPhase('end');
        playSound('win');
        
        // Timer per chiusura automatica (come richiesto)
        setTimeout(() => {
          if (onComplete) onComplete();
        }, AUTO_CLOSE_DELAY);

      }, 500);
    }

    return () => {
      clearInterval(timer);
      clearInterval(spinIntervalP);
      clearInterval(spinIntervalS);
    };
  }, [phase, participants, songs, extractionData, onComplete]);

  // Calcolo stati booleani per render
  const isSpinningP = phase === 'spinning';
  const isSpinningS = phase === 'spinning' || phase === 'lock1';
  const isLockedP = phase === 'lock1' || phase === 'lock2' || phase === 'end';
  const isLockedS = phase === 'lock2' || phase === 'end';
  const isCelebration = phase === 'end';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black overflow-hidden font-sans">
      <style>{`
        @keyframes scanline {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100%); }
        }
        .animate-ping-once {
          animation: ping 0.5s cubic-bezier(0, 0, 0.2, 1) forwards;
        }
        .bg-grid-tech {
          background-size: 50px 50px;
          background-image: 
            linear-gradient(to right, rgba(255, 255, 255, 0.05) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255, 255, 255, 0.05) 1px, transparent 1px);
        }
      `}</style>

      {/* BACKGROUND TECH */}
      <div className="absolute inset-0 bg-gradient-to-b from-gray-900 via-black to-blue-950"></div>
      <div className="absolute inset-0 bg-grid-tech opacity-30"></div>
      
      {/* SCANLINE EFFECT (TV VECCHIA) */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent via-white/5 to-transparent h-1/4 animate-[scanline_4s_linear_infinite] opacity-30"></div>

      {/* HEADER LIVE */}
      <div className="absolute top-6 left-0 right-0 flex justify-center z-20">
        <div className="flex items-center gap-3 bg-black/60 backdrop-blur border border-white/10 px-6 py-2 rounded-full">
          <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse shadow-[0_0_10px_red]"></div>
          <span className="text-white font-bold tracking-widest text-sm">LIVE MATCH</span>
          <Radio className="w-4 h-4 text-gray-400" />
        </div>
      </div>

      {/* MAIN STAGE */}
      <div className="relative z-10 w-full max-w-5xl px-4 flex flex-col md:flex-row items-center justify-center gap-8 md:gap-12">
        
        {phase === 'countdown' ? (
          <div className="scale-150 transform transition-all duration-300">
             <div className="text-[10rem] md:text-[15rem] font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-600 leading-none">
               {count}
             </div>
          </div>
        ) : (
          <>
            {/* Slot Partecipante */}
            <ExtractionCard 
              label="Player"
              icon={User}
              data={tempParticipant}
              isSpinning={isSpinningP}
              isLocked={isLockedP}
            />

            {/* Elemento Centrale VS */}
            <div className="flex flex-col items-center justify-center shrink-0">
              <div className={`
                w-12 h-12 rounded-full border-2 flex items-center justify-center bg-black
                transition-all duration-500
                ${isCelebration ? 'border-yellow-400 scale-125 shadow-[0_0_30px_yellow]' : 'border-gray-700 text-gray-500'}
              `}>
                <span className="font-black text-sm italic">VS</span>
              </div>
            </div>

            {/* Slot Canzone */}
            <ExtractionCard 
              label="Track"
              icon={Music}
              data={tempSong}
              isSpinning={isSpinningS}
              isLocked={isLockedS}
            />
          </>
        )}
      </div>

      {/* OVERLAY VITTORIA (PARTICELLE/LUCE) */}
      {isCelebration && (
        <div className="absolute inset-0 pointer-events-none z-0">
          <div className="absolute inset-0 bg-blue-500/10 mix-blend-overlay animate-pulse"></div>
          {/* Semplici particelle CSS */}
          {Array.from({ length: 20 }).map((_, i) => (
            <div 
              key={i}
              className="absolute w-1 h-1 bg-white rounded-full"
              style={{
                top: `${Math.random() * 100}%`,
                left: `${Math.random() * 100}%`,
                animation: `pulse 1s infinite ${Math.random()}s`
              }}
            />
          ))}
          <div className="absolute bottom-10 left-0 right-0 text-center animate-bounce">
             <div className="inline-flex items-center gap-2 px-6 py-2 bg-yellow-400/20 border border-yellow-400/50 rounded-full text-yellow-200 uppercase text-sm font-bold tracking-widest shadow-[0_0_20px_rgba(250,204,21,0.3)]">
               <Sparkles className="w-4 h-4" /> Match Found <Sparkles className="w-4 h-4" />
             </div>
          </div>
        </div>
      )}
    </div>
  );
}