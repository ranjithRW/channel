import { useEffect, useRef, useState, useCallback } from 'react';
import { Volume2, VolumeX, Maximize, Loader2, RefreshCw } from 'lucide-react';
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
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

      // Load through the proxy to bypass CORS
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
      // Always try HLS.js first — many IPTV streams are HLS
      // even when the URL doesn't end in .m3u8
      initHls(video, src);
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS (Safari)
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

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(!isMuted);
    }
  };

  const toggleFullscreen = () => {
    if (videoRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        videoRef.current.requestFullscreen();
      }
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
    <div className="relative bg-black rounded-lg overflow-hidden shadow-xl">
      <div className="aspect-video relative">
        <video
          ref={videoRef}
          className="w-full h-full"
          autoPlay
          playsInline
          onCanPlay={handleCanPlay}
          onError={handleError}
          onLoadStart={() => setIsLoading(true)}
        />

        {isLoading && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75">
            <Loader2 className="w-12 h-12 text-white animate-spin" />
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-90 text-white p-8 text-center">
            <div>
              <p className="text-lg mb-2">{error}</p>
              <p className="text-sm text-gray-400 mb-4">
                Try selecting another channel
              </p>
              <button
                onClick={handleRetry}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
              >
                <RefreshCw className="w-4 h-4" />
                Retry
              </button>
            </div>
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-white font-semibold text-lg">
              {channelName}
            </h2>
            <div className="flex gap-2">
              <button
                onClick={toggleMute}
                className="p-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg transition"
              >
                {isMuted ? (
                  <VolumeX className="w-5 h-5 text-white" />
                ) : (
                  <Volume2 className="w-5 h-5 text-white" />
                )}
              </button>
              <button
                onClick={toggleFullscreen}
                className="p-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg transition"
              >
                <Maximize className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
