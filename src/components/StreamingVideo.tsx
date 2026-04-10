import { useState, useRef, useEffect, useCallback, forwardRef } from "react";
import { Loader2, AlertTriangle, RotateCcw, Play, Pause, VolumeX, Volume2 } from "lucide-react";
import { resolveVideoPlaybackUrl } from "@/lib/videoPlayback";

interface StreamingVideoProps {
  src: string | null | undefined;
  poster?: string | null;
  title?: string;
  className?: string;
  autoPlay?: boolean;
  controls?: boolean;
  showOverlays?: boolean;
  onError?: () => void;
}

/**
 * Unified streaming-optimized video component with custom controls.
 * Uses forwardRef and avoids browser-native controls to prevent EmptyRanges errors.
 */
export const StreamingVideo = forwardRef<HTMLVideoElement, StreamingVideoProps>(({
  src,
  poster,
  title,
  className = "",
  autoPlay = false,
  controls = true,
  showOverlays = true,
  onError,
}, ref) => {
  const internalRef = useRef<HTMLVideoElement>(null);
  const videoRef = (ref as React.RefObject<HTMLVideoElement>) || internalRef;
  const srcRef = useRef<string | null>(null);
  const playbackSrc = resolveVideoPlaybackUrl(src);

  const [isLoading, setIsLoading] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);
  const [bufferingSlow, setBufferingSlow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPlay, setShowPlay] = useState(false);
  const [showUnmute, setShowUnmute] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [metadataLoaded, setMetadataLoaded] = useState(false);
  const [metadataTimedOut, setMetadataTimedOut] = useState(false);

  const bufferTimer = useRef<ReturnType<typeof setTimeout>>();
  const unmuteTimer = useRef<ReturnType<typeof setTimeout>>();
  const metadataTimer = useRef<ReturnType<typeof setTimeout>>();
  const userPausedRef = useRef(false);

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
    setMetadataLoaded(false);
    setMetadataTimedOut(false);

    video.src = playbackSrc;
    video.load();

    // Metadata timeout — if metadata doesn't load in 15s, show warning
    if (metadataTimer.current) clearTimeout(metadataTimer.current);
    metadataTimer.current = setTimeout(() => {
      if (!metadataLoaded) {
        setMetadataTimedOut(true);
        setIsLoading(false);
      }
    }, 15000);

    if (autoPlay) {
      video.muted = true;
      setIsMuted(true);
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

    const onLoadedMetadata = () => {
      setMetadataLoaded(true);
      setMetadataTimedOut(false);
      if (metadataTimer.current) clearTimeout(metadataTimer.current);
      if (isFinite(video.duration) && video.duration > 0) {
        setDuration(video.duration);
      }
    };
    const onLoadedData = () => setIsLoading(false);
    const onCanPlay = () => {
      setIsLoading(false);
      setIsBuffering(false);
      setBufferingSlow(false);
      // Auto-resume if video was paused due to buffering (not user-initiated)
      if (video.paused && !userPausedRef.current && video.currentTime > 0) {
        video.play().catch(() => {});
      }
    };
    const onPlaying = () => { setIsLoading(false); setIsBuffering(false); setBufferingSlow(false); setShowPlay(false); setIsPlaying(true); userPausedRef.current = false; };
    const onPause = () => {
      setIsPlaying(false);
      // If video paused but user didn't pause it, it's a buffer underrun — mark for auto-resume
      // Don't mark as user-paused if we're still buffering
      if (!isBuffering) {
        // Check if there's buffered data ahead — if so, try to resume
        try {
          if (video.buffered && video.buffered.length > 0) {
            const buffEnd = video.buffered.end(video.buffered.length - 1);
            if (buffEnd > video.currentTime + 0.5) {
              // There's data ahead, resume
              video.play().catch(() => {});
              return;
            }
          }
        } catch { /* ignore */ }
      }
    };

    const onTimeUpdate = () => {
      if (isFinite(video.currentTime)) {
        setCurrentTime(video.currentTime);
      }
      if (isFinite(video.duration) && video.duration > 0) {
        setDuration(video.duration);
      }
    };

    const onWaiting = () => {
      if (video.currentTime > 0) {
        setIsBuffering(true);
      }
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

    const onProgress = () => {
      try {
        if (video.buffered && video.buffered.length > 0 && video.readyState >= 2) {
          setIsBuffering(false);
          // Auto-resume: if paused due to buffer underrun (not user), resume when enough data buffered
          if (video.paused && !userPausedRef.current && video.currentTime > 0) {
            const buffEnd = video.buffered.end(video.buffered.length - 1);
            if (buffEnd > video.currentTime + 1) {
              video.play().catch(() => {});
            }
          }
        }
      } catch {
        // SafeGuard: ignore DOMException from buffered access
      }
    };

    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.addEventListener("loadeddata", onLoadedData);
    video.addEventListener("canplay", onCanPlay);
    video.addEventListener("canplaythrough", onCanPlay);
    video.addEventListener("playing", onPlaying);
    video.addEventListener("pause", onPause);
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("error", onErrorHandler);
    video.addEventListener("progress", onProgress);

    return () => {
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("loadeddata", onLoadedData);
      video.removeEventListener("canplay", onCanPlay);
      video.removeEventListener("canplaythrough", onCanPlay);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("waiting", onWaiting);
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
      if (metadataTimer.current) clearTimeout(metadataTimer.current);
    };
  }, []);

  const handleRetry = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    setError(null);
    setIsLoading(true);
    setRetryCount(0);
    setMetadataTimedOut(false);
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
    setIsMuted(false);
    video.play().catch(() => {});
    setShowPlay(false);
  }, []);

  const handleUnmute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = false;
    setIsMuted(false);
    setShowUnmute(false);
  }, []);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      userPausedRef.current = false;
      video.play().catch(() => {});
    } else {
      userPausedRef.current = true;
      video.pause();
    }
  }, []);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
    if (!video.muted) setShowUnmute(false);
  }, []);

  const formatTime = (s: number) => {
    if (!isFinite(s) || s < 0) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const video = videoRef.current;
    if (!video || !metadataLoaded || !isFinite(duration) || duration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    video.currentTime = pct * duration;
  };

  if (!playbackSrc) {
    return (
      <div className={`flex items-center justify-center bg-black ${className}`}>
        <p className="text-sm text-white/50">No video available</p>
      </div>
    );
  }

  const seekPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className={`relative bg-black ${className}`}>
      <video
        ref={videoRef}
        className="w-full h-full"
        playsInline
        preload="metadata"
        controlsList="nodownload"
        poster={poster || undefined}
        title={title}
        onClick={controls ? togglePlay : undefined}
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

          {/* Metadata timeout warning */}
          {metadataTimedOut && !error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 z-20 gap-3">
              <AlertTriangle size={32} className="text-amber-400" />
              <p className="text-sm text-white/90 text-center px-4">
                This video is taking longer than expected to load. It may not be web-optimized.
              </p>
              <button
                onClick={handleRetry}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:brightness-110"
              >
                <RotateCcw size={14} /> Retry
              </button>
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
          {showPlay && !error && !metadataTimedOut && (
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

      {/* Custom controls bar */}
      {controls && !error && !showPlay && !metadataTimedOut && !isLoading && (
        <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/80 to-transparent px-3 pb-2 pt-6">
          {/* Seek bar */}
          <div className="h-1 bg-white/20 rounded-full cursor-pointer mb-2" onClick={handleSeek}>
            <div
              className="h-full bg-primary rounded-full transition-all duration-150"
              style={{ width: `${seekPercent}%` }}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button onClick={togglePlay} className="text-white hover:text-primary transition-colors">
                {isPlaying ? <Pause size={18} /> : <Play size={18} />}
              </button>
              <button onClick={toggleMute} className="text-white/70 hover:text-white transition-colors">
                {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>
              <span className="text-[11px] text-white/60 font-mono">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

StreamingVideo.displayName = "StreamingVideo";
