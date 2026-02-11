import React, { useEffect, useRef } from 'react';

const KaraokePlayer = ({ url, status, volume = 100, isMuted, startedAt }) => {
  const playerRef = useRef(null);
  // Estrae l'ID video in modo sicuro
  const videoId = url ? (url.match(/^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/) || [])[2] : null;
  const lastVideoIdRef = useRef(null);
  const lastStatusRef = useRef(null);

  useEffect(() => {
    if (!videoId) return;

    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      document.body.appendChild(tag);
    }

    const initPlayer = () => {
      // Se il player esiste già, non ricrearlo, ma controlla se il video è cambiato
      if (playerRef.current && playerRef.current.loadVideoById) {
          if (lastVideoIdRef.current !== videoId) {
              playerRef.current.loadVideoById(videoId);
              lastVideoIdRef.current = videoId;
          }
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
        }
      });
      lastVideoIdRef.current = videoId;
    };

    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      window.onYouTubeIframeAPIReady = initPlayer;
    }
  }, [videoId, volume, isMuted, status]);

  // Gestione Comandi in tempo reale
  useEffect(() => {
    if (!playerRef.current || typeof playerRef.current.getPlayerState !== 'function') return;

    // FORZA IL PLAY se lo stato è live, specialmente dopo un quiz
    if (status === 'live') {
        // Se non sta già suonando (stato 1), forza play
        if (playerRef.current.getPlayerState() !== 1) {
            playerRef.current.playVideo();
        }
    } else if (status === 'paused' || status === 'voting') {
        playerRef.current.pauseVideo();
    }

    // Gestione Mute
    if (isMuted) playerRef.current.mute();
    else {
        playerRef.current.unMute();
        playerRef.current.setVolume(volume);
    }
    
    // Gestione Riavvio (Restart)
    if (startedAt && lastStatusRef.current !== startedAt) {
        playerRef.current.seekTo(0);
        playerRef.current.playVideo();
        lastStatusRef.current = startedAt;
    }

  }, [status, isMuted, startedAt, volume]);

  if (!videoId) return null;

  return (
    <div className="absolute inset-0 z-0 overflow-hidden bg-black pointer-events-none">
      <div id="karaoke-iframe" className="w-full h-full scale-[1.01]" /> 
      {/* Overlay leggero per uniformare */}
      <div className="absolute inset-0 bg-black/10" />
    </div>
  );
};

export default KaraokePlayer;