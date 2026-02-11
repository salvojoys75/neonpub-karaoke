import React, { useEffect, useRef, useState, useCallback, memo } from 'react';
import { Loader2, Music, Volume2 } from 'lucide-react';

// Helper per estrarre ID YouTube
const getYoutubeId = (url) => {
  if (!url) return null;
  const regExp = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
};

// Helper per determinare tipo media
const getMediaType = (url, type) => {
  if (type === 'audio') return 'audio';
  if (type === 'video' || (url && (url.includes('youtube.com') || url.includes('youtu.be')))) {
    return 'youtube';
  }
  return 'unknown';
};

const QuizMediaFixed = memo(({ mediaUrl, mediaType, isResult }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [audioBlocked, setAudioBlocked] = useState(false);
  
  // Refs per gestire lo stato senza re-render
  const playerRef = useRef(null);
  const currentVideoIdRef = useRef(null);
  const isInitializedRef = useRef(false);
  const isPlayingRef = useRef(false);

  const detectedType = getMediaType(mediaUrl, mediaType);
  const isAudioMode = mediaType === 'audio';
  const videoId = getYoutubeId(mediaUrl);

  // Cleanup function
  const cleanupPlayer = useCallback(() => {
    if (playerRef.current) {
      try {
        if (typeof playerRef.current.destroy === 'function') {
          playerRef.current.destroy();
        }
      } catch (e) {
        // Ignora errori di distruzione
      }
      playerRef.current = null;
    }
  }, []);

  // Sblocco Audio manuale (policy browser)
  const handleUnblockAudio = useCallback(() => {
    if (playerRef.current && typeof playerRef.current.unMute === 'function') {
      try {
        playerRef.current.unMute();
        playerRef.current.setVolume(100);
        playerRef.current.playVideo();
        setAudioBlocked(false);
      } catch (e) {
        console.warn('Errore unblock audio:', e);
      }
    }
  }, []);

  useEffect(() => {
    // Se non c'è URL, usciamo
    if (!mediaUrl) return;

    if (detectedType !== 'youtube' || !videoId) {
      setIsLoading(false);
      return;
    }

    // LOGICA ANTI-RIAVVIO
    // Se l'ID è lo stesso e il player esiste, NON fare nulla.
    if (currentVideoIdRef.current === videoId && playerRef.current) {
      // Assicuriamoci solo che stia suonando se non siamo nella schermata risultati
      if (!isResult && playerRef.current.getPlayerState && playerRef.current.getPlayerState() !== 1) {
          try { playerRef.current.playVideo(); } catch(e){}
      }
      return;
    }

    // NUOVO VIDEO: Reset controllato
    currentVideoIdRef.current = videoId;
    isInitializedRef.current = false;
    isPlayingRef.current = false;
    setIsLoading(true);
    cleanupPlayer();

    // Inizializzazione API YouTube
    const initPlayer = () => {
      if (!window.YT || !window.YT.Player) {
        setTimeout(initPlayer, 100);
        return;
      }

      if (isInitializedRef.current) return;
      isInitializedRef.current = true;

      try {
        // Verifica esistenza elemento DOM
        if(!document.getElementById('quiz-fixed-player')) return;

        playerRef.current = new window.YT.Player('quiz-fixed-player', {
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
                if (event.target.isMuted && event.target.isMuted()) {
                  setAudioBlocked(true);
                } else {
                  setAudioBlocked(false);
                }
              }, 800);
            },
            onStateChange: (event) => {
              if (event.data === 1) { // PLAYING
                setIsLoading(false);
                setAudioBlocked(false);
                isPlayingRef.current = true;
              }
            },
            onError: (e) => {
              console.error("YT Error:", e);
              setIsLoading(false);
            }
          }
        });
      } catch (e) {
        console.error("Player creation error:", e);
        setIsLoading(false);
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
      // Non distruggiamo al cleanup dell'effetto per evitare flash
    };
  }, [mediaUrl, detectedType, videoId, cleanupPlayer, isResult]);

  // Se non c'è media, niente da renderizzare
  if (!mediaUrl) return null;

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* BACKGROUND YOUTUBE CONTAINER */}
      {detectedType === 'youtube' && (
        <div className="absolute inset-0 bg-black flex items-center justify-center">
           {/* Maschera opaca per migliorare leggibilità testo sopra */}
          <div className="absolute inset-0 bg-black/60 z-10" />
          
          <div 
            id="quiz-fixed-player" 
            className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] object-cover ${isAudioMode ? 'opacity-0' : 'opacity-60'}`}
          />
          
          {/* Loader */}
          {isLoading && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-black">
              <Loader2 className="w-16 h-16 text-fuchsia-500 animate-spin" />
            </div>
          )}

          {/* Audio Block Warning */}
          {audioBlocked && (
            <div className="absolute top-10 left-1/2 -translate-x-1/2 z-50 pointer-events-auto">
              <button 
                onClick={handleUnblockAudio}
                className="bg-red-600 text-white px-6 py-2 rounded-full font-bold animate-bounce flex items-center gap-2 shadow-lg hover:bg-red-700 transition"
              >
                <Volume2 className="w-5 h-5" /> CLICCA PER AUDIO
              </button>
            </div>
          )}
        </div>
      )}

      {/* AUDIO VISUALIZER PLACEHOLDER */}
      {isAudioMode && !isLoading && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-gradient-to-t from-fuchsia-900/50 to-black">
          <div className="relative">
            <div className="absolute inset-0 bg-fuchsia-500 rounded-full blur-3xl animate-pulse opacity-40"></div>
            <Music className="w-32 h-32 text-white relative z-10 animate-bounce" />
          </div>
          <p className="mt-8 text-2xl text-fuchsia-200 font-mono tracking-widest uppercase">Audio Question</p>
        </div>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  // Rerenderizza SOLO se cambia URL o isResult
  return prevProps.mediaUrl === nextProps.mediaUrl && 
         prevProps.mediaType === nextProps.mediaType &&
         prevProps.isResult === nextProps.isResult; 
});

export default QuizMediaFixed;