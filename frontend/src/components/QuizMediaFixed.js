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
    // Se l'admin ha specificato esplicitamente il tipo, usiamo quello
    if (type === 'video') return 'youtube';
    if (type === 'audio') return 'audio_file';
    
    // Altrimenti proviamo a indovinare
    if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
    if (url.match(/\.(mp3|wav|ogg)$/i)) return 'audio_file';
    
    return 'unknown'; 
};

const QuizMediaFixed = memo(({ mediaUrl, mediaType, isVisible }) => {
    const playerRef = useRef(null);
    const audioRef = useRef(null);
    const containerRef = useRef(null);
    const [audioBlocked, setAudioBlocked] = useState(false);
    
    // Tiene traccia del video corrente per evitare reload inutili
    const currentVideoId = useRef(null);

    const detectedType = getMediaType(mediaUrl, mediaType);
    const youtubeId = detectedType === 'youtube' ? getYoutubeId(mediaUrl) : null;

    // --- 1. GESTIONE YOUTUBE ---
    useEffect(() => {
        if (detectedType !== 'youtube') return;

        // Funzione di inizializzazione sicura
        const initPlayer = () => {
            // Se il player esiste già nel DOM, non ricrearlo
            if (playerRef.current && playerRef.current.loadVideoById) return;

            // Se il container non è ancora montato, riprova tra poco
            if (!document.getElementById('quiz-fixed-player')) {
                setTimeout(initPlayer, 100);
                return;
            }

            try {
                // Pulizia preventiva se c'è spazzatura nel ref
                if (playerRef.current) {
                    try { playerRef.current.destroy(); } catch(e){}
                }

                playerRef.current = new window.YT.Player('quiz-fixed-player', {
                    height: '100%',
                    width: '100%',
                    videoId: youtubeId, // Carica subito l'ID se c'è
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
                        origin: window.location.origin
                    },
                    events: {
                        onReady: (event) => {
                            event.target.setVolume(100);
                            if (isVisible) event.target.playVideo();
                        },
                        onStateChange: (event) => {
                            // Se sta suonando (1) ma è mutato, mostra avviso
                            if (event.data === 1 && event.target.isMuted()) {
                                setAudioBlocked(true);
                            } else {
                                setAudioBlocked(false);
                            }
                        }
                    }
                });
                currentVideoId.current = youtubeId;
            } catch (e) {
                console.error("YouTube Player Init Error:", e);
            }
        };

        // Verifica disponibilità API globale
        if (!window.YT || !window.YT.Player) {
            // Non carichiamo lo script qui, ci aspettiamo che PubDisplay lo faccia globalmente
            // per evitare conflitti con il Karaoke. Aspettiamo solo che sia pronto.
            const checkInterval = setInterval(() => {
                if (window.YT && window.YT.Player) {
                    clearInterval(checkInterval);
                    initPlayer();
                }
            }, 100);
            return () => { clearInterval(checkInterval); };
        } else {
            initPlayer();
        }

    }, [detectedType]); // Ricarica solo se cambia il TIPO di media, non l'URL (gestito sotto)

    // --- 2. CONTROLLO PLAYBACK VIDEO (Update props) ---
    useEffect(() => {
        if (detectedType !== 'youtube' || !playerRef.current || !playerRef.current.loadVideoById) return;

        // Cambio Video
        if (youtubeId && youtubeId !== currentVideoId.current) {
            currentVideoId.current = youtubeId;
            playerRef.current.loadVideoById(youtubeId);
            if (isVisible) playerRef.current.playVideo();
        }

        // Cambio Visibilità
        if (isVisible) {
            const state = playerRef.current.getPlayerState();
            // Se non è in play (1) e non sta caricando (3), avvia
            if (state !== 1 && state !== 3) {
                playerRef.current.playVideo();
            }
        } else {
            // Non stoppare completamente, metti in pausa per ripresa rapida
            playerRef.current.pauseVideo();
        }

        return () => {
            if (playerRef.current && typeof playerRef.current.destroy === 'function') {
                playerRef.current.destroy();
                playerRef.current = null;
            }
        };
    }, [youtubeId, isVisible, detectedType]);

    // --- 3. GESTIONE AUDIO FILE (MP3) ---
    useEffect(() => {
        if (detectedType === 'audio_file' && audioRef.current) {
            if (isVisible) {
                const playPromise = audioRef.current.play();
                if (playPromise !== undefined) {
                    playPromise.catch(error => {
                        console.log("Autoplay audio bloccato:", error);
                        setAudioBlocked(true);
                    });
                }
            } else {
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
            }
        }

        return () => {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        };
    }, [mediaUrl, isVisible, detectedType]);

    // Force Unmute per interazione utente
    const handleForceUnmute = () => {
        setAudioBlocked(false);
        if (detectedType === 'youtube' && playerRef.current) {
            playerRef.current.unMute();
            playerRef.current.setVolume(100); 
        } else if (detectedType === 'audio_file' && audioRef.current) {
            audioRef.current.play();
        }
    };

    // --- RENDER ---
    
    // Se non c'è media, smonta per risparmiare risorse, 
    // ma mantieni la struttura base se serve per transizioni
    if (detectedType === 'none') return null;

    return (
        <div 
            ref={containerRef}
            className={`absolute inset-0 z-0 bg-black flex items-center justify-center transition-opacity duration-700 ease-in-out ${isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        >
            {detectedType === 'audio_file' && (
                <div className="flex flex-col items-center animate-pulse z-10">
                    <audio ref={audioRef} src={mediaUrl} loop playsInline preload="auto" />
                    <div className="bg-white/10 p-12 rounded-full border-4 border-white/20 mb-8 shadow-[0_0_80px_rgba(255,255,255,0.15)]">
                        <Music2 size={120} className="text-white drop-shadow-lg" />
                    </div>
                    <h3 className="text-4xl text-white font-black tracking-[0.5em] uppercase text-center">Ascolta l'audio</h3>
                </div>
            )}

            {detectedType === 'youtube' && (
                <div id="quiz-fixed-player" className="absolute inset-0 w-full h-full pointer-events-none" />
            )}
            
            {/* Bottone di emergenza se l'audio è bloccato dal browser */}
            {audioBlocked && isVisible && (
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[100] cursor-pointer" onClick={handleForceUnmute}>
                    <div className="bg-red-600 text-white px-8 py-6 rounded-2xl animate-bounce shadow-[0_0_50px_rgba(220,38,38,0.8)] border-4 border-white flex items-center gap-6 hover:scale-110 transition">
                        <VolumeX size={64} /> 
                        <div className="text-left">
                            <div className="font-black text-3xl">ATTIVA AUDIO</div>
                            <div className="text-lg opacity-90">Clicca per ascoltare</div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}, (prev, next) => {
    // MEMOIZATION CRITICA:
    // Non ri-renderizzare se URL e Visibilità sono identici.
    // Questo previene il "flash" quando il database manda aggiornamenti non correlati.
    return prev.mediaUrl === next.mediaUrl && 
           prev.mediaType === next.mediaType &&
           prev.isVisible === next.isVisible;
});

export default QuizMediaFixed;