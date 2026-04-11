import { useState, useEffect, useRef, useCallback } from "react";
import { CheckCircle2, Lock, Play, Timer, Trophy, SkipForward, ExternalLink, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VideoPlayer } from "./VideoPlayer";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

/* ─── Types ─── */
export interface RichStepData {
  id: string;
  title: string;
  description?: string | null;
  order: number;
  step_type: string;
  video_url: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  is_locked: boolean;
  cta_text?: string | null;
  cta_url?: string | null;
  unlock_condition?: string | null;
  unlock_percentage?: number | null;
  time_delay_enabled?: boolean;
  time_delay_minutes?: number;
  speaker_mode_step?: string | null;
  speaker_name_custom?: string | null;
  speaker_title?: string | null;
  speaker_bio?: string | null;
  speaker_photo_url_custom?: string | null;
  video_topics_step_enabled?: boolean;
  video_topics_step?: Array<{ icon: string; text: string }> | null;
  timer_cta_enabled?: boolean;
  timer_cta_text?: string | null;
  timer_cta_url?: string | null;
  timer_cta_style?: string | null;
  progress: {
    watch_percent: number;
    is_completed: boolean;
    last_position_seconds: number;
    condition_met_at?: string | null;
    max_watched_seconds?: number;
    time_spent_seconds?: number;
  };
}

interface FunnelData {
  id: string;
  name: string;
  description?: string;
  speaker_name?: string;
  speaker_photo_url?: string;
  speaker_about?: string;
  speaker_mode?: string;
  speaker_scope?: string;
  video_topics_enabled?: boolean;
  video_topics?: Array<{ icon: string; text: string }>;
  video_topics_scope?: string;
}

interface CreatorData {
  full_name?: string;
  avatar_url?: string;
  bio?: string;
  kyc_status?: string;
}

interface ProgramTabProps {
  funnel: FunnelData;
  steps: RichStepData[];
  completionPct: number;
  creatorProfile?: CreatorData | null;
  onStepComplete: () => void;
}

/* ─── Speaker Card ─── */
const SpeakerCard = ({ funnel, step, creatorProfile }: { funnel: FunnelData; step: RichStepData; creatorProfile?: CreatorData | null }) => {
  let speaker: { name: string; title?: string; bio?: string; photo?: string } | null = null;

  if (funnel.speaker_scope === "per_step") {
    const mode = step.speaker_mode_step || "none";
    if (mode === "none") return null;
    if (mode === "account" && creatorProfile) {
      speaker = { name: creatorProfile.full_name || "", photo: creatorProfile.avatar_url, bio: creatorProfile.bio };
    } else if (mode === "custom") {
      speaker = { name: step.speaker_name_custom || "", title: step.speaker_title || "", bio: step.speaker_bio || "", photo: step.speaker_photo_url_custom || "" };
    }
  } else {
    if (funnel.speaker_mode === "none") return null;
    if (funnel.speaker_mode === "account" && creatorProfile) {
      speaker = { name: creatorProfile.full_name || "", photo: creatorProfile.avatar_url, bio: creatorProfile.bio };
    } else if (funnel.speaker_mode === "custom") {
      speaker = { name: funnel.speaker_name || "", bio: funnel.speaker_about, photo: funnel.speaker_photo_url };
    }
  }

  if (!speaker || !speaker.name) return null;

  return (
    <div className="flex items-start gap-3 rounded-2xl p-4 border border-border/50 bg-card/50 backdrop-blur-sm">
      {speaker.photo && (
        <img src={speaker.photo} alt="" className="w-11 h-11 rounded-full object-cover shrink-0 ring-2 ring-primary/20" />
      )}
      <div className="min-w-0">
        <p className="font-semibold text-sm text-foreground">{speaker.name}</p>
        {speaker.title && <p className="text-xs text-primary mt-0.5">{speaker.title}</p>}
        {speaker.bio && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{speaker.bio}</p>}
      </div>
    </div>
  );
};

