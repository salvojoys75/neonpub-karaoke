import React, { useEffect, useRef, useState, useCallback, memo } from 'react';
import { Loader2, Music, Volume2, VolumeX } from 'lucide-react';

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
  const trackMatch = url.match(/(?:spotify:track:|track\/)([a-zA-Z0-9]+)/);
  if (trackMatch) return trackMatch[1];
  if (/^[a-zA-Z0-9]{22}$/.test(url)) return url;
  return null;
};

// Helper per determinare tipo media
const getMediaType = (url, type) => {
  if (!url) return 'unknown';
  
  if (type === 'audio') {
    if (url.includes('spotify') || url.match(/^[a-zA-Z0-9]{22}$/)) {
      return 'spotify';
    }
    return 'youtube';
  }
  
  if (type === 'spotify') return 'spotify';
  
  if (type === 'video' || url.includes('youtube.com') || url.includes('youtu.be')) {
    return 'youtube';
  }
  
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
  const [showPrompt, setShowPrompt] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="absolute inset-0 bg-black flex items-center justify-center overflow-hidden">
      
      <div className="absolute inset-0 flex items-center justify-center z-20" style={{ pointerEvents: 'auto' }}>
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
      
      {isLoading && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black">
          <Loader2 className="w-16 h-16 text-fuchsia-500 animate-spin" />
        </div>
      )}

      {!isLoading && showPrompt && (
        <div 
          className="fixed top-20 left-1/2 -translate-x-1/2 z-[9999]"
          onClick={() => setShowPrompt(false)}
          style={{ pointerEvents: 'auto', cursor: 'pointer' }}
        >
          <div className="bg-green-600 text-white px-6 py-4 rounded-full font-bold animate-pulse flex items-center gap-2 shadow-2xl border-4 border-white text-xl">
            <Music className="w-6 h-6" /> ▶️ Clicca PLAY sul widget qui sotto
          </div>
        </div>
      )}

      {!isLoading && (
        <div className="absolute inset-0 z-5 flex flex-col items-center justify-center bg-gradient-to-t from-green-900/30 to-black pointer-events-none">
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
// YOUTUBE PLAYER COMPONENT - VERSIONE CORRETTA
// Parte SEMPRE mutato, mostra bottone per unmute
// ====================================================
const YouTubePlayer = memo(({ videoId, isAudioMode, isBackground = true }) => {
  const playerRef = useRef(null);
  const containerIdRef = useRef(`yt-quiz-${Date.now()}`);
  const [isLoading, setIsLoading] = useState(true);
  const [isMuted, setIsMuted] = useState(true); // SEMPRE mutato all'inizio
  const [playerReady, setPlayerReady] = useState(false);
  const isInitRef = useRef(false);

  // Funzione per attivare l'audio
  const handleUnmute = useCallback(() => {
    console.log('🔊 Tentativo unmute...');
    if (playerRef.current && playerReady) {
      try {
        playerRef.current.unMute();
        playerRef.current.setVolume(100);
        playerRef.current.playVideo();
        setIsMuted(false);
        console.log('✅ Audio attivato!');
      } catch (e) {
        console.error('❌ Errore unmute:', e);
      }
    } else {
      console.warn('⚠️ Player non pronto');
    }
  }, [playerReady]);

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
        console.log('🎬 Inizializzo YouTube player...');
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
            mute: 1, // ⭐ PARTE SEMPRE MUTATO
            playsinline: 1,
            origin: window.location.origin,
            loop: 1,
            playlist: videoId
          },
          events: {
            onReady: (event) => {
              console.log('✅ YouTube player ready');
              setPlayerReady(true);
              event.target.setVolume(100);
              event.target.playVideo();
              setIsLoading(false);
            },
            onStateChange: (event) => {
              if (event.data === 1) { // PLAYING
                console.log('▶️ Video playing');
                setIsLoading(false);
              }
            },
            onError: (err) => {
              console.error('❌ YouTube error:', err);
              setIsLoading(false);
            }
          }
        });
      } catch (e) {
        console.error('❌ Errore init player:', e);
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

      {/* BOTTONE UNMUTE - SEMPRE VISIBILE finché è mutato */}
      {!isLoading && isMuted && playerReady && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[9999]" style={{ pointerEvents: 'auto' }}>
          <button 
            onClick={handleUnmute}
            className="bg-red-600 text-white px-8 py-6 rounded-full font-bold animate-bounce flex items-center gap-3 shadow-2xl hover:bg-red-700 transition text-2xl border-4 border-white"
          >
            <VolumeX className="w-8 h-8" /> CLICCA PER ATTIVARE L'AUDIO
          </button>
        </div>
      )}

      {/* Icona audio attivo */}
      {!isLoading && !isMuted && (
        <div className="fixed top-8 right-8 z-[9999] bg-green-600 text-white px-4 py-2 rounded-full flex items-center gap-2 shadow-lg">
          <Volume2 className="w-5 h-5" />
          <span className="font-bold">Audio attivo</span>
        </div>
      )}

      {/* Audio mode overlay */}
      {isAudioMode && !isLoading && (
        <div className="absolute inset-0 z-5 flex flex-col items-center justify-center bg-gradient-to-t from-fuchsia-900/50 to-black pointer-events-none">
          <div className="relative">
            <div className="absolute inset-0 bg-fuchsia-500 rounded-full blur-3xl animate-pulse opacity-40" />
            <Music className="w-32 h-32 text-white relative z-10" />
          </div>
        </div>
      )}
    </div>
  );
}, (prev, next) => {
  return prev.videoId === next.videoId;
});

// ====================================================
// QUIZ MEDIA FIXED - Componente principale
// ====================================================
const QuizMediaFixed = memo(({ mediaUrl, mediaType, isResult, isBackground = true }) => {
  const detectedType = getMediaType(mediaUrl, mediaType);
  
  if (isResult) return null;

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

  return <div className="absolute inset-0 bg-black" />;
  
}, (prev, next) => {
  return prev.mediaUrl === next.mediaUrl && 
         prev.mediaType === next.mediaType &&
         prev.isResult === next.isResult &&
         prev.isBackground === next.isBackground;
});

export default QuizMediaFixed;