import React, { useEffect, useState, useRef } from 'react';

const FloatingReactions = ({ newReaction }) => {
  const [reactions, setReactions] = useState([]);
  // Tiene traccia dell'ultimo id processato per evitare duplicati
  const lastIdRef = useRef(null);

  useEffect(() => {
    if (!newReaction || !newReaction.emoji) return;

    // Usa l'id univoco iniettato da PubDisplay (Date.now()) per evitare 
    // che lo stesso evento venga processato due volte
    const reactionId = newReaction.id || Date.now();
    if (lastIdRef.current === reactionId) return;
    lastIdRef.current = reactionId;

    const left = Math.floor(Math.random() * 75) + 10;

    setReactions(prev => [...prev, {
      ...newReaction,
      _id: reactionId,
      left
    }]);

    // Rimuovi dopo la durata dell'animazione
    setTimeout(() => {
      setReactions(prev => prev.filter(r => r._id !== reactionId));
    }, 4500);
  }, [newReaction]);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-[60]">
      {reactions.map(r => (
        <div
          key={r._id}
          className="absolute bottom-0 flex flex-col items-center animate-float-up"
          style={{ left: `${r.left}%` }}
        >
          <span className="text-6xl drop-shadow-lg">{r.emoji}</span>
          {r.nickname && (
            <span className="bg-black/60 text-white text-xs px-2 py-1 rounded-full mt-1 backdrop-blur-sm border border-white/20 font-medium">
              {r.nickname}
            </span>
          )}
        </div>
      ))}
      <style>{`
        @keyframes float-up {
          0%   { transform: translateY(0) scale(0.5); opacity: 0; }
          10%  { opacity: 1; transform: translateY(-5vh) scale(1.3); }
          80%  { opacity: 1; }
          100% { transform: translateY(-85vh) scale(1); opacity: 0; }
        }
        .animate-float-up {
          animation: float-up 4.5s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default FloatingReactions;