import React, { useEffect, useRef, useState, useCallback, memo } from 'react';
import { Loader2, Music, Volume2 } from 'lucide-react';

// Helper per estrarre ID YouTube
const getYoutubeId = (url) => {
  if (!url) return null;
  const regExp = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
};

// Helper per estrarre ID Spotify
const getSpotifyId = (url) => {
  if (!url) return null;
  // Supporta formati: spotify:track:ID, https://open.spotify.com/track/ID, o solo l'ID
  const trackMatch = url.match(/(?:spotify:track:|track\/)([a-zA-Z0-9]+)/);
  if (trackMatch) return trackMatch[1];
  // Se è già un ID puro (22 caratteri alfanumerici)
  if (/^[a-zA-Z0-9]{22}$/.test(url)) return url;
  return null;
};

// Helper per determinare tipo media
const getMediaType = (url, type) => {
  if (!url) return 'unknown';
  
  // Se è specificato come audio o video, rispetta quello
  if (type === 'audio') {
    // Controlla se è Spotify
    if (url.includes('spotify') || url.match(/^[a-zA-Z0-9]{22}$/)) {
      return 'spotify';
    }
    // Altrimenti è YouTube audio
    return 'youtube';
  }
  
  if (type === 'spotify') return 'spotify';
  
  if (type === 'video' || url.includes('youtube.com') || url.includes('youtu.be')) {
    return 'youtube';
  }
  
  // Auto-detect Spotify
  if (url.includes('spotify') || url.match(/^[a-zA-Z0-9]{22}$/)) {
    return 'spotify';
  }
  
  return 'unknown';
};

// ====================================================
// SPOTIFY PLAYER COMPONENT
// ====================================================
const SpotifyPlayer = memo(({ trackId, isBackground = true }) => {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Spotify embed si carica automaticamente
    const timer = setTimeout(() => setIsLoading(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="absolute inset-0 bg-black flex items-center justify-center overflow-hidden">
      {/* Overlay scuro solo in modalità background */}
      {isBackground && <div className="absolute inset-0 bg-black/50 z-10 pointer-events-none" />}
      
      {/* Spotify Embed */}
      <div className="absolute inset-0 flex items-center justify-center z-20">
        <iframe
          src={`https://open.spotify.com/embed/track/${trackId}?utm_source=generator&theme=0`}
          width="100%"
          height="152"
          frameBorder="0"
          allowFullScreen=""
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
          className="max-w-md"
          style={{ borderRadius: '12px' }}
        />
      </div>
      
      {/* Loader */}
      {isLoading && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black">
          <Loader2 className="w-16 h-16 text-fuchsia-500 animate-spin" />
        </div>
      )}

      {/* Audio mode overlay */}
      {!isLoading && (
        <div className="absolute inset-0 z-15 flex flex-col items-center justify-center bg-gradient-to-t from-green-900/30 to-black pointer-events-none">
          <div className="relative mb-32">
            <div className="absolute inset-0 bg-green-500 rounded-full blur-3xl animate-pulse opacity-40" />
            <Music className="w-32 h-32 text-white relative z-10" />
          </div>
        </div>
      )}
    </div>
  );
}, (prev, next) => {
  return prev.trackId === next.trackId;
});

// ====================================================
// YOUTUBE PLAYER COMPONENT - Completamente isolato
// Non si re-renderizza MAI a meno che cambi l'URL
// ====================================================
const YouTubePlayer = memo(({ videoId, isAudioMode, isBackground = true }) => {
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
              if (event.data === 1) { // PLAYING
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

    // Carica API YouTube se necessario
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

    // Cleanup SOLO on unmount definitivo
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
      {/* Overlay scuro solo in modalità background */}
      {isBackground && <div className="absolute inset-0 bg-black/50 z-10 pointer-events-none" />}
      
      {/* Container YouTube */}
      <div 
        id={containerIdRef.current}
        className={isBackground
          ? `absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] ${isAudioMode ? 'opacity-0' : 'opacity-70'}`
          : `absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full h-full ${isAudioMode ? 'opacity-0' : 'opacity-100'}`
        }
        style={{ pointerEvents: 'none' }}
      />
      
      {/* Loader */}
      {isLoading && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black">
          <Loader2 className="w-16 h-16 text-fuchsia-500 animate-spin" />
        </div>
      )}

      {/* Audio Block Warning */}
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

      {/* Audio mode overlay */}
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

// ====================================================
// QUIZ MEDIA FIXED - Componente principale
// Supporta YouTube E Spotify
// ====================================================
const QuizMediaFixed = memo(({ mediaUrl, mediaType, isResult, isBackground = true }) => {
  const detectedType = getMediaType(mediaUrl, mediaType);
  
  // Se è risultato, non mostrare media
  if (isResult) return null;

  // Se non c'è media
  if (!mediaUrl) {
    return <div className="absolute inset-0 bg-black" />;
  }

  // SPOTIFY
  if (detectedType === 'spotify') {
    const trackId = getSpotifyId(mediaUrl);
    if (!trackId) {
      console.error('Invalid Spotify URL:', mediaUrl);
      return <div className="absolute inset-0 bg-black" />;
    }
    
    return (
      <SpotifyPlayer 
        key={trackId}
        trackId={trackId}
        isBackground={isBackground}
      />
    );
  }

  // YOUTUBE
  if (detectedType === 'youtube') {
    const videoId = getYoutubeId(mediaUrl);
    if (!videoId) {
      console.error('Invalid YouTube URL:', mediaUrl);
      return <div className="absolute inset-0 bg-black" />;
    }
    
    const isAudioMode = mediaType === 'audio';
    
    return (
      <YouTubePlayer 
        key={videoId}
        videoId={videoId} 
        isAudioMode={isAudioMode}
        isBackground={isBackground}
      />
    );
  }

  // Tipo sconosciuto
  return <div className="absolute inset-0 bg-black" />;
  
}, (prev, next) => {
  return prev.mediaUrl === next.mediaUrl && 
         prev.mediaType === next.mediaType &&
         prev.isResult === next.isResult &&
         prev.isBackground === next.isBackground;
});

export default QuizMediaFixed;