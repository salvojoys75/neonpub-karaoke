import React, { useEffect, useRef, useState } from "react";
import { Music2, Loader2, VolumeX } from "lucide-react";

// ============================================
// QUIZ MEDIA PLAYER - ROBUST VERSION
// ============================================
// Gestisce video/audio YouTube in modo professionale
// - Non si ricarica in loop
// - Gestisce autoplay bloccato dal browser
// - Si pausa correttamente quando necessario

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

const QuizMediaFixed = ({ 
    mediaUrl, 
    mediaType, 
    state,  // 'question_shown', 'answers_open', 'reveal_answer', etc
    autoplay = true,
    volume = 100
}) => {
    const playerRef = useRef(null);
    const currentVideoIdRef = useRef(null);
    const playerReadyRef = useRef(false);
    
    const [isLoading, setIsLoading] = useState(true);
    const [audioBlocked, setAudioBlocked] = useState(false);
    
    const detectedType = getMediaType(mediaUrl, mediaType);
    const isAudioMode = mediaType === 'audio';
    
    // Determina se il player deve essere pausato in base allo stato
    const shouldPause = ['reveal_answer', 'show_results', 'leaderboard'].includes(state);
    
    useEffect(() => {
        // Se non c'è media, resetta tutto
        if (!mediaUrl || detectedType !== 'youtube') {
            currentVideoIdRef.current = null;
            playerReadyRef.current = false;
            return;
        }

        const videoId = getYoutubeId(mediaUrl);
        
        // Se è lo stesso video e il player è già pronto, gestisci play/pause
        if (currentVideoIdRef.current === videoId && playerReadyRef.current && playerRef.current) {
            try {
                if (shouldPause) {
                    playerRef.current.pauseVideo();
                } else if (autoplay) {
                    playerRef.current.playVideo();
                }
            } catch(e) {
                console.warn("Error controlling player:", e);
            }
            return;
        }

        // Nuovo video: carica il player
        currentVideoIdRef.current = videoId;
        setIsLoading(true);
        setAudioBlocked(false);
        playerReadyRef.current = false;

        const initPlayer = () => {
            // Distruggi player precedente se esiste
            if (playerRef.current) {
                try { 
                    playerRef.current.destroy(); 
                } catch(e) {
                    console.warn("Error destroying player:", e);
                }
                playerRef.current = null;
            }

            if (!window.YT || !videoId) return;

            try {
                playerRef.current = new window.YT.Player('quiz-media-player', {
                    videoId: videoId,
                    playerVars: {
                        autoplay: autoplay ? 1 : 0,
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
                            playerReadyRef.current = true;
                            
                            // Imposta volume
                            event.target.setVolume(volume);
                            event.target.unMute();
                            
                            // Verifica se il browser ha bloccato l'audio
                            if (event.target.isMuted()) {
                                setAudioBlocked(true);
                            }

                            // Play o pause in base allo stato
                            if (shouldPause) {
                                event.target.pauseVideo();
                            } else if (autoplay) {
                                event.target.playVideo();
                            }
                            
                            setIsLoading(false);
                        },
                        onStateChange: (event) => {
                            // Se l'utente sblocca l'audio, nascondi l'avviso
                            if (event.data === window.YT.PlayerState.PLAYING && !event.target.isMuted()) {
                                setAudioBlocked(false);
                            }
                        },
                        onError: (event) => {
                            console.error("YouTube Player Error:", event.data);
                            setIsLoading(false);
                        }
                    }
                });
            } catch(e) {
                console.error("Error creating YouTube player:", e);
                setIsLoading(false);
            }
        };

        // Carica l'API di YouTube se non è già caricata
        if (!window.YT) {
            const tag = document.createElement('script');
            tag.src = "https://www.youtube.com/iframe_api";
            const firstScriptTag = document.getElementsByTagName('script')[0];
            firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
            window.onYouTubeIframeAPIReady = initPlayer;
        } else {
            initPlayer();
        }

        // Cleanup al unmount
        return () => {
            if (playerRef.current) {
                try { 
                    playerRef.current.destroy(); 
                } catch(e) {}
                playerRef.current = null;
            }
            playerReadyRef.current = false;
        };
    }, [mediaUrl, detectedType, autoplay, volume, shouldPause]);

    // Se non c'è media YouTube, mostra sfondo nero
    if (!mediaUrl || detectedType !== 'youtube') {
        return <div className="absolute inset-0 z-0 bg-zinc-900" />;
    }

    return (
        <div className="absolute inset-0 z-0 bg-black overflow-hidden flex items-center justify-center">
            {/* YouTube Player Container */}
            <div 
                id="quiz-media-player" 
                className={`absolute inset-0 w-full h-full object-cover pointer-events-none transition-opacity duration-500 ${
                    isAudioMode ? 'opacity-0' : 'opacity-60'
                }`} 
            />
            
            {/* Loading Spinner */}
            {isLoading && (
                <div className="absolute z-10 text-fuchsia-500 animate-spin">
                    <Loader2 size={64} />
                </div>
            )}

            {/* Audio Blocked Warning */}
            {audioBlocked && (
                <div 
                    className="absolute top-10 right-10 z-50 bg-red-600 text-white p-4 rounded-full animate-bounce cursor-pointer shadow-lg border-4 border-white"
                    onClick={() => {
                        if(playerRef.current) {
                            playerRef.current.unMute();
                            playerRef.current.playVideo();
                            setAudioBlocked(false);
                        }
                    }}
                >
                    <div className="flex items-center gap-2 font-bold text-xl">
                        <VolumeX size={32} /> 
                        <span>CLICCA PER ATTIVARE AUDIO</span>
                    </div>
                </div>
            )}

            {/* Audio Mode Visual */}
            {isAudioMode && !isLoading && (
                <div className="absolute z-20 flex flex-col items-center animate-pulse">
                    <div className="bg-fuchsia-600/20 p-12 rounded-full border-4 border-fuchsia-500 mb-4 shadow-[0_0_50px_rgba(192,38,211,0.5)]">
                        <Music2 size={80} className="text-white" />
                    </div>
                    <h3 className="text-2xl text-white font-bold tracking-widest uppercase">
                        Ascolta la traccia
                    </h3>
                </div>
            )}
        </div>
    );
};

export default QuizMediaFixed;