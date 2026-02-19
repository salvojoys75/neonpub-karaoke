import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import api from '@/lib/api';

const PRIZE_LADDER = [100, 200, 500, 1000, 2000, 5000, 10000, 50000, 100000, 1000000];

const BG = {
    background: 'radial-gradient(ellipse at center, #0a0020 0%, #000510 60%, #000000 100%)',
};

const GOLD = 'linear-gradient(135deg, #f59e0b, #fbbf24, #f59e0b)';
const SILVER = 'linear-gradient(135deg, #6b7280, #9ca3af, #6b7280)';

export default function MillionaireMode({ game, onVote, participantId }) {
    const [removed5050, setRemoved5050] = useState([]);
    const [audienceOpen, setAudienceOpen] = useState(false);
    const [voted, setVoted] = useState(false);
    const [selectedVote, setSelectedVote] = useState(null);

    const isDisplay = !participantId; // display vs telefono

    const q = game?.questions?.[game.current_question_index];
    const prize = PRIZE_LADDER[game?.current_question_index] || 0;
    const earnedPrize = game?.current_question_index > 0 ? PRIZE_LADDER[game.current_question_index - 1] : 0;
    const votes = game?.audience_votes || {};
    const totalVotes = Object.values(votes).reduce((a, b) => a + b, 0);

    // Ricevi comandi broadcast (solo display)
    useEffect(() => {
        if (!isDisplay) return;
        const ch = supabase.channel('tv_ctrl_millionaire')
            .on('broadcast', { event: 'control' }, p => {
                if (p.payload.command === 'millionaire_5050') setRemoved5050(p.payload.removed || []);
                if (p.payload.command === 'millionaire_audience') setAudienceOpen(true);
                if (p.payload.command === 'millionaire_update') setRemoved5050([]);
                if (p.payload.command === 'millionaire_correct') setRemoved5050([]);
            })
            .subscribe();
        return () => supabase.removeChannel(ch);
    }, [isDisplay]);

    // Sync audience state
    useEffect(() => {
        if (game?.status === 'lifeline_audience') setAudienceOpen(true);
        else if (game?.status === 'active') setAudienceOpen(false);
    }, [game?.status]);

    const handleVote = async (letter) => {
        if (voted || !participantId) return;
        setSelectedVote(letter);
        setVoted(true);
        await api.submitAudienceVote(game.id, participantId, letter);
    };

    // ── SCHERMATA FINALE ──
    if (game?.status === 'won' || game?.status === 'lost' || game?.status === 'retired') {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center" style={BG}>
                <div style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
                    <div style={{ fontSize: '8rem', marginBottom: '16px' }}>
                        {game.status === 'won' ? '🏆' : game.status === 'retired' ? '💰' : '💥'}
                    </div>
                    <h1 style={{
                        fontFamily: "'Montserrat', sans-serif", fontWeight: 900,
                        fontSize: 'clamp(2rem, 6vw, 5rem)', color: '#fff',
                        marginBottom: '16px', textTransform: 'uppercase',
                    }}>
                        {game.status === 'won' ? 'Ha Vinto!' : game.status === 'retired' ? 'Si è Ritirato' : 'Ha Perso'}
                    </h1>
                    <div style={{
                        fontFamily: "'Montserrat', sans-serif", fontWeight: 900,
                        fontSize: 'clamp(2rem, 7vw, 6rem)',
                        background: GOLD, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                    }}>
                        {(game.current_prize || 0).toLocaleString()} pt
                    </div>
                    <div style={{ color: 'rgba(255,255,255,0.5)', marginTop: '12px', fontSize: '1.2rem', fontFamily: "'Montserrat', sans-serif" }}>
                        {game.participants?.nickname}
                    </div>
                </div>
            </div>
        );
    }

    // ── TELEFONO: VOTAZIONE PUBBLICO ──
    if (!isDisplay && audienceOpen && game?.status === 'lifeline_audience') {
        return (
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#fff', fontFamily: "'Montserrat', sans-serif" }}>
                        Aiuto del Pubblico
                    </div>
                    <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem', marginTop: '4px' }}>
                        {q?.question}
                    </div>
                </div>
                {q?.options.map((opt, i) => {
                    const letter = ['A','B','C','D'][i];
                    const isSelected = selectedVote === letter;
                    return (
                        <button key={i} onClick={() => handleVote(letter)} disabled={voted}
                            style={{
                                padding: '16px', borderRadius: '12px', border: 'none', cursor: voted ? 'default' : 'pointer',
                                background: isSelected ? 'linear-gradient(135deg, #7c3aed, #a855f7)' : 'rgba(255,255,255,0.08)',
                                color: '#fff', fontFamily: "'Montserrat', sans-serif", fontWeight: 700,
                                fontSize: '1rem', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '12px',
                                opacity: voted && !isSelected ? 0.5 : 1, transition: 'all 0.2s',
                            }}>
                            <span style={{
                                background: isSelected ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.15)',
                                borderRadius: '8px', width: '32px', height: '32px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontWeight: 900, flexShrink: 0,
                            }}>{letter}</span>
                            {opt}
                        </button>
                    );
                })}
                {voted && <div style={{ textAlign: 'center', color: '#4ade80', fontWeight: 700 }}>Voto registrato!</div>}
            </div>
        );
    }

    // ── DISPLAY PRINCIPALE ──
    if (isDisplay) return (
        <div className="w-full h-full flex" style={BG}>
            {/* Colonna sinistra — montepremi */}
            <div style={{
                width: '220px', flexShrink: 0, display: 'flex', flexDirection: 'column',
                justifyContent: 'center', padding: '20px 12px',
                borderRight: '1px solid rgba(255,255,255,0.08)',
            }}>
                {[...PRIZE_LADDER].reverse().map((p, ri) => {
                    const i = PRIZE_LADDER.length - 1 - ri;
                    const isCurrent = i === game?.current_question_index;
                    const isPassed = i < game?.current_question_index;
                    return (
                        <div key={i} style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            padding: '4px 8px', borderRadius: '8px', marginBottom: '2px',
                            background: isCurrent ? 'rgba(245,158,11,0.2)' : 'transparent',
                            border: isCurrent ? '1px solid rgba(245,158,11,0.5)' : '1px solid transparent',
                        }}>
                            <span style={{
                                fontFamily: "'Montserrat', sans-serif", fontSize: '0.7rem', fontWeight: 700,
                                color: isCurrent ? '#fbbf24' : isPassed ? '#4ade80' : 'rgba(255,255,255,0.3)',
                                minWidth: '16px',
                            }}>{i + 1}</span>
                            <span style={{
                                fontFamily: "'Montserrat', sans-serif", fontWeight: 900,
                                fontSize: isCurrent ? '1rem' : '0.8rem',
                                color: isCurrent ? '#fbbf24' : isPassed ? '#4ade80' : 'rgba(255,255,255,0.4)',
                                marginLeft: 'auto',
                            }}>{p.toLocaleString()}</span>
                            {isPassed && <span style={{ color: '#4ade80', fontSize: '0.7rem' }}>✓</span>}
                        </div>
                    );
                })}
            </div>

            {/* Contenuto principale */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px' }}>

                {/* Concorrente */}
                <div style={{ marginBottom: '20px', textAlign: 'center' }}>
                    <div style={{
                        fontFamily: "'Montserrat', sans-serif", fontWeight: 700,
                        color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem',
                        letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: '4px',
                    }}>Concorrente</div>
                    <div style={{
                        fontFamily: "'Montserrat', sans-serif", fontWeight: 900,
                        fontSize: 'clamp(1.5rem, 3vw, 2.5rem)', color: '#fff',
                    }}>{game?.participants?.nickname}</div>
                </div>

                {/* Montepremi corrente */}
                <div style={{
                    fontFamily: "'Montserrat', sans-serif", fontWeight: 900,
                    fontSize: 'clamp(1.2rem, 2.5vw, 2rem)',
                    background: GOLD, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                    marginBottom: '24px',
                }}>{prize.toLocaleString()} punti</div>

                {/* Domanda */}
                {q && (
                    <div style={{
                        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(245,158,11,0.3)',
                        borderRadius: '20px', padding: '24px 32px', maxWidth: '800px', width: '100%',
                        textAlign: 'center', marginBottom: '24px',
                        backdropFilter: 'blur(10px)',
                    }}>
                        <p style={{
                            fontFamily: "'Montserrat', sans-serif", fontWeight: 700,
                            fontSize: 'clamp(1.2rem, 2.5vw, 1.8rem)', color: '#fff', lineHeight: 1.4,
                        }}>{q.question}</p>
                    </div>
                )}

                {/* Opzioni */}
                {q && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', maxWidth: '800px', width: '100%' }}>
                        {q.options.map((opt, i) => {
                            const letter = ['A','B','C','D'][i];
                            const isRemoved = removed5050.includes(i);
                            const voteCount = votes[letter] || 0;
                            const pct = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
                            return (
                                <div key={i} style={{
                                    background: isRemoved ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.06)',
                                    border: isRemoved ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(245,158,11,0.25)',
                                    borderRadius: '14px', padding: '14px 18px',
                                    display: 'flex', alignItems: 'center', gap: '12px',
                                    opacity: isRemoved ? 0.2 : 1, transition: 'all 0.4s',
                                    position: 'relative', overflow: 'hidden',
                                }}>
                                    {/* Barra voti pubblico */}
                                    {totalVotes > 0 && !isRemoved && (
                                        <div style={{
                                            position: 'absolute', left: 0, top: 0, bottom: 0,
                                            width: `${pct}%`, background: 'rgba(139,92,246,0.25)',
                                            transition: 'width 0.5s ease',
                                        }} />
                                    )}
                                    <span style={{
                                        background: isRemoved ? 'rgba(255,255,255,0.05)' : 'rgba(245,158,11,0.3)',
                                        color: isRemoved ? 'rgba(255,255,255,0.2)' : '#fbbf24',
                                        borderRadius: '8px', width: '32px', height: '32px', flexShrink: 0,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontFamily: "'Montserrat', sans-serif", fontWeight: 900, fontSize: '1rem',
                                        position: 'relative', zIndex: 1,
                                    }}>{letter}</span>
                                    <span style={{
                                        fontFamily: "'Montserrat', sans-serif", fontWeight: 600,
                                        fontSize: 'clamp(0.85rem, 1.5vw, 1.1rem)',
                                        color: isRemoved ? 'rgba(255,255,255,0.1)' : '#fff',
                                        position: 'relative', zIndex: 1, flex: 1,
                                    }}>{opt}</span>
                                    {totalVotes > 0 && !isRemoved && (
                                        <span style={{
                                            fontFamily: "'Montserrat', sans-serif", fontWeight: 900,
                                            color: '#a78bfa', fontSize: '0.9rem', position: 'relative', zIndex: 1,
                                        }}>{pct}%</span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Lifelines usate */}
                <div style={{ display: 'flex', gap: '16px', marginTop: '20px' }}>
                    {[
                        { label: '50/50', used: game?.lifeline_5050_used },
                        { label: 'Pubblico', used: game?.lifeline_audience_used },
                        { label: 'Passa', used: game?.lifeline_pass_used },
                    ].map(({ label, used }) => (
                        <div key={label} style={{
                            fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: '0.8rem',
                            color: used ? 'rgba(255,255,255,0.2)' : 'rgba(245,158,11,0.8)',
                            textDecoration: used ? 'line-through' : 'none',
                            padding: '4px 10px', borderRadius: '8px',
                            border: `1px solid ${used ? 'rgba(255,255,255,0.1)' : 'rgba(245,158,11,0.3)'}`,
                        }}>{label}</div>
                    ))}
                </div>
            </div>
        </div>
    );

    // ── TELEFONO: IDLE ──
    return (
        <div style={{ padding: '24px', textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🎰</div>
            <div style={{ color: '#fff', fontWeight: 700, fontFamily: "'Montserrat', sans-serif" }}>
                Gioco del Milionario in corso
            </div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem', marginTop: '8px' }}>
                Aspetta l'aiuto del pubblico per votare
            </div>
        </div>
    );
}
