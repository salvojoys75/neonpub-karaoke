import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '@/lib/supabase';
import api from '@/lib/api';
import { Music, Mic2, Star, Trophy, Users, MessageSquare, Disc, Zap, Megaphone } from 'lucide-react';

import ArcadeMode from '@/components/ArcadeMode';
import KaraokePlayer from '@/components/KaraokePlayer';
import FloatingReactions from '@/components/FloatingReactions';
import ExtractionMode from '@/components/ExtractionMode';

// ─────────────────────────────────────────────────────────────────────────────
// MEDIA ORCHESTRATOR
// Gestisce sigla, applausi, estrazione, transizioni e sottofondo
// FILE ATTESI in /public/media/ :
//   sigla.mp4, applausi.mp3, estrazione.mp4, transizione.mp4, sottofondo.mp3
// ─────────────────────────────────────────────────────────────────────────────

function getActiveMode(data) {
  if (!data) return 'loading';
  const { current_performance: perf, active_quiz: quiz, extraction_data } = data;
  const arcade = data.active_arcade;
  if (extraction_data) return 'extraction';
  const isQuiz   = quiz && ['active', 'closed', 'showing_results', 'leaderboard'].includes(quiz.status);
  const isArcade = (arcade && ['active', 'paused'].includes(arcade.status)) || !!data.arcade_result;
  const isKaraoke = !isQuiz && !isArcade && perf && ['live', 'paused'].includes(perf.status);
  const isVoting  = !isQuiz && !isArcade && perf && perf.status === 'voting';
  const isScore   = !isQuiz && !isArcade && perf && perf.status === 'ended';
  if (isQuiz)   return 'quiz';
  if (isArcade) return 'arcade';
  if (isKaraoke || isVoting) return 'karaoke';
  if (isScore)  return 'score';
  return 'idle';
}

