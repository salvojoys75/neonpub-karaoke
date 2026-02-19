import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Trophy, Users, Zap, SkipForward, ChevronRight, X, Play, DollarSign } from 'lucide-react';

const PRIZE_LADDER = [100, 200, 500, 1000, 2000, 5000, 10000, 50000, 100000, 1000000];

// Rimuove 2 risposte sbagliate
function calc5050(options, correctIndex) {
    const wrong = options.map((_, i) => i).filter(i => i !== correctIndex);
    const toRemove = wrong.sort(() => Math.random() - 0.5).slice(0, 2);
    return toRemove;
}

export default function MillionairePanel({ eventId, participants, quizCatalog, onGameChange }) {
    const [game, setGame] = useState(null);
    const [loading, setLoading] = useState(false);
    const [showSetup, setShowSetup] = useState(false);
    const [selectedPlayer, setSelectedPlayer] = useState(null);
    const [selectedQuestions, setSelectedQuestions] = useState([]);
    const [removed5050, setRemoved5050] = useState([]);
    const [audienceVotes, setAudienceVotes] = useState({});
    const pollRef = useRef(null);

    // Poll game state
    useEffect(() => {
        if (!eventId) return;
        const load = async () => {
            const { data } = await api.getActiveMillionaireGame(eventId);
            if (data) {
                setGame(data);
                if (data.audience_votes) setAudienceVotes(data.audience_votes);
            }
        };
        load();
        pollRef.current = setInterval(load, 2000);
        return () => clearInterval(pollRef.current);
    }, [eventId]);

    const currentQ = game ? game.questions[game.current_question_index] : null;
    const currentPrize = game ? PRIZE_LADDER[game.current_question_index] : 0;
    const earnedPrize = game && game.current_question_index > 0 ? PRIZE_LADDER[game.current_question_index - 1] : 0;

    // ── SETUP ──────────────────────────────────────────────────
    const handleStartSetup = () => {
        // Auto-seleziona 10 domande casuali dal catalogo
        const textOnly = quizCatalog.filter(q => !q.media_type || q.media_type === 'text' || q.media_type === 'testo');
        const shuffled = [...textOnly].sort(() => Math.random() - 0.5).slice(0, 10);
        setSelectedQuestions(shuffled);
        setShowSetup(true);
    };

    const handleLaunch = async () => {
        if (!selectedPlayer) return toast.error('Seleziona un concorrente');
        if (selectedQuestions.length < 1) return toast.error('Nessuna domanda disponibile');
        setLoading(true);
        try {
            const { data } = await api.createMillionaireGame(eventId, selectedPlayer.id, selectedQuestions);
            await api.startMillionaireGame(data.id);
            setGame({ ...data, status: 'active', participants: selectedPlayer });
            setShowSetup(false);
            setRemoved5050([]);
            // Broadcast display
            await supabase.channel('tv_ctrl').send({ type: 'broadcast', event: 'control', payload: { command: 'prepare_millionaire', nickname: selectedPlayer.nickname } });
            toast.success('🎰 Gioco del Milionario avviato!');
            if (onGameChange) onGameChange();
        } catch (e) { toast.error(e.message); }
        finally { setLoading(false); }
    };

    // ── LIFELINES ──────────────────────────────────────────────
    const handle5050 = async () => {
        if (!game || game.lifeline_5050_used) return;
        await api.useLifeline5050(game.id);
        const removed = calc5050(currentQ.options, currentQ.correct_index);
        setRemoved5050(removed);
        // Broadcast
        await supabase.channel('tv_ctrl').send({ type: 'broadcast', event: 'control', payload: {
            command: 'millionaire_5050', removed
        }});
        toast.info('50/50 usato');
    };

    const handlePass = async () => {
        if (!game || game.lifeline_pass_used) return;
        const next = game.current_question_index + 1;
        await api.useLifelinePass(game.id, next);
        setGame(g => ({ ...g, lifeline_pass_used: true, current_question_index: next }));
        setRemoved5050([]);
        await supabase.channel('tv_ctrl').send({ type: 'broadcast', event: 'control', payload: { command: 'millionaire_update' }});
        toast.info('Domanda passata');
    };

    const handleAudience = async () => {
        if (!game || game.lifeline_audience_used) return;
        await api.startAudienceVote(game.id);
        setAudienceVotes({});
        await supabase.channel('tv_ctrl').send({ type: 'broadcast', event: 'control', payload: {
            command: 'millionaire_audience', gameId: game.id
        }});
        toast.info('Votazione pubblico aperta!');
    };

    const handleCloseAudience = async () => {
        await api.closeAudienceVote(game.id);
        await supabase.channel('tv_ctrl').send({ type: 'broadcast', event: 'control', payload: { command: 'millionaire_update' }});
    };

    // ── RISPOSTA ──────────────────────────────────────────────
    const handleAnswer = async (correct) => {
        if (!game) return;
        const nextIndex = game.current_question_index + 1;
        const prize = PRIZE_LADDER[game.current_question_index];
        await api.answerMillionaire(game.id, correct, nextIndex, prize);
        if (correct) {
            setRemoved5050([]);
            setGame(g => ({ ...g, current_question_index: nextIndex, current_prize: prize, status: nextIndex >= PRIZE_LADDER.length ? 'won' : 'active' }));
            await supabase.channel('tv_ctrl').send({ type: 'broadcast', event: 'control', payload: { command: 'millionaire_correct', prize }});
            if (nextIndex >= PRIZE_LADDER.length) toast.success('🏆 HA VINTO IL MILIONE!');
            else toast.success(`✅ Corretta! +${prize} punti`);
        } else {
            setGame(g => ({ ...g, status: 'lost' }));
            await supabase.channel('tv_ctrl').send({ type: 'broadcast', event: 'control', payload: { command: 'millionaire_wrong' }});
            toast.error('❌ Risposta sbagliata!');
        }
    };

    const handleRetire = async () => {
        if (!game) return;
        await api.retireMillionaire(game.id, earnedPrize, game.participant_id);
        setGame(g => ({ ...g, status: 'retired' }));
        await supabase.channel('tv_ctrl').send({ type: 'broadcast', event: 'control', payload: { command: 'millionaire_retire', prize: earnedPrize }});
        toast.success(`💰 Si è ritirato con ${earnedPrize} punti`);
    };

    const handleClose = async () => {
        if (game) {
            await supabase.from('millionaire_games').update({ status: 'archived' }).eq('id', game.id);
            await supabase.channel('tv_ctrl').send({ type: 'broadcast', event: 'control', payload: { command: 'clear_millionaire' }});
        }
        setGame(null);
        setShowSetup(false);
        setRemoved5050([]);
        if (onGameChange) onGameChange();
    };

    // ── SETUP UI ──────────────────────────────────────────────
    if (showSetup) return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-yellow-400 uppercase flex items-center gap-2">
                    <Trophy className="w-4 h-4" /> Chi vuol essere Milionario?
                </h3>
                <Button size="sm" variant="ghost" onClick={() => setShowSetup(false)}><X className="w-4 h-4" /></Button>
            </div>

            {/* Selezione concorrente */}
            <div>
                <p className="text-xs text-zinc-500 mb-2 uppercase tracking-wider">Scegli il concorrente</p>
                <div className="max-h-40 overflow-y-auto space-y-1 custom-scrollbar">
                    {(participants || []).map(p => (
                        <div key={p.id}
                            onClick={() => setSelectedPlayer(p)}
                            className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition ${selectedPlayer?.id === p.id ? 'bg-yellow-500/20 border border-yellow-500' : 'bg-zinc-900 hover:bg-zinc-800'}`}>
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center text-black font-black text-xs">
                                {p.nickname?.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-white font-bold text-sm">{p.nickname}</span>
                            <span className="text-zinc-500 text-xs ml-auto">{p.score || 0} pt</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Domande selezionate */}
            <div>
                <p className="text-xs text-zinc-500 mb-2 uppercase tracking-wider">{selectedQuestions.length} domande selezionate (casuali dal catalogo)</p>
                <div className="max-h-32 overflow-y-auto space-y-1 custom-scrollbar">
                    {selectedQuestions.map((q, i) => (
                        <div key={i} className="flex items-center gap-2 bg-zinc-900 rounded p-2 text-xs">
                            <span className="text-yellow-500 font-bold w-5">{i + 1}</span>
                            <span className="text-white truncate flex-1">{q.question}</span>
                            <span className="text-zinc-600 shrink-0">{PRIZE_LADDER[i]?.toLocaleString()}pt</span>
                        </div>
                    ))}
                </div>
            </div>

            <Button
                className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-black h-12"
                disabled={!selectedPlayer || loading}
                onClick={handleLaunch}
            >
                <Play className="w-5 h-5 mr-2" /> LANCIA IL GIOCO
            </Button>
        </div>
    );

    // ── NESSUN GIOCO ──────────────────────────────────────────
    if (!game || ['won','lost','retired','archived'].includes(game.status)) {
        if (game && ['won','lost','retired'].includes(game.status)) return (
            <div className="space-y-4">
                <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-6 text-center">
                    <div className="text-4xl mb-2">{game.status === 'won' ? '🏆' : game.status === 'retired' ? '💰' : '💥'}</div>
                    <h3 className="text-lg font-bold text-white mb-1">
                        {game.status === 'won' ? 'HA VINTO IL MILIONE!' : game.status === 'retired' ? 'Si è ritirato' : 'Ha perso'}
                    </h3>
                    <p className="text-yellow-400 font-black text-2xl mb-4">{game.current_prize?.toLocaleString()} punti</p>
                    <Button onClick={handleClose} className="w-full bg-zinc-700 hover:bg-zinc-600 font-bold">
                        Chiudi
                    </Button>
                </div>
            </div>
        );

        return (
            <div className="text-center py-8 space-y-3">
                <Trophy className="w-12 h-12 text-yellow-500 mx-auto opacity-40" />
                <p className="text-zinc-500 text-sm">Nessun gioco attivo</p>
                <Button className="bg-yellow-500 hover:bg-yellow-400 text-black font-black w-full h-12"
                    onClick={handleStartSetup} disabled={!quizCatalog?.length}>
                    <Trophy className="w-4 h-4 mr-2" /> NUOVO GIOCO
                </Button>
            </div>
        );
    }

    // ── GIOCO ATTIVO ──────────────────────────────────────────
    const q = currentQ;
    const totalVotes = Object.values(audienceVotes).reduce((a, b) => a + b, 0);
    const isAudienceOpen = game.status === 'lifeline_audience';

    return (
        <div className="space-y-3">
            {/* Header concorrente + montepremi */}
            <div className="bg-zinc-900 border border-yellow-500/30 rounded-lg p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center text-black font-black text-sm">
                        {game.participants?.nickname?.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-bold text-white text-sm">{game.participants?.nickname}</span>
                </div>
                <div className="text-right">
                    <div className="text-xs text-zinc-500">Domanda {game.current_question_index + 1}/10</div>
                    <div className="text-yellow-400 font-black text-lg">{currentPrize?.toLocaleString()} pt</div>
                </div>
            </div>

            {/* Domanda corrente */}
            {q && (
                <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-3">
                    <p className="text-white font-bold text-sm mb-3 leading-snug">{q.question}</p>
                    <div className="grid grid-cols-2 gap-2">
                        {q.options.map((opt, i) => {
                            const letter = ['A','B','C','D'][i];
                            const isRemoved = removed5050.includes(i);
                            const isCorrect = i === q.correct_index;
                            return (
                                <div key={i} className={`flex items-center gap-2 p-2 rounded-lg border text-xs transition ${
                                    isRemoved ? 'opacity-20 border-zinc-800 bg-zinc-950' :
                                    isCorrect ? 'border-green-500/50 bg-green-500/10' :
                                    'border-zinc-700 bg-zinc-800'
                                }`}>
                                    <span className={`font-black w-5 h-5 rounded flex items-center justify-center text-xs shrink-0 ${isCorrect ? 'bg-green-500 text-black' : 'bg-zinc-700 text-white'}`}>{letter}</span>
                                    <span className={isRemoved ? 'text-zinc-700' : 'text-white'}>{opt}</span>
                                    {/* Voti pubblico */}
                                    {Object.keys(audienceVotes).length > 0 && !isRemoved && (
                                        <span className="ml-auto text-yellow-400 font-bold shrink-0">
                                            {totalVotes > 0 ? Math.round(((audienceVotes[letter] || 0) / totalVotes) * 100) : 0}%
                                        </span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Lifelines */}
            <div className="grid grid-cols-3 gap-2">
                <Button size="sm" disabled={game.lifeline_5050_used} onClick={handle5050}
                    className={`h-9 text-xs font-bold ${game.lifeline_5050_used ? 'opacity-30 bg-zinc-800' : 'bg-blue-700 hover:bg-blue-600'}`}>
                    50/50
                </Button>
                <Button size="sm" disabled={game.lifeline_audience_used} onClick={isAudienceOpen ? handleCloseAudience : handleAudience}
                    className={`h-9 text-xs font-bold ${game.lifeline_audience_used && !isAudienceOpen ? 'opacity-30 bg-zinc-800' : isAudienceOpen ? 'bg-green-600 hover:bg-green-500 animate-pulse' : 'bg-purple-700 hover:bg-purple-600'}`}>
                    <Users className="w-3 h-3 mr-1" />{isAudienceOpen ? `Chiudi (${totalVotes})` : 'Pubblico'}
                </Button>
                <Button size="sm" disabled={game.lifeline_pass_used} onClick={handlePass}
                    className={`h-9 text-xs font-bold ${game.lifeline_pass_used ? 'opacity-30 bg-zinc-800' : 'bg-orange-700 hover:bg-orange-600'}`}>
                    <SkipForward className="w-3 h-3 mr-1" /> Passa
                </Button>
            </div>

            {/* Pulsanti risposta */}
            <div className="grid grid-cols-2 gap-2">
                <Button onClick={() => handleAnswer(true)} className="bg-green-600 hover:bg-green-500 font-black h-12">
                    ✅ CORRETTA
                </Button>
                <Button onClick={() => handleAnswer(false)} className="bg-red-600 hover:bg-red-500 font-black h-12">
                    ❌ SBAGLIATA
                </Button>
            </div>

            {/* Ritiro + Chiudi */}
            <div className="flex gap-2">
                <Button onClick={handleRetire} variant="outline" className="flex-1 border-yellow-600 text-yellow-400 hover:bg-yellow-900/20 text-xs h-8">
                    <DollarSign className="w-3 h-3 mr-1" /> Ritira ({earnedPrize?.toLocaleString()} pt)
                </Button>
                <Button onClick={handleClose} variant="ghost" className="text-zinc-600 hover:text-red-400 text-xs h-8">
                    <X className="w-3 h-3" />
                </Button>
            </div>
        </div>
    );
}