import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { startBandSession, stopBandSession, getEventState } from '@/lib/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

// Metadati strumenti
const INSTRUMENT_META = {
  keys:   { label: 'Tastiera',  icon: '🎹', color: '#00d4ff' },
  drums:  { label: 'Batteria',  icon: '🥁', color: '#ff3b5c' },
  bass:   { label: 'Basso',     icon: '🎸', color: '#39ff84' },
  brass:  { label: 'Fiati',     icon: '🎺', color: '#ffd100' },
  guitar: { label: 'Chitarra',  icon: '🎸', color: '#ff8c00' },
};

const START_DELAY = 4000;

// Props: pubCode, participants, onClose
// songPool NON serve più — le canzoni vengono da /audio/band_songs.json
export default function BandSetupPanel({ pubCode, participants = [], onClose }) {
  // ── Canzoni disponibili (da band_songs.json) ────────────────────────────
  const [bandSongs,      setBandSongs]      = useState([]);
  const [loadingSongs,   setLoadingSongs]   = useState(true);

  // ── Stato selezione canzone ─────────────────────────────────────────────
  const [selectedSong,    setSelectedSong]    = useState(null);
  const [manifest,        setManifest]        = useState(null);
  const [loadingManifest, setLoadingManifest] = useState(false);
  const [manifestError,   setManifestError]   = useState(null);

  // ── Stato assegnazioni ──────────────────────────────────────────────────
  const [assignments, setAssignments] = useState({});

  // ── Stato broadcast ─────────────────────────────────────────────────────
  const [gameStarted, setGameStarted] = useState(false);
  const [sending,     setSending]     = useState(false);

  // ── Polling continuo: gameStarted sempre sincronizzato col DB ────────────
  // Ogni 2s rilegge lo stato band. Così anche se il pannello viene smontato
  // e rimontato (navigazione), i controlli STOP/START sono sempre corretti.
  useEffect(() => {
    const syncState = async () => {
      try {
        const state = await getEventState();
        const ab = (state?.active_module === 'band') ? state?.active_band : null;
        const isActive = ab?.status === 'active';

        setGameStarted(isActive);

        if (isActive && ab.song) {
          // Ripristina manifest e assegnazioni se non già caricati
          setSelectedSong(prev => prev?.id === ab.song ? prev : { id: ab.song, title: ab.songTitle || ab.song, artist: '' });
          if (!manifest || manifest._song !== ab.song) {
            fetch(`/audio/${ab.song}/manifest.json`)
              .then(r => r.ok ? r.json() : null)
              .then(data => {
                if (!data) return;
                data._song = ab.song; // marker per evitare reload inutili
                setManifest(data);
                const restored = {};
                (data.instruments || []).forEach(instr => {
                  const found = (ab.assignments || []).find(a => a.instrument === instr.id);
                  restored[instr.id] = found ? { userId: found.userId, nickname: found.nickname } : null;
                });
                setAssignments(restored);
              })
              .catch(() => {});
          }
        }
      } catch { /* silenzioso */ }
    };

    syncState(); // subito al mount
    const interval = setInterval(syncState, 2000);
    return () => clearInterval(interval);
  }, [manifest]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Carica band_songs.json all'apertura ────────────────────────────────
  useEffect(() => {
    fetch('/audio/band_songs.json')
      .then(r => {
        if (!r.ok) throw new Error('band_songs.json non trovato');
        return r.json();
      })
      .then(data => setBandSongs(data || []))
      .catch(() => setBandSongs([]))
      .finally(() => setLoadingSongs(false));
  }, []);

  // ── Carica manifest.json quando si seleziona una canzone ────────────────
  useEffect(() => {
    if (!selectedSong) { setManifest(null); return; }

    const folder = selectedSong.id;
    setLoadingManifest(true);
    setManifestError(null);
    setAssignments({});
    setGameStarted(false);

    fetch(`/audio/${folder}/manifest.json`)
      .then(r => {
        if (!r.ok) throw new Error(`manifest.json non trovato in /audio/${folder}/`);
        return r.json();
      })
      .then(data => {
        setManifest(data);
        // Inizializza assignments vuoti per ogni strumento
        const init = {};
        (data.instruments || []).forEach(i => { init[i.id] = null; });
        setAssignments(init);
      })
      .catch(err => {
        setManifestError(err.message);
        setManifest(null);
      })
      .finally(() => setLoadingManifest(false));
  }, [selectedSong]);

  // ── Assegna partecipante a strumento ───────────────────────────────────
  const assign = useCallback((instrumentId, participant) => {
    setAssignments(prev => {
      // Rimuovi lo stesso participant da eventuali altri strumenti
      const cleaned = {};
      Object.entries(prev).forEach(([k, v]) => {
        cleaned[k] = (v && v.userId === participant?.id) ? null : v;
      });
      cleaned[instrumentId] = participant
        ? { userId: participant.id, nickname: participant.nickname }
        : null;
      return cleaned;
    });
  }, []);

  // ── Partecipanti già assegnati (per grayout) ────────────────────────────
  const assignedUserIds = new Set(
    Object.values(assignments)
      .filter(Boolean)
      .map(a => a.userId)
  );

  const assignmentCount = Object.values(assignments).filter(Boolean).length;

  // ── START BAND — unico click che scrive DB + broadcast ────────────────
  const startBand = useCallback(async () => {
    if (!manifest || assignmentCount === 0 || sending) return;
    setSending(true);

    // Costruisce array assignments nel formato che serve a tutti i componenti
    const assignmentsList = Object.entries(assignments)
      .filter(([, v]) => v !== null)
      .map(([instrumentId, v]) => ({
        instrument: instrumentId,
        userId:     v.userId,
        nickname:   v.nickname,
      }));

    try {
      await startBandSession(selectedSong.id, manifest.title, assignmentsList);
      setGameStarted(true);
      toast.success('🎸 BAND PARTITA!');
    } catch (err) {
      toast.error('Errore: ' + err.message);
    } finally {
      setSending(false);
    }
  }, [manifest, assignments, assignmentCount, selectedSong, sending]);

  // ── STOP BAND ──────────────────────────────────────────────────────────
  const stopBand = useCallback(async () => {
    try {
      await stopBandSession();
      setGameStarted(false);
      setSelectedSong(null);
      setManifest(null);
      setAssignments({});
      toast.success('⏹ Band fermata');
    } catch (err) {
      toast.error('Errore stop: ' + err.message);
    }
  }, []);

  const reset = () => {
    setSelectedSong(null);
    setManifest(null);
    setAssignments({});
    setGameStarted(false);
  };

  // ══════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════
  return (
    <div style={{
      background: '#0d0d1a',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: '16px',
      padding: '24px',
      color: '#fff',
      fontFamily: "'JetBrains Mono', monospace",
      maxWidth: '560px',
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      gap: '20px',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '22px' }}>🎸</span>
          <div>
            <div style={{ fontSize: '16px', fontWeight: 900, color: '#ffd100' }}>BAND SETUP</div>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.2em' }}>
              {participants.length} PARTECIPANTI CONNESSI
            </div>
          </div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: '18px' }}>✕</button>
      </div>

      {/* Step 1: Selezione canzone */}
      <Section label="1 — CANZONE" icon="🎵">
        <select
          value={selectedSong?.id || ''}
          onChange={e => {
            const s = bandSongs.find(s => s.id === e.target.value);
            setSelectedSong(s || null);
          }}
          style={{
            width: '100%',
            background: '#171728',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '8px',
            color: '#fff',
            padding: '10px 14px',
            fontSize: '13px',
            fontFamily: "'JetBrains Mono', monospace",
            outline: 'none',
            cursor: 'pointer',
          }}
        >
          <option value="">
            {loadingSongs ? '⏳ Carico canzoni...' : bandSongs.length === 0 ? '⚠️ Nessuna canzone trovata' : '— Seleziona canzone —'}
          </option>
          {bandSongs.map(s => (
            <option key={s.id} value={s.id}>
              {s.title} — {s.artist}
            </option>
          ))}
        </select>

        {loadingManifest && (
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginTop: '8px' }}>
            ⏳ Carico strumenti disponibili...
          </div>
        )}
        {manifestError && (
          <div style={{ fontSize: '11px', color: '#ff3b5c', marginTop: '8px' }}>
            ⚠️ {manifestError}
          </div>
        )}
        {manifest && !loadingManifest && (
          <div style={{ fontSize: '11px', color: '#39ff84', marginTop: '8px' }}>
            ✅ {manifest.instruments?.length || 0} strumenti disponibili · {manifest.bpm} BPM
          </div>
        )}
      </Section>

      {/* Step 2: Assegnazione strumenti */}
      {manifest && (
        <Section label="2 — ASSEGNA STRUMENTI" icon="🎹">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {manifest.instruments.map(instr => {
              const meta    = INSTRUMENT_META[instr.id] || { label: instr.label, icon: instr.icon || '🎵', color: instr.color || '#fff' };
              const current = assignments[instr.id];

              return (
                <div key={instr.id} style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  background: 'rgba(255,255,255,0.03)',
                  border: `1px solid ${current ? meta.color + '44' : 'rgba(255,255,255,0.06)'}`,
                  borderRadius: '10px',
                  padding: '10px 14px',
                  transition: 'border-color 0.2s',
                }}>
                  {/* Icona strumento */}
                  <div style={{ fontSize: '24px', flexShrink: 0 }}>{meta.icon}</div>

                  {/* Nome strumento */}
                  <div style={{ flex: '0 0 80px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: meta.color }}>{meta.label}</div>
                    <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.2)', letterSpacing: '0.15em' }}>{instr.id.toUpperCase()}</div>
                  </div>

                  {/* Dropdown partecipanti */}
                  <select
                    value={current?.userId || ''}
                    onChange={e => {
                      const p = participants.find(p => String(p.id) === e.target.value);
                      assign(instr.id, p || null);
                    }}
                    disabled={gameStarted}
                    style={{
                      flex: 1,
                      background: '#101020',
                      border: `1px solid ${current ? meta.color + '66' : 'rgba(255,255,255,0.1)'}`,
                      borderRadius: '6px',
                      color: current ? '#fff' : 'rgba(255,255,255,0.3)',
                      padding: '6px 10px',
                      fontSize: '12px',
                      fontFamily: "'JetBrains Mono', monospace",
                      outline: 'none',
                      cursor: gameStarted ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <option value="">— nessuno —</option>
                    {participants.map(p => (
                      <option
                        key={p.id}
                        value={p.id}
                        disabled={assignedUserIds.has(p.id) && current?.userId !== p.id}
                        style={{ color: assignedUserIds.has(p.id) && current?.userId !== p.id ? '#555' : '#fff' }}
                      >
                        {p.nickname}
                        {assignedUserIds.has(p.id) && current?.userId !== p.id ? ' (già assegnato)' : ''}
                      </option>
                    ))}
                  </select>

                  {/* Badge assegnato */}
                  {current && (
                    <div style={{
                      fontSize: '10px', fontWeight: 700,
                      color: meta.color,
                      background: meta.color + '18',
                      border: `1px solid ${meta.color}44`,
                      borderRadius: '4px',
                      padding: '2px 6px',
                      flexShrink: 0,
                    }}>✓</div>
                  )}
                </div>
              );
            })}
          </div>

          {participants.length === 0 && (
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)', marginTop: '8px', textAlign: 'center' }}>
              ⚠️ Nessun partecipante connesso. Fai entrare il pubblico prima.
            </div>
          )}
        </Section>
      )}

      {/* Step 3: Azioni */}
      {manifest && (
        <Section label="3 — AZIONI" icon="🚀">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

            {/* Riepilogo assegnazioni */}
            <div style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '8px',
              padding: '10px 14px',
              fontSize: '11px',
              color: 'rgba(255,255,255,0.4)',
              lineHeight: 1.7,
            }}>
              {manifest.instruments.map(instr => {
                const meta    = INSTRUMENT_META[instr.id] || {};
                const current = assignments[instr.id];
                return (
                  <div key={instr.id} style={{ display: 'flex', gap: '8px' }}>
                    <span>{meta.icon || '🎵'}</span>
                    <span style={{ color: current ? (meta.color || '#fff') : 'rgba(255,255,255,0.2)' }}>
                      {meta.label || instr.id}: {current ? current.nickname : '—'}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Pulsante START BAND — unico, fa tutto */}
            {!gameStarted && (
              <button
                onClick={startBand}
                disabled={assignmentCount === 0 || sending}
                style={{
                  padding: '16px',
                  fontSize: '16px',
                  fontWeight: 900,
                  letterSpacing: '0.2em',
                  background: assignmentCount > 0 ? '#ffd10022' : '#111',
                  border: `3px solid ${assignmentCount > 0 ? '#ffd100' : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: '12px',
                  color: assignmentCount > 0 ? '#ffd100' : 'rgba(255,255,255,0.2)',
                  cursor: assignmentCount > 0 && !sending ? 'pointer' : 'not-allowed',
                  fontFamily: "'JetBrains Mono', monospace",
                  boxShadow: assignmentCount > 0 ? '0 0 30px rgba(255,209,0,0.2)' : 'none',
                  animation: assignmentCount > 0 ? 'pulse 1.5s ease-in-out infinite' : 'none',
                }}
              >
                {sending ? '⏳ AVVIO...' : `▶ START BAND 🎸 (${assignmentCount}/${manifest.instruments.length})`}
              </button>
            )}

            {gameStarted && (
              <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                <div style={{
                  textAlign: 'center', padding: '14px',
                  background: '#39ff8415', border: '2px solid #39ff84',
                  borderRadius: '10px', color: '#39ff84',
                  fontSize: '14px', fontWeight: 900, letterSpacing: '0.2em',
                }}>
                  🎶 BAND IN CORSO!
                </div>
                <button
                  onClick={stopBand}
                  style={{
                    padding: '10px', fontSize: '12px', fontWeight: 700,
                    background: '#ff3b5c18', border: '1px solid #ff3b5c66',
                    borderRadius: '8px', color: '#ff3b5c', cursor: 'pointer',
                    fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.15em',
                  }}
                >
                  ⏹ FERMA BAND
                </button>
              </div>
            )}

            {/* Reset */}
            {!gameStarted && (
              <button
                onClick={reset}
                style={{
                  padding: '8px',
                  fontSize: '11px',
                  background: 'none',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '6px',
                  color: 'rgba(255,255,255,0.3)',
                  cursor: 'pointer',
                  fontFamily: "'JetBrains Mono', monospace",
                  letterSpacing: '0.15em',
                }}
              >
                ↺ RESET NUOVA BAND
              </button>
            )}
          </div>
        </Section>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 20px rgba(255,209,0,0.2); }
          50%       { box-shadow: 0 0 40px rgba(255,209,0,0.5); }
        }
      `}</style>
    </div>
  );
}

// ── Componente Section helper ─────────────────────────────────────────────────
function Section({ label, icon, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '14px' }}>{icon}</span>
        <span style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.3em' }}>
          {label}
        </span>
      </div>
      {children}
    </div>
  );
}