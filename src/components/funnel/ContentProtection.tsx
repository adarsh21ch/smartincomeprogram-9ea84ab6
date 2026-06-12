import { useEffect, useState, useRef } from "react";
import { ShieldAlert } from "lucide-react";

/**
 * ContentProtection
 *
 * Wraps a region (typically the full public funnel viewer) and applies a series
 * of deterrents against screenshots, screen-recording, copying, and unauthorized
 * downloading of the content displayed inside.
 *
 * Important: no web technology can 100% prevent OS-level screen capture. These
 * are strong deterrents that will stop casual users and most automated capture.
 *
 * What it does:
 *  - Disables right-click / context menu
 *  - Disables text selection, drag, copy, cut
 *  - Blocks PrintScreen, Ctrl+S/P/U, F12, Ctrl+Shift+I/J/C, Ctrl+A
 *  - Blurs the content when the tab loses focus or visibility changes
 *  - Detects open DevTools and shows a warning overlay
 *  - Renders a faint viewer-identifying watermark across the surface
 */
interface ContentProtectionProps {
  children: React.ReactNode;
  watermark?: string; // viewer identifier (name / phone / email) — appears tiled across content
  enabled?: boolean;
}

export const ContentProtection = ({
  children,
  watermark,
  enabled = true,
}: ContentProtectionProps) => {
  const [blurred, setBlurred] = useState(false);
  const [devtoolsOpen, setDevtoolsOpen] = useState(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [flashWarning, setFlashWarning] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    const showFlash = () => {
      setFlashWarning(true);
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setFlashWarning(false), 2500);
    };

    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      showFlash();
    };
    const onSelectStart = (e: Event) => e.preventDefault();
    const onDragStart = (e: DragEvent) => e.preventDefault();
    const onCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      showFlash();
    };
    const onCut = (e: ClipboardEvent) => e.preventDefault();

    const onKeyDown = (e: KeyboardEvent) => {
      // PrintScreen
      if (e.key === "PrintScreen") {
        navigator.clipboard?.writeText("").catch(() => {});
        showFlash();
        e.preventDefault();
        return;
      }
      const k = e.key.toLowerCase();
      // DevTools shortcuts
      if (e.key === "F12") {
        e.preventDefault();
        showFlash();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && ["i", "j", "c"].includes(k)) {
        e.preventDefault();
        showFlash();
        return;
      }
      // Save / Print / View Source / Select all
      if ((e.ctrlKey || e.metaKey) && ["s", "p", "u", "a"].includes(k)) {
        e.preventDefault();
        showFlash();
        return;
      }
    };

    const onVisibility = () => {
      setBlurred(document.visibilityState !== "visible");
    };
    const onBlur = () => setBlurred(true);
    const onFocus = () => setBlurred(false);

    document.addEventListener("contextmenu", onContextMenu);
    document.addEventListener("selectstart", onSelectStart);
    document.addEventListener("dragstart", onDragStart);
    document.addEventListener("copy", onCopy);
    document.addEventListener("cut", onCut);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);

    // DevTools open detection via size differential
    const devtoolsCheck = setInterval(() => {
      const threshold = 160;
      const widthOpen = window.outerWidth - window.innerWidth > threshold;
      const heightOpen = window.outerHeight - window.innerHeight > threshold;
      setDevtoolsOpen(widthOpen || heightOpen);
    }, 1000);

    return () => {
      document.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("selectstart", onSelectStart);
      document.removeEventListener("dragstart", onDragStart);
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("cut", onCut);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      clearInterval(devtoolsCheck);
      if (flashTimer.current) clearTimeout(flashTimer.current);
    };
  }, [enabled]);

  if (!enabled) return <>{children}</>;

  // Watermark text tiled across the surface
  const wmText = watermark || "Protected Content";

  return (
    <div
      className="relative"
      style={{
        userSelect: "none",
        WebkitUserSelect: "none",
        WebkitTouchCallout: "none",
      }}
    >
      <style>{`
        .cp-no-save img, .cp-no-save video { -webkit-user-drag: none; user-drag: none; pointer-events: auto; }
        .cp-no-save video::-webkit-media-controls-download-button { display: none !important; }
        .cp-no-save video::-internal-media-controls-download-button { display: none !important; }
      `}</style>

      <div
        className="cp-no-save"
        style={{
          filter: blurred ? "blur(28px)" : "none",
          transition: "filter 180ms ease",
        }}
      >
        {children}
      </div>

      {/* Tiled watermark — non-interactive, faint */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[60] overflow-hidden mix-blend-difference"
        style={{ opacity: 0.08 }}
      >
        <div
          style={{
            position: "absolute",
            inset: "-20%",
            transform: "rotate(-22deg)",
            color: "white",
            fontSize: "13px",
            fontWeight: 600,
            letterSpacing: "0.12em",
            lineHeight: "120px",
            whiteSpace: "nowrap",
            userSelect: "none",
          }}
        >
          {Array.from({ length: 40 }).map((_, i) => (
            <div key={i}>
              {Array.from({ length: 14 }).map((_, j) => (
                <span key={j} style={{ marginRight: "120px" }}>{wmText}</span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Blur overlay when tab not focused */}
      {blurred && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 backdrop-blur-md">
          <div className="text-center px-6">
            <ShieldAlert size={36} className="text-amber-400 mx-auto mb-3" />
            <p className="text-white font-heading font-bold text-lg">Content Paused</p>
            <p className="text-white/70 text-sm mt-1 max-w-sm">
              Return to this tab to continue viewing protected content.
            </p>
          </div>
        </div>
      )}

      {/* Recording attempt warning */}
      {flashWarning && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[90] flex items-center gap-2 px-4 py-2.5 bg-red-600/95 text-white text-sm font-semibold rounded-xl shadow-xl animate-in fade-in slide-in-from-top-2">
          <ShieldAlert size={16} />
          Recording / copying is disabled for this content
        </div>
      )}

      {/* DevTools warning */}
      {devtoolsOpen && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/90 backdrop-blur-md">
          <div className="text-center px-6 max-w-md">
            <ShieldAlert size={48} className="text-red-500 mx-auto mb-4" />
            <p className="text-white font-heading font-bold text-2xl mb-2">
              Developer Tools Detected
            </p>
            <p className="text-white/80 text-sm">
              For privacy and security, content has been hidden. Please close developer tools to continue viewing.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Apply protective attributes to a <video> element to disable native
 * download / picture-in-picture / remote playback.
 */
export const PROTECTED_VIDEO_PROPS = {
  controlsList: "nodownload noremoteplayback noplaybackrate",
  disablePictureInPicture: true,
  disableRemotePlayback: true,
  onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
} as const;
