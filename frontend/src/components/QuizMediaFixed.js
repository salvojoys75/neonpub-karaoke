import React, { useEffect, useRef, useState, useCallback } from 'react';
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
  if (url && (url.endsWith('.mp3') || url.endsWith('.wav') || url.endsWith('.ogg'))) {
    return 'audio_file';
  }
  return 'unknown';
};

const QuizMediaFixed = ({ mediaUrl, mediaType, isResult }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const playerRef = useRef(null);
  const containerRef = useRef(null);
  
  // CRITICO: Refs per prevenire reinizializzazioni
  const currentVideoIdRef = useRef(null);
  const isInitializedRef = useRef(false);
  const isPlayingRef = useRef(false);
  const initAttemptRef = useRef(0);

  const detectedType = getMediaType(mediaUrl, mediaType);
  const isAudioMode = mediaType === 'audio';

  // Cleanup function stabile
  const cleanupPlayer = useCallback(() => {
    if (playerRef.current) {
      try {
        playerRef.current.destroy();
      } catch (e) {
        // Ignora errori durante destroy
      }
      playerRef.current = null;
    }
  }, []);

  // Handler click per sbloccare audio
  const handleUnblockAudio = useCallback(() => {
    if (playerRef.current) {
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
    // Se è risultato, non mostrare nulla
    if (isResult) {
      cleanupPlayer();
      return;
    }

    // Se non è YouTube, esci
    if (detectedType !== 'youtube') {
      setIsLoading(false);
      return;
    }

    const videoId = getYoutubeId(mediaUrl);
    
    // Se non c'è videoId, esci
    if (!videoId) {
      setIsLoading(false);
      return;
    }

    // CRITICO: Se è lo stesso video e il player sta già funzionando, NON reinizializzare
    if (currentVideoIdRef.current === videoId && isPlayingRef.current && playerRef.current) {
      console.log('[QuizMedia] Stesso video già in riproduzione, skip reinit');
      return;
    }

    // Se è un nuovo video, resetta i flag
    if (currentVideoIdRef.current !== videoId) {
      console.log('[QuizMedia] Nuovo video rilevato:', videoId);
      currentVideoIdRef.current = videoId;
      isInitializedRef.current = false;
      isPlayingRef.current = false;
      initAttemptRef.current = 0;
      cleanupPlayer();
    }

    // Se già inizializzato per questo video, esci
    if (isInitializedRef.current) {
      console.log('[QuizMedia] Già inizializzato per questo video');
      return;
    }

    // Marca come inizializzato PRIMA di procedere per evitare race conditions
    isInitializedRef.current = true;
    initAttemptRef.current++;
    const currentAttempt = initAttemptRef.current;

    console.log('[QuizMedia] Inizializzazione player per:', videoId, 'tentativo:', currentAttempt);

    const initPlayer = () => {
      // Verifica che siamo ancora sul tentativo corrente
      if (currentAttempt !== initAttemptRef.current) {
        console.log('[QuizMedia] Tentativo obsoleto, skip');
        return;
      }

      // Verifica che il container esista
      const container = document.getElementById('quiz-fixed-player');
      if (!container) {
        console.warn('[QuizMedia] Container non trovato, retry in 100ms');
        setTimeout(initPlayer, 100);
        return;
      }

      // Verifica API YouTube
      if (!window.YT || !window.YT.Player) {
        console.warn('[QuizMedia] YT API non pronta, retry in 100ms');
        setTimeout(initPlayer, 100);
        return;
      }

      // Cleanup precedente player se esiste
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch (e) {}
        playerRef.current = null;
      }

      try {
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
            origin: window.location.origin
          },
          events: {
            onReady: (event) => {
              console.log('[QuizMedia] Player pronto');
              
              // Forza volume e unmute
              event.target.setVolume(100);
              event.target.unMute();
              
              // Controlla se audio è bloccato dal browser
              setTimeout(() => {
                if (event.target.isMuted()) {
                  console.log('[QuizMedia] Audio bloccato dal browser');
                  setAudioBlocked(true);
                } else {
                  setAudioBlocked(false);
                }
              }, 500);
              
              event.target.playVideo();
              setIsLoading(false);
            },
            onStateChange: (event) => {
              // YT.PlayerState: PLAYING = 1, PAUSED = 2, ENDED = 0
              if (event.data === 1) { // PLAYING
                console.log('[QuizMedia] Video in riproduzione');
                isPlayingRef.current = true;
                setIsLoading(false);
                
                // Ricontrolla audio
                if (!event.target.isMuted()) {
                  setAudioBlocked(false);
                }
              } else if (event.data === 0) { // ENDED
                console.log('[QuizMedia] Video terminato');
                isPlayingRef.current = false;
              } else if (event.data === 2) { // PAUSED
                console.log('[QuizMedia] Video in pausa');
              }
            },
            onError: (event) => {
              console.error('[QuizMedia] Errore player:', event.data);
              setIsLoading(false);
              isPlayingRef.current = false;
            }
          }
        });
      } catch (e) {
        console.error('[QuizMedia] Errore creazione player:', e);
        setIsLoading(false);
        isInitializedRef.current = false;
      }
    };

    // Carica API YouTube se necessario
    if (!window.YT) {
      console.log('[QuizMedia] Caricamento API YouTube');
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
      
      window.onYouTubeIframeAPIReady = () => {
        console.log('[QuizMedia] API YouTube pronta');
        initPlayer();
      };
    } else {
      initPlayer();
    }

    // Cleanup on unmount o cambio video
    return () => {
      // NON fare cleanup se il video è ancora lo stesso e sta funzionando
      // Il cleanup avverrà solo quando cambia davvero il video
    };
  }, [mediaUrl, isResult, detectedType, cleanupPlayer]);

  // Cleanup definitivo on unmount
  useEffect(() => {
    return () => {
      console.log('[QuizMedia] Unmount - cleanup');
      cleanupPlayer();
      currentVideoIdRef.current = null;
      isInitializedRef.current = false;
      isPlayingRef.current = false;
    };
  }, [cleanupPlayer]);

  // Non renderizzare se è risultato
  if (isResult) return null;

  // Render YouTube
  if (detectedType === 'youtube') {
    return (
      <div 
        ref={containerRef}
        className="absolute inset-0 bg-black flex items-center justify-center"
      >
        {/* Container YouTube */}
        <div 
          id="quiz-fixed-player" 
          className={`absolute inset-0 ${isAudioMode ? 'opacity-0' : 'opacity-100'}`}
          style={{ pointerEvents: 'none' }}
        />
        
        {/* Loading spinner */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
            <Loader2 className="w-12 h-12 text-purple-500 animate-spin" />
          </div>
        )}
        
        {/* Audio blocked banner */}
        {audioBlocked && !isLoading && (
          <div 
            className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 
                       bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 
                       rounded-full cursor-pointer flex items-center gap-2
                       transition-all duration-200 shadow-lg"
            onClick={handleUnblockAudio}
          >
            <Volume2 className="w-5 h-5" />
            <span className="font-semibold">CLICCA QUI PER ATTIVARE L'AUDIO</span>
          </div>
        )}
        
        {/* Audio mode overlay */}
        {isAudioMode && !isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-purple-900 to-black z-5">
            <div className="relative">
              <div className="absolute inset-0 bg-purple-500/30 rounded-full blur-xl animate-pulse" />
              <Music className="w-24 h-24 text-purple-400 relative z-10" />
            </div>
            <p className="mt-4 text-xl text-purple-300 font-medium">Ascolta la traccia</p>
          </div>
        )}
      </div>
    );
  }

  // Fallback per altri tipi
  return <div className="absolute inset-0 bg-black" />;
};

export default QuizMediaFixed;