function useMediaOrchestrator(data) {
  const [overlay, setOverlay]       = useState(null);
  const prevDataRef    = useRef(null);
  const prevModeRef    = useRef(null);
  const siglaShownRef  = useRef(false);
  const subfontoRef    = useRef(null);
  const dismissTimerRef = useRef(null);
  const isFirstDataRef  = useRef(true);
  const overlayActiveRef = useRef(false);
  const sottofondoMutedRef = useRef(false);

  const dismiss = useCallback(() => {
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    overlayActiveRef.current = false;
    setOverlay(null);
  }, []);

  const trigger = useCallback((key, autoDismissMs = null) => {
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    overlayActiveRef.current = true;
    setOverlay({ key, triggeredAt: Date.now() });
    if (autoDismissMs) {
      dismissTimerRef.current = setTimeout(() => {
        overlayActiveRef.current = false;
        setOverlay(null);
      }, autoDismissMs);
    }
  }, []);

  const startSottofondo = useCallback(() => {
    if (subfontoRef.current) return;
    const audio = new Audio('/media/sottofondo.mp3');
    audio.loop   = true;
    audio.volume = 0.22;
    audio.play().catch(() => {});
    subfontoRef.current = audio;
  }, []);

  const stopSottofondo = useCallback(() => {
    if (!subfontoRef.current) return;
    const audio = subfontoRef.current;
    subfontoRef.current = null;
    let vol = audio.volume;
    const fade = setInterval(() => {
      vol = Math.max(0, vol - 0.04);
      audio.volume = vol;
      if (vol <= 0) { clearInterval(fade); audio.pause(); }
    }, 80);
  }, []);

  const stopSottofondoImmediate = useCallback(() => {
    if (!subfontoRef.current) return;
    subfontoRef.current.pause();
    subfontoRef.current = null;
  }, []);

  useEffect(() => {
    if (!data) return;
    const curr     = data;
    const prev     = prevDataRef.current;
    const currMode = getActiveMode(curr);
    const prevMode = prevModeRef.current;

    // 1. SIGLA — NON parte automaticamente, solo dalla regia manualmente
    if (isFirstDataRef.current) {
      isFirstDataRef.current = false;
      prevDataRef.current = curr;
      prevModeRef.current = currMode;
      return;
    }

    // 2. ESTRAZIONE — ExtractionMode gestisce tutto da solo, nessun video necessario
    // (il componente ha già countdown, drumroll, reveal e celebration integrati)
    const extractionAppeared = !prev?.extraction_data && curr.extraction_data;
    if (extractionAppeared) {
      stopSottofondo(); // ferma musica di sottofondo durante l'estrazione
      prevDataRef.current = curr;
      prevModeRef.current = currMode;
      return;
    }

    // 3. FINE ESIBIZIONE → applausi
    const prevPerf = prev?.current_performance;
    const currPerf = curr.current_performance;
    const perfFinita =
      prevPerf &&
      !['ended'].includes(prevPerf.status) &&
      currPerf?.status === 'ended';
    if (perfFinita) {
      stopSottofondo();
      trigger('applausi', 7000);
      prevDataRef.current = curr;
      prevModeRef.current = currMode;
      return;
    }

    // 4. CAMBIO MODULO → transizione audio
    const MODULI = ['quiz', 'arcade', 'karaoke', 'idle'];
    const moduloCambiato =
      prevMode !== null &&
      prevMode !== currMode &&
      MODULI.includes(prevMode) &&
      MODULI.includes(currMode) &&
      prevMode !== 'score';
    if (moduloCambiato) {
      stopSottofondo();
      trigger('transizione', 3000);
      prevDataRef.current = curr;
      prevModeRef.current = currMode;
      return;
    }

    // 5. IDLE → sottofondo
    if (currMode === 'idle' && !overlayActiveRef.current && !sottofondoMutedRef.current) {
      startSottofondo();
    } else if (currMode !== 'idle') {
      sottofondoMutedRef.current = false;
      stopSottofondo();
    }

    prevDataRef.current = curr;
    prevModeRef.current = currMode;
  }, [data, trigger, startSottofondo, stopSottofondo]);

  useEffect(() => {
    return () => {
      stopSottofondo();
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, [stopSottofondo]);

  // triggerManual: usato dalla regia per lanciare effetti a mano
  const triggerManual = useCallback((key) => {
    if (key === 'stop_sottofondo') {
      sottofondoMutedRef.current = true;
      stopSottofondoImmediate();
      return;
    }
    if (key === 'start_sottofondo') {
      sottofondoMutedRef.current = false;
      startSottofondo();
      return;
    }
    stopSottofondoImmediate();
    trigger(key, key === 'applausi' ? 7000 : null);
  }, [trigger, stopSottofondoImmediate, startSottofondo]);

  return { overlay, dismissOverlay: dismiss, triggerManual };
}

// ─────────────────────────────────────────────────────────────────────────────
// MEDIA OVERLAY COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

const MEDIA_OVERLAY_STYLES = `
  @keyframes celebrationFadeInOut {
    0%   { opacity: 0; }
    10%  { opacity: 1; }
    80%  { opacity: 1; }
    100% { opacity: 0; }
  }
  @keyframes confettiFall {
    0%   { transform: translateY(-10vh) rotate(0deg); opacity: 1; }
    100% { transform: translateY(115vh) rotate(720deg); opacity: 0; }
  }
  @keyframes celebrationPop {
    0%   { transform: scale(0) rotate(-20deg); opacity: 0; }
    40%  { transform: scale(1.3) rotate(8deg);  opacity: 1; }
    100% { transform: scale(1)   rotate(0deg);  opacity: 1; }
  }

  /* ── SIGLA ANIMATIONS ── */
  @keyframes siglaZoomIn {
    0%   { transform: scale(0.2); opacity: 0; filter: blur(20px); }
    60%  { transform: scale(1.08); opacity: 1; filter: blur(0px); }
    100% { transform: scale(1); opacity: 1; filter: blur(0px); }
  }
  @keyframes siglaSlideLeft {
    0%   { transform: translateX(-120%); opacity: 0; }
    60%  { transform: translateX(6px); opacity: 1; }
    100% { transform: translateX(0); opacity: 1; }
  }
  @keyframes siglaSlideRight {
    0%   { transform: translateX(120%); opacity: 0; }
    60%  { transform: translateX(-6px); opacity: 1; }
    100% { transform: translateX(0); opacity: 1; }
  }
  @keyframes siglaFadeUp {
    0%   { transform: translateY(40px); opacity: 0; }
    100% { transform: translateY(0);    opacity: 1; }
  }
  @keyframes siglaFlashBoom {
    0%   { transform: scale(0.5); opacity: 0; }
    20%  { transform: scale(1.25); opacity: 1; }
    40%  { transform: scale(0.95); }
    60%  { transform: scale(1.06); }
    100% { transform: scale(1); opacity: 1; }
  }
  @keyframes siglaWhiteFlash {
    0%   { opacity: 0; }
    10%  { opacity: 0.85; }
    40%  { opacity: 0; }
    100% { opacity: 0; }
  }
  @keyframes siglaPulse {
    0%,100% { text-shadow: 0 0 30px rgba(217,70,239,0.8), 0 0 60px rgba(217,70,239,0.4); }
    50%     { text-shadow: 0 0 60px rgba(217,70,239,1),   0 0 120px rgba(217,70,239,0.7), 0 0 200px rgba(168,85,247,0.5); }
  }
  @keyframes siglaGoldenPulse {
    0%,100% { text-shadow: 0 0 30px rgba(251,191,36,0.8), 0 0 60px rgba(251,191,36,0.4); }
    50%     { text-shadow: 0 0 80px rgba(251,191,36,1),   0 0 150px rgba(251,191,36,0.8); }
  }
  @keyframes siglaLetterPop {
    0%   { transform: scale(0) translateY(20px); opacity: 0; }
    70%  { transform: scale(1.2) translateY(-4px); opacity: 1; }
    100% { transform: scale(1)   translateY(0);   opacity: 1; }
  }
  @keyframes siglaLineGrow {
    0%   { width: 0; opacity: 0; }
    100% { width: 100%; opacity: 1; }
  }
  @keyframes siglaBgPulse {
    0%,100% { opacity: 0.3; }
    50%     { opacity: 0.6; }
  }
  @keyframes siglaFinaleGlow {
    0%   { opacity: 0; transform: scale(0.8); }
    30%  { opacity: 1; transform: scale(1.05); }
    70%  { opacity: 1; transform: scale(1); }
    100% { opacity: 0; transform: scale(1.1); }
  }
`;

// ── Componente sigla con testi sincronizzati ───────────────────────────────
function SiglaOverlay({ onDismiss, pubData }) {
  const videoRef = useRef(null);
  const [elapsed, setElapsed] = useState(0);
  const [flashActive, setFlashActive] = useState(false);
  const timerRef = useRef(null);

  const nomLocale    = pubData?.pub?.name || 'DiscoJoys';
  const nomeEvento   = pubData?.pub?.event_name || pubData?.pub?.name || 'DiscoJoys Night';
  const nPartecipanti = pubData?.leaderboard?.length || 0;
  const dataOggi     = new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  // Timer sincronizzato al video
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => onDismiss());
    }
    timerRef.current = setInterval(() => {
      if (videoRef.current) setElapsed(videoRef.current.currentTime);
    }, 50);
    return () => clearInterval(timerRef.current);
  }, [onDismiss]);

  // Flash bianco a 00:58
  useEffect(() => {
    if (elapsed >= 58 && elapsed < 58.5 && !flashActive) {
      setFlashActive(true);
      setTimeout(() => setFlashActive(false), 600);
    }
  }, [elapsed, flashActive]);

  // Visibilità dei blocchi di testo
  const show15  = elapsed >= 15  && elapsed < 22;
  const show22  = elapsed >= 22  && elapsed < 30;
  const show30  = elapsed >= 30  && elapsed < 38;
  const show38  = elapsed >= 38  && elapsed < 46;
  const show46  = elapsed >= 46  && elapsed < 56;
  const show58  = elapsed >= 58  && elapsed < 63;
  const show101 = elapsed >= 61  && elapsed < 68;

  return (
    <>
      <style>{MEDIA_OVERLAY_STYLES}</style>

      {/* Flash bianco al momento d'impatto 00:58 */}
      {flashActive && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9600,
          background: 'white',
          animation: 'siglaWhiteFlash 0.6s ease forwards',
          pointerEvents: 'none',
        }}/>
      )}

      <div className="fixed inset-0 z-[9500] overflow-hidden">
        {/* VIDEO SFONDO */}
        <video
          ref={videoRef}
          src="/media/sigla.mp4"
          className="w-full h-full object-cover"
          playsInline
          onEnded={onDismiss}
          onError={onDismiss}
        />

        {/* OVERLAY SCURO LEGGERO per leggibilità testi */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.1) 50%, rgba(0,0,0,0.4) 100%)',
          pointerEvents: 'none',
        }}/>

        {/* ── 00:15 — NOME LOCALE ── */}
        {show15 && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'none',
          }}>
            <div style={{
              position: 'absolute',
              width: '600px', height: '300px',
              background: 'radial-gradient(ellipse, rgba(217,70,239,0.35) 0%, transparent 70%)',
              animation: 'siglaBgPulse 1.2s ease infinite',
            }}/>
            <div style={{
              fontFamily: "'Montserrat', sans-serif",
              fontSize: 'clamp(1rem, 2vw, 1.6rem)',
              fontWeight: 600,
              color: 'rgba(217,70,239,0.9)',
              textTransform: 'uppercase',
              letterSpacing: '0.5em',
              marginBottom: '16px',
              animation: 'siglaFadeUp 0.5s ease forwards',
            }}>
              Benvenuti a
            </div>
            <div style={{
              fontFamily: "'Montserrat', sans-serif",
              fontSize: 'clamp(3rem, 8vw, 7rem)',
              fontWeight: 900,
              color: '#fff',
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              animation: 'siglaZoomIn 0.7s cubic-bezier(0.34,1.56,0.64,1) forwards, siglaPulse 1.5s ease infinite 0.7s',
              textAlign: 'center',
              lineHeight: 1.1,
            }}>
              {nomLocale}
            </div>
            <div style={{
              height: '3px',
              background: 'linear-gradient(to right, transparent, #d946ef, #a855f7, transparent)',
              marginTop: '16px',
              animation: 'siglaLineGrow 0.8s ease 0.4s forwards',
              width: 0,
            }}/>
          </div>
        )}

        {/* ── 00:22 — STASERA QUALCOSA DI SPECIALE ── */}
        {show22 && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'none',
          }}>
            <div style={{
              fontFamily: "'Montserrat', sans-serif",
              fontSize: 'clamp(1.5rem, 4vw, 3.5rem)',
              fontWeight: 700,
              color: 'rgba(255,255,255,0.6)',
              textTransform: 'uppercase',
              letterSpacing: '0.3em',
              textAlign: 'center',
              animation: 'siglaFadeUp 0.6s ease forwards',
            }}>
              Stasera qualcosa
            </div>
            <div style={{
              fontFamily: "'Montserrat', sans-serif",
              fontSize: 'clamp(2rem, 5.5vw, 5rem)',
              fontWeight: 900,
              color: '#fff',
              textTransform: 'uppercase',
              letterSpacing: '0.15em',
              textAlign: 'center',
              animation: 'siglaFadeUp 0.6s ease 0.15s both, siglaPulse 2s ease infinite 0.8s',
            }}>
              di speciale
            </div>
          </div>
        )}

        {/* ── 00:30 — NOME SERATA + DATA ── */}
        {show30 && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: '16px',
            pointerEvents: 'none',
          }}>
            <div style={{
              fontFamily: "'Montserrat', sans-serif",
              fontSize: 'clamp(1rem, 2.5vw, 2rem)',
              fontWeight: 700,
              color: '#d946ef',
              textTransform: 'uppercase',
              letterSpacing: '0.4em',
              animation: 'siglaSlideLeft 0.6s cubic-bezier(0.34,1.56,0.64,1) forwards',
            }}>
              {dataOggi}
            </div>
            <div style={{
              fontFamily: "'Montserrat', sans-serif",
              fontSize: 'clamp(2.5rem, 6vw, 5.5rem)',
              fontWeight: 900,
              color: '#fff',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              textAlign: 'center',
              lineHeight: 1.1,
              animation: 'siglaSlideRight 0.6s cubic-bezier(0.34,1.56,0.64,1) 0.1s both, siglaPulse 2s ease infinite 0.7s',
            }}>
              {nomeEvento}
            </div>
          </div>
        )}

        {/* ── 00:38 — PARTECIPANTI ── */}
        {show38 && nPartecipanti > 0 && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: '12px',
            pointerEvents: 'none',
          }}>
            <div style={{
              fontFamily: "'Montserrat', sans-serif",
              fontSize: 'clamp(1rem, 2vw, 1.8rem)',
              fontWeight: 600,
              color: 'rgba(255,255,255,0.6)',
              textTransform: 'uppercase',
              letterSpacing: '0.35em',
              animation: 'siglaFadeUp 0.5s ease forwards',
            }}>
              Pronti a sfidarsi
            </div>
            <div style={{
              fontFamily: "'Montserrat', sans-serif",
              fontSize: 'clamp(5rem, 14vw, 12rem)',
              fontWeight: 900,
              color: '#d946ef',
              lineHeight: 1,
              animation: 'siglaZoomIn 0.6s cubic-bezier(0.34,1.56,0.64,1) 0.1s both, siglaPulse 1.5s ease infinite 0.7s',
            }}>
              {nPartecipanti}
            </div>
            <div style={{
              fontFamily: "'Montserrat', sans-serif",
              fontSize: 'clamp(1.2rem, 2.5vw, 2rem)',
              fontWeight: 800,
              color: '#fff',
              textTransform: 'uppercase',
              letterSpacing: '0.25em',
              animation: 'siglaFadeUp 0.5s ease 0.2s both',
            }}>
              {nPartecipanti === 1 ? 'Giocatore' : 'Giocatori'}
            </div>
          </div>
        )}

        {/* ── 00:46 — ATTIVITÀ UNA ALLA VOLTA ── */}
        {show46 && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: '16px',
            pointerEvents: 'none',
          }}>
            <div style={{
              fontFamily: "'Montserrat', sans-serif",
              fontSize: 'clamp(0.9rem, 1.8vw, 1.4rem)',
              fontWeight: 600,
              color: 'rgba(255,255,255,0.5)',
              textTransform: 'uppercase',
              letterSpacing: '0.4em',
              animation: 'siglaFadeUp 0.4s ease forwards',
            }}>
              In programma questa sera
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center' }}>
              {['Karaoke', 'Quiz Musicale', 'Sfide', 'Arcade'].map((item, i) => (
                <div key={i} style={{
                  fontFamily: "'Montserrat', sans-serif",
                  fontSize: 'clamp(1.2rem, 3vw, 2.5rem)',
                  fontWeight: 900,
                  color: '#fff',
                  textTransform: 'uppercase',
                  letterSpacing: '0.15em',
                  textAlign: 'center',
                  animation: `siglaFadeUp 0.4s ease ${0.15 + i * 0.2}s both`,
                  textShadow: '0 0 30px rgba(217,70,239,0.6)',
                }}>
                  {item}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── 00:58 — "1 SOLO VINCITORE" ── */}
        {show58 && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'none',
          }}>
            <div style={{
              position: 'absolute',
              width: '800px', height: '400px',
              background: 'radial-gradient(ellipse, rgba(217,70,239,0.5) 0%, transparent 70%)',
              animation: 'siglaBgPulse 0.8s ease infinite',
            }}/>
            <div style={{
              fontFamily: "'Montserrat', sans-serif",
              fontSize: 'clamp(1rem, 2.5vw, 2rem)',
              fontWeight: 700,
              color: 'rgba(255,255,255,0.7)',
              textTransform: 'uppercase',
              letterSpacing: '0.5em',
              marginBottom: '12px',
              animation: 'siglaFadeUp 0.4s ease forwards',
            }}>
              Ma ci sarà
            </div>
            <div style={{
              fontFamily: "'Montserrat', sans-serif",
              fontSize: 'clamp(4rem, 11vw, 9rem)',
              fontWeight: 900,
              color: '#fff',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              lineHeight: 1,
              textAlign: 'center',
              animation: 'siglaFlashBoom 0.7s cubic-bezier(0.34,1.56,0.64,1) forwards, siglaPulse 1s ease infinite 0.7s',
            }}>
              1 SOLO<br/>VINCITORE
            </div>
          </div>
        )}

        {/* ── 01:01 — "CHE LA SFIDA ABBIA INIZIO!" ── */}
        {show101 && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'none',
          }}>
            {/* Glow potente dietro */}
            <div style={{
              position: 'absolute',
              width: '900px', height: '500px',
              background: 'radial-gradient(ellipse, rgba(217,70,239,0.6) 0%, rgba(168,85,247,0.3) 40%, transparent 70%)',
              animation: 'siglaBgPulse 0.9s ease infinite',
            }}/>
            <div style={{
              fontFamily: "'Montserrat', sans-serif",
              fontSize: 'clamp(3.5rem, 9vw, 8rem)',
              fontWeight: 900,
              color: '#fff',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              textAlign: 'center',
              lineHeight: 1.1,
              textShadow: '0 0 60px rgba(217,70,239,1), 0 0 120px rgba(168,85,247,0.8), 0 0 200px rgba(217,70,239,0.4)',
              animation: 'siglaFinaleGlow 7s ease forwards, siglaPulse 0.8s ease infinite',
            }}>
              Che la sfida<br/>abbia inizio!
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function MediaOverlay({ overlay, onDismiss, pubData }) {
  const videoRef    = useRef(null);
  const audioRef    = useRef(null);

  useEffect(() => {
    if (!overlay) return;
    if (overlay.key === 'transizione') {
      const a = new Audio('/media/transizione.mp3');
      a.volume = 0.7;
      a.play().catch(() => {});
      audioRef.current = a;
    }
    if (overlay.key === 'applausi') {
      const a = new Audio('/media/applausi.mp3');
      a.volume = 0.85;
      a.play().catch(() => {});
      audioRef.current = a;
    }
    return () => {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overlay?.key, overlay?.triggeredAt]);

  if (!overlay) return null;

  // ── SIGLA — gestita da SiglaOverlay dedicato ──────────────────────────────
  if (overlay.key === 'sigla') {
    return <SiglaOverlay onDismiss={onDismiss} pubData={pubData} />;
  }

  // ── Applausi: overlay celebrazione con coriandoli ─────────────────────────
  if (overlay.key === 'applausi') {
    const COLORS = ['#d946ef','#a855f7','#f59e0b','#10b981','#3b82f6','#ef4444','#fff'];
    return (
      <>
        <style>{MEDIA_OVERLAY_STYLES}</style>
        <div
          className="fixed inset-0 z-[50] pointer-events-none"
          style={{
            animation: 'celebrationFadeInOut 7s ease forwards',
          }}
        >
          {/* Solo coriandoli — niente testo che copre il punteggio */}
          {Array.from({ length: 60 }).map((_, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: `${Math.random() * 100}%`,
                top: '-5%',
                width:  `${7 + Math.random() * 14}px`,
                height: `${7 + Math.random() * 14}px`,
                borderRadius: Math.random() > 0.5 ? '50%' : '3px',
                background: COLORS[Math.floor(Math.random() * COLORS.length)],
                animation: `confettiFall ${2.5 + Math.random() * 4}s ${Math.random() * 2.5}s ease-in forwards`,
              }}
            />
          ))}
        </div>
      </>
    );
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// STILI CSS ORIGINALI
// ─────────────────────────────────────────────────────────────────────────────

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;800;900&family=JetBrains+Mono:wght@500&display=swap');
  
  :root {
    --glass-bg: rgba(15, 15, 20, 0.7);
    --glass-border: rgba(255, 255, 255, 0.1);
    --sidebar-w: 24vw;
    --topbar-h: 7vh;
    --karaoke-bar-h: 10vh;
  }

  body { 
    background: #000; 
    overflow: hidden; 
    font-family: 'Montserrat', sans-serif; 
    color: white; 
  }
  
  .glass-panel {
    background: var(--glass-bg);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid var(--glass-border);
    box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.5);
  }

  @keyframes ticker { 
    0% { transform: translateX(100%); } 
    100% { transform: translateX(-100%); } 
  }
  .ticker-wrap { width: 100%; overflow: hidden; }
  .ticker-content { display: inline-block; white-space: nowrap; animation: ticker 25s linear infinite; }

  @keyframes gradient-move {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }
  .animated-bg {
    background: linear-gradient(-45deg, #101010, #1a0b2e, #0f172a, #000);
    background-size: 400% 400%;
    animation: gradient-move 20s ease infinite;
  }
  
  .text-glow { text-shadow: 0 0 30px rgba(217,70,239, 0.6); }

  .dj-topbar     { height: var(--topbar-h); }
  .dj-sidebar    { width: var(--sidebar-w); top: calc(var(--topbar-h) + 1vh); right: 1vw; bottom: 1vh; }
  .dj-content    { top: var(--topbar-h); right: calc(var(--sidebar-w) + 1.5vw); bottom: 0; left: 0; }
  .dj-karaoke-bar { height: var(--karaoke-bar-h); }
  .dj-karaoke-player { bottom: var(--karaoke-bar-h); }
`;

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTI ORIGINALI (invariati)
// ─────────────────────────────────────────────────────────────────────────────

const TopBar = ({ pubName, logoUrl, onlineCount, messages, isMuted }) => {
  const messagesString = messages && messages.length > 0 ? messages.map(m => `${m.nickname}: ${m.text}`).join('   •   ') : '';
  return (
  <div className="dj-topbar absolute top-0 left-0 right-0 z-[100] flex items-center justify-between px-8 bg-gradient-to-b from-black/90 via-black/60 to-transparent">
      <div className="flex items-center gap-5">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="h-[5vh] w-[5vh] rounded-xl border-2 border-white/20 shadow-lg object-contain bg-black p-1" />
          ) : (
            <div className="h-[5vh] w-[5vh] rounded-xl bg-fuchsia-600 flex items-center justify-center border-2 border-white/20 shadow-lg font-black text-[2vh]">DJ</div>
          )}
          <div>
              <h1 className="text-[2.5vh] font-black text-white tracking-wider drop-shadow-md uppercase">{pubName || "DISCOJOYS"}</h1>
              <div className="flex items-center gap-3">
                  <span className="bg-red-600 px-2 py-0.5 rounded text-[1vh] font-bold tracking-widest uppercase animate-pulse shadow-[0_0_10px_red]">LIVE</span>
                  {isMuted && <span className="text-white bg-red-900 px-2 py-0.5 rounded text-[1vh] font-bold tracking-widest border border-red-500">AUDIO OFF</span>}
              </div>
          </div>
      </div>
      <div className="flex-1 mx-8 h-[4.5vh] glass-panel rounded-full flex items-center px-4 overflow-hidden relative">
          {messagesString ? (
             <div className="ticker-wrap">
                 <div className="ticker-content text-white text-[1.8vh] font-medium flex items-center gap-8">
                     <MessageSquare className="w-[2vh] h-[2vh] text-fuchsia-400 inline-block shrink-0"/>
                     <span>{messagesString}</span>
                     <span className="ml-8">{messagesString}</span>
                 </div>
             </div>
          ) : (
             <div className="ticker-wrap">
                 <div className="ticker-content text-white/40 text-[1.4vh] font-medium uppercase tracking-widest flex items-center gap-8">
                     <span>🎵 Prenota la tua canzone</span>
                     <span>📸 Carica il tuo avatar</span>
                     <span>🏆 Scala la classifica</span>
                     <span>📱 Scansiona il QR Code</span>
                 </div>
             </div>
          )}
      </div>
      <div className="flex flex-col items-end">
          <div className="glass-panel px-4 py-2 rounded-xl flex items-center gap-3">
              <Users className="w-[2vh] h-[2vh] text-fuchsia-400"/> 
              <span className="text-[2.5vh] font-mono font-bold">{onlineCount}</span>
          </div>
      </div>
  </div>
);};

const AdminMessageOverlay = ({ message }) => {
    if (!message) return null;
    return (
        <div className="absolute inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="glass-panel p-12 rounded-[3rem] max-w-5xl text-center border-4 border-fuchsia-500 shadow-[0_0_100px_rgba(217,70,239,0.5)] transform animate-bounce-in">
                <div className="flex justify-center mb-6">
                    <Megaphone className="w-24 h-24 text-fuchsia-400 animate-pulse" />
                </div>
                <h2 className="text-4xl text-fuchsia-200 font-bold uppercase tracking-[0.5em] mb-8">Comunicazione Regia</h2>
                <p className="text-7xl font-black text-white leading-tight drop-shadow-2xl">{message.text}</p>
            </div>
        </div>
    );
};

const Sidebar = ({ pubCode, queue, leaderboard }) => (
  <div className="dj-sidebar absolute z-[90] flex flex-col gap-[1.5vh]">
      <div className="glass-panel px-4 py-3 rounded-2xl flex items-center gap-4 relative overflow-hidden shrink-0">
          <div className="absolute inset-0 bg-fuchsia-600/5 blur-xl"></div>
          <div className="bg-white p-2 rounded-xl shadow-2xl relative z-10 shrink-0">
              <QRCodeSVG value={`${window.location.origin}/join/${pubCode}`} size={Math.round(window.innerWidth * 0.07)} level="M" />
          </div>
          <div className="relative z-10 flex flex-col">
              <div className="text-[2vw] font-black text-white tracking-widest font-mono drop-shadow-xl">{pubCode}</div>
              <div className="text-[0.8vw] text-white/50 uppercase font-bold tracking-[0.15em]">Scansiona per entrare</div>
          </div>
      </div>
      
      <div className="glass-panel rounded-3xl flex flex-col overflow-hidden relative shrink-0">
          <div className="bg-gradient-to-r from-fuchsia-600 to-purple-600 px-4 py-3 flex items-center justify-between border-b border-white/10">
              <div className="flex items-center gap-2">
                  <Disc className="w-[2vh] h-[2vh] text-white animate-spin" style={{animationDuration: '3s'}} />
                  <span className="font-black text-white text-[1.8vh] uppercase tracking-wider">Coda</span>
              </div>
              <div className="bg-white/20 px-3 py-1 rounded-full">
                  <span className="text-white font-bold text-[1.4vh]">{queue?.length || 0}</span>
              </div>
          </div>
          <div className="p-3">
              {queue && queue.length > 0 ? (
                  <div className="bg-white/5 backdrop-blur-sm px-4 py-3 rounded-2xl border border-white/10 flex items-center gap-3">
                      {queue[0].user_avatar ? (
                          <img src={queue[0].user_avatar} alt={queue[0].user_nickname}
                              className="w-[5vh] h-[5vh] rounded-full border-2 border-fuchsia-500 object-cover shrink-0 shadow-lg" />
                      ) : (
                          <div className="w-[5vh] h-[5vh] rounded-full bg-gradient-to-br from-fuchsia-600 to-purple-600 flex items-center justify-center text-white font-black text-[2vh] shadow-lg shrink-0">
                              {queue[0].user_nickname?.charAt(0)?.toUpperCase() || '?'}
                          </div>
                      )}
                      <div className="flex-1 min-w-0">
                          <div className="text-white font-bold text-[1.6vh] truncate">{queue[0].user_nickname}</div>
                          <div className="text-white/60 text-[1.2vh] truncate">{queue[0].title || queue[0].song_title || '—'}</div>
                      </div>
                      <Music className="w-[2vh] h-[2vh] text-fuchsia-400 shrink-0" />
                  </div>
              ) : (
                  <div className="text-white/30 text-center py-4 italic text-[1.3vh]">Nessuna canzone in coda</div>
              )}
          </div>
      </div>

      <div className="glass-panel rounded-3xl flex flex-col overflow-hidden relative flex-1">
          <div className="bg-gradient-to-r from-yellow-500 to-orange-500 px-6 py-4 flex items-center justify-between border-b border-white/10 shrink-0">
              <div className="flex items-center gap-3">
                  <Trophy className="w-6 h-6 text-white" />
                  <span className="font-black text-white text-xl uppercase tracking-wider">Classifica</span>
              </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-thin scrollbar-thumb-yellow-500 scrollbar-track-transparent">
              {leaderboard && leaderboard.length > 0 ? (
                  leaderboard.slice(0, 10).map((player, i) => (
                      <div key={player.id || i} className={`flex items-center gap-3 p-3 rounded-xl ${
                          i === 0 ? 'bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30' :
                          i === 1 ? 'bg-white/5 border border-gray-400/20' :
                          i === 2 ? 'bg-white/5 border border-amber-600/20' :
                          'bg-white/5'
                      }`}>
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 ${
                              i === 0 ? 'bg-yellow-500 text-black' :
                              i === 1 ? 'bg-gray-400 text-black' :
                              i === 2 ? 'bg-amber-700 text-white' :
                              'bg-white/10 text-white'
                          }`}>
                              {i+1}
                          </div>
                          {player.avatar_url ? (
                              <img src={player.avatar_url} alt={player.nickname} className="w-10 h-10 rounded-full border-2 border-yellow-500/50 object-cover shrink-0 shadow-md" />
                          ) : (
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-fuchsia-600 to-purple-600 flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-md">
                                  {player.nickname?.charAt(0)?.toUpperCase() || '?'}
                              </div>
                          )}
                          <div className="flex-1 min-w-0">
                              <div className="text-white font-bold text-sm truncate">{player.nickname}</div>
                          </div>
                          <div className="font-mono text-cyan-400 font-bold text-sm">{player.score || 0}</div>
                      </div>
                  ))
              ) : (
                  <div className="text-white/30 text-center py-8 italic text-sm">Classifica vuota</div>
              )}
          </div>
      </div>
  </div>
);

