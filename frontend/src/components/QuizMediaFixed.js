import React, { useEffect, useRef, useState, memo } from "react";
import { Music2, Loader2, VolumeX, AlertTriangle, Ban } from "lucide-react";

// ============================================================================
// UTILS
// ============================================================================
const getYoutubeId = (url) => {
    if (!url || typeof url !== 'string') return null;
    try {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    } catch (e) { return null; }
};

const getMediaType = (url, type) => {
    if (type === 'video' || (url && (url.includes('youtube.com') || url.includes('youtu.be')))) return 'youtube';
    if (type === 'audio') return 'audio_file';
    return 'unknown';
};

// ============================================================================
// YOUTUBE API LOADER (SINGLETON)
// ============================================================================
let youtubeApiLoading = false;
let youtubeApiReady = false;
const youtubeApiCallbacks = [];

const loadYouTubeAPI = () => {
    return new Promise((resolve, reject) => {
        if (youtubeApiReady) { resolve(); return; }
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
            youtubeApiCallbacks.forEach(cb => cb());
            youtubeApiCallbacks.length = 0;
        };
    });
};

// ============================================================================
// COMPONENTE
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

    // 1. Load API
    useEffect(() => {
        if (detectedType !== 'youtube' || !videoId) return;
        let mounted = true;
        loadYouTubeAPI().then(() => { if (mounted) setApiLoaded(true); });
        return () => { mounted = false; };
    }, [detectedType, videoId]);

    // 2. Initialize Player (ONLY ONCE)
    useEffect(() => {
        if (!apiLoaded || detectedType !== 'youtube' || !videoId || !playerContainerRef.current) return;
        if (playerRef.current) return; // Prevent recreation

        const onPlayerReady = (event) => {
            isPlayerReadyRef.current = true;
            event.target.unMute();
            event.target.setVolume(100);
            if (mediaState === 'playing') event.target.playVideo();
            setStatus('ready');
        };

        const onPlayerStateChange = (event) => {
            if (event.data === 1) setStatus('ready'); // Playing
        };

        const onPlayerError = (event) => {
            console.error("[QuizMedia] Player Error:", event.data);
            // 150/101 = Restricted/Copyright blocked
            if (event.data === 150 || event.data === 101) setStatus('blocked');
            else setStatus('error');
        };

        try {
            currentVideoIdRef.current = videoId;
            playerRef.current = new window.YT.Player(playerContainerRef.current, {
                height: '100%', width: '100%', videoId: videoId,
                playerVars: {
                    autoplay: 1, controls: 0, disablekb: 1, fs: 0, iv_load_policy: 3,
                    modestbranding: 1, rel: 0, showinfo: 0, mute: 0, playsinline: 1,
                    origin: window.location.origin // Critical for avoiding origin errors
                },
                events: { onReady: onPlayerReady, onStateChange: onPlayerStateChange, onError: onPlayerError }
            });
        } catch (e) { setStatus('error'); }

        // CLEANUP: Destroy only on unmount
        return () => {
            if (playerRef.current) {
                playerRef.current.destroy();
                playerRef.current = null;
            }
        };
    }, [apiLoaded, detectedType]); // Removed videoId/isResult to prevent destroy loops

    // 3. Swap Video (Load without destroy)
    useEffect(() => {
        if (playerRef.current && isPlayerReadyRef.current && videoId && currentVideoIdRef.current !== videoId) {
            // Reset status before loading new video to hide previous error
            setStatus('loading'); 
            currentVideoIdRef.current = videoId;
            playerRef.current.loadVideoById(videoId);
        }
    }, [videoId]);

    // 4. Play/Pause Control
    useEffect(() => {
        if (!playerRef.current || !isPlayerReadyRef.current || status === 'blocked') return;
        try {
            const s = playerRef.current.getPlayerState();
            if (mediaState === 'playing' && s !== 1) playerRef.current.playVideo();
            else if (mediaState === 'paused' && s !== 2) playerRef.current.pauseVideo();
        } catch (e) {}
    }, [mediaState, status]);

    // 5. Audio File Handling
    useEffect(() => {
        if (detectedType !== 'audio_file' || !mediaUrl || !audioRef.current) return;
        setStatus('ready');
        if (mediaState === 'playing') audioRef.current.play().catch(() => setAudioBlocked(true));
        else audioRef.current.pause();
    }, [detectedType, mediaUrl, mediaState]);

    // 🔥 FIX CRITICO: Non ritornare mai null, usa CSS per nascondere
    // Se isResult è true, nascondiamo visivamente ma teniamo l'istanza
    const isVisible = !isResult && (status === 'ready' || status === 'loading');

    return (
        <div className={`absolute inset-0 z-0 bg-black overflow-hidden flex items-center justify-center pointer-events-none transition-opacity duration-500 ${isResult ? 'opacity-0' : 'opacity-100'}`}>
            
            {detectedType === 'youtube' && (
                <div ref={playerContainerRef} className={`absolute inset-0 w-full h-full ${status === 'ready' ? 'opacity-100' : 'opacity-0'}`} />
            )}

            {status === 'loading' && detectedType === 'youtube' && !isResult && (
                <div className="absolute z-20 flex flex-col items-center animate-fade-in">
                    <Loader2 size={64} className="text-white animate-spin mb-4" />
                </div>
            )}

            {/* Error UI - Mostra sempre se c'è un errore, anche sopra il video */}
            {(status === 'blocked' || status === 'error') && !isResult && (
                <div className="absolute z-30 flex flex-col items-center justify-center bg-black/90 p-12 rounded-3xl border-4 border-red-600 animate-in fade-in zoom-in duration-300">
                    {status === 'blocked' ? <Ban size={80} className="text-red-500 mb-6"/> : <AlertTriangle size={80} className="text-yellow-500 mb-6"/>}
                    <h3 className="text-4xl font-black text-white uppercase mb-2">
                        {status === 'blocked' ? 'VIDEO NON DISPONIBILE' : 'ERRORE CARICAMENTO'}
                    </h3>
                    <p className="text-zinc-400 text-xl text-center max-w-md">
                        {status === 'blocked' 
                            ? "L'autore ha bloccato la riproduzione di questo video su siti esterni (Err 150)." 
                            : "Impossibile riprodurre il media."}
                    </p>
                </div>
            )}

            {detectedType === 'audio_file' && (
                <>
                    <audio ref={audioRef} src={mediaUrl} loop onError={() => setStatus('error')} />
                    <div className={`absolute z-20 flex flex-col items-center ${mediaState === 'paused' ? 'opacity-50' : 'animate-pulse'}`}>
                        <div className="bg-fuchsia-600/20 p-12 rounded-full border-4 border-fuchsia-500 mb-4 shadow-[0_0_50px_rgba(192,38,211,0.5)]"><Music2 size={80} className="text-white" /></div>
                    </div>
                </>
            )}
        </div>
    );
}, (prev, next) => {
    // Evita re-render se cambiano props non essenziali
    return prev.mediaUrl === next.mediaUrl && 
           prev.mediaType === next.mediaType && 
           prev.mediaState === next.mediaState &&
           prev.isResult === next.isResult; 
});

QuizMediaFixed.displayName = 'QuizMediaFixed';
export default QuizMediaFixed;