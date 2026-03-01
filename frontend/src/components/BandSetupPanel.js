import { useState, useEffect, useCallback } from 'react';
import * as api from '@/lib/api';

// Metadati strumenti
const INSTRUMENT_META = {
  keys:   { label: 'Tastiera', icon: '🎹', color: '#00d4ff' },
  drums:  { label: 'Batteria', icon: '🥁', color: '#ff3b5c' },
  bass:   { label: 'Basso',    icon: '🎸', color: '#39ff84' },
  brass:  { label: 'Fiati',    icon: '🎺', color: '#ffd100' },
  guitar: { label: 'Chitarra', icon: '🎸', color: '#ff8c00' },
};

export default function BandSetupPanel({ participants = [], onClose }) {
  const [songs, setSongs] = useState([]);
  const [selectedSong, setSelectedSong] = useState(null);
  const [manifest, setManifest] = useState(null);
  const [assignments, setAssignments] = useState({});
  const [gameStarted, setGameStarted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Carica lista canzoni
  useEffect(() => {
    fetch('/audio/band_songs.json')
      .then(r => r.json())
      .then(setSongs)
      .catch(() => setSongs([]));
  }, []);

  // Recovery: controlla se c'è già una sessione attiva
  useEffect(() => {
    const checkActive = async () => {
      try {
        const state = await api.getEventState();
        if (state?.active_module === 'band' && state?.active_band?.status === 'active') {
          setGameStarted(true);
          setSelectedSong({ id: state.active_band.song, title: state.active_band.songTitle });
          
          // Carica manifest per mostrare gli strumenti
          const manifestRes = await fetch(`/audio/${state.active_band.song}/manifest.json`);
          if (manifestRes.ok) {
            const m = await manifestRes.json();
            setManifest(m);
            
            // Ricostruisci assignments
            const ass = {};
            (state.active_band.assignments || []).forEach(a => {
              ass[a.instrument] = { userId: a.userId, nickname: a.nickname };
            });
            setAssignments(ass);
          }
        }
      } catch (e) {
        console.error('Recovery check error:', e);
      }
    };
    checkActive();
  }, []);

  // Carica manifest quando si seleziona una canzone
  useEffect(() => {
    if (!selectedSong) {
      setManifest(null);
      setAssignments({});
      return;
    }

    fetch(`/audio/${selectedSong.id}/manifest.json`)
      .then(r => r.json())
      .then(m => {
        setManifest(m);
        // Inizializza assignments vuoti
        const init = {};
        (m.instruments || []).forEach(i => {
          init[i.id] = null;
        });
        setAssignments(init);
      })
      .catch(() => {
        setManifest(null);
        setError('Errore caricamento manifest');
      });
  }, [selectedSong]);

  // Assegna partecipante a strumento
  const assign = useCallback((instrumentId, participant) => {
    setAssignments(prev => {
      const next = { ...prev };
      
      // Rimuovi questo partecipante da altri strumenti
      if (participant) {
        Object.keys(next).forEach(key => {
          if (next[key]?.odecluttererId === participant.id) {
            next[key] = null;
          }
        });
      }
      
      // Assegna al nuovo strumento
      next[instrumentId] = participant ? {
        userId: participant.id,
        nickname: participant.nickname
      } : null;
      
      return next;
    });
  }, []);

  // Avvia band
  const startBand = async () => {
    if (!selectedSong || !manifest) return;
    
    setLoading(true);
    setError(null);

    try {
      // Costruisci array assignments
      const assignmentsList = Object.entries(assignments)
        .filter(([_, p]) => p !== null)
        .map(([instrument, p]) => ({
          instrument,
          odecluttererId: p.userId,
          nickname: p.nickname
        }));

      if (assignmentsList.length === 0) {
        setError('Assegna almeno un musicista');
        setLoading(false);
        return;
      }

      await api.startBandSession(selectedSong.id, manifest.title || selectedSong.title, assignmentsList);
      setGameStarted(true);
    } catch (e) {
      setError(e.message || 'Errore avvio band');
    } finally {
      setLoading(false);
    }
  };

  // Ferma band
  const stopBand = async () => {
    setLoading(true);
    try {
      await api.stopBandSession();
      setGameStarted(false);
      setSelectedSong(null);
      setManifest(null);
      setAssignments({});
    } catch (e) {
      setError(e.message || 'Errore stop band');
    } finally {
      setLoading(false);
    }
  };

  // Set di userId già assegnati
  const assignedUserIds = new Set(
    Object.values(assignments)
      .filter(a => a !== null)
      .map(a => a.userId)
  );

  const assignmentCount = Object.values(assignments).filter(a => a !== null).length;
  const totalInstruments = manifest?.instruments?.length || 0;

  return (
    <div style={{
      padding: '20px',
      background: '#0a0a14',
      borderRadius: '12px',
      color: '#fff',
      fontFamily: "'JetBrains Mono', monospace",
      maxWidth: '500px',
      width: '100%'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px'
      }}>
        <h2 style={{ margin: 0, fontSize: '18px', color: '#ffd100' }}>🎸 BAND MODE</h2>
        {onClose && (
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#888',
              fontSize: '20px',
              cursor: 'pointer'
            }}
          >
            ×
          </button>
        )}
      </div>

      {gameStarted ? (
        // Band in corso
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎤</div>
          <div style={{ fontSize: '16px', color: '#39ff84', marginBottom: '8px' }}>
            BAND IN CORSO
          </div>
          <div style={{ fontSize: '14px', color: '#888', marginBottom: '24px' }}>
            {selectedSong?.title || 'Canzone in corso'}
          </div>
          <button
            onClick={stopBand}
            disabled={loading}
            style={{
              padding: '12px 32px',
              background: '#ff3b5c',
              border: 'none',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '14px',
              fontWeight: 'bold',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.5 : 1
            }}
          >
            {loading ? 'FERMANDO...' : 'FERMA BAND'}
          </button>
        </div>
      ) : (
        // Setup
        <>
          {/* Selezione canzone */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#888', marginBottom: '8px' }}>
              SELEZIONA CANZONE
            </label>
            <select
              value={selectedSong?.id || ''}
              onChange={(e) => {
                const s = songs.find(s => s.id === e.target.value);
                setSelectedSong(s || null);
              }}
              style={{
                width: '100%',
                padding: '12px',
                background: '#1a1a24',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '14px'
              }}
            >
              <option value="">-- Scegli una canzone --</option>
              {songs.map(s => (
                <option key={s.id} value={s.id}>{s.title} - {s.artist}</option>
              ))}
            </select>
          </div>

          {/* Assegnazione strumenti */}
          {manifest && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '12px'
              }}>
                <label style={{ fontSize: '12px', color: '#888' }}>
                  ASSEGNA STRUMENTI
                </label>
                <span style={{ fontSize: '12px', color: '#ffd100' }}>
                  {assignmentCount}/{totalInstruments}
                </span>
              </div>

              {manifest.instruments?.map(instr => {
                const meta = INSTRUMENT_META[instr.id] || {};
                const current = assignments[instr.id];

                return (
                  <div
                    key={instr.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px',
                      background: 'rgba(255,255,255,0.03)',
                      borderRadius: '8px',
                      marginBottom: '8px',
                      border: current ? `1px solid ${meta.color || '#fff'}40` : '1px solid transparent'
                    }}
                  >
                    <div style={{
                      fontSize: '24px',
                      width: '40px',
                      textAlign: 'center'
                    }}>
                      {meta.icon || '🎵'}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontSize: '13px',
                        fontWeight: 'bold',
                        color: meta.color || '#fff',
                        marginBottom: '4px'
                      }}>
                        {meta.label || instr.id}
                      </div>
                      <select
                        value={current?.userId || ''}
                        onChange={(e) => {
                          const p = participants.find(p => p.id === e.target.value);
                          assign(instr.id, p || null);
                        }}
                        style={{
                          width: '100%',
                          padding: '8px',
                          background: '#1a1a24',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: '6px',
                          color: '#fff',
                          fontSize: '13px'
                        }}
                      >
                        <option value="">-- Non assegnato --</option>
                        {participants.map(p => (
                          <option
                            key={p.id}
                            value={p.id}
                            disabled={assignedUserIds.has(p.id) && current?.userId !== p.id}
                          >
                            {p.nickname}
                            {assignedUserIds.has(p.id) && current?.userId !== p.id ? ' (assegnato)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Errore */}
          {error && (
            <div style={{
              padding: '12px',
              background: 'rgba(255,59,92,0.1)',
              border: '1px solid #ff3b5c',
              borderRadius: '8px',
              color: '#ff3b5c',
              fontSize: '13px',
              marginBottom: '16px'
            }}>
              {error}
            </div>
          )}

          {/* Bottone start */}
          <button
            onClick={startBand}
            disabled={loading || !selectedSong || assignmentCount === 0}
            style={{
              width: '100%',
              padding: '14px',
              background: (!selectedSong || assignmentCount === 0) ? '#333' : '#ffd100',
              border: 'none',
              borderRadius: '8px',
              color: (!selectedSong || assignmentCount === 0) ? '#666' : '#000',
              fontSize: '14px',
              fontWeight: 'bold',
              cursor: (!selectedSong || assignmentCount === 0 || loading) ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.5 : 1
            }}
          >
            {loading ? 'AVVIO IN CORSO...' : 'START BAND'}
          </button>
        </>
      )}
    </div>
  );
}
