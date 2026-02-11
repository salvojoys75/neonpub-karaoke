import React, { useEffect, useRef, useCallback } from 'react';

// ===========================================
// KARAOKE PLAYER - VERSIONE ULTRA STABILE
// ===========================================
// Gestisce video YouTube in modo professionale senza ricaricamenti

const KaraokePlayer = ({ url, status, volume = 100, isMuted, startedAt }) => {
  const playerRef = useRef(null);
  const playerReadyRef = useRef(false);
  const currentVideoIdRef = useRef(null);
  const lastStartedAtRef = useRef(null);
  
  // Estrae ID video in modo sicuro
  const getVideoId = (url) => {
    if (!url) return null;
    const match = url.match(/^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/);
    return match && match[2].length === 11 ? match[2] : null;
  };
  
  const videoId = getVideoId(url);

  // Cleanup player
  const cleanupPlayer = useCallback(() => {
    if (playerRef.current) {
      try {
        if (typeof playerRef.current.destroy === 'function') {
          playerRef.current.destroy();
        }
      } catch (e) {
        console.warn('Player cleanup error:', e);
      }
      playerRef.current = null;
      playerReadyRef.current = false;
    }
  }, []);

  // ========================================
  // EFFECT 1: Inizializzazione Player
  // ========================================
  useEffect(() => {
    if (!videoId) {
      cleanupPlayer();
      return;
    }

    // Se è lo stesso video e il player esiste, NON ricreare
    if (currentVideoIdRef.current === videoId && playerRef.current && playerReadyRef.current) {
      return;
    }

    // Nuovo video: reset
    currentVideoIdRef.current = videoId;
    playerReadyRef.current = false;
    cleanupPlayer();

    // Inizializza YouTube API
    const initPlayer = () => {
      if (!window.YT || !window.YT.Player) {
        setTimeout(initPlayer, 100);
        return;
      }

      // Verifica elemento DOM
      const element = document.getElementById('karaoke-iframe');
      if (!element) {
        setTimeout(initPlayer, 100);
        return;
      }

      try {
        playerRef.current = new window.YT.Player('karaoke-iframe', {
          videoId: videoId,
          width: '100%',
          height: '100%',
          playerVars: {
            autoplay: 1,
            controls: 0,
            disablekb: 1,
            fs: 0,
            iv_load_policy: 3,
            modestbranding: 1,
            rel: 0,
            showinfo: 0,
            mute: 0,
            playsinline: 1,
            origin: window.location.origin
          },
          events: {
            onReady: (event) => {
              playerReadyRef.current = true;
              
              // Imposta volume
              event.target.setVolume(volume);
              if (isMuted) {
                event.target.mute();
              } else {
                event.target.unMute();
              }
              
              // Play se status è live
              if (status === 'live') {
                event.target.playVideo();
              }
            },
            onStateChange: (event) => {
              // Gestione stati YouTube
              // 1 = Playing, 2 = Paused, 3 = Buffering
              if (status === 'live' && event.data === 2) {
                // Se dovrebbe essere live ma è in pausa, riprendi
                setTimeout(() => {
                  if (playerRef.current && typeof playerRef.current.playVideo === 'function') {
                    playerRef.current.playVideo();
                  }
                }, 100);
              }
            },
            onError: (event) => {
              console.error('YouTube Player Error:', event.data);
              // Error codes: 2=Invalid param, 5=HTML5 error, 100=Not found, 101/150=Not allowed
            }
          }
        });
      } catch (e) {
        console.error('Player creation error:', e);
      }
    };

    // Carica API se necessario
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      document.body.appendChild(tag);
      window.onYouTubeIframeAPIReady = initPlayer;
    } else {
      initPlayer();
    }

    // Non cleanup al unmount per evitare flash
    return () => {
      // Solo se cambia veramente video
      if (currentVideoIdRef.current !== videoId) {
        cleanupPlayer();
      }
    };
  }, [videoId]); // Solo quando cambia il video ID

  // ========================================
  // EFFECT 2: Gestione Comandi Real-time
  // ========================================
  useEffect(() => {
    if (!playerRef.current || !playerReadyRef.current) return;
    if (typeof playerRef.current.getPlayerState !== 'function') return;

    try {
      // A. GESTIONE PLAY/PAUSE
      const currentState = playerRef.current.getPlayerState();
      
      if (status === 'live') {
        // Dovrebbe suonare
        if (currentState !== 1 && currentState !== 3) { // 1=Playing, 3=Buffering
          playerRef.current.playVideo();
        }
      } else if (status === 'paused' || status === 'voting' || status === 'ended') {
        // Dovrebbe essere in pausa
        if (currentState === 1) {
          playerRef.current.pauseVideo();
        }
      }

      // B. GESTIONE RESTART
      // REMOVED: startedAt check causes unwanted restart on pause/resume
      // Video restart is handled by videoId change in first effect

      // C. GESTIONE MUTE/VOLUME
      if (isMuted) {
        if (!playerRef.current.isMuted()) {
          playerRef.current.mute();
        }
      } else {
        if (playerRef.current.isMuted()) {
          playerRef.current.unMute();
        }
        playerRef.current.setVolume(volume);
      }
    } catch (e) {
      console.warn('Control error:', e);
    }
  }, [status, isMuted, startedAt, volume]); // Re-esegui solo quando cambia uno stato di controllo

  // ========================================
  // RENDER
  // ========================================
  if (!videoId) return null;

  return (
    <div className="absolute inset-0 z-0 overflow-hidden bg-black pointer-events-none">
      {/* Player Container - Leggermente ingrandito per eliminare barre nere */}
      <div 
        id="karaoke-iframe" 
        className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[110%] h-[110%]"
        style={{ minWidth: '100%', minHeight: '100%' }}
      />
      
      {/* Overlay leggero per migliorare contrasto testo */}
      <div className="absolute inset-0 bg-black/20 pointer-events-none" />
    </div>
  );
};

export default KaraokePlayer;