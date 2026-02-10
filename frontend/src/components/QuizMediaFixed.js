import React, { useEffect, useRef, useState, memo } from "react";
import { Music2, Loader2, VolumeX, AlertTriangle, Ban } from "lucide-react";

// Estrae ID Youtube
const getYoutubeId = (url) => {
    if (!url || typeof url !== 'string') return null;
    try {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    } catch (e) { return null; }
};

// Determina tipo
const getMediaType = (url, type) => {
    if (type === 'video' || (url && (url.includes('youtube.com') || url.includes('youtu.be')))) return 'youtube';
    if (type === 'audio') return 'audio_file'; 
    return 'unknown';
};

const QuizMediaFixed = memo(({ mediaUrl, mediaType, isResult, mediaState = 'playing' }) => {
    const playerRef = useRef(null);    
    const currentVideoId = useRef(null); 
    
    const [status, setStatus] = useState('loading'); 
    const [audioBlocked, setAudioBlocked] = useState(false);

    const detectedType = getMediaType(mediaUrl, mediaType);
    const videoId = getYoutubeId(mediaUrl);

    // LOGICA 1: Inizializzazione e Aggiornamento (STILE KARAOKE)
    useEffect(() => {
        if (isResult || !mediaUrl || detectedType !== 'youtube' || !videoId) return;

        const onPlayerReady = (event) => {
            event.target.setVolume(100);
            event.target.unMute();
            if (mediaState === 'paused') event.target.pauseVideo();
            else event.target.playVideo();
            
            if (event.target.isMuted()) setAudioBlocked(true);
            setStatus('ready');
        };

        const onPlayerError = (event) => {
            console.error("YT Error:", event.data);
            if (event.data === 150 || event.data === 101) setStatus('blocked');
            else setStatus('error');
        };

        // SE NON ESISTE YT API: Caricala
        if (!window.YT) {
            const tag = document.createElement('script');
            tag.src = "https://www.youtube.com/iframe_api";
            const firstScriptTag = document.getElementsByTagName('script')[0];
            firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
            
            window.onYouTubeIframeAPIReady = () => {
                createPlayer(videoId, onPlayerReady, onPlayerError);
            };
        } 
        // SE ESISTE API MA NON PLAYER: Crea Player
        else if (!playerRef.current) {
             createPlayer(videoId, onPlayerReady, onPlayerError);
        } 
        // SE ESISTE PLAYER: Aggiorna solo se ID è diverso (NON DISTRUGGERE)
        else {
             if (currentVideoId.current !== videoId) {
                 currentVideoId.current = videoId;
                 setStatus('loading');
                 playerRef.current.loadVideoById(videoId);
             } else {
                 // Se il video è lo stesso, controlla solo play/pausa
                 if (mediaState === 'live' || mediaState === 'playing') playerRef.current.playVideo();
                 else if (mediaState === 'paused') playerRef.current.pauseVideo();
             }
        }
    }, [videoId, mediaState, isResult]); // Dipendenze mirate

    const createPlayer = (id, onReady, onError) => {
        // Se c'è già un iframe lì, svuotalo per sicurezza (ma senza distruggere ref se non serve)
        const placeholder = document.getElementById('quiz-fixed-player');
        if (!placeholder) return;

        currentVideoId.current = id;

        playerRef.current = new window.YT.Player('quiz-fixed-player', {
            videoId: id,
            playerVars: { 
                autoplay: 1, controls: 0, disablekb: 1, fs: 0, iv_load_policy: 3, 
                modestbranding: 1, rel: 0, showinfo: 0, mute: 0, origin: window.location.origin 
            },
            events: { onReady: onReady, onError: onError }
        });
    };

    // LOGICA 2: Gestione Audio HTML5 (separata da YT)
    useEffect(() => {
        if(detectedType === 'audio_file') setStatus('ready');
    }, [detectedType]);


    if (isResult) return null;

    return (
        <div className="absolute inset-0 z-0 bg-black overflow-hidden flex items-center justify-center">
            
            {/* CONTAINER YOUTUBE - ID FISSO */}
            <div 
                id="quiz-fixed-player"
                className={`absolute inset-0 w-full h-full transition-opacity duration-1000 pointer-events-none ${detectedType === 'youtube' && status === 'ready' && mediaType !== 'audio' ? 'opacity-100' : 'opacity-0'}`} 
            />

            {/* ERRORI */}
            {status === 'blocked' && (
                <div className="absolute z-20 flex flex-col items-center bg-red-900/90 p-8 rounded-xl border-2 border-red-500 backdrop-blur-md animate-pulse">
                    <Ban size={64} className="text-white mb-4" />
                    <h3 className="text-2xl font-bold text-white uppercase mb-2">VIDEO BLOCCATO</h3>
                    <p className="text-white/80 text-center">L'autore vieta la riproduzione qui.</p>
                </div>
            )}

            {status === 'error' && (
                <div className="absolute z-20 flex flex-col items-center bg-yellow-900/80 p-8 rounded-xl border-2 border-yellow-500 backdrop-blur-md">
                    <AlertTriangle size={64} className="text-white mb-4" />
                    <h3 className="text-2xl font-bold text-white uppercase">ERRORE CARICAMENTO</h3>
                </div>
            )}

            {/* PLAYER AUDIO HTML5 (Per file MP3 diretti) */}
            {detectedType === 'audio_file' && (
                <audio 
                    src={mediaUrl} 
                    autoPlay={mediaState === 'playing'} 
                    loop 
                    ref={el => {
                        if(el) {
                            if(mediaState==='paused') el.pause(); else el.play().catch(()=>setAudioBlocked(true));
                        }
                    }}
                    onError={() => setStatus('error')}
                />
            )}

            {/* BOTTONE SBLOCCO AUDIO */}
            {audioBlocked && status === 'ready' && (
                <div className="absolute top-10 right-10 z-50 bg-red-600 text-white p-4 rounded-full animate-bounce cursor-pointer shadow-lg border-4 border-white"
                     onClick={() => {
                         if(playerRef.current && typeof playerRef.current.unMute === 'function') {
                             playerRef.current.unMute();
                             playerRef.current.playVideo();
                         }
                         setAudioBlocked(false);
                     }}>
                    <div className="flex items-center gap-2 font-bold text-xl"><VolumeX size={32} /> ATTIVA AUDIO</div>
                </div>
            )}

            {/* VISUALIZER AUDIO (Se è solo audio o video oscurato) */}
            {(mediaType === 'audio' || detectedType === 'audio_file') && status === 'ready' && (
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

// Comparazione personalizzata per React.memo:
// Ricarica SOLO se cambia URL, Tipo, Risultato o Stato Play/Pausa.
// Ignora tutto il resto (es. aggiornamenti Supabase non correlati).
function arePropsEqual(prevProps, nextProps) {
    return (
        prevProps.mediaUrl === nextProps.mediaUrl &&
        prevProps.mediaType === nextProps.mediaType &&
        prevProps.isResult === nextProps.isResult &&
        prevProps.mediaState === nextProps.mediaState
    );
}

export default memo(QuizMediaFixed, arePropsEqual);