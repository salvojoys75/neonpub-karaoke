import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Music2, Trophy, Zap } from 'lucide-react';

const SLOT_SPIN_DURATION = 2500;
const REVEAL_DELAY = 3000;

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
  const notes = [523.25, 659.25, 783.99, 1046.50];
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

// Componente Slot Reel
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
  if (!displayItem) return null;

  return (
    <div className="extraction-reel">
      <div className={`extraction-reel-inner ${isSpinning ? 'spinning' : ''}`}>
        <div className="extraction-reel-content">
          {displayItem.avatar_url ? (
            <img
              src={displayItem.avatar_url}
              alt={displayItem.nickname}
              className="extraction-avatar"
            />
          ) : displayItem.title ? (
            <div className="extraction-avatar extraction-avatar-icon">
              <Music2 className="extraction-icon-inner" />
            </div>
          ) : (
            <div className="extraction-avatar extraction-avatar-letter">
              {displayItem.nickname?.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="extraction-name">
            {displayItem.nickname || displayItem.title || '???'}
          </div>
          {displayItem.artist && (
            <div className="extraction-artist">{displayItem.artist}</div>
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
          className="absolute rounded-sm animate-confetti"
          style={{
            left: `${piece.left}%`,
            top: '-20px',
            width: 'clamp(8px, 1vw, 14px)',
            height: 'clamp(8px, 1vw, 14px)',
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
  const [phase, setPhase] = useState('countdown');
  const [countdown, setCountdown] = useState(3);
  const [isSpinning, setIsSpinning] = useState(false);

  useEffect(() => {
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

    if (phase === 'spinning') {
      setIsSpinning(true);
      const stopParticipant = setTimeout(() => {
        setIsSpinning(false);
        playWinSound();
      }, SLOT_SPIN_DURATION);
      const revealTimer = setTimeout(() => {
        setPhase('reveal');
      }, REVEAL_DELAY);
      return () => {
        clearTimeout(stopParticipant);
        clearTimeout(revealTimer);
      };
    }

    if (phase === 'reveal') {
      playWinSound();
      const celebrationTimer = setTimeout(() => {
        setPhase('celebration');
      }, 2000);
      return () => clearTimeout(celebrationTimer);
    }

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
    <div className="extraction-root">
      <style>{`
        .extraction-root {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          background: radial-gradient(ellipse at center, #1a0030 0%, #0a0010 60%, #000 100%);
        }

        /* ---------- COUNTDOWN ---------- */
        .extraction-countdown-wrap {
          text-align: center;
          animation: bounce-in 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .extraction-badge {
          display: inline-flex;
          align-items: center;
          gap: clamp(8px, 1vw, 16px);
          margin-bottom: clamp(16px, 3vh, 40px);
          padding: clamp(8px, 1.2vh, 18px) clamp(16px, 2vw, 32px);
          background: rgba(217,70,239,0.15);
          backdrop-filter: blur(20px);
          border-radius: 9999px;
          border: 2px solid #d946ef;
        }
        .extraction-badge-text {
          font-size: clamp(1rem, 2.5vw, 2rem);
          font-weight: 900;
          color: white;
          text-transform: uppercase;
          letter-spacing: 0.25em;
        }
        .extraction-zap {
          width: clamp(20px, 2.5vw, 40px);
          height: clamp(20px, 2.5vw, 40px);
          color: #facc15;
          animation: pulse 1s ease-in-out infinite;
        }
        .extraction-countdown-number {
          font-size: clamp(8rem, 30vw, 28rem);
          font-weight: 900;
          line-height: 1;
          background: linear-gradient(to bottom, #e879f9, #7c3aed);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: pulse-glow 1.5s ease-in-out infinite;
          position: relative;
          z-index: 1;
        }

        /* ---------- SLOT AREA ---------- */
        .extraction-slots-wrap {
          width: 90%;
          max-width: 900px;
          display: flex;
          flex-direction: column;
          gap: clamp(12px, 2vh, 28px);
        }
        .extraction-title {
          text-align: center;
          font-size: clamp(1.2rem, 3vw, 2.8rem);
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          background: linear-gradient(to right, #e879f9, #a855f7, #ec4899);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin-bottom: clamp(4px, 1vh, 16px);
          animation: bounce-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .extraction-card {
          background: rgba(0,0,0,0.5);
          backdrop-filter: blur(20px);
          border-radius: clamp(16px, 3vw, 40px);
          padding: clamp(12px, 2.5vh, 36px) clamp(16px, 3vw, 48px);
          border: 3px solid rgba(217,70,239,0.4);
          box-shadow: 0 0 60px rgba(217,70,239,0.25);
        }
        .extraction-card-song {
          border-color: rgba(168,85,247,0.4);
          box-shadow: 0 0 60px rgba(168,85,247,0.25);
          animation: bounce-in 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .extraction-card-header {
          display: flex;
          align-items: center;
          gap: clamp(8px, 1.2vw, 20px);
          margin-bottom: clamp(8px, 1.5vh, 20px);
        }
        .extraction-card-icon {
          width: clamp(24px, 3vw, 52px);
          height: clamp(24px, 3vw, 52px);
          color: #facc15;
          flex-shrink: 0;
        }
        .extraction-card-icon-song {
          color: #e879f9;
        }
        .extraction-card-label {
          font-size: clamp(0.9rem, 2vw, 1.8rem);
          font-weight: 900;
          color: white;
          text-transform: uppercase;
          letter-spacing: 0.15em;
        }

        /* ---------- SLOT REEL ---------- */
        .extraction-reel {
          width: 100%;
        }
        .extraction-reel-inner {
          display: flex;
          align-items: center;
          justify-content: center;
          transition: filter 0.3s, transform 0.3s;
        }
        .extraction-reel-inner.spinning {
          filter: blur(3px);
          transform: scale(0.97);
        }
        .extraction-reel-content {
          text-align: center;
          width: 100%;
        }
        .extraction-avatar {
          width: clamp(64px, 12vw, 140px);
          height: clamp(64px, 12vw, 140px);
          border-radius: 9999px;
          margin: 0 auto clamp(8px, 1.5vh, 20px);
          border: clamp(3px, 0.5vw, 7px) solid #d946ef;
          box-shadow: 0 0 40px rgba(217,70,239,0.6);
          object-fit: cover;
          display: block;
        }
        .extraction-avatar-icon {
          border-radius: clamp(12px, 2vw, 24px);
          background: linear-gradient(135deg, #c026d3, #7c3aed);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .extraction-avatar-letter {
          background: linear-gradient(135deg, #c026d3, #7c3aed);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: clamp(1.5rem, 6vw, 5rem);
          font-weight: 900;
          color: white;
        }
        .extraction-icon-inner {
          width: 55%;
          height: 55%;
          color: white;
        }
        .extraction-name {
          font-size: clamp(1.6rem, 5vw, 4.5rem);
          font-weight: 900;
          color: white;
          margin-bottom: clamp(4px, 0.5vh, 10px);
          text-shadow: 0 0 30px rgba(217,70,239,0.5);
          line-height: 1.1;
        }
        .extraction-artist {
          font-size: clamp(1rem, 2.5vw, 2.2rem);
          font-weight: 700;
          color: #e879f9;
        }

        /* ---------- CELEBRATION ---------- */
        .extraction-celebration {
          text-align: center;
          margin-top: clamp(8px, 2vh, 24px);
          animation: bounce-in 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .extraction-celebration-badge {
          display: inline-flex;
          align-items: center;
          gap: clamp(8px, 1.5vw, 24px);
          padding: clamp(10px, 1.5vh, 20px) clamp(20px, 3vw, 48px);
          background: linear-gradient(to right, #c026d3, #7c3aed);
          border-radius: 9999px;
          border: 3px solid rgba(255,255,255,0.2);
          box-shadow: 0 0 60px rgba(217,70,239,0.6);
        }
        .extraction-celebration-icon {
          width: clamp(20px, 2.5vw, 42px);
          height: clamp(20px, 2.5vw, 42px);
          color: #fde047;
          animation: pulse 1s ease-in-out infinite;
        }
        .extraction-celebration-text {
          font-size: clamp(1rem, 2.8vw, 2.5rem);
          font-weight: 900;
          color: white;
          text-transform: uppercase;
          letter-spacing: 0.1em;
        }

        /* ---------- BG GLOW ---------- */
        .extraction-glow {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 80vw;
          height: 80vw;
          max-width: 900px;
          max-height: 900px;
          background: rgba(217,70,239,0.12);
          border-radius: 9999px;
          filter: blur(120px);
          animation: pulse 3s ease-in-out infinite;
          pointer-events: none;
        }

        /* ---------- KEYFRAMES ---------- */
        @keyframes confetti {
          0%   { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
        .animate-confetti { animation: confetti linear forwards; }

        @keyframes pulse-glow {
          0%, 100% { filter: drop-shadow(0 0 20px rgba(217,70,239,0.4)); }
          50%       { filter: drop-shadow(0 0 60px rgba(217,70,239,0.9)); }
        }
        @keyframes bounce-in {
          0%   { transform: scale(0) rotate(-180deg); opacity: 0; }
          50%  { transform: scale(1.15) rotate(8deg); }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.6; }
        }
      `}</style>

      {/* Background glow */}
      <div className="extraction-glow" />
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-10 pointer-events-none" />

      {phase === 'celebration' && <Confetti />}

      <div style={{ position: 'relative', zIndex: 10, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

        {/* ---- FASE COUNTDOWN ---- */}
        {phase === 'countdown' && (
          <div className="extraction-countdown-wrap">
            <div className="extraction-badge">
              <Zap className="extraction-zap" />
              <span className="extraction-badge-text">Estrazione Casuale</span>
              <Zap className="extraction-zap" />
            </div>
            <div className="extraction-countdown-number">{countdown}</div>
          </div>
        )}

        {/* ---- FASE SPINNING / REVEAL / CELEBRATION ---- */}
        {(phase === 'spinning' || phase === 'reveal' || phase === 'celebration') && (
          <div className="extraction-slots-wrap">

            <div className="extraction-title">
              {phase === 'spinning' ? '🎰 Estrazione in corso...' : '✨ Ecco il vincitore!'}
            </div>

            {/* Card Cantante */}
            <div className="extraction-card">
              <div className="extraction-card-header">
                <Trophy className="extraction-card-icon" />
                <span className="extraction-card-label">Il Cantante</span>
              </div>
              <SlotReel
                items={participants || []}
                isSpinning={isSpinning}
                finalValue={participant}
                delay={0}
              />
            </div>

            {/* Card Canzone — appare dopo che il rullo si ferma */}
            {!isSpinning && (
              <div className="extraction-card extraction-card-song">
                <div className="extraction-card-header">
                  <Music2 className="extraction-card-icon extraction-card-icon-song" />
                  <span className="extraction-card-label">La Canzone</span>
                </div>
                <SlotReel
                  items={songs || []}
                  isSpinning={false}
                  finalValue={song}
                  delay={500}
                />
              </div>
            )}

            {/* Messaggio celebration */}
            {phase === 'celebration' && (
              <div className="extraction-celebration">
                <div className="extraction-celebration-badge">
                  <Sparkles className="extraction-celebration-icon" />
                  <span className="extraction-celebration-text">Preparati a cantare! 🎤</span>
                  <Sparkles className="extraction-celebration-icon" />
                </div>
              </div>
            )}

          </div>
        )}

      </div>
    </div>
  );
}