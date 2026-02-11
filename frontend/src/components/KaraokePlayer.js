import React, { useEffect, useRef, useCallback } from 'react';

const KaraokePlayer = ({ url, status, volume = 100, isMuted, startedAt }) => {
  const playerRef = useRef(null);
  const playerReadyRef = useRef(false);
  const currentVideoIdRef = useRef(null);
  const lastStartedAtRef = useRef(null);
  
  const getVideoId = (url) => {
    if (!url) return null;
    const match = url.match(/^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/);
    return match && match[2].length === 11 ? match[2] : null;
  };
  
  const videoId = getVideoId(url);

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

  useEffect(() => {
    if (!videoId) {
      cleanupPlayer();
      return;
    }

    if (currentVideoIdRef.current === videoId && playerRef.current && playerReadyRef.current) {
      return;
    }

    currentVideoIdRef.current = videoId;
    playerReadyRef.current = false;
    cleanupPlayer();

    const initPlayer = () => {
      if (!window.YT || !window.YT.Player) {
        setTimeout(initPlayer, 100);
        return;
      }

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
              
              event.target.setVolume(volume);
              if (isMuted) {
                event.target.mute();
              } else {
                event.target.unMute();
              }
              
              if (status === 'live') {
                event.target.playVideo();
              }
            },
            onStateChange: (event) => {
            },
            onError: (event) => {
              console.error('YouTube Player Error:', event.data);
            }
          }
        });
      } catch (e) {
        console.error('Player creation error:', e);
      }
    };

    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      document.body.appendChild(tag);
      window.onYouTubeIframeAPIReady = initPlayer;
    } else {
      initPlayer();
    }

    return () => {
      if (currentVideoIdRef.current !== videoId) {
        cleanupPlayer();
      }
    };
  }, [videoId]);

  useEffect(() => {
    if (!playerRef.current || !playerReadyRef.current) return;
    if (typeof playerRef.current.getPlayerState !== 'function') return;

    try {
      const currentState = playerRef.current.getPlayerState();
      
      if (status === 'live') {
        if (currentState !== 1 && currentState !== 3) {
          playerRef.current.playVideo();
        }
      } else if (status === 'paused' || status === 'voting' || status === 'ended') {
        if (currentState === 1) {
          playerRef.current.pauseVideo();
        }
      }

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
  }, [status, isMuted, startedAt, volume]);

  if (!videoId) return null;

  return (
    <div className="absolute inset-0 z-0 overflow-hidden bg-black pointer-events-none">
      <div 
        id="karaoke-iframe" 
        className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[110%] h-[110%]"
        style={{ minWidth: '100%', minHeight: '100%' }}
      />
      
      <div className="absolute inset-0 bg-black/20 pointer-events-none" />
    </div>
  );
};

export default KaraokePlayer;