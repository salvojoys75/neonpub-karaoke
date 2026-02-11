import React, { useEffect, useRef, useCallback } from 'react';

// ===========================================
// KARAOKE PLAYER - VERSIONE EVOLUTA & FLUIDA
// ===========================================

const KaraokePlayer = ({ url, status, volume = 100, isMuted, startedAt }) => {
  const playerRef = useRef(null);
  const playerReadyRef = useRef(false);
  const currentVideoIdRef = useRef(null);
  const lastStartedAtRef = useRef(null);
  
  // Estrae ID video in modo sicuro
  const getVideoId = (url) => {
    if (!url) return null;
    const match = url.match(/^.*(youtu\.be\\/|v\\/|u\\/\\w\\/|embed\\/|watch\\?v=|&v=)([^#&?]*).*/);
    return match && match[2].length === 11 ? match[2] : null;
  };
  
  const videoId = getVideoId(url);

  // Inizializzazione Player YouTube
  const initPlayer = useCallback((vId) => {
    if (!window.YT || !window.YT.Player) {
      // Se l'API non è pronta, riprova tra poco
      setTimeout(() => initPlayer(vId), 200);
      return;
    }

    if (playerRef.current) {
      try { playerRef.current.destroy(); } catch (e) {}
    }

    playerRef.current = new window.YT.Player('karaoke-iframe-inner', {
      videoId: vId,
      playerVars: {
        autoplay: 1,
        controls: 0,
        disablekb: 1,
        fs: 0,
        rel: 0,
        modestbranding: 1,
        iv_load_policy: 3
      },
      events: {
        onReady: (event) => {
          playerReadyRef.current = true;
          event.target.playVideo();
          if (isMuted) event.target.mute();
          event.target.setVolume(volume);
        },
        onError: (e) => console.error('YouTube Player Error:', e)
      }
    });
    currentVideoIdRef.current = vId;
  }, [isMuted, volume]);

  // Gestione caricamento script YouTube
  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    }
  }, []);

  // Monitora cambio canzone o reset
  useEffect(() => {
    if (videoId && videoId !== currentVideoIdRef.current) {
      initPlayer(videoId);
    }
  }, [videoId, initPlayer]);

  // Gestione controlli Live (Play/Pause/Mute/Seek)
  useEffect(() => {
    if (!playerRef.current || !playerReadyRef.current) return;

    try {
      // A. GESTIONE PLAY/PAUSE
      if (status === 'live') {
        playerRef.current.playVideo();
      } else if (status === 'paused' || status === 'voting') {
        // In fase di voto lo lasciamo andare o lo mettiamo in pausa a scelta? 
        // Per l'effetto "Show" lo lasciamo andare ma sfuocato (gestito dai CSS del padre)
      }

      // B. SINCRONIZZAZIONE (Seek)
      if (startedAt && lastStartedAtRef.current !== startedAt) {
        lastStartedAtRef.current = startedAt;
        playerRef.current.seekTo(0, true);
      }

      // C. VOLUME/MUTE
      if (isMuted) {
        playerRef.current.mute();
      } else {
        playerRef.current.unMute();
        playerRef.current.setVolume(volume);
      }
    } catch (e) {
      console.warn('Playback control error:', e);
    }
  }, [status, isMuted, startedAt, volume]);

  if (!videoId) return null;

  return (
    <div className="absolute inset-0 bg-black overflow-hidden pointer-events-none">
      {/* Contenitore interno con key per forzare il refresh solo se cambia il videoId */}
      <div 
        key={videoId}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[115%] h-[115%]"
      >
        <div id="karaoke-iframe-inner" className="w-full h-full pointer-events-none"></div>
      </div>
    </div>
  );
};

export default KaraokePlayer;