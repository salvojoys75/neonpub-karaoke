import React, { useEffect, useRef, useState, memo } from "react";
import { Music2, Loader2, VolumeX, Volume2 } from "lucide-react";

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

const QuizMediaFixed = memo(({ mediaUrl, mediaType, isResult }) => {
    const playerRef = useRef(null);
    const containerRef = useRef(null);
    const [isLoading, setIsLoading] = useState(true);
    const [audioBlocked, setAudioBlocked] = useState(false);
    const [playerReady, setPlayerReady] = useState(false);

    const detectedType = getMediaType(mediaUrl, mediaType);
    const videoId = detectedType === 'youtube' ? getYoutubeId(mediaUrl) : null;

    // Gestione Inizializzazione Player YouTube
    useEffect(() => {
        // Se siamo nei risultati o non c'è video, resettiamo
        if (isResult || !videoId) {
            return;
        }

        setIsLoading(true);
        setAudioBlocked(false);

        const onPlayerReady = (event) => {
            setPlayerReady(true);
            setIsLoading(false);
            
            const player = event.target;
            player.setVolume(100);
            player.unMute();
            
            // Tenta il play
            const playPromise = player.playVideo();
            
            // Verifica se è partito mutato o bloccato
            if (player.isMuted()) {
                setAudioBlocked(true);
            }
        };

        const onPlayerStateChange = (event) => {
            // 1 = Playing. Se sta suonando e non è muto, rimuovi avviso blocco
            if (event.data === 1 && !event.target.isMuted()) {
                setAudioBlocked(false);
            }
        };

        if (!window.YT) {
            const tag = document.createElement('script');
            tag.src = "https://www.youtube.com/iframe_api";
            const firstScriptTag = document.getElementsByTagName('script')[0];
            firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
            
            window.onYouTubeIframeAPIReady = () => {
                createPlayer(videoId, onPlayerReady, onPlayerStateChange);
            };
        } else {
            createPlayer(videoId, onPlayerReady, onPlayerStateChange);
        }

        return () => {
            if (playerRef.current) {
                try {
                    playerRef.current.destroy(); 
                } catch(e) { console.error(e); }
                playerRef.current = null;
            }
        };
    }, [videoId, isResult]); // Dipendenze ridotte al minimo per evitare reload

    const createPlayer = (id, onReady, onStateChange) => {
        // Distruggi istanza precedente se esiste per evitare conflitti
        if (playerRef.current) {
             try { playerRef.current.destroy(); } catch(e){}
        }

        playerRef.current = new window.YT.Player('quiz-fixed-player', {
            videoId: id,
            height: '100%',
            width: '100%',
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
                onReady: onReady,
                onStateChange: onStateChange
            }
        });
    };

    // Forza unMute se l'utente clicca (per bypassare blocchi browser)
    const handleForceUnmute = () => {
        if (playerRef.current && playerRef.current.unMute) {
            playerRef.current.unMute();
            playerRef.current.setVolume(100);
            setAudioBlocked(false);
        }
    };

    // Render Audio Player (MP3 diretti)
    if (detectedType === 'audio_file') {
        return (
            <div className="absolute inset-0 z-0 bg-gradient-to-br from-fuchsia-900 to-purple-900 flex items-center justify-center">
                 <audio autoPlay src={mediaUrl} onPlay={() => setIsLoading(false)} onError={() => setIsLoading(false)} />
                 <div className="flex flex-col items-center animate-pulse">
                        <div className="bg-white/10 p-12 rounded-full border-4 border-white/20 mb-4 shadow-[0_0_50px_rgba(255,255,255,0.2)]">
                            <Music2 size={100} className="text-white" />
                        </div>
                        <h3 className="text-3xl text-white font-bold tracking-widest uppercase">Audio Question</h3>
                </div>
            </div>
        );
    }

    // Render YouTube
    if (detectedType === 'youtube') {
        const isAudioOnlyMode = mediaType === 'audio'; // Se è un video YT usato solo per l'audio

        return (
            <div className="absolute inset-0 z-0 bg-black overflow-hidden flex items-center justify-center">
                {/* Il div che contiene l'iframe */}
                <div id="quiz-fixed-player" className={`absolute inset-0 w-full h-full object-cover pointer-events-none transition-opacity duration-1000 ${isAudioOnlyMode ? 'opacity-0' : 'opacity-100'}`} />
                
                {isLoading && (
                    <div className="absolute z-10 text-fuchsia-500 animate-spin"><Loader2 size={64} /></div>
                )}

                {/* AVVISO BLOCCA AUDIO */}
                {audioBlocked && (
                    <div className="absolute top-20 right-10 z-50 bg-red-600 text-white px-6 py-4 rounded-xl animate-bounce cursor-pointer shadow-2xl border-4 border-white flex items-center gap-4 hover:scale-110 transition"
                         onClick={handleForceUnmute}>
                        <VolumeX size={40} /> 
                        <div className="text-left">
                            <div className="font-black text-xl">AUDIO BLOCCATO</div>
                            <div className="text-sm">CLICCA QUI PER ATTIVARE</div>
                        </div>
                    </div>
                )}

                {/* VISUALIZZATORE SE MODALITÀ AUDIO (MA FONTE YOUTUBE) */}
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

    // Fallback Background
    return <div className="absolute inset-0 z-0 bg-zinc-900" />;
});

export default QuizMediaFixed;