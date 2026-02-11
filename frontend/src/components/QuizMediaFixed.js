import React, { useEffect, useRef, useState, useCallback, memo } from 'react';
import { Loader2, Music, Volume2 } from 'lucide-react';

const getYoutubeId = (url) => {
  if (!url) return null;
  const regExp = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
};

const getMediaType = (url, type) => {
  if (type === 'audio') return 'audio';
  if (type === 'video' || (url && (url.includes('youtube.com') || url.includes('youtu.be')))) {
    return 'youtube';
  }
  return 'unknown';
};

const YouTubePlayer = memo(({ videoId, isAudioMode }) => {
  const playerRef = useRef(null);
  const containerIdRef = useRef(`yt-quiz-${Date.now()}`);
  const [isLoading, setIsLoading] = useState(true);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const isInitRef = useRef(false);

  const handleUnblockAudio = useCallback(() => {
    if (playerRef.current) {
      try {
        playerRef.current.unMute();
        playerRef.current.setVolume(100);
        playerRef.current.playVideo();
        setAudioBlocked(false);
      } catch (e) {}
    }
  }, []);

  useEffect(() => {
    if (!videoId || isInitRef.current) return;
    isInitRef.current = true;

    const containerId = containerIdRef.current;

    const initPlayer = () => {
      if (!window.YT || !window.YT.Player) {
        setTimeout(initPlayer, 150);
        return;
      }

      const el = document.getElementById(containerId);
      if (!el) {
        setTimeout(initPlayer, 150);
        return;
      }

      try {
        playerRef.current = new window.YT.Player(containerId, {
          videoId: videoId,
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
            origin: window.location.origin,
            loop: 1,
            playlist: videoId
          },
          events: {
            onReady: (event) => {
              event.target.setVolume(100);
              event.target.unMute();
              event.target.playVideo();

              setTimeout(() => {
                try {
                  if (event.target.isMuted && event.target.isMuted()) {
                    setAudioBlocked(true);
                  } else {
                    setAudioBlocked(false);
                  }
                } catch (e) {}
              }, 800);
            },
            onStateChange: (event) => {
              if (event.data === 1) {
                setIsLoading(false);
                try {
                  if (!event.target.isMuted()) {
                    setAudioBlocked(false);
                  }
                } catch (e) {}
              }
            },
            onError: () => {
              setIsLoading(false);
            }
          }
        });
      } catch (e) {
        setIsLoading(false);
      }
    };

    if (!window.YT) {
      if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(tag);
      }
      
      const prevCallback = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (prevCallback) prevCallback();
        initPlayer();
      };
    } else {
      initPlayer();
    }

    return () => {
      if (playerRef.current) {
        try {
          if (typeof playerRef.current.destroy === 'function') {
            playerRef.current.destroy();
          }
        } catch (e) {}
        playerRef.current = null;
      }
    };
  }, [videoId]);

  return (
    <div className="absolute inset-0 bg-black flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 bg-black/50 z-10 pointer-events-none" />
      
      <div 
        id={containerIdRef.current}
        className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] ${isAudioMode ? 'opacity-0' : 'opacity-70'}`}
        style={{ pointerEvents: 'none' }}
      />
      
      {isLoading && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black">
          <Loader2 className="w-16 h-16 text-fuchsia-500 animate-spin" />
        </div>
      )}

      {audioBlocked && !isLoading && (
        <div className="absolute top-10 left-1/2 -translate-x-1/2 z-50" style={{ pointerEvents: 'auto' }}>
          <button 
            onClick={handleUnblockAudio}
            className="bg-red-600 text-white px-6 py-3 rounded-full font-bold animate-bounce flex items-center gap-2 shadow-lg hover:bg-red-700 transition"
          >
            <Volume2 className="w-5 h-5" /> CLICCA PER ATTIVARE L'AUDIO
          </button>
        </div>
      )}

      {isAudioMode && !isLoading && (
        <div className="absolute inset-0 z-15 flex flex-col items-center justify-center bg-gradient-to-t from-fuchsia-900/50 to-black pointer-events-none">
          <div className="relative">
            <div className="absolute inset-0 bg-fuchsia-500 rounded-full blur-3xl animate-pulse opacity-40" />
            <Music className="w-32 h-32 text-white relative z-10" />
          </div>
          <p className="mt-8 text-2xl text-fuchsia-200 font-mono tracking-widest uppercase">Ascolta la traccia</p>
        </div>
      )}
    </div>
  );
}, (prev, next) => {
  return prev.videoId === next.videoId;
});

const QuizMediaFixed = memo(({ mediaUrl, mediaType, isResult }) => {
  const detectedType = getMediaType(mediaUrl, mediaType);
  const videoId = getYoutubeId(mediaUrl);
  const isAudioMode = mediaType === 'audio';

  if (isResult) return null;

  if (!mediaUrl || detectedType !== 'youtube' || !videoId) {
    return <div className="absolute inset-0 bg-black" />;
  }

  return (
    <YouTubePlayer 
      key={videoId}
      videoId={videoId} 
      isAudioMode={isAudioMode} 
    />
  );
}, (prev, next) => {
  return prev.mediaUrl === next.mediaUrl && 
         prev.mediaType === next.mediaType &&
         prev.isResult === next.isResult;
});

export default QuizMediaFixed;