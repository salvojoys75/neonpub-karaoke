import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Loader2, Music, Volume2, VolumeX } from 'lucide-react';

const getYoutubeId = (url) => {
  if (!url) return null;
  const regExp = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
};

const getMediaType = (url, type) => {
  if (type === 'audio') return 'audio';
  if (type === 'video' || (url && (url.includes('youtube.com') || url.includes('youtu.be')))) return 'youtube';
  return 'unknown';
};

const QuizMediaFixed = ({ mediaUrl, mediaType, isResult }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const playerRef = useRef(null);
  
  // Refs per tracciare lo stato ed evitare reload
  const currentVideoIdRef = useRef(null);
  
  const detectedType = getMediaType(mediaUrl, mediaType);
  const isAudioMode = mediaType === 'audio';

  useEffect(() => {
    // Se non c'è URL o siamo in una fase che non richiede media (es. risultato testuale senza video), potremmo voler nascondere
    // Ma per evitare reload, lasciamo il player montato se il tipo è youtube
    
    if (detectedType !== 'youtube') {
      setIsLoading(false);
      return;
    }

    const videoId = getYoutubeId(mediaUrl);
    if (!videoId) return;

    // SE E' LO STESSO VIDEO, NON FARE NULLA (Evita reload)
    if (currentVideoIdRef.current === videoId && playerRef.current) {
       // Assicuriamoci solo che non sia mutato se era stato mutato
       return;
    }

    // NUOVO VIDEO: Inizializzazione
    currentVideoIdRef.current = videoId;
    setIsLoading(true);

    const initPlayer = () => {
      if (playerRef.current) {
        try { playerRef.current.destroy(); } catch (e) {}
      }

      if (!window.YT) return;

      playerRef.current = new window.YT.Player('quiz-fixed-player', {
        videoId: videoId,
        playerVars: {
          autoplay: 1, controls: 0, disablekb: 1, fs: 0,
          iv_load_policy: 3, modestbranding: 1, rel: 0, showinfo: 0,
          mute: 0, loop: 1, playsinline: 1, origin: window.location.origin
        },
        events: {
          onReady: (event) => {
            event.target.setVolume(100);
            event.target.unMute();
            event.target.playVideo();
            setIsLoading(false);
            
            // Check autplay block
            if (event.target.isMuted()) setAudioBlocked(true);
          },
          onStateChange: (event) => {
            if (event.data === 1) { // Playing
                setIsLoading(false);
                if(!event.target.isMuted()) setAudioBlocked(false);
            }
          }
        }
      });
    };

    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(tag);
      window.onYouTubeIframeAPIReady = initPlayer;
    } else {
      initPlayer();
    }

  }, [mediaUrl, detectedType]);

  const handleUnblock = () => {
      if(playerRef.current) {
          playerRef.current.unMute();
          playerRef.current.playVideo();
          setAudioBlocked(false);
      }
  };

  if (detectedType !== 'youtube') return null;

  return (
    <div className="absolute inset-0 bg-black overflow-hidden flex items-center justify-center z-0">
      <div id="quiz-fixed-player" className={`absolute inset-0 w-full h-full object-cover ${isAudioMode ? 'opacity-0' : 'opacity-60'}`} style={{pointerEvents: 'none', transform: 'scale(1.1)'}} />
      
      {/* Overlay Audio Only */}
      {isAudioMode && (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-900 z-10">
              <div className="animate-pulse flex flex-col items-center">
                  <div className="p-10 rounded-full bg-fuchsia-600/20 border-4 border-fuchsia-500 shadow-[0_0_50px_rgba(192,38,211,0.5)]">
                      <Music className="w-32 h-32 text-white" />
                  </div>
                  <p className="mt-8 text-2xl font-bold text-white tracking-widest uppercase">Traccia Audio in Riproduzione</p>
              </div>
          </div>
      )}

      {/* Loader */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-20">
          <Loader2 className="w-16 h-16 text-fuchsia-500 animate-spin" />
        </div>
      )}

      {/* Unblock Button */}
      {audioBlocked && (
          <div className="absolute top-8 right-8 z-50 bg-red-600 text-white px-6 py-3 rounded-full font-bold cursor-pointer animate-bounce shadow-xl flex items-center gap-2" onClick={handleUnblock}>
              <VolumeX /> CLICCA PER ATTIVARE AUDIO
          </div>
      )}
    </div>
  );
};

export default QuizMediaFixed;