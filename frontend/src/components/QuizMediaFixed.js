import React, { useEffect, useRef, useState, memo } from "react";
import { Music2, Loader2, VolumeX, AlertTriangle } from "lucide-react";

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
    if (type === 'video' || (url && (url.includes('youtube.com') || url.includes('youtu.be')))) return 'youtube';
    if (type === 'audio') return 'audio_file'; 
    return 'unknown';
};

// USIAMO MEMO: Il componente non si aggiorna se le props (url, state) non cambiano
const QuizMediaFixed = memo(({ mediaUrl, mediaType, isResult, mediaState = 'playing' }) => {
    const playerRef = useRef(null); 
    const audioRef = useRef(null);
    const currentVideoIdRef = useRef(null);
    const [isLoading, setIsLoading] = useState(true);
    const [audioBlocked, setAudioBlocked] = useState(false);
    const [videoError, setVideoError] = useState(false);

    const detectedType = getMediaType(mediaUrl, mediaType);

    // 1. GESTIONE CREAZIONE PLAYER (Solo al cambio URL)
    useEffect(() => {
        if (isResult || !mediaUrl) return;

        setVideoError(false); // Reset errori al cambio URL

        if (detectedType === 'youtube') {
            const videoId = getYoutubeId(mediaUrl);
            
            // BLOCCO CRITICO: Se l'ID è lo stesso di prima, NON fare nulla.
            // Questo impedisce il riavvio quando PubDisplay fa il polling.
            if (currentVideoIdRef.current === videoId && playerRef.current) {
                // Ci assicuriamo solo che il player sia sincronizzato con lo stato
                if(mediaState === 'playing' && typeof playerRef.current.playVideo === 'function') {
                    // Controllo stato interno YT: 1=playing, 2=paused. Se è già 1, non fare nulla.
                    if(playerRef.current.getPlayerState() !== 1) playerRef.current.playVideo();
                }
                return; 
            }

            currentVideoIdRef.current = videoId;
            setIsLoading(true);

            const initPlayer = () => {
                // Pulizia player precedente se esiste
                if (playerRef.current && typeof playerRef.current.destroy === 'function') {
                    try { playerRef.current.destroy(); } catch(e) { console.warn("Cleanup error", e); }
                }

                if (!window.YT) return;

                try {
                    playerRef.current = new window.YT.Player('quiz-fixed-player', {
                        videoId: videoId,
                        playerVars: {
                            autoplay: 1, controls: 0, disablekb: 1, fs: 0, 
                            iv_load_policy: 3, modestbranding: 1, rel: 0, 
                            showinfo: 0, mute: 0, origin: window.location.origin
                        },
                        events: {
                            onReady: (event) => {
                                event.target.setVolume(100);
                                event.target.unMute();
                                if (mediaState === 'paused') event.target.pauseVideo();
                                else event.target.playVideo();
                                
                                if (event.target.isMuted()) setAudioBlocked(true);
                                setIsLoading(false);
                            },
                            onError: (event) => {
                                console.error("YouTube Player Error:", event.data);
                                setVideoError(true);
                                setIsLoading(false);
                            }
                        }
                    });
                } catch (err) {
                    console.error("Init Player Crash:", err);
                    setVideoError(true);
                }
            };

            if (!window.YT) {
                const tag = document.createElement('script');
                tag.src = "https://www.youtube.com/iframe_api";
                const firstScriptTag = document.getElementsByTagName('script')[0];
                firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
                window.onYouTubeIframeAPIReady = initPlayer;
            } else {
                initPlayer();
            }
        } 
        else if (detectedType === 'audio_file') {
            setIsLoading(false);
            if(audioRef.current) {
                audioRef.current.volume = 1.0;
                if(mediaState === 'playing') audioRef.current.play().catch(() => setAudioBlocked(true));
            }
        }
    }, [mediaUrl, detectedType]); // Dipende SOLO dall'URL

    // 2. GESTIONE COMANDI REGIA (Play/Pause/Mute) - Senza distruggere il player
    useEffect(() => {
        if (videoError) return;

        // Logica YOUTUBE
        if (detectedType === 'youtube' && playerRef.current && typeof playerRef.current.getPlayerState === 'function') {
            try {
                const state = playerRef.current.getPlayerState();
                // 1 = playing, 2 = paused
                if (mediaState === 'paused' && state !== 2) {
                    playerRef.current.pauseVideo();
                } else if (mediaState === 'playing' && state !== 1 && state !== 3) { // 3 = buffering
                    playerRef.current.playVideo();
                }
            } catch (e) { console.warn("Control error", e); }
        }
        
        // Logica AUDIO FILE
        if (detectedType === 'audio_file' && audioRef.current) {
            if (mediaState === 'paused') {
                audioRef.current.pause();
            } else {
                audioRef.current.play().catch(e => console.error("Audio play blocked", e));
            }
        }
    }, [mediaState, detectedType, videoError]); 

    if (isResult) return null;

    return (
        <div className="absolute inset-0 z-0 bg-black overflow-hidden flex items-center justify-center">
            
            {/* YOUTUBE CONTAINER */}
            {detectedType === 'youtube' && !videoError && (
                <>
                    <div id="quiz-fixed-player" className={`absolute inset-0 w-full h-full object-cover pointer-events-none transition-opacity duration-1000 ${mediaType === 'audio' ? 'opacity-0' : 'opacity-60'}`} />
                    {isLoading && <div className="absolute z-10 text-fuchsia-500 animate-spin"><Loader2 size={64} /></div>}
                </>
            )}

            {/* ERROR STATE */}
            {videoError && (
                <div className="absolute z-10 flex flex-col items-center text-red-500 bg-black/80 p-6 rounded-xl border border-red-500">
                    <AlertTriangle size={64} className="mb-4" />
                    <h3 className="text-xl font-bold uppercase">Media non disponibile</h3>
                    <p className="text-sm text-zinc-400">Il video o il link potrebbe essere errato.</p>
                </div>
            )}

            {/* HTML5 AUDIO CONTAINER */}
            {detectedType === 'audio_file' && (
                <audio ref={audioRef} src={mediaUrl} loop onError={() => setVideoError(true)} />
            )}

            {/* UI PER BLOCCO AUDIO BROWSER */}
            {audioBlocked && !videoError && (
                <div className="absolute top-10 right-10 z-50 bg-red-600 text-white p-4 rounded-full animate-bounce cursor-pointer shadow-lg border-4 border-white"
                     onClick={() => {
                         if(playerRef.current && typeof playerRef.current.unMute === 'function') {
                             playerRef.current.unMute();
                             playerRef.current.playVideo();
                         }
                         if(audioRef.current) {
                             audioRef.current.play();
                         }
                         setAudioBlocked(false);
                     }}>
                    <div className="flex items-center gap-2 font-bold text-xl">
                        <VolumeX size={32} /> CLICCA PER ATTIVARE AUDIO
                    </div>
                </div>
            )}

            {/* VISUALIZZATORE MODALITÀ AUDIO */}
            {(mediaType === 'audio' || detectedType === 'audio_file') && !videoError && (
                <div className={`absolute z-20 flex flex-col items-center transition-all duration-500 ${mediaState === 'paused' ? 'opacity-50 scale-90' : 'animate-pulse opacity-100 scale-100'}`}>
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

export default QuizMediaFixed;