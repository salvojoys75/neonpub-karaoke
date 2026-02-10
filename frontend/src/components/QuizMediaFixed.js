import React, { useEffect, useRef, useState, memo } from "react";
import { Music2, Loader2, VolumeX, AlertTriangle, Ban } from "lucide-react";

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const getYoutubeId = (url) => {
    if (!url || typeof url !== 'string') return null;
    try {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    } catch (e) { 
        return null; 
    }
};

const getMediaType = (url, type) => {
    if (type === 'video' || (url && (url.includes('youtube.com') || url.includes('youtu.be')))) {
        return 'youtube';
    }
    if (type === 'audio') {
        return 'audio_file';
    }
    return 'unknown';
};

// ============================================================================
// YOUTUBE API LOADER (SINGLETON GLOBALE)
// ============================================================================

let youtubeApiLoading = false;
let youtubeApiReady = false;
const youtubeApiCallbacks = [];

const loadYouTubeAPI = () => {
    return new Promise((resolve, reject) => {
        // Se l'API è già pronta, risolvi immediatamente
        if (youtubeApiReady) {
            resolve();
            return;
        }

        // Aggiungi questo callback alla coda
        youtubeApiCallbacks.push(resolve);

        // Se stiamo già caricando, non ricaricare
        if (youtubeApiLoading) {
            return;
        }

        youtubeApiLoading = true;

        // Carica lo script
        const tag = document.createElement('script');
        tag.src = "https://www.youtube.com/iframe_api";
        tag.onerror = () => reject(new Error('Failed to load YouTube API'));
        
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

        // Callback globale quando l'API è pronta
        window.onYouTubeIframeAPIReady = () => {
            youtubeApiReady = true;
            youtubeApiLoading = false;
            
            // Risolvi tutti i callback in attesa
            youtubeApiCallbacks.forEach(callback => callback());
            youtubeApiCallbacks.length = 0;
        };
    });
};

// ============================================================================
// COMPONENTE PRINCIPALE
// ============================================================================

