import React, { useEffect, useRef } from 'react';

const KaraokePlayer = ({ url, status, volume = 100, isMuted, startedAt }) => {
  const playerRef = useRef(null);
  // Estrae ID video in modo sicuro
  const videoId = url ? (url.match(/^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/) || [])[2] : null;
  
  const lastVideoIdRef = useRef(null);
  const lastStatusRef = useRef(null);

  // 1. Inizializzazione Player
  useEffect(() => {
    if (!videoId) return;

    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      document.body.appendChild(tag);
    }

    const initPlayer = () => {
      // Se il player esiste già
      if (playerRef.current && playerRef.current.loadVideoById) {
          // Se è cambiato il video, caricalo
          if (lastVideoIdRef.current !== videoId) {
              // Reset completo per evitare conflitti con video precedenti
              playerRef.current.loadVideoById({
                  videoId: videoId,
                  startSeconds: 0
              });
              lastVideoIdRef.current = videoId;
          }
          return;
      }

      // Crea nuovo player
      playerRef.current = new window.YT.Player('karaoke-iframe', {
        videoId: videoId,
        width: '100%',
        height: '100%',
        playerVars: {
          autoplay: 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
          iv_load_policy: 3, // Nascondi annotazioni
          modestbranding: 1,
          rel: 0,
          showinfo: 0,
          mute: 0,
          playsinline: 1,
          origin: window.location.origin
        },
        events: {
          onReady: (event) => {
            event.target.setVolume(volume);
            if (isMuted) event.target.mute();
            if (status === 'live') event.target.playVideo();
          },
          onStateChange: (event) => {
             // 1 = Playing. Se lo stato dice live ma il video si ferma, lo forziamo?
             // Per ora lasciamo la gestione standard YT
          }
        }
      });
      lastVideoIdRef.current = videoId;
    };

    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      window.onYouTubeIframeAPIReady = initPlayer;
    }
  }, [videoId]); // Re-inizializza solo se cambia ID video

  // 2. Gestione Comandi Real-time (Play/Pause/Mute/Restart)
  useEffect(() => {
    if (!playerRef.current || typeof playerRef.current.getPlayerState !== 'function') return;

    // A. GESTIONE PLAY/PAUSE FORZATA
    if (status === 'live') {
        // Se non sta suonando (state != 1) e non sta buffernado (state != 3), forza play
        const state = playerRef.current.getPlayerState();
        if (state !== 1 && state !== 3) {
            playerRef.current.playVideo();
        }
    } else if (status === 'paused' || status === 'voting' || status === 'ended') {
        playerRef.current.pauseVideo();
    }

    // B. GESTIONE RESTART (Riavvolgi)
    // Se il timestamp di start è cambiato rispetto all'ultima volta, significa "Ricomincia"
    if (startedAt && lastStatusRef.current !== startedAt) {
        playerRef.current.seekTo(0);
        playerRef.current.playVideo();
        lastStatusRef.current = startedAt;
    }

    // C. GESTIONE MUTE/VOLUME
    if (isMuted) {
        playerRef.current.mute();
    } else {
        playerRef.current.unMute();
        playerRef.current.setVolume(volume);
    }

  }, [status, isMuted, startedAt, volume, videoId]); // Esegue ogni volta che cambia uno stato

  if (!videoId) return null;

  return (
    <div className="absolute inset-0 z-0 overflow-hidden bg-black pointer-events-none">
      {/* Scale leggero per rimuovere bordi neri dei video 4:3 su schermi 16:9 */}
      <div id="karaoke-iframe" className="w-full h-full scale-[1.02]" /> 
      {/* Overlay leggerissimo per uniformare il contrasto del testo sovraimpresso */}
      <div className="absolute inset-0 bg-black/10" />
    </div>
  );
};

export default KaraokePlayer;