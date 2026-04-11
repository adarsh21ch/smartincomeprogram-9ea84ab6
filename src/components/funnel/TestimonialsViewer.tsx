import { useState, useRef, useEffect, useCallback } from "react";
import { Star, Volume2, VolumeX, Play, Pause } from "lucide-react";

interface Testimonial {
  id: string;
  type: string;
  student_name: string;
  student_location?: string;
  student_photo_url?: string;
  review_text?: string;
  video_url?: string;
  thumbnail_url?: string;
  video_duration_seconds?: number;
  video_orientation?: string;
}

interface TestimonialsViewerProps {
  testimonials: Testimonial[];
  sectionTitle: string;
}

const initials = (name: string) =>
  name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

const formatDuration = (sec?: number) => {
  if (!sec) return "";
  return `${Math.floor(sec / 60)}:${String(Math.round(sec) % 60).padStart(2, "0")}`;
};

/* ── Exclusive playback manager ── */
let globalCurrentVideo: HTMLVideoElement | null = null;
const setGlobalPlaying = (el: HTMLVideoElement | null) => {
  if (globalCurrentVideo && globalCurrentVideo !== el) {
    globalCurrentVideo.pause();
    globalCurrentVideo.currentTime = 0;
  }
  globalCurrentVideo = el;
};

export const TestimonialsViewer = ({ testimonials, sectionTitle }: TestimonialsViewerProps) => {
  const activeItems = testimonials.filter((t) => {
    if (t.type === "both") return Boolean(t.review_text?.trim()) || Boolean(t.video_url);
    if (t.type === "video") return true; // Show video testimonials even without video yet (shows name/photo)
    return Boolean(t.review_text?.trim());
  });

  if (activeItems.length === 0) return null;

  // Separate portrait and landscape for smart layout
  const portraitItems = activeItems.filter(
    (t) => (t.type === "video" || t.type === "both") && t.video_url && t.video_orientation !== "landscape"
  );
  const landscapeItems = activeItems.filter(
    (t) => (t.type === "video" || t.type === "both") && t.video_url && t.video_orientation === "landscape"
  );
  const textOnlyItems = activeItems.filter(
    (t) => t.type === "text" || ((t.type === "video" || t.type === "both") && !t.video_url)
  );

  return (
    <div className="space-y-5">
      <h2 className="text-[22px] font-semibold text-center" style={{ color: "#F5F0E8" }}>
        {sectionTitle}
      </h2>

      {/* All testimonials in a single horizontal swipeable row */}
      <div className="relative">
        <div
          className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-4 px-4 scrollbar-hide"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {activeItems.map((t) => {
            const isLandscape = t.video_orientation === "landscape";
            const hasVideo = (t.type === "video" || t.type === "both") && t.video_url;
            return (
              <div
                key={t.id}
                className="snap-center shrink-0"
                style={{
                  width: hasVideo && isLandscape ? "min(85vw, 420px)" : "min(72vw, 280px)",
                }}
              >
                <TestimonialCard testimonial={t} />
              </div>
            );
          })}
        </div>
        {activeItems.length > 1 && <ScrollDots count={activeItems.length} />}
      </div>
    </div>
  );
};

/* ── Scroll dot indicator for mobile ── */
const ScrollDots = ({ count }: { count: number }) => (
  <div className="flex justify-center gap-1.5 mt-2">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="w-1.5 h-1.5 rounded-full bg-white/30" />
    ))}
  </div>
);

/* ── Testimonial Card ── */
const TestimonialCard = ({ testimonial: t }: { testimonial: Testimonial }) => {
  const [expandedText, setExpandedText] = useState(false);
  const showText = t.type === "text" || t.type === "both";
  const showVideo = (t.type === "video" || t.type === "both") && t.video_url;
  const isLandscape = t.video_orientation === "landscape";

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: "#1a1a1a",
        border: "0.5px solid rgba(255,255,255,0.08)",
        boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
      }}
    >
      {/* Header: Photo + Name + Stars */}
      <div className="flex items-center gap-3 p-4 pb-2">
        {t.student_photo_url ? (
          <img
            src={t.student_photo_url}
            alt={t.student_name}
            className="w-11 h-11 rounded-full object-cover shrink-0"
            style={{ border: "2px solid #E8B830" }}
          />
        ) : (
          <div
            className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
            style={{ background: "rgba(232,184,48,0.15)", color: "#E8B830" }}
          >
            {initials(t.student_name || "?")}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate uppercase tracking-wide" style={{ color: "#F5F0E8" }}>
            {t.student_name}
          </p>
          {t.student_location && (
            <p className="text-xs truncate" style={{ color: "#888" }}>
              {t.student_location}
            </p>
          )}
        </div>
      </div>

      {/* Stars */}
      <div className="px-4 pb-2 flex gap-0.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <Star key={n} size={14} className="fill-amber-400 text-amber-400" />
        ))}
      </div>

      {/* Text */}
      {showText && t.review_text?.trim() && (
        <div className="px-4 pb-3">
          <TextContent
            text={t.review_text}
            expanded={expandedText}
            onToggle={() => setExpandedText(!expandedText)}
          />
        </div>
      )}

      {/* Video */}
      {showVideo && (
        <div className="px-3 pb-3">
          <VideoPlayer
            videoUrl={t.video_url!}
            thumbnailUrl={t.thumbnail_url}
            durationSeconds={t.video_duration_seconds}
            orientation={t.video_orientation || "portrait"}
          />
        </div>
      )}
    </div>
  );
};

