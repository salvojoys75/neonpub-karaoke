import React, { useEffect, useState } from 'react';

const FloatingReactions = ({ newReaction }) => {
  const [reactions, setReactions] = useState([]);

  useEffect(() => {
    if (newReaction) {
      const id = Date.now();
      // Posizione casuale orizzontale
      const left = Math.floor(Math.random() * 80) + 10;

      // 🔧 FIX: supporta sia { emoji, nickname } che il payload Supabase Realtime
      // Il payload Realtime ha: { emoji, nickname, participant_id, event_id, ... }
      const emoji = newReaction.emoji || newReaction.new?.emoji;
      const nickname = newReaction.nickname || newReaction.new?.nickname || null;

      if (!emoji) return; // ignora payload malformati

      setReactions(prev => [...prev, { emoji, nickname, id, left }]);

      // Rimuovi dopo animazione
      setTimeout(() => {
        setReactions(prev => prev.filter(r => r.id !== id));
      }, 4000);
    }
  }, [newReaction]);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-[60]">
      {reactions.map(r => (
        <div
          key={r.id}
          className="absolute bottom-0 flex flex-col items-center animate-float-up"
          style={{ left: `${r.left}%` }}
        >
          <span style={{ 
              fontSize: "4rem", 
              lineHeight: 1,
              fontFamily: '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif',
              display: 'inline-block'
            }} className="drop-shadow-lg">{r.emoji}</span>
          {r.nickname && (
            <span className="bg-black/50 text-white text-xs px-2 py-1 rounded-full mt-1 backdrop-blur-sm border border-white/20">
              {r.nickname}
            </span>
          )}
        </div>
      ))}
      <style>{`
        @keyframes float-up {
          0% { transform: translateY(100%) scale(0.5); opacity: 0; }
          10% { opacity: 1; transform: translateY(0) scale(1.2); }
          90% { opacity: 1; }
          100% { transform: translateY(-80vh) scale(1); opacity: 0; }
        }
        .animate-float-up {
          animation: float-up 4s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default FloatingReactions;