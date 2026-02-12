import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Music2, Trophy, Zap } from 'lucide-react';

const SLOT_SPIN_DURATION = 2500; // Durata rotazione slot
const REVEAL_DELAY = 3000; // Delay prima del reveal finale
const TOTAL_ANIMATION_TIME = 8000; // Tempo totale animazione

// Suoni slot machine (usando Web Audio API)
const playSlotSound = () => {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  oscillator.frequency.value = 200;
  oscillator.type = 'square';
  
  gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
  
  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + 0.3);
};

const playWinSound = () => {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
  
  notes.forEach((freq, i) => {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = freq;
    oscillator.type = 'sine';
    
    const startTime = audioContext.currentTime + (i * 0.1);
    gainNode.gain.setValueAtTime(0.3, startTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.3);
    
    oscillator.start(startTime);
    oscillator.stop(startTime + 0.3);
  });
};

const playTickSound = () => {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  oscillator.frequency.value = 800;
  oscillator.type = 'sine';
  
  gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.05);
  
  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + 0.05);
};

// Componente Slot Reel (rullo slot machine)
const SlotReel = ({ items, isSpinning, finalValue, delay = 0 }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const intervalRef = useRef(null);
  
  useEffect(() => {
    if (isSpinning) {
      const startDelay = setTimeout(() => {
        playSlotSound();
        intervalRef.current = setInterval(() => {
          setCurrentIndex(prev => (prev + 1) % items.length);
          playTickSound();
        }, 100);
      }, delay);
      
      return () => {
        clearTimeout(startDelay);
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      const finalIndex = items.findIndex(item => 
        item.id === finalValue?.id || item.title === finalValue?.title
      );
      if (finalIndex !== -1) setCurrentIndex(finalIndex);
    }
  }, [isSpinning, items, finalValue, delay]);
  
  const displayItem = items[currentIndex] || items[0];
  
  return (
    <div className="relative w-full h-64 perspective-1000">
      <div className={`
        absolute inset-0 flex items-center justify-center
        transition-all duration-500
        ${isSpinning ? 'blur-sm scale-95' : 'blur-0 scale-100'}
      `}>
        <div className="text-center w-full px-8">
          {displayItem.avatar_url ? (
            <img 
              src={displayItem.avatar_url} 
              alt={displayItem.nickname}
              className="w-40 h-40 rounded-full mx-auto mb-6 border-8 border-fuchsia-500 shadow-[0_0_80px_rgba(217,70,239,0.8)] object-cover"
            />
          ) : displayItem.title ? (
            <div className="w-40 h-40 rounded-3xl bg-gradient-to-br from-fuchsia-600 to-purple-600 mx-auto mb-6 flex items-center justify-center border-8 border-white/20 shadow-[0_0_80px_rgba(217,70,239,0.8)]">
              <Music2 className="w-24 h-24 text-white" />
            </div>
          ) : (
            <div className="w-40 h-40 rounded-full bg-gradient-to-br from-fuchsia-600 to-purple-600 mx-auto mb-6 flex items-center justify-center border-8 border-white/20 shadow-[0_0_80px_rgba(217,70,239,0.8)] text-8xl font-black text-white">
              {displayItem.nickname?.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="text-6xl font-black text-white mb-2 drop-shadow-2xl">
            {displayItem.nickname || displayItem.title || '???'}
          </div>
          {displayItem.artist && (
            <div className="text-4xl font-bold text-fuchsia-300">
              {displayItem.artist}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Componente Confetti
const Confetti = () => {
  const pieces = Array.from({ length: 50 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 2,
    duration: 3 + Math.random() * 2,
    color: ['#d946ef', '#a855f7', '#ec4899', '#f59e0b', '#10b981'][Math.floor(Math.random() * 5)]
  }));
  
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {pieces.map(piece => (
        <div
          key={piece.id}
          className="absolute w-3 h-3 rounded-sm animate-confetti"
          style={{
            left: `${piece.left}%`,
            top: '-20px',
            backgroundColor: piece.color,
            animationDelay: `${piece.delay}s`,
            animationDuration: `${piece.duration}s`
          }}
        />
      ))}
    </div>
  );
};

export default function ExtractionMode({ extractionData, participants, songs, onComplete }) {
  const [phase, setPhase] = useState('countdown'); // countdown, spinning, reveal, celebration
  const [countdown, setCountdown] = useState(3);
  const [isSpinning, setIsSpinning] = useState(false);
  
  useEffect(() => {
    // FASE 1: Countdown
    if (phase === 'countdown') {
      const timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            setPhase('spinning');
            return 0;
          }
          playTickSound();
          return prev - 1;
        });
      }, 800);
      
      return () => clearInterval(timer);
    }
    
    // FASE 2: Spinning
    if (phase === 'spinning') {
      setIsSpinning(true);
      
      // Stop partecipante dopo 2.5s
      const stopParticipant = setTimeout(() => {
        setIsSpinning(false);
        playWinSound();
      }, SLOT_SPIN_DURATION);
      
      // Reveal finale dopo 3s
      const revealTimer = setTimeout(() => {
        setPhase('reveal');
      }, REVEAL_DELAY);
      
      return () => {
        clearTimeout(stopParticipant);
        clearTimeout(revealTimer);
      };
    }
    
    // FASE 3: Reveal
    if (phase === 'reveal') {
      playWinSound();
      
      const celebrationTimer = setTimeout(() => {
        setPhase('celebration');
      }, 2000);
      
      return () => clearTimeout(celebrationTimer);
    }
    
    // FASE 4: Celebration
    if (phase === 'celebration') {
      const completeTimer = setTimeout(() => {
        if (onComplete) onComplete();
      }, 3000);
      
      return () => clearTimeout(completeTimer);
    }
  }, [phase, onComplete]);
  
  const participant = extractionData?.participant;
  const song = extractionData?.song;
  
  return (
    <div className="w-full h-full flex flex-col items-center justify-center relative overflow-hidden bg-gradient-to-br from-black via-purple-950 to-black">
      <style>{`
        @keyframes confetti {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }
        .animate-confetti {
          animation: confetti linear forwards;
        }
        .perspective-1000 {
          perspective: 1000px;
        }
        @keyframes pulse-glow {
          0%, 100% {
            box-shadow: 0 0 40px rgba(217,70,239,0.4);
          }
          50% {
            box-shadow: 0 0 80px rgba(217,70,239,0.8);
          }
        }
        .animate-pulse-glow {
          animation: pulse-glow 2s ease-in-out infinite;
        }
        @keyframes bounce-in {
          0% {
            transform: scale(0) rotate(-180deg);
            opacity: 0;
          }
          50% {
            transform: scale(1.2) rotate(10deg);
          }
          100% {
            transform: scale(1) rotate(0deg);
            opacity: 1;
          }
        }
        .animate-bounce-in {
          animation: bounce-in 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
      `}</style>
      
      {/* Background effects */}
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20"></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1200px] h-[1200px] bg-fuchsia-600/20 rounded-full blur-[200px] animate-pulse"></div>
      
      {phase === 'celebration' && <Confetti />}
      
      <div className="relative z-10 w-full max-w-6xl mr-[350px]">
        {/* Countdown Phase */}
        {phase === 'countdown' && (
          <div className="text-center animate-bounce-in">
            <div className="inline-flex items-center gap-4 mb-12 px-8 py-4 bg-fuchsia-600/20 backdrop-blur-xl rounded-full border-2 border-fuchsia-500">
              <Zap className="w-8 h-8 text-yellow-400 animate-pulse" />
              <h2 className="text-4xl font-black text-white uppercase tracking-[0.3em]">
                Estrazione Casuale
              </h2>
              <Zap className="w-8 h-8 text-yellow-400 animate-pulse" />
            </div>
            
            <div className="relative">
              <div className="text-[20rem] font-black text-transparent bg-clip-text bg-gradient-to-b from-fuchsia-400 to-purple-600 leading-none animate-pulse-glow">
                {countdown}
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-[20rem] font-black text-fuchsia-500/20 leading-none blur-2xl">
                  {countdown}
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Spinning & Reveal Phase */}
        {(phase === 'spinning' || phase === 'reveal' || phase === 'celebration') && (
          <div className="space-y-12">
            {/* Titolo */}
            <div className="text-center mb-16">
              <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 via-purple-400 to-pink-400 uppercase tracking-wider mb-4 drop-shadow-2xl">
                {phase === 'spinning' ? '🎰 Estrazione in corso...' : '✨ Ecco il vincitore!'}
              </h1>
            </div>
            
            {/* Slot Partecipante */}
            <div className="bg-black/40 backdrop-blur-xl rounded-[3rem] p-12 border-4 border-fuchsia-500/50 shadow-[0_0_100px_rgba(217,70,239,0.4)] mb-8">
              <div className="flex items-center gap-6 mb-8">
                <Trophy className="w-12 h-12 text-yellow-400" />
                <h3 className="text-4xl font-black text-white uppercase tracking-wider">Il Cantante</h3>
              </div>
              <SlotReel 
                items={participants || []} 
                isSpinning={isSpinning}
                finalValue={participant}
                delay={0}
              />
            </div>
            
            {/* Slot Canzone - appare dopo che il partecipante si è fermato */}
            {!isSpinning && (
              <div className="bg-black/40 backdrop-blur-xl rounded-[3rem] p-12 border-4 border-purple-500/50 shadow-[0_0_100px_rgba(168,85,247,0.4)] animate-bounce-in">
                <div className="flex items-center gap-6 mb-8">
                  <Music2 className="w-12 h-12 text-fuchsia-400" />
                  <h3 className="text-4xl font-black text-white uppercase tracking-wider">La Canzone</h3>
                </div>
                <SlotReel 
                  items={songs || []} 
                  isSpinning={false}
                  finalValue={song}
                  delay={500}
                />
              </div>
            )}
          </div>
        )}
        
        {/* Celebration message */}
        {phase === 'celebration' && (
          <div className="text-center mt-12 animate-bounce-in">
            <div className="inline-flex items-center gap-6 px-12 py-6 bg-gradient-to-r from-fuchsia-600 to-purple-600 rounded-full border-4 border-white/20 shadow-[0_0_100px_rgba(217,70,239,0.8)]">
              <Sparkles className="w-10 h-10 text-yellow-300 animate-pulse" />
              <span className="text-5xl font-black text-white uppercase tracking-wider">
                Preparati a cantare! 🎤
              </span>
              <Sparkles className="w-10 h-10 text-yellow-300 animate-pulse" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
