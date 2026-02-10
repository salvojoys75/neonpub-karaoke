import React, { useEffect, useRef, useState, memo } from "react";
import { Music2, VolumeX } from "lucide-react";

// Helper per identificare i media
const getYoutubeId = (url) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
};

const getMediaType = (url, type) => {
    if (!url) return 'none';
    if (type === 'video' || url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
    if (type === 'audio' || url.match(/\.(mp3|wav)$/i)) return 'audio_file';
    return 'unknown'; // Supporto futuro per video mp4 diretti
};

const QuizMediaFixed = memo(({ mediaUrl, mediaType, isVisible }) => {
    const playerRef = useRef(null);
    const audioRef = useRef(null);
    const [audioBlocked, setAudioBlocked] = useState(false);
    
    // Serve per non ricaricare il video se è già quello giusto
    const currentVideoId = useRef(null);

    const detectedType = getMediaType(mediaUrl, mediaType);
    const youtubeId = detectedType === 'youtube' ? getYoutubeId(mediaUrl) : null;

    // 1. INIZIALIZZAZIONE SICURA PLAYER YOUTUBE
    useEffect(() => {
        if (detectedType !== 'youtube') return;

        const initPlayer = () => {
            // Se esiste già, non rifarlo
            if (playerRef.current) return;

            // Se l'elemento DOM non è ancora pronto, riprova tra poco
            if (!document.getElementById('quiz-fixed-player')) {
                setTimeout(initPlayer, 100);
                return;
            }

            try {
                playerRef.current = new window.YT.Player('quiz-fixed-player', {
                    height: '100%',
                    width: '100%',
                    videoId: null, // Parte vuoto
                    playerVars: {
                        autoplay: 1, // Importante per far partire i video
                        controls: 0,
                        disablekb: 1,
                        fs: 0,
                        iv_load_policy: 3,
                        modestbranding: 1,
                        rel: 0,
                        showinfo: 0,
                        mute: 0, // Parte con audio
                        origin: window.location.origin
                    },
                    events: {
                        onReady: (event) => {
                            event.target.setVolume(100);
                            // Se c'è un ID in attesa, caricalo ora
                            if (currentVideoId.current) {
                                event.target.loadVideoById(currentVideoId.current);
                            }
                        },
                        onStateChange: (event) => {
                            // 1 = Playing. Se suona ma è mutato, avvisa l'utente
                            if (event.data === 1 && event.target.isMuted()) {
                                setAudioBlocked(true);
                            } else {
                                setAudioBlocked(false);
                            }
                        }
                    }
                });
            } catch (e) {
                console.error("YouTube API Error:", e);
            }
        };

        if (!window.YT) {
            // Carica lo script se manca (fallback, dovrebbe esserci già in PubDisplay)
            const tag = document.createElement('script');
            tag.src = "https://www.youtube.com/iframe_api";
            const firstScriptTag = document.getElementsByTagName('script')[0];
            firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
            
            // Gestione coda globale sicura
            const existingCallback = window.onYouTubeIframeAPIReady;
            window.onYouTubeIframeAPIReady = () => {
                if (existingCallback) existingCallback();
                initPlayer();
            };
        } else {
            initPlayer();
        }

        // Cleanup leggero: non distruggiamo il player per evitare schermate nere al reload,
        // ma fermiamo il video se il componente smonta.
        return () => {
            if (playerRef.current && typeof playerRef.current.stopVideo === 'function') {
                playerRef.current.stopVideo();
            }
        };
    }, [detectedType]);

    // 2. GESTIONE PLAYBACK YOUTUBE
    useEffect(() => {
        if (!playerRef.current || typeof playerRef.current.loadVideoById !== 'function') return;

        // A. CAMBIO VIDEO
        if (youtubeId && youtubeId !== currentVideoId.current) {
            currentVideoId.current = youtubeId;
            playerRef.current.loadVideoById(youtubeId);
        }

        // B. VISIBILITÀ (Play/Pause)
        if (isVisible && youtubeId) {
            const state = playerRef.current.getPlayerState();
            // Se non sta suonando (1) e non è in buffering (3), PLAY
            if (state !== 1 && state !== 3) {
                playerRef.current.playVideo();
            }
        } else {
            playerRef.current.pauseVideo();
        }
    }, [youtubeId, isVisible]);

    // 3. GESTIONE AUDIO FILE (MP3)
    useEffect(() => {
        if (detectedType === 'audio_file' && audioRef.current) {
            if (isVisible) {
                audioRef.current.play().catch(e => console.log("Audio play blocked", e));
            } else {
                audioRef.current.pause();
                audioRef.current.currentTime = 0; // Reset
            }
        }
    }, [mediaUrl, isVisible, detectedType]);

    const handleForceUnmute = () => {
        if (playerRef.current && playerRef.current.unMute) {
            playerRef.current.unMute();
            playerRef.current.setVolume(100);
            setAudioBlocked(false);
        }
    };

    // --- RENDER ---

    // Caso 1: Audio File
    if (detectedType === 'audio_file') {
        return (
            <div className={`absolute inset-0 z-0 bg-black flex items-center justify-center transition-opacity duration-500 ${isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                <audio ref={audioRef} src={mediaUrl} loop />
                <div className="flex flex-col items-center animate-pulse">
                    <div className="bg-white/10 p-12 rounded-full border-4 border-white/20 mb-4 shadow-[0_0_50px_rgba(255,255,255,0.2)]">
                        <Music2 size={100} className="text-white" />
                    </div>
                    <h3 className="text-3xl text-white font-bold tracking-widest uppercase">Audio Quiz</h3>
                </div>
            </div>
        );
    }

    // Caso 2: YouTube
    return (
        <div className={`absolute inset-0 z-0 bg-black transition-opacity duration-500 ${isVisible && youtubeId ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            <div id="quiz-fixed-player" className="absolute inset-0 w-full h-full object-cover" />
            
            {audioBlocked && isVisible && (
                <div className="absolute top-24 right-10 z-[100] bg-red-600 text-white px-6 py-4 rounded-xl animate-bounce cursor-pointer shadow-2xl border-4 border-white flex items-center gap-4 hover:scale-110 transition"
                        onClick={handleForceUnmute} style={{pointerEvents: 'auto'}}>
                    <VolumeX size={40} /> 
                    <div className="text-left">
                        <div className="font-black text-xl">CLICCA QUI</div>
                        <div className="text-sm">Per attivare l'audio</div>
                    </div>
                </div>
            )}
        </div>
    );
}, (prev, next) => {
    // Rerenderizza SOLO se cambia l'URL o la visibilità. Evita i reload casuali.
    return prev.mediaUrl === next.mediaUrl && prev.isVisible === next.isVisible;
});

export default QuizMediaFixed;