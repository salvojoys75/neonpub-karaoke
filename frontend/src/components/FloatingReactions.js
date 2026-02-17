import React, { useEffect, useState, useRef } from 'react';

const FloatingReactions = ({ newReaction }) => {
  const [reactions, setReactions] = useState([]);
  const lastUidRef = useRef(null);

  useEffect(() => {
    if (!newReaction?.emoji) return;

    // Evita di processare la stessa reazione due volte
    const uid = newReaction._uid || newReaction.id || Date.now();
    if (uid === lastUidRef.current) return;
    lastUidRef.current = uid;

    const left = Math.floor(Math.random() * 75) + 10;
    const rid = uid;

    setReactions(prev => [...prev, { emoji: newReaction.emoji, nickname: newReaction.nickname || null, rid, left }]);

    setTimeout(() => {
      setReactions(prev => prev.filter(r => r.rid !== rid));
    }, 4000);
  }, [newReaction]);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-[60]">
      {reactions.map(r => (
        <div
          key={r.rid}
          className="absolute bottom-0 flex flex-col items-center animate-float-up"
          style={{ left: `${r.left}%` }}
        >
          <span className="text-6xl drop-shadow-lg filter">{r.emoji}</span>
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