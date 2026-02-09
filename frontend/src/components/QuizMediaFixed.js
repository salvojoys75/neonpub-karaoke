import React, { useEffect, useRef, useState, memo } from "react";
import { Music2, Loader2, VolumeX } from "lucide-react";

// Helper interni
const getYoutubeId = (url) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
};

const getMediaType = (url, type) => {
    if (type === 'video' || (url && (url.includes('youtube.com') || url.includes('youtu.be')))) return 'youtube';
    if (type === 'audio') return 'audio_file'; 
    return 'unknown';
};

const QuizMediaFixed = memo(({ mediaUrl, mediaType, isVisible }) => {
    const playerRef = useRef(null);
    const [isPlayerReady, setIsPlayerReady] = useState(false);
    const [audioBlocked, setAudioBlocked] = useState(false);

    const detectedType = getMediaType(mediaUrl, mediaType);
    const videoId = detectedType === 'youtube' ? getYoutubeId(mediaUrl) : null;

    // 1. INIZIALIZZAZIONE PLAYER (Eseguita una sola volta)
    useEffect(() => {
        if (!window.YT) {
            const tag = document.createElement('script');
            tag.src = "https://www.youtube.com/iframe_api";
            const firstScriptTag = document.getElementsByTagName('script')[0];
            firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
            window.onYouTubeIframeAPIReady = initPlayer;
        } else {
            initPlayer();
        }
        // Non mettiamo cleanup distruttivo per mantenere l'istanza viva
    }, []);

    const initPlayer = () => {
        if (playerRef.current) return; // Già inizializzato

        playerRef.current = new window.YT.Player('quiz-fixed-player', {
            height: '100%',
            width: '100%',
            videoId: null, // Parte vuoto
            playerVars: {
                autoplay: 0, // ✅ FONDAMENTALE: Decide React, non YouTube
                controls: 0,
                disablekb: 1,
                fs: 0,
                iv_load_policy: 3,
                modestbranding: 1,
                rel: 0,
                showinfo: 0,
                mute: 0,
                origin: window.location.origin
            },
            events: {
                onReady: (event) => {
                    setIsPlayerReady(true);
                    event.target.unMute();
                    event.target.setVolume(100);
                },
                onStateChange: (event) => {
                    // Se sta suonando (1) e non è muto, rimuovi avviso
                    if (event.data === 1 && !event.target.isMuted()) {
                        setAudioBlocked(false);
                    }
                }
            }
        });
    };

    // 2. GESTIONE CARICAMENTO (Solo se cambia Video ID)
    useEffect(() => {
        if (!isPlayerReady || !playerRef.current || !videoId) return;

        // Carica il video ma NON farlo partire automaticamente se non necessario
        // loadVideoById di default fa autoplay, quindi lo mettiamo in pausa subito dopo se non è visibile
        playerRef.current.loadVideoById(videoId);
        playerRef.current.setVolume(100);
        playerRef.current.unMute();

    }, [videoId, isPlayerReady]); // 🔥 Scatta SOLO se cambia ID o il player diventa pronto

    // 3. GESTIONE PLAY/PAUSE (Solo se cambia isVisible)
    useEffect(() => {
        if (!isPlayerReady || !playerRef.current) return;

        if (isVisible) {
            // Se deve essere visibile, PLAY
            const state = playerRef.current.getPlayerState();
            // -1: unstarted, 2: paused, 5: cued
            if (state !== 1) { 
                playerRef.current.playVideo();
                // Check blocco audio
                if (playerRef.current.isMuted()) setAudioBlocked(true);
            }
        } else {
            // Se non deve essere visibile, PAUSA
            playerRef.current.pauseVideo();
        }

    }, [isVisible, isPlayerReady]); // 🔥 Scatta SOLO se cambia visibilità

    // Force Unmute manuale
    const handleForceUnmute = () => {
        if (playerRef.current && playerRef.current.unMute) {
            playerRef.current.unMute();
            playerRef.current.setVolume(100);
            setAudioBlocked(false);
        }
    };

    const containerClass = `absolute inset-0 z-0 bg-black flex items-center justify-center transition-opacity duration-500 ${isVisible && mediaUrl ? 'opacity-100' : 'opacity-0 pointer-events-none'}`;

    if (detectedType === 'audio_file') {
        return (
            <div className={containerClass}>
                {/* Gestione Audio HTML5: Play/Pause basato su isVisible */}
                <audio 
                    src={mediaUrl} 
                    ref={(el) => {
                        if (el) {
                            if (isVisible) el.play().catch(() => {});
                            else el.pause();
                        }
                    }} 
                    loop 
                />
                <div className="flex flex-col items-center animate-pulse">
                    <div className="bg-white/10 p-12 rounded-full border-4 border-white/20 mb-4 shadow-[0_0_50px_rgba(255,255,255,0.2)]">
                        <Music2 size={100} className="text-white" />
                    </div>
                    <h3 className="text-3xl text-white font-bold tracking-widest uppercase">Traccia Audio</h3>
                </div>
            </div>
        );
    }

    return (
        <div className={containerClass} style={{ zIndex: 0 }}>
            {/* Div Placeholder per YouTube API */}
            <div id="quiz-fixed-player" className="absolute inset-0 w-full h-full object-cover pointer-events-none" />
            
            {audioBlocked && isVisible && (
                <div className="absolute top-24 right-10 z-[100] bg-red-600 text-white px-6 py-4 rounded-xl animate-bounce cursor-pointer shadow-2xl border-4 border-white flex items-center gap-4 hover:scale-110 transition"
                        onClick={handleForceUnmute} style={{pointerEvents: 'auto'}}>
                    <VolumeX size={40} /> 
                    <div className="text-left">
                        <div className="font-black text-xl">AUDIO BLOCCATO</div>
                        <div className="text-sm">Clicca per attivare</div>
                    </div>
                </div>
            )}
        </div>
    );
}, (prev, next) => {
    // Memoizzazione stretta: Re-renderizza solo se cambiano questi valori
    return prev.mediaUrl === next.mediaUrl && prev.isVisible === next.isVisible;
});

export default QuizMediaFixed;