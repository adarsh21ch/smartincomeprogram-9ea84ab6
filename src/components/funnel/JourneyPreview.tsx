import { getStepTypeMeta } from "./StepTypeSelector";
import { Check, Lock } from "lucide-react";

interface FlowStep {
  id?: string;
  step_order: number;
  title: string;
  description: string;
  step_type: string;
  video_asset_id: string | null;
  is_active: boolean;
  unlock_rule_type: string;
  unlock_rule_value: string;
  cta_text: string;
  cta_url: string;
  booking_url: string;
  time_delay_enabled?: boolean;
  time_delay_minutes?: number;
  timer_cta_enabled?: boolean;
  timer_cta_text?: string;
  access_code_enabled?: boolean;
}

interface JourneyPreviewProps {
  steps: FlowStep[];
  className?: string;
}

const UNLOCK_LABELS: Record<string, string> = {
  auto: "Auto",
  watch_complete: "After full watch",
  watch_seconds: "After X seconds",
  watch_percent: "After X%",
  cta_click: "After CTA click",
  lead_submitted: "After form submit",
  payment_submitted: "After payment",
  manual: "Manual unlock",
  booking_done: "After booking",
};

export const JourneyPreview = ({ steps, className = "" }: JourneyPreviewProps) => {
  if (steps.length === 0) return null;

  return (
    <div className={className}>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        Journey Preview
      </h3>
      <div className="space-y-0">
        {steps.map((step, idx) => {
          const meta = getStepTypeMeta(step.step_type);
          const isLast = idx === steps.length - 1;
          return (
            <div key={idx} className="flex gap-3">
              {/* Timeline */}
              <div className="flex flex-col items-center">
                <div className={`w-7 h-7 rounded-full ${meta.bg} flex items-center justify-center shrink-0 border-2 ${step.is_active ? "border-primary/30" : "border-border"}`}>
                  <meta.icon size={12} className={step.is_active ? meta.color : "text-muted-foreground"} />
                </div>
                {!isLast && (
                  <div className="w-px flex-1 min-h-[24px] bg-border" />
                )}
              </div>
              {/* Content */}
              <div className={`pb-4 min-w-0 ${!step.is_active ? "opacity-40" : ""}`}>
                <p className="text-sm font-medium text-foreground leading-tight truncate">
                  {step.title || `Step ${idx + 1}`}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {meta.label}
                  {idx > 0 && ` · ${UNLOCK_LABELS[step.unlock_rule_type] || "Auto"}`}
                </p>

                {(step.time_delay_enabled || step.timer_cta_enabled || step.access_code_enabled) && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {step.access_code_enabled && (
                      <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-500">
                        🔐 Code
                      </span>
                    )}
                    {step.time_delay_enabled && (step.time_delay_minutes || 0) > 0 && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                        ⏱ {step.time_delay_minutes} min wait
                      </span>
                    )}
                    {step.timer_cta_enabled && step.timer_cta_text && (
                      <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-medium text-accent-foreground">
                        CTA during wait
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
