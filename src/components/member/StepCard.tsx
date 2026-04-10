import { CheckCircle2, Lock, Play, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

export interface StepData {
  id: string;
  title: string;
  description?: string;
  order: number;
  step_type: string;
  video_url: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  is_locked: boolean;
  progress: {
    watch_percent: number;
    is_completed: boolean;
    last_position_seconds: number;
  };
}

interface StepCardProps {
  step: StepData;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
}

const formatDuration = (seconds: number | null) => {
  if (!seconds || seconds <= 0) return null;
  const mins = Math.round(seconds / 60);
  return mins > 0 ? `${mins} min` : "< 1 min";
};

export const StepCard = ({ step, index, isExpanded, onToggle }: StepCardProps) => {
  const { is_locked: isLocked, progress } = step;
  const isCompleted = progress.is_completed;
  const isInProgress = !isCompleted && !isLocked && progress.watch_percent > 0;
  const duration = formatDuration(step.duration_seconds);

  // Subtitle: description > duration > nothing (NEVER raw IDs)
  const subtitle = step.description || duration || null;

  return (
    <div
      className={`rounded-xl border transition-all duration-200 ${
        isLocked
          ? "opacity-40 cursor-not-allowed border-border bg-card"
          : isExpanded
          ? "border-primary/40 bg-card shadow-lg shadow-primary/5"
          : "border-border bg-card hover:border-primary/20 hover:bg-card/80"
      }`}
    >
      <div className="p-4 flex items-center gap-4">
        {/* Status circle */}
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-sm font-bold ${
            isCompleted
              ? "bg-primary/20 text-primary"
              : isInProgress
              ? "bg-blue-500/10 text-blue-400 ring-2 ring-blue-400/30 animate-pulse"
              : isLocked
              ? "bg-muted text-muted-foreground"
              : "border-2 border-muted-foreground/30 text-muted-foreground"
          }`}
        >
          {isCompleted ? (
            <CheckCircle2 size={20} />
          ) : isLocked ? (
            <Lock size={16} />
          ) : isInProgress ? (
            <Play size={16} fill="currentColor" />
          ) : (
            index + 1
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm text-foreground truncate">{step.title}</h3>
          {subtitle && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {duration && subtitle !== duration ? `${duration} · ${subtitle}` : subtitle}
            </p>
          )}
          {isInProgress && !isExpanded && (
            <div className="mt-1.5">
              <Progress value={progress.watch_percent} className="h-1" />
            </div>
          )}
        </div>

        {/* Action */}
        <div className="shrink-0">
          {isCompleted ? (
            <button
              onClick={onToggle}
              className="text-xs text-primary font-medium flex items-center gap-1 hover:underline"
            >
              <CheckCircle2 size={14} /> Watched
            </button>
          ) : isLocked ? null : (
            <Button size="sm" variant="hero" className="gap-1.5" onClick={onToggle}>
              {isExpanded ? (
                <><Pause size={14} /> Close</>
              ) : (
                <><Play size={14} /> {isInProgress ? "Continue" : "Watch"}</>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
