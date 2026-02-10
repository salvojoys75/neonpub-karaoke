import React, { useEffect, useRef, useState, useCallback } from 'react';
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

// EXPORT GLOBALE per controllo mute
window.quizPlayerRef = null;

const QuizMediaFixed = ({ mediaUrl, mediaType, isResult }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const playerRef = useRef(null);
  
  // CRITICO: Refs per prevenire reinizializzazioni
  const currentVideoIdRef = useRef(null);
  const isInitializedRef = useRef(false);
  const isPlayingRef = useRef(false);

  const detectedType = getMediaType(mediaUrl, mediaType);
  const isAudioMode = mediaType === 'audio';

  const cleanupPlayer = useCallback(() => {
    if (playerRef.current) {
      try { playerRef.current.destroy(); } catch (e) {}
      playerRef.current = null;
      window.quizPlayerRef = null;
    }
  }, []);

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
    if (isResult) { cleanupPlayer(); return; }
    if (detectedType !== 'youtube') { setIsLoading(false); return; }

    const videoId = getYoutubeId(mediaUrl);
    if (!videoId) { setIsLoading(false); return; }

    // CRITICO: Se è lo stesso video e sta funzionando, NON reinizializzare
    if (currentVideoIdRef.current === videoId && isPlayingRef.current && playerRef.current) {
      return;
    }

    // Se è un nuovo video, resetta
    if (currentVideoIdRef.current !== videoId) {
      currentVideoIdRef.current = videoId;
      isInitializedRef.current = false;
      isPlayingRef.current = false;
      cleanupPlayer();
    }

    if (isInitializedRef.current) return;
    isInitializedRef.current = true;

    const initPlayer = () => {
      const container = document.getElementById('quiz-fixed-player');
      if (!container || !window.YT?.Player) {
        setTimeout(initPlayer, 100);
        return;
      }

      if (playerRef.current) {
        try { playerRef.current.destroy(); } catch (e) {}
      }

      playerRef.current = new window.YT.Player('quiz-fixed-player', {
        videoId: videoId,
        playerVars: {
          autoplay: 1, controls: 0, disablekb: 1, fs: 0, iv_load_policy: 3,
          modestbranding: 1, rel: 0, showinfo: 0, mute: 0, playsinline: 1,
          origin: window.location.origin
        },
        events: {
          onReady: (event) => {
            window.quizPlayerRef = playerRef.current;
            event.target.setVolume(100);
            event.target.unMute();
            setTimeout(() => {
              setAudioBlocked(event.target.isMuted());
            }, 500);
            event.target.playVideo();
            setIsLoading(false);
          },
          onStateChange: (event) => {
            if (event.data === 1) {
              isPlayingRef.current = true;
              setIsLoading(false);
              if (!event.target.isMuted()) setAudioBlocked(false);
            } else if (event.data === 0) {
              isPlayingRef.current = false;
            }
          },
          onError: () => { setIsLoading(false); isPlayingRef.current = false; }
        }
      });
    };

    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      document.getElementsByTagName('script')[0].parentNode.insertBefore(tag, document.getElementsByTagName('script')[0]);
      window.onYouTubeIframeAPIReady = initPlayer;
    } else {
      initPlayer();
    }
  }, [mediaUrl, isResult, detectedType, cleanupPlayer]);

  useEffect(() => {
    return () => {
      cleanupPlayer();
      currentVideoIdRef.current = null;
      isInitializedRef.current = false;
      isPlayingRef.current = false;
    };
  }, [cleanupPlayer]);

  if (isResult) return null;

  if (detectedType === 'youtube') {
    return (
      <div className="absolute inset-0 bg-black flex items-center justify-center">
        <div id="quiz-fixed-player" className={`absolute inset-0 w-full h-full ${isAudioMode ? 'opacity-0' : ''}`} style={{ pointerEvents: 'none' }} />
        
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
            <Loader2 className="w-16 h-16 text-fuchsia-500 animate-spin" />
          </div>
        )}
        
        {audioBlocked && !isLoading && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 bg-fuchsia-600 hover:bg-fuchsia-700 text-white px-8 py-4 rounded-full cursor-pointer flex items-center gap-3 shadow-2xl animate-pulse" onClick={handleUnblockAudio}>
            <Volume2 className="w-6 h-6" />
            <span className="font-bold text-lg">CLICCA QUI PER ATTIVARE L'AUDIO</span>
          </div>
        )}
        
        {isAudioMode && !isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-purple-900 to-black z-5">
            <Music className="w-32 h-32 text-fuchsia-400" />
            <p className="mt-6 text-3xl text-fuchsia-300 font-bold">Ascolta la traccia</p>
          </div>
        )}
      </div>
    );
  }

  return <div className="absolute inset-0 bg-black" />;
};

export default QuizMediaFixed;