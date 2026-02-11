import React, { useEffect, useRef, useState } from 'react';

const KaraokePlayer = ({ url, status, volume = 100 }) => {
  const playerRef = useRef(null);
  const containerRef = useRef(null);
  // Estrae ID video
  const videoId = url ? (url.match(/^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/) || [])[2] : null;

  useEffect(() => {
    if (!videoId) return;

    // Carica API se manca
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      document.body.appendChild(tag);
    }

    const initPlayer = () => {
      // Se il player esiste già per QUESTO video, non ricrearlo
      if (playerRef.current && playerRef.current.getIframe() && playerRef.current.getIframe().id === 'karaoke-iframe') {
         // Gestione stati play/pause su player esistente
         if (status === 'live') playerRef.current.playVideo();
         if (status === 'paused') playerRef.current.pauseVideo();
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
          iv_load_policy: 3,
          modestbranding: 1,
          rel: 0,
          showinfo: 0,
          mute: 0,
          playsinline: 1
        },
        events: {
          onReady: (event) => {
            event.target.setVolume(volume);
            if (status === 'live') event.target.playVideo();
            else event.target.pauseVideo();
          },
          onStateChange: (event) => {
             // Opzionale: sincronizzazione fine
          }
        }
      });
    };

    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      window.onYouTubeIframeAPIReady = initPlayer;
    }

    // Cleanup solo se cambia video ID drasticamente
    return () => {
       // Non distruggiamo qui per evitare flash neri tra render
    };
  }, [videoId]);

  // Effetto separato per gestire SOLO lo stato Play/Pause senza ricaricare video
  useEffect(() => {
    if (playerRef.current && typeof playerRef.current.playVideo === 'function') {
        if (status === 'live') playerRef.current.playVideo();
        if (status === 'paused') playerRef.current.pauseVideo();
        if (status === 'voting' || status === 'ended') playerRef.current.pauseVideo();
    }
  }, [status]);

  if (!videoId) return null;

  return (
    <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden bg-black">
      <div id="karaoke-iframe" className="w-full h-full scale-[1.05]" /> 
      {/* Overlay leggero per uniformare luminosità */}
      <div className="absolute inset-0 bg-black/20" />
    </div>
  );
};

export default KaraokePlayer;