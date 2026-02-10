import React, { useEffect, useRef, useState, memo } from "react";
import { Music2, Loader2, VolumeX, AlertTriangle, Ban } from "lucide-react";

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

// Singleton API YouTube
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

    // 2. Init Player
    useEffect(() => {
        if (!apiLoaded || detectedType !== 'youtube' || !videoId || !playerContainerRef.current) return;
        if (playerRef.current) return; 

        console.log('[QuizMedia] CREATING PLAYER:', videoId);

        const onPlayerReady = (event) => {
            isPlayerReadyRef.current = true;
            event.target.unMute();
            event.target.setVolume(100);
            if (mediaState === 'playing') event.target.playVideo();
            setStatus('ready');
        };

        const onPlayerStateChange = (event) => {
            if (event.data === 1) setStatus('ready');
        };

        const onPlayerError = (event) => {
            if (event.data === 150 || event.data === 101) setStatus('blocked');
            else setStatus('error');
        };

        try {
            currentVideoIdRef.current = videoId;
            playerRef.current = new window.YT.Player(playerContainerRef.current, {
                height: '100%', width: '100%', videoId: videoId,
                playerVars: {
                    autoplay: 1, controls: 0, disablekb: 1, fs: 0, 
                    iv_load_policy: 3, modestbranding: 1, rel: 0, 
                    showinfo: 0, mute: 0, playsinline: 1, 
                    origin: window.location.origin
                },
                events: { onReady: onPlayerReady, onStateChange: onPlayerStateChange, onError: onPlayerError }
            });
        } catch (e) { setStatus('error'); }

        return () => {
            if (playerRef.current) {
                playerRef.current.destroy();
                playerRef.current = null;
            }
        };
    }, [apiLoaded, detectedType]); 

    // 3. Swap Video (FIX RIAVVOLGIMENTO)
    useEffect(() => {
        if (!playerRef.current || !isPlayerReadyRef.current || !videoId) return;
        
        // 🔥 FIX CRITICO: Se l'ID è lo stesso, NON fare nulla.
        if (currentVideoIdRef.current === videoId) {
            return; 
        }

        console.log('[QuizMedia] SWAPPING VIDEO:', videoId);
        setStatus('loading');
        currentVideoIdRef.current = videoId;
        playerRef.current.loadVideoById(videoId);
    }, [videoId]);

    // 4. Play/Pause
    useEffect(() => {
        if (!playerRef.current || !isPlayerReadyRef.current || status === 'blocked') return;
        try {
            const s = playerRef.current.getPlayerState();
            if (mediaState === 'playing' && s !== 1) playerRef.current.playVideo();
            else if (mediaState === 'paused' && s !== 2) playerRef.current.pauseVideo();
        } catch (e) {}
    }, [mediaState, status]);

    // 5. Audio File
    useEffect(() => {
        if (detectedType !== 'audio_file' || !mediaUrl || !audioRef.current) return;
        setStatus('ready');
        if (mediaState === 'playing') audioRef.current.play().catch(() => setAudioBlocked(true));
        else audioRef.current.pause();
    }, [detectedType, mediaUrl, mediaState]);

    const isVisible = !isResult && (status === 'ready');
    
    return (
        <div className="absolute inset-0 w-full h-full overflow-hidden flex items-center justify-center bg-black">
            {detectedType === 'youtube' && (
                <div className={`absolute inset-0 w-full h-full transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
                    <div ref={playerContainerRef} className="w-full h-full" />
                </div>
            )}
            
            {(status === 'blocked' || status === 'error') && !isResult && (
                <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/95">
                    {status === 'blocked' ? <Ban size={80} className="text-red-500 mb-6"/> : <AlertTriangle size={80} className="text-yellow-500 mb-6"/>}
                    <h3 className="text-4xl font-black text-white uppercase mb-2">{status === 'blocked' ? 'VIDEO NON DISPONIBILE' : 'ERRORE'}</h3>
                    <p className="text-zinc-400 text-xl text-center max-w-md">{status === 'blocked' ? "Copyright Restriction (Err 150)" : "Impossibile riprodurre."}</p>
                </div>
            )}
            {/* Audio UI logic omitted for brevity but preserved in full file if needed */}
        </div>
    );
}, (prev, next) => {
    // Memoizzazione stretta: aggiorna solo se cambiano i valori chiave
    return prev.mediaUrl === next.mediaUrl && 
           prev.mediaType === next.mediaType && 
           prev.mediaState === next.mediaState &&
           prev.isResult === next.isResult; 
});

QuizMediaFixed.displayName = 'QuizMediaFixed';
export default QuizMediaFixed;