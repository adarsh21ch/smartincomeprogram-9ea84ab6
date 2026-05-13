import { Check, Loader2, AlertCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type Status = "idle" | "saving" | "saved" | "error";

interface SaveIndicatorProps {
  status: Status;
  savedAt?: number | null;
  className?: string;
}

export function SaveIndicator({ status, savedAt, className }: SaveIndicatorProps) {
  const [, force] = useState(0);
  // re-render every 30s so the "x ago" stays fresh
  useEffect(() => {
    if (status !== "saved" || !savedAt) return;
    const t = setInterval(() => force((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, [status, savedAt]);

  if (status === "idle") return null;

  if (status === "saving") {
    return (
      <span className={cn("inline-flex items-center gap-1.5 text-[11px] text-muted-foreground", className)}>
        <Loader2 size={12} className="animate-spin" /> Saving…
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className={cn("inline-flex items-center gap-1.5 text-[11px] text-destructive", className)}>
        <AlertCircle size={12} /> Save failed
      </span>
    );
  }
  // saved
  const ago = savedAt ? timeAgo(savedAt) : "just now";
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[11px] text-muted-foreground", className)}>
      <Check size={12} className="text-primary" /> Saved {ago}
    </span>
  );
}

function timeAgo(ts: number) {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}
