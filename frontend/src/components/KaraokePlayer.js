import React, { useEffect, useRef, useState } from 'react';

const KaraokePlayer = ({ url, status, volume = 100, isMuted, startedAt }) => {
  const playerRef = useRef(null);
  const videoId = url ? (url.match(/^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/) || [])[2] : null;
  
  // Per tracciare se abbiamo già fatto seek(0) per questo startedAt
  const lastStartedAtRef = useRef(startedAt);

  useEffect(() => {
    if (!videoId) return;

    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      document.body.appendChild(tag);
    }

    const initPlayer = () => {
      // Se esiste già, non ricrearlo, aggiorna solo stato
      if (playerRef.current && playerRef.current.getIframe()) {
         return;
      }

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
          mute: 0, // Iniziamo senza mute
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
             // 0 = Ended
             if (event.data === 0) {
                 // Opzionale: notifica fine video
             }
          }
        }
      });
    };

    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      window.onYouTubeIframeAPIReady = initPlayer;
    }
  }, [videoId]);

  // Gestione Comandi in tempo reale (Play/Pause/Restart/Mute)
  useEffect(() => {
    if (!playerRef.current || typeof playerRef.current.getPlayerState !== 'function') return;

    // 1. Gestione Play/Pause
    if (status === 'live') {
        playerRef.current.playVideo();
    } else if (status === 'paused' || status === 'voting') {
        playerRef.current.pauseVideo();
    }

    // 2. Gestione Riavvio (Se cambia il timestamp startedAt)
    if (startedAt !== lastStartedAtRef.current) {
        console.log("Riavvolgimento video...");
        playerRef.current.seekTo(0);
        playerRef.current.playVideo();
        lastStartedAtRef.current = startedAt;
    }

    // 3. Gestione Mute Globale
    if (isMuted) {
        playerRef.current.mute();
    } else {
        playerRef.current.unMute();
        playerRef.current.setVolume(volume);
    }

  }, [status, isMuted, startedAt, volume]);

  if (!videoId) return null;

  return (
    <div className="absolute inset-0 z-0 overflow-hidden bg-black pointer-events-none">
      {/* Scale 1.1 per rimuovere bordi neri eventuali */}
      <div id="karaoke-iframe" className="w-full h-full scale-[1.02]" /> 
      {/* Overlay scuro leggero per migliorare leggibilità testi */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/40 opacity-80" />
    </div>
  );
};

export default KaraokePlayer;