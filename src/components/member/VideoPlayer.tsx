import { useState, useRef, useEffect, useCallback } from "react";
import { Play, Pause, Volume2, VolumeX, Maximize, X, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { UnmutePill } from "./UnmutePill";

export interface VideoPlayerProgress {
  currentTime: number;
  duration: number;
  watchedPercent: number;
  maxWatchedSeconds: number;
  timeSpentSeconds: number;
}

interface VideoPlayerProps {
  videoUrl: string | null;
  stepTitle: string;
  stepId: string;
  funnelId: string;
  initialPosition: number;
  durationSeconds: number | null;
  initialTimeSpentSeconds?: number;
  completionThreshold?: number;
  onProgress?: (progress: VideoPlayerProgress) => void;
  onComplete: () => void;
  onClose: () => void;
  hideHeader?: boolean;
  autoPlayMuted?: boolean;
  preloadNextUrl?: string | null;
  allowSeek?: boolean;
  allowSpeed?: boolean;
}

export const VideoPlayer = ({
  videoUrl,
  stepTitle,
  stepId,
  funnelId,
  initialPosition,
  durationSeconds,
  initialTimeSpentSeconds = 0,
  completionThreshold = 95,
  onProgress,
  onComplete,
  onClose,
  hideHeader = false,
  autoPlayMuted = false,
  preloadNextUrl,
  allowSeek = true,
  allowSpeed = true,
}: VideoPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const seekBarRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(durationSeconds || 0);
  const [isMuted, setIsMuted] = useState(autoPlayMuted);
  const [speed, setSpeed] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [hasCompleted, setHasCompleted] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);
  const progressSaveRef = useRef<NodeJS.Timeout>();
  const maxWatchedSecondsRef = useRef(initialPosition);
  const timeSpentSecondsRef = useRef(initialTimeSpentSeconds);
  const lastSeekToastRef = useRef(0);

  const showSeekDisabledToast = useCallback(() => {
    const now = Date.now();
    if (now - lastSeekToastRef.current < 3000) return;
    lastSeekToastRef.current = now;
    toast.error("You can't skip ahead in this video", { duration: 2000 });
  }, []);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const emitProgress = useCallback((time: number, dur: number) => {
    const maxWatchedSeconds = Math.max(maxWatchedSecondsRef.current, Math.floor(time));
    maxWatchedSecondsRef.current = maxWatchedSeconds;
    const watchedPercent = dur > 0 ? Math.round((maxWatchedSeconds / dur) * 100) : 0;

    onProgress?.({
      currentTime: time,
      duration: dur,
      watchedPercent,
      maxWatchedSeconds,
      timeSpentSeconds: timeSpentSecondsRef.current,
    });

    return { maxWatchedSeconds, watchedPercent };
  }, [onProgress]);

  const saveProgress = useCallback(async (time: number, dur: number) => {
    if (!dur || dur === 0) return;

    const { maxWatchedSeconds, watchedPercent } = emitProgress(time, dur);
    const isCompleted = watchedPercent >= completionThreshold;

    try {
      await supabase.from("funnel_step_progress").upsert(
        {
          funnel_id: funnelId,
          funnel_step_id: stepId,
          session_id: (await supabase.auth.getUser()).data.user?.id || "",
          watched_percentage: watchedPercent,
          last_position_seconds: Math.floor(time),
          max_watched_seconds: maxWatchedSeconds,
          time_spent_seconds: timeSpentSecondsRef.current,
          status: isCompleted ? "completed" : watchedPercent > 0 ? "in_progress" : "unlocked",
          completed_at: isCompleted ? new Date().toISOString() : null,
          permanently_unlocked: isCompleted ? true : undefined,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "funnel_id,funnel_step_id,session_id", ignoreDuplicates: false }
      );

      const userId = (await supabase.auth.getUser()).data.user?.id;
      if (userId) {
        await supabase.from("member_activity_log" as any).upsert(
          {
            member_id: userId,
            activity_date: new Date().toISOString().split("T")[0],
            videos_watched: 1,
          },
          { onConflict: "member_id,activity_date" }
        );
      }

      if (isCompleted && !hasCompleted) {
        setHasCompleted(true);
        onComplete();
        toast.success("Step completed! Next step unlocked 🎉");
      }
    } catch (e) {
      console.error("[VideoPlayer] saveProgress failed:", e);
    }
  }, [completionThreshold, emitProgress, funnelId, stepId, hasCompleted, onComplete]);

  // Sync isMuted state with actual video element (handles browser autoplay policies)
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const syncMuteState = () => setIsMuted(video.muted);
    video.addEventListener("volumechange", syncMuteState);
    return () => video.removeEventListener("volumechange", syncMuteState);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    maxWatchedSecondsRef.current = initialPosition;
    timeSpentSecondsRef.current = initialTimeSpentSeconds;
    setIsBuffering(true);

    const handleLoaded = () => {
      setDuration(video.duration);
      if (initialPosition > 0) {
        video.currentTime = initialPosition;
      }
      emitProgress(video.currentTime, video.duration);

      if (autoPlayMuted) {
        video.muted = true;
        video.playsInline = true;
        video.play().then(() => {
          setIsPlaying(true);
          setIsMuted(video.muted);
          (window as any).__playingVideo = video;
        }).catch(() => {
          // Autoplay blocked
        });
      }
    };

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      emitProgress(video.currentTime, video.duration);
    };

    const handleCanPlay = () => setIsBuffering(false);
    const handleWaiting = () => setIsBuffering(true);
    const handlePlaying = () => {
      setIsBuffering(false);
      setIsMuted(video.muted);
    };

    video.addEventListener("loadedmetadata", handleLoaded);
    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("canplay", handleCanPlay);
    video.addEventListener("waiting", handleWaiting);
    video.addEventListener("playing", handlePlaying);

    return () => {
      video.removeEventListener("loadedmetadata", handleLoaded);
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("canplay", handleCanPlay);
      video.removeEventListener("waiting", handleWaiting);
      video.removeEventListener("playing", handlePlaying);
    };
  }, [emitProgress, initialPosition, initialTimeSpentSeconds]);

  // Save progress every 5 seconds while playing
  useEffect(() => {
    if (isPlaying) {
      progressSaveRef.current = setInterval(() => {
        const video = videoRef.current;
        if (!video) return;
        timeSpentSecondsRef.current += 5;
        saveProgress(video.currentTime, video.duration);
      }, 5000);
    }
    return () => {
      if (progressSaveRef.current) clearInterval(progressSaveRef.current);
    };
  }, [isPlaying, saveProgress]);

  // Preload next video in a hidden element
  useEffect(() => {
    if (!preloadNextUrl) return;
    const link = document.createElement("link");
    link.rel = "preload";
    link.as = "video";
    link.href = preloadNextUrl;
    document.head.appendChild(link);
    return () => { document.head.removeChild(link); };
  }, [preloadNextUrl]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      const prev = (window as any).__playingVideo;
      if (prev && prev !== video) {
        prev.pause();
      }
      (window as any).__playingVideo = video;
      video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const seekToPosition = useCallback((clientX: number) => {
    const video = videoRef.current;
    const bar = seekBarRef.current;
    if (!video || !bar || !video.duration) return;
    const rect = bar.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const targetTime = pct * video.duration;
    if (!allowSeek && targetTime > maxWatchedSecondsRef.current + 0.5) {
      video.currentTime = maxWatchedSecondsRef.current;
      showSeekDisabledToast();
    } else {
      video.currentTime = targetTime;
    }
  }, [allowSeek, showSeekDisabledToast]);

  const handleSeekDown = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    setIsSeeking(true);
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    seekToPosition(clientX);
  };

  useEffect(() => {
    if (!isSeeking) return;
    const onMove = (e: MouseEvent | TouchEvent) => {
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      seekToPosition(clientX);
    };
    const onUp = () => setIsSeeking(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove);
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
    };
  }, [isSeeking, seekToPosition]);

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    // State synced via volumechange event listener
  };

  const setPlaybackSpeed = (s: number) => {
    const video = videoRef.current;
    if (!video) return;
    if (!allowSpeed) return;
    video.playbackRate = s;
    setSpeed(s);
    setShowSpeedMenu(false);
  };

  const enterFullscreen = async (videoEl: HTMLVideoElement) => {
    try {
      if ((videoEl as any).webkitEnterFullscreen) {
        (videoEl as any).webkitEnterFullscreen();
        return;
      }
      if (videoEl.requestFullscreen) {
        await videoEl.requestFullscreen();
        return;
      }
      if ((videoEl as any).webkitRequestFullscreen) {
        await (videoEl as any).webkitRequestFullscreen();
        return;
      }
      if ((videoEl as any).mozRequestFullScreen) {
        await (videoEl as any).mozRequestFullScreen();
        return;
      }
    } catch (err) {
      console.error("Fullscreen error:", err);
    }
  };

  const exitFullscreen = () => {
    if (document.exitFullscreen) document.exitFullscreen();
    else if ((document as any).webkitExitFullscreen) (document as any).webkitExitFullscreen();
    else if ((document as any).mozCancelFullScreen) (document as any).mozCancelFullScreen();
  };

  const toggleFullscreen = () => {
    const video = videoRef.current;
    if (!video) return;
    const isFs = document.fullscreenElement || (document as any).webkitFullscreenElement;
    if (isFs) exitFullscreen();
    else enterFullscreen(video);
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onBeginFs = () => {
      if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock("landscape").catch(() => {});
      }
    };
    const onEndFs = () => {
      if (screen.orientation && (screen.orientation as any).unlock) {
        (screen.orientation as any).unlock();
      }
    };
    video.addEventListener("webkitbeginfullscreen", onBeginFs);
    video.addEventListener("webkitendfullscreen", onEndFs);
    return () => {
      video.removeEventListener("webkitbeginfullscreen", onBeginFs);
      video.removeEventListener("webkitendfullscreen", onEndFs);
    };
  }, []);

  // Enforce seek lock via the seeking event on the video element
  useEffect(() => {
    const video = videoRef.current;
    if (!video || allowSeek) return;
    const onSeekingEvent = () => {
      if (video.currentTime > maxWatchedSecondsRef.current + 0.5) {
        video.currentTime = maxWatchedSecondsRef.current;
        showSeekDisabledToast();
      }
    };
    video.addEventListener("seeking", onSeekingEvent);
    return () => video.removeEventListener("seeking", onSeekingEvent);
  }, [allowSeek, showSeekDisabledToast]);

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
      {!hideHeader && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-border">
          <span className="text-sm font-medium text-foreground truncate">{stepTitle}</span>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">
            <X size={16} />
          </button>
        </div>
      )}

      <div className="relative aspect-video bg-black">
        <video
          ref={videoRef}
          src={videoUrl}
          className="w-full h-full"
          onClick={togglePlay}
          playsInline
          {...{ "webkit-playsinline": "" } as any}
          x-webkit-airplay="allow"
          controlsList="nodownload"
          preload="auto"
          onEnded={() => {
            setIsPlaying(false);
            const video = videoRef.current;
            if (video) saveProgress(video.currentTime, video.duration);
          }}
        />
        {/* Loading spinner while buffering */}
        {isBuffering && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-10 pointer-events-none">
            <div className="w-10 h-10 border-3 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        )}
        {/* Unmute pill — shows whenever video is muted and playing */}
        <UnmutePill
          visible={isMuted && isPlaying}
          onUnmute={() => {
            const video = videoRef.current;
            if (video) {
              video.muted = false;
            }
          }}
        />
        {!isPlaying && !isBuffering && (
          <button
            onClick={togglePlay}
            className="absolute inset-0 flex items-center justify-center bg-black/30"
          >
            <div className="w-16 h-16 rounded-full bg-primary/90 flex items-center justify-center">
              <Play size={28} fill="white" className="text-white ml-1" />
            </div>
          </button>
        )}
      </div>

      <div className="px-3 py-2 space-y-1.5 group">
        <div
          ref={seekBarRef}
          className="relative h-4 flex items-center cursor-pointer touch-none select-none"
          onMouseDown={handleSeekDown}
          onTouchStart={handleSeekDown}
        >
          <div className="h-1.5 bg-muted rounded-full w-full relative">
            <div
              className="h-full bg-primary rounded-full"
              style={{ width: `${seekPercent}%` }}
            />
            <div
              className={`absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-primary border-2 border-background shadow-md transition-opacity ${isSeeking ? "opacity-100 scale-110" : "opacity-0 group-hover:opacity-100"}`}
              style={{ left: `calc(${seekPercent}% - 7px)` }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={togglePlay} className="text-foreground hover:text-primary">
              {isPlaying ? <Pause size={18} /> : <Play size={18} />}
            </button>
            <button onClick={toggleMute} className="text-muted-foreground hover:text-foreground">
              {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
            <span className="text-xs text-muted-foreground font-mono">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {allowSpeed && <div className="relative">
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
                      className={`block w-full text-left px-3 py-1 text-xs hover:bg-muted ${
                        speed === s ? "text-primary font-medium" : "text-foreground"
                      }`}
                    >
                      {s}x
                    </button>
                  ))}
                </div>
              )}
            </div>}
            <button
              onClick={toggleFullscreen}
              onTouchEnd={(e) => { e.preventDefault(); toggleFullscreen(); }}
              className="text-muted-foreground hover:text-foreground relative z-50"
              style={{ minWidth: 44, minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "all" }}
            >
              <Maximize size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
