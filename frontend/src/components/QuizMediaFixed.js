import React, { useEffect, useRef, useState, memo } from "react";
import { Music2, Loader2, VolumeX, AlertTriangle, Ban } from "lucide-react";

const getYoutubeId = (url) => {
    if (!url || typeof url !== 'string') return null;
    try {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    } catch (e) { return null; }
};

const getMediaType = (url, type) => {
    if (type === 'video' || (url && (url.includes('youtube.com') || url.includes('youtu.be')))) return 'youtube';
    if (type === 'audio') return 'audio_file'; 
    return 'unknown';
};

const QuizMediaFixed = memo(({ mediaUrl, mediaType, isResult, mediaState = 'playing' }) => {
    const containerRef = useRef(null); 
    const playerRef = useRef(null);    
    const currentVideoId = useRef(null); 
    
    const [status, setStatus] = useState('loading'); // loading, ready, error, blocked
    const [audioBlocked, setAudioBlocked] = useState(false);

    const detectedType = getMediaType(mediaUrl, mediaType);

    // 1. INIZIALIZZAZIONE PLAYER (Isolamento DOM)
    useEffect(() => {
        if (isResult || !mediaUrl) return;

        if (detectedType === 'youtube') {
            const videoId = getYoutubeId(mediaUrl);
            
            // Se il video è lo stesso, non rifare l'init
            if (currentVideoId.current === videoId && playerRef.current) {
                return; 
            }

            currentVideoId.current = videoId;
            setStatus('loading');
            setAudioBlocked(false);

            // Distruzione sicura istanza precedente
            if (playerRef.current) {
                try { playerRef.current.destroy(); } catch(e) {}
                playerRef.current = null;
            }

            // CREAZIONE MANUALE DEL DIV (React non lo toccherà più)
            if (containerRef.current) {
                containerRef.current.innerHTML = ''; 
                const placeholder = document.createElement('div');
                placeholder.id = 'yt-placeholder-isolated';
                containerRef.current.appendChild(placeholder);
            }

            const initPlayer = () => {
                if (!window.YT || !window.YT.Player) return;

                try {
                    playerRef.current = new window.YT.Player('yt-placeholder-isolated', {
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
                                setStatus('ready');
                            },
                            onError: (event) => {
                                console.error("YT Error:", event.data);
                                // 150 o 101 = Video bloccato su siti esterni
                                if (event.data === 150 || event.data === 101) {
                                    setStatus('blocked');
                                } else {
                                    setStatus('error');
                                }
                            }
                        }
                    });
                } catch (err) {
                    console.error("Crash Init:", err);
                    setStatus('error');
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
            setStatus('ready');
        }

    }, [mediaUrl, detectedType]); 

    // 2. GESTIONE REGIA (Play/Pause)
    useEffect(() => {
        if (status !== 'ready') return;

        if (detectedType === 'youtube' && playerRef.current && typeof playerRef.current.getPlayerState === 'function') {
            const pState = playerRef.current.getPlayerState();
            if (mediaState === 'paused' && pState !== 2) playerRef.current.pauseVideo();
            else if (mediaState === 'playing' && pState !== 1 && pState !== 3) playerRef.current.playVideo();
        }
    }, [mediaState, status, detectedType]);


    if (isResult) return null;

    return (
        <div className="absolute inset-0 z-0 bg-black overflow-hidden flex items-center justify-center">
            
            {/* CONTAINER YOUTUBE ISOLATO */}
            <div 
                ref={containerRef} 
                className={`absolute inset-0 w-full h-full ${detectedType === 'youtube' && status === 'ready' && mediaType !== 'audio' ? 'opacity-60' : 'opacity-0'}`} 
            />

            {/* LOADING */}
            {status === 'loading' && detectedType === 'youtube' && (
                <div className="absolute z-10 text-fuchsia-500 animate-spin"><Loader2 size={64} /></div>
            )}

            {/* ERRORI VISIVI (Gestione Codice 150/Block) */}
            {status === 'blocked' && (
                <div className="absolute z-20 flex flex-col items-center bg-red-900/80 p-8 rounded-xl border-2 border-red-500 backdrop-blur-md animate-pulse">
                    <Ban size={64} className="text-white mb-4" />
                    <h3 className="text-2xl font-bold text-white uppercase mb-2">VIDEO NON DISPONIBILE</h3>
                    <p className="text-white/80 text-center">L'autore ha bloccato la riproduzione<br/>su siti esterni (Err. 150).</p>
                </div>
            )}

            {status === 'error' && (
                <div className="absolute z-20 flex flex-col items-center bg-yellow-900/80 p-8 rounded-xl border-2 border-yellow-500 backdrop-blur-md">
                    <AlertTriangle size={64} className="text-white mb-4" />
                    <h3 className="text-2xl font-bold text-white uppercase">ERRORE MEDIA</h3>
                    <p className="text-sm text-zinc-300">Impossibile caricare il video.</p>
                </div>
            )}

            {/* AUDIO HTML5 */}
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

            {/* PULSANTE SBLOCCO AUDIO */}
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

            {/* MODALITÀ SOLO AUDIO (ICONCINA) */}
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

export default QuizMediaFixed;