/* ─── Video Topics ─── */
const VideoTopics = ({ funnel, step }: { funnel: FunnelData; step: RichStepData }) => {
  let topics: Array<{ icon: string; text: string }> = [];

  if (funnel.video_topics_scope === "per_step") {
    if (step.video_topics_step_enabled && step.video_topics_step?.length) {
      topics = step.video_topics_step;
    }
  } else {
    if (funnel.video_topics_enabled && funnel.video_topics?.length) {
      topics = funnel.video_topics;
    }
  }

  if (topics.length === 0) return null;

  return (
    <div className="rounded-2xl p-4 border border-border/50 bg-card/50 backdrop-blur-sm space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Key Points</p>
      <ul className="space-y-1.5">
        {topics.map((t, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-foreground">
            <span className="shrink-0">{t.icon || "✅"}</span>
            <span>{t.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

/* ─── Countdown Timer ─── */
const CountdownTimer = ({ unlockAt, onUnlock, step, timerCta }: {
  unlockAt: number;
  onUnlock: () => void;
  step: RichStepData;
  timerCta?: { enabled: boolean; text: string; url: string; style: string };
}) => {
  const [remaining, setRemaining] = useState(Math.max(0, unlockAt - Date.now()));

  useEffect(() => {
    const interval = setInterval(() => {
      const r = unlockAt - Date.now();
      if (r <= 0) {
        clearInterval(interval);
        setRemaining(0);
        onUnlock();
      } else {
        setRemaining(r);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [unlockAt, onUnlock]);

  const hours = Math.floor(remaining / 3600000);
  const minutes = Math.floor((remaining % 3600000) / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);

  const ctaButtonStyle = timerCta?.style === "white"
    ? "bg-white text-black hover:bg-white/90"
    : timerCta?.style === "outline"
    ? "border border-white/30 text-white bg-transparent hover:bg-white/10"
    : "bg-primary text-primary-foreground hover:bg-primary/90";

  return (
    <div className="rounded-2xl p-6 text-center space-y-4 border border-primary/15 bg-gradient-to-b from-primary/5 to-transparent">
      <div className="flex items-center justify-center gap-2">
        <Timer size={16} className="text-primary" />
        <p className="text-sm font-semibold text-primary">Next step unlocks in</p>
      </div>

      <p className="font-semibold text-sm text-foreground">
        {step.title}
      </p>

      <div className="flex items-center justify-center gap-3">
        {hours > 0 && (
          <div className="bg-muted/50 rounded-xl px-4 py-3 min-w-[70px]">
            <span className="text-3xl font-bold font-mono text-primary">{hours}</span>
            <p className="text-[10px] uppercase tracking-wider mt-0.5 text-muted-foreground">hr</p>
          </div>
        )}
        <div className="bg-muted/50 rounded-xl px-4 py-3 min-w-[70px]">
          <span className="text-3xl font-bold font-mono text-primary">{minutes.toString().padStart(2, "0")}</span>
          <p className="text-[10px] uppercase tracking-wider mt-0.5 text-muted-foreground">min</p>
        </div>
        <span className="text-2xl font-bold text-primary/40">:</span>
        <div className="bg-muted/50 rounded-xl px-4 py-3 min-w-[70px]">
          <span className="text-3xl font-bold font-mono text-primary">{seconds.toString().padStart(2, "0")}</span>
          <p className="text-[10px] uppercase tracking-wider mt-0.5 text-muted-foreground">sec</p>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">Great job! This step will unlock automatically.</p>

      {timerCta?.enabled && timerCta.text && timerCta.url && (
        <Button
          className={`w-full font-bold ${ctaButtonStyle}`}
          onClick={() => window.open(timerCta.url, "_blank")}
        >
          {timerCta.text} <ExternalLink size={14} className="ml-1" />
        </Button>
      )}
    </div>
  );
};

/* ─── Horizontal Step Indicator ─── */
const StepIndicator = ({ steps, activeIndex, onStepClick }: {
  steps: RichStepData[];
  activeIndex: number;
  onStepClick: (index: number) => void;
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const activeEl = el.children[activeIndex] as HTMLElement;
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [activeIndex]);

  return (
    <div ref={scrollRef} className="flex items-center gap-1 overflow-x-auto pb-2 scrollbar-hide">
      {steps.map((step, i) => {
        const isCompleted = step.progress.is_completed;
        const isActive = i === activeIndex;
        const isLocked = step.is_locked && !isCompleted;

        return (
          <button
            key={step.id}
            onClick={() => onStepClick(i)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all shrink-0 ${
              isActive
                ? "bg-primary/15 text-primary border border-primary/30 shadow-sm shadow-primary/10"
                : isCompleted
                ? "bg-green-500/10 text-green-400 border border-green-500/20"
                : isLocked
                ? "bg-muted/30 text-muted-foreground/50 border border-border/30 cursor-not-allowed"
                : "bg-muted/50 text-muted-foreground border border-border/50 hover:border-primary/20"
            }`}
          >
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
              isCompleted
                ? "bg-green-500/20 text-green-400"
                : isActive
                ? "bg-primary/20 text-primary"
                : isLocked
                ? "bg-muted text-muted-foreground/50"
                : "bg-muted text-muted-foreground"
            }`}>
              {isCompleted ? <CheckCircle2 size={12} /> : isLocked ? <Lock size={10} /> : i + 1}
            </span>
            <span className="hidden sm:inline">{step.title || `Step ${i + 1}`}</span>
            <span className="sm:hidden">S{i + 1}</span>
          </button>
        );
      })}
    </div>
  );
};

/* ─── Up Next Card ─── */
const UpNextCard = ({ nextStep, nextIndex, isUnlocked, onPlay }: {
  nextStep: RichStepData;
  nextIndex: number;
  isUnlocked: boolean;
  onPlay: () => void;
}) => {
  if (!isUnlocked) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl p-4 flex items-center justify-between gap-3 border border-primary/20 bg-gradient-to-r from-primary/5 to-transparent cursor-pointer hover:from-primary/10 transition-all"
      onClick={onPlay}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-primary/15">
          <SkipForward size={18} className="text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-0.5">Up Next</p>
          <p className="font-semibold text-sm text-foreground truncate">
            Step {nextIndex + 1}: {nextStep.title}
          </p>
        </div>
      </div>
      <Button size="sm" className="shrink-0 gap-1">
        Play <ChevronRight size={14} />
      </Button>
    </motion.div>
  );
};

/* ═══════════ MAIN COMPONENT ═══════════ */
export const ProgramTab = ({ funnel, steps, completionPct, creatorProfile, onStepComplete }: ProgramTabProps) => {
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [countdownUnlocks, setCountdownUnlocks] = useState<Record<string, number>>({});
  const completedSteps = steps.filter((s) => s.progress.is_completed).length;
  const allComplete = steps.length > 0 && completedSteps === steps.length;

  // Find the first non-completed, non-locked step on mount
  useEffect(() => {
    for (let i = 0; i < steps.length; i++) {
      if (!steps[i].progress.is_completed && !steps[i].is_locked) {
        setActiveStepIndex(i);
        return;
      }
    }
    // If all completed, show last step
    if (steps.length > 0) setActiveStepIndex(steps.length - 1);
  }, [steps]);

  // Check for countdown-locked steps
  useEffect(() => {
    const countdowns: Record<string, number> = {};
    for (let i = 1; i < steps.length; i++) {
      const step = steps[i];
      const prevStep = steps[i - 1];
      if (step.is_locked && step.time_delay_enabled && (step.time_delay_minutes || 0) > 0) {
        const conditionMetAt = prevStep.progress.condition_met_at;
        if (conditionMetAt) {
          const delayMs = (step.time_delay_minutes || 0) * 60 * 1000;
          const unlockAt = new Date(conditionMetAt).getTime() + delayMs;
          if (Date.now() < unlockAt) {
            countdowns[step.id] = unlockAt;
          }
        }
      }
    }
    setCountdownUnlocks(countdowns);
  }, [steps]);

  const handleStepClick = (index: number) => {
    const step = steps[index];
    if (step.is_locked && !step.progress.is_completed && !countdownUnlocks[step.id]) {
      toast.error("Complete the previous step first", { duration: 2000 });
      return;
    }
    setActiveStepIndex(index);
  };

  const handleCountdownComplete = useCallback((stepId: string) => {
    setCountdownUnlocks((prev) => {
      const n = { ...prev };
      delete n[stepId];
      return n;
    });
    onStepComplete(); // Refetch data
    toast.success("Step unlocked! 🎉");
  }, [onStepComplete]);

  const activeStep = steps[activeStepIndex];
  const nextStep = activeStepIndex + 1 < steps.length ? steps[activeStepIndex + 1] : null;
  const isNextUnlocked = nextStep ? !nextStep.is_locked || nextStep.progress.is_completed : false;
  const hasCountdown = activeStep ? !!countdownUnlocks[activeStep.id] : false;

  if (steps.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center">
        <p className="text-muted-foreground">No content yet. Check back soon.</p>
      </div>
    );
  }

  if (allComplete) {
    return (
      <div className="space-y-5">
        {/* Progress */}
        <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{completedSteps} of {steps.length} steps completed</span>
            <span className="font-medium text-green-400">100% ✨</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: "100%" }} />
          </div>
        </div>

        <div className="rounded-2xl border border-primary/20 bg-gradient-to-b from-primary/5 to-transparent p-8 text-center space-y-3">
          <Trophy size={40} className="mx-auto text-primary" />
          <h2 className="text-xl font-bold text-foreground">Program Complete! 🎉</h2>
          <p className="text-sm text-muted-foreground">Congratulations! You've completed all steps.</p>
        </div>

        <StepIndicator steps={steps} activeIndex={activeStepIndex} onStepClick={handleStepClick} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">
            {completedSteps} of {steps.length} steps completed
          </span>
          <span className="font-medium">{completionPct}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${completionPct}%` }}
          />
        </div>
      </div>

      {/* Horizontal step indicator */}
      <StepIndicator steps={steps} activeIndex={activeStepIndex} onStepClick={handleStepClick} />

      {/* Active step content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeStep.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="space-y-3"
        >
          {/* Step header */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Step {activeStepIndex + 1} of {steps.length}
            </span>
            {activeStep.progress.is_completed && (
              <span className="text-[10px] font-bold uppercase tracking-widest text-green-400 flex items-center gap-1">
                <CheckCircle2 size={12} /> Completed
              </span>
            )}
          </div>
          <h2 className="text-lg font-bold text-foreground">{activeStep.title}</h2>
          {activeStep.description && (
            <p className="text-sm text-muted-foreground">{activeStep.description}</p>
          )}

          {/* Video or Countdown */}
          {hasCountdown ? (
            <CountdownTimer
              unlockAt={countdownUnlocks[activeStep.id]}
              onUnlock={() => handleCountdownComplete(activeStep.id)}
              step={activeStep}
              timerCta={activeStep.timer_cta_enabled ? {
                enabled: true,
                text: activeStep.timer_cta_text || "",
                url: activeStep.timer_cta_url || "",
                style: activeStep.timer_cta_style || "gold",
              } : undefined}
            />
          ) : activeStep.is_locked && !activeStep.progress.is_completed ? (
            <div className="rounded-2xl border border-border bg-muted/20 p-8 text-center space-y-3">
              <Lock size={32} className="mx-auto text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">Complete the previous step to unlock this one.</p>
              <Button size="sm" variant="outline" onClick={() => handleStepClick(activeStepIndex - 1)}>
                ← Go to Step {activeStepIndex}
              </Button>
            </div>
          ) : activeStep.step_type === "video" ? (
            <VideoPlayer
              videoUrl={activeStep.video_url}
              stepTitle={activeStep.title}
              stepId={activeStep.id}
              funnelId={funnel.id}
              initialPosition={activeStep.progress.last_position_seconds}
              durationSeconds={activeStep.duration_seconds}
              onComplete={() => {
                onStepComplete();
                // Auto-advance to next step after a short delay
                if (nextStep && !nextStep.is_locked) {
                  setTimeout(() => setActiveStepIndex(activeStepIndex + 1), 1500);
                }
              }}
              onClose={() => {}}
            />
          ) : activeStep.step_type === "cta" ? (
            <div className="rounded-2xl border border-primary/20 bg-card p-6 text-center space-y-3">
              <ExternalLink size={28} className="mx-auto text-primary" />
              <p className="text-sm text-muted-foreground">{activeStep.description || "Click below to continue"}</p>
              <Button onClick={() => {
                if (activeStep.cta_url) window.open(activeStep.cta_url, "_blank");
              }}>
                {activeStep.cta_text || "Continue"} <ExternalLink size={14} className="ml-1" />
              </Button>
            </div>
          ) : null}

          {/* Speaker card */}
          <SpeakerCard funnel={funnel} step={activeStep} creatorProfile={creatorProfile} />

          {/* Video topics */}
          <VideoTopics funnel={funnel} step={activeStep} />

          {/* CTA button if step has one */}
          {activeStep.cta_text && activeStep.cta_url && activeStep.step_type === "video" && (
            <Button
              className="w-full"
              onClick={() => window.open(activeStep.cta_url!, "_blank")}
            >
              {activeStep.cta_text} <ExternalLink size={14} className="ml-1" />
            </Button>
          )}

          {/* Up Next */}
          {nextStep && !hasCountdown && (
            <>
              {countdownUnlocks[nextStep.id] ? (
                <CountdownTimer
                  unlockAt={countdownUnlocks[nextStep.id]}
                  onUnlock={() => handleCountdownComplete(nextStep.id)}
                  step={nextStep}
                  timerCta={nextStep.timer_cta_enabled ? {
                    enabled: true,
                    text: nextStep.timer_cta_text || "",
                    url: nextStep.timer_cta_url || "",
                    style: nextStep.timer_cta_style || "gold",
                  } : undefined}
                />
              ) : isNextUnlocked ? (
                <UpNextCard
                  nextStep={nextStep}
                  nextIndex={activeStepIndex + 1}
                  isUnlocked={true}
                  onPlay={() => setActiveStepIndex(activeStepIndex + 1)}
                />
              ) : (
                <div className="rounded-2xl p-4 border border-border/50 bg-muted/10">
                  <div className="flex items-center gap-2 mb-2">
                    <Lock size={12} className="text-muted-foreground/50" />
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">Up Next — Locked</p>
                  </div>
                  <p className="font-medium text-sm text-foreground/80">
                    Step {activeStepIndex + 2}: {nextStep.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {nextStep.unlock_condition === "percentage"
                      ? `Watch at least ${nextStep.unlock_percentage || 80}% to unlock`
                      : "Complete this step to unlock the next one"}
                  </p>
                  {nextStep.unlock_condition === "percentage" && (
                    <div className="mt-2">
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary/60 transition-all"
                          style={{ width: `${Math.min(100, (activeStep.progress.watch_percent / (nextStep.unlock_percentage || 80)) * 100)}%` }}
                        />
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {activeStep.progress.watch_percent}% / {nextStep.unlock_percentage || 80}% needed
                      </p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Final step indicator */}
          {!nextStep && !activeStep.progress.is_completed && (
            <div className="rounded-2xl p-5 text-center border border-primary/15 bg-gradient-to-b from-primary/5 to-transparent">
              <Trophy size={28} className="mx-auto mb-2 text-primary" />
              <p className="font-semibold text-sm text-foreground">You're on the final step!</p>
              <p className="text-xs text-muted-foreground mt-1">Complete this to finish the program.</p>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
