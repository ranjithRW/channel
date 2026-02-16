import { useEffect, useRef, useState, useCallback } from 'react';
import { Volume2, VolumeX, Maximize, Loader2 } from 'lucide-react';
import Hls from 'hls.js';

interface VideoPlayerProps {
  src: string;
  channelName: string;
}

export default function VideoPlayer({ src, channelName }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const destroyHls = useCallback(() => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    setIsLoading(true);
    setError(null);

    destroyHls();

    const isHls = src.includes('.m3u8') || src.includes('.m3u');

    if (isHls && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        xhrSetup: (xhr) => {
          xhr.timeout = 15000;
        },
      });
      hlsRef.current = hls;

      hls.loadSource(src);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {
          // Autoplay blocked by browser; user interaction required
        });
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              // Try to recover from network errors
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              // Try to recover from media errors
              hls.recoverMediaError();
              break;
            default:
              setIsLoading(false);
              setError('Failed to load stream. The channel may be offline or unavailable.');
              destroyHls();
              break;
          }
        }
      });
    } else if (isHls && video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS support (Safari)
      video.src = src;
      video.addEventListener('loadedmetadata', () => {
        video.play().catch(() => {});
      });
    } else {
      // Non-HLS stream (MP4, etc.)
      video.src = src;
      video.load();
      video.play().catch(() => {});
    }

    return () => {
      destroyHls();
      if (video) {
        video.removeAttribute('src');
        video.load();
      }
    };
  }, [src, destroyHls]);

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
    // Only set error if hls.js is not handling it
    if (!hlsRef.current) {
      setIsLoading(false);
      setError('Failed to load stream. The channel may be offline or unavailable.');
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

        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75">
            <Loader2 className="w-12 h-12 text-white animate-spin" />
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-90 text-white p-8 text-center">
            <div>
              <p className="text-lg mb-2">{error}</p>
              <p className="text-sm text-gray-400">Try selecting another channel</p>
            </div>
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-white font-semibold text-lg">{channelName}</h2>
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
