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
    const currentVideoIdRef = useRef(null);
    const [audioBlocked, setAudioBlocked] = useState(false);

    const detectedType = getMediaType(mediaUrl, mediaType);
    const videoId = detectedType === 'youtube' ? getYoutubeId(mediaUrl) : null;

    // --- LOGICA YOUTUBE ---
    useEffect(() => {
        // Se non c'è URL o non siamo visibili (opzionale), non facciamo nulla di distruttivo
        if (!videoId) return;

        // CRUCIALE: Se l'ID è lo stesso di prima, NON TOCCARE NULLA.
        // Questo impedisce il reload/rewind quando cambia solo lo stato del quiz.
        if (currentVideoIdRef.current === videoId) {
            return; 
        }

        // È un nuovo video. Aggiorniamo il ref.
        currentVideoIdRef.current = videoId;
        setAudioBlocked(false);

        const onPlayerReady = (event) => {
            const player = event.target;
            player.setVolume(100);
            player.unMute();
            player.playVideo();
            if (player.isMuted()) setAudioBlocked(true);
        };

        const onStateChange = (event) => {
            // Se sta suonando (1) e non è muto, togliamo l'avviso
            if (event.data === 1 && !event.target.isMuted()) {
                setAudioBlocked(false);
            }
        };

        // Inizializza o Aggiorna Player
        if (!playerRef.current) {
            // Crea nuova istanza
            if (!window.YT) {
                const tag = document.createElement('script');
                tag.src = "https://www.youtube.com/iframe_api";
                const firstScriptTag = document.getElementsByTagName('script')[0];
                firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
                window.onYouTubeIframeAPIReady = () => createPlayer(videoId, onPlayerReady, onStateChange);
            } else {
                createPlayer(videoId, onPlayerReady, onStateChange);
            }
        } else {
            // Player esiste già: Carica solo il video senza distruggere iframe
            if (typeof playerRef.current.loadVideoById === 'function') {
                playerRef.current.loadVideoById(videoId);
                playerRef.current.setVolume(100);
                playerRef.current.unMute();
            }
        }
    }, [videoId]); // Dipende SOLO dall'ID del video. Ignora tutto il resto.

    const createPlayer = (id, onReady, onStateChange) => {
        playerRef.current = new window.YT.Player('quiz-fixed-player', {
            videoId: id,
            height: '100%',
            width: '100%',
            playerVars: {
                autoplay: 1, controls: 0, disablekb: 1, fs: 0, 
                iv_load_policy: 3, modestbranding: 1, rel: 0, 
                showinfo: 0, mute: 0, origin: window.location.origin
            },
            events: { onReady, onStateChange }
        });
    };

    const handleForceUnmute = () => {
        if (playerRef.current && playerRef.current.unMute) {
            playerRef.current.unMute();
            playerRef.current.setVolume(100);
            setAudioBlocked(false);
        }
    };

    // Se non c'è nulla da mostrare, rendiamo invisibile ma NON smontiamo (per YouTube)
    const containerClass = `absolute inset-0 z-0 bg-black flex items-center justify-center transition-opacity duration-500 ${isVisible && mediaUrl ? 'opacity-100' : 'opacity-0 pointer-events-none'}`;

    if (detectedType === 'audio_file') {
        return (
            <div className={containerClass}>
                 {/* Audio HTML5 standard per MP3 */}
                 {isVisible && <audio autoPlay src={mediaUrl} loop />}
                 <div className="flex flex-col items-center animate-pulse">
                        <div className="bg-white/10 p-12 rounded-full border-4 border-white/20 mb-4 shadow-[0_0_50px_rgba(255,255,255,0.2)]">
                            <Music2 size={100} className="text-white" />
                        </div>
                        <h3 className="text-3xl text-white font-bold tracking-widest uppercase">Traccia Audio</h3>
                </div>
            </div>
        );
    }

    // YouTube Container (Sempre presente, cambia solo opacità/z-index)
    return (
        <div className={containerClass} style={{ zIndex: 0 }}>
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
    // Rerenderizza solo se cambia URL o Visibilità in modo significativo
    return prev.mediaUrl === next.mediaUrl && prev.isVisible === next.isVisible;
});

export default QuizMediaFixed;