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

    // --- GESTIONE VISIBILITÀ / STOP AUDIO ---
    // Questo è il fix fondamentale: se isVisible diventa false, mettiamo in PAUSA.
    useEffect(() => {
        if (!playerRef.current || typeof playerRef.current.pauseVideo !== 'function') return;

        if (!isVisible) {
            playerRef.current.pauseVideo();
        } else {
            // Se torna visibile ed era un video caricato, riprendiamo (opzionale, o ricarichiamo)
            if (playerRef.current.getPlayerState() === 2) { // 2 = Paused
                playerRef.current.playVideo();
            }
        }
    }, [isVisible]);

    // --- LOGICA YOUTUBE ---
    useEffect(() => {
        if (!videoId) return;

        // Se l'ID è lo stesso, non ricarichiamo iframe, ma assicuriamoci che suoni se visibile
        if (currentVideoIdRef.current === videoId) {
            if (isVisible && playerRef.current && typeof playerRef.current.playVideo === 'function') {
                playerRef.current.playVideo();
            }
            return; 
        }

        currentVideoIdRef.current = videoId;
        setAudioBlocked(false);

        const onPlayerReady = (event) => {
            const player = event.target;
            player.setVolume(100);
            player.unMute();
            if (isVisible) player.playVideo(); // Suona solo se deve essere visibile
            
            if (player.isMuted()) setAudioBlocked(true);
        };

        const onStateChange = (event) => {
            if (event.data === 1 && !event.target.isMuted()) {
                setAudioBlocked(false);
            }
        };

        if (!playerRef.current) {
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
            if (typeof playerRef.current.loadVideoById === 'function') {
                playerRef.current.loadVideoById(videoId);
                playerRef.current.setVolume(100);
                playerRef.current.unMute();
            }
        }
    }, [videoId, isVisible]); // Aggiunto isVisible alle dipendenze per sicurezza

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

    const containerClass = `absolute inset-0 z-0 bg-black flex items-center justify-center transition-opacity duration-500 ${isVisible && mediaUrl ? 'opacity-100' : 'opacity-0 pointer-events-none'}`;

    if (detectedType === 'audio_file') {
        return (
            <div className={containerClass}>
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
    return prev.mediaUrl === next.mediaUrl && prev.isVisible === next.isVisible;
});

export default QuizMediaFixed;