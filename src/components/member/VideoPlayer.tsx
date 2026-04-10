import { useState, useRef, useEffect, useCallback } from "react";
import { Play, Pause, Volume2, VolumeX, Maximize, X, ChevronDown } from "lucide-react";
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
  const progressSaveRef = useRef<NodeJS.Timeout>();

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const saveProgress = useCallback(async (time: number, dur: number) => {
    if (!dur || dur === 0) return;
    const percent = Math.round((time / dur) * 100);
    try {
      await supabase.from("funnel_step_progress").upsert(
        {
          funnel_id: funnelId,
          funnel_step_id: stepId,
          session_id: (await supabase.auth.getUser()).data.user?.id || "",
          watched_percentage: percent,
          last_position_seconds: Math.floor(time),
          max_watched_seconds: Math.floor(time),
          status: percent >= 80 ? "completed" : "in_progress",
          completed_at: percent >= 80 ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "funnel_id,funnel_step_id,session_id", ignoreDuplicates: false }
      );

      // Upsert activity log for streak tracking
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

      if (percent >= 80 && !hasCompleted) {
        setHasCompleted(true);
        onComplete();
        toast.success("Step completed! Next step unlocked 🎉");
      }
    } catch (e) {
      // silent fail on progress save
    }
  }, [funnelId, stepId, hasCompleted, onComplete]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoaded = () => {
      setDuration(video.duration);
      if (initialPosition > 0) {
        video.currentTime = initialPosition;
      }
    };

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
    };

    video.addEventListener("loadedmetadata", handleLoaded);
    video.addEventListener("timeupdate", handleTimeUpdate);

    return () => {
      video.removeEventListener("loadedmetadata", handleLoaded);
      video.removeEventListener("timeupdate", handleTimeUpdate);
    };
  }, [initialPosition]);

  // Save progress every 10 seconds
  useEffect(() => {
    if (isPlaying) {
      progressSaveRef.current = setInterval(() => {
        const video = videoRef.current;
        if (video) saveProgress(video.currentTime, video.duration);
      }, 10000);
    }
    return () => {
      if (progressSaveRef.current) clearInterval(progressSaveRef.current);
    };
  }, [isPlaying, saveProgress]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const video = videoRef.current;
    if (!video) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = x / rect.width;
    video.currentTime = pct * video.duration;
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  const setPlaybackSpeed = (s: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = s;
    setSpeed(s);
    setShowSpeedMenu(false);
  };

  const toggleFullscreen = () => {
    const video = videoRef.current;
    if (!video) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      video.requestFullscreen();
    }
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
          src={videoUrl}
          className="w-full h-full"
          onClick={togglePlay}
          playsInline
          onEnded={() => {
            setIsPlaying(false);
            const video = videoRef.current;
            if (video) saveProgress(video.currentTime, video.duration);
          }}
        />
        {!isPlaying && (
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

      {/* Controls */}
      <div className="px-3 py-2 space-y-1.5">
        {/* Seek bar */}
        <div className="h-1.5 bg-muted rounded-full cursor-pointer" onClick={handleSeek}>
          <div
            className="h-full bg-primary rounded-full transition-all duration-100"
            style={{ width: `${seekPercent}%` }}
          />
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
            {/* Speed */}
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
                      className={`block w-full text-left px-3 py-1 text-xs hover:bg-muted ${
                        speed === s ? "text-primary font-medium" : "text-foreground"
                      }`}
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
