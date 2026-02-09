import React, { useEffect, useRef, useState } from "react";
import { Music2, Film, Loader2 } from "lucide-react";

const getYoutubeId = (url) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
};

const getMediaType = (url, type) => {
    if (type === 'video' || (url && (url.includes('youtube.com') || url.includes('youtu.be')))) return 'youtube';
    if (type === 'audio') return 'audio_file'; // O gestibile via youtube
    return 'unknown';
};

const QuizMediaFixed = ({ mediaUrl, mediaType, isResult }) => {
    const playerRef = useRef(null);
    const currentVideoIdRef = useRef(null);
    const hasStartedRef = useRef(false);
    const [isLoading, setIsLoading] = useState(true);

    const detectedType = getMediaType(mediaUrl, mediaType);

    useEffect(() => {
        if (isResult) {
            currentVideoIdRef.current = null;
            hasStartedRef.current = false;
            return;
        }

        if (detectedType === 'youtube' && mediaUrl) {
            const videoId = getYoutubeId(mediaUrl);
            
            if (currentVideoIdRef.current === videoId && hasStartedRef.current) {
                return;
            }

            currentVideoIdRef.current = videoId;
            setIsLoading(true);

            const initPlayer = () => {
                if (playerRef.current) {
                    try { playerRef.current.destroy(); } catch(e) {}
                }

                if (!window.YT) return;

                playerRef.current = new window.YT.Player('quiz-fixed-player', {
                    videoId: videoId,
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
                            event.target.playVideo();
                            hasStartedRef.current = true;
                            setIsLoading(false);
                        }
                    }
                });
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
    }, [mediaUrl, detectedType, isResult]);

    if (isResult) return null;

    if (detectedType === 'youtube') {
        const isAudioMode = mediaType === 'audio';
        
        return (
            <div className="absolute inset-0 z-0 bg-black overflow-hidden flex items-center justify-center">
                <div id="quiz-fixed-player" className={`absolute inset-0 w-full h-full object-cover pointer-events-none transition-opacity duration-1000 ${isAudioMode ? 'opacity-0' : 'opacity-60'}`} />
                
                {isLoading && (
                    <div className="absolute z-10 text-fuchsia-500 animate-spin"><Loader2 size={64} /></div>
                )}

                {isAudioMode && (
                    <div className="absolute z-20 flex flex-col items-center animate-pulse">
                        <div className="bg-fuchsia-600/20 p-12 rounded-full border-4 border-fuchsia-500 mb-4 shadow-[0_0_50px_rgba(192,38,211,0.5)]">
                            <Music2 size={80} className="text-white" />
                        </div>
                        <h3 className="text-2xl text-white font-bold tracking-widest uppercase">Ascolta la traccia</h3>
                    </div>
                )}
            </div>
        );
    }

    return <div className="absolute inset-0 z-0 bg-zinc-900" />;
};

export default QuizMediaFixed;