const KaraokeMode = ({ perf, isMuted }) => (
    <div className="w-full h-full relative">
        <div className="absolute inset-0 dj-karaoke-player bg-black">
            <KaraokePlayer 
                key={perf.id} 
                url={perf.youtube_url}
                status={perf.status}
                volume={100}
                isMuted={isMuted}
                startedAt={perf.started_at}
            />
        </div>
        <div className="dj-karaoke-bar absolute bottom-0 left-0 right-0 bg-black z-[70] flex items-center px-[2vw] gap-[1.5vw] border-t border-white/5">
            <div className="relative shrink-0">
                {perf.user_avatar ? (
                    <img src={perf.user_avatar} className="w-[7vh] h-[7vh] rounded-full border-2 border-fuchsia-500/80 object-cover bg-zinc-900 shadow-lg" alt="Singer" />
                ) : (
                    <div className="w-[7vh] h-[7vh] rounded-full border-2 border-fuchsia-500/80 bg-fuchsia-600/40 flex items-center justify-center shadow-lg">
                        <Mic2 className="w-[4vh] h-[4vh] text-white" />
                    </div>
                )}
                <div className="absolute -bottom-1 -right-1 bg-red-600 text-white text-[1vh] font-bold px-1.5 py-0.5 rounded-full border border-white/20">LIVE</div>
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                    <Mic2 className="w-[1.8vh] h-[1.8vh] text-fuchsia-400 shrink-0" />
                    <span className="text-[1.8vh] font-bold text-white truncate">{perf.user_nickname}</span>
                </div>
                <h1 className="text-[2.8vh] font-black text-white leading-none truncate text-glow">{perf.song_title}</h1>
                <p className="text-[1.4vh] text-white/50 uppercase tracking-wide mt-1 truncate">{perf.song_artist}</p>
            </div>
            <div className="shrink-0 text-right border-l border-white/10 pl-[1.5vw]">
                <div className="text-[1.2vh] text-white/30 uppercase tracking-widest mb-1">In onda</div>
                <div className="text-fuchsia-400 text-[1.4vh] font-bold">🎤 Karaoke Live</div>
            </div>
        </div>
    </div>
);

