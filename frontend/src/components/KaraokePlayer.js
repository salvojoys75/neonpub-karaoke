import React, { useEffect, useRef, useCallback } from 'react';

const KaraokePlayer = ({ url, status, volume = 100, isMuted, startedAt }) => {
  const playerRef = useRef(null);
  const playerReadyRef = useRef(false);
  const currentVideoIdRef = useRef(null);
  const lastStartedAtRef = useRef(null);
  
  const getVideoId = (url) => {
    if (!url) return null;
    const regExp = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };
  
  const videoId = getVideoId(url);

  const initPlayer = useCallback((vId) => {
    if (!window.YT || !window.YT.Player) {
      setTimeout(() => initPlayer(vId), 200);
      return;
    }
    if (playerRef.current) {
      try { playerRef.current.destroy(); } catch (e) {}
    }
    playerRef.current = new window.YT.Player('karaoke-iframe-inner', {
      videoId: vId,
      playerVars: { autoplay: 1, controls: 0, disablekb: 1, fs: 0, rel: 0, modestbranding: 1, iv_load_policy: 3 },
      events: {
        onReady: (event) => {
          playerReadyRef.current = true;
          event.target.playVideo();
          if (isMuted) event.target.mute();
          event.target.setVolume(volume);
        }
      }
    });
    currentVideoIdRef.current = vId;
  }, [isMuted, volume]);

  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    }
  }, []);

  useEffect(() => {
    if (videoId && videoId !== currentVideoIdRef.current) initPlayer(videoId);
  }, [videoId, initPlayer]);

  useEffect(() => {
    if (!playerRef.current || !playerReadyRef.current) return;
    try {
      if (status === 'live') playerRef.current.playVideo();
      if (startedAt && lastStartedAtRef.current !== startedAt) {
        lastStartedAtRef.current = startedAt;
        playerRef.current.seekTo(0, true);
      }
      if (isMuted) playerRef.current.mute(); else { playerRef.current.unMute(); playerRef.current.setVolume(volume); }
    } catch (e) {}
  }, [status, isMuted, startedAt, volume]);

  if (!videoId) return null;

  return (
    <div className="absolute inset-0 bg-black overflow-hidden pointer-events-none">
      <div key={videoId} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[115%] h-[115%]">
        <div id="karaoke-iframe-inner" className="w-full h-full"></div>
      </div>
    </div>
  );
};

export default KaraokePlayer;