import React, { useEffect, useState } from 'react';

const FloatingReactions = ({ newReaction }) => {
  const [reactions, setReactions] = useState([]);

  useEffect(() => {
    if (newReaction) {
      const id = Date.now() + Math.random();
      const left = Math.floor(Math.random() * 80) + 10; 
      
      setReactions(prev => [...prev, { ...newReaction, id, left }]);

      setTimeout(() => {
        setReactions(prev => prev.filter(r => r.id !== id));
      }, 4000);
    }
  }, [newReaction]);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-[9999]">
      {reactions.map(r => (
        <div
          key={r.id}
          className="absolute flex flex-col items-center animate-float-up pointer-events-none"
          style={{ left: `${r.left}%`, bottom: '20%' }}
        >
          <span className="text-8xl drop-shadow-[0_5px_5px_rgba(0,0,0,0.8)] filter transition-transform">{r.emoji}</span>
          
          {r.nickname && (
            <span className="bg-black/80 text-white text-lg font-black px-4 py-1 rounded-full mt-2 border-2 border-white/30 shadow-[0_0_15px_rgba(0,0,0,0.8)] whitespace-nowrap z-50">
              {r.nickname}
            </span>
          )}
        </div>
      ))}
      <style>{`
        @keyframes float-up {
          0% { transform: translateY(0) scale(0.5); opacity: 0; }
          10% { opacity: 1; transform: translateY(-30px) scale(1.2); }
          80% { opacity: 1; }
          100% { transform: translateY(-90vh) scale(1.5); opacity: 0; }
        }
        .animate-float-up {
          animation: float-up 5s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default FloatingReactions;