const VotingMode = ({ perf }) => (
    <div className="w-full h-full flex flex-col items-center justify-center animated-bg p-8">
        <div className="bg-fuchsia-600/10 blur-[200px] w-[800px] h-[800px] absolute rounded-full animate-pulse"></div>
        <div className="text-center relative z-10">
            <Star className="w-56 h-56 text-yellow-400 mx-auto mb-12 drop-shadow-[0_0_100px_rgba(234,179,8,0.6)] animate-pulse" />
            <h1 className="text-9xl font-black text-white leading-none mb-8 drop-shadow-2xl tracking-tight uppercase">Vota!</h1>
            <div className="glass-panel px-16 py-10 rounded-[3rem] inline-block border-4 border-fuchsia-500 shadow-[0_0_80px_rgba(217,70,239,0.4)]">
                <div className="text-4xl text-fuchsia-300 font-bold tracking-wider mb-4 uppercase">Ha Cantato</div>
                <div className="text-8xl font-black text-white">{perf.user_nickname}</div>
            </div>
            <p className="text-4xl text-white/70 mt-16 font-bold animate-pulse">Usa l'app per votare da 1 a 5 stelle</p>
        </div>
    </div>
);

const ScoreMode = ({ perf }) => {
    return (
    <div className="w-full h-full flex flex-col items-center justify-center animated-bg p-8">
        <div className="bg-yellow-400/10 blur-[250px] w-[900px] h-[900px] absolute rounded-full animate-pulse"></div>
        <div className="text-center relative z-10">
            <div className="glass-panel px-20 py-12 rounded-[4rem] border-8 border-yellow-500 shadow-[0_0_120px_rgba(234,179,8,0.5)] inline-block">
                <div className="text-4xl uppercase text-yellow-300 font-black tracking-[0.5em] mb-8">Punteggio</div>
                <div className="text-7xl font-black text-white mb-10">{perf.user_nickname}</div>
                <div className="flex justify-center gap-6 mb-10">
                    {[1,2,3,4,5].map(star => (
                        <Star key={star} className={`w-24 h-24 ${star <= Math.round(perf.average_score || 0) ? 'text-yellow-400 fill-yellow-400 drop-shadow-[0_0_30px_rgba(250,204,21,0.8)]' : 'text-white/20'}`} />
                    ))}
                </div>
                <div className="text-[10rem] font-black text-yellow-400 font-mono drop-shadow-2xl leading-none">
                    {perf.average_score?.toFixed(1) || "0.0"}
                </div>
                <p className="text-3xl text-white mt-12 font-bold bg-white/10 px-10 py-4 rounded-full backdrop-blur-md border border-white/20 inline-block">
                    {perf.song_title}
                </p>
            </div>
        </div>
    </div>
    );
};

