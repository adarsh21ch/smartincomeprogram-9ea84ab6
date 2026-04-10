import { useState, useRef, useEffect, useCallback } from "react";
import { Loader2, AlertTriangle, RotateCcw, Play, VolumeX } from "lucide-react";
import { resolveVideoPlaybackUrl } from "@/lib/videoPlayback";

interface StreamingVideoProps {
  src: string | null | undefined;
  poster?: string | null;
  title?: string;
  className?: string;
  autoPlay?: boolean;
  controls?: boolean;
  /** Show custom overlay states (buffering, error, unmute) */
  showOverlays?: boolean;
  onError?: () => void;
}

/**
 * Unified streaming-optimized video component.
 * Handles buffering, error, retry, and autoplay policy across all surfaces.
 */
export const StreamingVideo = ({
  src,
  poster,
  title,
  className = "",
  autoPlay = false,
  controls = true,
  showOverlays = true,
  onError,
}: StreamingVideoProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const srcRef = useRef<string | null>(null);
  const playbackSrc = resolveVideoPlaybackUrl(src);

  const [isLoading, setIsLoading] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);
  const [bufferingSlow, setBufferingSlow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPlay, setShowPlay] = useState(false);
  const [showUnmute, setShowUnmute] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const bufferTimer = useRef<ReturnType<typeof setTimeout>>();
  const unmuteTimer = useRef<ReturnType<typeof setTimeout>>();
  const stalledRetryTimer = useRef<ReturnType<typeof setTimeout>>();

  // Stable src — never change src mid-playback
  useEffect(() => {
    if (!playbackSrc) return;
    if (srcRef.current === playbackSrc) return;
    srcRef.current = playbackSrc;

    const video = videoRef.current;
    if (!video) return;

    setError(null);
    setIsLoading(true);
    setShowPlay(false);
    setShowUnmute(false);
    setRetryCount(0);

    video.src = playbackSrc;
    video.load();

    if (autoPlay) {
      video.muted = true;
      video.play()
        .then(() => {
          setShowUnmute(true);
          unmuteTimer.current = setTimeout(() => setShowUnmute(false), 5000);
        })
        .catch(() => {
          setShowPlay(true);
        });
    }
  }, [playbackSrc, autoPlay]);

  // Event listeners
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onLoadedData = () => setIsLoading(false);
    const onCanPlay = () => { setIsLoading(false); setIsBuffering(false); setBufferingSlow(false); };
    const onPlaying = () => { setIsLoading(false); setIsBuffering(false); setBufferingSlow(false); setShowPlay(false); };

    const onWaiting = () => {
      // Only show buffering if we've actually started playing
      if (video.currentTime > 0) {
        setIsBuffering(true);
      }
    };

    const onStalled = () => {
      // Auto-recovery: if stalled for 3s, try nudging playback
      if (stalledRetryTimer.current) clearTimeout(stalledRetryTimer.current);
      stalledRetryTimer.current = setTimeout(() => {
        if (video && !video.paused && video.readyState < 3) {
          const ct = video.currentTime;
          video.currentTime = ct; // nudge
        }
      }, 3000);
    };

    const onErrorHandler = () => {
      const code = video.error?.code;
      let msg = "Video unavailable. Tap to retry.";
      switch (code) {
        case 1: msg = "Video loading was interrupted. Tap to retry."; break;
        case 2: msg = "Network error. Check your connection and retry."; break;
        case 3: msg = "Video format not supported. Contact support."; break;
        case 4: msg = "Video unavailable. The link may have expired."; break;
      }

      // Auto-retry up to 2 times for network errors
      if ((code === 2 || code === 1) && retryCount < 2) {
        setRetryCount((c) => c + 1);
        setTimeout(() => {
          if (srcRef.current) {
            video.src = srcRef.current;
            video.load();
            if (autoPlay) {
              video.muted = true;
              video.play().catch(() => {});
            }
          }
        }, 1000 * (retryCount + 1));
        return;
      }

      setError(msg);
      setIsLoading(false);
      setIsBuffering(false);
      onError?.();
    };

    // Progress event — indicates data is downloading, clear buffering state
    const onProgress = () => {
      if (video.buffered.length > 0 && video.readyState >= 2) {
        setIsBuffering(false);
      }
    };

    video.addEventListener("loadeddata", onLoadedData);
    video.addEventListener("canplay", onCanPlay);
    video.addEventListener("canplaythrough", onCanPlay);
    video.addEventListener("playing", onPlaying);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("stalled", onStalled);
    video.addEventListener("error", onErrorHandler);
    video.addEventListener("progress", onProgress);

    return () => {
      video.removeEventListener("loadeddata", onLoadedData);
      video.removeEventListener("canplay", onCanPlay);
      video.removeEventListener("canplaythrough", onCanPlay);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("stalled", onStalled);
      video.removeEventListener("error", onErrorHandler);
      video.removeEventListener("progress", onProgress);
    };
  }, [autoPlay, retryCount, onError]);

  // Slow buffering detection (8s)
  useEffect(() => {
    if (isBuffering) {
      bufferTimer.current = setTimeout(() => setBufferingSlow(true), 8000);
    } else {
      setBufferingSlow(false);
      if (bufferTimer.current) clearTimeout(bufferTimer.current);
    }
    return () => { if (bufferTimer.current) clearTimeout(bufferTimer.current); };
  }, [isBuffering]);

  // Cleanup timers
  useEffect(() => {
    return () => {
      if (bufferTimer.current) clearTimeout(bufferTimer.current);
      if (unmuteTimer.current) clearTimeout(unmuteTimer.current);
      if (stalledRetryTimer.current) clearTimeout(stalledRetryTimer.current);
    };
  }, []);

  const handleRetry = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    setError(null);
    setIsLoading(true);
    setRetryCount(0);
    const currentSrc = srcRef.current;
    if (currentSrc) {
      video.src = currentSrc;
      video.load();
    }
  }, []);

  const handlePlayTap = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = false;
    video.play().catch(() => {});
    setShowPlay(false);
  }, []);

  const handleUnmute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = false;
    setShowUnmute(false);
  }, []);

  if (!playbackSrc) {
    return (
      <div className={`flex items-center justify-center bg-black ${className}`}>
        <p className="text-sm text-white/50">No video available</p>
      </div>
    );
  }

  return (
    <div className={`relative bg-black ${className}`}>
      <video
        ref={videoRef}
        className="w-full h-full"
        controls={controls && !error && !showPlay}
        playsInline
        preload="metadata"
        controlsList="nodownload"
        poster={poster || undefined}
        title={title}
      />

      {showOverlays && (
        <>
          {/* Loading */}
          {isLoading && !error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 z-20 pointer-events-none">
              <Loader2 size={36} className="text-white animate-spin" />
              <p className="text-xs text-white/60 mt-2">Loading video…</p>
            </div>
          )}

          {/* Buffering */}
          {isBuffering && !isLoading && !error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 z-20 pointer-events-none">
              <Loader2 size={28} className="text-white animate-spin" />
              {bufferingSlow && (
                <p className="text-xs text-white/60 mt-2">Slow connection. Video will play when ready.</p>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 z-20 gap-3">
              <AlertTriangle size={32} className="text-amber-400" />
              <p className="text-sm text-white/90 text-center px-4">{error}</p>
              <button
                onClick={handleRetry}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:brightness-110"
              >
                <RotateCcw size={14} /> Retry
              </button>
            </div>
          )}

          {/* Play prompt (when autoplay blocked) */}
          {showPlay && !error && (
            <button
              onClick={handlePlayTap}
              className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 z-20"
            >
              <div className="w-16 h-16 rounded-full bg-primary/90 flex items-center justify-center">
                <Play size={28} fill="white" className="text-white ml-1" />
              </div>
              <p className="text-xs text-white/70 mt-2">Tap to start</p>
            </button>
          )}

          {/* Unmute prompt */}
          {showUnmute && !error && (
            <button
              onClick={handleUnmute}
              className="absolute top-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/70 backdrop-blur-sm"
            >
              <VolumeX size={14} className="text-white/80" />
              <span className="text-xs text-white/90">Tap to unmute</span>
            </button>
          )}
        </>
      )}
    </div>
  );
};
