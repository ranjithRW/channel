import { useEffect, useRef, useState, useCallback } from 'react';
import { Volume2, VolumeX, Maximize, Minimize, RefreshCw, AlertTriangle } from 'lucide-react';
import Hls from 'hls.js';

interface VideoPlayerProps {
  src: string;
  channelName: string;
}

const MAX_RETRY = 6;
const RETRY_BASE_DELAY = 1500;

function proxyUrl(url: string): string {
  return `/api/proxy?url=${encodeURIComponent(url)}`;
}

export default function VideoPlayer({ src, channelName }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearRetryTimer = useCallback(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  const destroyHls = useCallback(() => {
    clearRetryTimer();
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
  }, [clearRetryTimer]);

  const tryNativePlayback = useCallback(
    (video: HTMLVideoElement, url: string) => {
      video.src = proxyUrl(url);
      video.load();
      video.play().catch(() => {});
    },
    []
  );

  const initHls = useCallback(
    (video: HTMLVideoElement, url: string) => {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 90,
        maxBufferLength: 30,
        maxMaxBufferLength: 600,
        maxBufferSize: 60 * 1000 * 1000,
        maxBufferHole: 0.5,
        startPosition: -1,
        manifestLoadingTimeOut: 30000,
        manifestLoadingMaxRetry: 4,
        manifestLoadingRetryDelay: 1500,
        manifestLoadingMaxRetryTimeout: 30000,
        levelLoadingTimeOut: 30000,
        levelLoadingMaxRetry: 4,
        levelLoadingRetryDelay: 1500,
        levelLoadingMaxRetryTimeout: 30000,
        fragLoadingTimeOut: 30000,
        fragLoadingMaxRetry: 6,
        fragLoadingRetryDelay: 1500,
        fragLoadingMaxRetryTimeout: 30000,
        xhrSetup: (xhr) => {
          xhr.timeout = 30000;
        },
      });
      hlsRef.current = hls;

      hls.loadSource(proxyUrl(url));
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setIsLoading(false);
        setError(null);
        retryCountRef.current = 0;
        video.play().catch(() => {});
      });

      hls.on(Hls.Events.FRAG_LOADED, () => {
        retryCountRef.current = 0;
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        console.warn('[HLS]', data.type, data.details, data.fatal);

        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              if (retryCountRef.current < MAX_RETRY) {
                retryCountRef.current++;
                const delay =
                  RETRY_BASE_DELAY *
                  Math.pow(2, retryCountRef.current - 1);
                clearRetryTimer();
                retryTimerRef.current = setTimeout(() => {
                  hls.startLoad();
                }, delay);
              } else {
                destroyHls();
                tryNativePlayback(video, url);
              }
              break;

            case Hls.ErrorTypes.MEDIA_ERROR:
              if (retryCountRef.current < MAX_RETRY) {
                retryCountRef.current++;
                hls.recoverMediaError();
              } else {
                destroyHls();
                tryNativePlayback(video, url);
              }
              break;

            default:
              destroyHls();
              tryNativePlayback(video, url);
              break;
          }
        }
      });
    },
    [destroyHls, clearRetryTimer, tryNativePlayback]
  );

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    setIsLoading(true);
    setError(null);
    retryCountRef.current = 0;
    destroyHls();

    if (Hls.isSupported()) {
      initHls(video, src);
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = proxyUrl(src);
      video.addEventListener('loadedmetadata', () => {
        setIsLoading(false);
        video.play().catch(() => {});
      });
    } else {
      tryNativePlayback(video, src);
    }

    return () => {
      destroyHls();
      if (video) {
        video.removeAttribute('src');
        video.load();
      }
    };
  }, [src, destroyHls, initHls, tryNativePlayback]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    if (controlsTimerRef.current) {
      clearTimeout(controlsTimerRef.current);
    }
    controlsTimerRef.current = setTimeout(() => {
      if (!error) setShowControls(false);
    }, 3000);
  }, [error]);

  const handleTouchStart = useCallback(() => {
    setShowControls(prev => !prev);
  }, []);

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(!isMuted);
    }
  };

  const toggleFullscreen = () => {
    const container = containerRef.current;
    if (!container) return;

    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      container.requestFullscreen();
    }
  };

  const handleCanPlay = () => {
    setIsLoading(false);
    setError(null);
  };

  const handleError = () => {
    if (!hlsRef.current) {
      setIsLoading(false);
      setError(
        'Failed to load stream. The channel may be offline or unavailable.'
      );
    }
  };

  const handleRetry = () => {
    const video = videoRef.current;
    if (!video || !src) return;

    setIsLoading(true);
    setError(null);
    retryCountRef.current = 0;
    destroyHls();

    if (Hls.isSupported()) {
      initHls(video, src);
    } else {
      tryNativePlayback(video, src);
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative bg-black rounded-xl overflow-hidden shadow-lg shadow-gray-300/40 ring-1 ring-gray-200 group"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => !error && setShowControls(false)}
      onTouchStart={handleTouchStart}
    >
      <div className="aspect-video relative bg-black">
        <video
          ref={videoRef}
          className="w-full h-full object-contain"
          autoPlay
          playsInline
          onCanPlay={handleCanPlay}
          onError={handleError}
          onLoadStart={() => setIsLoading(true)}
        />

        {/* Loading Overlay */}
        {isLoading && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 animate-fade-in">
            <div className="text-center">
              <div className="relative mx-auto mb-3 w-14 h-14">
                <div className="absolute inset-0 rounded-full border-2 border-white/10" />
                <div className="absolute inset-0 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
              </div>
              <p className="text-white/70 text-sm">Connecting...</p>
            </div>
          </div>
        )}

        {/* Error Overlay */}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900/90 animate-fade-in px-4">
            <div className="text-center max-w-sm">
              <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-brand-500/15 flex items-center justify-center">
                <AlertTriangle className="w-7 h-7 text-brand-400" />
              </div>
              <p className="text-white text-sm font-medium mb-1">Stream Unavailable</p>
              <p className="text-white/50 text-xs mb-5 leading-relaxed">
                {error}
              </p>
              <button onClick={handleRetry} className="btn-primary text-sm">
                <RefreshCw className="w-4 h-4" />
                Retry Connection
              </button>
            </div>
          </div>
        )}

        {/* Controls Overlay */}
        <div
          className={`absolute inset-0 flex flex-col justify-end transition-opacity duration-300
            ${showControls || error ? 'opacity-100' : 'opacity-0 pointer-events-none'}
          `}
        >
          {/* Gradient Backdrop */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20 pointer-events-none" />

          {/* Top Bar - Live Badge */}
          <div className="absolute top-0 left-0 right-0 p-3 sm:p-4">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-brand-600 shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse-soft flex-shrink-0" />
              <span className="text-white text-[11px] sm:text-xs font-semibold uppercase tracking-wide">
                Live
              </span>
            </div>
          </div>

          {/* Bottom Controls */}
          <div className="relative z-10 p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-semibold text-sm sm:text-base lg:text-lg truncate mr-4">
                {channelName}
              </h3>
              <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
                <button
                  onClick={toggleMute}
                  className="p-2 sm:p-2.5 rounded-lg bg-white/15 hover:bg-white/25 backdrop-blur-sm transition-all duration-200 active:scale-95"
                  aria-label={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted ? (
                    <VolumeX className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                  ) : (
                    <Volume2 className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                  )}
                </button>
                <button
                  onClick={toggleFullscreen}
                  className="p-2 sm:p-2.5 rounded-lg bg-white/15 hover:bg-white/25 backdrop-blur-sm transition-all duration-200 active:scale-95"
                  aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                >
                  {isFullscreen ? (
                    <Minimize className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                  ) : (
                    <Maximize className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