const QuizMode = ({ quiz, result }) => {
    const getYtId = (url) => {
        if (!url) return null;
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    };
    const getSpotifyEmbed = (url) => {
        if (!url) return null;
        const m = url.match(/(?:track\/)([a-zA-Z0-9]+)/);
        return m ? `https://open.spotify.com/embed/track/${m[1]}?utm_source=generator&theme=0` : null;
    };

    if (quiz.status === 'leaderboard' && quiz.leaderboard) {
        return (
             <div className="w-full h-full flex flex-col bg-[#080808] relative p-12 overflow-hidden items-center justify-center">
                <div className="bg-yellow-500/10 blur-[200px] w-full h-full absolute"></div>
                <h1 className="text-8xl font-black text-yellow-400 uppercase tracking-[0.2em] mb-12 drop-shadow-2xl flex items-center gap-6 z-10">
                    <Trophy className="w-32 h-32" /> Classifica
                </h1>
                <div className="glass-panel p-8 rounded-[3rem] w-full max-w-4xl border-4 border-yellow-500/30 z-10 flex flex-col gap-4 max-h-[80vh] overflow-y-auto custom-scrollbar">
                     {quiz.leaderboard.slice(0, 10).map((p, i) => (
                         <div key={i} className={`flex items-center gap-6 p-6 rounded-3xl ${i===0 ? 'bg-yellow-500/20 border-2 border-yellow-500' : 'bg-white/5'}`}>
                             <div className={`text-4xl font-black w-16 h-16 rounded-xl flex items-center justify-center ${i===0 ? 'bg-yellow-500 text-black' : 'bg-white/10 text-white'}`}>{i+1}</div>
                             <div className="text-4xl font-bold text-white flex-1">{p.nickname}</div>
                             <div className="text-5xl font-mono text-yellow-400 font-black">{p.score}</div>
                         </div>
                     ))}
                </div>
             </div>
        );
    }

    const isVideoQuiz = quiz.media_type === 'video' && quiz.media_url && !result;
    const isAudioQuiz = quiz.media_type === 'audio' && quiz.media_url && !result;
    const spotifyEmbedUrl = isAudioQuiz ? getSpotifyEmbed(quiz.media_url) : null;
    const ytId = isVideoQuiz ? getYtId(quiz.media_url) : null;

    if (isAudioQuiz && spotifyEmbedUrl) {
        return (
        <div className="w-full h-full flex flex-col bg-[#080808] overflow-hidden">
            <div className="shrink-0 px-8 pt-6 pb-2">
                <div className="rounded-xl overflow-hidden border border-zinc-700 shadow-lg">
                    <div className="bg-zinc-900 px-3 py-1 text-xs text-zinc-500 font-bold uppercase tracking-widest flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                        ASCOLTA LA CANZONE
                    </div>
                    <iframe key={quiz.id} src={spotifyEmbedUrl} width="100%" height="80" frameBorder="0"
                        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" className="block" />
                </div>
            </div>
            <div className="flex flex-col items-center justify-center px-8 py-4 shrink-0">
                <div className="bg-fuchsia-600 text-white px-6 py-2 rounded-full font-black text-lg uppercase tracking-[0.3em] mb-4 shadow-[0_0_20px_rgba(217,70,239,0.5)] border border-white/20">
                    {quiz.category || "QUIZ TIME"}
                </div>
                <h1 style={{fontSize: 'clamp(1.2rem, 3vw, 3rem)', lineHeight: 1.2}} className="font-black text-white text-center drop-shadow-2xl">{quiz.question}</h1>
            </div>
            <div className="flex-1 px-8 pb-8 flex items-center">
                {quiz.status === 'closed' ? (
                    <div className="w-full flex justify-center">
                        <div className="bg-red-600 px-10 py-5 rounded-[2rem] animate-pulse shadow-[0_0_60px_rgba(220,38,38,0.8)] border-4 border-red-400">
                            <h2 className="text-5xl font-black text-white uppercase italic">TEMPO SCADUTO!</h2>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-3 w-full h-full">
                        {quiz.options.map((opt, i) => (
                            <div key={i} className="glass-panel border-l-[8px] border-fuchsia-600 px-4 rounded-r-2xl flex items-center gap-4 text-left overflow-hidden">
                                <div style={{fontSize: 'clamp(1.2rem, 2.5vw, 2.5rem)', minWidth: '2.5em', minHeight: '2.5em'}} className="bg-black/40 rounded-xl flex items-center justify-center font-black text-white shrink-0 font-mono border border-white/10 aspect-square">
                                    {String.fromCharCode(65+i)}
                                </div>
                                <div style={{fontSize: 'clamp(1rem, 2vw, 2rem)'}} className="font-bold text-white leading-tight line-clamp-3">{opt}</div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
        );
    }

    if (isVideoQuiz && ytId) {
        return (
        <div className="w-full h-full flex flex-col bg-[#080808] overflow-hidden" style={{height: '100%'}}>
            <div style={{height: '12%'}} className="flex flex-col items-center justify-center px-8 gap-1 shrink-0 overflow-hidden">
                <div style={{fontSize: 'clamp(0.6rem, 1vw, 0.9rem)'}} className="bg-fuchsia-600 text-white px-4 py-1 rounded-full font-black uppercase tracking-[0.3em] shadow-[0_0_20px_rgba(217,70,239,0.5)] border border-white/20 shrink-0">
                    {quiz.category || "QUIZ TIME"}
                </div>
                <h1 style={{fontSize: 'clamp(1rem, 2.5vw, 2.2rem)', lineHeight: 1.2}} className="font-black text-white text-center drop-shadow-2xl line-clamp-2">{quiz.question}</h1>
            </div>
            <div style={{height: '55%'}} className="shrink-0 px-8">
                <div className="w-full h-full rounded-2xl overflow-hidden border border-white/10 shadow-2xl relative bg-black">
                    {ytId && (
                        <iframe src={`https://www.youtube.com/embed/${ytId}?autoplay=1&controls=0&modestbranding=1&showinfo=0&rel=0&loop=1&playlist=${ytId}`}
                            allow="autoplay; encrypted-media" allowFullScreen={false}
                            style={{position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none'}} />
                    )}
                    <div style={{position: 'absolute', top: 0, left: 0, right: 0, height: '80px', background: '#000000', zIndex: 50, pointerEvents: 'none'}} />
                </div>
            </div>
            <div style={{height: '33%'}} className="shrink-0 px-8 py-2 flex items-center">
                {quiz.status === 'closed' ? (
                    <div className="w-full flex justify-center">
                        <div className="bg-red-600 px-10 py-5 rounded-[2rem] animate-pulse shadow-[0_0_60px_rgba(220,38,38,0.8)] border-4 border-red-400">
                            <h2 className="text-5xl font-black text-white uppercase italic">TEMPO SCADUTO!</h2>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-2 w-full h-full">
                        {quiz.options.map((opt, i) => (
                            <div key={i} className="glass-panel border-l-[8px] border-fuchsia-600 px-3 rounded-r-2xl flex items-center gap-3 text-left overflow-hidden">
                                <div style={{fontSize: 'clamp(0.9rem, 1.8vw, 1.8rem)', minWidth: '2em', minHeight: '2em'}} className="bg-black/40 rounded-lg flex items-center justify-center font-black text-white shrink-0 font-mono border border-white/10 aspect-square">
                                    {String.fromCharCode(65+i)}
                                </div>
                                <div style={{fontSize: 'clamp(0.8rem, 1.5vw, 1.4rem)'}} className="font-bold text-white leading-tight line-clamp-2">{opt}</div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
        );
    }

    return (
    <div className="w-full h-full flex flex-col bg-[#080808] relative p-12 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-900 to-black z-0"></div>
        <div className="relative z-20 flex-1 flex flex-col items-center justify-center">
            <div className="bg-fuchsia-600 text-white px-10 py-4 rounded-full font-black text-xl uppercase tracking-[0.3em] mb-12 shadow-[0_0_40px_rgba(217,70,239,0.6)] transform -rotate-2 border-2 border-white/20">
                {quiz.category || "QUIZ TIME"}
            </div>
            {result ? (
                <div className="w-full max-w-6xl animate-in zoom-in duration-500 flex flex-col items-center">
                    <div className="bg-green-600/90 backdrop-blur-xl p-10 rounded-[3rem] mb-12 shadow-[0_0_100px_rgba(22,163,74,0.5)] border-4 border-green-400 text-center w-full">
                        <div className="text-white/70 uppercase font-bold tracking-widest text-sm mb-2">Risposta Corretta</div>
                        <span className="text-7xl font-black text-white leading-tight">{result.correct_option}</span>
                    </div>
                    <div className="w-full">
                        <div className="glass-panel p-8 rounded-3xl">
                            <h3 className="text-fuchsia-400 font-bold uppercase tracking-widest mb-6 flex items-center gap-2 text-xl">
                                <Zap className="w-6 h-6"/> I Più Veloci
                            </h3>
                            <div className="space-y-4 max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
                                {result.winners && result.winners.length > 0 ? (
                                    result.winners.map((w, i) => (
                                        <div key={i} className="flex items-center gap-4 bg-white/5 p-3 rounded-2xl border border-white/5">
                                            <div className="bg-yellow-500 text-black font-black w-8 h-8 rounded-lg flex items-center justify-center text-lg">{i+1}</div>
                                            {w.avatar ? <img src={w.avatar} className="w-10 h-10 rounded-full object-cover border border-white/20" alt="avt" /> :
                                                <div className="w-10 h-10 rounded-full bg-fuchsia-600 flex items-center justify-center text-white font-bold border border-white/20">{w.nickname.charAt(0).toUpperCase()}</div>}
                                            <span className="text-white font-bold text-xl truncate flex-1">{w.nickname}</span>
                                            <div className="text-green-400 font-mono font-bold text-lg">+{w.points}</div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-white/30 italic text-center py-4">Nessuno ha indovinato in tempo!</div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="w-full h-full flex flex-col justify-center gap-4 px-4 overflow-hidden">
                    <h1 style={{fontSize: 'clamp(1.5rem, 4vw, 4rem)', lineHeight: 1.2}} className="font-black text-white drop-shadow-2xl text-center">{quiz.question}</h1>
                    {quiz.status === 'closed' ? (
                         <div className="bg-red-600 rounded-[2rem] animate-pulse shadow-[0_0_80px_rgba(220,38,38,0.8)] border-4 border-red-400 mx-auto px-10 py-6">
                             <h2 style={{fontSize: 'clamp(2rem, 4vw, 4rem)'}} className="font-black text-white uppercase italic">TEMPO SCADUTO!</h2>
                         </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-3 flex-1 min-h-0">
                            {quiz.options.map((opt, i) => (
                                <div key={i} className="glass-panel border-l-[8px] border-fuchsia-600 px-4 rounded-r-2xl flex items-center gap-4 text-left overflow-hidden">
                                    <div style={{fontSize: 'clamp(1.2rem, 2.5vw, 2.5rem)', minWidth: '2.5em', minHeight: '2.5em'}} className="bg-black/40 rounded-xl flex items-center justify-center font-black text-white shrink-0 font-mono border border-white/10 aspect-square">
                                        {String.fromCharCode(65+i)}
                                    </div>
                                    <div style={{fontSize: 'clamp(1rem, 2vw, 2vw)'}} className="font-bold text-white leading-tight line-clamp-3">{opt}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    </div>
)};

const IdleMode = ({ pub }) => (
    <div className="w-full h-full flex flex-col items-center justify-center animated-bg relative overflow-hidden">
        <div className="w-[1000px] h-[1000px] bg-fuchsia-600/10 rounded-full blur-[150px] absolute z-0 animate-pulse"></div>
        <div className="relative z-10 text-center">
            {pub.logo_url ? (
                 <img src={pub.logo_url} className="w-80 h-80 rounded-[3rem] mb-12 mx-auto shadow-[0_0_80px_rgba(0,0,0,0.8)] border-4 border-white/10 object-contain bg-black p-8" alt="logo" />
            ) : (
                 <div className="w-64 h-64 rounded-full bg-gradient-to-br from-zinc-800 to-black flex items-center justify-center mx-auto mb-10 border-4 border-white/10">
                    <Music className="w-32 h-32 text-white/20" />
                 </div>
            )}
            <h1 className="text-9xl font-black text-white tracking-tighter drop-shadow-2xl mb-8">{pub.name}</h1>
            <div className="glass-panel px-16 py-6 rounded-full inline-block border border-white/20">
                <span className="text-3xl text-white/90 font-bold uppercase tracking-[0.4em]">Benvenuti</span>
            </div>
        </div>
    </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPALE — PubDisplay
// ─────────────────────────────────────────────────────────────────────────────

export default function PubDisplay() {
    const { pubCode } = useParams();
    const [data, setData]           = useState(null);
    const [isMuted, setIsMuted]     = useState(false);
    const [quizResult, setQuizResult] = useState(null);
    const [newReaction, setNewReaction] = useState(null);
    const [standby, setStandby]     = useState(true); // schermata di attesa iniziale

    // ── Reazioni realtime ────────────────────────────────────────────────────
    useEffect(() => {
        const reactionChannel = supabase.channel('public:reactions')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reactions' }, (payload) => {
                const reaction = payload.new;
                setNewReaction({ emoji: reaction.emoji, nickname: reaction.nickname || '', id: reaction.id, _t: Date.now() });
            })
            .subscribe();
        return () => { supabase.removeChannel(reactionChannel); };
    }, []);

    // ── Caricamento dati ─────────────────────────────────────────────────────
    const load = useCallback(async () => {
        try {
            const res = await api.getDisplayData(pubCode);
            if (res.data) {
                let finalData = res.data;
                const q = finalData.active_quiz;

                if (q && q.status === 'showing_results') {
                    const r = await api.getQuizResults(q.id);
                    setQuizResult(r.data);
                } else {
                    setQuizResult(null);
                }

                if (q && q.status === 'leaderboard') {
                    finalData = { ...finalData, active_quiz: { ...q, leaderboard: finalData.leaderboard } };
                }

                const arcade = finalData.active_arcade;
                if (arcade && arcade.status === 'ended' && arcade.winner_id) {
                    const { data: winner } = await supabase.from('participants').select('id, nickname, avatar_url').eq('id', arcade.winner_id).single();
                    const winnerData = winner || { nickname: 'Vincitore', avatar_url: null };
                    finalData = { ...finalData, arcade_result: { winner: winnerData } };
                }
                if (arcade && arcade.status === 'active') {
                    const { data: allBookings } = await api.getArcadeBookings(arcade.id);
                    const pendingQueue = allBookings?.filter(b => b.status === 'pending').sort((a, b) => a.booking_order - b.booking_order) || [];
                    const recentErrors = allBookings?.filter(b => b.status === 'wrong').sort((a, b) => new Date(b.validated_at) - new Date(a.validated_at));
                    finalData = { ...finalData, active_arcade: { ...arcade, booking_queue: pendingQueue, last_error: recentErrors?.[0] || null } };
                }

                setData(finalData);
            }
        } catch(e) { console.error(e); }
    }, [pubCode]);

    // ── 🎬 MEDIA ORCHESTRATOR ────────────────────────────────────────────────
    const { overlay, dismissOverlay, triggerManual } = useMediaOrchestrator(data);
    const triggerManualRef = useRef(triggerManual);
    useEffect(() => { triggerManualRef.current = triggerManual; }, [triggerManual]);

    useEffect(() => {
        load();
        const int = setInterval(load, 1000);
        const ctrlChannel = supabase.channel('tv_ctrl')
            .on('broadcast', {event: 'control'}, p => {
                console.log('📡 tv_ctrl ricevuto:', p.payload);
                if (p.payload.command === 'mute') setIsMuted(p.payload.value);
                if (p.payload.command === 'stop_sottofondo') {
                    triggerManualRef.current?.('stop_sottofondo');
                }
                if (p.payload.command === 'start_sottofondo') {
                    triggerManualRef.current?.('start_sottofondo');
                }
                if (p.payload.command === 'play_media') {
                    console.log('🎬 play_media:', p.payload.key);
                    setStandby(false);
                    triggerManualRef.current?.(p.payload.key);
                }
            })
            .subscribe((status) => {
                console.log('📡 tv_ctrl status:', status);
            });
        return () => { clearInterval(int); supabase.removeChannel(ctrlChannel); };
    }, [pubCode, load]);

    // Esci dallo standby automaticamente quando parte un'attività reale
    useEffect(() => {
        if (!data) return;
        const { current_performance: perf, active_quiz: quiz, extraction_data } = data;
        const arcade = data.active_arcade;
        const hasActivity =
            (perf && ['live', 'paused', 'voting', 'ended'].includes(perf.status)) ||
            (quiz && ['active', 'closed', 'showing_results', 'leaderboard'].includes(quiz.status)) ||
            (arcade && ['active', 'paused'].includes(arcade.status)) ||
            !!data.arcade_result ||
            !!extraction_data;
        if (hasActivity) setStandby(false);
    }, [data]);

    // ── Schermata di caricamento dati ───────────────────────────────────────
    if (!data) return (
        <div className="w-screen h-screen bg-black flex flex-col items-center justify-center">
             <div className="w-20 h-20 border-8 border-fuchsia-600 border-t-transparent rounded-full animate-spin mb-6"></div>
             <div className="text-white text-3xl font-black font-mono tracking-[0.5em] animate-pulse">CARICAMENTO...</div>
        </div>
    );

    const { pub, current_performance: perf, queue, active_quiz: quiz, admin_message, leaderboard, approved_messages, extraction_data } = data;

    // ── Schermata STANDBY — attesa prima che la regia inizi ─────────────────
    if (standby) return (
        <div
            className="w-screen h-screen bg-black flex flex-col items-center justify-center relative overflow-hidden"
            onClick={() => setStandby(false)} // click di emergenza
        >
            <style>{STYLES}</style>
            {/* Sfondo animato */}
            <div className="absolute inset-0 animated-bg opacity-60" />
            <div className="absolute inset-0" style={{
                background: 'radial-gradient(ellipse at center, rgba(217,70,239,0.15) 0%, transparent 70%)',
            }}/>
            {/* Pattern */}
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-5 pointer-events-none"/>

            <div className="relative z-10 flex flex-col items-center gap-8">
                {/* Logo o iniziali */}
                {pub?.logo_url ? (
                    <img src={pub.logo_url} alt="Logo"
                        className="w-40 h-40 rounded-[2rem] border-4 border-white/10 shadow-2xl object-contain bg-black p-4"
                    />
                ) : (
                    <div className="w-40 h-40 rounded-[2rem] bg-gradient-to-br from-fuchsia-600 to-purple-800 flex items-center justify-center border-4 border-white/10 shadow-2xl">
                        <span style={{ fontSize: '4rem', fontWeight: 900, color: '#fff', fontFamily: "'Montserrat', sans-serif" }}>
                            {pub?.name?.charAt(0)?.toUpperCase() || 'D'}
                        </span>
                    </div>
                )}

                {/* Nome locale */}
                <div style={{
                    fontFamily: "'Montserrat', sans-serif",
                    fontSize: 'clamp(2rem, 5vw, 4.5rem)',
                    fontWeight: 900,
                    color: '#fff',
                    textTransform: 'uppercase',
                    letterSpacing: '0.15em',
                    textAlign: 'center',
                    textShadow: '0 0 40px rgba(217,70,239,0.5)',
                }}>
                    {pub?.name || 'DiscoJoys'}
                </div>

                {/* Indicatore attesa */}
                <div style={{
                    fontFamily: "'Montserrat', sans-serif",
                    fontSize: 'clamp(0.8rem, 1.5vw, 1.2rem)',
                    fontWeight: 600,
                    color: 'rgba(255,255,255,0.3)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5em',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                }}>
                    <span style={{
                        display: 'inline-block',
                        width: '8px', height: '8px',
                        borderRadius: '50%',
                        background: '#d946ef',
                        boxShadow: '0 0 12px #d946ef',
                        animation: 'pulse 1.5s ease infinite',
                    }}/>
                    In attesa della regia
                </div>

                {/* QR code piccolo */}
                {pubCode && (
                    <div className="mt-4 bg-white p-3 rounded-2xl shadow-2xl">
                        <QRCodeSVG value={`${window.location.origin}/join/${pubCode}`} size={120} level="M" />
                    </div>
                )}
                <div style={{
                    fontFamily: "'Montserrat', sans-serif",
                    fontSize: 'clamp(1.5rem, 3vw, 2.5rem)',
                    fontWeight: 900,
                    color: 'rgba(255,255,255,0.6)',
                    letterSpacing: '0.3em',
                    fontFamily: 'monospace',
                }}>
                    {pubCode}
                </div>
            </div>
        </div>
    );

    const recentMessages = approved_messages ? approved_messages.slice(0, 10) : [];
    const isQuiz   = quiz && ['active', 'closed', 'showing_results', 'leaderboard'].includes(quiz.status);
    const isArcade = (data.active_arcade && ['active', 'paused'].includes(data.active_arcade.status)) || !!data.arcade_result;
    const isKaraoke = !isQuiz && !isArcade && perf && ['live', 'paused'].includes(perf.status);
    const isVoting  = !isQuiz && !isArcade && perf && perf.status === 'voting';
    const isScore   = !isQuiz && !isArcade && perf && perf.status === 'ended';

    let Content = null;
    if (isQuiz)    Content = <QuizMode quiz={quiz} result={quizResult} />;
    else if (isArcade)  Content = <ArcadeMode arcade={data.active_arcade || {}} result={data.arcade_result} bookingQueue={data.active_arcade?.booking_queue || []} lastError={data.active_arcade?.last_error} />;
    else if (isVoting)  Content = <VotingMode perf={perf} />;
    else if (isScore)   Content = <ScoreMode perf={perf} />;
    else if (isKaraoke) Content = <KaraokeMode perf={perf} isMuted={isMuted} />;
    else Content = <IdleMode pub={pub} />;

    return (
        <div className="w-screen h-screen relative bg-black overflow-hidden">
            <style>{STYLES}</style>
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 pointer-events-none z-0"></div>

            {/* REAZIONI FLOTTANTI */}
            <div className="absolute inset-0 z-[9999] pointer-events-none">
                <FloatingReactions newReaction={newReaction} />
            </div>

            {/* 🎬 MEDIA OVERLAY — sopra tutto, sotto solo le reazioni */}
            <MediaOverlay overlay={overlay} onDismiss={dismissOverlay} pubData={data} />

            <TopBar pubName={pub.name} logoUrl={pub.logo_url} onlineCount={leaderboard?.length || 0} messages={recentMessages} isMuted={isMuted} />
            <AdminMessageOverlay message={admin_message} />

            {/* ESTRAZIONE — parte immediatamente, ExtractionMode gestisce tutto */}
            {extraction_data && (
                <div className="absolute inset-0 z-[300]">
                    <ExtractionMode
                        extractionData={extraction_data}
                        participants={leaderboard || []}
                        songs={extraction_data.song ? [extraction_data.song] : []}
                        onComplete={() => api.clearExtraction(pubCode)}
                    />
                </div>
            )}

            <div className="dj-content absolute z-10">
                {Content}
            </div>

            <Sidebar pubCode={pubCode} queue={queue} leaderboard={leaderboard} />
        </div>
    );
}