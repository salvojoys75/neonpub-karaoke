import React, { useEffect, useState } from 'react';

const FloatingReactions = ({ newReaction }) => {
  const [reactions, setReactions] = useState([]);

  useEffect(() => {
    if (newReaction) {
      const id = Date.now() + Math.random(); // ID unico più robusto
      // Posizione casuale orizzontale (margini 10% - 90%)
      const left = Math.floor(Math.random() * 80) + 10; 
      
      setReactions(prev => [...prev, { ...newReaction, id, left }]);

      // Rimuovi dopo animazione
      setTimeout(() => {
        setReactions(prev => prev.filter(r => r.id !== id));
      }, 4000);
    }
  }, [newReaction]);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-[200]">
      {reactions.map(r => (
        <div
          key={r.id}
          // MODIFICA: bottom-20 invece di bottom-0 per non tagliare il nickname
          className="absolute bottom-20 flex flex-col items-center animate-float-up"
          style={{ left: `${r.left}%` }}
        >
          {/* Emoji grande */}
          <span className="text-7xl drop-shadow-[0_5px_5px_rgba(0,0,0,0.5)] filter">{r.emoji}</span>
          
          {/* Nickname visibile con sfondo scuro */}
          {r.nickname && (
            <span className="bg-black/70 text-white text-sm font-bold px-3 py-1 rounded-full mt-2 backdrop-blur-md border border-white/20 shadow-lg whitespace-nowrap">
              {r.nickname}
            </span>
          )}
        </div>
      ))}
      <style>{`
        @keyframes float-up {
          0% { transform: translateY(0) scale(0.5); opacity: 0; }
          10% { opacity: 1; transform: translateY(-20px) scale(1.2); }
          90% { opacity: 1; }
          100% { transform: translateY(-80vh) scale(1.5); opacity: 0; }
        }
        .animate-float-up {
          animation: float-up 4s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default FloatingReactions;