const QuizMediaFixed = memo(({ mediaUrl, mediaType, isResult, mediaState = 'playing' }) => {
    const playerRef = useRef(null);
    const audioRef = useRef(null);
    const playerContainerRef = useRef(null);
    
    const [status, setStatus] = useState('loading');
    const [audioBlocked, setAudioBlocked] = useState(false);
    const [apiLoaded, setApiLoaded] = useState(false);

    const detectedType = getMediaType(mediaUrl, mediaType);
    const videoId = getYoutubeId(mediaUrl);

    // ========================================================================
    // EFFECT 1: CARICAMENTO API YOUTUBE (UNA VOLTA SOLA)
    // ========================================================================
    
    useEffect(() => {
        if (detectedType !== 'youtube' || !videoId) {
            return;
        }

        let mounted = true;

        loadYouTubeAPI()
            .then(() => {
                if (mounted) {
                    setApiLoaded(true);
                }
            })
            .catch((error) => {
                console.error('YouTube API loading error:', error);
                if (mounted) {
                    setStatus('error');
                }
            });

        return () => {
            mounted = false;
        };
    }, [detectedType, videoId]);

    // ========================================================================
    // EFFECT 2: CREAZIONE PLAYER (UNA VOLTA SOLA QUANDO API È PRONTA)
    // ========================================================================
    
    useEffect(() => {
        if (!apiLoaded || isResult || detectedType !== 'youtube' || !videoId) {
            return;
        }

        // Se il player esiste già, non ricrearlo
        if (playerRef.current) {
            return;
        }

        // Assicurati che il container esista
        if (!playerContainerRef.current) {
            return;
        }

        let mounted = true;

        const onPlayerReady = (event) => {
            if (!mounted) return;
            
            console.log('YouTube Player Ready');
            
            event.target.setVolume(100);
            event.target.unMute();
            
            // Verifica se l'audio è bloccato
            if (event.target.isMuted()) {
                setAudioBlocked(true);
            }
            
            setStatus('ready');
        };

        const onPlayerStateChange = (event) => {
            if (!mounted) return;
            
            // Event.data values:
            // -1 (unstarted), 0 (ended), 1 (playing), 2 (paused), 3 (buffering), 5 (video cued)
            console.log('Player State Changed:', event.data);
        };

        const onPlayerError = (event) => {
            if (!mounted) return;
            
            console.error("YouTube Player Error:", event.data);
            
            // Error codes:
            // 2 – Invalid parameter
            // 5 – HTML5 player error
            // 100 – Video not found or private
            // 101/150 – Video not allowed to be played in embedded players
            
            if (event.data === 150 || event.data === 101) {
                setStatus('blocked');
            } else {
                setStatus('error');
            }
        };

        try {
            // Crea il player
            playerRef.current = new window.YT.Player(playerContainerRef.current, {
                height: '100%',
                width: '100%',
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
                    enablejsapi: 1
                },
                events: {
                    onReady: onPlayerReady,
                    onStateChange: onPlayerStateChange,
                    onError: onPlayerError
                }
            });

            console.log('YouTube Player Created');
            
        } catch (error) {
            console.error('Error creating YouTube player:', error);
            if (mounted) {
                setStatus('error');
            }
        }

        return () => {
            mounted = false;
            // NON distruggere il player qui - lo faremo solo quando il componente si smonta completamente
        };
    }, [apiLoaded, videoId, detectedType, isResult]);

    // ========================================================================
    // EFFECT 3: CAMBIO VIDEO (QUANDO videoId CAMBIA)
    // ========================================================================
    
    useEffect(() => {
        if (!playerRef.current || !videoId || detectedType !== 'youtube' || isResult) {
            return;
        }

        // Aspetta che il player sia completamente pronto
        if (status !== 'ready') {
            return;
        }

        try {
            // Usa cueVideoById per precaricare senza autoplay, poi play manualmente
            // Questo è più stabile di loadVideoById
            console.log('Loading new video:', videoId);
            
            setStatus('loading');
            
            playerRef.current.cueVideoById({
                videoId: videoId,
                startSeconds: 0
            });

            // Aspetta un frame per assicurarsi che il video sia caricato
            setTimeout(() => {
                if (playerRef.current && mediaState === 'playing') {
                    playerRef.current.playVideo();
                    setStatus('ready');
                }
            }, 100);
            
        } catch (error) {
            console.error('Error changing video:', error);
        }
    }, [videoId, detectedType, isResult, status, mediaState]);

    // ========================================================================
    // EFFECT 4: CONTROLLO PLAY/PAUSE (SEPARATO DAL CAMBIO VIDEO)
    // ========================================================================
    
    useEffect(() => {
        if (!playerRef.current || detectedType !== 'youtube' || isResult || status !== 'ready') {
            return;
        }

        try {
            if (mediaState === 'playing' || mediaState === 'live') {
                console.log('Playing video');
                playerRef.current.playVideo();
            } else if (mediaState === 'paused') {
                console.log('Pausing video');
                playerRef.current.pauseVideo();
            }
        } catch (error) {
            console.error('Error controlling playback:', error);
        }
    }, [mediaState, detectedType, isResult, status]);

    // ========================================================================
    // EFFECT 5: GESTIONE AUDIO HTML5
    // ========================================================================
    
    useEffect(() => {
        if (detectedType !== 'audio_file' || !mediaUrl) {
            return;
        }

        setStatus('ready');

        if (!audioRef.current) {
            return;
        }

        const playAudio = async () => {
            try {
                if (mediaState === 'playing' || mediaState === 'live') {
                    await audioRef.current.play();
                } else if (mediaState === 'paused') {
                    audioRef.current.pause();
                }
            } catch (error) {
                console.error('Audio play error:', error);
                setAudioBlocked(true);
            }
        };

        playAudio();
    }, [detectedType, mediaUrl, mediaState]);

    // ========================================================================
    // EFFECT 6: CLEANUP FINALE (SOLO QUANDO COMPONENTE SI SMONTA)
    // ========================================================================
    
    useEffect(() => {
        return () => {
            // Distruggi il player solo quando il componente viene smontato completamente
            if (playerRef.current && typeof playerRef.current.destroy === 'function') {
                try {
                    console.log('Destroying YouTube Player');
                    playerRef.current.destroy();
                    playerRef.current = null;
                } catch (error) {
                    console.error('Error destroying player:', error);
                }
            }
        };
    }, []); // Empty deps = solo al mount/unmount

    // ========================================================================
    // HANDLERS
    // ========================================================================
    
    const handleUnmuteClick = () => {
        if (playerRef.current && typeof playerRef.current.unMute === 'function') {
            try {
                playerRef.current.unMute();
                playerRef.current.setVolume(100);
                playerRef.current.playVideo();
                setAudioBlocked(false);
            } catch (error) {
                console.error('Error unmuting:', error);
            }
        }
    };

    const handleAudioError = () => {
        console.error('Audio file loading error');
        setStatus('error');
    };

    // ========================================================================
    // RENDER
    // ========================================================================

    // Non renderizzare nulla durante i risultati
    if (isResult) {
        return null;
    }

    return (
        <div className="absolute inset-0 z-0 bg-black overflow-hidden flex items-center justify-center">
            
            {/* ============================================================ */}
            {/* YOUTUBE PLAYER CONTAINER */}
            {/* ============================================================ */}
            
            {detectedType === 'youtube' && (
                <div 
                    ref={playerContainerRef}
                    className={`absolute inset-0 w-full h-full transition-opacity duration-1000 pointer-events-none ${
                        status === 'ready' && mediaType !== 'audio' 
                            ? 'opacity-100' 
                            : 'opacity-0'
                    }`}
                />
            )}

            {/* ============================================================ */}
            {/* LOADING INDICATOR */}
            {/* ============================================================ */}
            
            {status === 'loading' && detectedType === 'youtube' && (
                <div className="absolute z-20 flex flex-col items-center">
                    <Loader2 size={64} className="text-white animate-spin mb-4" />
                    <p className="text-white text-xl">Caricamento video...</p>
                </div>
            )}

            {/* ============================================================ */}
            {/* ERROR STATES */}
            {/* ============================================================ */}
            
            {status === 'blocked' && (
                <div className="absolute z-20 flex flex-col items-center bg-red-900/90 p-8 rounded-xl border-2 border-red-500 backdrop-blur-md animate-pulse">
                    <Ban size={64} className="text-white mb-4" />
                    <h3 className="text-2xl font-bold text-white uppercase mb-2">VIDEO BLOCCATO</h3>
                    <p className="text-white/80 text-center">L'autore vieta la riproduzione qui.</p>
                </div>
            )}

            {status === 'error' && (
                <div className="absolute z-20 flex flex-col items-center bg-yellow-900/80 p-8 rounded-xl border-2 border-yellow-500 backdrop-blur-md">
                    <AlertTriangle size={64} className="text-white mb-4" />
                    <h3 className="text-2xl font-bold text-white uppercase mb-2">ERRORE CARICAMENTO</h3>
                    <p className="text-white/80 text-center">Impossibile riprodurre il contenuto.</p>
                </div>
            )}

            {/* ============================================================ */}
            {/* AUDIO HTML5 PLAYER */}
            {/* ============================================================ */}
            
            {detectedType === 'audio_file' && (
                <audio 
                    ref={audioRef}
                    src={mediaUrl}
                    loop
                    onError={handleAudioError}
                    preload="auto"
                />
            )}

            {/* ============================================================ */}
            {/* UNMUTE BUTTON */}
            {/* ============================================================ */}
            
            {audioBlocked && status === 'ready' && (
                <div 
                    className="absolute top-10 right-10 z-50 bg-red-600 text-white p-4 rounded-full animate-bounce cursor-pointer shadow-lg border-4 border-white hover:bg-red-700 transition-colors"
                    onClick={handleUnmuteClick}
                >
                    <div className="flex items-center gap-2 font-bold text-xl">
                        <VolumeX size={32} /> 
                        ATTIVA AUDIO
                    </div>
                </div>
            )}

            {/* ============================================================ */}
            {/* AUDIO VISUALIZER */}
            {/* ============================================================ */}
            
            {(mediaType === 'audio' || detectedType === 'audio_file') && status === 'ready' && (
                <div className={`absolute z-20 flex flex-col items-center transition-all duration-500 ${
                    mediaState === 'paused' 
                        ? 'opacity-50 scale-90' 
                        : 'animate-pulse opacity-100 scale-100'
                }`}>
                    <div className="bg-fuchsia-600/20 p-12 rounded-full border-4 border-fuchsia-500 mb-4 shadow-[0_0_50px_rgba(192,38,211,0.5)]">
                        <Music2 size={80} className="text-white" />
                    </div>
                    <h3 className="text-2xl text-white font-bold tracking-widest uppercase">
                        {mediaState === 'paused' ? 'IN PAUSA' : 'ASCOLTA LA TRACCIA'}
                    </h3>
                </div>
            )}
        </div>
    );
});

// ============================================================================
// MEMO COMPARISON
// ============================================================================

function arePropsEqual(prevProps, nextProps) {
    return (
        prevProps.mediaUrl === nextProps.mediaUrl &&
        prevProps.mediaType === nextProps.mediaType &&
        prevProps.isResult === nextProps.isResult &&
        prevProps.mediaState === nextProps.mediaState
    );
}

QuizMediaFixed.displayName = 'QuizMediaFixed';

export default memo(QuizMediaFixed, arePropsEqual);