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

// Usa memo con confronto personalizzato per evitare re-render inutili
const QuizMediaFixed = memo(({ mediaUrl, mediaType, isResult, volume = 100 }) => {
    const playerRef = useRef(null);
    const currentVideoIdRef = useRef(null);
    
    const [isLoading, setIsLoading] = useState(false);
    const [audioBlocked, setAudioBlocked] = useState(false);
    const [playerReady, setPlayerReady] = useState(false);

    const detectedType = getMediaType(mediaUrl, mediaType);
    const videoId = detectedType === 'youtube' ? getYoutubeId(mediaUrl) : null;

    // --- GESTIONE YOUTUBE ---
    useEffect(() => {
        // Se non c'è video o siamo ai risultati, non fare nulla di pesante
        if (!videoId || isResult) return;

        // Se il video è lo stesso che sta già girando, NON FARE NULLA (evita il riavvio)
        if (playerRef.current && currentVideoIdRef.current === videoId) {
            return;
        }

        // Se è un nuovo video
        setIsLoading(true);
        currentVideoIdRef.current = videoId;

        const onPlayerReady = (event) => {
            setPlayerReady(true);
            setIsLoading(false);
            const player = event.target;
            player.setVolume(volume);
            player.unMute(); 
            player.playVideo();
            
            // Controllo paranoico audio
            if (player.isMuted()) setAudioBlocked(true);
            else setAudioBlocked(false);
        };

        const onStateChange = (event) => {
            // 1 = Playing
            if (event.data === 1) {
                setIsLoading(false);
                if (!event.target.isMuted()) setAudioBlocked(false);
            }
        };

        // Inizializza Player SOLO se non esiste
        if (!playerRef.current) {
            const initYT = () => {
                playerRef.current = new window.YT.Player('quiz-fixed-player', {
                    videoId: videoId,
                    height: '100%',
                    width: '100%',
                    playerVars: {
                        autoplay: 1, controls: 0, disablekb: 1, fs: 0, 
                        iv_load_policy: 3, modestbranding: 1, rel: 0, 
                        showinfo: 0, mute: 0, origin: window.location.origin
                    },
                    events: { onReady: onPlayerReady, onStateChange: onStateChange }
                });
            };

            if (!window.YT) {
                const tag = document.createElement('script');
                tag.src = "https://www.youtube.com/iframe_api";
                const firstScriptTag = document.getElementsByTagName('script')[0];
                firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
                window.onYouTubeIframeAPIReady = initYT;
            } else {
                initYT();
            }
        } else {
            // Se il player esiste già, CARICA IL NUOVO VIDEO SENZA DISTRUGGERE L'IFRAME
            if (playerRef.current.loadVideoById) {
                playerRef.current.loadVideoById(videoId);
                playerRef.current.setVolume(volume);
                playerRef.current.unMute();
            }
        }

    }, [videoId, isResult, volume]);

    // Force Unmute manuale
    const handleForceUnmute = () => {
        if (playerRef.current && playerRef.current.unMute) {
            playerRef.current.unMute();
            playerRef.current.setVolume(100);
            setAudioBlocked(false);
        }
    };

    // --- RENDER AUDIO FILE (MP3) ---
    if (detectedType === 'audio_file') {
        return (
            <div className="absolute inset-0 z-0 bg-gradient-to-br from-fuchsia-900 to-purple-900 flex items-center justify-center">
                 {/* key={mediaUrl} forza il reload solo se cambia URL */}
                 <audio key={mediaUrl} autoPlay src={mediaUrl} onError={() => setIsLoading(false)} />
                 <div className="flex flex-col items-center animate-pulse">
                        <div className="bg-white/10 p-12 rounded-full border-4 border-white/20 mb-4 shadow-[0_0_50px_rgba(255,255,255,0.2)]">
                            <Music2 size={100} className="text-white" />
                        </div>
                        <h3 className="text-3xl text-white font-bold tracking-widest uppercase">Ascolta la traccia</h3>
                </div>
            </div>
        );
    }

    // --- RENDER YOUTUBE ---
    if (detectedType === 'youtube') {
        const isAudioOnlyMode = mediaType === 'audio';

        return (
            <div className="absolute inset-0 z-0 bg-black overflow-hidden flex items-center justify-center">
                <div id="quiz-fixed-player" className={`absolute inset-0 w-full h-full object-cover pointer-events-none transition-opacity duration-1000 ${isAudioOnlyMode ? 'opacity-0' : 'opacity-100'}`} />
                
                {isLoading && (
                    <div className="absolute z-10 text-fuchsia-500 animate-spin"><Loader2 size={64} /></div>
                )}

                {/* BOTTONE EMERGENZA AUDIO */}
                {audioBlocked && (
                    <div className="absolute top-24 right-10 z-[100] bg-red-600 text-white px-6 py-4 rounded-xl animate-bounce cursor-pointer shadow-2xl border-4 border-white flex items-center gap-4 hover:scale-110 transition"
                         onClick={handleForceUnmute} style={{pointerEvents: 'auto'}}>
                        <VolumeX size={40} /> 
                        <div className="text-left">
                            <div className="font-black text-xl">AUDIO BLOCCATO</div>
                            <div className="text-sm">Clicca per attivare</div>
                        </div>
                    </div>
                )}

                {isAudioOnlyMode && (
                    <div className="absolute z-20 flex flex-col items-center animate-pulse pointer-events-none">
                        <div className="bg-fuchsia-600/20 p-12 rounded-full border-4 border-fuchsia-500 mb-4 shadow-[0_0_50px_rgba(192,38,211,0.5)]">
                            <Music2 size={80} className="text-white" />
                        </div>
                        <h3 className="text-2xl text-white font-bold tracking-widest uppercase">Ascolta l'audio...</h3>
                    </div>
                )}
            </div>
        );
    }

    return <div className="absolute inset-0 z-0 bg-zinc-900" />;
}, (prevProps, nextProps) => {
    // FUNZIONE DI CONFRONTO CUSTOM PER REACT.MEMO
    // Ritorna TRUE se NON deve rrenderizzare
    return prevProps.mediaUrl === nextProps.mediaUrl && 
           prevProps.mediaType === nextProps.mediaType &&
           prevProps.isResult === nextProps.isResult;
});

export default QuizMediaFixed;