/* ── Text Content ── */
const TextContent = ({ text, expanded, onToggle }: { text: string; expanded: boolean; onToggle: () => void }) => {
  const isLong = text.length > 140;
  return (
    <p className="text-sm leading-relaxed" style={{ color: "#aaa" }}>
      {isLong && !expanded ? text.slice(0, 140) + "..." : text}
      {isLong && (
        <button className="text-xs ml-1 hover:underline" style={{ color: "#E8B830" }} onClick={onToggle}>
          {expanded ? "show less" : "read more"}
        </button>
      )}
    </p>
  );
};

/* ── Video Player ── */
const VideoPlayer = ({ videoUrl, thumbnailUrl, durationSeconds, orientation }: {
  videoUrl: string; thumbnailUrl?: string; durationSeconds?: number; orientation: string;
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [generatedPoster, setGeneratedPoster] = useState<string | null>(null);
  const controlsTimer = useRef<ReturnType<typeof setTimeout>>();
  const isLandscape = orientation === "landscape";

  // Auto-generate poster thumbnail if none provided
  useEffect(() => {
    if (thumbnailUrl || !videoUrl) return;
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.src = videoUrl;
    video.onloadedmetadata = () => {
      video.currentTime = Math.min(0.5, video.duration * 0.1 || 0.1);
    };
    video.onseeked = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext("2d")?.drawImage(video, 0, 0);
        setGeneratedPoster(canvas.toDataURL("image/jpeg", 0.7));
      } catch { /* CORS — fallback to no poster */ }
    };
    return () => { video.src = ""; };
  }, [videoUrl, thumbnailUrl]);

  const posterSrc = thumbnailUrl || generatedPoster || undefined;

  // Preload metadata
  useEffect(() => {
    if (videoRef.current && videoUrl) {
      videoRef.current.preload = "metadata";
    }
  }, [videoUrl]);

  // IntersectionObserver: auto-pause when scrolled out of view
  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting && videoRef.current && !videoRef.current.paused) {
            videoRef.current.pause();
            setPlaying(false);
          }
        });
      },
      { threshold: 0.3 }
    );
    obs.observe(card);
    return () => obs.disconnect();
  }, []);

  // Progress tracking
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => {
      if (v.duration) setProgress((v.currentTime / v.duration) * 100);
    };
    v.addEventListener("timeupdate", onTime);
    return () => v.removeEventListener("timeupdate", onTime);
  }, []);

  const handlePlayPause = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (playing) {
      v.pause();
      setPlaying(false);
    } else {
      if (!hasStarted) setHasStarted(true);
      setGlobalPlaying(v);
      v.play().then(() => setPlaying(true)).catch(() => {
        v.muted = true;
        setMuted(true);
        v.play().then(() => setPlaying(true)).catch(() => {});
      });
    }
    // Show controls briefly
    setShowControls(true);
    clearTimeout(controlsTimer.current);
    controlsTimer.current = setTimeout(() => setShowControls(false), 3000);
  }, [playing, hasStarted]);

  const handleEnded = () => {
    setPlaying(false);
    setProgress(0);
    setHasStarted(false);
    globalCurrentVideo = null;
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      videoRef.current.muted = !muted;
      setMuted(!muted);
    }
  };

  const handleTouch = () => {
    setShowControls(true);
    clearTimeout(controlsTimer.current);
    controlsTimer.current = setTimeout(() => setShowControls(false), 3000);
  };

  const containerStyle = isLandscape
    ? "relative rounded-xl overflow-hidden bg-black cursor-pointer w-full aspect-video"
    : "relative rounded-xl overflow-hidden bg-black cursor-pointer w-full aspect-[9/16] max-h-[420px]";

  return (
    <div
      ref={cardRef}
      className={containerStyle}
      onClick={handlePlayPause}
      onMouseEnter={() => hasStarted && setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
      onTouchStart={handleTouch}
    >
      <video
        ref={videoRef}
        className="testimonial-video-el w-full h-full block"
        preload="auto"
        playsInline
        poster={posterSrc}
        muted={muted}
        onEnded={handleEnded}
        src={videoUrl}
        style={{
          objectFit: isLandscape ? "contain" : "cover",
          background: "#000",
          display: "block",
        }}
      />

      {/* Play overlay — shown when not playing */}
      {!playing && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
          <div
            className="w-[52px] h-[52px] rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-105"
            style={{ background: "rgba(255,255,255,0.9)", backdropFilter: "blur(4px)" }}
          >
            <Play size={22} className="text-black ml-0.5" />
          </div>
        </div>
      )}

      {/* Duration badge — shown before first play */}
      {!hasStarted && durationSeconds && durationSeconds > 0 && (
        <span
          className="absolute top-2 right-2 text-[11px] px-2 py-0.5 rounded-full font-medium"
          style={{ background: "rgba(0,0,0,0.7)", color: "#fff" }}
        >
          {formatDuration(durationSeconds)}
        </span>
      )}

      {/* Controls overlay — shown on hover/touch during playback */}
      {hasStarted && (showControls || !playing) && (
        <>
          {/* Mute button */}
          <button
            className="absolute top-2 left-2 z-10 w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
            onClick={toggleMute}
          >
            {muted ? (
              <VolumeX size={15} className="text-white" />
            ) : (
              <Volume2 size={15} className="text-white" />
            )}
          </button>

          {/* Pause indicator */}
          {!playing && (
            <button
              className="absolute top-2 right-2 z-10 w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
              onClick={(e) => { e.stopPropagation(); handlePlayPause(); }}
            >
              <Pause size={15} className="text-white" />
            </button>
          )}

          {/* Progress bar */}
          <div className="absolute bottom-0 left-0 right-0 h-1 z-10" style={{ background: "rgba(255,255,255,0.2)" }}>
            <div
              className="h-full transition-[width] duration-200"
              style={{ width: `${progress}%`, background: "#E8B830" }}
            />
          </div>
        </>
      )}
    </div>
  );
};
