import { useState, useRef, useEffect, useCallback } from "react";
import {
  Play, Pause, Volume2, VolumeX, Maximize, X, ChevronDown,
  SkipBack, SkipForward, Loader2, AlertTriangle, RotateCcw,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface VideoPlayerProps {
  videoUrl: string | null;
  stepTitle: string;
  stepId: string;
  funnelId: string;
  initialPosition: number;
  durationSeconds: number | null;
  onComplete: () => void;
  onClose: () => void;
}

export const VideoPlayer = ({
  videoUrl,
  stepTitle,
  stepId,
  funnelId,
  initialPosition,
  durationSeconds,
  onComplete,
  onClose,
}: VideoPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(durationSeconds || 0);
  const [isMuted, setIsMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [hasCompleted, setHasCompleted] = useState(false);
  const progressSaveRef = useRef<ReturnType<typeof setInterval>>();

  // Buffering & loading states
  const [isLoading, setIsLoading] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);
  const [bufferingTooLong, setBufferingTooLong] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [showUnmutePrompt, setShowUnmutePrompt] = useState(false);
  const bufferTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const lastSavedPercent = useRef(0);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const saveProgress = useCallback(async (time: number, dur: number) => {
    if (!dur || dur === 0) return;
    const percent = Math.round((time / dur) * 100);
    // Only save if changed by at least 2%
    if (Math.abs(percent - lastSavedPercent.current) < 2) return;
    lastSavedPercent.current = percent;

    try {
      const userId = (await supabase.auth.getUser()).data.user?.id;
      if (!userId) return;

      await supabase.from("funnel_step_progress").upsert(
        {
          funnel_id: funnelId,
          funnel_step_id: stepId,
          session_id: userId,
          watched_percentage: percent,
          last_position_seconds: Math.floor(time),
          max_watched_seconds: Math.floor(time),
          status: percent >= 80 ? "completed" : "in_progress",
          completed_at: percent >= 80 ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "funnel_id,funnel_step_id,session_id", ignoreDuplicates: false }
      );

      await supabase.from("member_activity_log" as any).upsert(
        {
          member_id: userId,
          activity_date: new Date().toISOString().split("T")[0],
          videos_watched: 1,
        },
        { onConflict: "member_id,activity_date" }
      );

      if (percent >= 80 && !hasCompleted) {
        setHasCompleted(true);
        onComplete();
        toast.success("Step completed! Next step unlocked 🎉");
      }
    } catch {
      // silent fail
    }
  }, [funnelId, stepId, hasCompleted, onComplete]);

  // Setup video events
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoaded = () => {
      setDuration(video.duration);
      setIsLoading(false);
      if (initialPosition > 0) {
        video.currentTime = initialPosition;
      }
    };

    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handlePlaying = () => { setIsPlaying(true); setIsBuffering(false); setIsLoading(false); setBufferingTooLong(false); };
    const handlePause = () => setIsPlaying(false);
    const handleWaiting = () => setIsBuffering(true);
    const handleCanPlay = () => { setIsBuffering(false); setIsLoading(false); };
    const handleStalled = () => setIsBuffering(true);

    const handleError = () => {
      const code = video.error?.code;
      let msg = "Video unavailable. Please try again.";
      switch (code) {
        case 1: msg = "Video loading was interrupted. Tap to retry."; break;
        case 2: msg = "Network error. Check your connection and retry."; break;
        case 3: msg = "Video format error. Contact support."; break;
        case 4: msg = "Video unavailable. The link may have expired."; break;
      }
      setVideoError(msg);
      setIsLoading(false);
      setIsBuffering(false);
    };

    video.addEventListener("loadedmetadata", handleLoaded);
    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("playing", handlePlaying);
    video.addEventListener("pause", handlePause);
    video.addEventListener("waiting", handleWaiting);
    video.addEventListener("canplay", handleCanPlay);
    video.addEventListener("canplaythrough", handleCanPlay);
    video.addEventListener("stalled", handleStalled);
    video.addEventListener("error", handleError);

    // Attempt autoplay (muted first for browser policy)
    video.load();

    return () => {
      video.removeEventListener("loadedmetadata", handleLoaded);
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("playing", handlePlaying);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("waiting", handleWaiting);
      video.removeEventListener("canplay", handleCanPlay);
      video.removeEventListener("canplaythrough", handleCanPlay);
      video.removeEventListener("stalled", handleStalled);
      video.removeEventListener("error", handleError);
    };
  }, [initialPosition]);

  // Buffering too long detection
  useEffect(() => {
    if (isBuffering) {
      bufferTimerRef.current = setTimeout(() => setBufferingTooLong(true), 10000);
    } else {
      setBufferingTooLong(false);
      if (bufferTimerRef.current) clearTimeout(bufferTimerRef.current);
    }
    return () => { if (bufferTimerRef.current) clearTimeout(bufferTimerRef.current); };
  }, [isBuffering]);

  // Save progress every 10 seconds
  useEffect(() => {
    if (isPlaying) {
      progressSaveRef.current = setInterval(() => {
        const video = videoRef.current;
        if (video) saveProgress(video.currentTime, video.duration);
      }, 10000);
    }
    return () => { if (progressSaveRef.current) clearInterval(progressSaveRef.current); };
  }, [isPlaying, saveProgress]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {
        // Autoplay blocked — try muted
        video.muted = true;
        setIsMuted(true);
        video.play().then(() => setShowUnmutePrompt(true)).catch(() => {});
      });
    } else {
      video.pause();
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const video = videoRef.current;
    if (!video) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    video.currentTime = pct * video.duration;
  };

  const seekBackward = () => {
    const video = videoRef.current;
    if (video) video.currentTime = Math.max(0, video.currentTime - 10);
  };

  const seekForward = () => {
    const video = videoRef.current;
    if (video) video.currentTime = Math.min(video.duration, video.currentTime + 10);
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
    if (!video.muted) setShowUnmutePrompt(false);
  };

  const setPlaybackSpeed = (s: number) => {
    const video = videoRef.current;
    if (video) video.playbackRate = s;
    setSpeed(s);
    setShowSpeedMenu(false);
  };

  const toggleFullscreen = () => {
    const video = videoRef.current;
    if (!video) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else video.requestFullscreen();
  };

  const retryVideo = () => {
    const video = videoRef.current;
    if (!video) return;
    setVideoError(null);
    setIsLoading(true);
    video.load();
  };

  if (!videoUrl) {
    return (
      <div className="rounded-xl border border-border bg-muted/30 p-8 text-center animate-in slide-in-from-top-2 duration-300">
        <p className="text-muted-foreground text-sm">Video unavailable. Contact support.</p>
        <button onClick={onClose} className="text-xs text-primary mt-2 hover:underline">Close</button>
      </div>
    );
  }

  const seekPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="rounded-xl border border-primary/20 bg-card overflow-hidden animate-in slide-in-from-top-2 duration-300">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <span className="text-sm font-medium text-foreground truncate">{stepTitle}</span>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">
          <X size={16} />
        </button>
      </div>

      {/* Video */}
      <div className="relative aspect-video bg-black">
        <video
          ref={videoRef}
          className="w-full h-full"
          onClick={togglePlay}
          playsInline
          preload="auto"
          onEnded={() => {
            setIsPlaying(false);
            const video = videoRef.current;
            if (video) saveProgress(video.currentTime, video.duration);
          }}
        >
          <source src={videoUrl} type="video/mp4" />
        </video>

        {/* Loading overlay */}
        {isLoading && !videoError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 z-20">
            <Loader2 size={40} className="text-primary animate-spin" />
            <p className="text-xs text-white/70 mt-2">Loading video...</p>
          </div>
        )}

        {/* Buffering overlay */}
        {isBuffering && !isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 z-20">
            <Loader2 size={32} className="text-white animate-spin" />
            {bufferingTooLong && (
              <p className="text-xs text-white/70 mt-2">Slow connection detected. Video will play when ready.</p>
            )}
          </div>
        )}

        {/* Error overlay */}
        {videoError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 z-20 gap-3">
            <AlertTriangle size={36} className="text-amber-400" />
            <p className="text-sm text-white/90 text-center px-4">{videoError}</p>
            <button
              onClick={retryVideo}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:brightness-110"
            >
              <RotateCcw size={14} /> Retry
            </button>
          </div>
        )}

        {/* Play button overlay */}
        {!isPlaying && !isLoading && !isBuffering && !videoError && (
          <button
            onClick={togglePlay}
            className="absolute inset-0 flex items-center justify-center bg-black/30 z-10"
          >
            <div className="w-16 h-16 rounded-full bg-primary/90 flex items-center justify-center">
              <Play size={28} fill="white" className="text-white ml-1" />
            </div>
          </button>
        )}

        {/* Unmute prompt */}
        {showUnmutePrompt && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/70 backdrop-blur-sm cursor-pointer"
            onClick={() => { toggleMute(); setShowUnmutePrompt(false); }}
          >
            <VolumeX size={14} className="text-white/80" />
            <span className="text-xs text-white/90">Tap to unmute</span>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="px-3 py-2 space-y-1.5">
        {/* Seek bar */}
        <div className="h-1.5 bg-muted rounded-full cursor-pointer" onClick={handleSeek}>
          <div className="h-full bg-primary rounded-full transition-all duration-100" style={{ width: `${seekPercent}%` }} />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <button onClick={seekBackward} className="text-muted-foreground hover:text-foreground p-0.5" title="-10s">
              <SkipBack size={16} />
            </button>
            <button onClick={togglePlay} className="text-foreground hover:text-primary">
              {isPlaying ? <Pause size={18} /> : <Play size={18} />}
            </button>
            <button onClick={seekForward} className="text-muted-foreground hover:text-foreground p-0.5" title="+10s">
              <SkipForward size={16} />
            </button>
            <button onClick={toggleMute} className="text-muted-foreground hover:text-foreground ml-1">
              {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
            <span className="text-xs text-muted-foreground font-mono ml-1">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5"
              >
                {speed}x <ChevronDown size={12} />
              </button>
              {showSpeedMenu && (
                <div className="absolute bottom-full right-0 mb-1 bg-card border border-border rounded-lg shadow-lg py-1 z-10">
                  {[0.75, 1, 1.25, 1.5, 2].map((s) => (
                    <button
                      key={s}
                      onClick={() => setPlaybackSpeed(s)}
                      className={`block w-full text-left px-3 py-1 text-xs hover:bg-muted ${speed === s ? "text-primary font-medium" : "text-foreground"}`}
                    >
                      {s}x
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button onClick={toggleFullscreen} className="text-muted-foreground hover:text-foreground">
              <Maximize size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
