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
        if (youtubeApiReady) {
            resolve();
            return;
        }
        youtubeApiCallbacks.push(resolve);
        if (youtubeApiLoading) return;

        youtubeApiLoading = true;
        const tag = document.createElement('script');
        tag.src = "https://www.youtube.com/iframe_api";
        tag.onerror = () => reject(new Error('Failed to load YouTube API'));
        
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

        window.onYouTubeIframeAPIReady = () => {
            youtubeApiReady = true;
            youtubeApiLoading = false;
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
    const currentVideoIdRef = useRef(null);
    const isPlayerReadyRef = useRef(false);
    
    const [status, setStatus] = useState('loading');
    const [audioBlocked, setAudioBlocked] = useState(false);
    const [apiLoaded, setApiLoaded] = useState(false);

    const detectedType = getMediaType(mediaUrl, mediaType);
    const videoId = getYoutubeId(mediaUrl);

    // 1. Caricamento API (Una volta sola)
    useEffect(() => {
        if (detectedType !== 'youtube' || !videoId) return;

        let mounted = true;
        loadYouTubeAPI()
            .then(() => { if (mounted) setApiLoaded(true); })
            .catch((error) => {
                console.error('[QuizMedia] API error:', error);
                if (mounted) setStatus('error');
            });

        return () => { mounted = false; };
    }, [detectedType, videoId]);

    // 2. Creazione Player
    useEffect(() => {
        if (!apiLoaded || isResult || detectedType !== 'youtube' || !videoId) return;
        if (playerRef.current) return; // Non ricreare MAI se esiste già
        if (!playerContainerRef.current) return;

        console.log('[QuizMedia] Initializing Player for', videoId);

        const onPlayerReady = (event) => {
            console.log('[QuizMedia] Player Ready');
            isPlayerReadyRef.current = true;
            event.target.unMute();
            event.target.setVolume(100);
            if (mediaState === 'playing') {
                event.target.playVideo();
            }
            setStatus('ready');
        };

        const onPlayerStateChange = (event) => {
            // 1 = Playing
            if (event.data === 1) {
                setStatus('ready');
            }
        };

        const onPlayerError = (event) => {
            console.error("[QuizMedia] Player Error:", event.data);
            if (event.data === 150 || event.data === 101) setStatus('blocked');
            else setStatus('error');
        };

        try {
            currentVideoIdRef.current = videoId;
            playerRef.current = new window.YT.Player(playerContainerRef.current, {
                height: '100%',
                width: '100%',
                videoId: videoId,
                playerVars: {
                    autoplay: 1, controls: 0, disablekb: 1, fs: 0, 
                    iv_load_policy: 3, modestbranding: 1, rel: 0, 
                    showinfo: 0, mute: 0, playsinline: 1, 
                    origin: window.location.origin
                },
                events: {
                    onReady: onPlayerReady,
                    onStateChange: onPlayerStateChange,
                    onError: onPlayerError,
                },
            });
        } catch (error) {
            console.error('[QuizMedia] Setup error:', error);
            setStatus('error');
        }

        // Cleanup: Distrugge SOLO se il componente viene smontato definitivamente
        return () => {
            if (playerRef.current && typeof playerRef.current.destroy === 'function') {
                console.log('[QuizMedia] Destroying Player instance');
                playerRef.current.destroy();
                playerRef.current = null;
                isPlayerReadyRef.current = false;
            }
        };
    }, [apiLoaded, isResult, detectedType]); // Rimosso videoId dalle dipendenze per gestire il cambio internamente

    // 3. Cambio Video (Senza distruggere il player)
    useEffect(() => {
        if (playerRef.current && isPlayerReadyRef.current && videoId && currentVideoIdRef.current !== videoId) {
            console.log('[QuizMedia] Swapping video to', videoId);
            currentVideoIdRef.current = videoId;
            playerRef.current.loadVideoById({ videoId: videoId });
        }
    }, [videoId]);

    // 4. Controllo Play/Pause
    useEffect(() => {
        if (!playerRef.current || !isPlayerReadyRef.current) return;
        try {
            const playerState = playerRef.current.getPlayerState();
            if (mediaState === 'playing' && playerState !== 1) {
                playerRef.current.playVideo();
            } else if (mediaState === 'paused' && playerState !== 2) {
                playerRef.current.pauseVideo();
            }
        } catch (e) { console.error(e); }
    }, [mediaState]);

    // 5. Gestione Audio File
    useEffect(() => {
        if (detectedType !== 'audio_file' || !mediaUrl || !audioRef.current) return;
        setStatus('ready');
        if (mediaState === 'playing') {
            audioRef.current.play().catch(() => setAudioBlocked(true));
        } else {
            audioRef.current.pause();
        }
    }, [detectedType, mediaUrl, mediaState]);

    const handleUnmuteClick = () => {
        if (playerRef.current) {
            playerRef.current.unMute();
            setAudioBlocked(false);
        }
    };

    if (isResult) return null;

    return (
        <div className="absolute inset-0 z-0 bg-black overflow-hidden flex items-center justify-center pointer-events-none">
            
            {/* YOUTUBE CONTAINER */}
            {detectedType === 'youtube' && (
                <div 
                    ref={playerContainerRef}
                    className={`absolute inset-0 w-full h-full transition-opacity duration-500 ${
                        status === 'ready' ? 'opacity-100' : 'opacity-0'
                    }`}
                />
            )}

            {/* LOADING */}
            {status === 'loading' && detectedType === 'youtube' && (
                <div className="absolute z-20 flex flex-col items-center animate-fade-in">
                    <Loader2 size={64} className="text-white animate-spin mb-4" />
                    <p className="text-white text-xl font-mono">Loading Media...</p>
                </div>
            )}

            {/* ERRORS */}
            {(status === 'blocked' || status === 'error') && (
                <div className="absolute z-20 flex flex-col items-center bg-red-900/80 p-8 rounded-xl backdrop-blur">
                    {status === 'blocked' ? <Ban size={64} className="text-white mb-4"/> : <AlertTriangle size={64} className="text-white mb-4"/>}
                    <h3 className="text-2xl font-bold text-white">{status === 'blocked' ? 'VIDEO BLOCCATO' : 'ERRORE MEDIA'}</h3>
                </div>
            )}

            {/* AUDIO FILE UI */}
            {detectedType === 'audio_file' && (
                <>
                    <audio ref={audioRef} src={mediaUrl} loop onError={() => setStatus('error')} />
                    <div className={`absolute z-20 flex flex-col items-center transition-all duration-500 ${mediaState === 'paused' ? 'opacity-50 scale-90' : 'animate-pulse opacity-100 scale-100'}`}>
                        <div className="bg-fuchsia-600/20 p-12 rounded-full border-4 border-fuchsia-500 mb-4 shadow-[0_0_50px_rgba(192,38,211,0.5)]">
                            <Music2 size={80} className="text-white" />
                        </div>
                    </div>
                </>
            )}

            {/* UNMUTE OVERLAY */}
            {audioBlocked && status === 'ready' && (
                <div onClick={handleUnmuteClick} className="absolute top-10 right-10 z-50 bg-red-600 text-white p-4 rounded-full animate-bounce cursor-pointer pointer-events-auto border-4 border-white shadow-xl">
                    <VolumeX size={32} />
                </div>
            )}
        </div>
    );
}, (prev, next) => {
    // Ritorna true (non re-renderizzare) se le props essenziali sono identiche
    return prev.mediaUrl === next.mediaUrl && 
           prev.mediaType === next.mediaType && 
           prev.isResult === next.isResult && 
           prev.mediaState === next.mediaState;
});

QuizMediaFixed.displayName = 'QuizMediaFixed';
export default QuizMediaFixed;