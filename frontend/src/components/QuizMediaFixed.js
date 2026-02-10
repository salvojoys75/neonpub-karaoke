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

// Singleton API YouTube - Caricamento unico globale
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
    
    const [status, setStatus] = useState('idle'); // idle, loading, ready, error, blocked
    const [audioBlocked, setAudioBlocked] = useState(false);
    const [apiLoaded, setApiLoaded] = useState(false);

    const detectedType = getMediaType(mediaUrl, mediaType);
    const videoId = getYoutubeId(mediaUrl);

    // 1. Caricamento API
    useEffect(() => {
        if (detectedType !== 'youtube') return;
        let mounted = true;
        loadYouTubeAPI().then(() => { if (mounted) setApiLoaded(true); });
        return () => { mounted = false; };
    }, [detectedType]);

    // 2. Inizializzazione Player (UNA VOLTA SOLA)
    useEffect(() => {
        if (!apiLoaded || !playerContainerRef.current) return;
        if (playerRef.current) return; // Il player esiste già, non fare nulla!

        console.log('[QuizMedia] INITIALIZING PLAYER INSTANCE (Global)');

        const onPlayerReady = (event) => {
            isPlayerReadyRef.current = true;
            event.target.unMute();
            event.target.setVolume(100);
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
            playerRef.current = new window.YT.Player(playerContainerRef.current, {
                height: '100%', width: '100%',
                videoId: videoId || '', // Inizializza anche vuoto se necessario
                playerVars: {
                    autoplay: 1, controls: 0, disablekb: 1, fs: 0, 
                    iv_load_policy: 3, modestbranding: 1, rel: 0, 
                    showinfo: 0, mute: 0, playsinline: 1, 
                    origin: window.location.origin
                },
                events: { onReady: onPlayerReady, onStateChange: onPlayerStateChange, onError: onPlayerError }
            });
        } catch (e) { console.error(e); }

        // MAI DISTRUGGERE IL PLAYER QUI. 
        // Lo lasciamo vivere per tutta la durata della pagina.
    }, [apiLoaded]);

    // 3. Cambio Video / Gestione URL vuoto
    useEffect(() => {
        // Se non c'è player o non siamo pronti, esci
        if (!playerRef.current || !isPlayerReadyRef.current) return;

        // Caso A: Nessun video (es. quiz solo testo o dati persi momentaneamente)
        if (!videoId) {
            if (currentVideoIdRef.current) {
                console.log('[QuizMedia] No video ID, pausing player');
                playerRef.current.pauseVideo();
                currentVideoIdRef.current = null;
                setStatus('idle');
            }
            return;
        }

        // Caso B: Stesso video
        if (currentVideoIdRef.current === videoId) return;

        // Caso C: Nuovo video
        console.log('[QuizMedia] LOADING NEW VIDEO:', videoId);
        setStatus('loading');
        currentVideoIdRef.current = videoId;
        playerRef.current.loadVideoById(videoId);
        if (mediaState === 'playing') {
            playerRef.current.playVideo();
        }

    }, [videoId, mediaState]);

    // 4. Play/Pause Control
    useEffect(() => {
        if (!playerRef.current || !isPlayerReadyRef.current || !videoId || status === 'blocked') return;
        try {
            const s = playerRef.current.getPlayerState();
            if (mediaState === 'playing' && s !== 1) playerRef.current.playVideo();
            else if (mediaState === 'paused' && s !== 2) playerRef.current.pauseVideo();
        } catch (e) {}
    }, [mediaState, status, videoId]);

    // 5. Audio File Handling
    useEffect(() => {
        if (detectedType !== 'audio_file' || !mediaUrl || !audioRef.current) return;
        setStatus('ready');
        if (mediaState === 'playing') audioRef.current.play().catch(() => setAudioBlocked(true));
        else audioRef.current.pause();
    }, [detectedType, mediaUrl, mediaState]);

    // Logica Visibilità:
    // Deve esserci un URL valido, lo stato deve essere ready (o loading) e NON deve essere un risultato.
    const showVideo = videoId && !isResult && (status === 'ready' || status === 'loading');
    const showAudio = detectedType === 'audio_file' && !isResult;

    return (
        <div className="absolute inset-0 w-full h-full overflow-hidden flex items-center justify-center bg-black">
            
            {/* CONTAINER YOUTUBE - SEMPRE PRESENTE NEL DOM */}
            <div className={`absolute inset-0 w-full h-full transition-opacity duration-500 ${showVideo ? 'opacity-100' : 'opacity-0'}`}>
                <div ref={playerContainerRef} className="w-full h-full" />
            </div>

            {/* LOADING SPINNER */}
            {status === 'loading' && videoId && !isResult && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center pointer-events-none">
                    <Loader2 size={64} className="text-white animate-spin mb-4" />
                </div>
            )}

            {/* ERROR / BLOCKED */}
            {(status === 'blocked' || status === 'error') && videoId && !isResult && (
                <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/95">
                    {status === 'blocked' ? <Ban size={80} className="text-red-500 mb-6"/> : <AlertTriangle size={80} className="text-yellow-500 mb-6"/>}
                    <h3 className="text-4xl font-black text-white uppercase mb-2">{status === 'blocked' ? 'VIDEO NON DISPONIBILE' : 'ERRORE'}</h3>
                    <p className="text-zinc-400 text-xl text-center max-w-md">{status === 'blocked' ? "Restrizione Copyright (Err 150)" : "Errore riproduzione."}</p>
                </div>
            )}

            {/* AUDIO FILE UI */}
            {showAudio && (
                <>
                    <audio ref={audioRef} src={mediaUrl} loop onError={() => setStatus('error')} />
                    <div className={`absolute z-20 flex flex-col items-center transition-opacity duration-500 ${mediaState === 'paused' ? 'opacity-50' : 'opacity-100'}`}>
                        <div className="bg-fuchsia-600/20 p-12 rounded-full border-4 border-fuchsia-500 animate-pulse">
                            <Music2 size={80} className="text-white" />
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}, (prev, next) => {
    return prev.mediaUrl === next.mediaUrl && 
           prev.mediaType === next.mediaType && 
           prev.mediaState === next.mediaState &&
           prev.isResult === next.isResult; 
});

QuizMediaFixed.displayName = 'QuizMediaFixed';
export default QuizMediaFixed;